'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';

import { saveScoreAction } from '@/app/actions';
import { getYouTubeEmbedUrl } from '@/lib/youtube';

type JudgeEntry = {
  id: string;
  title: string;
  entrantName: string;
  youtubeVideoId: string;
  runningOrder: number | null;
};

interface JudgeWorkspaceProps {
  competitionId: string;
  entries: JudgeEntry[];
  initialScores: Record<string, number>;
  canScore: boolean;
}

export function JudgeWorkspace({ competitionId, entries, initialScores, canScore }: JudgeWorkspaceProps) {
  const [index, setIndex] = useState(0);
  const [scores, setScores] = useState<Record<string, number>>(initialScores);
  const [draft, setDraft] = useState<number>(initialScores[entries[0]?.id] ?? 7.5);
  const [savingMsg, setSavingMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const total = entries.length;
  const current = entries[index];
  const savedScore = current ? scores[current.id] : undefined;

  // When current entry changes, reset the slider to the saved value or 7.5
  useEffect(() => {
    if (!current) return;
    setDraft(scores[current.id] ?? 7.5);
    setSavingMsg(null);
    setErrMsg(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const unscoredCount = useMemo(
    () => entries.filter((e) => scores[e.id] === undefined).length,
    [entries, scores]
  );

  const goPrev = () => {
    if (index > 0) setIndex(index - 1);
  };
  const goNext = () => {
    if (index < total - 1) setIndex(index + 1);
  };
  const jumpNextUnscored = () => {
    for (let i = index + 1; i < total; i += 1) {
      if (scores[entries[i].id] === undefined) {
        setIndex(i);
        return;
      }
    }
    // wrap from start
    for (let i = 0; i < index; i += 1) {
      if (scores[entries[i].id] === undefined) {
        setIndex(i);
        return;
      }
    }
  };

  const saveScore = () => {
    if (!current || !canScore) return;
    setErrMsg(null);
    setSavingMsg('Saving…');
    const fd = new FormData();
    fd.set('competitionId', competitionId);
    fd.set('entryId', current.id);
    fd.set('score', draft.toFixed(1));

    startTransition(async () => {
      try {
        await saveScoreAction(fd);
        // Server redirects, but in client transition we just update local state
        setScores((prev) => ({ ...prev, [current.id]: draft }));
        setSavingMsg(`Saved ${draft.toFixed(1)} for "${current.title}".`);
        // Auto-advance to next unscored entry
        setTimeout(() => {
          jumpNextUnscored();
        }, 500);
      } catch (err) {
        // Next.js server-action redirects throw NEXT_REDIRECT — treat as success
        const message = err instanceof Error ? err.message : '';
        if (message.includes('NEXT_REDIRECT')) {
          setScores((prev) => ({ ...prev, [current.id]: draft }));
          setSavingMsg(`Saved ${draft.toFixed(1)} for "${current.title}".`);
          setTimeout(() => jumpNextUnscored(), 500);
          return;
        }
        setErrMsg('Could not save the score. Try again.');
        setSavingMsg(null);
      }
    });
  };

  if (!current) {
    return <p className="muted">No approved entries are ready for judges yet.</p>;
  }

  const isSaved = savedScore !== undefined;

  return (
    <div className="judge-workspace">
      {!canScore && (
        <div className="card notice-card" style={{ marginBottom: 12 }}>
          <strong>Read-only mode</strong>
          <p className="muted">Scores can only be edited while the competition status is <strong>Judging Live</strong>. Ask the admin to switch the competition to <strong>Judging Live</strong>.</p>
        </div>
      )}

      <div className="judge-progress-row">
        <span className="muted" style={{ fontSize: '.88rem' }}>
          Entry <strong style={{ color: '#fff' }}>{index + 1}</strong> of <strong style={{ color: '#fff' }}>{total}</strong>
        </span>
        <span className="muted" style={{ fontSize: '.88rem' }}>
          {unscoredCount === 0 ? 'All entries scored ✓' : `${unscoredCount} unscored remaining`}
        </span>
      </div>

      <div className="card judge-card">
        <div className="section-head">
          <div>
            <h3 style={{ marginBottom: 6 }}>{current.title}</h3>
            <p className="muted" style={{ margin: 0 }}>
              Entry #{current.runningOrder ?? index + 1} · {current.entrantName}
            </p>
          </div>
          <span className={isSaved ? 'tag tag-live' : 'tag'}>
            {isSaved ? `Saved: ${savedScore!.toFixed(1)}` : 'Unscored'}
          </span>
        </div>

        <iframe
          className="player"
          src={getYouTubeEmbedUrl(current.youtubeVideoId)}
          title={current.title}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />

        <div className="judge-score-block">
          <div className="judge-score-label-row">
            <span className="muted" style={{ fontSize: '.88rem' }}>Score</span>
            <span className="judge-score-value">{draft.toFixed(1)}</span>
          </div>

          <input
            type="range"
            min="1"
            max="10"
            step="0.1"
            value={draft}
            onChange={(e) => setDraft(parseFloat(e.target.value))}
            disabled={!canScore || isPending}
            className="judge-slider"
            aria-label="Score slider"
          />

          <div className="judge-slider-marks" aria-hidden="true">
            <span>1.0</span>
            <span>2.5</span>
            <span>5.0</span>
            <span>7.5</span>
            <span>10.0</span>
          </div>

          <div className="judge-button-row">
            <button
              type="button"
              className="btn secondary"
              onClick={goPrev}
              disabled={index === 0 || isPending}
            >
              ← Previous
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={saveScore}
              disabled={!canScore || isPending}
            >
              {isPending ? 'Saving…' : (isSaved ? 'Update Score' : 'Save Score')}
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={goNext}
              disabled={index === total - 1 || isPending}
            >
              Next →
            </button>
          </div>

          {savingMsg && <p className="muted" style={{ marginTop: 8, fontSize: '.85rem', color: '#9aff9a' }}>{savingMsg}</p>}
          {errMsg && <p className="muted" style={{ marginTop: 8, fontSize: '.85rem', color: '#ff9a9a' }}>{errMsg}</p>}
        </div>
      </div>

      <div className="judge-quick-jump">
        {entries.map((e, i) => {
          const scored = scores[e.id] !== undefined;
          const active = i === index;
          return (
            <button
              key={e.id}
              type="button"
              className={`judge-chip${active ? ' active' : ''}${scored ? ' scored' : ''}`}
              onClick={() => setIndex(i)}
              title={e.title}
              disabled={isPending}
            >
              {i + 1}
              {scored ? ' ✓' : ''}
            </button>
          );
        })}
      </div>
    </div>
  );
}
