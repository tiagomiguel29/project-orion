package ingest

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"math/big"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestBuildTransportCreds_SkipVerify(t *testing.T) {
	creds, err := buildTransportCreds(TLSConfig{InsecureSkipVerify: true})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if creds == nil {
		t.Fatal("expected non-nil credentials")
	}
}

func TestBuildTransportCreds_MissingCAFile(t *testing.T) {
	_, err := buildTransportCreds(TLSConfig{CAFile: "/no/such/ca.pem"})
	if err == nil {
		t.Fatal("expected an error for a missing CA file")
	}
}

func TestBuildTransportCreds_GarbageCAFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "bad.pem")
	if err := os.WriteFile(path, []byte("not a certificate"), 0o600); err != nil {
		t.Fatal(err)
	}
	_, err := buildTransportCreds(TLSConfig{CAFile: path})
	if err == nil {
		t.Fatal("expected an error for a PEM with no certificates")
	}
}

func TestBuildTransportCreds_ValidCAFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "ca.pem")
	if err := os.WriteFile(path, selfSignedCertPEM(t), 0o600); err != nil {
		t.Fatal(err)
	}
	creds, err := buildTransportCreds(TLSConfig{CAFile: path})
	if err != nil {
		t.Fatalf("unexpected error for valid CA: %v", err)
	}
	if creds == nil {
		t.Fatal("expected non-nil credentials")
	}
}

func selfSignedCertPEM(t *testing.T) []byte {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	tmpl := &x509.Certificate{
		SerialNumber:          big.NewInt(1),
		Subject:               pkix.Name{CommonName: "test-ca"},
		NotBefore:             time.Now().Add(-time.Hour),
		NotAfter:              time.Now().Add(time.Hour),
		IsCA:                  true,
		BasicConstraintsValid: true,
	}
	der, err := x509.CreateCertificate(rand.Reader, tmpl, tmpl, &key.PublicKey, key)
	if err != nil {
		t.Fatal(err)
	}
	return pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
}
