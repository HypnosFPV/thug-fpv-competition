'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { supabaseBrowser } from '@/lib/supabase-browser';

export function AuthBar() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    supabaseBrowser.auth.getSession().then(({ data }) => {
      if (!active) return;
      setEmail(data.session?.user.email ?? null);
      setLoaded(true);
    });

    const { data: sub } = supabaseBrowser.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null);
      router.refresh();
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  async function handleSignOut() {
    await supabaseBrowser.auth.signOut();
    router.push('/');
    router.refresh();
  }

  if (!loaded) return null;

  if (!email) {
    return (
      <div className="auth-bar">
        <a className="btn secondary" href="/login">Sign In</a>
      </div>
    );
  }

  return (
    <div className="auth-bar">
      <span className="muted">Signed in as <strong>{email}</strong></span>
      <a className="btn secondary" href="/my-entries">My Entries</a>
      <button type="button" className="btn secondary" onClick={handleSignOut}>Sign Out</button>
    </div>
  );
}
