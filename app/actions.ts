'use server';

import crypto from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { extractYouTubeId } from '@/lib/youtube';
import { clearAdminSession, clearJudgeSession, getJudgeSession, isAdminAuthenticated, setAdminSession, setJudgeSession } from '@/lib/session';
import { getActiveCompetitionBundle, getApprovedEntries, getCurrentPlaybackEntry, getLeaderboard } from '@/lib/server-data';
import { sendApprovalEmail, sendRejectionEmail, sendSubmissionNotification } from '@/lib/notifications';
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

function cleanOptionalEmail(value: FormDataEntryValue | null) {
  const email = `${value || ''}`.trim();
  return email.length ? email : null;
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 48);
}

async function createCompetitionWithJudges(params: {
  name: string;
  password: string;
  notificationEmail: string | null;
  backupNotificationEmail: string | null;
  emailNotificationsEnabled: boolean;
}) {
  const supabase = requireSupabaseOrRedirect('/admin');
  const slug = `${slugify(params.name) || 'competition'}-${Date.now().toString().slice(-6)}`;

  const { data: competition, error } = await supabase
    .from('competitions')
    .insert({
      name: params.name,
      slug,
      status: 'Draft',
      shared_event_password: params.password,
      notification_email: params.notificationEmail,
      backup_notification_email: params.backupNotificationEmail,
      email_notifications_enabled: params.emailNotificationsEnabled
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
  const notificationEmail = cleanOptionalEmail(formData.get('notificationEmail'));
  const backupNotificationEmail = cleanOptionalEmail(formData.get('backupNotificationEmail'));
  const emailNotificationsEnabled = formData.get('emailNotificationsEnabled') === 'on';

  if (!name || !password) {
    redirect(routeWithMessage('/admin', 'error', 'Competition name and shared event password are required.'));
  }

  if (emailNotificationsEnabled && !notificationEmail) {
    redirect(routeWithMessage('/admin', 'error', 'A primary notification email is required when email notifications are enabled.'));
  }

  await createCompetitionWithJudges({
    name,
    password,
    notificationEmail,
    backupNotificationEmail,
    emailNotificationsEnabled
  });
  revalidatePath('/');
  revalidatePath('/submit');
  revalidatePath('/judge');
  revalidatePath('/admin');
  redirect(routeWithMessage('/admin', 'success', 'Competition created with 5 fresh judge codes and PINs.'));
}

export async function submitEntryAction(formData: FormData) {
  const competitionId = `${formData.get('competitionId') || ''}`.trim();
  const entrantName = `${formData.get('entrantName') || ''}`.trim();
  const entrantEmail = `${formData.get('entrantEmail') || ''}`.trim();
  const title = `${formData.get('title') || ''}`.trim();
  const youtubeUrl = `${formData.get('youtubeUrl') || ''}`.trim();
  const notes = `${formData.get('notes') || ''}`.trim();
  const consent = formData.get('consent');

  if (!competitionId) {
    redirect(routeWithMessage('/submit', 'error', 'No active competition is available for submissions.'));
  }

  if (!entrantName || !entrantEmail || !title || !youtubeUrl || !consent) {
    redirect(routeWithMessage('/submit', 'error', 'Please complete all required fields and confirm consent.'));
  }

  const videoId = extractYouTubeId(youtubeUrl);
  if (!videoId) {
    redirect(routeWithMessage('/submit', 'error', 'Please provide a valid YouTube URL.'));
  }

  const supabase = requireSupabaseOrRedirect('/submit');

  const { data: competition } = await supabase
    .from('competitions')
    .select('id, name, status, notification_email, backup_notification_email, email_notifications_enabled')
    .eq('id', competitionId)
    .maybeSingle();

  if (!competition || competition.status !== 'Submissions Open') {
    redirect(routeWithMessage('/submit', 'error', 'Submissions are not open right now.'));
  }

  const { error } = await supabase.from('entries').insert({
    competition_id: competitionId,
    entrant_name: entrantName,
    entrant_email: entrantEmail,
    title,
    youtube_url: youtubeUrl,
    youtube_video_id: videoId,
    notes: notes || null,
    moderation_status: 'Pending',
    playback_verified: false
  });

  if (error) {
    redirect(routeWithMessage('/submit', 'error', 'Could not save the entry. Please try again.'));
  }

  const emailResult = await sendSubmissionNotification({
    competitionName: competition.name,
    entryTitle: title,
    entrantName,
    entrantEmail,
    youtubeUrl,
    notes: notes || null,
    primaryEmail: competition.notification_email,
    backupEmail: competition.backup_notification_email,
    enabled: Boolean(competition.email_notifications_enabled)
  });

  await logAudit('entry_submitted', 'entries', {
    title,
    entrantEmail,
    youtubeUrl,
    notificationAttempted: emailResult.attempted,
    notificationDelivered: emailResult.delivered,
    notificationReason: emailResult.reason
  }, competitionId);
  revalidatePath('/submit');
  revalidatePath('/admin');

  const successMessage = emailResult.delivered
    ? 'Entry submitted successfully and notification email sent.'
    : 'Entry submitted successfully and sent to moderation.';

  redirect(routeWithMessage('/submit', 'success', successMessage));
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
  const notificationEmail = cleanOptionalEmail(formData.get('notificationEmail'));
  const backupNotificationEmail = cleanOptionalEmail(formData.get('backupNotificationEmail'));
  const emailNotificationsEnabled = formData.get('emailNotificationsEnabled') === 'on';

  if (!competitionId || !name || !sharedEventPassword) {
    redirect(routeWithMessage('/admin', 'error', 'Competition name and shared event password are required.'));
  }

  if (emailNotificationsEnabled && !notificationEmail) {
    redirect(routeWithMessage('/admin', 'error', 'A primary notification email is required when email notifications are enabled.'));
  }

  const supabase = requireSupabaseOrRedirect('/admin');
  const { error } = await supabase
    .from('competitions')
    .update({
      name,
      shared_event_password: sharedEventPassword,
      notification_email: notificationEmail,
      backup_notification_email: backupNotificationEmail,
      email_notifications_enabled: emailNotificationsEnabled,
      updated_at: new Date().toISOString()
    })
    .eq('id', competitionId);

  if (error) {
    redirect(routeWithMessage('/admin', 'error', 'Unable to update competition settings.'));
  }

  await logAudit('competition_settings_updated', 'competitions', {
    name,
    notificationEmail,
    backupNotificationEmail,
    emailNotificationsEnabled
  }, competitionId);
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

export async function moderateEntryAction(formData: FormData) {
  await requireAdmin();
  const competitionId = `${formData.get('competitionId') || ''}`.trim();
  const entryId = `${formData.get('entryId') || ''}`.trim();
  const moderationStatus = `${formData.get('moderationStatus') || ''}`.trim();
  const playbackVerified = formData.get('playbackVerified') === 'true';
  const runningOrderRaw = `${formData.get('runningOrder') || ''}`.trim();
  const moderationNotes = `${formData.get('moderationNotes') || ''}`.trim();

  if (!competitionId || !entryId || !moderationStatus) {
    redirect(routeWithMessage('/admin', 'error', 'Entry moderation values are incomplete.'));
  }

  const supabase = requireSupabaseOrRedirect('/admin');

  let runningOrder = runningOrderRaw ? Number(runningOrderRaw) : null;
  const approvedAt = moderationStatus === 'Approved' ? new Date().toISOString() : null;

  // Auto-assign running order when approving an entry that doesn't have one
  if (moderationStatus === 'Approved' && !Number.isFinite(runningOrder as number)) {
    const { data: maxRow } = await supabase
      .from('entries')
      .select('running_order')
      .eq('competition_id', competitionId)
      .eq('moderation_status', 'Approved')
      .not('running_order', 'is', null)
      .order('running_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    runningOrder = (maxRow?.running_order ?? 0) + 1;
  }

  const { error } = await supabase
    .from('entries')
    .update({
      moderation_status: moderationStatus,
      playback_verified: playbackVerified,
      running_order: Number.isFinite(runningOrder as number) ? runningOrder : null,
      moderation_notes: moderationNotes || null,
      approved_at: approvedAt
    })
    .eq('id', entryId)
    .eq('competition_id', competitionId);

  if (error) {
    redirect(routeWithMessage('/admin', 'error', 'Unable to update the entry.'));
  }

  // If this is the first approved entry, auto-set as current playback
  let autoSetPlayback = false;
  if (moderationStatus === 'Approved') {
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
  }

  await logAudit('entry_moderated', 'entries', { entryId, moderationStatus, playbackVerified, runningOrder, autoSetPlayback }, competitionId);
  revalidatePath('/submit');
  revalidatePath('/judge');
  revalidatePath('/admin');
  revalidatePath('/playback');

  const successMessage = moderationStatus === 'Approved'
    ? autoSetPlayback
      ? `Approved and added to playback queue as #${runningOrder}. Now playing on /playback.`
      : `Approved and added to playback queue as #${runningOrder}.`
    : 'Entry updated.';

  redirect(routeWithMessage('/admin', 'success', successMessage));
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
    .select('current_playback_entry_id, name, notification_email')
    .eq('id', competitionId)
    .maybeSingle();

  if (!comp?.current_playback_entry_id) {
    await supabase
      .from('competitions')
      .update({ current_playback_entry_id: entryId, updated_at: new Date().toISOString() })
      .eq('id', competitionId);
    autoSetPlayback = true;
  }

  const { data: entry } = await supabase
    .from('entries')
    .select('title, entrant_name, entrant_email, youtube_url')
    .eq('id', entryId)
    .maybeSingle();

  let approvalEmailResult = { attempted: false, delivered: false, reason: 'skipped' as string };
  if (entry && comp) {
    approvalEmailResult = await sendApprovalEmail({
      competitionName: comp.name,
      entrantName: entry.entrant_name,
      entrantEmail: entry.entrant_email,
      entryTitle: entry.title,
      youtubeUrl: entry.youtube_url,
      runningOrder: nextOrder,
      replyToEmail: comp.notification_email
    });
  }

  await logAudit('entry_approved', 'entries', {
    entryId,
    runningOrder: nextOrder,
    autoSetPlayback,
    approvalEmail: approvalEmailResult
  }, competitionId);
  revalidatePath('/submit');
  revalidatePath('/judge');
  revalidatePath('/admin');
  revalidatePath('/playback');

  const emailNote = approvalEmailResult.delivered ? ' Entrant notified by email.' : '';
  redirect(routeWithMessage('/admin', 'success', (autoSetPlayback
    ? `Approved as #${nextOrder} and now playing on /playback.`
    : `Approved as #${nextOrder} and added to playback queue.`) + emailNote));
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
    redirect(routeWithMessage('/admin', 'error', 'A rejection comment is required (at least 5 characters) and is emailed to the entrant.'));
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
    .select('current_playback_entry_id, name, notification_email')
    .eq('id', competitionId)
    .maybeSingle();

  if (comp?.current_playback_entry_id === entryId) {
    await supabase
      .from('competitions')
      .update({ current_playback_entry_id: null, updated_at: new Date().toISOString() })
      .eq('id', competitionId);
  }

  const { data: entry } = await supabase
    .from('entries')
    .select('title, entrant_name, entrant_email, youtube_url')
    .eq('id', entryId)
    .maybeSingle();

  let rejectionEmailResult = { attempted: false, delivered: false, reason: 'skipped' as string };
  if (entry && comp) {
    rejectionEmailResult = await sendRejectionEmail({
      competitionName: comp.name,
      entrantName: entry.entrant_name,
      entrantEmail: entry.entrant_email,
      entryTitle: entry.title,
      youtubeUrl: entry.youtube_url,
      reason: rejectionReason,
      replyToEmail: comp.notification_email
    });
  }

  await logAudit('entry_rejected', 'entries', { entryId, rejectionEmail: rejectionEmailResult }, competitionId);
  revalidatePath('/submit');
  revalidatePath('/judge');
  revalidatePath('/admin');
  revalidatePath('/playback');

  const emailNote = rejectionEmailResult.delivered ? ' Entrant notified by email with your comment.' : '';
  redirect(routeWithMessage('/admin', 'success', 'Entry rejected and removed from queue.' + emailNote));
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

  await supabase.from('competition_archives').insert({
    archived_competition_id: bundle.competition.id,
    competition_name: bundle.competition.name,
    archived_snapshot: {
      competition: bundle.competition,
      judgeSlots: bundle.judgeSlots,
      entries: bundle.entries,
      scores: bundle.scores,
      leaderboard
    }
  });

  await supabase
    .from('competitions')
    .update({ status: 'Archived', archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', bundle.competition.id);

  await createCompetitionWithJudges({
    name: bundle.competition.name,
    password: bundle.competition.shared_event_password,
    notificationEmail: bundle.competition.notification_email,
    backupNotificationEmail: bundle.competition.backup_notification_email,
    emailNotificationsEnabled: bundle.competition.email_notifications_enabled
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
