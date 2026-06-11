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
 * Verify a YouTube video is publicly embeddable by calling oEmbed.
 * Free, no API key needed. Returns { ok, title, error }.
 *
 * - ok=true   : video exists and is embeddable
 * - ok=false  : video is private, deleted, age-restricted, region-blocked, or
 *               has embedding disabled. `error` is a user-facing message.
 */
export async function verifyYouTubeEmbeddable(videoId: string): Promise<{
  ok: boolean;
  title?: string;
  error?: string;
}> {
  if (!videoId) {
    return { ok: false, error: 'Could not read a YouTube video ID from that link.' };
  }

  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(
    `https://www.youtube.com/watch?v=${videoId}`
  )}&format=json`;

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
    return { ok: true, title: data.title };
  } catch {
    // Network hiccup — don't block submission on infrastructure flake.
    return { ok: true };
  }
}
