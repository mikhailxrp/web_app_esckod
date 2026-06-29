'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

interface AudioPlayerProps {
  src: string;
  className?: string;
}

const WAVE_BARS = [
  0.45, 0.78, 0.35, 0.88, 0.62, 0.5, 0.72, 0.38, 0.81, 0.46, 0.67, 0.33, 0.74,
  0.54, 0.9, 0.4, 0.7, 0.36, 0.82, 0.48, 0.64, 0.31, 0.76, 0.52, 0.85, 0.42,
  0.68, 0.34,
];

export function AudioPlayer({
  src,
  className = '',
}: AudioPlayerProps): React.ReactElement {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const filename = useMemo(() => {
    const rawName = src.split('/').pop() ?? 'audio.mp3';
    try {
      return decodeURIComponent(rawName);
    } catch {
      return rawName;
    }
  }, [src]);

  const progress = duration > 0 ? currentTime / duration : 0;
  const activeBars = Math.round(progress * WAVE_BARS.length);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = (): void => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    };

    const handleTimeUpdate = (): void => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = (): void => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handlePause = (): void => {
      setIsPlaying(false);
    };

    const handlePlay = (): void => {
      setIsPlaying(true);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('play', handlePlay);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('play', handlePlay);
    };
  }, []);

  const togglePlayback = async (): Promise<void> => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        setIsPlaying(false);
      }
    } else {
      audio.pause();
    }
  };

  const seekByBar = (barIndex: number): void => {
    const audio = audioRef.current;
    if (!audio || duration <= 0) return;

    const nextTime = (barIndex / WAVE_BARS.length) * duration;
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  return (
    <div
      className={[
        'flex items-center gap-3 rounded-game-md bg-[rgba(120,120,120,0.45)] px-3 py-2',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <audio ref={audioRef} preload="metadata" src={src} aria-label={`Аудио: ${filename}`} />

      <button
        type="button"
        onClick={() => {
          void togglePlayback();
        }}
        aria-label={isPlaying ? 'Пауза' : 'Воспроизвести'}
        className="flex size-10 shrink-0 items-center justify-center rounded-full border border-white/80 text-white transition-colors hover:border-white"
      >
        {isPlaying ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <rect x="3" y="2" width="2.5" height="10" rx="1" fill="currentColor" />
            <rect x="8.5" y="2" width="2.5" height="10" rx="1" fill="currentColor" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M4 2.5L11 7L4 11.5V2.5Z" fill="currentColor" />
          </svg>
        )}
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="truncate font-mono text-[14px] leading-none text-white">
          {filename}
        </span>
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          {WAVE_BARS.map((heightRatio, index) => (
            <button
              key={`${src}-${index}`}
              type="button"
              onClick={() => seekByBar(index + 1)}
              aria-label={`Перейти к позиции ${index + 1}`}
              className={[
                'w-1.5 rounded-full transition-colors',
                index < activeBars ? 'bg-white' : 'bg-white/40',
              ].join(' ')}
              style={{ height: `${Math.round(10 + heightRatio * 18)}px` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
