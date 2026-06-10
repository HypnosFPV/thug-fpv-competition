import { judgeLoginAction, judgeLogoutAction, saveScoreAction } from '@/app/actions';
import { SiteNav } from '@/components/SiteNav';
import { getJudgeSession } from '@/lib/session';
import { getActiveCompetitionBundle, getApprovedEntries } from '@/lib/server-data';
import { getYouTubeEmbedUrl } from '@/lib/youtube';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function pickMessage(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function JudgePage({ searchParams }: { searchParams?: SearchParams }) {
  const params = (await searchParams) ?? {};
  const error = pickMessage(params.error);
  const success = pickMessage(params.success);
  const bundle = await getActiveCompetitionBundle();
  const competition = bundle.competition;
  const approvedEntries = getApprovedEntries(bundle.entries);
  const judgeSession = await getJudgeSession();
  const currentJudge = bundle.judgeSlots.find((slot) => slot.id === judgeSession?.judgeSlotId);
  const scoreByEntry = new Map(
    bundle.scores
      .filter((score) => score.judgeSlotId === judgeSession?.judgeSlotId)
      .map((score) => [score.entryId, score.score])
  );
  const canScore = competition?.status === 'Judging Live';

  return (
    <main className="page-shell page-stack">
      <SiteNav mutedText="Judge workspace · protected by event password, code, and PIN" />

      <section className="grid">
        <section className="panel span-4">
          <div className="section-head">
            <h2>Judge Access</h2>
            <span className="tag">Protected</span>
          </div>

          {success && <div className="card success-card"><strong>Success</strong><p className="muted">{success}</p></div>}
          {error && <div className="card error-card"><strong>Notice</strong><p className="muted">{error}</p></div>}

          {!judgeSession || !competition || judgeSession.competitionId !== competition.id ? (
            <form className="form form-single" action={judgeLoginAction}>
              <label className="field">
                <span>Shared event password</span>
                <input className="input" name="sharedEventPassword" type="password" placeholder="Event password" required />
              </label>
              <label className="field">
                <span>Judge Code</span>
                <input className="input" name="judgeCode" placeholder="J1" required />
              </label>
              <label className="field">
                <span>Judge PIN</span>
                <input className="input" name="judgePin" type="password" placeholder="4-digit PIN" required />
              </label>
              <button className="btn primary" type="submit" disabled={!bundle.configured || !competition}>Enter Judge Portal</button>
            </form>
          ) : (
            <div className="list">
              <div className="card">
                <strong>{currentJudge?.label ?? judgeSession.judgeCode}</strong>
                <p className="muted">Competition: {competition.name}</p>
                <p className="muted">Status: {competition.status}</p>
              </div>
              <form action={judgeLogoutAction}>
                <button className="btn secondary" type="submit">Log Out Judge</button>
              </form>
            </div>
          )}
        </section>

        <section className="panel span-8">
          <div className="section-head">
            <h2>Judge Workspace</h2>
            <span className="tag">Overall score only</span>
          </div>

          {!competition && <p className="muted">No active competition is available yet.</p>}
          {competition && !approvedEntries.length && <p className="muted">No approved entries are ready for judges yet.</p>}
          {competition && judgeSession && judgeSession.competitionId === competition.id && (
            <>
              {!canScore && (
                <div className="card notice-card" style={{ marginBottom: 12 }}>
                  <strong>Read-only mode</strong>
                  <p className="muted">Scores can only be edited while the competition status is Judging Live.</p>
                </div>
              )}
              <div className="list">
                {approvedEntries.map((entry, index) => (
                  <div className="card" key={entry.id}>
                    <div className="section-head">
                      <div>
                        <h3 style={{ marginBottom: 6 }}>{entry.title}</h3>
                        <p className="muted" style={{ margin: 0 }}>
                          Entry #{entry.runningOrder ?? index + 1} · {entry.entrantName}
                        </p>
                      </div>
                      <span className="tag">{scoreByEntry.has(entry.id) ? `Saved: ${scoreByEntry.get(entry.id)?.toFixed(1)}` : 'Unscored'}</span>
                    </div>
                    <iframe
                      className="player"
                      src={getYouTubeEmbedUrl(entry.youtubeVideoId)}
                      title={entry.title}
                      allow="autoplay; encrypted-media; picture-in-picture"
                      allowFullScreen
                    />
                    <form className="toolbar score-form" action={saveScoreAction}>
                      <input type="hidden" name="competitionId" value={competition.id} />
                      <input type="hidden" name="entryId" value={entry.id} />
                      <label className="field score-field">
                        <span>Overall score</span>
                        <input
                          className="input"
                          name="score"
                          type="number"
                          min="1"
                          max="10"
                          step="0.1"
                          defaultValue={scoreByEntry.get(entry.id)?.toFixed(1) ?? ''}
                          placeholder="8.7"
                          required
                          disabled={!canScore}
                        />
                      </label>
                      <button className="btn primary" type="submit" disabled={!canScore}>Save Score</button>
                    </form>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </section>
    </main>
  );
}
