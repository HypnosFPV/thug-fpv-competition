import { BrandHeader } from '@/components/BrandHeader';
import { SiteNav } from '@/components/SiteNav';

const highlights = [
  {
    title: 'Entrant-first public submission',
    body: 'The public experience stays clean: title, creator info, YouTube link, consent, and submit.'
  },
  {
    title: 'Protected judging workflow',
    body: 'Judges enter the shared event password plus Judge Code and PIN, then score approved entries from 1.0 to 10.0.'
  },
  {
    title: 'OBS-ready playback',
    body: 'A dedicated playback route keeps livestream navigation simple with YouTube-only embedded playback.'
  },
  {
    title: 'Safe admin reset flow',
    body: 'Admin can archive and reset only with typed confirmation, while old judge codes and PINs are retired automatically.'
  }
];

export default function HomePage() {
  return (
    <main className="page-shell page-stack">
      <SiteNav />
      <BrandHeader />

      <section className="grid">
        <section className="panel span-8">
          <div className="section-head">
            <h2>Production Scaffold Progress</h2>
            <span className="tag">Next.js + Supabase</span>
          </div>
          <p className="muted">
            The scaffold is now split into dedicated routes so the public page stays simple and the judge/admin
            tooling lives behind separate workflows.
          </p>
          <div className="list">
            {highlights.map((item) => (
              <div className="card" key={item.title}>
                <strong>{item.title}</strong>
                <p className="muted">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <aside className="panel span-4">
          <div className="section-head">
            <h2>Core Routes</h2>
            <span className="tag">Scaffolded</span>
          </div>
          <div className="list">
            <a className="card link-card" href="/submit"><strong>/submit</strong><p className="muted">Entrant submission flow</p></a>
            <a className="card link-card" href="/judge"><strong>/judge</strong><p className="muted">Judge access and scoring preview</p></a>
            <a className="card link-card" href="/admin"><strong>/admin</strong><p className="muted">Competition control room</p></a>
            <a className="card link-card" href="/playback"><strong>/playback</strong><p className="muted">OBS Browser Source route</p></a>
          </div>
        </aside>
      </section>
    </main>
  );
}
