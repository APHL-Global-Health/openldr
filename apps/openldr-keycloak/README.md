# OpenLDR Keycloak

Identity and access management service for the OpenLDR platform, built on [Keycloak 26.0](https://www.keycloak.org/).

## Overview

OpenLDR Keycloak provides centralized authentication, authorization, and single sign-on (SSO) for all OpenLDR services. It manages user identities, issues OAuth 2.0 / OpenID Connect tokens, and enforces access policies across the platform.

Key responsibilities:

- **Authentication** -- verifies user credentials via the OpenLDR realm login page.
- **Authorization** -- issues access tokens with role-based claims consumed by backend services and the API gateway.
- **Single Sign-On (SSO)** -- one login session grants access to the web UI, backend APIs, and administrative tools.
- **Client management** -- programmatically creates and configures OAuth clients for microservices and the web UI during startup.
- **Service account support** -- provisions service accounts with `manage-users` and `manage-clients` roles so backend services can administer Keycloak resources.

## Tech Stack

| Layer | Technology |
|---|---|
| Identity provider | Keycloak 26.0 (`quay.io/keycloak/keycloak:26.0`) |
| Database | PostgreSQL (shared `openldr-postgres` container, database `keycloak`) |
| Runtime / scripting | Node.js, TypeScript, tsx |
| Orchestration | Docker / Docker Compose |
| Monorepo tooling | Turborepo, npm workspaces |
| Shared library | `@repo/openldr-core` (KeyCloak client, Docker helpers, service utilities) |

## Prerequisites

- **Docker** (v20+) and **Docker Compose** (v2 recommended; v1 fallback is supported)
- **Node.js** >= 18 and **npm** >= 9
- The `openldr-postgres` container must be running with a `keycloak` database available.
- TLS certificates at `packages/openldr-core/certs/domain.crt` and `domain.key`.

## Project Structure

```
apps/openldr-keycloak/
  docker-compose.yml      # Keycloak container definition
  docker-compose.ts       # Wrapper that runs docker compose with v2/v1 fallback
  openldr.ts              # Service lifecycle script (setup, start, stop, reset)
  package.json            # Package metadata and npm scripts
  .env                    # Merged environment variables (generated, git-ignored)
  realm-config/
    openldr-realm.json    # Realm import file (roles, default admin user)
  themes/
    openldr/login/        # Custom login theme (FreeMarker templates, CSS, JS)
```

## Configuration

### Environment Variables

The `.env` file is assembled at build time by merging several source files:

```
environments/.env.base
environments/.env.openldr-keycloak
environments/.env.openldr-minio
```

The merge is performed by the `copy:env` script (`tsx ../../environments/merge-env.ts ...`).

#### Keycloak Variables

| Variable | Description | Default |
|---|---|---|
| `KEYCLOAK_PORT` | Host-side HTTP port | `8080` |
| `KEYCLOAK_INTERNAL_PORT` | Container-internal HTTP port | `8080` |
| `KEYCLOAK_REALM` | Name of the OpenLDR realm | `openldr-realm` |
| `KEYCLOAK_CLIENT_ID` | Confidential client used by microservices | `openldr-client` |
| `KEYCLOAK_CLIENT_SECRET` | Secret for the confidential client | *(see env file)* |
| `KEYCLOAK_WEB_CLIENT_ID` | Public client used by the web UI | `ui-openldr-client` |
| `KEYCLOAK_BACKEND_CLIENT_ID` | Client used by the API gateway (APISIX) | `backend-openldr-client` |
| `KEYCLOAK_BACKEND_CLIENT_SECRET` | Secret for the backend client | *(see env file)* |
| `KEYCLOAK_ADMIN_USER` | Bootstrap admin username | `admin` |
| `KEYCLOAK_ADMIN_PASSWORD` | Bootstrap admin password | `admin123` |
| `KEYCLOAK_BASE_URL` | Internal HTTPS URL (container-to-container) | `https://openldr-keycloak:8443/keycloak` |
| `KEYCLOAK_PUBLIC_URL` | Public-facing HTTPS URL (through the gateway) | `https://127.0.0.1:443/keycloak` |
| `KEYCLOAK_HOSTNAME` | Docker container hostname | `openldr-keycloak` |
| `KEYCLOAK_DB_PORT` | PostgreSQL port for Keycloak database | `3311` |
| `KEYCLOAK_DB_ROOT_PASSWORD` | PostgreSQL root password | `root` |
| `KEYCLOAK_CPU_LIMIT` | CPU limit for the container (empty = unlimited) | *(empty)* |
| `KEYCLOAK_MEMORY` | Memory limit for the container (empty = unlimited) | *(empty)* |

#### General Variables

| Variable | Description | Default |
|---|---|---|
| `COMPOSE_PROJECT_NAME` | Docker Compose project name | `openldr` |
| `NODE_TLS_REJECT_UNAUTHORIZED` | Disable TLS verification for internal calls | `0` |
| `GATEWAY_HTTPS_PORT` | HTTPS port on the gateway | `443` |
| `INCLUDE_TEST_DATA` | Load test data (set `false` in production) | `true` |

## Realm Setup

The realm is defined in `realm-config/openldr-realm.json` and imported automatically on first start when the realm does not yet exist. The import is handled by the `start` command in `openldr.ts`.

### Realm Properties

| Property | Value |
|---|---|
| Realm name | `${KEYCLOAK_REALM}` (default: `openldr-realm`) |
| Display name | `OPENLDR Realm` |
| SSL required | `external` |
| Registration | Disabled |
| Login with email | Enabled |
| Duplicate emails | Disabled |
| Password reset | Enabled |
| Edit username | Disabled |
| Brute-force protection | Enabled |

### Realm Roles

| Role | Description |
|---|---|
| `admin` | Administrator role |
| `user` | Standard user role |

### Default Users

A default admin user is seeded via the realm import:

| Field | Value |
|---|---|
| Username | `admin` |
| Email | `test@openldr.org` |
| Password | `admin` |
| Realm roles | `admin` |

> **Important:** Change the default admin credentials before deploying to production.

## Client Configurations

Three OAuth 2.0 / OpenID Connect clients are configured. The first two are created programmatically by `openldr.ts` during the `start` lifecycle; the third is referenced by the gateway configuration.

### 1. OpenLDR System Client (`openldr-client`)

Confidential client used by backend microservices.

| Setting | Value |
|---|---|
| Client ID | `openldr-client` |
| Public client | `false` |
| Protocol | `openid-connect` |
| Client authenticator | `client-secret` |
| Service accounts enabled | `true` |
| Authorization services | `true` |
| Standard flow | `true` |
| Direct access grants | `true` |
| Redirect URIs | `*` |
| Web origins | `*` |

The service account for this client is automatically granted the `manage-users` and `manage-clients` roles from the `realm-management` client, allowing it to administer users and clients programmatically.

### 2. OpenLDR Web UI Client (`ui-openldr-client`)

Public client used by the browser-based web application.

| Setting | Value |
|---|---|
| Client ID | `ui-openldr-client` |
| Public client | `true` |
| Protocol | `openid-connect` |
| Service accounts enabled | `false` |
| Authorization services | `false` |
| Standard flow | `true` |
| Direct access grants | `true` |
| Redirect URIs | `*` |
| Web origins | `*` |

### 3. Backend Gateway Client (`backend-openldr-client`)

Referenced in the environment for the API gateway (APISIX) to validate tokens on incoming requests.

| Setting | Value |
|---|---|
| Client ID | `backend-openldr-client` |
| Client secret | Set via `KEYCLOAK_BACKEND_CLIENT_SECRET` |

## Custom Theme

A custom login theme is included at `themes/openldr/login/`. It extends the default Keycloak theme and provides:

- **Two-panel layout** -- a decorative left panel with an animated squares background and the form panel on the right.
- **Dark mode support** -- automatically adapts to the user's `prefers-color-scheme` setting.
- **UX enhancements** -- auto-focus on the first input, loading state on submit buttons, button ripple effects, and keyboard navigation focus indicators.
- **Custom CSS variables** -- prefixed with `--openldr-*` for easy branding adjustments.
- **Customizable messages** -- `messages/messages_en.properties` provides override points for all login-related strings.

> The theme volume mount is currently commented out in `docker-compose.yml`. Uncomment the line `./themes/openldr/:/opt/keycloak/themes/openldr/` to enable it.

## Setup and Deployment

### Using the Monorepo (recommended)

From the repository root:

```bash
# Pull the Keycloak image
npm run docker:build

# Start all services (including Keycloak)
npm run docker:start

# Stop all services
npm run docker:stop

# Tear down containers, images, and volumes
npm run docker:reset
```

### Using the App Directly

From `apps/openldr-keycloak/`:

```bash
# Merge environment files and pull the image
npm run docker:build

# Start the container and run the initialization script
npm run docker:start

# Stop the container
npm run docker:stop

# Remove the container, image, and volumes
npm run docker:reset
```

### Lifecycle Scripts

The `openldr.ts` file implements four lifecycle commands invoked via `tsx openldr.ts <command>`:

| Command | Behavior |
|---|---|
| `setup` | Placeholder (logs only). |
| `start` | Waits for the Keycloak container to be healthy (up to 8 minutes), authenticates as the bootstrap admin, imports the realm if it does not exist, creates the system and web UI clients, and assigns service-account roles. |
| `stop` | Placeholder (logs only). |
| `reset` | Placeholder (logs only). |

## Docker Details

### Image

`quay.io/keycloak/keycloak:26.0`

### Container Settings

| Setting | Value |
|---|---|
| Container name | `openldr-keycloak` |
| Restart policy | `unless-stopped` |
| Command | `start` (production mode) |
| Network | `openldr-network` (bridge) |
| TLS certificate | Mounted from `packages/openldr-core/certs/` |
| Realm import | Mounted from `realm-config/` to `/opt/keycloak/data/import` |
| HTTP relative path | `/keycloak/` |
| Proxy mode | `edge` |
| Metrics | Enabled |
| Log level | `info` |

### Healthcheck

The container uses a TCP-based healthcheck against port 8080 (`/health/ready`), polling every 30 seconds with a 60-second start period and up to 30 retries.

### Database

Keycloak connects to the shared PostgreSQL instance:

| Setting | Value |
|---|---|
| Database type | `postgres` |
| Host | `openldr-postgres` |
| Database name | `keycloak` |
| Username | `postgres` |
| Password | `postgres` |

## Integration with Other OpenLDR Services

| Service | Integration |
|---|---|
| **openldr-gateway** | The API gateway (APISIX) validates JWT tokens issued by Keycloak using the `backend-openldr-client` credentials. Keycloak is exposed publicly at `/keycloak/` through the gateway on port 443. |
| **openldr-web** | The web UI authenticates users via the public `ui-openldr-client` using the Authorization Code flow with PKCE. |
| **openldr-entity-services** | Backend microservices use the confidential `openldr-client` to obtain tokens for service-to-service communication and user management. |
| **openldr-postgres** | Keycloak persists all realm, client, user, and session data in the `keycloak` database on the shared PostgreSQL instance. |
| **openldr-setup** | The root setup orchestration triggers Keycloak's lifecycle scripts via Turborepo. |

## Troubleshooting

### Keycloak container fails to start

- Verify that `openldr-postgres` is running and the `keycloak` database exists.
- Check that TLS certificates exist at `packages/openldr-core/certs/domain.crt` and `domain.key`.
- Inspect logs: `docker logs openldr-keycloak`.

### Realm or clients are not created

- The `start` script waits up to 8 minutes for the container to become healthy. If the container is still starting, increase the timeout in `openldr.ts` (currently `480000` ms).
- Verify environment variables are set correctly -- run `npm run copy:env` and check the generated `.env` file.
- If the realm already exists, the import step is skipped. To re-create it, delete the realm from the Keycloak admin console first, or run `npm run docker:reset` to wipe all data.

### "Neither docker compose nor docker-compose worked"

- Ensure Docker is installed and the Docker daemon is running.
- The `docker-compose.ts` wrapper tries `docker compose` (v2) first, then falls back to `docker-compose` (v1). Install at least one of them.

### TLS / certificate errors

- `NODE_TLS_REJECT_UNAUTHORIZED=0` is set by default for development. In production, use valid certificates and remove this override.
- Keycloak serves HTTPS on port 8443 internally. The gateway terminates external TLS and forwards to Keycloak.

### Cannot log in to the admin console

- The bootstrap admin credentials are set via `KEYCLOAK_ADMIN_USER` / `KEYCLOAK_ADMIN_PASSWORD` (default: `admin` / `admin123`). These apply to the `master` realm.
- The realm-level default user (`admin` / `admin`) is separate from the bootstrap admin.

### Health check keeps failing

- The healthcheck uses a raw TCP connection to port 8080. Keycloak in production mode can take 60+ seconds to start. The configuration allows up to 15 minutes of retries (30 retries x 30s interval) with a 60-second start period.
- If the database is slow to initialize, Keycloak startup will be delayed accordingly.

## License

Apache License 2.0 -- see [LICENSE](./LICENSE).
