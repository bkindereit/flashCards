/**
 * Supabase Client Initialization Tests
 * Tests src/lib/supabase.ts to achieve full module coverage
 */

import { describe, it, expect } from 'vitest';
import { supabase } from '@/lib/supabase';

describe('Supabase Client (src/lib/supabase.ts)', () => {
  it('exports an initialized supabase client with auth and data query methods', () => {
    expect(supabase).toBeDefined();
    expect(supabase.auth).toBeDefined();
    expect(typeof supabase.from).toBe('function');
    expect(typeof supabase.rpc).toBe('function');
  });
});
