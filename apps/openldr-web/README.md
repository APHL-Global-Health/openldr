# OpenLDR Web

The public-facing marketing and landing page for the **OpenLDR** platform -- an open-source microservices platform for laboratory data management and antimicrobial resistance (AMR) surveillance. This single-page application introduces the platform, highlights its extension system, documents the SDK API surface, and links visitors to the main application (openldr-studio).

## Tech Stack

| Layer        | Technology                                                      |
| ------------ | --------------------------------------------------------------- |
| Framework    | [React 19](https://react.dev/) with TypeScript                  |
| Build Tool   | [Vite 7](https://vite.dev/)                                     |
| Styling      | [Tailwind CSS 4](https://tailwindcss.com/) via `@tailwindcss/vite` |
| Animations   | [Framer Motion](https://www.framer.com/motion/)                 |
| Icons        | [Lucide React](https://lucide.dev/)                             |
| UI Primitives| [Radix UI](https://www.radix-ui.com/) (Accordion, Navigation Menu) |
| Utilities    | clsx, tailwind-merge, class-variance-authority                  |
| Production   | [Express](https://expressjs.com/) static server with SPA fallback |
| Monorepo     | [Turborepo](https://turbo.build/) with npm workspaces           |

## Features Overview

The site is a single-page marketing/landing application composed of the following sections:

- **Navigation** -- Responsive top nav with links to page sections and a "Launch App" button pointing to the studio app.
- **Hero** -- Animated headline ("Lab data, extensible by design"), platform stats (extension types, permissions, JWT auth, license), and a terminal-style code demo showing the OpenLDR SDK in action.
- **Features** -- Six cards covering server-side permissions, worker/iframe runtimes, typed data proxy, SHA-256 integrity verification, cross-extension events, and one-file bundles.
- **How It Works** -- Three-step walkthrough (Build, Publish, Install) with code snippets showing manifest.json, CLI upload, and integrity checks.
- **Extension Showcase** -- Three reference extensions: Patient Statistics (iframe), Lab Results Browser (iframe), and Lab Surveillance Monitor (worker), each with permission badges.
- **SDK Reference** -- Full API surface documentation covering Data, UI, Events, and Storage namespaces, plus filter operator examples and a permissions grid.
- **Changelog** -- Accordion-style release history from v1.0.0 through v2.0.0 with per-version change lists.
- **CTA Banner** -- Call to action encouraging visitors to build their first extension.
- **Footer** -- Navigation links, GitHub link, and MIT license badge.

## How It Differs from openldr-studio

| Aspect     | openldr-web (this app)                         | openldr-studio                                       |
| ---------- | ---------------------------------------------- | ---------------------------------------------------- |
| Purpose    | Public marketing / landing page                | Full application with pages, routing, state, i18n     |
| Scope      | Single page, no routing                        | Multi-page app with components, hooks, store, pages   |
| Audience   | Visitors, prospective users                    | Authenticated users managing lab data and extensions   |
| Complexity | ~1 component file (`App.tsx`), no router        | Full app architecture with pages, store, locales, etc. |

## Screenshots

![Hero Section](screenshots/hero.png)
> TODO: Add screenshot of the hero section with animated terminal demo

![Features Grid](screenshots/features.png)
> TODO: Add screenshot of the features card grid

![Extension Showcase](screenshots/extensions.png)
> TODO: Add screenshot of the three reference extension cards

![SDK Reference](screenshots/sdk-reference.png)
> TODO: Add screenshot of the SDK API surface and filter operators panel

![Changelog](screenshots/changelog.png)
> TODO: Add screenshot of the accordion changelog

## Prerequisites

- **Node.js** >= 18
- **npm** >= 11 (the monorepo specifies `npm@11.3.0` as the package manager)
- **Docker** and **Docker Compose** (optional, for containerized deployment)

## Getting Started

This app lives inside the `openldr-v2` Turborepo monorepo at `apps/openldr-web`.

### 1. Install dependencies (from the monorepo root)

```bash
cd /path/to/openldr-v2
npm install
```

### 2. Run the development server

```bash
# From monorepo root (starts all apps)
npm run dev

# Or from this app directory
cd apps/openldr-web
npm run dev
```

The dev server starts at **http://localhost:3000** by default.

### 3. Build for production

```bash
npm run build
```

### 4. Start the production server

```bash
npm run start
```

This launches an Express server that serves the `dist/` directory with SPA fallback routing.

## Project Structure

```
apps/openldr-web/
├── public/                  # Static assets (favicon, etc.)
├── src/
│   ├── assets/              # Images (react.svg, etc.)
│   ├── lib/
│   │   └── utils.ts         # Tailwind merge utility (cn)
│   ├── App.tsx              # Main application -- all sections in one file
│   ├── main.tsx             # React entry point
│   ├── index.css            # Tailwind config, custom theme, utility classes
│   └── vite-env.d.ts        # Vite type declarations
├── docker-compose.ts        # Docker Compose wrapper (v1/v2 compat)
├── docker-compose.yml       # Docker service definition
├── Dockerfile               # Multi-stage build (builder → installer → runner)
├── server.mjs               # Express production server with SPA fallback
├── vite.config.ts           # Vite config (React, Tailwind, compression, aliases)
├── tsconfig.json            # TypeScript configuration
├── eslint.config.js         # ESLint configuration
├── index.html               # HTML entry point
└── package.json             # Dependencies and scripts
```

## Environment Variables

Environment variables are assembled from multiple files via the `copy:env` script, which merges:

1. `../../environments/.env.base` -- shared base variables
2. `../../environments/.env.openldr-web` -- app-specific variables
3. `../../environments/.env.openldr-web-vite` -- Vite-prefixed variables

The following `VITE_`-prefixed variables are used at build/runtime:

| Variable         | Description                                      | Example            |
| ---------------- | ------------------------------------------------ | ------------------ |
| `VITE_BASE_URL`  | Base URL path for the app (used in Vite config and Express server) | `/`                |
| `VITE_BASE_PORT` | Port for the production Express server            | `3000`             |
| `VITE_APP_URL`   | URL for the "Launch App" button (links to openldr-studio) | `https://app.openldr.org` |

## Available Scripts

| Script           | Description                                                        |
| ---------------- | ------------------------------------------------------------------ |
| `npm run dev`    | Merge env files and start Vite dev server with HMR                 |
| `npm run build`  | Type-check with `tsc` and build production bundle with Vite        |
| `npm run start`  | Start Express production server serving `dist/`                    |
| `npm run preview`| Preview the production build locally via Vite                      |
| `npm run copy:env` | Merge environment files into a single `.env`                     |
| `npm run docker:build` | Build the Docker image                                       |
| `npm run docker:start` | Start the Docker container (detached)                        |
| `npm run docker:stop`  | Stop the Docker container                                    |
| `npm run docker:reset` | Tear down containers, images, volumes, and clean up          |

## Docker Support

The app includes full Docker support with a multi-stage build:

**Dockerfile stages:**

1. **builder** -- Installs Turbo globally, copies the full monorepo, and runs `turbo prune` to isolate this workspace.
2. **installer** -- Installs dependencies with `npm ci`, copies pruned sources, and runs `turbo run build`.
3. **runner** -- Copies the built app and starts the Express production server via `npm start`.

**docker-compose.yml** defines a single service:

- **openldr-web** -- Runs on the `openldr-network` bridge network with automatic restart. Ports are commented out by default (expects a reverse proxy in front).

### Quick start with Docker

```bash
# Build and start
npm run docker:build
npm run docker:start

# Stop
npm run docker:stop

# Full teardown (removes images, volumes, orphans)
npm run docker:reset
```

## License

MIT
