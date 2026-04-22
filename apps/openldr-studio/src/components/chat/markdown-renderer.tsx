import React, { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import { CopyIcon, CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? (
        <>
          <CheckIcon className="size-3.5" />
          <span>Copied</span>
        </>
      ) : (
        <>
          <CopyIcon className="size-3.5" />
          <span>Copy</span>
        </>
      )}
    </button>
  );
}

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer = React.memo(function MarkdownRenderer({
  content,
}: MarkdownRendererProps) {
  return (
    <div className="text-sm leading-relaxed space-y-3 [&>*:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          // ── Block-level ───────────────────────────────────────
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,

          h1: ({ children }) => (
            <h1 className="text-lg font-semibold mt-4 mb-2">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-semibold mt-3 mb-2">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-semibold mt-3 mb-1">{children}</h3>
          ),

          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-border pl-3 text-muted-foreground italic">
              {children}
            </blockquote>
          ),

          // ── Lists ─────────────────────────────────────────────
          ul: ({ children }) => (
            <ul className="list-disc pl-5 space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 space-y-1">{children}</ol>
          ),
          li: ({ children }) => <li>{children}</li>,

          // ── Links ─────────────────────────────────────────────
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:text-primary/80"
            >
              {children}
            </a>
          ),

          // ── Horizontal rule ───────────────────────────────────
          hr: () => <hr className="border-border my-3" />,

          // ── Tables (shadcn/ui) ────────────────────────────────
          table: ({ children }) => <Table>{children}</Table>,
          thead: ({ children }) => <TableHeader>{children}</TableHeader>,
          tbody: ({ children }) => <TableBody>{children}</TableBody>,
          tr: ({ children }) => <TableRow>{children}</TableRow>,
          th: ({ children }) => <TableHead>{children}</TableHead>,
          td: ({ children }) => <TableCell>{children}</TableCell>,

          // ── Code ──────────────────────────────────────────────
          pre: ({ children }) => <>{children}</>,

          code: ({ className, children, ...props }) => {
            const isBlock = typeof className === "string" && className.startsWith("hljs");
            // Also detect fenced blocks that rehype-highlight wraps in <pre><code class="hljs ...">
            const codeString = String(children).replace(/\n$/, "");

            if (isBlock) {
              const lang = className
                ?.replace("hljs ", "")
                ?.replace("language-", "")
                || "";
              return (
                <div className="rounded-md border border-border overflow-hidden my-2">
                  <div className="flex items-center justify-between px-3 py-1.5 bg-muted/60 border-b border-border">
                    <span className="text-xs text-muted-foreground font-mono">
                      {lang || "code"}
                    </span>
                    <CopyButton text={codeString} />
                  </div>
                  <pre className="overflow-x-auto p-3 bg-[#0d1117]">
                    <code
                      className={cn("text-xs font-mono", className)}
                      {...props}
                    >
                      {children}
                    </code>
                  </pre>
                </div>
              );
            }

            // Inline code
            return (
              <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
