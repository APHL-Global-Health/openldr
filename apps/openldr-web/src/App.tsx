import { useEffect, useRef, useState } from "react";
import { motion, useInView, useScroll, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Microscope,
  Puzzle,
  Shield,
  Zap,
  Globe,
  GitBranch,
  Terminal,
  ChevronDown,
  ArrowRight,
  ExternalLink,
  Package,
  Cpu,
  Database,
  Code2,
  Check,
  Menu,
  X,
} from "lucide-react";

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);
  const links = ["Features", "Extensions", "SDK", "Changelog"];
  return (
    <header
      className={cn(
        "fixed top-0 inset-x-0 z-50 transition-all duration-300",
        scrolled ? "bg-bg/90 backdrop-blur-xl border-b border-border" : "",
      )}
    >
      <nav className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="#" className="flex items-center gap-2.5 group">
          <div className="w-7 h-7 rounded-md bg-amber/10 border border-amber/30 flex items-center justify-center group-hover:bg-amber/20 transition-colors">
            <Microscope className="w-3.5 h-3.5 text-amber" />
          </div>
          <span
            className="font-bold text-white text-sm tracking-tight"
            style={{ fontFamily: "Syne,sans-serif" }}
          >
            Open
            <span
              style={{
                background: "linear-gradient(135deg,#f5a623,#ffcc6b)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              LDR
            </span>
          </span>
        </a>
        <div className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <a
              key={l}
              href={`#${l.toLowerCase()}`}
              className="text-amber/70 hover:text-amber/90 text-xs uppercase tracking-widest transition-colors"
              style={{ fontFamily: "JetBrains Mono,monospace" }}
            >
              {l}
            </a>
          ))}
        </div>
        <div className="hidden md:flex items-center gap-3">
          <a
            href="https://github.com/openldr"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-amber/70 hover:text-amber/90 text-xs transition-colors"
            style={{ fontFamily: "JetBrains Mono,monospace" }}
          >
            <GitBranch className="w-3.5 h-3.5" /> GitHub
          </a>
          <a
            target="_blank"
            rel="noopener noreferrer"
            href={import.meta.env.VITE_APP_URL || "#"}
            className="px-4 py-1.5 bg-amber text-black text-xs font-bold rounded-md hover:bg-amber2 transition-colors"
            style={{ fontFamily: "JetBrains Mono,monospace" }}
          >
            Launch App →
          </a>
        </div>
        <button
          className="md:hidden text-amber/70"
          onClick={() => setOpen(!open)}
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </nav>
      {open && (
        <div className="md:hidden bg-bg border-b border-border px-6 pb-6 flex flex-col gap-4">
          {links.map((l) => (
            <a
              key={l}
              href={`#${l.toLowerCase()}`}
              onClick={() => setOpen(false)}
              className="text-amber/70 hover:text-amber/90 text-xs uppercase tracking-widest transition-colors"
              style={{ fontFamily: "JetBrains Mono,monospace" }}
            >
              {l}
            </a>
          ))}
          <a
            href={import.meta.env.VITE_APP_URL || "#"}
            className="px-4 py-2 bg-amber text-black text-xs font-bold rounded-md text-center"
            style={{ fontFamily: "JetBrains Mono,monospace" }}
          >
            Launch App →
          </a>
        </div>
      )}
    </header>
  );
}

const TERMINAL_LINES = [
  { delay: 0, text: "$ npm install @openldr/sdk", color: "#7a8aaa" },
  { delay: 0.7, text: "✓ @openldr/sdk@2.0.0 installed", color: "#4ade80" },
  { delay: 1.3, text: "", color: "" },
  {
    delay: 1.5,
    text: "export async function activate(openldr) {",
    color: "#c8d4ec",
  },
  {
    delay: 1.8,
    text: "  const data = await openldr.data.query(",
    color: "#c8d4ec",
  },
  { delay: 2.0, text: "    'external', 'lab_results',", color: "#f5a623" },
  {
    delay: 2.2,
    text: "    { filters: { rpt_flag: 'H' }, limit: 100 }",
    color: "#f5a623",
  },
  { delay: 2.4, text: "  )", color: "#c8d4ec" },
  { delay: 2.7, text: "  openldr.ui.showNotification(", color: "#c8d4ec" },
  {
    delay: 2.9,
    text: "    `${data.total} critical results`, 'warning'",
    color: "#2cd4c0",
  },
  { delay: 3.1, text: "  )", color: "#c8d4ec" },
  { delay: 3.3, text: "}", color: "#c8d4ec" },
];

function TerminalLine({
  text,
  color,
  delay,
}: {
  text: string;
  color: string;
  delay: number;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay * 1000);
    return () => clearTimeout(t);
  }, [delay]);
  if (!visible) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="text-xs leading-relaxed whitespace-pre"
      style={{
        fontFamily: "JetBrains Mono,monospace",
        color: color || "transparent",
      }}
    >
      {text || "\u00a0"}
    </motion.div>
  );
}

function Hero() {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 400], [0, 60]);
  return (
    <section
      className="relative min-h-screen flex flex-col items-center justify-center pt-16 overflow-hidden"
      style={{
        backgroundImage:
          "linear-gradient(rgba(245,166,35,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(245,166,35,0.03) 1px,transparent 1px)",
        backgroundSize: "48px 48px",
      }}
    >
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl"
          style={{ background: "rgba(245,166,35,0.05)" }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full blur-3xl"
          style={{ background: "rgba(44,212,192,0.05)" }}
        />
      </div>
      <motion.div
        style={{ y }}
        className="relative z-10 max-w-5xl mx-auto px-6 text-center"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full border mb-8"
          style={{
            borderColor: "rgba(245,166,35,0.2)",
            background: "rgba(245,166,35,0.05)",
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse" />
          <span
            className="text-xs text-amber"
            style={{ fontFamily: "JetBrains Mono,monospace" }}
          >
            v2.0 — Now with worker extensions
          </span>
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="font-extrabold text-5xl md:text-7xl leading-[1.05] tracking-tight text-white mb-6"
          style={{ fontFamily: "Syne,sans-serif" }}
        >
          Lab data,{" "}
          <span
            style={{
              background: "linear-gradient(135deg,#f5a623,#ffcc6b)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            extensible
          </span>{" "}
          by design
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-amber/70 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          OpenLDR is an open-source microservices platform for laboratory data
          management and AMR surveillance — with a VSCode-style extension
          runtime built in.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex flex-wrap items-center justify-center gap-4 mb-16"
        >
          <a
            href={import.meta.env.VITE_APP_URL || "#"}
            className="inline-flex items-center gap-2 px-6 py-3 bg-amber text-black font-bold text-sm rounded-lg hover:bg-amber2 transition-all hover:scale-105"
            style={{
              fontFamily: "JetBrains Mono,monospace",
              boxShadow: "0 0 40px rgba(245,166,35,0.2)",
            }}
          >
            Launch App <ArrowRight className="w-4 h-4" />
          </a>
          <a
            href="https://github.com/openldr"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 border text-amber/70 text-sm rounded-lg hover:border-amber/40 hover:text-amber transition-all"
            style={{
              fontFamily: "JetBrains Mono,monospace",
              borderColor: "#242b3d",
            }}
          >
            <GitBranch className="w-4 h-4" /> View on GitHub
          </a>
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex flex-wrap items-center justify-center gap-10 mb-16"
        >
          {[
            ["3", "Extension types"],
            ["12+", "Permissions"],
            ["RS256", "JWT auth"],
            ["MIT", "License"],
          ].map(([val, label]) => (
            <div key={label} className="text-center">
              <div
                className="font-bold text-2xl text-white mb-0.5"
                style={{ fontFamily: "Syne,sans-serif" }}
              >
                {val}
              </div>
              <div
                className="text-[10px] text-amber/70 uppercase tracking-wider"
                style={{ fontFamily: "JetBrains Mono,monospace" }}
              >
                {label}
              </div>
            </div>
          ))}
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="text-left max-w-2xl mx-auto overflow-hidden rounded-lg border border-border"
          style={{
            background: "#0e1118",
            boxShadow: "0 0 60px rgba(245,166,35,0.1)",
          }}
        >
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-bg2">
            <div className="w-2.5 h-2.5 rounded-full bg-red/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-green/60" />
            <span
              className="ml-3 text-xs text-amber/70"
              style={{ fontFamily: "JetBrains Mono,monospace" }}
            >
              extension/src/index.ts
            </span>
          </div>
          <div className="p-5 space-y-0.5 min-h-50">
            {TERMINAL_LINES.map((l, i) => (
              <TerminalLine key={i} {...l} />
            ))}
          </div>
        </motion.div>
      </motion.div>
      <motion.div
        animate={{ y: [0, 8, 0] }}
        transition={{ repeat: Infinity, duration: 2 }}
        className="absolute bottom-8 text-amber/70"
      >
        <ChevronDown className="w-5 h-5" />
      </motion.div>
    </section>
  );
}

function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function SectionHeading({
  tag,
  title,
  accent,
  sub,
}: {
  tag: string;
  title: string;
  accent?: string;
  sub: string;
}) {
  return (
    <div className="text-center mb-16">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border2 bg-surface mb-5">
        <span
          className="text-xs text-amber/70 uppercase tracking-widest"
          style={{ fontFamily: "JetBrains Mono,monospace" }}
        >
          {tag}
        </span>
      </div>
      <h2
        className="font-bold text-3xl md:text-5xl text-white mb-4"
        style={{ fontFamily: "Syne,sans-serif" }}
      >
        {title}
        {accent && (
          <>
            {" "}
            <span
              style={{
                background: "linear-gradient(135deg,#2cd4c0,#7ee8de)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {accent}
            </span>
          </>
        )}
      </h2>
      <p className="text-amber/70 text-base max-w-xl mx-auto">{sub}</p>
    </div>
  );
}

const FEATURES = [
  {
    icon: Shield,
    color: "#f5a623",
    title: "Server-side permissions",
    body: "Every data access is gated by the permission manifest. Users approve scopes at install time — the server enforces them on every request.",
  },
  {
    icon: Cpu,
    color: "#2cd4c0",
    title: "Worker + iframe runtimes",
    body: "Background workers run surveillance jobs with no UI. Iframe extensions render full dashboards in sandboxed contexts with strict CSP.",
  },
  {
    icon: Database,
    color: "#a78bfa",
    title: "Typed data proxy",
    body: "Extensions never touch the database directly. Every query goes through a typed proxy with pagination, sorting, and operator filters.",
  },
  {
    icon: Zap,
    color: "#4ade80",
    title: "SHA-256 integrity",
    body: "The client recomputes the payload hash via SubtleCrypto on every load. Any tampering causes a hard reject before execution.",
  },
  {
    icon: Globe,
    color: "#f5a623",
    title: "Cross-extension events",
    body: "Extensions communicate through a typed event bus. A monitor worker can trigger a dashboard refresh without any direct coupling.",
  },
  {
    icon: Package,
    color: "#2cd4c0",
    title: "One-file bundles",
    body: "Extensions ship as a ZIP containing manifest.json + index.html. No CDN dependencies — fully self-contained and auditable.",
  },
];

function Features() {
  return (
    <section id="features" className="py-28 px-6">
      <div className="max-w-6xl mx-auto">
        <FadeIn>
          <SectionHeading
            tag="Why OpenLDR"
            title="Everything you need,"
            accent="nothing you don't"
            sub="A minimal, secure, auditable extension platform designed specifically for healthcare data."
          />
        </FadeIn>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => (
            <FadeIn key={f.title} delay={i * 0.07}>
              <div className="rounded-lg border border-border bg-surface p-6 h-full hover:border-border2 transition-colors group">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center mb-4 bg-surface border border-border group-hover:border-border2 transition-colors"
                  style={{ color: f.color }}
                >
                  <f.icon className="w-4 h-4" />
                </div>
                <h3
                  className="font-semibold text-white text-base mb-2"
                  style={{ fontFamily: "Syne,sans-serif" }}
                >
                  {f.title}
                </h3>
                <p className="text-dim text-sm leading-relaxed">{f.body}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  {
    n: "01",
    title: "Build",
    body: "Write your extension in TypeScript using the OpenLDR SDK. Bundle with esbuild or Vite — output is a single index.html (iframe) or index.js (worker).",
    code: `// manifest.json\n{\n  "id": "my-extension",\n  "kind": "iframe",\n  "permissions": [\n    "data.patients",\n    "ui.notifications"\n  ]\n}`,
  },
  {
    n: "02",
    title: "Publish",
    body: "ZIP the manifest and bundle, upload via the OpenLDR UI or REST API. The server computes SHA-256 integrity and stores the bundle in MinIO.",
    code: `# pack and upload\nzip extension.zip \\\n  manifest.json index.html\n\ncurl -X POST /api/v1/extensions \\\n  -H "Authorization: Bearer $T" \\\n  -F "bundle=@extension.zip"`,
  },
  {
    n: "03",
    title: "Install",
    body: "Users install from the marketplace, review and approve permission scopes. The runtime enforces these on every data request — server-side.",
    code: `// Integrity check before exec\nconst hash = await crypto.subtle\n  .digest('SHA-256',\n    encoder.encode(payload))\nif (hash !== manifest.integrity)\n  throw new Error('Tampered')`,
  },
];

function HowItWorks() {
  return (
    <section
      className="py-28 px-6 border-y border-border"
      style={{ background: "#0a0d14" }}
    >
      <div className="max-w-6xl mx-auto">
        <FadeIn>
          <SectionHeading
            tag="How it works"
            title="Build, publish,"
            accent="install"
            sub="Three steps from idea to running extension. Self-host everything, no registry account needed."
          />
        </FadeIn>
        <div className="grid md:grid-cols-3 gap-8">
          {STEPS.map((s, i) => (
            <FadeIn key={s.n} delay={i * 0.1}>
              <div>
                <div
                  className="font-extrabold text-6xl leading-none mb-4 select-none"
                  style={{ fontFamily: "Syne,sans-serif", color: "#1a1f2e" }}
                >
                  {s.n}
                </div>
                <h3
                  className="font-bold text-white text-xl mb-3"
                  style={{ fontFamily: "Syne,sans-serif" }}
                >
                  {s.title}
                </h3>
                <p className="text-dim text-sm leading-relaxed mb-5">
                  {s.body}
                </p>
                <pre
                  className="rounded-lg p-4 text-xs leading-relaxed overflow-x-auto border border-border"
                  style={{
                    fontFamily: "JetBrains Mono,monospace",
                    background: "#06080d",
                    color: "#2cd4c0",
                  }}
                >
                  {s.code}
                </pre>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

const EXTENSIONS = [
  {
    icon: "🏥",
    name: "Patient Statistics",
    id: "openldr-patients",
    kind: "iframe",
    desc: "Demographics dashboard — gender split, age groups, registration trends from openldr_external.patients.",
    perms: ["data.patients", "ui.statusBar", "storage.read"],
    accent: "#f5a623",
  },
  {
    icon: "🧪",
    name: "Lab Results Browser",
    id: "openldr-lab-results",
    kind: "iframe",
    desc: "Filter and paginate lab results by flag, panel, date range. One-click CSV export.",
    perms: ["data.labResults", "data.labRequests", "ui.commands"],
    accent: "#2cd4c0",
  },
  {
    icon: "🔬",
    name: "Lab Surveillance Monitor",
    id: "openldr-lab-monitor",
    kind: "worker",
    desc: "Background worker — flags overdue pending requests and high abnormal result rates. Fires cross-extension events.",
    perms: [
      "data.labRequests",
      "data.labResults",
      "events.emit",
      "ui.statusBar",
    ],
    accent: "#a78bfa",
  },
];

function ExtensionShowcase() {
  return (
    <section id="extensions" className="py-28 px-6">
      <div className="max-w-6xl mx-auto">
        <FadeIn>
          <SectionHeading
            tag="Reference extensions"
            title="Three extensions,"
            accent="ready to run"
            sub="Install these to see the runtime in action. Each one is open-source and forkable."
          />
        </FadeIn>
        <div className="grid md:grid-cols-3 gap-5">
          {EXTENSIONS.map((ext, i) => (
            <FadeIn key={ext.id} delay={i * 0.08}>
              <div
                className="rounded-lg border bg-surface p-6 h-full transition-colors"
                style={{ borderColor: `${ext.accent}20` }}
              >
                <div className="flex items-start justify-between mb-4">
                  <span className="text-3xl">{ext.icon}</span>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded border"
                    style={{
                      fontFamily: "JetBrains Mono,monospace",
                      color: ext.accent,
                      borderColor: `${ext.accent}30`,
                      background: `${ext.accent}10`,
                    }}
                  >
                    {ext.kind}
                  </span>
                </div>
                <h3
                  className="font-semibold text-white mb-1"
                  style={{ fontFamily: "Syne,sans-serif" }}
                >
                  {ext.name}
                </h3>
                <p
                  className="text-[10px] text-muted mb-3"
                  style={{ fontFamily: "JetBrains Mono,monospace" }}
                >
                  {ext.id}
                </p>
                <p className="text-dim text-sm leading-relaxed mb-5">
                  {ext.desc}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {ext.perms.map((p) => (
                    <span
                      key={p}
                      className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted bg-surface"
                      style={{ fontFamily: "JetBrains Mono,monospace" }}
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

const SDK_SECTIONS = [
  {
    title: "Data",
    color: "#f5a623",
    items: [
      {
        sig: "openldr.data.query(schema, table, params)",
        ret: "Promise<{ data, total, page, limit }>",
      },
    ],
  },
  {
    title: "UI",
    color: "#2cd4c0",
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
    color: "#a78bfa",
    items: [
      { sig: "openldr.events.on(event, handler)", ret: "{ dispose() }" },
      { sig: "openldr.events.emit(event, payload)", ret: "void" },
    ],
  },
  {
    title: "Storage",
    color: "#4ade80",
    items: [
      { sig: "openldr.storage.get(key)", ret: "Promise<unknown>" },
      { sig: "openldr.storage.set(key, value)", ret: "Promise<void>" },
      { sig: "openldr.storage.delete(key)", ret: "Promise<void>" },
    ],
  },
];

const FILTER_EXAMPLE = `// Equality\n{ facility_code: 'FAC001' }\n\n// Operators\n{ created_at: { gte: '2024-01-01' } }\n{ rpt_flag:   { in: ['H', 'L', 'C'] } }\n{ panel_desc: { like: 'Blood%' } }\n\n// Combined\n{\n  status:     { ne: 'cancelled' },\n  created_at: { gte: '2024-06-01',\n                lte: '2024-12-31' }\n}`;

function SDK() {
  return (
    <section
      id="sdk"
      className="py-28 px-6 border-y border-border"
      style={{ background: "#0a0d14" }}
    >
      <div className="max-w-6xl mx-auto">
        <FadeIn>
          <SectionHeading
            tag="SDK Reference"
            title="The full"
            accent="API surface"
            sub="Everything an extension can call. Bridged to the server's permission-gated endpoints at runtime."
          />
        </FadeIn>
        <div className="grid lg:grid-cols-2 gap-8">
          <FadeIn>
            <div className="rounded-lg border border-border bg-surface overflow-hidden">
              <div className="px-5 py-3 border-b border-border bg-bg flex items-center gap-2">
                <Code2 className="w-3.5 h-3.5 text-muted" />
                <span
                  className="text-xs text-muted"
                  style={{ fontFamily: "JetBrains Mono,monospace" }}
                >
                  openldr SDK
                </span>
              </div>
              <div className="divide-y divide-border">
                {SDK_SECTIONS.map((s) => (
                  <div key={s.title} className="p-5">
                    <div
                      className="text-xs uppercase tracking-widest mb-3"
                      style={{
                        fontFamily: "JetBrains Mono,monospace",
                        color: s.color,
                      }}
                    >
                      {s.title}
                    </div>
                    <div className="space-y-3">
                      {s.items.map((item) => (
                        <div key={item.sig}>
                          <code
                            className="text-xs text-bright break-all"
                            style={{ fontFamily: "JetBrains Mono,monospace" }}
                          >
                            {item.sig}
                          </code>
                          <div
                            className="text-xs text-muted mt-0.5"
                            style={{ fontFamily: "JetBrains Mono,monospace" }}
                          >
                            → {item.ret}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
          <FadeIn delay={0.1} className="space-y-5">
            <div className="rounded-lg border border-border bg-surface overflow-hidden">
              <div className="px-5 py-3 border-b border-border bg-bg flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-muted" />
                <span
                  className="text-xs text-muted"
                  style={{ fontFamily: "JetBrains Mono,monospace" }}
                >
                  Filter operators
                </span>
              </div>
              <pre
                className="p-5 text-xs leading-relaxed overflow-x-auto"
                style={{
                  fontFamily: "JetBrains Mono,monospace",
                  color: "#2cd4c0",
                }}
              >
                {FILTER_EXAMPLE}
              </pre>
            </div>
            <div className="rounded-lg border border-border bg-surface p-5">
              <div
                className="text-xs text-muted uppercase tracking-widest mb-4"
                style={{ fontFamily: "JetBrains Mono,monospace" }}
              >
                Permissions
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
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
                ].map((p) => (
                  <div
                    key={p}
                    className="flex items-center gap-1.5 text-xs text-muted"
                    style={{ fontFamily: "JetBrains Mono,monospace" }}
                  >
                    <Check className="w-3 h-3 text-success shrink-0" />
                    {p}
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}

const RELEASES = [
  {
    version: "v2.0.0",
    date: "2025-06-01",
    tag: "Latest",
    tagColor: "rgba(245,166,35,0.1)",
    tagText: "#f5a623",
    tagBorder: "rgba(245,166,35,0.2)",
    changes: [
      "Worker extension runtime — background JS with no UI",
      "Direct query engine replacing upstream proxy (QUERY_MODE=direct)",
      "Operator filters: eq, ne, gt, gte, lt, lte, like, in",
      "JSONB flattening — extensions see flat row objects",
      "SHA-256 integrity verification via SubtleCrypto",
      "Registry auto-refresh after upload",
    ],
  },
  {
    version: "v1.3.0",
    date: "2025-04-15",
    tag: "Stable",
    tagColor: "rgba(44,212,192,0.1)",
    tagText: "#2cd4c0",
    tagBorder: "rgba(44,212,192,0.2)",
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
    tagText: "",
    tagBorder: "",
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
    tagText: "",
    tagBorder: "",
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
    tagColor: "rgba(26,31,46,1)",
    tagText: "#3d4a63",
    tagBorder: "#242b3d",
    changes: [
      "Initial release — iframe extensions with data proxy",
      "PostgreSQL-backed extension registry",
      "Turborepo monorepo with client + server workspaces",
    ],
  },
];

function Changelog() {
  const [open, setOpen] = useState<string | null>("v2.0.0");
  return (
    <section id="changelog" className="py-28 px-6">
      <div className="max-w-3xl mx-auto">
        <FadeIn>
          <SectionHeading
            tag="Changelog"
            title="What's"
            accent="changed"
            sub="A complete history of OpenLDR extension platform releases."
          />
        </FadeIn>
        <div className="space-y-3">
          {RELEASES.map((r, i) => (
            <FadeIn key={r.version} delay={i * 0.05}>
              <div className="rounded-lg border border-border bg-surface overflow-hidden">
                <button
                  onClick={() => setOpen(open === r.version ? null : r.version)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-bg2/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="font-bold text-white"
                      style={{ fontFamily: "Syne,sans-serif" }}
                    >
                      {r.version}
                    </span>
                    {r.tag && (
                      <span
                        className="text-[10px] px-2 py-0.5 rounded border"
                        style={{
                          fontFamily: "JetBrains Mono,monospace",
                          color: r.tagText,
                          background: r.tagColor,
                          borderColor: r.tagBorder,
                        }}
                      >
                        {r.tag}
                      </span>
                    )}
                    <span
                      className="text-xs text-muted hidden sm:block"
                      style={{ fontFamily: "JetBrains Mono,monospace" }}
                    >
                      {r.date}
                    </span>
                  </div>
                  <motion.div
                    animate={{ rotate: open === r.version ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown className="w-4 h-4 text-muted" />
                  </motion.div>
                </button>
                {open === r.version && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <ul className="px-5 pb-5 space-y-2 border-t border-border pt-4">
                      {r.changes.map((c) => (
                        <li
                          key={c}
                          className="flex items-start gap-2 text-sm text-muted"
                        >
                          <Check className="w-3.5 h-3.5 text-success mt-0.5 shrink-0" />
                          {c}
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                )}
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTABanner() {
  return (
    <section
      className="py-28 px-6 border-t border-border"
      style={{ background: "#0a0d14" }}
    >
      <div className="max-w-3xl mx-auto text-center">
        <FadeIn>
          <div
            className="rounded-lg border border-border bg-surface p-12 relative overflow-hidden"
            style={{ boxShadow: "0 0 80px rgba(245,166,35,0.08)" }}
          >
            <div
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(245,166,35,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(245,166,35,0.04) 1px,transparent 1px)",
                backgroundSize: "48px 48px",
              }}
            />
            <div className="relative z-10">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-6"
                style={{
                  background: "rgba(245,166,35,0.1)",
                  border: "1px solid rgba(245,166,35,0.3)",
                }}
              >
                <Puzzle className="w-7 h-7 text-amber" />
              </div>
              <h2
                className="font-bold text-3xl md:text-4xl text-white mb-4"
                style={{ fontFamily: "Syne,sans-serif" }}
              >
                Ready to build your first extension?
              </h2>
              <p className="text-muted mb-8 max-w-md mx-auto">
                The SDK is installed, the runtime is running. All you need is an
                idea and a manifest.json.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <a
                  href={import.meta.env.VITE_APP_URL || "#"}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-amber text-black font-bold text-sm rounded-lg hover:bg-amber2 transition-all hover:scale-105"
                  style={{ fontFamily: "JetBrains Mono,monospace" }}
                >
                  Open the Runtime <ArrowRight className="w-4 h-4" />
                </a>
                <a
                  href="https://github.com/openldr"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 border border-border2 text-muted text-sm rounded-lg hover:border-amber/40 transition-colors"
                  style={{ fontFamily: "JetBrains Mono,monospace" }}
                >
                  <ExternalLink className="w-4 h-4" /> Read the docs
                </a>
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border px-6 py-10">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Microscope className="w-4 h-4 text-amber" />
          <span
            className="font-bold text-sm text-white"
            style={{ fontFamily: "Syne,sans-serif" }}
          >
            OpenLDR
          </span>
          <span
            className="text-muted text-xs ml-2"
            style={{ fontFamily: "JetBrains Mono,monospace" }}
          >
            MIT License
          </span>
        </div>
        <div className="flex items-center gap-6">
          {["Features", "Extensions", "SDK", "Changelog"].map((l) => (
            <a
              key={l}
              href={`#${l.toLowerCase()}`}
              className="text-muted hover:text-amber text-xs transition-colors"
              style={{ fontFamily: "JetBrains Mono,monospace" }}
            >
              {l}
            </a>
          ))}
          <a
            href="https://github.com/openldr"
            target="_blank"
            rel="noreferrer"
            className="text-muted hover:text-amber text-xs transition-colors"
            style={{ fontFamily: "JetBrains Mono,monospace" }}
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}

export default function App() {
  return (
    <div className="min-h-screen" style={{ background: "#06080d" }}>
      <Nav />
      <Hero />
      <Features />
      <HowItWorks />
      <ExtensionShowcase />
      <SDK />
      <Changelog />
      <CTABanner />
      <Footer />
    </div>
  );
}
