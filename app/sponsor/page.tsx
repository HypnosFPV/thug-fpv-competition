import { submitSponsorAction } from '@/app/actions';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteNav } from '@/components/SiteNav';
import { getActiveCompetitionBundle } from '@/lib/server-data';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function pickMessage(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SponsorPage({ searchParams }: { searchParams?: SearchParams }) {
  const params = (await searchParams) ?? {};
  const success = pickMessage(params.success);
  const error = pickMessage(params.error);
  const bundle = await getActiveCompetitionBundle();
  const competition = bundle.competition;

  return (
    <main className="page-shell page-stack">
      <SiteNav mutedText="Sponsor a prize for the competition" />

      <section className="grid">
        <section className="panel span-8">
          <div className="section-head">
            <h2>Sponsor a Prize</h2>
            <span className="tag tag-action">Public form</span>
          </div>
          <p className="muted">
            Sponsoring a prize for the THUG FPV Competition? Fill out the form below. Your logo will appear on the
            livestream banner once an admin approves your sponsorship. Sponsor details stay private to the admin team
            and are archived with the competition.
          </p>

          {!bundle.configured && (
            <div className="card notice-card">
              <strong>Setup required</strong>
              <p className="muted">Supabase environment variables are not configured.</p>
            </div>
          )}

          {competition && (
            <div className="card notice-card">
              <strong>{competition.name}</strong>
              <p className="muted">Current status: {competition.status}</p>
            </div>
          )}

          {success && <div className="card success-card"><strong>Thank you</strong><p className="muted">{success}</p></div>}
          {error && <div className="card error-card"><strong>Notice</strong><p className="muted">{error}</p></div>}

          {competition && (
            <form className="form" action={submitSponsorAction} encType="multipart/form-data">
              <input type="hidden" name="competitionId" value={competition.id} />
              <label className="field">
                <span>Sponsor / company name</span>
                <input className="input" name="sponsorName" placeholder="ACME Drones" required />
              </label>
              <label className="field">
                <span>Contact name</span>
                <input className="input" name="contactName" placeholder="Your name (optional)" />
              </label>
              <label className="field">
                <span>Contact email</span>
                <input className="input" name="contactEmail" type="email" placeholder="you@company.com (optional)" />
              </label>
              <label className="field">
                <span>Website</span>
                <input className="input" name="websiteUrl" type="url" placeholder="https://yourcompany.com (optional)" />
              </label>
              <label className="field full">
                <span>Prize description</span>
                <textarea
                  className="textarea"
                  name="prizeDescription"
                  placeholder="e.g. $200 store credit + custom frame kit for 1st place"
                  required
                />
              </label>
              <label className="field full">
                <span>Logo upload (PNG, JPG, WebP, SVG, or GIF · max 4 MB)</span>
                <input
                  className="input"
                  name="logo"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
                  required
                />
                <small className="muted" style={{ marginTop: 4, fontSize: '.78rem' }}>
                  Use a square or wide transparent-background logo for best look on the scrolling banner.
                </small>
              </label>
              <label className="field full checkbox-field">
                <span className="checkbox-line">
                  <input name="consent" type="checkbox" value="yes" required />
                  <span>
                    I confirm I have the right to provide this logo and consent to it being shown on the competition&apos;s
                    livestream banner and promotional materials.
                  </span>
                </span>
              </label>
              <div className="full toolbar">
                <button className="btn primary" type="submit" disabled={!bundle.configured || !competition}>
                  Submit Sponsorship
                </button>
              </div>
            </form>
          )}
        </section>

        <aside className="panel span-4">
          <div className="section-head">
            <h2>How It Works</h2>
          </div>
          <div className="list">
            <div className="card">
              <strong>1. Submit</strong>
              <p className="muted">Fill the form with your logo and prize details.</p>
            </div>
            <div className="card">
              <strong>2. Admin reviews</strong>
              <p className="muted">An admin checks your submission and approves it for the livestream banner.</p>
            </div>
            <div className="card">
              <strong>3. Logo goes live</strong>
              <p className="muted">Your logo rotates on the OBS playback banner during the competition stream.</p>
            </div>
            <div className="card">
              <strong>Private by default</strong>
              <p className="muted">Your contact details are only visible to the admin team. They are never shown publicly.</p>
            </div>
          </div>
        </aside>
      </section>

      <SiteFooter />
    </main>
  );
}
