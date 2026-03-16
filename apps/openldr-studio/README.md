# OpenLDR Studio

OpenLDR Studio is the administrative front-end application for the [OpenLDR](https://github.com/OpenLDR) (Open Laboratory Data Repository) platform. It provides a comprehensive web-based interface for managing laboratory data, configuring projects and forms, monitoring data pipelines, viewing reports, and administering the system. Built with React 19 and modern tooling, it is designed to run as part of the larger OpenLDR v2 Turborepo monorepo.

## Tech Stack

| Category | Technology |
|---|---|
| **Framework** | React 19 with TypeScript |
| **Build Tool** | Vite 7 |
| **Styling** | Tailwind CSS 4 |
| **UI Components** | Radix UI primitives, shadcn/ui patterns, Lucide icons |
| **State Management** | Zustand with Immer |
| **Data Fetching** | TanStack React Query, Axios |
| **Tables** | TanStack React Table |
| **Charts** | Recharts, D3 |
| **Routing** | React Router DOM 7 |
| **Forms** | React Hook Form, Zod validation, custom AutoForm builder |
| **Authentication** | Keycloak (via keycloak-js) |
| **Internationalization** | i18next (English, Portuguese, Swahili) |
| **Code Editor** | CodeMirror (JSON, SQL, XML, JavaScript, Markdown) |
| **PDF** | react-pdf, jsPDF, jspdf-autotable |
| **Offline / Client DB** | SQLite WASM (in-browser) |
| **Animation** | Framer Motion |
| **Monorepo** | Turborepo with npm workspaces |
| **Containerization** | Docker (multi-stage Alpine build) |

## Features Overview

### Dashboard
An analytics dashboard with KPI grids, lab activity charts, specimen donut charts, result flag distributions, test panel bar charts, facility activity cards, database statistics, service health monitoring, storage overview, and a data pipeline visualizer.

![Dashboard Overview](screenshots/dashboard-overview.png)
> TODO: Add screenshot

### Projects
Create and manage laboratory data projects. Includes a live event feed, data processing stage output viewer, status badges, and a plugin slot system for extensibility.

![Projects Page](screenshots/projects-page.png)
> TODO: Add screenshot

### Form Builder
Design and manage data collection forms with a visual schema builder, JSON schema support, and record entry sheets.

![Form Builder](screenshots/form-builder.png)
> TODO: Add screenshot

### Data Entry
Upload and enter laboratory data against configured form schemas with validation powered by Zod.

![Data Entry](screenshots/data-entry.png)
> TODO: Add screenshot

### Concepts and Coding Systems
Manage medical/laboratory concepts and coding system mappings (e.g., LOINC, SNOMED). Includes concept detail sheets, coding system dialogs, and mapping forms.

![Concepts Management](screenshots/concepts-management.png)
> TODO: Add screenshot

### Reports
Generate and view reports including antibiogram reports, with PDF export capabilities.

![Reports Page](screenshots/reports-page.png)
> TODO: Add screenshot

### Extensions
A plugin/extension system that allows third-party modules to integrate into the application. Extensions run in sandboxed iframes with a bridge SDK, have their own sidebar navigation, a command palette, permission dialogs, a console, and notification support.

![Extensions Marketplace](screenshots/extensions-marketplace.png)
> TODO: Add screenshot

### Logs
View application and system logs.

![Logs Page](screenshots/logs-page.png)
> TODO: Add screenshot

### Settings
Configure the application across multiple areas:
- **General** -- core application settings
- **Appearance** -- theme and display preferences (light/dark mode)
- **Database** -- database connection and schema management
- **Services** -- admin dashboard links for PostgreSQL, Keycloak, MinIO, OpenSearch, Kafka, Redis, and the API gateway
- **Storage** -- object storage configuration

![Settings Page](screenshots/settings-page.png)
> TODO: Add screenshot

### Authentication
Keycloak-based authentication with role-based access control and a dedicated login form.

![Login Page](screenshots/login-page.png)
> TODO: Add screenshot

### Additional Capabilities
- **Dark / Light theme** with system preference detection and flash-of-unstyled-content prevention
- **Internationalization** with English, Portuguese, and Swahili translations
- **In-browser SQLite** for offline/local data operations
- **Drag and drop** support via dnd-kit
- **Resizable panels** for flexible layouts
- **CSV parsing** with PapaParse
- **ZIP file handling** with JSZip
- **Responsive design** with mobile detection hook

## Prerequisites

- **Node.js** >= 18
- **npm** >= 11.3.0 (specified as `packageManager` in the root)
- **Docker** (optional, for containerized deployment)
- A running **Keycloak** instance (for authentication)
- Access to the OpenLDR backend services (entity-services, data-processing, AI) -- typically through the API gateway

## Getting Started

This application is part of the `openldr-v2` Turborepo monorepo. All commands should be run from the **monorepo root** unless otherwise noted.

### 1. Clone and Install

```bash
git clone <repository-url>
cd openldr-v2
npm install
```

### 2. Configure Environment Variables

Environment files are managed centrally in the `environments/` directory at the monorepo root. The studio app merges its configuration from three sources:

- `environments/.env.base` -- shared base configuration
- `environments/.env.openldr-studio` -- studio-specific server config
- `environments/.env.openldr-studio-vite` -- studio-specific Vite client config

To generate the local `.env` file for the studio app:

```bash
cd apps/openldr-studio
npm run copy:env
```

This creates an `.env` file in the studio app directory by merging the three environment sources.

### 3. Run in Development

From the monorepo root (starts all apps):

```bash
npm run dev
```

Or run just the studio app:

```bash
cd apps/openldr-studio
npm run dev
```

The development server starts at `http://localhost:3000` with hot module replacement enabled.

### 4. Build for Production

```bash
npm run build
```

### 5. Preview Production Build

```bash
cd apps/openldr-studio
npm run preview
```

### 6. Start Production Server

The production build is served via an Express server (`server.mjs`) with SPA fallback routing:

```bash
cd apps/openldr-studio
npm run build
npm run start
```

## Project Structure

```
apps/openldr-studio/
├── docker-compose.yml       # Docker Compose service definition
├── docker-compose.ts        # Programmatic Docker Compose helper
├── Dockerfile               # Multi-stage Docker build (Node 24 Alpine)
├── index.html               # HTML entry point with theme flash prevention
├── server.mjs               # Express production server with SPA routing
├── vite.config.ts           # Vite config (aliases, chunks, compression)
├── components.json          # shadcn/ui component configuration
├── public/                  # Static assets (CSS, WASM files)
└── src/
    ├── main.tsx             # App entry -- router, providers, lazy routes
    ├── assets/              # Static assets (images, etc.)
    ├── bootstrap/           # Extension iframe/worker bootstrap scripts
    ├── components/
    │   ├── ui/              # ~56 reusable UI primitives (shadcn/ui based)
    │   ├── admin-panel/     # Layout shell (sidebar, navbar, footer)
    │   ├── authentication/  # Login form and auth page
    │   ├── chat/            # Chat interface components
    │   ├── concepts/        # Coding system and concept management
    │   ├── dashboard/       # Dashboard widgets and charts
    │   ├── database/        # Schema switcher
    │   ├── datatable/       # Reusable data table with filtering/pagination
    │   ├── extensions/      # Extension system (iframe, console, palette)
    │   ├── forms/           # Form builder and schema record sheets
    │   ├── projects/        # Project management components
    │   └── reports/         # Report views (antibiogram, etc.)
    ├── hooks/               # Custom React hooks (sidebar, mobile, store)
    ├── i18n/                # i18next configuration
    ├── lib/
    │   ├── restClients/     # API clients (17 modules for each service)
    │   ├── autoform/        # Auto-generated form utilities
    │   ├── zod-from-json-schema/ # JSON Schema to Zod conversion
    │   ├── sdk.ts           # Extension SDK exposed to plugins
    │   ├── keycloak.ts      # Keycloak instance configuration
    │   ├── menu-list.ts     # Navigation menu definition
    │   ├── db.ts            # SQLite client-side database
    │   ├── extensions.ts    # Extension loader
    │   └── utils.ts         # General utilities
    ├── locales/
    │   ├── en/              # English translations
    │   ├── pt/              # Portuguese translations
    │   └── sw/              # Swahili translations
    ├── pages/               # Route-level page components
    │   ├── DashboardPage.tsx
    │   ├── DataEntry.tsx
    │   ├── ConceptsPage.tsx
    │   ├── ExtensionsPage.tsx
    │   ├── ExtensionPage.tsx
    │   ├── FormBuilderPage.tsx
    │   ├── ProjectsPage.tsx
    │   ├── ReportsPage.tsx
    │   ├── LogsPage.tsx
    │   ├── LandingPage.tsx  # Root layout with sidebar and providers
    │   ├── NotFoundPage.tsx
    │   └── settings/        # Settings sub-pages (general, appearance, db, services, storage)
    ├── store/               # Zustand stores (chat, form builder, model)
    ├── styles/              # Global CSS / Tailwind entry
    └── types/               # TypeScript type definitions
```

## Environment Variables

The `.env` file is auto-generated via `npm run copy:env`. Key variables:

| Variable | Description | Default |
|---|---|---|
| `VITE_BASE_URL` | Base URL path for the app | `/studio/` |
| `VITE_BASE_PORT` | Dev/production server port | `3000` |
| `VITE_API_VERSION` | API version number | `1` |
| `VITE_API_BASE_URL` | Entity services API endpoint | `https://127.0.0.1:443/entity-services` |
| `VITE_PROCESSOR_BASE_URL` | Data processing API endpoint | `https://127.0.0.1:443/data-processing` |
| `VITE_AI_BASE_URL` | AI service API endpoint | `https://127.0.0.1:443/ai` |
| `VITE_KEYCLOAK_URL` | Keycloak server URL | `https://127.0.0.1:443/keycloak` |
| `VITE_KEYCLOAK_REALM` | Keycloak realm name | `openldr-realm` |
| `VITE_KEYCLOAK_CLIENT_ID` | Keycloak client ID | `ui-openldr-client` |
| `VITE_KEYCLOAK_CLIENT_SECRET` | Keycloak client secret | *(set during setup)* |
| `VITE_OCL_URL` | Open Concept Lab API URL | `https://127.0.0.1:443/ocl-api` |
| `VITE_APP_PROJECT_COUNTRY` | Default project country filter | *(empty)* |
| `VITE_PRIVILEDGED_ROLE` | Admin role name in Keycloak | `admin` |
| `VITE_POSTGRES_CONSOLE_URL` | pgAdmin console URL | `https://127.0.0.1:443/postgres-console` |
| `VITE_KEYCLOAK_DASHBOARD_URL` | Keycloak admin console URL | `https://127.0.0.1:443/keycloak` |
| `VITE_MINIO_DASHBOARD_URL` | MinIO console URL | `https://127.0.0.1:443/minio-console` |
| `VITE_OPENSEARCH_DASHBOARD_URL` | OpenSearch dashboard URL | `https://127.0.0.1:443/opensearch-dashboard` |
| `VITE_KAFKA_DASHBOARD_URL` | Kafka console URL | `https://127.0.0.1:443/kafka-console` |
| `VITE_REDIS_DASHBOARD_URL` | Redis dashboard URL | `https://127.0.0.1:443/redis-dashboard` |
| `VITE_TEST_ONLY` | Enable test-only features | `false` |

## Available Scripts

Run from the `apps/openldr-studio` directory:

| Script | Description |
|---|---|
| `npm run dev` | Start Vite development server with HMR on port 3000 |
| `npm run build` | Type-check with `tsc` then build with Vite |
| `npm run preview` | Preview the production build locally |
| `npm run start` | Serve the production build via Express |
| `npm run lint` | Run ESLint |
| `npm run copy:env` | Merge environment files into a local `.env` |
| `npm run wasm` | Copy SQLite WASM binary to the `public/` directory |
| `npm run docker:build` | Build the Docker image |
| `npm run docker:start` | Start the container (detached) |
| `npm run docker:stop` | Stop the container |
| `npm run docker:reset` | Tear down containers, images, volumes, and clean up |

Run from the **monorepo root** to orchestrate all apps:

| Script | Description |
|---|---|
| `npm run dev` | Start all apps in development mode via Turborepo |
| `npm run build` | Build all apps |
| `npm run lint` | Lint all apps |
| `npm run docker:build` | Build Docker images for all apps |
| `npm run docker:start` | Start all containers |
| `npm run docker:stop` | Stop all containers |

## Docker Support

The application includes full Docker support with a multi-stage build:

**Dockerfile** -- three-stage build on `node:24-alpine`:
1. **Builder** -- installs Turbo, prunes the monorepo to only this app's dependency graph
2. **Installer** -- installs dependencies, runs `turbo run build`
3. **Runner** -- copies the built output and starts the Express production server

**docker-compose.yml** -- defines the `openldr-studio` service:
- Image: `openldr-studio:latest`
- Build context: monorepo root
- Restart policy: `unless-stopped`
- Network: `openldr-network` (bridge)
- Default port: 3000 (exposed via the API gateway, not directly)

### Build and Run with Docker

```bash
# From monorepo root
npm run docker:build

# Or just the studio app
cd apps/openldr-studio
npm run docker:build
npm run docker:start
```

## License

This project is licensed under the [Apache License 2.0](LICENSE).
