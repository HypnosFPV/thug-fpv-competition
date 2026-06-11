import { SiteFooter } from '@/components/SiteFooter';
import { SiteNav } from '@/components/SiteNav';
import { BRAND } from '@/lib/constants';

export const metadata = {
  title: 'Contact · THUG FPV Competition Platform'
};

export default function ContactPage() {
  return (
    <main className="page-shell page-stack">
      <SiteNav mutedText="Contact" />

      <section className="panel">
        <div className="section-head">
          <h2>Contact</h2>
          <span className="tag">Hypnos FPV</span>
        </div>

        <p className="muted">
          The Platform does not run an outbound email service, so the fastest way to reach Hypnos FPV is through the
          official channels below.
        </p>

        <div className="list">
          <a className="card link-card" href={BRAND.hypnosYoutube} target="_blank" rel="noopener noreferrer">
            <strong>Hypnos FPV on YouTube</strong>
            <p className="muted">Comment on the latest competition video or send a channel message.</p>
          </a>
          <a className="card link-card" href={BRAND.nappyYoutube} target="_blank" rel="noopener noreferrer">
            <strong>Nappy FPV on YouTube</strong>
            <p className="muted">Co-host channel for THUG events.</p>
          </a>
          <a className="card link-card" href={BRAND.merchUrl} target="_blank" rel="noopener noreferrer">
            <strong>THUG Merch Shop</strong>
            <p className="muted">Order inquiries handled through the shop.</p>
          </a>
          <a className="card link-card" href={BRAND.coffeeUrl} target="_blank" rel="noopener noreferrer">
            <strong>Buy Me a Coffee</strong>
            <p className="muted">Support the platform &mdash; messages enabled on the page.</p>
          </a>
        </div>

        <h3>Account &amp; entry issues</h3>
        <p className="muted">
          For login problems, replacement, or withdrawal questions, sign in and use the My Entries page. If you need
          your account fully deleted, reach out through any of the channels above and reference the email tied to your
          account.
        </p>

        <h3>Reporting an issue</h3>
        <p className="muted">
          Found a bug, an inappropriate entry, or a copyright concern? Reach out through Hypnos FPV&apos;s YouTube
          channel with details (entry title and competition name help us locate it). The admin will review and act.
        </p>
      </section>

      <SiteFooter />
    </main>
  );
}
