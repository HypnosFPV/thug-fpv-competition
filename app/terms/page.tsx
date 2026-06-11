import { SiteFooter } from '@/components/SiteFooter';
import { SiteNav } from '@/components/SiteNav';

export const metadata = {
  title: 'Terms of Use · THUG FPV Competition Platform'
};

export default function TermsPage() {
  return (
    <main className="page-shell page-stack">
      <SiteNav mutedText="Terms of Use" />

      <section className="panel">
        <div className="section-head">
          <h2>Terms of Use</h2>
          <span className="tag">Last updated: {new Date().toLocaleDateString()}</span>
        </div>

        <p className="muted">
          By creating an account or submitting an entry to the THUG FPV Competition Platform (the &ldquo;Platform&rdquo;),
          you agree to these terms.
        </p>

        <h3>1. Eligibility</h3>
        <ul className="rules-list">
          <li className="rules-item">You must be 13 years of age or older. Entrants under 18 should have a parent or guardian aware of and consenting to participation.</li>
          <li className="rules-item">You must own and have full rights to the footage, music, edits, and any other content in your submitted video.</li>
        </ul>

        <h3>2. Submissions</h3>
        <ul className="rules-list">
          <li className="rules-item">Entries must be a Public YouTube video with embedding enabled. Private, Unlisted, age-restricted, region-blocked, or copyright-strike-flagged videos are not eligible.</li>
          <li className="rules-item">One entry per account per competition. You may Replace or Withdraw your entry while submissions are open; doing so resets your entry to Pending re-verification by the admin.</li>
          <li className="rules-item">The admin reviews every entry. Rejections include a written reason visible to you on the My Entries page.</li>
          <li className="rules-item">Submitting an entry does not transfer ownership of your video. You retain all rights.</li>
        </ul>

        <h3>3. License you grant by submitting</h3>
        <p className="muted">
          You grant Hypnos FPV a non-exclusive, royalty-free license to embed and play your YouTube video on the
          Platform&apos;s playback view, on the livestream, and on related promotional content for the competition. This
          license is limited to the YouTube embed itself &mdash; we do not download, re-host, or re-distribute the
          underlying file.
        </p>

        <h3>4. Conduct</h3>
        <ul className="rules-list">
          <li className="rules-item">No content that is illegal, hateful, harassing, sexually explicit, or that endangers people, animals, or aircraft.</li>
          <li className="rules-item">No content that violates YouTube&apos;s Community Guidelines or Terms of Service.</li>
          <li className="rules-item">No attempts to bypass the admin/judge access controls, scrape data, or impersonate other entrants.</li>
        </ul>

        <h3>5. Judging and results</h3>
        <ul className="rules-list">
          <li className="rules-item">Judges score on a 1.0&ndash;10.0 scale. Final placement is decided by the admin based on judge averages and any tie-break process announced for the event.</li>
          <li className="rules-item">All judging decisions are final.</li>
          <li className="rules-item">The Platform does not handle prizes, payouts, or shipping. Any prize-related obligations are between Hypnos FPV and the entrant directly.</li>
        </ul>

        <h3>6. No fees</h3>
        <p className="muted">
          Entry is free. The Platform does not charge entrants, judges, or viewers, and does not collect payment
          information.
        </p>

        <h3>7. Availability</h3>
        <p className="muted">
          The Platform is provided &ldquo;as is.&rdquo; We may pause, reset, archive, or end any competition at our
          discretion. Brief outages may occur due to hosting or third-party (Supabase, Vercel, YouTube) issues.
        </p>

        <h3>8. Disclaimer of warranties</h3>
        <p className="muted">
          To the maximum extent allowed by law, the Platform is provided without warranties of any kind, express or
          implied, including merchantability, fitness for a particular purpose, and non-infringement.
        </p>

        <h3>9. Limitation of liability</h3>
        <p className="muted">
          Hypnos FPV and the Platform operators are not liable for indirect, incidental, special, or consequential
          damages arising from your use of the Platform, including loss of an entry, missed playback, or video removal
          by YouTube.
        </p>

        <h3>10. Termination</h3>
        <p className="muted">
          We may suspend or remove accounts and entries that violate these terms. You may delete your account at any
          time by contacting us.
        </p>

        <h3>11. Changes</h3>
        <p className="muted">
          These terms may change as the Platform evolves. Continued use after an update constitutes acceptance.
        </p>

        <h3>12. Contact</h3>
        <p className="muted">
          Questions? See <a className="inline-link" href="/contact">Contact</a>.
        </p>
      </section>

      <SiteFooter />
    </main>
  );
}
