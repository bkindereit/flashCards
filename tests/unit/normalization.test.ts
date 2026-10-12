import { describe, it, expect, vi } from 'vitest';
import { canonicalNormalize, computeContentHash } from '@/domain/normalization';

describe('Canonical Normalization (Section 8.5.1, IMP-001..IMP-016)', () => {
  it('Step 2: removes leading UTF-8 BOM only from the first field', () => {
    const withBom = '\uFEFFQuestion text';
    expect(canonicalNormalize(withBom, true)).toBe('Question text');
    // If not first field, does not treat as BOM
    expect(canonicalNormalize(withBom, false)).toBe('\uFEFFQuestion text');
  });

  it('Step 3: converts CRLF and CR to LF', () => {
    const input = 'Line 1\r\nLine 2\rLine 3';
    expect(canonicalNormalize(input)).toBe('Line 1\nLine 2\nLine 3');
  });

  it('Step 4: normalizes Unicode to NFC', () => {
    // 'e' + combining acute accent (\u0301) vs 'é' (\u00E9)
    const decomposed = 'e\u0301cole';
    const composed = '\u00E9cole';
    expect(canonicalNormalize(decomposed)).toBe(composed);
  });

  it('Step 5 & 6: collapses tabs and multiple spaces to single space and trims around LF', () => {
    const input = '  Word1 \t  Word2   \n   Line2 \t  Word3  ';
    expect(canonicalNormalize(input)).toBe('Word1 Word2\nLine2 Word3');
  });

  it('Step 7: preserves letter case and punctuation', () => {
    const input = 'What is React.js?';
    expect(canonicalNormalize(input)).toBe('What is React.js?');
  });

  it('computeContentHash: produces deterministic SHA-256 with 0x1F unit separator', async () => {
    const q = 'Capital of France?';
    const a = 'Paris';
    const hash1 = await computeContentHash(q, a);
    const hash2 = await computeContentHash(q, a);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 hex string

    // Case difference produces different hash (case is preserved)
    const hashCase = await computeContentHash(q, 'paris');
    expect(hashCase).not.toBe(hash1);
  });

  it('canonicalNormalize handles null or undefined safely', () => {
    expect(canonicalNormalize(null as any)).toBe('');
    expect(canonicalNormalize(undefined as any)).toBe('');
  });

  it('computeContentHash throws error when Web Crypto API is unavailable', async () => {
    const spy = vi.spyOn(globalThis.crypto, 'subtle', 'get').mockReturnValue(undefined as any);
    try {
      await expect(computeContentHash('Q', 'A')).rejects.toThrow('Web Cryptography API (crypto.subtle) is not available');
    } finally {
      spy.mockRestore();
    }
  });
});
