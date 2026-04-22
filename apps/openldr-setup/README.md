# @openldr/setup

The initialization and configuration tool for the OpenLDR monorepo. This CLI utility bootstraps the project by collecting network configuration from the user and generating the environment variable files that all other services in the monorepo depend on.

## What It Does

`openldr-setup` is the first thing you run after cloning the repository. It performs the following:

1. **Network configuration** -- Prompts you to choose between IP-based or domain-based access, then detects available network interfaces (with special handling for macOS, WSL, and native Linux).
2. **Environment variable generation** -- Writes host IP, HTTP/HTTPS ports, and derived service URLs into the centralized `environments/` directory at the repository root.
3. **Docker network creation** -- Creates the shared `openldr-network` bridge network used by all containerized services.
4. **Service lifecycle management** -- Exposes `setup`, `reset`, `stop`, and `start` commands that integrate with Turborepo's task pipeline.

## How It Fits Into the Monorepo

The OpenLDR monorepo uses [Turborepo](https://turbo.build/) with npm workspaces. The setup app is invoked **before** any build or service-start commands because every other app reads environment files that this tool generates.

Typical workflow:

```
npm run init          # runs this setup tool
npm run docker:build  # builds all Docker images (also creates the Docker network)
npm run dev           # starts development servers
```

The root `package.json` maps `npm run init` to:

```
tsx ./apps/openldr-setup/openldr.ts init
```

## Tech Stack

- **TypeScript** -- executed directly via [tsx](https://github.com/privatenumber/tsx)
- **@inquirer/prompts** -- interactive CLI prompts for network configuration
- **@repo/openldr-core** -- shared internal package providing Docker helpers (`dockerode`), system info detection, and environment file utilities
- **Turborepo** -- monorepo task orchestration

## Prerequisites

- **Node.js** >= 18
- **npm** >= 11.3.0 (defined as `packageManager` in root `package.json`)
- **Docker** -- must be running; required for network creation and container management
- **tsx** -- installed as a transitive dependency (no global install needed)

## Usage

### From the repository root (recommended)

```bash
# Install dependencies first
npm install

# Run initialization
npm run init
```

### From the app directory

```bash
cd apps/openldr-setup

# Initialize the project
npm run init

# Build (creates Docker network)
npm run docker:build

# Service lifecycle
npm run setup:services
npm run start:services
npm run stop:services
npm run reset:services
```

### All available commands

| Command              | Script                     | Description                                       |
| -------------------- | -------------------------- | ------------------------------------------------- |
| `npm run init`       | `tsx openldr.ts init`      | Interactive setup wizard for network configuration |
| `npm run docker:build` | `tsx openldr.ts build`   | Creates the `openldr-network` Docker bridge network |
| `npm run setup:services` | `tsx openldr.ts setup` | Runs service setup routines                        |
| `npm run start:services` | `tsx openldr.ts start` | Starts services                                    |
| `npm run stop:services`  | `tsx openldr.ts stop`  | Stops services                                     |
| `npm run reset:services` | `tsx openldr.ts reset` | Resets services                                    |

## Step-by-Step Setup Flow

When you run `npm run init`, the tool walks you through the following interactive steps:

### 1. Choose network configuration method

```
? Select the network configuration method
  ip
  domain
```

### 2a. If you choose **IP address**:

- Enter the HTTP port for the gateway (default: `8090`)
- Enter the HTTPS port for the gateway (default: `443`)
- The tool detects all available IPv4 network interfaces on your system
- Select the IP address to use from the detected list

On WSL it additionally detects:
- WSL internal IP (for WSL-internal access)
- Windows Host IP (for cross-WSL/Windows access)
- External IP (for public access)

### 2b. If you choose **Domain name**:

- Enter your domain name (e.g., `openldr.local`)

### 3. Environment files are generated

The tool writes configuration to the following files under `environments/`:

| File | Variables Set |
| ---- | ------------- |
| `.env.base` | `HOST_IP`, `GATEWAY_HTTP_PORT`, `GATEWAY_HTTPS_PORT` |
| `.env.openldr-ai` | `AI_CORS_ORIGINS` |
| `.env.openldr-entity-services` | `ENTITY_SERVICES_PUBLIC_URL` |
| `.env.openldr-data-processing` | `DATA_PROCESSING_PUBLIC_URL` |
| `.env.openldr-minio` | `MINIO_BROWSER_REDIRECT_URL`, `MINIO_PUBLIC_URL` |
| `.env.openldr-openconceptlab` | `OCL_PUBLIC_URL` |
| `.env.openldr-keycloak` | `KEYCLOAK_PUBLIC_URL` |
| `.env.openldr-studio-vite` | `VITE_API_BASE_URL`, `VITE_PROCESSOR_BASE_URL`, `VITE_AI_BASE_URL`, `VITE_KEYCLOAK_URL`, `VITE_KEYCLOAK_DASHBOARD_URL`, `VITE_MINIO_DASHBOARD_URL`, `VITE_OPENSEARCH_DASHBOARD_URL`, `VITE_KAFKA_DASHBOARD_URL`, `VITE_NGINX_DASHBOARD_URL`, `VITE_REDIS_DASHBOARD_URL`, `VITE_OCL_URL`, `VITE_POSTGRES_CONSOLE_URL` |
| `.env.openldr-web-vite` | `VITE_APP_URL` |

All service URLs are derived from the host IP/domain and the configured ports.

## Configuration Options

### Base environment variables (`environments/.env.base`)

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `COMPOSE_PROJECT_NAME` | `openldr` | Docker Compose project name |
| `HOST_IP` | `127.0.0.1` | Host IP or domain (set by init) |
| `GATEWAY_HTTP_PORT` | `8090` | HTTP port for the gateway |
| `GATEWAY_HTTPS_PORT` | `443` | HTTPS port for the gateway |
| `INCLUDE_TEST_DATA` | `true` | Whether to include test data (set to `false` in production) |
| `CPU_LIMIT` | `0` | Container CPU limit (0 = unlimited) |
| `MEMORY_LIMIT` | `512M` | Container memory limit |
| `MEMORY_RESERVATIONS` | `128M` | Container memory reservation |
| `MEMSWAP_LIMIT` | `1G` | Container memory + swap limit |

### Environment file merging

The `environments/merge-env.ts` utility can combine multiple `.env` files into one:

```bash
tsx environments/merge-env.ts <input1> <input2> ... <output>
```

This is used during Docker builds to merge the base configuration with service-specific overrides.

## Troubleshooting

### "Docker is not running"

The `build` command and several service commands require Docker to be running. Start Docker Desktop or the Docker daemon before running setup.

```bash
# Check Docker status
docker info
```

### Port conflicts

If the default ports (`8090` for HTTP, `443` for HTTPS) are already in use, the init wizard lets you specify alternative ports. Common conflicts:

- Port `443` is often used by existing web servers or VPN software.
- Port `8090` may conflict with other development tools.

### Network already exists

If you see `Network 'openldr-network' already exists, continuing...`, this is normal. The tool safely skips creation if the network is already present.

### WSL-specific issues

- If IP detection fails on WSL, the tool falls back to standard network interface detection.
- Make sure Docker Desktop is configured to use the WSL 2 backend.

### Re-running init

You can safely re-run `npm run init` at any time. The tool updates existing environment files in place -- existing keys are overwritten and missing keys are appended. No data is lost from keys the tool does not manage.

### Environment files not found

If services fail to start because of missing environment variables, verify that the `environments/` directory at the repository root contains the expected `.env.*` files. Running `npm run init` will create or update them.

## License

Apache License 2.0. See [LICENSE](./LICENSE) for details.
