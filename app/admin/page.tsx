import {
  adminLoginAction,
  adminLogoutAction,
  approveEntryAction,
  archiveAndResetCompetitionAction,
  createInitialCompetitionAction,
  rejectEntryAction,
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
import { getYouTubeEmbedUrl } from '@/lib/youtube';

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

  return (
    <main className="page-shell page-stack">
      <SiteNav mutedText="Admin control room · moderation, judging, playback, archive/reset" />

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
                  <div className="full toolbar">
                    <button className="btn primary" type="submit">Save Competition Settings</button>
                  </div>
                </form>
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
                  <span className={`tag ${approvedEntries.length ? 'tag-live' : ''}`}>
                    {approvedEntries.length ? `${approvedEntries.length} in queue` : 'Empty'}
                  </span>
                </div>
                <div className={`card ${currentPlayback ? 'queue-now-card' : 'notice-card'}`}>
                  <strong>{currentPlayback ? 'Now on /playback' : 'No playback entry selected yet'}</strong>
                  <p className="muted">
                    {currentPlayback
                      ? `${currentPlayback.runningOrder ? `#${currentPlayback.runningOrder} · ` : ''}${currentPlayback.title}`
                      : 'Approve an entry to auto-add it to the queue.'}
                  </p>
                </div>
                <div className="list" style={{ marginTop: 12 }}>
                  {approvedEntries.length === 0 && (
                    <p className="muted">No approved entries yet. Approved entries appear here automatically.</p>
                  )}
                  {approvedEntries.map((entry) => {
                    const isCurrent = currentPlayback?.id === entry.id;
                    return (
                      <form key={entry.id} action={setPlaybackEntryAction} className={`queue-row ${isCurrent ? 'queue-row-current' : ''}`}>
                        <input type="hidden" name="competitionId" value={competition.id} />
                        <input type="hidden" name="entryId" value={entry.id} />
                        <div className="queue-row-meta">
                          <span className="queue-row-order">{entry.runningOrder ? `#${entry.runningOrder}` : '—'}</span>
                          <span className="queue-row-title">{entry.title}</span>
                          {isCurrent && <span className="tag tag-live">LIVE</span>}
                        </div>
                        <button className="btn secondary full-width-btn" type="submit" disabled={isCurrent}>
                          {isCurrent ? 'Currently Playing' : 'Send to /playback'}
                        </button>
                      </form>
                    );
                  })}
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
                  {[...pendingEntries, ...approvedEntries].map((entry) => {
                    const isApproved = entry.moderationStatus === 'Approved';
                    const isRejected = entry.moderationStatus === 'Rejected';
                    return (
                      <div key={entry.id} className={`card moderation-card ${isApproved ? 'is-approved' : isRejected ? 'is-rejected' : ''}`}>
                        <div className="entry-meta">
                          <div className="section-head" style={{ marginBottom: 4 }}>
                            <strong>{entry.title}</strong>
                            <span className={`tag ${isApproved ? 'tag-live' : isRejected ? 'tag-action' : ''}`}>
                              {isApproved ? `APPROVED #${entry.runningOrder ?? '?'}` : entry.moderationStatus}
                            </span>
                          </div>
                          <p className="muted">{entry.entrantName} · {entry.entrantEmail}</p>
                          <a className="muted inline-link" href={entry.youtubeUrl} target="_blank" rel="noopener noreferrer">Open YouTube Link</a>
                        </div>
                        <iframe
                          className="player"
                          src={getYouTubeEmbedUrl(entry.youtubeVideoId)}
                          title={`Preview: ${entry.title}`}
                          allow="autoplay; encrypted-media; picture-in-picture"
                          allowFullScreen
                        />
                        <p className="muted" style={{ margin: '12px 0 4px' }}>
                          {isApproved
                            ? 'In playback queue. Click Reject to remove it.'
                            : 'Press play above to verify the embed works, then choose:'}
                        </p>
                        <div className="moderation-actions-grid">
                          {!isApproved && (
                            <form action={approveEntryAction} className="approve-form">
                              <input type="hidden" name="competitionId" value={competition.id} />
                              <input type="hidden" name="entryId" value={entry.id} />
                              <button className="btn primary moderation-btn" type="submit">✓ Approve & Send to Queue</button>
                            </form>
                          )}
                          {!isRejected && (
                            <form action={rejectEntryAction} className="reject-form">
                              <input type="hidden" name="competitionId" value={competition.id} />
                              <input type="hidden" name="entryId" value={entry.id} />
                              <label className="field">
                                <span>Rejection comment (required, kept on record)</span>
                                <textarea
                                  className="textarea"
                                  name="rejectionReason"
                                  placeholder="e.g. Video is private, age-restricted, embedding disabled, or does not meet contest rules."
                                  defaultValue={entry.notes ?? ''}
                                  required
                                  minLength={5}
                                  rows={3}
                                />
                              </label>
                              <button className="btn danger moderation-btn" type="submit">✕ Reject</button>
                            </form>
                          )}
                        </div>
                      </div>
                    );
                  })}
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
