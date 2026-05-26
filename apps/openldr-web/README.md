# OpenLDR Web

`@openldr/web` is the public-facing web application for OpenLDR. It is a
React/Vite app that contains the marketing landing page and a small
documentation area under `/docs`.

This app is separate from `@openldr/studio`. The web app introduces the
platform, shows screenshots, links visitors to the Studio application, and
hosts public documentation pages. The Studio app is the authenticated operator
interface used to manage projects, data entry, dashboards, reports, concepts,
extensions, and pipeline runs.

## Tech Stack

| Area | Technology |
| --- | --- |
| Framework | React 19 with TypeScript |
| Routing | React Router |
| Build tool | Vite 7 |
| Styling | Tailwind CSS 4 via `@tailwindcss/vite` |
| Animation | Framer Motion |
| Icons | Lucide React |
| Production server | Express static server with SPA fallback |
| Workspace | pnpm + Turborepo |

## Prerequisites

Install these before working on the app:

- Node.js 24+
- pnpm 10+ through Corepack
- Docker and Docker Compose, only if you want to run the containerized build

Enable the package manager version pinned by the monorepo:

```bash
corepack enable
```

## Setup

Run dependency installation from the monorepo root:

```bash
cd /path/to/openldr
pnpm install
```

The web app lives at:

```bash
apps/openldr-web
```

## Development

Start the web app from its package directory:

```bash
cd apps/openldr-web
pnpm dev
```

`pnpm dev` runs `copy:env` first, which creates `apps/openldr-web/.env` by
merging the shared environment files listed below.

The Vite dev server runs on:

```text
http://localhost:3000/web/
```

The configured base path is `/web/`, so use the `/web/` URL when testing local
navigation.

## Build And Run

Build the production bundle:

```bash
cd apps/openldr-web
pnpm copy:env
pnpm build
```

Run the Express production server after building:

```bash
pnpm start
```

Preview the production bundle with Vite:

```bash
pnpm preview
```

From the monorepo root, you can also target this package directly:

```bash
pnpm --filter @openldr/web copy:env
pnpm --filter @openldr/web build
```

## Docker

The app includes a Dockerfile and a package-local compose wrapper. Use these
commands from `apps/openldr-web`:

```bash
pnpm docker:build
pnpm docker:start
pnpm docker:stop
pnpm docker:reset
```

The compose service is named `openldr-web` and joins the `openldr-network`
Docker network. Its host port is commented out in `docker-compose.yml` because
the full OpenLDR stack normally serves it through the gateway at `/web/`.

## Environment

The `copy:env` script builds `apps/openldr-web/.env` from:

| File | Purpose |
| --- | --- |
| `../../environments/.env.base` | Shared OpenLDR defaults such as gateway ports and host IP |
| `../../environments/.env.openldr-web` | Web service container settings |
| `../../environments/.env.openldr-web-vite` | Vite/browser-facing web app settings |

Important variables:

| Variable | Used by | Description |
| --- | --- | --- |
| `VITE_BASE_URL` | Vite + React Router + Express server | Public base path for the app. Current default is `/web/`. |
| `VITE_BASE_PORT` | Express server | Production server port. Current default is `3000`. |
| `VITE_APP_URL` | Landing page | URL used by the "Launch Studio" button. |
| `VITE_GITHUB_URL` | Landing page + docs | Repository URL used by GitHub links. |
| `WEB_HOSTNAME` | Docker | Service hostname inside Docker. |
| `WEB_PORT` | Docker/env docs | Web service port value. |

Only `VITE_` variables are exposed to browser code. If you add a browser-facing
setting, it must use the `VITE_` prefix.

## Project Structure

```text
apps/openldr-web/
|-- public/
|   |-- OpenODRv2Logo.png
|   `-- screenshots/
|       |-- Concepts.png
|       |-- Dashboard.png
|       |-- DataEntry.png
|       |-- Extensions.png
|       |-- FormBuilder.png
|       |-- Pipelines.png
|       `-- Projects.png
|-- src/
|   |-- App.tsx                 # Landing page sections
|   |-- main.tsx                # React Router setup and app entry
|   |-- index.css               # Tailwind theme, base styles, utilities
|   |-- lib/
|   |   `-- utils.ts            # Shared className helper
|   `-- pages/docs/
|       |-- DocsLayout.tsx      # Docs shell and docs navigation
|       |-- GettingStarted.tsx  # Rendered getting started docs
|       |-- APIReference.tsx    # Rendered API/SDK docs
|       `-- ChangelogPage.tsx   # Rendered changelog
|-- Dockerfile                  # Multi-stage container build
|-- docker-compose.yml          # Web service compose definition
|-- docker-compose.ts           # Compose v1/v2 wrapper
|-- index.html                  # Vite HTML shell
|-- package.json                # Scripts and dependencies
|-- server.mjs                  # Express production server
|-- vite.config.ts              # Vite config, base path, plugins
`-- README.md
```

## Routes

The app uses `BrowserRouter` with the Vite base path.

| Route | Purpose |
| --- | --- |
| `/web/` | Public landing page |
| `/web/docs` | Docs index, currently the getting started page |
| `/web/docs/getting-started` | Getting started documentation |
| `/web/docs/api` | API and extension SDK documentation |
| `/web/docs/changelog` | Release history page |

In local development, always include the `/web/` base path unless you change
`VITE_BASE_URL`.

## Available Scripts

Run these from `apps/openldr-web` unless noted otherwise.

| Script | Description |
| --- | --- |
| `pnpm copy:env` | Merge web env files into `.env`. |
| `pnpm dev` | Run `copy:env`, then start Vite on port `3000`. |
| `pnpm build` | Type-check and build the production bundle. |
| `pnpm start` | Start `server.mjs` to serve `dist/`. |
| `pnpm preview` | Preview the built app with Vite. |
| `pnpm docker:build` | Build the Docker image through `docker-compose.ts`. |
| `pnpm docker:start` | Start the Docker service in detached mode. |
| `pnpm docker:stop` | Stop the Docker service. |
| `pnpm docker:reset` | Tear down the Docker service and remove generated `.env`. |

From the monorepo root, use filters when you only want this package:

```bash
pnpm --filter @openldr/web copy:env
pnpm --filter @openldr/web build
```

## Screenshots

Existing screenshots are checked into `public/screenshots/` and used by the
landing page gallery:

- `public/screenshots/Dashboard.png`
- `public/screenshots/DataEntry.png`
- `public/screenshots/Projects.png`
- `public/screenshots/Pipelines.png`
- `public/screenshots/Extensions.png`
- `public/screenshots/FormBuilder.png`
- `public/screenshots/Concepts.png`

When adding or replacing screenshots, keep them under `public/screenshots/` so
they are served from the configured Vite base path.

## Common Issues

### Port 3000 is already in use

The Vite dev server uses port `3000` with `strictPort: true`. Stop the process
using that port, or intentionally update the Vite server port in
`vite.config.ts`.

### `.env` is missing

Run:

```bash
pnpm copy:env
```

`pnpm dev`, `pnpm docker:build`, and `pnpm docker:start` run this automatically,
but `pnpm build` and `pnpm start` expect the environment to already be present.

### The app loads, but routes or assets break under `/web/`

Check `VITE_BASE_URL` in `../../environments/.env.openldr-web-vite`. The current
default is:

```text
VITE_BASE_URL=/web/
```

This value controls Vite asset paths, React Router basename behavior, and the
Express server base path.

### The "Launch Studio" button goes to the wrong place

Update `VITE_APP_URL` in `../../environments/.env.openldr-web-vite`, then rerun:

```bash
pnpm copy:env
pnpm dev
```

For production builds, rebuild the app after changing browser-facing `VITE_`
variables.

## License

OpenLDR is licensed under Apache 2.0. See the repository root `LICENSE` file.
