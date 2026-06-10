import 'server-only';

import { Resend } from 'resend';

interface SubmissionNotificationPayload {
  competitionName: string;
  entryTitle: string;
  entrantName: string;
  entrantEmail: string;
  youtubeUrl: string;
  notes?: string | null;
  primaryEmail?: string | null;
  backupEmail?: string | null;
  enabled: boolean;
}

function getEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function normalizeEmail(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const basicEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return basicEmailPattern.test(trimmed) ? trimmed : null;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function sendViaResend(args: {
  to: string[];
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
}) {
  const resendApiKey = getEnv('RESEND_API_KEY');
  const fromEmail = getEnv('RESEND_FROM_EMAIL');

  if (!resendApiKey || !fromEmail) {
    return { attempted: false, delivered: false, reason: 'missing_config' as const };
  }

  if (!args.to.length) {
    return { attempted: false, delivered: false, reason: 'missing_recipients' as const };
  }

  const resend = new Resend(resendApiKey);

  try {
    const result = await resend.emails.send({
      from: fromEmail,
      to: args.to,
      subject: args.subject,
      replyTo: args.replyTo,
      text: args.text,
      html: args.html
    });

    if ((result as any)?.error) {
      return { attempted: true, delivered: false, reason: 'provider_error' as const, error: (result as any).error };
    }

    return { attempted: true, delivered: true, reason: 'sent' as const, id: (result as any)?.data?.id ?? null };
  } catch (error) {
    return { attempted: true, delivered: false, reason: 'exception' as const, error };
  }
}

export async function sendSubmissionNotification(payload: SubmissionNotificationPayload) {
  if (!payload.enabled) {
    return { attempted: false, delivered: false, reason: 'disabled' as const };
  }

  const to = Array.from(
    new Set([normalizeEmail(payload.primaryEmail), normalizeEmail(payload.backupEmail)].filter(Boolean) as string[])
  );

  return sendViaResend({
    to,
    replyTo: payload.entrantEmail,
    subject: `[${payload.competitionName}] New submission: ${payload.entryTitle}`,
    text: [
      `Competition: ${payload.competitionName}`,
      `Title: ${payload.entryTitle}`,
      `Entrant: ${payload.entrantName}`,
      `Email: ${payload.entrantEmail}`,
      `YouTube URL: ${payload.youtubeUrl}`,
      `Notes: ${payload.notes?.trim() || 'None'}`
    ].join('\n'),
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.6">
        <h2 style="margin:0 0 16px">New THUG FPV Competition Submission</h2>
        <p><strong>Competition:</strong> ${escapeHtml(payload.competitionName)}</p>
        <p><strong>Title:</strong> ${escapeHtml(payload.entryTitle)}</p>
        <p><strong>Entrant:</strong> ${escapeHtml(payload.entrantName)}</p>
        <p><strong>Email:</strong> <a href="mailto:${payload.entrantEmail}">${escapeHtml(payload.entrantEmail)}</a></p>
        <p><strong>YouTube URL:</strong> <a href="${payload.youtubeUrl}">${escapeHtml(payload.youtubeUrl)}</a></p>
        <p><strong>Notes:</strong> ${escapeHtml(payload.notes?.trim() || 'None')}</p>
      </div>
    `
  });
}

interface EntrantDecisionPayload {
  competitionName: string;
  entrantName: string;
  entrantEmail: string;
  entryTitle: string;
  youtubeUrl: string;
  replyToEmail?: string | null;
}

export async function sendApprovalEmail(payload: EntrantDecisionPayload & { runningOrder?: number | null }) {
  const to = normalizeEmail(payload.entrantEmail);
  if (!to) return { attempted: false, delivered: false, reason: 'missing_recipients' as const };

  const replyTo = normalizeEmail(payload.replyToEmail) ?? undefined;
  const orderLine = payload.runningOrder ? `Queue position: #${payload.runningOrder}` : '';

  return sendViaResend({
    to: [to],
    replyTo,
    subject: `✓ Approved: "${payload.entryTitle}" — ${payload.competitionName}`,
    text: [
      `Hi ${payload.entrantName},`,
      '',
      `Good news! Your entry "${payload.entryTitle}" has been accepted into ${payload.competitionName}.`,
      orderLine,
      `YouTube URL: ${payload.youtubeUrl}`,
      '',
      'Thanks for entering. Stay tuned for the live judging stream.',
      '',
      '— THUG FPV / Hypnos FPV / Nappy FPV'
    ].filter(Boolean).join('\n'),
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.6">
        <h2 style="margin:0 0 12px;color:#1f8a3f">✓ Your entry has been accepted</h2>
        <p>Hi ${escapeHtml(payload.entrantName)},</p>
        <p>Good news! Your entry <strong>“${escapeHtml(payload.entryTitle)}”</strong> has been accepted into <strong>${escapeHtml(payload.competitionName)}</strong>.</p>
        ${payload.runningOrder ? `<p><strong>Queue position:</strong> #${payload.runningOrder}</p>` : ''}
        <p><strong>Your video:</strong> <a href="${payload.youtubeUrl}">${escapeHtml(payload.youtubeUrl)}</a></p>
        <p>Thanks for entering. Stay tuned for the live judging stream.</p>
        <p style="color:#666;margin-top:24px">— THUG FPV · Hypnos FPV · Nappy FPV</p>
      </div>
    `
  });
}

export async function sendRejectionEmail(payload: EntrantDecisionPayload & { reason: string }) {
  const to = normalizeEmail(payload.entrantEmail);
  if (!to) return { attempted: false, delivered: false, reason: 'missing_recipients' as const };

  const replyTo = normalizeEmail(payload.replyToEmail) ?? undefined;

  return sendViaResend({
    to: [to],
    replyTo,
    subject: `Update on your entry "${payload.entryTitle}" — ${payload.competitionName}`,
    text: [
      `Hi ${payload.entrantName},`,
      '',
      `Thanks for submitting "${payload.entryTitle}" to ${payload.competitionName}.`,
      '',
      'Unfortunately your entry was not approved for this round. The reason from the admin team:',
      '',
      payload.reason,
      '',
      `Your submitted video: ${payload.youtubeUrl}`,
      '',
      'You\'re welcome to address the feedback and resubmit if submissions are still open.',
      '',
      '— THUG FPV / Hypnos FPV / Nappy FPV'
    ].join('\n'),
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.6">
        <h2 style="margin:0 0 12px">Update on your entry</h2>
        <p>Hi ${escapeHtml(payload.entrantName)},</p>
        <p>Thanks for submitting <strong>“${escapeHtml(payload.entryTitle)}”</strong> to <strong>${escapeHtml(payload.competitionName)}</strong>.</p>
        <p>Unfortunately your entry was not approved for this round. The reason from the admin team:</p>
        <blockquote style="border-left:4px solid #cf3d3d;padding:8px 14px;background:#fff5f5;color:#3a1010;border-radius:6px">
          ${escapeHtml(payload.reason).replace(/\n/g, '<br />')}
        </blockquote>
        <p><strong>Your submitted video:</strong> <a href="${payload.youtubeUrl}">${escapeHtml(payload.youtubeUrl)}</a></p>
        <p>You’re welcome to address the feedback and resubmit if submissions are still open.</p>
        <p style="color:#666;margin-top:24px">— THUG FPV · Hypnos FPV · Nappy FPV</p>
      </div>
    `
  });
}
