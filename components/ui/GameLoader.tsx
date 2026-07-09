export default function GameLoader(): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center gap-4" role="status" aria-label="Загрузка">
      <div className="relative h-1.5 w-48 overflow-hidden rounded-game-full border border-border/60 bg-bg-secondary">
        <div className="game-loader-fill absolute inset-y-0 left-0 rounded-game-full bg-accent shadow-game-glow-md" />
      </div>

      <style>{`
        @keyframes game-progress-fill {
          0%   { width: 0% }
          50%  { width: 65% }
          75%  { width: 80% }
          90%  { width: 87% }
          100% { width: 92% }
        }
        .game-loader-fill {
          animation: game-progress-fill 2.8s cubic-bezier(0.05, 0.85, 0.2, 1) forwards;
        }
      `}</style>
    </div>
  );
}
