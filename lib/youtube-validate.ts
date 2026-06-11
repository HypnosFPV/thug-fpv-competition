import 'server-only';

interface OEmbedResponse {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
  html?: string;
}

export async function validateYouTubeEmbeddable(videoId: string): Promise<{ ok: true; title: string; author: string; thumbnailUrl: string } | { ok: false; reason: string }> {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`;

  try {
    const res = await fetch(oembedUrl, { cache: 'no-store' });

    if (res.status === 401) {
      return { ok: false, reason: 'This video has embedding disabled by its owner. Please use a different video or enable embedding in YouTube Studio.' };
    }
    if (res.status === 403) {
      return { ok: false, reason: 'This video is age-restricted or private and cannot be embedded for playback.' };
    }
    if (res.status === 404) {
      return { ok: false, reason: 'YouTube could not find that video. Check the URL.' };
    }
    if (!res.ok) {
      return { ok: false, reason: `YouTube returned status ${res.status}. The video may be unavailable for embedding.` };
    }

    const data = (await res.json()) as OEmbedResponse;
    if (!data?.title) {
      return { ok: false, reason: 'Could not read video details from YouTube. The video may not be embeddable.' };
    }

    return {
      ok: true,
      title: data.title,
      author: data.author_name ?? '',
      thumbnailUrl: data.thumbnail_url ?? ''
    };
  } catch {
    return { ok: false, reason: 'Could not reach YouTube to verify the video. Please try again.' };
  }
}
