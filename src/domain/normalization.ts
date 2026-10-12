/**
 * Canonical Normalization & Hashing Module
 * Implements Section 8.5.1 and IMP-001..IMP-016 of FCA-SRS-001
 */

/**
 * Executes the exact 7-step canonical normalization pipeline:
 * 1. Decode as valid UTF-8 and reject invalid encoding (handled by parser).
 * 2. Remove one leading Unicode byte-order mark from the first field when present.
 * 3. Convert CRLF and CR line endings to LF.
 * 4. Normalize Unicode to NFC.
 * 5. Convert each run of spaces or tabs to one ASCII space while preserving LF characters.
 * 6. Remove whitespace at the start and end of the complete field and on each side of each LF.
 * 7. Preserve letter case and punctuation.
 */
export function canonicalNormalize(text: string, isFirstField: boolean = false): string {
  if (text === null || text === undefined) {
    return '';
  }

  let s = text;

  // Step 2: Remove one leading Unicode BOM if present
  if (isFirstField && s.charCodeAt(0) === 0xfeff) {
    s = s.slice(1);
  }

  // Step 3: Convert CRLF and CR line endings to LF
  s = s.replace(/\r\n|\r/g, '\n');

  // Step 4: Normalize Unicode to NFC
  s = s.normalize('NFC');

  // Step 5: Convert each run of spaces or tabs to one ASCII space while preserving LF characters
  // Split by line to handle tabs/spaces per line
  const lines = s.split('\n');
  const processedLines = lines.map(line => {
    // Replace runs of horizontal whitespace (space, tab) with a single space
    const collapsed = line.replace(/[ \t]+/g, ' ');
    // Step 6: Remove whitespace on each side of LF (i.e. start/end of line)
    return collapsed.replace(/^[ \t]+|[ \t]+$/g, '');
  });

  // Re-join with LF
  s = processedLines.join('\n');

  // Step 6 (cont): Remove whitespace at the start and end of the complete field
  s = s.replace(/^[ \t\n]+|[ \t\n]+$/g, '');

  // Step 7: Preserve letter case and punctuation (already preserved)
  return s;
}

/**
 * Computes SHA-256 content hash over:
 * UTF-8 bytes of normalized_question + ASCII unit-separator byte (0x1F) + UTF-8 bytes of normalized_answer
 */
export async function computeContentHash(normalizedQuestion: string, normalizedAnswer: string): Promise<string> {
  const separator = '\x1F';
  const combined = `${normalizedQuestion}${separator}${normalizedAnswer}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(combined);

  const cryptoObj = globalThis.crypto;
  if (cryptoObj && cryptoObj.subtle) {
    const hashBuffer = await cryptoObj.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  throw new Error('Web Cryptography API (crypto.subtle) is not available');
}
