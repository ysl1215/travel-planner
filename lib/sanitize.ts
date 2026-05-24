/**
 * Sanitizes user-provided text before injection into AI prompts.
 * Strips characters and patterns that could be used for prompt injection.
 */

// Patterns that look like prompt injection attempts
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/gi,
  /you\s+are\s+now\s+a/gi,
  /system\s*:\s*/gi,
  /\[INST\]/gi,
  /<<SYS>>/gi,
  /<\|im_start\|>/gi,
  /```\s*(system|assistant)/gi,
];

/**
 * Sanitize a single user input string for safe prompt injection.
 * - Strips control characters
 * - Removes known injection patterns
 * - Caps length to prevent context stuffing
 */
export function sanitize(input: string, maxLength = 500): string {
  let s = input
    // Remove control characters except newline/tab
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    // Collapse excessive whitespace
    .replace(/\s{10,}/g, " ")
    .trim();

  // Strip injection patterns
  for (const pattern of INJECTION_PATTERNS) {
    s = s.replace(pattern, "");
  }

  return s.slice(0, maxLength);
}

/**
 * Sanitize an array of user input strings.
 */
export function sanitizeArray(inputs: string[], maxPerItem = 100): string[] {
  return inputs.map((s) => sanitize(s, maxPerItem));
}
