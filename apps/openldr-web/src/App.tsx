import { useEffect, useRef, useState } from "react";
import { motion, useInView, useScroll, useTransform } from "framer-motion";
import { Link } from "react-router-dom";
const BASE = import.meta.env.BASE_URL;

import {
  Shield,
  Globe,
  GitBranch,
  ChevronDown,
  ArrowRight,
  ChevronRight,
  Menu,
  X,
  BarChart3,
  FileCheck,
  Lock,
  AlertTriangle,
  Clock,
  Search,
  ServerCrash,
  FileInput,
  Workflow,
  BookOpen,
  PieChart,
  LayoutDashboard,
  FormInput,
  Activity,
  Plug,
  Sun,
  Moon,
} from "lucide-react";

/* ─────────────────────────── THEME ─────────────────────────── */

function useTheme() {
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem("openldr-theme");
    if (stored) return stored === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("openldr-theme", dark ? "dark" : "light");
  }, [dark]);

  return { dark, toggle: () => setDark((d) => !d) };
}

/* ─────────────────────────── UTILITIES ─────────────────────────── */

function FadeIn({
  children,
  delay = 0,
  className,
  direction = "up",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  direction?: "up" | "left" | "right";
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const initial =
    direction === "up"
      ? { opacity: 0, y: 30 }
      : direction === "left"
      ? { opacity: 0, x: -30 }
      : { opacity: 0, x: 30 };
  const animate =
    direction === "up" ? { opacity: 1, y: 0 } : { opacity: 1, x: 0 };
  return (
    <motion.div
      ref={ref}
      initial={initial}
      animate={inView ? animate : {}}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const GITHUB_URL =
  import.meta.env.VITE_GITHUB_URL ||
  "https://github.com/APHL-Global-Health/openldr";
const APP_URL = import.meta.env.VITE_APP_URL || "#";

/* ─────────────────────────── 1. NAVIGATION ─────────────────────────── */

function Nav() {
  const { dark, toggle } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);
  const links = [
    { label: "Challenge", href: "#challenge" },
    { label: "Platform", href: "#platform" },
    { label: "Architecture", href: "#architecture" },
    { label: "Gallery", href: "#gallery" },
  ];
  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-paper/95 backdrop-blur-xl border-b border-border shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
          : ""
      }`}
    >
      <nav className="max-w-7xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
        {/* Logo */}
        <a href="#" className="flex items-center gap-3 group">
          <img
            src={`${BASE}OpenODRv2Logo.png`}
            alt="OpenLDR"
            className="h-8 group-hover:scale-105 transition-transform"
          />
        </a>

        {/* Center links */}
        <div className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="px-3.5 py-1.5 text-[13px] font-mono text-caption hover:text-heading rounded-md hover:bg-paper2 transition-all"
            >
              {l.label}
            </a>
          ))}
        </div>

        {/* Right */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            to="/docs"
            className="px-3.5 py-1.5 text-[13px] font-mono text-caption hover:text-heading rounded-md hover:bg-paper2 transition-all"
          >
            Docs
          </Link>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-mono text-caption hover:text-heading transition-colors"
          >
            <GitBranch className="w-3.5 h-3.5" /> GitHub
          </a>
          <button
            onClick={toggle}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-caption hover:text-heading hover:bg-paper2 transition-all"
            aria-label="Toggle theme"
          >
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <a
            target="_blank"
            rel="noopener noreferrer"
            href={APP_URL}
            className="px-5 py-2 bg-heading text-white text-[13px] font-display font-semibold rounded-lg hover:bg-ink2 transition-colors"
          >
            Launch Studio
          </a>
        </div>

        <button
          className="md:hidden text-heading"
          onClick={() => setOpen(!open)}
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </nav>

      {open && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:hidden bg-white border-b border-border px-6 pb-6 flex flex-col gap-3"
        >
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              onClick={() => setOpen(false)}
              className="text-[13px] font-mono text-caption hover:text-heading py-2 transition-colors"
            >
              {l.label}
            </a>
          ))}
          <Link
            to="/docs"
            onClick={() => setOpen(false)}
            className="text-[13px] font-mono text-caption hover:text-heading py-2 transition-colors"
          >
            Docs
          </Link>
          <button
            onClick={toggle}
            className="flex items-center gap-2 text-[13px] font-mono text-caption hover:text-heading py-2 transition-colors"
          >
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {dark ? "Light mode" : "Dark mode"}
          </button>
          <a
            href={APP_URL}
            className="mt-2 px-5 py-2.5 bg-heading text-white text-[13px] font-display font-semibold rounded-lg text-center"
          >
            Launch Studio
          </a>
        </motion.div>
      )}
    </header>
  );
}

/* ─────────────────────────── 2. HERO ─────────────────────────── */

function AppScreenshot() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.4, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-xl overflow-hidden border border-border-dark shadow-2xl shadow-black/10"
    >
      {/* Browser chrome */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-heading border-b border-ink-border">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#FF605C]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#FFBD44]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#00CA4E]" />
        </div>
        <div className="flex-1 mx-3">
          <div className="bg-ink2 rounded-md px-3 py-1 text-[11px] font-mono text-caption text-center truncate">
            openldr-studio
          </div>
        </div>
      </div>
      {/* Screenshot — cropped to ~16:9 from top */}
      <div className="aspect-video overflow-hidden">
        <img
          src={`${BASE}screenshots/Dashboard.png`}
          alt="OpenLDR Studio — Dashboard"
          className="w-full block bg-ink"
          loading="eager"
        />
      </div>
    </motion.div>
  );
}

function Hero() {
  const { scrollY } = useScroll();
  const illustrationY = useTransform(scrollY, [0, 500], [0, -40]);

  return (
    <section className="relative min-h-screen flex items-center pt-16 overflow-hidden dot-grid">
      <div
        className="absolute top-0 right-0 w-[60%] h-[70%] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 70% 20%, rgba(200, 60, 12, 0.04) 0%, transparent 60%)",
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10 w-full py-20 lg:py-0">
        <div className="grid lg:grid-cols-[1fr,0.8fr] gap-12 lg:gap-16 items-center">
          {/* Left — copy */}
          <div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: 0.2,
                duration: 0.6,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="font-display font-extrabold text-[clamp(2.2rem,5vw,4rem)] leading-[1.08] tracking-tight text-heading mb-6"
            >
              A single, trusted view of{" "}
              <span className="accent-line">laboratory data</span> across your
              health system
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.5 }}
              className="text-body text-lg max-w-xl leading-relaxed mb-10"
            >
              OpenLDR brings together laboratory results from across facilities,
              programs and systems — translating local codes into
              internationally recognized standards. Deploy locally or in a
              private cloud, maintaining full control over your data.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.5 }}
              className="flex flex-wrap items-center gap-4 mb-14"
            >
              <a
                href={APP_URL}
                className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-white font-display font-semibold text-[15px] rounded-lg hover:bg-accent-light transition-all hover:shadow-[0_4px_20px_rgba(200,60,12,0.25)]"
              >
                Launch Studio <ArrowRight className="w-4 h-4" />
              </a>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 border border-border-dark text-body font-display font-medium text-[15px] rounded-lg hover:border-heading hover:text-heading transition-all"
              >
                <GitBranch className="w-4 h-4" /> View on GitHub
              </a>
            </motion.div>

            {/* Stats */}
            {/* <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="flex flex-wrap items-center gap-8 lg:gap-12"
            >
              {[
                ["6", "Report types"],
                ["8+", "Data formats"],
                ["3", "Intl. standards"],
                ["Apache 2.0", "License"],
              ].map(([val, label]) => (
                <div key={label}>
                  <div className="font-display font-bold text-2xl text-heading">
                    {val}
                  </div>
                  <div className="text-[11px] font-mono text-caption uppercase tracking-wider mt-0.5">
                    {label}
                  </div>
                </div>
              ))}
            </motion.div> */}
          </div>

          {/* Right — illustration */}
          <motion.div style={{ y: illustrationY }}>
            <AppScreenshot />
          </motion.div>
        </div>
      </div>

      <motion.div
        animate={{ y: [0, 6, 0] }}
        transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-caption"
      >
        <ChevronDown className="w-5 h-5" />
      </motion.div>
    </section>
  );
}

/* ─────────────────────────── 3. THE CHALLENGE & WHY V2 ─────────────────────────── */

const CHALLENGES = [
  {
    icon: ServerCrash,
    title: "Scattered data",
    body: "Results remain isolated in separate systems or even on paper, with no unified repository.",
  },
  {
    icon: Search,
    title: "No complete picture",
    body: "Ministries lack the consolidated view needed for informed public health decision-making.",
  },
  {
    icon: Clock,
    title: "Capacity blind spots",
    body: "Without timely data, it is difficult to track lab capacity or monitor turnaround times.",
  },
  {
    icon: AlertTriangle,
    title: "Delayed outbreak detection",
    body: "Fragmented data means outbreaks may spread before surveillance systems detect them.",
  },
];

function ChallengeAndV2() {
  return (
    <section id="challenge" className="py-28 px-6 lg:px-10 bg-ink noise">
      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Part A — The Challenge */}
        <FadeIn>
          <div className="max-w-2xl mb-16">
            <span className="text-[11px] font-mono text-teal-light uppercase tracking-[0.2em] font-medium">
              The challenge
            </span>
            <h2 className="font-display font-bold text-[clamp(1.8rem,3.5vw,2.8rem)] text-white leading-tight mt-3 mb-4">
              Laboratory data is the backbone of strong health systems
            </h2>
            <p className="text-caption text-lg">
              Yet in many countries, results remain scattered in isolated
              systems or even on paper — leaving ministries without the complete
              picture they need.
            </p>
          </div>
        </FadeIn>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-24">
          {CHALLENGES.map((c, i) => (
            <FadeIn key={c.title} delay={i * 0.08}>
              <div className="rounded-xl border border-ink-border bg-ink2 p-5 h-full">
                {/* <c.icon className="w-5 h-5 text-accent-light mb-4" /> */}
                <h3 className="font-display font-semibold text-white text-base mb-2">
                  {c.title}
                </h3>
                <p className="text-caption text-[14px] leading-relaxed">
                  {c.body}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>

        {/* Part B — V1 vs V2 */}
        <FadeIn>
          <div className="max-w-2xl mb-12">
            <span className="text-[11px] font-mono text-accent-light uppercase tracking-[0.2em] font-medium">
              Why version 2
            </span>
            <h2 className="font-display font-bold text-[clamp(1.6rem,3vw,2.4rem)] text-white leading-tight mt-3 mb-4">
              From guidelines to a{" "}
              <span className="text-[#6B7280]">complete platform</span>
            </h2>
            <p className="text-caption text-lg">
              Version 1 gave countries flexibility but no consistency. Every
              ministry built from scratch, leading to fragmented, incompatible
              implementations. Version 2 delivers the complete system those
              efforts needed.
            </p>
          </div>
        </FadeIn>

        <div className="grid md:grid-cols-2 gap-6">
          <FadeIn delay={0.05} direction="left">
            <div className="rounded-xl border border-ink-border bg-ink2 p-7 h-full">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-ink-border mb-5">
                <span className="text-[11px] font-mono text-caption font-medium">
                  V1 · 2014
                </span>
              </div>
              <h3 className="font-display font-bold text-white text-xl mb-4">
                Guidelines & database design
              </h3>
              <ul className="space-y-3 text-caption text-[15px]">
                <li className="flex items-start gap-2.5">
                  <span className="text-accent-light mt-1.5 shrink-0">—</span>
                  Each Ministry of Health developed their own APIs and
                  interfaces
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-accent-light mt-1.5 shrink-0">—</span>
                  Led to differences in data collection and user interaction
                  across implementations
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-accent-light mt-1.5 shrink-0">—</span>
                  Platform and technology dependent — harder for countries to
                  adapt
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-accent-light mt-1.5 shrink-0">—</span>
                  Guidelines not regularly updated; limited insight into each
                  country's modifications
                </li>
              </ul>
            </div>
          </FadeIn>

          <FadeIn delay={0.1} direction="right">
            <div className="rounded-xl border border-teal/20 bg-ink2 p-7 h-full relative overflow-hidden">
              {/* <div className="absolute left-0 top-0 bottom-0 w-1 bg-teal" /> */}
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-teal/10 mb-5">
                <span className="text-[11px] font-mono text-teal-light font-medium">
                  V2 · Now
                </span>
              </div>
              <h3 className="font-display font-bold text-white text-xl mb-4">
                Complete, ready-to-deploy system
              </h3>
              <ul className="space-y-3 text-caption text-[15px]">
                <li className="flex items-start gap-2.5">
                  <span className="text-teal-light mt-1.5 shrink-0">+</span>
                  Modular design with extensions and plugins that can be shared
                  and customized
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-teal-light mt-1.5 shrink-0">+</span>
                  Community-driven standard — not ad hoc solutions with sharing
                  limitations
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-teal-light mt-1.5 shrink-0">+</span>
                  Platform-agnostic — can grow and adapt to new needs without
                  technology lock-in
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-teal-light mt-1.5 shrink-0">+</span>
                  Consistent tooling and processes across all deployments
                </li>
              </ul>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── 4. WHAT MINISTRIES GAIN ─────────────────────────── */

const BENEFITS = [
  {
    icon: BarChart3,
    color: "text-accent",
    bg: "bg-accent-bg",
    title: "Single trusted view",
    body: "See laboratory performance and disease trends across all facilities in one consolidated dashboard.",
  },
  {
    icon: FileCheck,
    color: "text-teal",
    bg: "bg-teal-bg",
    title: "Standardized reporting",
    body: "Meet donor requirements and international health regulations with 6 built-in report types including WHO GLASS compliance.",
  },
  {
    icon: Activity,
    color: "text-accent",
    bg: "bg-accent-bg",
    title: "Real-time dashboards",
    body: "Monitor lab workload, turnaround times, specimen distribution, and facility activity as data flows in.",
  },
  {
    icon: Shield,
    color: "text-teal",
    bg: "bg-teal-bg",
    title: "Data quality assurance",
    body: "Automated validation pipelines catch errors and inconsistencies before they reach reports and decision-makers.",
  },
  {
    icon: Globe,
    color: "text-accent",
    bg: "bg-accent-bg",
    title: "International standards",
    body: "Local codes automatically translated to LOINC, SNOMED CT, and ICD through Open Concept Lab (OCL) integration.",
  },
  {
    icon: Lock,
    color: "text-teal",
    bg: "bg-teal-bg",
    title: "Sovereignty & control",
    body: "Deploy on-premises or in a private cloud. Your data stays in your infrastructure. Apache 2.0 license means no vendor lock-in.",
  },
];

function WhatMinistriesGain() {
  return (
    <section
      id="benefits"
      className="py-28 px-6 lg:px-10 border-t border-border"
    >
      <div className="max-w-7xl mx-auto">
        <FadeIn>
          <div className="max-w-2xl mb-16">
            <span className="text-[11px] font-mono text-accent uppercase tracking-[0.2em] font-medium">
              What you gain
            </span>
            <h2 className="font-display font-bold text-[clamp(1.8rem,3.5vw,2.8rem)] text-heading leading-tight mt-3 mb-4">
              Turn routine lab results into{" "}
              <span className="text-caption">actionable intelligence</span>
            </h2>
            <p className="text-body text-lg">
              OpenLDR equips ministries with the tools to establish a single,
              trusted view of laboratory performance and disease trends.
            </p>
          </div>
        </FadeIn>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-10">
          {BENEFITS.map((b, i) => (
            <FadeIn key={b.title} delay={i * 0.06}>
              <div className="group">
                {/* <div
                  className={`w-11 h-11 rounded-xl ${b.bg} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}
                >
                  <b.icon className={`w-5 h-5 ${b.color}`} />
                </div> */}
                <h3 className="font-display font-semibold text-heading text-lg mb-2">
                  {b.title}
                </h3>
                <p className="text-body text-[15px] leading-relaxed">
                  {b.body}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── 5. PLATFORM CAPABILITIES ─────────────────────────── */

const CAPABILITIES = [
  {
    id: "ingestion",
    icon: FileInput,
    title: "Data Ingestion",
    description:
      "Accept data from any source in any format. APIs handle HL7 v2.x, FHIR (JSON and XML), CSV, TSV, JSON, JSONL, XML, SQLite databases, and PDF files. A secure web interface allows manual entry when automated feeds are not available.",
    highlights: [
      "HL7 v2.x pipe-delimited messages",
      "FHIR Bundles and DiagnosticReports",
      "CSV, TSV, JSON, JSONL, XML flat files",
      "SQLite database file import",
      "Manual web-based data entry",
    ],
  },
  {
    id: "pipeline",
    icon: Workflow,
    title: "Processing Pipeline",
    description:
      "Configurable data processing projects with four plugin stages. Apache Kafka enables real-time streaming while customizable plugins support schema validation and recipient-specific workflows.",
    highlights: [
      "Validation — data quality checks and format detection",
      "Mapping — field transformation and normalization",
      "Storage — persistence to OpenLDR database",
      "Outpost — push to external systems (FHIR, etc.)",
      "Kafka-powered real-time streaming",
    ],
  },
  {
    id: "terminology",
    icon: BookOpen,
    title: "Terminology Management",
    description:
      "Translate local laboratory codes into internationally recognized standards. Manage coding systems, concepts, and mappings with full OCL (Open Concept Lab) integration.",
    highlights: [
      "LOINC — laboratory test codes",
      "SNOMED CT — clinical terminology",
      "ICD — disease classification",
      "Custom coding system support",
      "Concept mapping and harmonization",
    ],
  },
  {
    id: "reports",
    icon: PieChart,
    title: "Reports & Analytics",
    description:
      "Six built-in report types aligned with international surveillance standards. Export to CSV, Excel, PDF, and plain text formats.",
    highlights: [
      "National Antibiogram — WHO GLASS compliance",
      "Priority Pathogens — WHO critical pathogen tracking",
      "MRSA & Carbapenem Surveillance — resistance mechanisms",
      "Workload & TAT — turnaround time analysis",
      "Geographic Distribution — spatial resistance patterns",
      "Data Quality Audit — completeness and ingestion metrics",
    ],
  },
  {
    id: "dashboards",
    icon: LayoutDashboard,
    title: "Dashboards",
    description:
      "Real-time monitoring across two dimensions: laboratory metrics for public health officials and infrastructure health for IT teams.",
    highlights: [
      "KPI grid — key performance indicators at a glance",
      "Specimen distribution and result flag analysis",
      "Test panel volume and facility activity tracking",
      "Service health grid and pipeline stage monitoring",
      "Storage and database status overview",
    ],
  },
  {
    id: "forms",
    icon: FormInput,
    title: "Forms & Data Entry",
    description:
      "Dynamic form builder with drag-and-drop fields, conditional visibility rules, and JSON schema validation. Multi-format bulk import for large datasets.",
    highlights: [
      "Drag-and-drop form builder",
      "Text, number, date, boolean, select, file fields",
      "Conditional visibility and required rules",
      "JSON schema validation",
      "Bulk import — CSV, JSON, ZIP, SQLite",
    ],
  },
];

function PlatformCapabilities() {
  const [active, setActive] = useState("ingestion");
  const current = CAPABILITIES.find((c) => c.id === active)!;

  return (
    <section
      id="platform"
      className="py-28 px-6 lg:px-10 border-t border-border"
    >
      <div className="max-w-7xl mx-auto">
        <FadeIn>
          <div className="max-w-2xl mb-16">
            <span className="text-[11px] font-mono text-accent uppercase tracking-[0.2em] font-medium">
              Platform capabilities
            </span>
            <h2 className="font-display font-bold text-[clamp(1.8rem,3.5vw,2.8rem)] text-heading leading-tight mt-3 mb-4">
              Everything a national lab system{" "}
              <span className="text-caption">needs</span>
            </h2>
            <p className="text-body text-lg">
              From data ingestion to WHO-compliant reporting — a complete
              platform for laboratory data management.
            </p>
          </div>
        </FadeIn>

        <FadeIn>
          <div className="grid lg:grid-cols-[280px_1fr] gap-6">
            {/* Left — tabs */}
            <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
              {CAPABILITIES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActive(c.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all whitespace-nowrap shrink-0 ${
                    active === c.id
                      ? "bg-white border border-border shadow-md shadow-black/3"
                      : "hover:bg-paper2"
                  }`}
                >
                  {/* <c.icon
                    className={`w-4.5 h-4.5 shrink-0 ${
                      active === c.id ? "text-accent" : "text-caption"
                    }`}
                  /> */}
                  <span
                    className={`text-[14px] font-display font-medium ${
                      active === c.id ? "text-heading" : "text-caption"
                    }`}
                  >
                    {c.title}
                  </span>
                  {active === c.id && (
                    <ChevronRight className="w-3.5 h-3.5 text-caption ml-auto hidden lg:block" />
                  )}
                </button>
              ))}
            </div>

            {/* Right — content */}
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="rounded-xl bg-white border border-border p-7 lg:p-9"
            >
              <div className="flex items-center gap-3 mb-5">
                {/* <div className="w-10 h-10 rounded-xl bg-accent-bg flex items-center justify-center">
                  <current.icon className="w-5 h-5 text-accent" />
                </div> */}
                <h3 className="font-display font-bold text-heading text-xl">
                  {current.title}
                </h3>
              </div>
              <p className="text-body text-[15px] leading-relaxed mb-6">
                {current.description}
              </p>
              <ul className="space-y-2.5">
                {current.highlights.map((h) => (
                  <li
                    key={h}
                    className="flex items-start gap-2.5 text-[14px] text-body"
                  >
                    <ChevronRight className="w-3.5 h-3.5 text-teal mt-1 shrink-0" />
                    {h}
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

/* ─────────────────────────── 6. ARCHITECTURE ─────────────────────────── */

const ARCH_LAYERS = [
  {
    label: "Data Sources",
    items: ["LIS / LIMS", "Facilities", "Manual Entry", "File Uploads"],
    color: "#E8601A",
  },
  {
    label: "Ingestion",
    items: ["HL7 v2.x", "FHIR", "CSV / JSON", "XML / SQLite"],
    color: "#E8601A",
  },
  {
    label: "Processing",
    items: ["Validation", "Mapping", "Storage", "Outpost"],
    color: "#0FA292",
  },
  {
    label: "Outputs",
    items: ["Dashboards", "Reports", "REST APIs", "Extensions"],
    color: "#0FA292",
  },
];

function Architecture() {
  return (
    <section id="architecture" className="py-28 px-6 lg:px-10 bg-ink noise">
      <div className="relative z-10 max-w-7xl mx-auto">
        <FadeIn>
          <div className="max-w-2xl mb-16">
            <span className="text-[11px] font-mono text-teal-light uppercase tracking-[0.2em] font-medium">
              Architecture
            </span>
            <h2 className="font-display font-bold text-[clamp(1.8rem,3.5vw,2.8rem)] text-white leading-tight mt-3 mb-4">
              A technical foundation{" "}
              <span className="text-[#6B7280]">for scale</span>
            </h2>
            <p className="text-caption text-lg">
              Designed to integrate with national digital health systems through
              FHIR-enabled APIs and align with global donor reporting
              requirements.
            </p>
          </div>
        </FadeIn>

        {/* Architecture flow */}
        <FadeIn>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
            {ARCH_LAYERS.map((layer, i) => (
              <div key={layer.label} className="relative">
                <div className="rounded-xl border border-ink-border bg-ink2 p-5 h-full">
                  <div
                    className="text-[11px] font-mono uppercase tracking-[0.15em] mb-4 font-medium"
                    style={{ color: layer.color }}
                  >
                    {layer.label}
                  </div>
                  <ul className="space-y-2">
                    {layer.items.map((item) => (
                      <li
                        key={item}
                        className="text-[13px] font-mono text-caption flex items-center gap-2"
                      >
                        <span
                          className="w-1 h-1 rounded-full shrink-0"
                          style={{ background: layer.color }}
                        />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                {/* Arrow between columns */}
                {i < ARCH_LAYERS.length - 1 && (
                  <div className="hidden lg:flex absolute -right-2.5 top-1/2 -translate-y-1/2 z-10">
                    <ChevronRight className="w-4 h-4 text-[#3D4A63]" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </FadeIn>

        {/* Infrastructure badges */}
        {/* <FadeIn delay={0.1}>
          <div className="rounded-xl border border-ink-border bg-ink2 p-6">
            <div className="text-[11px] font-mono text-[#6B7280] uppercase tracking-[0.15em] mb-5 font-medium">
              Infrastructure
            </div>
            <div className="flex flex-wrap gap-4">
              {INFRA_BADGES.map((b) => (
                <div
                  key={b.label}
                  className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg border border-ink-border bg-ink"
                >
                  <b.icon className="w-4 h-4 text-teal-light" />
                  <span className="text-[13px] font-mono text-caption">
                    {b.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </FadeIn> */}

        {/* Future readiness */}
        {/* <FadeIn delay={0.15}>
          <div className="mt-8 rounded-xl border border-teal/15 bg-teal/5 p-6">
            <h3 className="font-display font-semibold text-white text-base mb-2">
              Future readiness
            </h3>
            <p className="text-caption text-[15px] leading-relaxed">
              As the platform grows, it can integrate with national digital
              health stacks through FHIR-enabled APIs — ensuring laboratory data
              flows seamlessly into broader health information systems. OpenLDR
              will also evolve with AI-assisted plugins and predictive analytics
              to help countries anticipate outbreaks and manage resources more
              effectively.
            </p>
          </div>
        </FadeIn> */}
      </div>
    </section>
  );
}

/* ─────────────────────────── 7. EXTENSIBILITY ─────────────────────────── */

function Extensibility() {
  return (
    <section className="py-20 px-6 lg:px-10 border-t border-border">
      <div className="max-w-7xl mx-auto">
        <FadeIn>
          <div className="rounded-xl bg-white border border-border p-8 lg:p-10 grid lg:grid-cols-[1fr,auto] gap-8 items-center">
            <div>
              <div className="flex items-center gap-3 mb-4">
                {/* <div className="w-10 h-10 rounded-xl bg-accent-bg flex items-center justify-center">
                  <Puzzle className="w-5 h-5 text-accent" />
                </div> */}
                <h2 className="font-display font-bold text-heading text-xl">
                  Built to extend
                </h2>
              </div>
              <p className="text-body text-[15px] leading-relaxed mb-5 max-w-2xl">
                OpenLDR supports custom plugins across four pipeline stages —
                validation, mapping, storage, and outpost — letting you adapt
                data processing to country-specific needs. Iframe and worker
                extensions add custom dashboards and background processing
                capabilities.
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  "Validation plugins",
                  "Mapping plugins",
                  "Storage plugins",
                  "Outpost plugins",
                  "Iframe extensions",
                  "Worker extensions",
                ].map((tag) => (
                  <span
                    key={tag}
                    className="text-[11px] font-mono px-2.5 py-1 rounded-full border border-border bg-paper text-caption"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 border border-border-dark text-body font-display font-medium text-[14px] rounded-lg hover:border-heading hover:text-heading transition-all whitespace-nowrap"
              >
                <Plug className="w-4 h-4" /> Developer docs
              </a>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

/* ─────────────────────────── SCREENSHOT GALLERY ─────────────────────────── */

const SCREENSHOTS = [
  { src: "screenshots/Projects.png", label: "Projects & Pipelines" },
  { src: "screenshots/FormBuilder.png", label: "Form Builder" },
  { src: "screenshots/Concepts.png", label: "Terminology Management" },
  { src: "screenshots/DataEntry.png", label: "Data Entry" },
  { src: "screenshots/Extensions.png", label: "Extensions" },
  { src: "screenshots/Pipelines.png", label: "Pipeline Runs" },
];

function ScreenshotGallery() {
  const [active, setActive] = useState<number | null>(null);

  return (
    <section id="gallery" className="py-28 px-6 lg:px-10 border-t border-border bg-paper2">
      <div className="max-w-7xl mx-auto">
        <FadeIn>
          <div className="max-w-2xl mb-14">
            <span className="text-[11px] font-mono text-accent uppercase tracking-[0.2em] font-medium">
              See it in action
            </span>
            <h2 className="font-display font-bold text-[clamp(1.8rem,3.5vw,2.8rem)] text-heading leading-tight mt-3 mb-4">
              Built for the people who{" "}
              <span className="text-caption">use it every day</span>
            </h2>
          </div>
        </FadeIn>

        {/* Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {SCREENSHOTS.map((s, i) => (
            <FadeIn key={s.label} delay={i * 0.06}>
              <button
                onClick={() => setActive(active === i ? null : i)}
                className="group rounded-xl overflow-hidden border border-border bg-white shadow-sm hover:shadow-lg hover:shadow-black/5 transition-all duration-300 text-left w-full"
              >
                {/* Image cropped to 16:9 */}
                <div className="aspect-video overflow-hidden bg-ink">
                  <img
                    src={`${BASE}${s.src}`}
                    alt={s.label}
                    className="w-full block group-hover:scale-[1.02] transition-transform duration-500"
                    loading="lazy"
                  />
                </div>
                {/* Label */}
                <div className="px-4 py-3">
                  <span className="text-[13px] font-display font-medium text-heading">
                    {s.label}
                  </span>
                </div>
              </button>
            </FadeIn>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {active !== null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 lg:p-10 cursor-pointer"
          onClick={() => setActive(null)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="relative max-w-6xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setActive(null)}
              className="absolute -top-10 right-0 text-white/70 hover:text-white text-[13px] font-mono transition-colors"
            >
              Close
            </button>
            <div className="rounded-xl overflow-hidden border border-white/10 shadow-2xl">
              <img
                src={`${BASE}${SCREENSHOTS[active].src}`}
                alt={SCREENSHOTS[active].label}
                className="w-full block"
              />
            </div>
            <p className="text-center text-white/60 text-[13px] font-mono mt-4">
              {SCREENSHOTS[active].label}
            </p>
          </motion.div>
        </motion.div>
      )}
    </section>
  );
}

/* ─────────────────────────── 9. FOOTER ─────────────────────────── */

function Footer() {
  return (
    <footer className="border-t border-border px-6 lg:px-10 py-10 bg-paper2">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <span className="text-caption text-[12px] font-mono">
            An APHL initiative · Apache 2.0 License
          </span>
        </div>

        <div className="flex items-center gap-6">
          {[
            { label: "Challenge", href: "#challenge" },
            { label: "Platform", href: "#platform" },
            { label: "Architecture", href: "#architecture" },
            { label: "Gallery", href: "#gallery" },
          ].map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="text-caption hover:text-heading text-[12px] font-mono transition-colors"
            >
              {l.label}
            </a>
          ))}
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="text-caption hover:text-heading text-[12px] font-mono transition-colors"
          >
            GitHub
          </a>
          <a
            href="https://www.aphl.org"
            target="_blank"
            rel="noreferrer"
            className="text-caption hover:text-heading text-[12px] font-mono transition-colors"
          >
            APHL
          </a>
        </div>
      </div>
      <div className="max-w-7xl mx-auto mt-6 pt-5 border-t border-border">
        <p className="text-[11px] font-mono text-ghost text-center">
          © {new Date().getFullYear()} Association of Public Health Laboratories
          (APHL). All rights reserved.
        </p>
      </div>
    </footer>
  );
}

/* ─────────────────────────── APP ─────────────────────────── */

export default function App() {
  return (
    <div className="min-h-screen bg-paper">
      <Nav />
      <Hero />
      <ChallengeAndV2 />
      <WhatMinistriesGain />
      <PlatformCapabilities />
      <Architecture />
      <Extensibility />
      <ScreenshotGallery />
      <Footer />
    </div>
  );
}
