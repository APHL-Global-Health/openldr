import { Check } from "lucide-react";

const GITHUB_URL =
  import.meta.env.VITE_GITHUB_URL || "https://github.com/APHL-Global-Health/openldr";

function CodeBlock({ children, title }: { children: string; title?: string }) {
  return (
    <div className="rounded-lg border border-border overflow-hidden my-4">
      {title && (
        <div className="px-4 py-2 bg-paper2 border-b border-border text-[11px] font-mono text-caption">
          {title}
        </div>
      )}
      <pre className="p-4 bg-ink text-[13px] font-mono text-teal-light leading-relaxed overflow-x-auto">
        {children}
      </pre>
    </div>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display font-bold text-heading text-2xl mt-12 mb-4">
      {children}
    </h2>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-display font-semibold text-heading text-lg mt-8 mb-3">
      {children}
    </h3>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-body text-[15px] leading-relaxed mb-4">{children}</p>;
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-[15px] text-body mb-2">
      <Check className="w-4 h-4 text-teal mt-0.5 shrink-0" />
      <span>{children}</span>
    </li>
  );
}

export default function GettingStarted() {
  return (
    <article>
      <h1 className="font-display font-extrabold text-heading text-[clamp(1.8rem,3vw,2.5rem)] leading-tight mb-3">
        Getting Started
      </h1>
      <p className="text-caption text-[14px] font-mono mb-8">
        Deploy OpenLDR v2 locally or in production using Docker
      </p>

      <div className="h-px bg-border mb-8" />

      <H2>Prerequisites</H2>
      <P>Before you begin, make sure you have the following installed:</P>
      <ul className="mb-6">
        <Li>Docker and Docker Compose (v2+)</Li>
        <Li>Node.js 18+ and npm (for development)</Li>
        <Li>Git</Li>
      </ul>

      <H2>Quick Start</H2>
      <P>
        Clone the repository and start all services with Docker Compose.
        This will spin up PostgreSQL, Kafka, Keycloak, MinIO, OpenSearch,
        and all OpenLDR microservices.
      </P>

      <H3>1. Clone the repository</H3>
      <CodeBlock title="terminal">{`git clone ${GITHUB_URL}.git
cd openldr`}</CodeBlock>

      <H3>2. Copy environment files</H3>
      <P>
        Each service has its own environment file. The setup script copies
        default configurations from the shared environments directory.
      </P>
      <CodeBlock title="terminal">{`npm run copy:env`}</CodeBlock>

      <H3>3. Start the platform</H3>
      <P>
        Build and start all containers. The first run will download Docker
        images and build the services — this may take several minutes.
      </P>
      <CodeBlock title="terminal">{`# Build all containers
npm run docker:build

# Start all services
npm run docker:start`}</CodeBlock>

      <H3>4. Access the platform</H3>
      <P>Once all services are running, you can access:</P>
      <div className="rounded-lg border border-border overflow-hidden my-4">
        <table className="w-full text-[14px]">
          <thead>
            <tr className="bg-paper2 border-b border-border">
              <th className="text-left px-4 py-2.5 font-display font-semibold text-heading">
                Service
              </th>
              <th className="text-left px-4 py-2.5 font-display font-semibold text-heading">
                URL
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {[
              ["OpenLDR Studio", "https://localhost/studio"],
              ["OpenLDR Web", "https://localhost/web"],
              ["Keycloak Admin", "https://localhost/keycloak"],
              ["Kafka Dashboard", "https://localhost/kafka-ui"],
              ["MinIO Console", "https://localhost/minio"],
              ["OpenSearch", "https://localhost/opensearch"],
            ].map(([service, url]) => (
              <tr key={service} className="hover:bg-paper2/50 transition-colors">
                <td className="px-4 py-2.5 text-body">{service}</td>
                <td className="px-4 py-2.5 font-mono text-[13px] text-teal">
                  {url}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H2>Project Structure</H2>
      <P>
        OpenLDR v2 is a Turborepo monorepo with multiple applications and
        shared packages:
      </P>
      <CodeBlock title="directory structure">{`openldr/
├── apps/
│   ├── openldr-studio/          # Main web application (React)
│   ├── openldr-web/             # Public landing page
│   ├── openldr-entity-services/ # REST API (Node.js/Express)
│   ├── openldr-data-processing/ # Data pipeline (Kafka consumers)
│   ├── openldr-ai/              # AI chat service (Python/FastAPI)
│   ├── openldr-gateway/         # APISIX API gateway
│   ├── openldr-keycloak/        # Authentication (Keycloak)
│   ├── openldr-minio/           # Object storage + default plugins
│   └── openldr-internal-database/ # PostgreSQL migrations
├── extensions/                  # Extension source code
└── turbo.json                   # Turborepo configuration`}</CodeBlock>

      <H2>Data Processing Pipeline</H2>
      <P>
        The core of OpenLDR v2 is its configurable data processing pipeline.
        Data flows through four stages, each with a customizable plugin:
      </P>
      <div className="rounded-xl bg-white border border-border p-6 my-4">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              step: "1",
              title: "Validation",
              desc: "Schema detection, format parsing, data quality checks",
            },
            {
              step: "2",
              title: "Mapping",
              desc: "Field transformation, terminology normalization via OCL",
            },
            {
              step: "3",
              title: "Storage",
              desc: "Persist canonical records to PostgreSQL database",
            },
            {
              step: "4",
              title: "Outpost",
              desc: "Push to external systems (FHIR endpoints, etc.)",
            },
          ].map((s) => (
            <div key={s.step}>
              <div className="text-[11px] font-mono text-accent font-medium mb-1">
                Stage {s.step}
              </div>
              <div className="font-display font-semibold text-heading text-[15px] mb-1">
                {s.title}
              </div>
              <div className="text-[13px] text-caption">{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <H2>Supported Data Formats</H2>
      <P>
        OpenLDR accepts laboratory data in multiple formats through its
        schema plugins:
      </P>
      <ul className="mb-6">
        <Li>HL7 v2.x — pipe-delimited messages (MSH/PID/OBR/OBX segments)</Li>
        <Li>FHIR — JSON and XML Bundles with DiagnosticReport resources</Li>
        <Li>CSV / TSV — column-mapped flat files with auto-delimiter detection</Li>
        <Li>JSON / JSONL — canonical schema or custom structures</Li>
        <Li>XML — canonical element format or custom schemas</Li>
        <Li>SQLite — database file import (e.g., WHONET exports)</Li>
      </ul>

      <H2>Next Steps</H2>
      <P>Once the platform is running:</P>
      <ul className="mb-6">
        <Li>Create a Project in the Studio to configure your data pipeline</Li>
        <Li>Set up Concepts for terminology mapping (LOINC, SNOMED, ICD)</Li>
        <Li>Upload test data through Data Entry or the pipeline API</Li>
        <Li>Review results in the Dashboard and Reports sections</Li>
      </ul>
    </article>
  );
}
