'use client';

interface AudioPlayerProps {
  src: string;
  className?: string;
}

export function AudioPlayer({ src, className = '' }: AudioPlayerProps): React.ReactElement {
  const filename = src.split('/').pop() ?? 'audio';

  return (
    <div className={['flex flex-col gap-2', className].filter(Boolean).join(' ')}>
      <span className="font-mono text-game-xs text-content-muted">{filename}</span>
      <audio
        controls
        preload="metadata"
        src={src}
        className="w-full"
        aria-label={`Аудио: ${filename}`}
      />
    </div>
  );
}
