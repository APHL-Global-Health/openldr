/**
 * Parses assistant message content into structured segments.
 *
 * The local LLM sometimes emits raw tool-call JSON blocks and error text
 * inline in its response. This parser extracts those into typed segments
 * so the UI can render them with purpose-built components instead of raw text.
 */

export type ContentSegment =
  | { type: "text"; value: string }
  | { type: "tool_call"; tool: string; args: Record<string, unknown>; raw: string }
  | { type: "error"; message: string };

// Matches fenced JSON code blocks containing a "tool" key
const FENCED_TOOL_RE =
  /```json\s*\n?\s*\{\s*"tool"\s*:\s*"([^"]+)"\s*,\s*"args"\s*:\s*(\{[^}]*\})\s*\}\s*\n?```/g;

// Matches inline (unfenced) tool-call JSON like: {"tool": "...", "args": {...}}
const INLINE_TOOL_RE =
  /(?:^|\n)\s*\{\s*"tool"\s*:\s*"([^"]+)"\s*,\s*"args"\s*:\s*(\{[^}]*\})\s*\}/g;

// Matches error lines like "Error: ..." or "**Error:** ..."
const ERROR_LINE_RE = /(?:^|\n)\s*\*{0,2}Error:\*{0,2}\s*(.+)/gi;

export function parseMessageContent(content: string): ContentSegment[] {
  if (!content) return [];

  const segments: ContentSegment[] = [];
  const replacements: { start: number; end: number; segment: ContentSegment }[] = [];

  // Collect fenced tool calls
  let match: RegExpExecArray | null;
  FENCED_TOOL_RE.lastIndex = 0;
  while ((match = FENCED_TOOL_RE.exec(content)) !== null) {
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(match[2]);
    } catch {
      /* keep empty */
    }
    replacements.push({
      start: match.index,
      end: match.index + match[0].length,
      segment: { type: "tool_call", tool: match[1], args, raw: match[0] },
    });
  }

  // Collect inline tool calls (only if not already inside a fenced block)
  INLINE_TOOL_RE.lastIndex = 0;
  while ((match = INLINE_TOOL_RE.exec(content)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    const overlaps = replacements.some(
      (r) => start < r.end && end > r.start,
    );
    if (overlaps) continue;

    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(match[2]);
    } catch {
      /* keep empty */
    }
    replacements.push({
      start,
      end,
      segment: { type: "tool_call", tool: match[1], args, raw: match[0] },
    });
  }

  // Sort by position
  replacements.sort((a, b) => a.start - b.start);

  // Build segments from the gaps and replacements
  let cursor = 0;
  for (const r of replacements) {
    if (r.start > cursor) {
      const text = content.slice(cursor, r.start);
      if (text.trim()) segments.push({ type: "text", value: text });
    }
    segments.push(r.segment);
    cursor = r.end;
  }
  if (cursor < content.length) {
    const text = content.slice(cursor);
    if (text.trim()) segments.push({ type: "text", value: text });
  }

  // If no tool calls were found, return the whole thing as a single text segment
  if (replacements.length === 0) {
    return [{ type: "text", value: content }];
  }

  // Post-process: pull error lines out of text segments
  const finalSegments: ContentSegment[] = [];
  for (const seg of segments) {
    if (seg.type !== "text") {
      finalSegments.push(seg);
      continue;
    }

    // Check for error lines in the text
    ERROR_LINE_RE.lastIndex = 0;
    const errors: { start: number; end: number; message: string }[] = [];
    let errMatch: RegExpExecArray | null;
    while ((errMatch = ERROR_LINE_RE.exec(seg.value)) !== null) {
      errors.push({
        start: errMatch.index,
        end: errMatch.index + errMatch[0].length,
        message: errMatch[1].trim(),
      });
    }

    if (errors.length === 0) {
      finalSegments.push(seg);
      continue;
    }

    // Split text around error lines, deduplicating errors with same message
    let textCursor = 0;
    const seenErrors = new Set<string>();
    for (const err of errors) {
      if (seenErrors.has(err.message)) {
        // Skip duplicate error, but still consume the text range
        textCursor = Math.max(textCursor, err.end);
        continue;
      }
      if (err.start > textCursor) {
        const before = seg.value.slice(textCursor, err.start);
        if (before.trim()) finalSegments.push({ type: "text", value: before });
      }
      seenErrors.add(err.message);
      finalSegments.push({ type: "error", message: err.message });
      textCursor = err.end;
    }
    if (textCursor < seg.value.length) {
      const after = seg.value.slice(textCursor);
      if (after.trim()) finalSegments.push({ type: "text", value: after });
    }
  }

  return finalSegments;
}
