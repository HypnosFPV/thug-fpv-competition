import { SiteFooter } from '@/components/SiteFooter';
import { SiteNav } from '@/components/SiteNav';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function pickValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function EntriesLookupPage({ searchParams }: { searchParams?: SearchParams }) {
  const params = (await searchParams) ?? {};
  const error = pickValue(params.error);

  return (
    <main className="page-shell page-stack">
      <SiteNav mutedText="Private entry lookup · token required" />
      <section className="panel narrow-panel">
        <div className="section-head">
          <h2>Look Up Your Entry</h2>
          <span className="tag tag-action">Private</span>
        </div>
        <p className="muted">
          Paste the private status link or token you received when you submitted. No other entries are visible
          on this site — only the one tied to your token.
        </p>

        {error && <div className="card error-card"><strong>Notice</strong><p className="muted">{error}</p></div>}

        <form className="form form-single" action="/entries/lookup">
          <label className="field">
            <span>Status token or full status URL</span>
            <input
              className="input"
              name="token"
              placeholder="Paste your link or token"
              autoComplete="off"
              required
            />
          </label>
          <button className="btn primary" type="submit">Open My Entry</button>
        </form>

        <div className="card notice-card" style={{ marginTop: 14 }}>
          <strong>Where do I find my token?</strong>
          <p className="muted">
            After you submitted your entry, the site showed a success card with a link like
            <code className="status-link-code-inline">/status/abc123...</code>. Save that link — it is the only
            way to see your entry status.
          </p>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
