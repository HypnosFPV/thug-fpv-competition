import { NextRequest, NextResponse } from 'next/server';

function extractToken(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/\/status\/([A-Za-z0-9_-]+)/);
  if (match?.[1]) return match[1];
  if (/^[A-Za-z0-9_-]{8,}$/.test(trimmed)) return trimmed;
  return null;
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('token') ?? '';
  const token = extractToken(raw);

  if (!token) {
    return NextResponse.redirect(new URL(`/entries?error=${encodeURIComponent('Could not read a valid token from that input.')}`, request.url));
  }

  return NextResponse.redirect(new URL(`/status/${token}`, request.url));
}
