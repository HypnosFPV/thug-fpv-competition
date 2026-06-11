'use server';

import crypto from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { extractYouTubeId, verifyYouTubeEmbeddable } from '@/lib/youtube';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { clearAdminSession, clearJudgeSession, getJudgeSession, isAdminAuthenticated, setAdminSession, setJudgeSession } from '@/lib/session';
import { getActiveCompetitionBundle, getApprovedEntries, getCurrentPlaybackEntry, getLeaderboard } from '@/lib/server-data';
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/server-supabase';
import type { CompetitionStatus } from '@/lib/types';

const judgeSlotLabels = ['Judge 1', 'Judge 2', 'Judge 3', 'Judge 4', 'Judge 5'];

function routeWithMessage(route: string, type: 'error' | 'success', message: string) {
  return `${route}?${type}=${encodeURIComponent(message)}`;
}

function requireSupabaseOrRedirect(route: string) {
  if (!isSupabaseConfigured()) {
    redirect(routeWithMessage(route, 'error', 'Supabase environment variables are not configured yet.'));
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    redirect(routeWithMessage(route, 'error', 'Supabase admin client could not be created.'));
  }

  return supabase;
}

async function requireAdmin(route = '/admin') {
  const isAdmin = await isAdminAuthenticated();
  if (!isAdmin) {
    redirect(routeWithMessage(route, 'error', 'Admin login required.'));
  }
}

async function logAudit(action: string, targetTable: string, payload: Record<string, unknown>, competitionId?: string | null) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  await supabase.from('audit_logs').insert({
    competition_id: competitionId ?? null,
    action,
    target_table: targetTable,
    payload
  });
}

function generatePin() {
  return `${crypto.randomInt(0, 10000)}`.padStart(4, '0');
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 48);
}

async function createCompetitionWithJudges(params: { name: string; password: string }) {
  const supabase = requireSupabaseOrRedirect('/admin');
  const slug = `${slugify(params.name) || 'competition'}-${Date.now().toString().slice(-6)}`;

  const { data: competition, error } = await supabase
    .from('competitions')
    .insert({
      name: params.name,
      slug,
      status: 'Draft',
      shared_event_password: params.password
    })
    .select('*')
    .single();

  if (error || !competition) {
    redirect(routeWithMessage('/admin', 'error', 'Unable to create the competition.'));
  }

  await supabase.from('judge_slots').insert(
    judgeSlotLabels.map((label, index) => ({
      competition_id: competition.id,
      code: `J${index + 1}`,
      pin: generatePin(),
      label,
      is_active: true
    }))
  );

  await logAudit('competition_created', 'competitions', { name: params.name }, competition.id);
  return competition.id as string;
}

export async function createInitialCompetitionAction(formData: FormData) {
  await requireAdmin();
  const name = `${formData.get('name') || ''}`.trim();
  const password = `${formData.get('sharedEventPassword') || ''}`.trim();

  if (!name || !password) {
    redirect(routeWithMessage('/admin', 'error', 'Competition name and shared event password are required.'));
  }

  await createCompetitionWithJudges({ name, password });
  revalidatePath('/');
  revalidatePath('/submit');
  revalidatePath('/judge');
  revalidatePath('/admin');
  redirect(routeWithMessage('/admin', 'success', 'Competition created with 5 fresh judge codes and PINs.'));
}

export async function submitEntryAction(formData: FormData) {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect('/login?next=/submit');
  }

  const competitionId = `${formData.get('competitionId') || ''}`.trim();
  const entrantName = `${formData.get('entrantName') || ''}`.trim();
  const title = `${formData.get('title') || ''}`.trim();
  const youtubeUrl = `${formData.get('youtubeUrl') || ''}`.trim();
  const notes = `${formData.get('notes') || ''}`.trim();
  const consent = formData.get('consent');
  const entrantEmail = user.email ?? '';

  if (!competitionId) {
    redirect(routeWithMessage('/submit', 'error', 'No active competition is available for submissions.'));
  }

  if (!entrantName || !title || !youtubeUrl || !consent) {
    redirect(routeWithMessage('/submit', 'error', 'Please complete all required fields and confirm consent.'));
  }

  const videoId = extractYouTubeId(youtubeUrl);
  if (!videoId) {
    redirect(routeWithMessage('/submit', 'error', 'Please provide a valid YouTube URL.'));
  }

  const supabase = requireSupabaseOrRedirect('/submit');

  const { data: competition } = await supabase
    .from('competitions')
    .select('id, status, max_video_seconds')
    .eq('id', competitionId)
    .maybeSingle<{ id: string; status: string; max_video_seconds: number | null }>();

  if (!competition || competition.status !== 'Submissions Open') {
    redirect(routeWithMessage('/submit', 'error', 'Submissions are not open right now.'));
  }

  const embedCheck = await verifyYouTubeEmbeddable(videoId, { maxSeconds: competition.max_video_seconds });
  if (!embedCheck.ok) {
    redirect(routeWithMessage('/submit', 'error', embedCheck.error || 'This YouTube video cannot be embedded. Please make sure it is Public with embedding enabled.'));
  }

  // Block duplicate: one entry per user per competition
  const { data: existing } = await supabase
    .from('entries')
    .select('id')
    .eq('competition_id', competitionId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    redirect(routeWithMessage('/my-entries', 'error', 'You already have an entry for this competition. Use Replace Entry while submissions are open.'));
  }

  const statusToken = crypto.randomBytes(18).toString('base64url');

  const { error } = await supabase.from('entries').insert({
    competition_id: competitionId,
    user_id: user.id,
    entrant_name: entrantName,
    entrant_email: entrantEmail,
    title,
    youtube_url: youtubeUrl,
    youtube_video_id: videoId,
    notes: notes || null,
    moderation_status: 'Pending',
    playback_verified: false,
    status_token: statusToken
  });

  if (error) {
    redirect(routeWithMessage('/submit', 'error', 'Could not save the entry. Please try again.'));
  }

  await logAudit('entry_submitted', 'entries', { title, entrantEmail, youtubeUrl, userId: user.id }, competitionId);
  revalidatePath('/submit');
  revalidatePath('/admin');
  revalidatePath('/my-entries');
  redirect(`/my-entries?success=${encodeURIComponent('Entry submitted and saved to your account.')}`);
}

export async function replaceMyEntryAction(formData: FormData) {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect('/login?next=/my-entries');
  }

  const entryId = `${formData.get('entryId') || ''}`.trim();
  const title = `${formData.get('title') || ''}`.trim();
  const youtubeUrl = `${formData.get('youtubeUrl') || ''}`.trim();
  const notes = `${formData.get('notes') || ''}`.trim();
  const consent = formData.get('consent');

  if (!entryId || !title || !youtubeUrl || !consent) {
    redirect(routeWithMessage('/my-entries', 'error', 'Please complete all required fields and confirm consent.'));
  }

  const videoId = extractYouTubeId(youtubeUrl);
  if (!videoId) {
    redirect(routeWithMessage('/my-entries', 'error', 'Please provide a valid YouTube URL.'));
  }

  const supabase = requireSupabaseOrRedirect('/my-entries');

  const { data: entryRaw } = await supabase
    .from('entries')
    .select('id, competition_id, user_id, competitions!entries_competition_id_fkey(status, max_video_seconds)')
    .eq('id', entryId)
    .maybeSingle();

  const entry = entryRaw as null | {
    id: string;
    competition_id: string;
    user_id: string | null;
    competitions:
      | { status: string; max_video_seconds: number | null }
      | { status: string; max_video_seconds: number | null }[]
      | null;
  };

  if (!entry || entry.user_id !== user.id) {
    redirect(routeWithMessage('/my-entries', 'error', 'Entry not found.'));
  }

  const compRow = Array.isArray(entry.competitions)
    ? entry.competitions[0]
    : entry.competitions;
  const competitionStatus = compRow?.status;
  const maxVideoSeconds = compRow?.max_video_seconds ?? null;

  if (competitionStatus !== 'Submissions Open') {
    redirect(routeWithMessage('/my-entries', 'error', 'Submissions are closed. Replacement is no longer allowed.'));
  }

  const embedCheck = await verifyYouTubeEmbeddable(videoId, { maxSeconds: maxVideoSeconds });
  if (!embedCheck.ok) {
    redirect(routeWithMessage('/my-entries', 'error', embedCheck.error || 'This YouTube video cannot be embedded. Please make sure it is Public with embedding enabled.'));
  }

  const { error } = await supabase
    .from('entries')
    .update({
      title,
      youtube_url: youtubeUrl,
      youtube_video_id: videoId,
      notes: notes || null,
      moderation_status: 'Pending',
      playback_verified: false,
      moderation_notes: null,
      running_order: null,
      approved_at: null
    })
    .eq('id', entryId)
    .eq('user_id', user.id);

  if (error) {
    redirect(routeWithMessage('/my-entries', 'error', 'Unable to replace the entry.'));
  }

  // If this entry was the current playback, clear it
  const { data: comp } = await supabase
    .from('competitions')
    .select('current_playback_entry_id')
    .eq('id', entry.competition_id)
    .maybeSingle();

  if (comp?.current_playback_entry_id === entryId) {
    await supabase
      .from('competitions')
      .update({ current_playback_entry_id: null, updated_at: new Date().toISOString() })
      .eq('id', entry.competition_id);
  }

  await logAudit('entry_replaced', 'entries', { entryId, title, youtubeUrl, userId: user.id }, entry.competition_id);
  revalidatePath('/my-entries');
  revalidatePath('/admin');
  revalidatePath('/playback');
  revalidatePath('/judge');
  redirect(`/my-entries?success=${encodeURIComponent('Entry replaced and re-submitted for admin re-verification.')}`);
}

export async function withdrawMyEntryAction(formData: FormData) {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect('/login?next=/my-entries');
  }

  const entryId = `${formData.get('entryId') || ''}`.trim();
  const confirm = `${formData.get('confirm') || ''}`.trim().toUpperCase();

  if (!entryId) {
    redirect(routeWithMessage('/my-entries', 'error', 'Entry information missing.'));
  }

  if (confirm !== 'WITHDRAW') {
    redirect(routeWithMessage('/my-entries', 'error', 'Type WITHDRAW to confirm removing your entry.'));
  }

  const supabase = requireSupabaseOrRedirect('/my-entries');

  const { data: entryRaw } = await supabase
    .from('entries')
    .select('id, competition_id, user_id, title, competitions!entries_competition_id_fkey(status)')
    .eq('id', entryId)
    .maybeSingle();

  const entry = entryRaw as null | {
    id: string;
    competition_id: string;
    user_id: string | null;
    title: string;
    competitions: { status: string } | { status: string }[] | null;
  };

  if (!entry || entry.user_id !== user.id) {
    redirect(routeWithMessage('/my-entries', 'error', 'Entry not found.'));
  }

  const competitionStatus = Array.isArray(entry.competitions)
    ? entry.competitions[0]?.status
    : entry.competitions?.status;

  if (competitionStatus !== 'Submissions Open') {
    redirect(routeWithMessage('/my-entries', 'error', 'Submissions are closed. Withdrawal is no longer allowed.'));
  }

  // Clear playback pointer if needed
  const { data: comp } = await supabase
    .from('competitions')
    .select('current_playback_entry_id')
    .eq('id', entry.competition_id)
    .maybeSingle();

  if (comp?.current_playback_entry_id === entryId) {
    await supabase
      .from('competitions')
      .update({ current_playback_entry_id: null, updated_at: new Date().toISOString() })
      .eq('id', entry.competition_id);
  }

  // Remove any scores attached to this entry
  await supabase.from('scores').delete().eq('entry_id', entryId);

  const { error } = await supabase
    .from('entries')
    .delete()
    .eq('id', entryId)
    .eq('user_id', user.id);

  if (error) {
    redirect(routeWithMessage('/my-entries', 'error', 'Unable to withdraw the entry.'));
  }

  await logAudit('entry_withdrawn', 'entries', { entryId, title: entry.title, userId: user.id }, entry.competition_id);
  revalidatePath('/my-entries');
  revalidatePath('/admin');
  revalidatePath('/playback');
  revalidatePath('/judge');
  revalidatePath('/submit');
  redirect(`/my-entries?success=${encodeURIComponent('Entry withdrawn. You can submit a new one while submissions are still open.')}`);
}

export async function adminLoginAction(formData: FormData) {
  const provided = `${formData.get('adminPassword') || ''}`;
  const expected = process.env.ADMIN_PASSWORD || '';

  if (!expected) {
    redirect(routeWithMessage('/admin', 'error', 'ADMIN_PASSWORD is not configured yet.'));
  }

  if (provided !== expected) {
    redirect(routeWithMessage('/admin', 'error', 'Incorrect admin password.'));
  }

  await setAdminSession();
  redirect(routeWithMessage('/admin', 'success', 'Admin login successful.'));
}

export async function adminLogoutAction() {
  await clearAdminSession();
  redirect(routeWithMessage('/admin', 'success', 'Admin logged out.'));
}

export async function judgeLoginAction(formData: FormData) {
  const sharedEventPassword = `${formData.get('sharedEventPassword') || ''}`.trim();
  const judgeCode = `${formData.get('judgeCode') || ''}`.trim().toUpperCase();
  const judgePin = `${formData.get('judgePin') || ''}`.trim();

  if (!sharedEventPassword || !judgeCode || !judgePin) {
    redirect(routeWithMessage('/judge', 'error', 'Shared password, judge code, and PIN are required.'));
  }

  const bundle = await getActiveCompetitionBundle();
  if (!bundle.competition) {
    redirect(routeWithMessage('/judge', 'error', 'No active competition is available yet.'));
  }

  if (bundle.competition.shared_event_password !== sharedEventPassword) {
    redirect(routeWithMessage('/judge', 'error', 'Shared event password is incorrect.'));
  }

  const judgeSlot = bundle.judgeSlots.find(
    (slot) => slot.code.toUpperCase() === judgeCode && slot.pin === judgePin && slot.isActive
  );

  if (!judgeSlot) {
    redirect(routeWithMessage('/judge', 'error', 'Judge code or PIN is invalid.'));
  }

  await setJudgeSession({
    competitionId: bundle.competition.id,
    judgeSlotId: judgeSlot.id,
    judgeCode: judgeSlot.code
  });

  redirect(routeWithMessage('/judge', 'success', `Welcome ${judgeSlot.label}.`));
}

export async function judgeLogoutAction() {
  await clearJudgeSession();
  redirect(routeWithMessage('/judge', 'success', 'Judge session cleared.'));
}

export async function updateCompetitionStatusAction(formData: FormData) {
  await requireAdmin();
  const competitionId = `${formData.get('competitionId') || ''}`.trim();
  const status = `${formData.get('status') || ''}` as CompetitionStatus;

  if (!competitionId || !status) {
    redirect(routeWithMessage('/admin', 'error', 'Competition and status are required.'));
  }

  const supabase = requireSupabaseOrRedirect('/admin');
  const { error } = await supabase
    .from('competitions')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', competitionId);

  if (error) {
    redirect(routeWithMessage('/admin', 'error', 'Unable to update the competition status.'));
  }

  await logAudit('competition_status_updated', 'competitions', { status }, competitionId);
  revalidatePath('/');
  revalidatePath('/submit');
  revalidatePath('/judge');
  revalidatePath('/admin');
  redirect(routeWithMessage('/admin', 'success', `Competition status updated to ${status}.`));
}

export async function updateCompetitionSettingsAction(formData: FormData) {
  await requireAdmin();
  const competitionId = `${formData.get('competitionId') || ''}`.trim();
  const name = `${formData.get('name') || ''}`.trim();
  const sharedEventPassword = `${formData.get('sharedEventPassword') || ''}`.trim();
  const maxVideoSecondsRaw = `${formData.get('maxVideoSeconds') || ''}`.trim();

  if (!competitionId || !name || !sharedEventPassword) {
    redirect(routeWithMessage('/admin', 'error', 'Competition name and shared event password are required.'));
  }

  let maxVideoSeconds: number | null = null;
  if (maxVideoSecondsRaw !== '') {
    const parsed = parseInt(maxVideoSecondsRaw, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      redirect(routeWithMessage('/admin', 'error', 'Max video length must be a positive number of seconds, or leave blank for no limit.'));
    }
    if (parsed > 36000) {
      redirect(routeWithMessage('/admin', 'error', 'Max video length cannot exceed 36000 seconds (10 hours).'));
    }
    maxVideoSeconds = parsed;
  }

  const supabase = requireSupabaseOrRedirect('/admin');
  const { error } = await supabase
    .from('competitions')
    .update({
      name,
      shared_event_password: sharedEventPassword,
      max_video_seconds: maxVideoSeconds,
      updated_at: new Date().toISOString()
    })
    .eq('id', competitionId);

  if (error) {
    redirect(routeWithMessage('/admin', 'error', 'Unable to update competition settings.'));
  }

  await logAudit('competition_settings_updated', 'competitions', { name, maxVideoSeconds }, competitionId);
  revalidatePath('/');
  revalidatePath('/submit');
  revalidatePath('/judge');
  revalidatePath('/admin');
  redirect(routeWithMessage('/admin', 'success', 'Competition settings updated.'));
}

export async function updateJudgeSlotAction(formData: FormData) {
  await requireAdmin();
  const judgeSlotId = `${formData.get('judgeSlotId') || ''}`.trim();
  const competitionId = `${formData.get('competitionId') || ''}`.trim();
  const label = `${formData.get('label') || ''}`.trim();
  const code = `${formData.get('code') || ''}`.trim().toUpperCase();
  const pin = `${formData.get('pin') || ''}`.trim();
  const isActive = formData.get('isActive') === 'on';

  if (!judgeSlotId || !competitionId || !label || !code || !pin) {
    redirect(routeWithMessage('/admin', 'error', 'Judge label, code, and PIN are required.'));
  }

  const supabase = requireSupabaseOrRedirect('/admin');
  const { error } = await supabase
    .from('judge_slots')
    .update({ label, code, pin, is_active: isActive })
    .eq('id', judgeSlotId)
    .eq('competition_id', competitionId);

  if (error) {
    redirect(routeWithMessage('/admin', 'error', 'Unable to update the judge slot.'));
  }

  await logAudit('judge_slot_updated', 'judge_slots', { judgeSlotId, code, isActive }, competitionId);
  revalidatePath('/judge');
  revalidatePath('/admin');
  redirect(routeWithMessage('/admin', 'success', `Updated ${label}.`));
}

export async function resetJudgePinsAction(formData: FormData) {
  await requireAdmin();
  const competitionId = `${formData.get('competitionId') || ''}`.trim();
  if (!competitionId) {
    redirect(routeWithMessage('/admin', 'error', 'Competition not found.'));
  }

  const bundle = await getActiveCompetitionBundle();
  if (!bundle.competition || bundle.competition.id !== competitionId) {
    redirect(routeWithMessage('/admin', 'error', 'Active competition not found.'));
  }

  const supabase = requireSupabaseOrRedirect('/admin');
  for (const slot of bundle.judgeSlots) {
    await supabase
      .from('judge_slots')
      .update({ pin: generatePin() })
      .eq('id', slot.id)
      .eq('competition_id', competitionId);
  }

  await logAudit('judge_pins_reset', 'judge_slots', { count: bundle.judgeSlots.length }, competitionId);
  revalidatePath('/judge');
  revalidatePath('/admin');
  redirect(routeWithMessage('/admin', 'success', 'All judge PINs were reset.'));
}

export async function approveEntryAction(formData: FormData) {
  await requireAdmin();
  const competitionId = `${formData.get('competitionId') || ''}`.trim();
  const entryId = `${formData.get('entryId') || ''}`.trim();

  if (!competitionId || !entryId) {
    redirect(routeWithMessage('/admin', 'error', 'Entry information missing.'));
  }

  const supabase = requireSupabaseOrRedirect('/admin');

  const { data: maxRow } = await supabase
    .from('entries')
    .select('running_order')
    .eq('competition_id', competitionId)
    .eq('moderation_status', 'Approved')
    .not('running_order', 'is', null)
    .order('running_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (maxRow?.running_order ?? 0) + 1;

  const { error } = await supabase
    .from('entries')
    .update({
      moderation_status: 'Approved',
      playback_verified: true,
      running_order: nextOrder,
      approved_at: new Date().toISOString()
    })
    .eq('id', entryId)
    .eq('competition_id', competitionId);

  if (error) {
    redirect(routeWithMessage('/admin', 'error', 'Unable to approve the entry.'));
  }

  let autoSetPlayback = false;
  const { data: comp } = await supabase
    .from('competitions')
    .select('current_playback_entry_id')
    .eq('id', competitionId)
    .maybeSingle();

  if (!comp?.current_playback_entry_id) {
    await supabase
      .from('competitions')
      .update({ current_playback_entry_id: entryId, updated_at: new Date().toISOString() })
      .eq('id', competitionId);
    autoSetPlayback = true;
  }

  await logAudit('entry_approved', 'entries', { entryId, runningOrder: nextOrder, autoSetPlayback }, competitionId);
  revalidatePath('/submit');
  revalidatePath('/judge');
  revalidatePath('/admin');
  revalidatePath('/playback');

  const msg = autoSetPlayback
    ? `Approved as #${nextOrder} and now playing on /playback.`
    : `Approved as #${nextOrder} and added to playback queue.`;
  redirect(`/admin?filter=pending&success=${encodeURIComponent(msg)}#moderation`);
}

export async function rejectEntryAction(formData: FormData) {
  await requireAdmin();
  const competitionId = `${formData.get('competitionId') || ''}`.trim();
  const entryId = `${formData.get('entryId') || ''}`.trim();
  const rejectionReason = `${formData.get('rejectionReason') || ''}`.trim();

  if (!competitionId || !entryId) {
    redirect(routeWithMessage('/admin', 'error', 'Entry information missing.'));
  }

  if (!rejectionReason || rejectionReason.length < 5) {
    redirect(routeWithMessage('/admin', 'error', 'A rejection comment is required (at least 5 characters) for the record.'));
  }

  const supabase = requireSupabaseOrRedirect('/admin');
  const { error } = await supabase
    .from('entries')
    .update({
      moderation_status: 'Rejected',
      playback_verified: false,
      running_order: null,
      moderation_notes: rejectionReason,
      approved_at: null
    })
    .eq('id', entryId)
    .eq('competition_id', competitionId);

  if (error) {
    redirect(routeWithMessage('/admin', 'error', 'Unable to reject the entry.'));
  }

  const { data: comp } = await supabase
    .from('competitions')
    .select('current_playback_entry_id')
    .eq('id', competitionId)
    .maybeSingle();

  if (comp?.current_playback_entry_id === entryId) {
    await supabase
      .from('competitions')
      .update({ current_playback_entry_id: null, updated_at: new Date().toISOString() })
      .eq('id', competitionId);
  }

  await logAudit('entry_rejected', 'entries', { entryId, rejectionReason }, competitionId);
  revalidatePath('/submit');
  revalidatePath('/judge');
  revalidatePath('/admin');
  revalidatePath('/playback');

  redirect(`/admin?filter=pending&success=${encodeURIComponent('Entry rejected and removed from queue.')}#moderation`);
}

export async function setPlaybackEntryAction(formData: FormData) {
  await requireAdmin();
  const competitionId = `${formData.get('competitionId') || ''}`.trim();
  const entryId = `${formData.get('entryId') || ''}`.trim();

  if (!competitionId || !entryId) {
    redirect(routeWithMessage('/admin', 'error', 'Competition and playback entry are required.'));
  }

  const supabase = requireSupabaseOrRedirect('/admin');
  const { error } = await supabase
    .from('competitions')
    .update({ current_playback_entry_id: entryId, updated_at: new Date().toISOString() })
    .eq('id', competitionId);

  if (error) {
    redirect(routeWithMessage('/admin', 'error', 'Unable to set the playback entry.'));
  }

  await logAudit('playback_entry_set', 'competitions', { entryId }, competitionId);
  revalidatePath('/admin');
  revalidatePath('/playback');
  redirect(routeWithMessage('/admin', 'success', 'Current playback entry updated.'));
}

export async function stepPlaybackQueueAction(formData: FormData) {
  await requireAdmin('/playback');
  const direction = `${formData.get('direction') || ''}`;
  const bundle = await getActiveCompetitionBundle();

  if (!bundle.competition) {
    redirect(routeWithMessage('/playback', 'error', 'No active competition found.'));
  }

  const approvedEntries = getApprovedEntries(bundle.entries).sort((a, b) => {
    return (a.runningOrder ?? 9999) - (b.runningOrder ?? 9999);
  });

  if (!approvedEntries.length) {
    redirect(routeWithMessage('/playback', 'error', 'No approved entries are ready for playback.'));
  }

  const current = getCurrentPlaybackEntry(bundle) ?? approvedEntries[0];
  const currentIndex = approvedEntries.findIndex((entry) => entry.id === current.id);
  const nextIndex = direction === 'prev'
    ? Math.max(0, currentIndex - 1)
    : Math.min(approvedEntries.length - 1, currentIndex + 1);

  const nextEntry = approvedEntries[nextIndex] ?? current;
  const supabase = requireSupabaseOrRedirect('/playback');
  await supabase
    .from('competitions')
    .update({ current_playback_entry_id: nextEntry.id, updated_at: new Date().toISOString() })
    .eq('id', bundle.competition.id);

  await logAudit('playback_stepped', 'competitions', { direction, nextEntryId: nextEntry.id }, bundle.competition.id);
  revalidatePath('/playback');
  revalidatePath('/admin');
  redirect(routeWithMessage('/playback', 'success', `Playback moved to ${nextEntry.title}.`));
}

export async function saveScoreAction(formData: FormData) {
  const scoreValue = `${formData.get('score') || ''}`.trim();
  const entryId = `${formData.get('entryId') || ''}`.trim();
  const competitionId = `${formData.get('competitionId') || ''}`.trim();
  const judgeSession = await getJudgeSession();

  if (!judgeSession || judgeSession.role !== 'judge') {
    redirect(routeWithMessage('/judge', 'error', 'Judge login required.'));
  }

  if (judgeSession.competitionId !== competitionId) {
    redirect(routeWithMessage('/judge', 'error', 'Judge session does not match the active competition.'));
  }

  const score = Number(scoreValue);
  if (!entryId || !Number.isFinite(score) || score < 1 || score > 10 || Math.round(score * 10) !== score * 10) {
    redirect(routeWithMessage('/judge', 'error', 'Score must be between 1.0 and 10.0 using one decimal place.'));
  }

  const bundle = await getActiveCompetitionBundle();
  if (!bundle.competition || bundle.competition.id !== competitionId) {
    redirect(routeWithMessage('/judge', 'error', 'Active competition not found.'));
  }

  if (bundle.competition.status !== 'Judging Live') {
    redirect(routeWithMessage('/judge', 'error', 'Scores can only be saved while judging is live.'));
  }

  const entry = getApprovedEntries(bundle.entries).find((item) => item.id === entryId);
  if (!entry) {
    redirect(routeWithMessage('/judge', 'error', 'Only approved entries can be scored.'));
  }

  const supabase = requireSupabaseOrRedirect('/judge');
  const { error } = await supabase.from('scores').upsert({
    competition_id: competitionId,
    entry_id: entryId,
    judge_slot_id: judgeSession.judgeSlotId,
    score,
    updated_at: new Date().toISOString()
  }, { onConflict: 'entry_id,judge_slot_id' });

  if (error) {
    redirect(routeWithMessage('/judge', 'error', 'Unable to save the score.'));
  }

  await logAudit('score_saved', 'scores', { entryId, judgeSlotId: judgeSession.judgeSlotId, score }, competitionId);
  revalidatePath('/judge');
  revalidatePath('/admin');
  redirect(routeWithMessage('/judge', 'success', `Saved ${score.toFixed(1)} for ${entry.title}.`));
}

export async function archiveAndResetCompetitionAction(formData: FormData) {
  await requireAdmin();
  const competitionId = `${formData.get('competitionId') || ''}`.trim();
  const confirmation = `${formData.get('confirmation') || ''}`.trim().toUpperCase();

  if (confirmation !== 'RESET') {
    redirect(routeWithMessage('/admin', 'error', 'Type RESET to archive and reset the competition.'));
  }

  const bundle = await getActiveCompetitionBundle();
  if (!bundle.competition || bundle.competition.id !== competitionId) {
    redirect(routeWithMessage('/admin', 'error', 'Active competition not found.'));
  }

  const supabase = requireSupabaseOrRedirect('/admin');
  const leaderboard = getLeaderboard(bundle.entries, bundle.scores).map((item, index) => ({
    entryId: item.entry.id,
    title: item.entry.title,
    average: item.average,
    rank: index + 1
  }));

  // Snapshot sponsors into the archive
  const { data: sponsorRows } = await supabase
    .from('sponsors')
    .select('id, sponsor_name, contact_name, contact_email, website_url, prize_description, logo_url, approved, notes, created_at')
    .eq('competition_id', bundle.competition.id);

  await supabase.from('competition_archives').insert({
    archived_competition_id: bundle.competition.id,
    competition_name: bundle.competition.name,
    archived_snapshot: {
      competition: bundle.competition,
      judgeSlots: bundle.judgeSlots,
      entries: bundle.entries,
      scores: bundle.scores,
      sponsors: sponsorRows ?? [],
      leaderboard
    }
  });

  await supabase
    .from('competitions')
    .update({ status: 'Archived', archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', bundle.competition.id);

  await createCompetitionWithJudges({
    name: bundle.competition.name,
    password: bundle.competition.shared_event_password
  });

  await clearJudgeSession();
  await logAudit('competition_archived_and_reset', 'competitions', { archivedCompetitionId: bundle.competition.id }, bundle.competition.id);
  revalidatePath('/');
  revalidatePath('/submit');
  revalidatePath('/judge');
  revalidatePath('/admin');
  revalidatePath('/playback');
  redirect(routeWithMessage('/admin', 'success', 'Competition archived and replaced with a fresh one.'));
}

// ====================================================================
// SPONSORS
// ====================================================================

const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif'];
const MAX_LOGO_BYTES = 4 * 1024 * 1024; // 4 MB

function slugifyLogo(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export async function submitSponsorAction(formData: FormData) {
  const competitionId = `${formData.get('competitionId') || ''}`.trim();
  const sponsorName = `${formData.get('sponsorName') || ''}`.trim();
  const contactName = `${formData.get('contactName') || ''}`.trim();
  const contactEmail = `${formData.get('contactEmail') || ''}`.trim();
  const websiteUrl = `${formData.get('websiteUrl') || ''}`.trim();
  const prizeDescription = `${formData.get('prizeDescription') || ''}`.trim();
  const consent = formData.get('consent');
  const logo = formData.get('logo');

  if (!competitionId) {
    redirect(routeWithMessage('/sponsor', 'error', 'No active competition is accepting sponsors right now.'));
  }

  if (!sponsorName || !prizeDescription || !consent) {
    redirect(routeWithMessage('/sponsor', 'error', 'Sponsor name, prize description, and consent are required.'));
  }

  if (!(logo instanceof File) || logo.size === 0) {
    redirect(routeWithMessage('/sponsor', 'error', 'Please attach a logo image (PNG, JPG, WebP, SVG, or GIF).'));
  }

  if (!ALLOWED_LOGO_TYPES.includes(logo.type)) {
    redirect(routeWithMessage('/sponsor', 'error', 'Logo must be PNG, JPG, WebP, SVG, or GIF.'));
  }

  if (logo.size > MAX_LOGO_BYTES) {
    redirect(routeWithMessage('/sponsor', 'error', 'Logo file is too large. Max size is 4 MB.'));
  }

  const supabase = requireSupabaseOrRedirect('/sponsor');

  // Verify competition exists
  const { data: comp } = await supabase
    .from('competitions')
    .select('id, status')
    .eq('id', competitionId)
    .maybeSingle<{ id: string; status: string }>();

  if (!comp) {
    redirect(routeWithMessage('/sponsor', 'error', 'Competition not found.'));
  }

  // Upload logo to storage
  const ext = (logo.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
  const safeBase = slugifyLogo(logo.name.replace(/\.[^.]+$/, '')) || 'logo';
  const objectKey = `${competitionId}/${crypto.randomBytes(8).toString('hex')}-${safeBase}.${ext}`;

  const arrayBuf = await logo.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from('sponsor-logos')
    .upload(objectKey, new Uint8Array(arrayBuf), {
      contentType: logo.type,
      upsert: false
    });

  if (uploadError) {
    redirect(routeWithMessage('/sponsor', 'error', `Logo upload failed: ${uploadError.message}`));
  }

  const { data: pub } = supabase.storage.from('sponsor-logos').getPublicUrl(objectKey);
  const logoUrl = pub?.publicUrl ?? null;

  const { error: insertError } = await supabase.from('sponsors').insert({
    competition_id: competitionId,
    sponsor_name: sponsorName,
    contact_name: contactName || null,
    contact_email: contactEmail || null,
    website_url: websiteUrl || null,
    prize_description: prizeDescription,
    logo_path: objectKey,
    logo_url: logoUrl,
    approved: false
  });

  if (insertError) {
    // Best-effort cleanup of orphaned upload
    await supabase.storage.from('sponsor-logos').remove([objectKey]).catch(() => {});
    redirect(routeWithMessage('/sponsor', 'error', 'Could not save sponsor entry. Please try again.'));
  }

  await logAudit('sponsor_submitted', 'sponsors', { sponsorName, contactEmail, prizeDescription }, competitionId);
  revalidatePath('/admin');
  revalidatePath('/playback');
  redirect(routeWithMessage('/sponsor', 'success', 'Thanks! Your sponsorship was submitted for review. The admin will approve it before your logo appears on the playback banner.'));
}

export async function approveSponsorAction(formData: FormData) {
  await requireAdmin();
  const sponsorId = `${formData.get('sponsorId') || ''}`.trim();
  const competitionId = `${formData.get('competitionId') || ''}`.trim();

  if (!sponsorId) {
    redirect(routeWithMessage('/admin', 'error', 'Sponsor information missing.'));
  }

  const supabase = requireSupabaseOrRedirect('/admin');
  const { error } = await supabase
    .from('sponsors')
    .update({ approved: true, updated_at: new Date().toISOString() })
    .eq('id', sponsorId);

  if (error) {
    redirect(routeWithMessage('/admin', 'error', 'Unable to approve sponsor.'));
  }

  await logAudit('sponsor_approved', 'sponsors', { sponsorId }, competitionId);
  revalidatePath('/admin');
  revalidatePath('/playback');
  redirect(routeWithMessage('/admin?filter=pending#sponsors', 'success', 'Sponsor approved and added to the playback banner.'));
}

export async function rejectSponsorAction(formData: FormData) {
  await requireAdmin();
  const sponsorId = `${formData.get('sponsorId') || ''}`.trim();
  const competitionId = `${formData.get('competitionId') || ''}`.trim();
  const reason = `${formData.get('reason') || ''}`.trim();

  if (!sponsorId) {
    redirect(routeWithMessage('/admin', 'error', 'Sponsor information missing.'));
  }

  const supabase = requireSupabaseOrRedirect('/admin');
  const { error } = await supabase
    .from('sponsors')
    .update({ approved: false, notes: reason || null, updated_at: new Date().toISOString() })
    .eq('id', sponsorId);

  if (error) {
    redirect(routeWithMessage('/admin', 'error', 'Unable to reject sponsor.'));
  }

  await logAudit('sponsor_rejected', 'sponsors', { sponsorId, reason }, competitionId);
  revalidatePath('/admin');
  revalidatePath('/playback');
  redirect(routeWithMessage('/admin?filter=pending#sponsors', 'success', 'Sponsor marked as not approved.'));
}

export async function deleteSponsorAction(formData: FormData) {
  await requireAdmin();
  const sponsorId = `${formData.get('sponsorId') || ''}`.trim();
  const competitionId = `${formData.get('competitionId') || ''}`.trim();

  if (!sponsorId) {
    redirect(routeWithMessage('/admin', 'error', 'Sponsor information missing.'));
  }

  const supabase = requireSupabaseOrRedirect('/admin');

  // Fetch logo path so we can delete the file too
  const { data: row } = await supabase
    .from('sponsors')
    .select('logo_path')
    .eq('id', sponsorId)
    .maybeSingle<{ logo_path: string | null }>();

  const { error } = await supabase.from('sponsors').delete().eq('id', sponsorId);
  if (error) {
    redirect(routeWithMessage('/admin', 'error', 'Unable to delete sponsor.'));
  }

  if (row?.logo_path) {
    await supabase.storage.from('sponsor-logos').remove([row.logo_path]).catch(() => {});
  }

  await logAudit('sponsor_deleted', 'sponsors', { sponsorId }, competitionId);
  revalidatePath('/admin');
  revalidatePath('/playback');
  redirect(routeWithMessage('/admin?filter=pending#sponsors', 'success', 'Sponsor removed.'));
}
