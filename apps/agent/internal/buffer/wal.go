// Package buffer implements a small disk-backed write-ahead log used as a
// store-and-forward queue for telemetry batches. Batches are appended as they
// are collected and drained oldest-first by the sender; they survive network
// blips, backend restarts, and agent restarts (when WALPath is on a persistent
// volume). The queue is bounded — once full, the oldest batches are dropped so
// the agent never grows without limit.
package buffer

import (
	"encoding/binary"
	"fmt"
	"log"
	"time"

	bolt "go.etcd.io/bbolt"
)

var bucketName = []byte("batches")

// Item is a single buffered batch. Key is the opaque WAL key used to delete the
// item once it has been durably accepted by the server.
type Item struct {
	Key     []byte
	BatchID string
	Payload []byte
}

type WAL struct {
	db  *bolt.DB
	max int
}

// Open opens (or creates) the WAL at path with a bound of max buffered batches.
func Open(path string, max int) (*WAL, error) {
	db, err := bolt.Open(path, 0o600, &bolt.Options{Timeout: 5 * time.Second})
	if err != nil {
		return nil, fmt.Errorf("open wal: %w", err)
	}
	err = db.Update(func(tx *bolt.Tx) error {
		_, e := tx.CreateBucketIfNotExists(bucketName)
		return e
	})
	if err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("init wal bucket: %w", err)
	}
	if max <= 0 {
		max = 10000
	}
	return &WAL{db: db, max: max}, nil
}

func (w *WAL) Close() error { return w.db.Close() }

// Append stores a batch, dropping the oldest entries first if the bound is hit.
func (w *WAL) Append(batchID string, payload []byte) error {
	return w.db.Update(func(tx *bolt.Tx) error {
		b := tx.Bucket(bucketName)

		// Count via cursor (Stats().KeyN does not reflect deletes made within
		// the same transaction).
		count := 0
		countCur := b.Cursor()
		for k, _ := countCur.First(); k != nil; k, _ = countCur.Next() {
			count++
		}

		// Enforce the bound: drop oldest until there is room for one more.
		dropped := 0
		for count >= w.max {
			c := b.Cursor()
			k, _ := c.First()
			if k == nil {
				break
			}
			if err := c.Delete(); err != nil {
				return err
			}
			count--
			dropped++
		}
		if dropped > 0 {
			log.Printf("wal full: dropped %d oldest batch(es) (max=%d)", dropped, w.max)
		}

		seq, err := b.NextSequence()
		if err != nil {
			return err
		}
		key := make([]byte, 8)
		binary.BigEndian.PutUint64(key, seq)
		return b.Put(key, encode(batchID, payload))
	})
}

// Oldest returns the oldest buffered item, or nil if the WAL is empty.
func (w *WAL) Oldest() (*Item, error) {
	var item *Item
	err := w.db.View(func(tx *bolt.Tx) error {
		c := tx.Bucket(bucketName).Cursor()
		k, v := c.First()
		if k == nil {
			return nil
		}
		batchID, payload := decode(v)
		// Copy out of the transaction-owned memory.
		key := append([]byte(nil), k...)
		item = &Item{Key: key, BatchID: batchID, Payload: append([]byte(nil), payload...)}
		return nil
	})
	return item, err
}

// Delete removes an item by key after it has been accepted by the server.
func (w *WAL) Delete(key []byte) error {
	return w.db.Update(func(tx *bolt.Tx) error {
		return tx.Bucket(bucketName).Delete(key)
	})
}

// Len returns the number of buffered batches.
func (w *WAL) Len() (int, error) {
	var n int
	err := w.db.View(func(tx *bolt.Tx) error {
		n = tx.Bucket(bucketName).Stats().KeyN
		return nil
	})
	return n, err
}

// Record layout: [4-byte big-endian batchID length][batchID][payload].
func encode(batchID string, payload []byte) []byte {
	idLen := len(batchID)
	out := make([]byte, 4+idLen+len(payload))
	binary.BigEndian.PutUint32(out[:4], uint32(idLen))
	copy(out[4:4+idLen], batchID)
	copy(out[4+idLen:], payload)
	return out
}

func decode(v []byte) (batchID string, payload []byte) {
	if len(v) < 4 {
		return "", nil
	}
	idLen := int(binary.BigEndian.Uint32(v[:4]))
	if 4+idLen > len(v) {
		return "", nil
	}
	return string(v[4 : 4+idLen]), v[4+idLen:]
}
