import {
  adminLoginAction,
  adminLogoutAction,
  archiveAndResetCompetitionAction,
  createInitialCompetitionAction,
  moderateEntryAction,
  resetJudgePinsAction,
  setPlaybackEntryAction,
  updateCompetitionSettingsAction,
  updateCompetitionStatusAction,
  updateJudgeSlotAction
} from '@/app/actions';
import { SiteNav } from '@/components/SiteNav';
import { COMPETITION_STATUSES } from '@/lib/constants';
import { getActiveCompetitionBundle, getApprovedEntries, getCurrentPlaybackEntry, getLeaderboard, getPendingEntries } from '@/lib/server-data';
import { isAdminAuthenticated } from '@/lib/session';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function pickMessage(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminPage({ searchParams }: { searchParams?: SearchParams }) {
  const params = (await searchParams) ?? {};
  const error = pickMessage(params.error);
  const success = pickMessage(params.success);
  const isAdmin = await isAdminAuthenticated();
  const bundle = await getActiveCompetitionBundle();
  const competition = bundle.competition;
  const pendingEntries = getPendingEntries(bundle.entries);
  const approvedEntries = getApprovedEntries(bundle.entries);
  const leaderboard = getLeaderboard(bundle.entries, bundle.scores);
  const currentPlayback = getCurrentPlaybackEntry(bundle);
  const resendConfigured = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);

  return (
    <main className="page-shell page-stack">
      <SiteNav mutedText="Admin control room · moderation, judging, playback, archive/reset, notifications" />

      {!isAdmin ? (
        <section className="panel narrow-panel">
          <div className="section-head">
            <h2>Admin Login</h2>
            <span className="tag">Protected</span>
          </div>
          {success && <div className="card success-card"><strong>Success</strong><p className="muted">{success}</p></div>}
          {error && <div className="card error-card"><strong>Notice</strong><p className="muted">{error}</p></div>}
          <form className="form form-single" action={adminLoginAction}>
            <label className="field">
              <span>Admin password</span>
              <input className="input" name="adminPassword" type="password" required />
            </label>
            <button className="btn primary" type="submit">Log In</button>
          </form>
        </section>
      ) : (
        <>
          {success && <div className="card success-card"><strong>Success</strong><p className="muted">{success}</p></div>}
          {error && <div className="card error-card"><strong>Notice</strong><p className="muted">{error}</p></div>}

          <section className="toolbar">
            <form action={adminLogoutAction}><button className="btn secondary" type="submit">Log Out Admin</button></form>
          </section>

          {!bundle.configured && (
            <section className="panel">
              <div className="section-head">
                <h2>Supabase Setup Required</h2>
              </div>
              <p className="muted">Fill in NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before using the live admin tools.</p>
            </section>
          )}

          {bundle.configured && !competition && (
            <section className="panel narrow-panel">
              <div className="section-head">
                <h2>Create First Competition</h2>
                <span className="tag">Initialize</span>
              </div>
              <form className="form form-single" action={createInitialCompetitionAction}>
                <label className="field">
                  <span>Competition name</span>
                  <input className="input" name="name" placeholder="THUG FPV Showcase" required />
                </label>
                <label className="field">
                  <span>Shared event password</span>
                  <input className="input" name="sharedEventPassword" placeholder="THUG2026" required />
                </label>
                <label className="field">
                  <span>Notification email</span>
                  <input className="input" name="notificationEmail" type="email" placeholder="admin@example.com" />
                </label>
                <label className="field">
                  <span>Backup notification email</span>
                  <input className="input" name="backupNotificationEmail" type="email" placeholder="optional@example.com" />
                </label>
                <label className="field checkbox-field">
                  <span className="checkbox-line">
                    <input name="emailNotificationsEnabled" type="checkbox" defaultChecked />
                    <span>Enable Resend email notifications for new submissions</span>
                  </span>
                </label>
                <div className="card notice-card">
                  <strong>Resend status</strong>
                  <p className="muted">{resendConfigured ? 'Configured in environment variables.' : 'Not fully configured yet. Add RESEND_API_KEY and RESEND_FROM_EMAIL.'}</p>
                </div>
                <button className="btn primary" type="submit">Create Competition + 5 Judge Slots</button>
              </form>
            </section>
          )}

          {bundle.configured && competition && (
            <section className="grid">
              <section className="panel span-8">
                <div className="section-head">
                  <h2>Competition Settings</h2>
                  <span className="tag">Admin only</span>
                </div>
                <form className="form" action={updateCompetitionSettingsAction}>
                  <input type="hidden" name="competitionId" value={competition.id} />
                  <label className="field full">
                    <span>Competition name</span>
                    <input className="input" name="name" defaultValue={competition.name} required />
                  </label>
                  <label className="field">
                    <span>Shared event password</span>
                    <input className="input" name="sharedEventPassword" defaultValue={competition.shared_event_password} required />
                  </label>
                  <div className="field">
                    <span>Current status</span>
                    <div className="status-inline">
                      <strong>{competition.status}</strong>
                    </div>
                  </div>
                  <label className="field">
                    <span>Notification email</span>
                    <input className="input" name="notificationEmail" type="email" defaultValue={competition.notification_email ?? ''} placeholder="admin@example.com" />
                  </label>
                  <label className="field">
                    <span>Backup notification email</span>
                    <input className="input" name="backupNotificationEmail" type="email" defaultValue={competition.backup_notification_email ?? ''} placeholder="optional@example.com" />
                  </label>
                  <label className="field checkbox-field full">
                    <span className="checkbox-line">
                      <input name="emailNotificationsEnabled" type="checkbox" defaultChecked={competition.email_notifications_enabled} />
                      <span>Enable Resend email notifications for this competition</span>
                    </span>
                  </label>
                  <div className="full toolbar">
                    <button className="btn primary" type="submit">Save Competition Settings</button>
                  </div>
                </form>
                <div className="card notice-card" style={{ marginTop: 12 }}>
                  <strong>Notification delivery</strong>
                  <p className="muted">
                    {competition.email_notifications_enabled ? 'Enabled' : 'Disabled'} · Primary: {competition.notification_email || 'Not set'} · Backup: {competition.backup_notification_email || 'Not set'}
                  </p>
                  <p className="muted">
                    Resend environment: {resendConfigured ? 'configured' : 'missing RESEND_API_KEY or RESEND_FROM_EMAIL'}
                  </p>
                </div>
                <form className="toolbar status-toolbar" action={updateCompetitionStatusAction}>
                  <input type="hidden" name="competitionId" value={competition.id} />
                  <select className="select" name="status" defaultValue={competition.status}>
                    {COMPETITION_STATUSES.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                  <button className="btn primary" type="submit">Update Status</button>
                </form>
              </section>

              <aside className="panel span-4">
                <div className="section-head">
                  <h2>Playback Queue</h2>
                  <span className="tag">OBS</span>
                </div>
                <div className="card">
                  <strong>Current</strong>
                  <p className="muted">{currentPlayback ? currentPlayback.title : 'No playback entry selected yet.'}</p>
                </div>
                <div className="list" style={{ marginTop: 12 }}>
                  {approvedEntries.map((entry) => (
                    <form key={entry.id} action={setPlaybackEntryAction}>
                      <input type="hidden" name="competitionId" value={competition.id} />
                      <input type="hidden" name="entryId" value={entry.id} />
                      <button className="btn secondary full-width-btn" type="submit">
                        Set Playback: {entry.runningOrder ? `#${entry.runningOrder} ` : ''}{entry.title}
                      </button>
                    </form>
                  ))}
                </div>
              </aside>

              <section className="panel span-12">
                <div className="section-head">
                  <h2>Judge Slots</h2>
                  <span className="tag">Shared password + code + PIN</span>
                </div>
                <div className="list judge-grid">
                  {bundle.judgeSlots.map((slot) => (
                    <form key={slot.id} className="card form form-single" action={updateJudgeSlotAction}>
                      <input type="hidden" name="competitionId" value={competition.id} />
                      <input type="hidden" name="judgeSlotId" value={slot.id} />
                      <label className="field">
                        <span>Label</span>
                        <input className="input" name="label" defaultValue={slot.label} required />
                      </label>
                      <label className="field">
                        <span>Code</span>
                        <input className="input" name="code" defaultValue={slot.code} required />
                      </label>
                      <label className="field">
                        <span>PIN</span>
                        <input className="input" name="pin" defaultValue={slot.pin} required />
                      </label>
                      <label className="field checkbox-field">
                        <span className="checkbox-line">
                          <input name="isActive" type="checkbox" defaultChecked={slot.isActive} />
                          <span>Judge active for this competition</span>
                        </span>
                      </label>
                      <button className="btn secondary" type="submit">Save Judge Slot</button>
                    </form>
                  ))}
                </div>
                <form action={resetJudgePinsAction}>
                  <input type="hidden" name="competitionId" value={competition.id} />
                  <button className="btn secondary" type="submit">Reset All Judge PINs</button>
                </form>
              </section>

              <section className="panel span-8">
                <div className="section-head">
                  <h2>Entry Moderation</h2>
                  <span className="tag">Pending + approved</span>
                </div>
                <div className="list">
                  {[...pendingEntries, ...approvedEntries].map((entry) => (
                    <form key={entry.id} className="card entry-grid" action={moderateEntryAction}>
                      <input type="hidden" name="competitionId" value={competition.id} />
                      <input type="hidden" name="entryId" value={entry.id} />
                      <div>
                        <strong>{entry.title}</strong>
                        <p className="muted">{entry.entrantName} · {entry.entrantEmail}</p>
                        <a className="muted inline-link" href={entry.youtubeUrl} target="_blank">Open YouTube Link</a>
                      </div>
                      <label className="field">
                        <span>Moderation status</span>
                        <select className="select" name="moderationStatus" defaultValue={entry.moderationStatus}>
                          <option value="Pending">Pending</option>
                          <option value="Playback Verified">Playback Verified</option>
                          <option value="Approved">Approved</option>
                          <option value="Rejected">Rejected</option>
                        </select>
                      </label>
                      <label className="field">
                        <span>Playback verified</span>
                        <select className="select" name="playbackVerified" defaultValue={entry.moderationStatus === 'Approved' || entry.moderationStatus === 'Playback Verified' ? 'true' : 'false'}>
                          <option value="false">No</option>
                          <option value="true">Yes</option>
                        </select>
                      </label>
                      <label className="field">
                        <span>Running order</span>
                        <input className="input" name="runningOrder" type="number" min="1" defaultValue={entry.runningOrder ?? ''} />
                      </label>
                      <label className="field full">
                        <span>Moderation notes</span>
                        <input className="input" name="moderationNotes" placeholder="Why approved / rejected" />
                      </label>
                      <button className="btn primary" type="submit">Save Entry Update</button>
                    </form>
                  ))}
                </div>
              </section>

              <aside className="panel span-4">
                <div className="section-head">
                  <h2>Leaderboard</h2>
                  <span className="tag">Live averages</span>
                </div>
                <div className="list">
                  {leaderboard.length === 0 && <p className="muted">No approved entries have scores yet.</p>}
                  {leaderboard.map((item, index) => (
                    <div className="card" key={item.entry.id}>
                      <strong>#{index + 1} · {item.entry.title}</strong>
                      <p className="muted">Average: {item.average !== null ? item.average.toFixed(2) : '—'} · Scores: {item.totalScores}</p>
                    </div>
                  ))}
                </div>

                <div className="section-head" style={{ marginTop: 18 }}>
                  <h2>Danger Zone</h2>
                  <span className="tag">Typed confirm</span>
                </div>
                <form className="form form-single" action={archiveAndResetCompetitionAction}>
                  <input type="hidden" name="competitionId" value={competition.id} />
                  <label className="field">
                    <span>Type RESET to archive this competition and create a fresh one</span>
                    <input className="input" name="confirmation" placeholder="RESET" required />
                  </label>
                  <button className="btn danger" type="submit">Archive and Reset Competition</button>
                </form>
              </aside>
            </section>
          )}
        </>
      )}
    </main>
  );
}
