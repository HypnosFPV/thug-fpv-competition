import { BRAND, GENSPARK_LOGOS } from '@/lib/constants';

export function BrandHeader() {
  return (
    <header className="hero">
      <div className="brand-grid">
        <img src={GENSPARK_LOGOS.thug} alt="THUG logo" style={{ width: '100%', maxWidth: 760, justifySelf: 'center' }} />
        <div>
          <p className="eyebrow">Created by {BRAND.createdBy}</p>
          <h1>{BRAND.title}</h1>
          <p className="subhead">Presented by {BRAND.presentedBy} · YouTube-only competition intake, judging, and livestream playback.</p>
          <p className="muted">Public entry submission stays clean. Judge and admin tools appear only when those workflows are entered.</p>
          <div className="btn-row" style={{ marginTop: 22 }}>
            <a className="btn primary" href="/submit">Submit Entry</a>
            <a className="btn secondary" href="/judge">Judge Portal</a>
            <a className="btn secondary" href={BRAND.merchUrl} target="_blank" rel="noopener noreferrer">THUG Merch Shop</a>
            <a className="btn coffee" href={BRAND.coffeeUrl} target="_blank" rel="noopener noreferrer">Support on Buy Me a Coffee</a>
          </div>
        </div>
      </div>
      <div className="logo-row">
        <a className="logo-card" href={BRAND.hypnosYoutube} target="_blank">
          <img src={GENSPARK_LOGOS.hypnos} alt="Hypnos FPV logo" />
          <span className="muted">Hypnos FPV YouTube</span>
        </a>
        <a className="logo-card" href={BRAND.nappyYoutube} target="_blank">
          <img src={GENSPARK_LOGOS.nappy} alt="Nappy FPV logo" />
          <span className="muted">Nappy FPV YouTube</span>
        </a>
      </div>
    </header>
  );
}
