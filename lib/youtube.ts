export function extractYouTubeId(input: string): string | null {
  if (!input) return null;

  const patterns = [
    /(?:youtube\.com\/watch\?v=)([A-Za-z0-9_-]{11})/,
    /(?:youtu\.be\/)([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match?.[1]) return match[1];
  }

  return null;
}

export function getYouTubeEmbedUrl(videoId: string) {
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`;
}

/**
 * Format a seconds count as Mm Ss (e.g. "1m 30s" or "45s").
 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0s';
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m === 0) return `${r}s`;
  if (r === 0) return `${m}m`;
  return `${m}m ${r}s`;
}

/**
 * Parse ISO 8601 duration like "PT1M30S" or "PT45S" or "PT2H5M" to seconds.
 */
function parseIsoDuration(iso: string): number | null {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return null;
  const h = parseInt(m[1] || '0', 10);
  const min = parseInt(m[2] || '0', 10);
  const sec = parseInt(m[3] || '0', 10);
  const total = h * 3600 + min * 60 + sec;
  return total > 0 ? total : null;
}

/**
 * Fetch the public YouTube watch page and scrape the duration from
 * `<meta itemprop="duration" content="PT...">`. Free, no API key needed.
 * Returns null if duration cannot be determined (network/parse issue).
 */
async function fetchYouTubeDurationSeconds(videoId: string): Promise<number | null> {
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; THUG-FPV-Comp/1.0; +https://thug-fpv-competition.vercel.app)'
      }
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Primary: <meta itemprop="duration" content="PT1M30S">
    const meta = /itemprop="duration"\s+content="(PT[^"]+)"/.exec(html);
    if (meta?.[1]) {
      const parsed = parseIsoDuration(meta[1]);
      if (parsed) return parsed;
    }

    // Fallback: "approxDurationMs":"90000"
    const ms = /"approxDurationMs":"(\d+)"/.exec(html);
    if (ms?.[1]) {
      const seconds = Math.round(parseInt(ms[1], 10) / 1000);
      if (seconds > 0) return seconds;
    }

    // Fallback: "lengthSeconds":"90"
    const ls = /"lengthSeconds":"(\d+)"/.exec(html);
    if (ls?.[1]) {
      const seconds = parseInt(ls[1], 10);
      if (seconds > 0) return seconds;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Verify a YouTube video is publicly embeddable AND (optionally) within a max
 * duration. Free, no API key needed. Returns { ok, title, durationSeconds, error }.
 *
 * - ok=true                : video exists, is embeddable, and meets duration cap
 * - ok=false               : video is private, deleted, age-restricted, region-blocked,
 *                            embedding disabled, or too long. `error` is user-facing.
 * - durationSeconds: number | null — best-effort detected duration
 */
export async function verifyYouTubeEmbeddable(
  videoId: string,
  options: { maxSeconds?: number | null } = {}
): Promise<{
  ok: boolean;
  title?: string;
  durationSeconds?: number | null;
  error?: string;
}> {
  if (!videoId) {
    return { ok: false, error: 'Could not read a YouTube video ID from that link.' };
  }

  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(
    `https://www.youtube.com/watch?v=${videoId}`
  )}&format=json`;

  let title: string | undefined;

  try {
    const res = await fetch(oembedUrl, {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    });

    if (res.status === 401) {
      return {
        ok: false,
        error:
          'This video has embedding disabled. Please make sure your video is Public and that embedding is allowed in YouTube Studio.'
      };
    }
    if (res.status === 403) {
      return {
        ok: false,
        error:
          'This video is age-restricted or region-blocked, so it cannot be embedded. Please upload a public, non-age-restricted version.'
      };
    }
    if (res.status === 404) {
      return {
        ok: false,
        error:
          'YouTube could not find this video. Please confirm the link is correct and that the video is Public (not Private or Unlisted).'
      };
    }
    if (!res.ok) {
      return {
        ok: false,
        error:
          'YouTube rejected this video for embedded playback. Please make sure the video is Public and embedding is enabled.'
      };
    }

    const data = (await res.json()) as { title?: string };
    title = data.title;
  } catch {
    // Network hiccup on oEmbed — don't block on infrastructure flake unless we
    // still need to enforce a duration cap, in which case we'll fail-open below.
  }

  // Duration check — only when a max is configured
  const max = options.maxSeconds;
  if (typeof max === 'number' && Number.isFinite(max) && max > 0) {
    const duration = await fetchYouTubeDurationSeconds(videoId);
    if (duration !== null && duration > max) {
      return {
        ok: false,
        title,
        durationSeconds: duration,
        error: `This competition has a maximum video length of ${formatDuration(
          max
        )}. Your video is ${formatDuration(
          duration
        )} long. Please upload a shorter cut and try again.`
      };
    }
    return { ok: true, title, durationSeconds: duration };
  }

  return { ok: true, title };
}
