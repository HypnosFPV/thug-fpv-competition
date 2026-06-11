import { BrandHeader } from '@/components/BrandHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteNav } from '@/components/SiteNav';

const steps = [
  {
    title: '1. Sign in',
    body: 'Create a free account with email and password. Your account ties every entry to you so no one else can see it.'
  },
  {
    title: '2. Submit your YouTube link',
    body: 'Paste a public, embeddable YouTube link, give it a title, and confirm consent. The link is verified instantly — private or restricted videos are rejected at submit time.'
  },
  {
    title: '3. Track your entry privately',
    body: 'Visit My Entries to see your status: Pending, Approved, or Rejected (with the admin\u2019s comment). Replace or withdraw your entry any time while submissions are open.'
  },
  {
    title: '4. Watch the livestream',
    body: 'Approved entries are played on the host\u2019s livestream in the order the admin queues them. Final scores are calculated from the judge panel.'
  }
];

const rules = [
  'YouTube links only. Video must be Public and have embedding enabled.',
  'One entry per account per competition. You can Replace or Withdraw while submissions are open.',
  'No age-restricted, private, unlisted, or copyright-blocked videos.',
  'Pilot must own and have rights to all footage, music, and edits used.',
  'Admin reviews each entry. Rejections include a written reason from the admin.'
];

export default function HomePage() {
  return (
    <main className="page-shell page-stack">
      <SiteNav />
      <BrandHeader />

      <section className="grid">
        <section className="panel span-8">
          <div className="section-head">
            <h2>How It Works</h2>
            <span className="tag">For Pilots</span>
          </div>
          <p className="muted">
            A simple, private flow from submission to livestream. You only ever see your own entry.
          </p>
          <div className="list">
            {steps.map((item) => (
              <div className="card" key={item.title}>
                <strong>{item.title}</strong>
                <p className="muted">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <aside className="panel span-4">
          <div className="section-head">
            <h2>Get Started</h2>
            <span className="tag">Free</span>
          </div>
          <div className="list">
            <a className="card link-card" href="/submit">
              <strong>Submit Your Entry</strong>
              <p className="muted">Sign in and paste your YouTube link.</p>
            </a>
            <a className="card link-card" href="/my-entries">
              <strong>My Entries</strong>
              <p className="muted">See your status, replace, or withdraw.</p>
            </a>
            <a className="card link-card" href="/judge">
              <strong>Judge Portal</strong>
              <p className="muted">Judges only · password + code + PIN.</p>
            </a>
          </div>
        </aside>
      </section>

      <section className="panel">
        <div className="section-head">
          <h2>Entry Rules</h2>
          <span className="tag">Read Before Submitting</span>
        </div>
        <ul className="rules-list">
          {rules.map((rule) => (
            <li key={rule} className="rules-item">{rule}</li>
          ))}
        </ul>
        <p className="muted" style={{ marginTop: 12, fontSize: '.85rem' }}>
          Full terms: <a className="inline-link" href="/terms">Terms of Use</a> · Privacy: <a className="inline-link" href="/privacy">Privacy Policy</a>
        </p>
      </section>

      <SiteFooter />
    </main>
  );
}
