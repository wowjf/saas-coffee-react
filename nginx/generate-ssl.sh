#!/usr/bin/env bash
set -euo pipefail

# Sertifika Common Name (CN): $1 argümanı > SSL_CN ortam değişkeni > localhost
CN="${1:-${SSL_CN:-localhost}}"

CERT_DIR="./nginx/ssl/live"
mkdir -p "$CERT_DIR"

if [[ ! -f "$CERT_DIR/fullchain.pem" || ! -f "$CERT_DIR/privkey.pem" ]]; then
  echo "Generating initial self-signed SSL certificate for CN=${CN} (HTTPS access)..."
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "$CERT_DIR/privkey.pem" \
    -out "$CERT_DIR/fullchain.pem" \
    -subj "/C=TR/ST=Istanbul/L=Istanbul/O=BrewAndBloom/CN=${CN}"
  echo "SSL certificate created at $CERT_DIR (CN=${CN})"
  echo "Not: Geçerli bir alan adı için Let's Encrypt kullanin — bkz. README 'SSL rotasyonu talimati'."
else
  echo "SSL certificate already exists at $CERT_DIR"
fi
