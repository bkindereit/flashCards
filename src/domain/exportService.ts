/**
 * User-Owned Data Export Service
 * Implements REL-005
 */

import { supabase } from '@/lib/supabase';
import { FSRS_PACKAGE_VERSION, FSRS_PARAMETER_SET_VERSION, SCHEDULING_POLICY_VERSION } from './fsrsService';

export interface UserDataExport {
  exportVersion: '1.0';
  exportedAt: string;
  userId: string;
  algorithm: {
    name: 'FSRS';
    packageVersion: string;
    parameterSetVersion: string;
    policyVersion: string;
  };
  decks: unknown[];
  cards: unknown[];
  importBatches: unknown[];
  studySessions: unknown[];
  reviewEvents: unknown[];
}

export async function exportAllUserData(): Promise<UserDataExport> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User must be authenticated to export data');
  }

  const [decksRes, cardsRes, importsRes, sessionsRes, reviewsRes] = await Promise.all([
    supabase.from('decks').select('*'),
    supabase.from('cards').select('*'),
    supabase.from('import_batches').select('*'),
    supabase.from('study_sessions').select('*'),
    supabase.from('review_events').select('*')
  ]);

  if (decksRes.error) throw decksRes.error;
  if (cardsRes.error) throw cardsRes.error;
  if (importsRes.error) throw importsRes.error;
  if (sessionsRes.error) throw sessionsRes.error;
  if (reviewsRes.error) throw reviewsRes.error;

  return {
    exportVersion: '1.0',
    exportedAt: new Date().toISOString(),
    userId: user.id,
    algorithm: {
      name: 'FSRS',
      packageVersion: FSRS_PACKAGE_VERSION,
      parameterSetVersion: FSRS_PARAMETER_SET_VERSION,
      policyVersion: SCHEDULING_POLICY_VERSION
    },
    decks: decksRes.data || [],
    cards: cardsRes.data || [],
    importBatches: importsRes.data || [],
    studySessions: sessionsRes.data || [],
    reviewEvents: reviewsRes.data || []
  };
}

export function triggerJsonDownload(data: UserDataExport, filename: string = 'flashcards_export.json') {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
