package buffer

import (
	"path/filepath"
	"testing"
)

func openTemp(t *testing.T, max int) *WAL {
	t.Helper()
	w, err := Open(filepath.Join(t.TempDir(), "wal.db"), max)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	t.Cleanup(func() { _ = w.Close() })
	return w
}

func TestAppendOldestDelete(t *testing.T) {
	w := openTemp(t, 100)

	if item, _ := w.Oldest(); item != nil {
		t.Fatalf("expected empty WAL, got %v", item)
	}

	if err := w.Append("b1", []byte("one")); err != nil {
		t.Fatalf("append: %v", err)
	}
	if err := w.Append("b2", []byte("two")); err != nil {
		t.Fatalf("append: %v", err)
	}

	item, err := w.Oldest()
	if err != nil {
		t.Fatalf("oldest: %v", err)
	}
	if item.BatchID != "b1" || string(item.Payload) != "one" {
		t.Fatalf("expected oldest b1/one, got %s/%s", item.BatchID, item.Payload)
	}

	if err := w.Delete(item.Key); err != nil {
		t.Fatalf("delete: %v", err)
	}
	item, _ = w.Oldest()
	if item == nil || item.BatchID != "b2" {
		t.Fatalf("expected b2 after delete, got %v", item)
	}
}

func TestBoundDropsOldest(t *testing.T) {
	w := openTemp(t, 3)
	for _, id := range []string{"b1", "b2", "b3", "b4", "b5"} {
		if err := w.Append(id, []byte(id)); err != nil {
			t.Fatalf("append %s: %v", id, err)
		}
	}
	n, _ := w.Len()
	if n != 3 {
		t.Fatalf("expected len 3 after bound, got %d", n)
	}
	item, _ := w.Oldest()
	if item.BatchID != "b3" {
		t.Fatalf("expected oldest b3 (b1,b2 dropped), got %s", item.BatchID)
	}
}

func TestPersistsAcrossReopen(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "wal.db")

	w, err := Open(path, 100)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	if err := w.Append("b1", []byte("survive")); err != nil {
		t.Fatalf("append: %v", err)
	}
	_ = w.Close()

	w2, err := Open(path, 100)
	if err != nil {
		t.Fatalf("reopen: %v", err)
	}
	defer w2.Close()

	item, _ := w2.Oldest()
	if item == nil || item.BatchID != "b1" || string(item.Payload) != "survive" {
		t.Fatalf("expected buffered item to survive restart, got %v", item)
	}
}
