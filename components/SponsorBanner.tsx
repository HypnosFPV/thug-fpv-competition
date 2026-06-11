type Sponsor = {
  id: string;
  sponsor_name: string;
  logo_url: string | null;
  website_url: string | null;
};

interface SponsorBannerProps {
  sponsors: Sponsor[];
}

export function SponsorBanner({ sponsors }: SponsorBannerProps) {
  const usable = sponsors.filter((s) => s.logo_url);
  if (usable.length === 0) return null;

  // Duplicate the list so the marquee loop is seamless
  const looped = [...usable, ...usable];

  return (
    <div className="sponsor-banner" aria-label="Competition sponsors">
      <div className="sponsor-banner-label">Sponsors</div>
      <div className="sponsor-marquee">
        <div className="sponsor-track">
          {looped.map((s, i) => {
            const img = (
              <img
                src={s.logo_url!}
                alt={s.sponsor_name}
                title={s.sponsor_name}
                className="sponsor-logo"
                loading="lazy"
              />
            );
            return (
              <div className="sponsor-item" key={`${s.id}-${i}`}>
                {s.website_url ? (
                  <a href={s.website_url} target="_blank" rel="noopener noreferrer">
                    {img}
                  </a>
                ) : (
                  img
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
