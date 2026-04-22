import { Check } from "lucide-react";

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

function Endpoint({
  method,
  path,
  desc,
}: {
  method: string;
  path: string;
  desc: string;
}) {
  const color =
    method === "GET"
      ? "bg-teal-bg text-teal"
      : method === "POST"
        ? "bg-accent-bg text-accent"
        : method === "DELETE"
          ? "bg-red-50 text-red-600"
          : "bg-paper2 text-caption";
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      <span
        className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded ${color} shrink-0`}
      >
        {method}
      </span>
      <div>
        <code className="text-[13px] font-mono text-heading">{path}</code>
        <p className="text-[13px] text-caption mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

const SDK_SECTIONS = [
  {
    title: "Data",
    color: "text-accent",
    items: [
      {
        sig: "openldr.data.query(schema, table, params)",
        ret: "Promise<{ data, total, page, limit }>",
      },
    ],
  },
  {
    title: "UI",
    color: "text-teal",
    items: [
      {
        sig: "openldr.ui.showNotification(msg, kind)",
        ret: "kind: 'info'|'success'|'warning'|'error'",
      },
      { sig: "openldr.ui.statusBar.setText(text, priority)", ret: "void" },
      {
        sig: "openldr.ui.registerCommand(id, title, fn)",
        ret: "{ dispose() }",
      },
    ],
  },
  {
    title: "Events",
    color: "text-purple-500",
    items: [
      { sig: "openldr.events.on(event, handler)", ret: "{ dispose() }" },
      { sig: "openldr.events.emit(event, payload)", ret: "void" },
    ],
  },
  {
    title: "Storage",
    color: "text-success",
    items: [
      { sig: "openldr.storage.get(key)", ret: "Promise<unknown>" },
      { sig: "openldr.storage.set(key, value)", ret: "Promise<void>" },
      { sig: "openldr.storage.delete(key)", ret: "Promise<void>" },
    ],
  },
];

const FILTER_EXAMPLE = `// Equality
{ facility_code: 'FAC001' }

// Operators
{ created_at: { gte: '2024-01-01' } }
{ rpt_flag:   { in: ['H', 'L', 'C'] } }
{ panel_desc: { like: 'Blood%' } }

// Combined
{
  status:     { ne: 'cancelled' },
  created_at: { gte: '2024-06-01',
                lte: '2024-12-31' }
}`;

const PERMISSIONS = [
  "data.patients",
  "data.labRequests",
  "data.labResults",
  "data.query",
  "ui.notifications",
  "ui.statusBar",
  "ui.commands",
  "events.emit",
  "events.subscribe",
  "storage.read",
  "storage.write",
];

export default function APIReference() {
  return (
    <article>
      <h1 className="font-display font-extrabold text-heading text-[clamp(1.8rem,3vw,2.5rem)] leading-tight mb-3">
        API Reference
      </h1>
      <p className="text-caption text-[14px] font-mono mb-8">
        REST endpoints, Extension SDK, and query operators
      </p>

      <div className="h-px bg-border mb-8" />

      {/* ── REST API ── */}
      <H2>REST API</H2>
      <P>
        All API endpoints require a valid Keycloak JWT token in the
        Authorization header. The base URL depends on your deployment.
      </P>
      <CodeBlock title="authentication">{`Authorization: Bearer <keycloak-jwt-token>`}</CodeBlock>

      <H3>Entity Services</H3>
      <P>Core CRUD operations for laboratory data and configuration.</P>
      <div className="rounded-lg border border-border p-4 my-4">
        <Endpoint method="GET" path="/api/v1/dashboard/laboratory" desc="Laboratory metrics (KPIs, activity, specimens, flags)" />
        <Endpoint method="GET" path="/api/v1/dashboard/infrastructure" desc="Infrastructure health (services, database, pipeline)" />
        <Endpoint method="GET" path="/api/v1/projects" desc="List all data processing projects" />
        <Endpoint method="POST" path="/api/v1/projects" desc="Create a new project with pipeline configuration" />
        <Endpoint method="GET" path="/api/v1/forms" desc="List form schemas" />
        <Endpoint method="POST" path="/api/v1/forms" desc="Create or update a form schema" />
        <Endpoint method="GET" path="/api/v1/concepts/systems" desc="List coding systems" />
        <Endpoint method="GET" path="/api/v1/concepts/systems/:id/concepts" desc="List concepts in a coding system" />
        <Endpoint method="POST" path="/api/v1/concepts/systems/:id/concepts" desc="Create a concept" />
        <Endpoint method="GET" path="/api/v1/extensions" desc="List installed extensions" />
        <Endpoint method="POST" path="/api/v1/extensions" desc="Upload an extension bundle (ZIP)" />
        <Endpoint method="DELETE" path="/api/v1/extensions/:id" desc="Uninstall an extension" />
      </div>

      <H3>Data Processing</H3>
      <P>Endpoints for the data ingestion and processing pipeline.</P>
      <div className="rounded-lg border border-border p-4 my-4">
        <Endpoint method="POST" path="/api/v1/data-feeds/:id/ingest" desc="Ingest data into a project's pipeline (multi-format)" />
        <Endpoint method="GET" path="/api/v1/runs" desc="List pipeline runs (paginated, filterable by status)" />
        <Endpoint method="GET" path="/api/v1/runs/:messageId" desc="Get run detail with stage events" />
        <Endpoint method="POST" path="/api/v1/runs/:messageId/retry" desc="Retry a failed pipeline run" />
        <Endpoint method="DELETE" path="/api/v1/runs/:messageId" desc="Soft-delete a pipeline run" />
      </div>

      {/* ── Extension SDK ── */}
      <H2>Extension SDK</H2>
      <P>
        Extensions interact with OpenLDR through a bridged SDK injected at
        runtime. Every call is permission-gated — the server enforces the
        scopes declared in the extension's manifest.json.
      </P>

      <div className="rounded-xl border border-border bg-white overflow-hidden my-6">
        <div className="divide-y divide-border">
          {SDK_SECTIONS.map((s) => (
            <div key={s.title} className="p-5">
              <div
                className={`text-[11px] font-mono uppercase tracking-[0.15em] mb-3 font-medium ${s.color}`}
              >
                {s.title}
              </div>
              <div className="space-y-3">
                {s.items.map((item) => (
                  <div key={item.sig}>
                    <code className="text-[13px] font-mono text-heading break-all">
                      {item.sig}
                    </code>
                    <div className="text-[12px] font-mono text-caption mt-0.5">
                      → {item.ret}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Filter Operators ── */}
      <H3>Filter Operators</H3>
      <P>
        Query filters support the following operators: eq, ne, gt, gte, lt,
        lte, like, in. Pass them as nested objects in the filters parameter.
      </P>
      <CodeBlock title="filter examples">{FILTER_EXAMPLE}</CodeBlock>

      {/* ── Permissions ── */}
      <H3>Extension Permissions</H3>
      <P>
        Extensions declare required permissions in manifest.json. Users
        approve these at install time and the server enforces them on every
        request.
      </P>
      <div className="rounded-xl border border-border bg-white p-5 my-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {PERMISSIONS.map((p) => (
            <div
              key={p}
              className="flex items-center gap-2 text-[13px] font-mono text-body"
            >
              <Check className="w-3.5 h-3.5 text-teal shrink-0" />
              {p}
            </div>
          ))}
        </div>
      </div>

      {/* ── Extension Manifest ── */}
      <H3>Extension Manifest</H3>
      <P>
        Every extension ships as a ZIP containing manifest.json and the
        bundle file (index.html for iframe, index.js for worker).
      </P>
      <CodeBlock title="manifest.json">{`{
  "id": "my-extension",
  "name": "My Extension",
  "version": "1.0.0",
  "kind": "iframe",
  "permissions": [
    "data.patients",
    "data.labResults",
    "ui.notifications",
    "storage.read"
  ]
}`}</CodeBlock>
    </article>
  );
}
