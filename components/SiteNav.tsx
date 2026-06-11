import Link from 'next/link';

const links = [
  { href: '/', label: 'Home' },
  { href: '/submit', label: 'Submit Entry' },
  { href: '/my-entries', label: 'My Entries' },
  { href: '/sponsor', label: 'Sponsor' },
  { href: '/judge', label: 'Judge Portal' },
  { href: '/admin', label: 'Admin' },
  { href: '/playback', label: 'OBS Playback' }
];

export function SiteNav({ mutedText }: { mutedText?: string }) {
  return (
    <nav className="nav">
      <div className="nav-group">
        {links.map((link) => (
          <Link key={link.href} className="nav-pill" href={link.href}>
            {link.label}
          </Link>
        ))}
      </div>
      <p className="muted" style={{ margin: 0 }}>{mutedText ?? 'THUG FPV Competition Platform'}</p>
    </nav>
  );
}
