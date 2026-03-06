# OpenLDR Gateway — Setup Guide

This document covers how to set up the OpenLDR nginx gateway for both local development and production deployment.

---

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) installed
- For production: a registered domain name pointed at your server's IP address

---

## Directory Structure

```
apps/openldr-gateway/
├── docker-compose.yml
├── .env
├── Dockerfile
└── certbot/               # Created automatically in production
    ├── www/               # ACME challenge webroot
    └── conf/              # Let's Encrypt certificates
```

---

## Development Setup

In development, the gateway uses **self-signed certificates** from the core package.

### 1. Ensure the volume mount is correct

In `docker-compose.yml`, the development volume should be **uncommented** and the production volumes should be **commented out**:

```yaml
volumes:
  # Development — self-signed certs
  - ../../packages/openldr-core/certs:/etc/nginx/certs

  # Production — comment these out in development
  # - ./certbot/www:/var/www/certbot
  # - ./certbot/conf:/etc/letsencrypt
```

### 2. Update nginx config to use HTTPS

Now that certs exist, update your nginx config to add the SSL server block:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host:${GATEWAY_HTTPS_PORT}$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /etc/nginx/certs/domain.crt;
    ssl_certificate_key /etc/nginx/certs/domain.key;

    #... rest of configuration
}
```

### 3. Start the gateway

```bash
docker compose up -d openldr-nginx
```

The gateway will be available at `https://localhost` using the self-signed certificate. Your browser will show a security warning — this is expected in development. You can safely proceed past it.

---

## Production Setup

In production, the gateway uses **Let's Encrypt** certificates via Certbot for trusted, auto-renewing SSL.

### 1. Point your domain to the server

In your DNS provider (e.g. Namecheap), create the following A records pointing to your server's public IP:

| Type     | Host  | Value            |
| -------- | ----- | ---------------- |
| A Record | `@`   | `your.server.ip` |
| A Record | `www` | `your.server.ip` |

Verify propagation before proceeding:

```bash
dig +short yourdomain.com
# Should return your server IP
```

### 2. Switch to production volumes

In `docker-compose.yml`, **comment out** the development volume and **uncomment** the production volumes and certbot service:

```yaml
volumes:
  # Development — comment this out in production
  # - ../../packages/openldr-core/certs:/etc/nginx/certs

  # Production — uncomment these
  - ./certbot/www:/var/www/certbot
  - ./certbot/conf:/etc/letsencrypt
```

Also uncomment the `certbot` service at the bottom of `docker-compose.yml`:

```yaml
certbot:
  image: certbot/certbot
  networks:
    - openldr-network
  volumes:
    - ./certbot/www:/var/www/certbot
    - ./certbot/conf:/etc/letsencrypt
  entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"
```

### 3. Make sure your nginx config serves the ACME challenge

Before obtaining certificates, your nginx config must have this `location` block on port 80:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host:${GATEWAY_HTTPS_PORT}$request_uri;
    }
}
```

### 4. Start nginx

```bash
docker compose up -d openldr-nginx
```

Verify nginx is reachable on port 80:

```bash
curl -I http://yourdomain.com/.well-known/acme-challenge/test
# Should return 404 from nginx (the file doesn't exist yet, that's fine)
```

### 5. Obtain the initial SSL certificate

Run certbot once with the `--entrypoint ""` flag to bypass the renewal loop entrypoint:

```bash
docker compose run --rm --entrypoint "" certbot certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  -d yourdomain.com \
  -d www.yourdomain.com \
  --email your@email.com \
  --agree-tos \
  --no-eff-email
```

On success you will see:

```
Successfully received certificate.
Certificate is saved at: /etc/letsencrypt/live/yourdomain.com/fullchain.pem
Key is saved at:         /etc/letsencrypt/live/yourdomain.com/privkey.pem
```

### 6. Update nginx config to use HTTPS

Now that certs exist, update your nginx config to add the SSL server block:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host:${GATEWAY_HTTPS_PORT}$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    #... rest of configuration
}
```

Reload nginx to apply the changes:

```bash
docker compose exec openldr-nginx nginx -s reload
```

### 7. Start the certbot renewal loop

```bash
docker compose up -d certbot
```

This starts the certbot container which checks for renewal every 12 hours. Let's Encrypt certificates expire every 90 days and will be renewed automatically.

### 8. Verify

```bash
curl -I https://yourdomain.com
# Should return HTTP/2 200 with no certificate warnings
```

---

## Troubleshooting

**Port 80 not reachable**
Ensure no other process (e.g. a host-installed nginx) is occupying port 80:

```bash
sudo ss -tlnp | grep :80
sudo systemctl stop nginx && sudo systemctl disable nginx
```

**"No renewals were attempted" on first certbot run**
The certbot service has a custom entrypoint that runs `certbot renew`. Always use `--entrypoint ""` for the initial certificate issuance:

```bash
docker compose run --rm --entrypoint "" certbot certbot certonly ...
```

**Certificate not trusted in browser**
Hard-refresh your browser to clear the cached self-signed cert:

- Chrome/Brave: `Ctrl + Shift + R` or clear cache via `Ctrl + Shift + Delete`
- Or open DevTools (`F12`) → right-click refresh → **Empty Cache and Hard Reload**
