'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { SiteNav } from '@/components/SiteNav';
import { supabaseBrowser } from '@/lib/supabase-browser';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get('next') ?? '/submit';
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabaseBrowser.auth.getSession().then(({ data }) => {
      if (data.session) router.replace(redirectTo);
    });
  }, [router, redirectTo]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);

    try {
      if (mode === 'signup') {
        const { error: signUpError } = await supabaseBrowser.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: name || email.split('@')[0] }
          }
        });
        if (signUpError) {
          setError(signUpError.message);
          return;
        }
        const { error: signInError } = await supabaseBrowser.auth.signInWithPassword({ email, password });
        if (signInError) {
          setError(signInError.message);
          return;
        }
      } else {
        const { error: signInError } = await supabaseBrowser.auth.signInWithPassword({ email, password });
        if (signInError) {
          setError(signInError.message);
          return;
        }
      }
      router.replace(redirectTo);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel narrow-panel">
      <div className="section-head">
        <h2>{mode === 'signup' ? 'Create Account' : 'Sign In'}</h2>
        <span className="tag">{mode === 'signup' ? 'New here' : 'Returning'}</span>
      </div>

      <p className="muted">
        {mode === 'signup'
          ? 'Create a free account to submit and track your entries. No email verification required.'
          : 'Sign in to submit entries and see your private entry status.'}
      </p>

      {error && <div className="card error-card"><strong>Notice</strong><p className="muted">{error}</p></div>}

      <form className="form form-single" onSubmit={handleSubmit}>
        {mode === 'signup' && (
          <label className="field">
            <span>Display name</span>
            <input
              className="input"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Pilot / creator name"
              required
            />
          </label>
        )}
        <label className="field">
          <span>Email</span>
          <input
            className="input"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            className="input"
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          />
        </label>
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? 'Working…' : mode === 'signup' ? 'Create Account & Sign In' : 'Sign In'}
        </button>
      </form>

      <p className="muted" style={{ marginTop: 14 }}>
        {mode === 'signup' ? 'Already have an account?' : 'Need an account?'}{' '}
        <button
          type="button"
          className="inline-link"
          style={{ background: 'none', border: 'none', color: 'var(--purple-2)', cursor: 'pointer', padding: 0 }}
          onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(null); }}
        >
          {mode === 'signup' ? 'Sign in' : 'Create one'}
        </button>
      </p>
    </section>
  );
}

export default function LoginPage() {
  return (
    <main className="page-shell page-stack">
      <SiteNav mutedText="Account login · required to submit entries" />
      <Suspense fallback={<section className="panel narrow-panel"><p className="muted">Loading…</p></section>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
