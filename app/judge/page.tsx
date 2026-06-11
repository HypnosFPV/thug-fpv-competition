import { judgeLoginAction, judgeLogoutAction } from '@/app/actions';
import { JudgeWorkspace } from '@/components/JudgeWorkspace';
import { SiteNav } from '@/components/SiteNav';
import { getJudgeSession } from '@/lib/session';
import { getActiveCompetitionBundle, getApprovedEntries } from '@/lib/server-data';

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
  const canScore = competition?.status === 'Judging Live';

  const myScores: Record<string, number> = {};
  for (const s of bundle.scores) {
    if (s.judgeSlotId === judgeSession?.judgeSlotId) {
      myScores[s.entryId] = s.score;
    }
  }

  const workspaceEntries = approvedEntries.map((e, i) => ({
    id: e.id,
    title: e.title,
    entrantName: e.entrantName,
    youtubeVideoId: e.youtubeVideoId,
    runningOrder: e.runningOrder ?? i + 1
  }));

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
                {!canScore && (
                  <p className="muted" style={{ marginTop: 8, fontSize: '.82rem' }}>
                    Scoring unlocks when admin sets status to <strong>Judging Live</strong>.
                  </p>
                )}
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
            <span className="tag">One entry at a time</span>
          </div>

          {!competition && <p className="muted">No active competition is available yet.</p>}
          {competition && !approvedEntries.length && <p className="muted">No approved entries are ready for judges yet.</p>}
          {competition && judgeSession && judgeSession.competitionId === competition.id && approvedEntries.length > 0 && (
            <JudgeWorkspace
              competitionId={competition.id}
              entries={workspaceEntries}
              initialScores={myScores}
              canScore={canScore}
            />
          )}
        </section>
      </section>
    </main>
  );
}
