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

  // Only duplicate the track when we actually have enough logos to fill a
  // marquee. With one logo there's nothing to scroll past, so we render it
  // as a static badge anchored bottom-left.
  const shouldScroll = usable.length >= 3;
  const items = shouldScroll ? [...usable, ...usable] : usable;

  return (
    <div className={`sponsor-banner${shouldScroll ? '' : ' sponsor-banner-static'}`} aria-label="Competition sponsors">
      <span className="sponsor-banner-label">Sponsors</span>
      <div className="sponsor-marquee">
        <div className={`sponsor-track${shouldScroll ? '' : ' sponsor-track-static'}`}>
          {items.map((s, i) => {
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
