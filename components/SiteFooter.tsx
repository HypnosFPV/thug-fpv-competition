import { BRAND } from '@/lib/constants';

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div className="footer-col">
          <strong>THUG FPV Competition Platform</strong>
          <p className="muted">
            Created by {BRAND.createdBy}. Presented by {BRAND.presentedBy}.
          </p>
          <p className="muted footer-fineprint">
            YouTube-only competition intake, judging, and livestream playback. Not affiliated with or endorsed by YouTube, Google, or any drone manufacturer.
          </p>
        </div>

        <div className="footer-col">
          <strong>Site</strong>
          <ul className="footer-list">
            <li><a className="inline-link" href="/">Home</a></li>
            <li><a className="inline-link" href="/submit">Submit Entry</a></li>
            <li><a className="inline-link" href="/my-entries">My Entries</a></li>
            <li><a className="inline-link" href="/judge">Judge Portal</a></li>
          </ul>
        </div>

        <div className="footer-col">
          <strong>Hypnos FPV</strong>
          <ul className="footer-list">
            <li><a className="inline-link" href={BRAND.hypnosYoutube} target="_blank" rel="noopener noreferrer">Hypnos FPV YouTube</a></li>
            <li><a className="inline-link" href={BRAND.nappyYoutube} target="_blank" rel="noopener noreferrer">Nappy FPV YouTube</a></li>
            <li><a className="inline-link" href={BRAND.merchUrl} target="_blank" rel="noopener noreferrer">THUG Merch Shop</a></li>
            <li><a className="inline-link" href={BRAND.coffeeUrl} target="_blank" rel="noopener noreferrer">Buy Me a Coffee</a></li>
          </ul>
        </div>

        <div className="footer-col">
          <strong>Legal</strong>
          <ul className="footer-list">
            <li><a className="inline-link" href="/privacy">Privacy Policy</a></li>
            <li><a className="inline-link" href="/terms">Terms of Use</a></li>
            <li><a className="inline-link" href="/contact">Contact</a></li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <span className="muted">© {year} Hypnos FPV. All rights reserved.</span>
        <span className="muted">Built with Next.js · Supabase · Vercel</span>
      </div>
    </footer>
  );
}
