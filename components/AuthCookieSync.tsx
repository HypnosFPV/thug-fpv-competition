'use client';

import { useEffect } from 'react';

import { supabaseBrowser } from '@/lib/supabase-browser';

const COOKIE_NAME = 'thug-fpv-access-token';

function setCookie(value: string, maxAgeSeconds: number) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${COOKIE_NAME}=${value}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`;
}

function clearCookie() {
  document.cookie = `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function AuthCookieSync() {
  useEffect(() => {
    let cancelled = false;

    supabaseBrowser.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      const token = data.session?.access_token;
      if (token) setCookie(token, 60 * 60 * 12);
      else clearCookie();
    });

    const { data: sub } = supabaseBrowser.auth.onAuthStateChange((_event, session) => {
      const token = session?.access_token;
      if (token) setCookie(token, 60 * 60 * 12);
      else clearCookie();
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return null;
}
