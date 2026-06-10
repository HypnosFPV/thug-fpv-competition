import { BrandHeader } from '@/components/BrandHeader';
import { SiteNav } from '@/components/SiteNav';
import { submitEntryAction } from '@/app/actions';
import { getActiveCompetitionBundle } from '@/lib/server-data';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function pickMessage(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SubmitPage({ searchParams }: { searchParams?: SearchParams }) {
  const params = (await searchParams) ?? {};
  const bundle = await getActiveCompetitionBundle();
  const error = pickMessage(params.error);
  const success = pickMessage(params.success);
  const competition = bundle.competition;
  const submissionsOpen = competition?.status === 'Submissions Open';

  return (
    <main className="page-shell page-stack">
      <SiteNav mutedText="Clean public intake · YouTube-only submissions" />
      <BrandHeader />

      <section className="grid">
        <section className="panel span-8 submit-highlight">
          <div className="section-head">
            <h2>Submit Your Entry</h2>
            <span className="tag tag-action">Action required</span>
          </div>
          <p className="muted">
            Clean entrant flow only. Your YouTube link is saved as a pending entry, then the admin verifies
            playback before it appears for judging or OBS playback.
          </p>

          {!bundle.configured && (
            <div className="card notice-card">
              <strong>Setup required</strong>
              <p className="muted">Add your Supabase environment variables before live submissions can be stored.</p>
            </div>
          )}

          {competition && (
            <div className="card notice-card">
              <strong>{competition.name}</strong>
              <p className="muted">Current status: {competition.status}</p>
            </div>
          )}

          {success && <div className="card success-card"><strong>Success</strong><p className="muted">{success}</p></div>}
          {error && <div className="card error-card"><strong>Notice</strong><p className="muted">{error}</p></div>}

          <form className="form" action={submitEntryAction}>
            <input type="hidden" name="competitionId" value={competition?.id ?? ''} />
            <label className="field">
              <span>Entrant name</span>
              <input className="input" name="entrantName" placeholder="Pilot / creator name" required />
            </label>
            <label className="field">
              <span>Email</span>
              <input className="input" name="entrantEmail" type="email" placeholder="name@example.com" required />
            </label>
            <label className="field full">
              <span>Entry title</span>
              <input className="input" name="title" placeholder="My THUG FPV run" required />
            </label>
            <label className="field full">
              <span>YouTube URL</span>
              <input className="input" name="youtubeUrl" placeholder="https://www.youtube.com/watch?v=..." required />
            </label>
            <label className="field full">
              <span>Notes</span>
              <textarea className="textarea" name="notes" placeholder="Optional notes for the admin team" />
            </label>
            <label className="field full checkbox-field">
              <span className="checkbox-line">
                <input name="consent" type="checkbox" value="yes" required />
                <span>I confirm that I own this content and allow livestream playback for competition use.</span>
              </span>
            </label>
            <div className="full toolbar">
              <button className="btn primary" type="submit" disabled={!bundle.configured || !competition || !submissionsOpen}>
                {submissionsOpen ? 'Submit Entry' : 'Submissions Currently Closed'}
              </button>
            </div>
          </form>
        </section>

        <aside className="panel span-4">
          <div className="section-head">
            <h2>Entry Rules</h2>
          </div>
          <div className="list">
            <div className="card"><strong>YouTube only</strong><p className="muted">No direct uploads, Instagram, or TikTok in this build.</p></div>
            <div className="card"><strong>Embeddable playback required</strong><p className="muted">Private, age-restricted, or embed-disabled videos should be rejected.</p></div>
            <div className="card"><strong>Admin moderation</strong><p className="muted">Every entry is reviewed before it appears in judge and OBS playback queues.</p></div>
          </div>
        </aside>
      </section>
    </main>
  );
}
