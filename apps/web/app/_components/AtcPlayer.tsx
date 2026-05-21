'use client';

import { useEffect, useRef, useState } from 'react';
import type { AirportCode } from '@airport-pong/shared';
import {
  ATC_FEEDS,
  ATC_FREQ_LABEL,
  atcStreamUrl,
  suggestedFreq,
  type AtcFreq,
} from '../../lib/atc-feeds';

type Props = {
  airport: AirportCode;
  mode: 'takeoff' | 'landing' | 'hour';
  accent: string;
};

/**
 * LiveATC.net audio player. Streams free AAC from volunteer receivers.
 * Autoplay is blocked by browsers — user clicks ▶ to start.
 * Streams can go offline; we surface error state clearly.
 */
export function AtcPlayer({ airport, mode, accent }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [freq, setFreq] = useState<AtcFreq>(suggestedFreq(mode));
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0.7);

  // When mode changes, suggest the matching freq (but don't override user choice)
  const lastModeRef = useRef(mode);
  useEffect(() => {
    if (lastModeRef.current !== mode) {
      lastModeRef.current = mode;
      setFreq(suggestedFreq(mode));
    }
  }, [mode]);

  const feed = ATC_FEEDS[airport];
  const slug = feed[freq] ?? feed.twr ?? '';
  const url = slug ? atcStreamUrl(slug, airport) : '';

  // Pause when airport / freq changes (browser quirk: src change requires reload)
  useEffect(() => {
    setError(null);
    if (!audioRef.current) return;
    const a = audioRef.current;
    if (playing) {
      a.load();
      a.play().catch((e) => {
        setError(e.message);
        setPlaying(false);
      });
    }
    // We intentionally don't include `playing` in deps — only react to URL changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      setError(null);
      a.play()
        .then(() => setPlaying(true))
        .catch((e) => {
          setError(e.message);
          setPlaying(false);
        });
    }
  };

  return (
    <div className={`atc-player ${playing ? 'on' : ''}`}>
      <button
        type="button"
        className="atc-btn"
        onClick={toggle}
        title={playing ? 'Pause ATC' : 'Listen to ATC'}
        style={playing ? { background: accent, color: 'var(--bg-1)' } : {}}
      >
        {playing ? (
          <svg viewBox="0 0 12 12" width="12" height="12">
            <rect x="2" y="1.5" width="3" height="9" fill="currentColor" />
            <rect x="7" y="1.5" width="3" height="9" fill="currentColor" />
          </svg>
        ) : (
          <svg viewBox="0 0 12 12" width="12" height="12">
            <path d="M 2.5 1 L 10 6 L 2.5 11 Z" fill="currentColor" />
          </svg>
        )}
      </button>

      <span className="atc-label mono">
        <span className="atc-ap" style={{ color: accent }}>{airport}</span>
        <span className="atc-divider">·</span>
        <span>ATC</span>
        {playing && <span className="atc-live mono">● LIVE</span>}
      </span>

      <div className="atc-freqs">
        {(['gnd', 'twr', 'app'] as AtcFreq[])
          .filter((f) => feed[f])
          .map((f) => (
            <button
              key={f}
              type="button"
              className={`atc-freq ${freq === f ? 'on' : ''}`}
              onClick={() => setFreq(f)}
              style={freq === f ? { borderColor: accent, color: accent } : {}}
            >
              {ATC_FREQ_LABEL[f]}
            </button>
          ))}
      </div>

      {playing && (
        <input
          type="range"
          className="atc-vol"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
        />
      )}

      {error && (
        <span className="atc-err mono" title={error}>STREAM OFFLINE</span>
      )}

      <audio
        ref={audioRef}
        src={url}
        preload="none"
        // No crossOrigin: LiveATC doesn't send CORS headers, and we don't
        // need to read the audio buffer — just play it.
        onError={() => {
          setError('stream error — try another freq');
          setPlaying(false);
        }}
        onEnded={() => setPlaying(false)}
      />
    </div>
  );
}
