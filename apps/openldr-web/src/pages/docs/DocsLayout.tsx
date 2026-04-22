import { NavLink, Outlet, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Rocket,
  Code2,
  History,
  GitBranch,
  ArrowLeft,
  Sun,
  Moon,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL;
const GITHUB_URL =
  import.meta.env.VITE_GITHUB_URL || "https://github.com/APHL-Global-Health/openldr";

const NAV_ITEMS = [
  { to: "/docs/getting-started", label: "Getting Started", icon: Rocket },
  { to: "/docs/api", label: "API Reference", icon: Code2 },
  { to: "/docs/changelog", label: "Changelog", icon: History },
];

function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => {
    const root = document.documentElement;
    if (dark) root.classList.add("dark"); else root.classList.remove("dark");
    localStorage.setItem("openldr-theme", dark ? "dark" : "light");
  }, [dark]);
  return { dark, toggle: () => setDark((d) => !d) };
}

export default function DocsLayout() {
  const { dark, toggle } = useTheme();
  return (
    <div className="min-h-screen bg-paper">
      {/* Top bar */}
      <header className="sticky top-0 z-50 bg-paper/95 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2.5 group">
              <img
                src={`${BASE}OpenODRv2Logo.png`}
                alt="OpenLDR"
                className="h-7"
              />
            </Link>
            <span className="text-border-dark">/</span>
            <span className="text-[13px] font-display font-semibold text-heading">
              Documentation
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="flex items-center gap-1.5 text-[13px] font-mono text-caption hover:text-heading transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Home
            </Link>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-[13px] font-mono text-caption hover:text-heading transition-colors"
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
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-10">
        <div className="grid lg:grid-cols-[220px_1fr] gap-10">
          {/* Sidebar */}
          <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 lg:sticky lg:top-24 lg:self-start">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-display font-medium transition-all whitespace-nowrap shrink-0 ${
                    isActive
                      ? "bg-white border border-border shadow-sm text-heading"
                      : "text-caption hover:text-heading hover:bg-paper2"
                  }`
                }
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Content */}
          <main className="min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
