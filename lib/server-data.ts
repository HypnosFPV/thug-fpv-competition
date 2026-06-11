import 'server-only';

import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/server-supabase';
import type { CompetitionStatus, EntryRecord, JudgeSlot, ScoreRecord } from '@/lib/types';

export interface CompetitionRecord {
  id: string;
  name: string;
  slug: string;
  status: CompetitionStatus;
  shared_event_password: string;
  notification_email: string | null;
  backup_notification_email: string | null;
  email_notifications_enabled: boolean;
  current_playback_entry_id: string | null;
  tie_break_method: string;
  max_video_seconds: number | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface ActiveCompetitionBundle {
  configured: boolean;
  competition: CompetitionRecord | null;
  judgeSlots: JudgeSlot[];
  entries: EntryRecord[];
  scores: ScoreRecord[];
}

function mapJudgeSlot(row: any): JudgeSlot {
  return {
    id: row.id,
    code: row.code,
    pin: row.pin,
    label: row.label,
    isActive: row.is_active
  };
}

function mapEntry(row: any): EntryRecord {
  return {
    id: row.id,
    entrantName: row.entrant_name,
    entrantEmail: row.entrant_email,
    title: row.title,
    youtubeUrl: row.youtube_url,
    youtubeVideoId: row.youtube_video_id,
    notes: row.notes,
    moderationStatus: row.moderation_status,
    runningOrder: row.running_order,
    statusToken: row.status_token ?? null,
    moderationNotes: row.moderation_notes ?? null,
    userId: row.user_id ?? null
  };
}

function mapScore(row: any): ScoreRecord {
  return {
    id: row.id,
    entryId: row.entry_id,
    judgeSlotId: row.judge_slot_id,
    score: Number(row.score),
    updatedAt: row.updated_at
  };
}

export async function getActiveCompetitionBundle(): Promise<ActiveCompetitionBundle> {
  if (!isSupabaseConfigured()) {
    return { configured: false, competition: null, judgeSlots: [], entries: [], scores: [] };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { configured: false, competition: null, judgeSlots: [], entries: [], scores: [] };
  }

  const { data: competition } = await supabase
    .from('competitions')
    .select('*')
    .neq('status', 'Archived')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!competition) {
    return { configured: true, competition: null, judgeSlots: [], entries: [], scores: [] };
  }

  const competitionRecord = competition as CompetitionRecord;

  const [{ data: judgeSlots }, { data: entries }, { data: scores }] = await Promise.all([
    supabase.from('judge_slots').select('*').eq('competition_id', competitionRecord.id).order('label'),
    supabase.from('entries').select('*').eq('competition_id', competitionRecord.id).order('running_order', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true }),
    supabase.from('scores').select('*').eq('competition_id', competitionRecord.id).order('updated_at', { ascending: false })
  ]);

  return {
    configured: true,
    competition: competitionRecord,
    judgeSlots: (judgeSlots ?? []).map(mapJudgeSlot),
    entries: (entries ?? []).map(mapEntry),
    scores: (scores ?? []).map(mapScore)
  };
}

export function getApprovedEntries(entries: EntryRecord[]) {
  return entries.filter((entry) => entry.moderationStatus === 'Approved');
}

export function getPendingEntries(entries: EntryRecord[]) {
  return entries.filter((entry) => entry.moderationStatus !== 'Approved');
}

export function getCurrentPlaybackEntry(bundle: ActiveCompetitionBundle) {
  const approved = getApprovedEntries(bundle.entries);
  if (!bundle.competition) return null;
  return approved.find((entry) => entry.id === bundle.competition?.current_playback_entry_id) ?? approved[0] ?? null;
}

export function getEntryAverage(entryId: string, scores: ScoreRecord[]) {
  const entryScores = scores.filter((score) => score.entryId === entryId);
  if (!entryScores.length) return null;
  const total = entryScores.reduce((sum, score) => sum + score.score, 0);
  return total / entryScores.length;
}

export function getLeaderboard(entries: EntryRecord[], scores: ScoreRecord[]) {
  return getApprovedEntries(entries)
    .map((entry) => ({
      entry,
      average: getEntryAverage(entry.id, scores),
      totalScores: scores.filter((score) => score.entryId === entry.id).length
    }))
    .sort((a, b) => {
      const avgA = a.average ?? -1;
      const avgB = b.average ?? -1;
      if (avgA !== avgB) return avgB - avgA;
      return (a.entry.runningOrder ?? 9999) - (b.entry.runningOrder ?? 9999);
    });
}
