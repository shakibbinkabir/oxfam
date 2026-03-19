#!/bin/bash
# First-time SSL certificate generation with Let's Encrypt
# Usage: ./scripts/init-ssl.sh yourdomain.com admin@yourdomain.com
set -e

DOMAIN=${1:?Usage: $0 <domain> <email>}
EMAIL=${2:?Usage: $0 <domain> <email>}
CERT_DIR="./certbot/conf"
WEBROOT_DIR="./certbot/www"

echo "=== CRVAP SSL Certificate Setup ==="
echo "Domain: $DOMAIN"
echo "Email:  $EMAIL"
echo ""

# Create directories
mkdir -p "$CERT_DIR" "$WEBROOT_DIR"

# Step 1: Start nginx with HTTP-only config for ACME challenge
echo "[1/3] Starting Nginx for ACME challenge..."
docker compose up -d nginx

# Step 2: Request certificate
echo "[2/3] Requesting certificate from Let's Encrypt..."
docker compose run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    -d "$DOMAIN"

# Step 3: Create symlink directory matching nginx config expectations
echo "[3/3] Setting up certificate paths..."
if [ ! -d "$CERT_DIR/live/crvap" ]; then
    ln -s "$CERT_DIR/live/$DOMAIN" "$CERT_DIR/live/crvap"
fi

echo ""
echo "=== SSL Setup Complete ==="
echo "Certificate installed for: $DOMAIN"
echo "Restart nginx: docker compose restart nginx"
echo ""
echo "Auto-renewal is handled by the certbot service."
