import { SiteFooter } from '@/components/SiteFooter';
import { SiteNav } from '@/components/SiteNav';

export const metadata = {
  title: 'Privacy Policy · THUG FPV Competition Platform'
};

export default function PrivacyPage() {
  return (
    <main className="page-shell page-stack">
      <SiteNav mutedText="Privacy" />

      <section className="panel">
        <div className="section-head">
          <h2>Privacy Policy</h2>
          <span className="tag">Last updated: {new Date().toLocaleDateString()}</span>
        </div>

        <p className="muted">
          This site is operated by Hypnos FPV for the THUG FPV Competition Platform. We collect the minimum amount of
          information needed to run the competition and we do not sell, share, or use your data for advertising.
        </p>

        <h3>What we collect</h3>
        <ul className="rules-list">
          <li className="rules-item"><strong>Account information:</strong> the email address and password you provide when you sign up. Passwords are stored hashed by our authentication provider (Supabase) and are never visible to us.</li>
          <li className="rules-item"><strong>Entry information:</strong> the pilot name you enter, the title of your video, the YouTube URL, optional notes, and timestamps. This is tied to your account so only you (and the admin) can see it.</li>
          <li className="rules-item"><strong>Moderation history:</strong> approval or rejection status and any admin comment attached to a rejection.</li>
          <li className="rules-item"><strong>Operational logs:</strong> a simple audit trail of submissions, approvals, rejections, and score events. This stays internal to the admin.</li>
        </ul>

        <h3>What we do NOT collect</h3>
        <ul className="rules-list">
          <li className="rules-item">No mailing address, phone number, or government ID.</li>
          <li className="rules-item">No payment information. The platform is free to enter.</li>
          <li className="rules-item">No third-party analytics, advertising, or tracking pixels.</li>
          <li className="rules-item">No marketing emails. We do not run any outbound email service.</li>
        </ul>

        <h3>How your data is used</h3>
        <ul className="rules-list">
          <li className="rules-item">To let you sign in, submit, view, replace, or withdraw your entry.</li>
          <li className="rules-item">To allow the admin to review entries and judges to score approved entries.</li>
          <li className="rules-item">To embed your YouTube link on the livestream playback view that only the admin and judges can see.</li>
        </ul>

        <h3>Who can see your entry</h3>
        <ul className="rules-list">
          <li className="rules-item"><strong>You</strong> — through your account on the My Entries page.</li>
          <li className="rules-item"><strong>The admin</strong> — for moderation, playback queueing, and scoring.</li>
          <li className="rules-item"><strong>Approved judges</strong> — only after a competition reaches the judging phase, and only approved entries.</li>
          <li className="rules-item"><strong>The public livestream audience</strong> — your video is embedded on the host&apos;s livestream when the admin queues it for playback. The audience sees what is on YouTube, not your account email.</li>
        </ul>

        <h3>Third parties</h3>
        <p className="muted">
          The platform runs on Supabase (database and authentication) and Vercel (hosting). YouTube is used to host and
          embed video. Each has its own privacy policy. We do not use any other third-party service.
        </p>

        <h3>Your rights</h3>
        <ul className="rules-list">
          <li className="rules-item"><strong>Withdraw your entry</strong> at any time while submissions are open, from the My Entries page.</li>
          <li className="rules-item"><strong>Request account deletion</strong> by contacting Hypnos FPV (see <a className="inline-link" href="/contact">Contact</a>).</li>
          <li className="rules-item"><strong>Request a copy</strong> of any data tied to your account by contacting us.</li>
        </ul>

        <h3>Data retention</h3>
        <p className="muted">
          Entry data is retained for the duration of the active competition and archived afterward for record-keeping.
          Account credentials remain in Supabase until you request deletion.
        </p>

        <h3>Security</h3>
        <p className="muted">
          Access to admin and judge tools is protected by passwords and per-judge PINs. The OBS playback route is gated
          to admin and judges only. No entry data is exposed on any public-facing list.
        </p>

        <h3>Children</h3>
        <p className="muted">
          The platform is intended for entrants 13 years and older. Younger participants should have a parent or
          guardian submit on their behalf.
        </p>

        <h3>Contact</h3>
        <p className="muted">
          Questions about privacy? See <a className="inline-link" href="/contact">Contact</a>.
        </p>
      </section>

      <SiteFooter />
    </main>
  );
}
