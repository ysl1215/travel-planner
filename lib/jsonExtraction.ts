export type JsonOpening = "{" | "[";

export function extractJsonByFirstBracket(text: string, startChar: JsonOpening): string | null {
  const opening = startChar;
  const closing = startChar === "{" ? "}" : "]";
  const startIndex = text.indexOf(opening);
  if (startIndex === -1) return null;

  let depth = 0;
  let inString = false;
  for (let i = startIndex; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' && text[i - 1] !== "\\") inString = !inString;
    if (inString) continue;
    if (ch === opening) depth++;
    else if (ch === closing) {
      depth--;
      if (depth === 0) return text.slice(startIndex, i + 1);
    }
  }

  return null;
}

export function sanitizeJsonTrailingCommas(text: string): string {
  return text.replace(/,\s*(?=[}\]]|$)/g, "");
}

export function computeMissingClosers(text: string): string {
  const stack: string[] = [];
  let inString = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' && text[i - 1] !== "\\") inString = !inString;
    if (inString) continue;
    if (ch === "{" || ch === "[") stack.push(ch);
    else if (ch === "}" || ch === "]") {
      const top = stack[stack.length - 1];
      if ((ch === "}" && top === "{") || (ch === "]" && top === "[")) stack.pop();
    }
  }

  let closers = "";
  while (stack.length) {
    const opener = stack.pop();
    if (opener === "{") closers += "}";
    else if (opener === "[") closers += "]";
  }

  return closers;
}

export function sanitizeRepair(text: string): string {
  const sanitized = sanitizeJsonTrailingCommas(text);
  const closers = computeMissingClosers(sanitized);
  return closers ? sanitized + closers : sanitized;
}

export function extractJsonCandidate(text: string): string | null {
  return (
    extractJsonByFirstBracket(text, "[") ??
    extractJsonByFirstBracket(text, "{") ??
    text.match(/\[[\s\S]*\]/)?.[0] ??
    text.match(/\{[\s\S]*\}/)?.[0] ??
    null
  );
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function extractCandidateItems(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) return [];

  for (const key of ["destinations", "suggestions", "results", "items", "data"]) {
    const nested = value[key];
    if (Array.isArray(nested)) return nested;
  }

  return [value];
}
