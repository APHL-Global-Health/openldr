import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, Check } from "lucide-react";

const RELEASES = [
  {
    version: "v2.0.0",
    date: "2025-06-01",
    tag: "Latest",
    tagColor: "#C83C0C",
    changes: [
      "Worker extension runtime — background JS with no UI",
      "Direct query engine replacing upstream proxy (QUERY_MODE=direct)",
      "Operator filters: eq, ne, gt, gte, lt, lte, like, in",
      "JSONB flattening — extensions see flat row objects",
      "SHA-256 integrity verification via SubtleCrypto",
      "Registry auto-refresh after upload",
      "Schema plugin consolidation — 8 plugins merged into 2 multi-format plugins",
      "HL7 v2.x and FHIR (JSON + XML) support via hl7-fhir.schema.js",
      "Pipeline deduplication — SHA-256 hash-on-ingest with force-run option",
      "MinIO lifecycle policies for automatic intermediate object cleanup",
      "Pipeline Runs page with paginated table, detail view, retry/delete actions",
    ],
  },
  {
    version: "v1.3.0",
    date: "2025-04-15",
    tag: "Stable",
    tagColor: "#0A7B6F",
    changes: [
      "Cross-extension event bus (emit / subscribe)",
      "Per-user extension storage backed by PostgreSQL JSONB",
      "Status bar API with priority queue",
      "Command palette integration",
    ],
  },
  {
    version: "v1.2.0",
    date: "2025-03-01",
    tag: null,
    tagColor: "",
    changes: [
      "Iframe extension sandbox with strict CSP",
      "Bridge injection via single-script architecture",
      "MinIO-backed extension payload storage",
      "Keycloak JWT verification with JWKS caching",
    ],
  },
  {
    version: "v1.1.0",
    date: "2025-02-01",
    tag: null,
    tagColor: "",
    changes: [
      "Extension marketplace UI with install/uninstall flow",
      "Permission approval modal with per-scope review",
      "Extension detail pane with integrity hash display",
    ],
  },
  {
    version: "v1.0.0",
    date: "2025-01-10",
    tag: "Initial",
    tagColor: "#8E8E93",
    changes: [
      "Initial release — iframe extensions with data proxy",
      "PostgreSQL-backed extension registry",
      "Turborepo monorepo with client + server workspaces",
    ],
  },
];

export default function ChangelogPage() {
  const [open, setOpen] = useState<string | null>("v2.0.0");

  return (
    <article>
      <h1 className="font-display font-extrabold text-heading text-[clamp(1.8rem,3vw,2.5rem)] leading-tight mb-3">
        Changelog
      </h1>
      <p className="text-caption text-[14px] font-mono mb-8">
        A complete history of OpenLDR releases
      </p>

      <div className="h-px bg-border mb-8" />

      {/* Timeline */}
      <div className="relative">
        <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />

        <div className="space-y-4">
          {RELEASES.map((r) => (
            <div key={r.version} className="relative pl-10">
              {/* Dot */}
              <div
                className="absolute left-[5px] top-[18px] w-[13px] h-[13px] rounded-full border-2 border-paper"
                style={{ background: r.tagColor || "#D4D0C8" }}
              />

              <div className="rounded-xl bg-white border border-border overflow-hidden hover:shadow-md hover:shadow-black/3 transition-shadow">
                <button
                  onClick={() =>
                    setOpen(open === r.version ? null : r.version)
                  }
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-paper/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-display font-bold text-heading">
                      {r.version}
                    </span>
                    {r.tag && (
                      <span
                        className="text-[10.5px] font-mono px-2 py-0.5 rounded-full font-medium text-white"
                        style={{ background: r.tagColor }}
                      >
                        {r.tag}
                      </span>
                    )}
                    <span className="text-[12px] font-mono text-caption hidden sm:block">
                      {r.date}
                    </span>
                  </div>
                  <motion.div
                    animate={{ rotate: open === r.version ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown className="w-4 h-4 text-caption" />
                  </motion.div>
                </button>

                {open === r.version && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <ul className="px-5 pb-5 space-y-2.5 border-t border-border pt-4">
                      {r.changes.map((c) => (
                        <li
                          key={c}
                          className="flex items-start gap-2.5 text-[15px] text-body"
                        >
                          <Check className="w-4 h-4 text-teal mt-0.5 shrink-0" />
                          {c}
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}
