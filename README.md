<p align="center">
  <img src="./docs/assets/img/OpenODRv2Logo.png" alt="OpenLDR Logo" width="400"/>
</p>

<h1 align="center">Open Laboratory Data Repository</h1>

<p align="center">
  <a href="https://www.docker.com/"><img src="https://img.shields.io/badge/Docker-ready-brightgreen.svg" alt="Docker"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-blue.svg" alt="License"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-24+-brightgreen.svg" alt="Node.js"></a>
  <a href="https://pnpm.io/"><img src="https://img.shields.io/badge/pnpm-10.33.0-orange.svg" alt="pnpm"></a>
  <a href="https://turborepo.dev/"><img src="https://img.shields.io/badge/Turborepo-2.8+-brightgreen.svg?logoColor=white" alt="Turborepo"></a>
</p>

<p align="center">
  OpenLDR is a Docker-first, TypeScript monorepo for managing laboratory data,
  file storage, data processing, search, authentication, public documentation,
  and operator workflows.
</p>

---

## What Is In This Repository

OpenLDR is organized as a pnpm workspace with Turborepo orchestration.

| Area | Packages |
| --- | --- |
| Public web app | `apps/openldr-web` |
| Operator UI | `apps/openldr-studio` |
| API and processing services | `apps/openldr-entity-services`, `apps/openldr-data-processing`, `apps/openldr-external-database` |
| Infrastructure wrappers | `apps/openldr-gateway`, `apps/openldr-keycloak`, `apps/openldr-kafka`, `apps/openldr-minio`, `apps/openldr-opensearch`, `apps/openldr-internal-database` |
| AI and MCP | `apps/openldr-ai`, `apps/openldr-mcp-server` |
| Setup and CLI | `apps/openldr-setup`, `apps/openldr-cli`, `apps/openldr-init` |
| Shared packages | `packages/openldr-core`, `packages/openldr-extensions`, `packages/minio-js`, `packages/eslint-config`, `packages/typescript-config` |

The public website is a React/Vite app served under `/web/`. It contains the
landing page and public documentation routes. See
[apps/openldr-web/README.md](apps/openldr-web/README.md) for web-specific setup,
environment variables, screenshots, routes, and deployment notes.

## Core Capabilities

- Public landing page and `/docs` routes for onboarding and reference material
- Studio interface for projects, dashboards, data entry, reports, concepts,
  extensions, and pipeline runs
- Entity and data-processing services for laboratory data workflows
- PostgreSQL-backed internal and external databases
- MinIO object storage with seeded buckets and plugin assets
- OpenSearch-backed search and analytics
- Kafka-based event streaming and connector setup
- Keycloak authentication behind the gateway
- MCP server and AI service for natural-language workflows

## Prerequisites

- Node.js 24+
- pnpm 10 through Corepack
- Docker Engine 24+ and Docker Compose v2 for the full containerized stack
- Git
- 16GB+ RAM for local full-stack runs; 32GB+ is more comfortable for production
  or large datasets

Enable the package-manager version pinned by the repository:

```bash
corepack enable
```

The root `package.json` pins `pnpm@10.33.0`.

## Repository Setup

```bash
git clone https://github.com/APHL-Global-Health/openldr.git
cd openldr
pnpm install
pnpm init
```

`pnpm init` runs the OpenLDR setup flow from `apps/openldr-setup`. It prepares
environment files and asks for host/IP choices used by the Docker services,
gateway, and authentication redirects.

If you only need to work on the public web app, install dependencies from the
root, then use the app-local commands documented in
[apps/openldr-web/README.md](apps/openldr-web/README.md).

## Full Stack Docker Run

Build and start the stack from the repository root:

```bash
pnpm docker:build
pnpm docker:start
```

Stop or reset the stack:

```bash
pnpm docker:stop
pnpm docker:reset
```

The gateway serves the public web app at:

```text
https://127.0.0.1/web/
```

For remote deployments, use the public host or IP selected during `pnpm init`:

```text
https://<your-host-or-ip>/web/
```

Initial startup can take several minutes while infrastructure services become
healthy and the one-shot init service configures Keycloak, Kafka, and MinIO.

## Local Development

Run all workspace development tasks:

```bash
pnpm dev
```

Run a specific package with pnpm filters:

```bash
pnpm --filter @openldr/web dev
pnpm --filter @openldr/studio dev
pnpm --filter @openldr/entity-services dev
```

Build all packages:

```bash
pnpm build
```

Build only the public web app:

```bash
pnpm --filter @openldr/web copy:env
pnpm --filter @openldr/web build
```

## Docker Hub Deployment

For deployments using pre-built images, use the files under `docker/`:

```bash
cd docker
cp .env.example .env
docker compose up -d
```

Edit `.env` before starting the stack. Set passwords, `DOCKER_REGISTRY`,
`HOST_IP`, `DOCKER_HOST_IP`, and the public service URLs for your environment.

Maintainers can build and publish images from the repository root:

```bash
./docker/scripts/build-and-push.sh --registry myorg --tag v1.0.0
```

See [docker/README.md](docker/README.md) for the complete Docker Hub deployment
workflow, image list, certificate notes, and Kafka connector requirements.

## Environment Files

Source templates live in `environments/`. Package-level `copy:env` scripts merge
the relevant files into each app's local `.env`.

Examples:

- `apps/openldr-web` merges `.env.base`, `.env.openldr-web`, and
  `.env.openldr-web-vite`
- `apps/openldr-studio` merges `.env.base`, `.env.openldr-studio`, and
  `.env.openldr-studio-vite`
- Backend services merge `.env.base` plus their service-specific dependencies

Browser-exposed frontend settings must use a `VITE_` prefix.

## Documentation

- [Installation Guide](docs/installation.md)
- [Architecture Overview](docs/architecture.md)
- [Plugin Guide](docs/plugins.md)
- [MCP Server Guide](docs/mcp-server.md)
- [Extensions Guide](docs/extensions.md)
- [Docker Deployment](docker/README.md)
- [Public Web App](apps/openldr-web/README.md)
- [Studio App](apps/openldr-studio/README.md)

## Troubleshooting

### Keycloak redirects fail on a remote server

Re-run setup with the server's public host or IP. Using `127.0.0.1` for a remote
deployment breaks browser redirects and token flows.

### Port conflicts

Change the relevant environment value under `environments/`, regenerate the
package `.env` through the package `copy:env` script or `pnpm init`, then rebuild
and restart the affected service.

### Containers start slowly

Check Docker resources first. The full stack needs substantial memory and CPU,
especially during first startup, image builds, database initialization, and Kafka
connector setup.

### The public web app loads without assets or nested routes

The web app is served under `/web/` by default. Check
`environments/.env.openldr-web-vite` and keep `VITE_BASE_URL=/web/` unless you
are intentionally deploying it at another base path.

## License

OpenLDR is licensed under Apache 2.0. See [LICENSE](LICENSE).

## Support

- Issues: [GitHub Issues](https://github.com/APHL-Global-Health/openldr/issues)

OpenLDR is under active development. Some features may be beta or experimental.
