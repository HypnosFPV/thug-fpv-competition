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

export async function sendSubmissionNotification(payload: SubmissionNotificationPayload) {
  if (!payload.enabled) {
    return { attempted: false, delivered: false, reason: 'disabled' as const };
  }

  const resendApiKey = getEnv('RESEND_API_KEY');
  const fromEmail = getEnv('RESEND_FROM_EMAIL');

  if (!resendApiKey || !fromEmail) {
    return { attempted: false, delivered: false, reason: 'missing_config' as const };
  }

  const to = Array.from(
    new Set([normalizeEmail(payload.primaryEmail), normalizeEmail(payload.backupEmail)].filter(Boolean) as string[])
  );

  if (!to.length) {
    return { attempted: false, delivered: false, reason: 'missing_recipients' as const };
  }

  const resend = new Resend(resendApiKey);

  try {
    const result = await resend.emails.send({
      from: fromEmail,
      to,
      subject: `[${payload.competitionName}] New submission: ${payload.entryTitle}`,
      replyTo: payload.entrantEmail,
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
          <p><strong>Competition:</strong> ${payload.competitionName}</p>
          <p><strong>Title:</strong> ${payload.entryTitle}</p>
          <p><strong>Entrant:</strong> ${payload.entrantName}</p>
          <p><strong>Email:</strong> <a href="mailto:${payload.entrantEmail}">${payload.entrantEmail}</a></p>
          <p><strong>YouTube URL:</strong> <a href="${payload.youtubeUrl}">${payload.youtubeUrl}</a></p>
          <p><strong>Notes:</strong> ${payload.notes?.trim() || 'None'}</p>
        </div>
      `
    });

    if ((result as any)?.error) {
      return { attempted: true, delivered: false, reason: 'provider_error' as const, error: (result as any).error };
    }

    return { attempted: true, delivered: true, reason: 'sent' as const, id: (result as any)?.data?.id ?? null };
  } catch (error) {
    return { attempted: true, delivered: false, reason: 'exception' as const, error };
  }
}
