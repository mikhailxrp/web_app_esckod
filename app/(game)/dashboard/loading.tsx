export default function DashboardLoading(): React.ReactElement {
  return (
    <main
      className="fixed inset-0 z-loader flex flex-col items-center justify-center gap-5 bg-bg-page"
      aria-label="Загрузка"
      aria-busy="true"
    >
      <p className="font-mono text-game-base text-content-primary">
        Загрузка...
      </p>

      {/* Track */}
      <div className="relative h-2 w-progress-width overflow-hidden rounded-game-full border border-border/60 bg-bg-secondary">
        {/* Fill */}
        <div className="loading-fill absolute inset-y-0 left-0 rounded-game-full bg-accent shadow-game-glow-md" />
      </div>

      <style>{`
        @keyframes progress-fill {
          0%   { width: 0% }
          50%  { width: 65% }
          75%  { width: 80% }
          90%  { width: 87% }
          100% { width: 92% }
        }
        .loading-fill {
          animation: progress-fill 2.8s cubic-bezier(0.05, 0.85, 0.2, 1) forwards;
        }
      `}</style>
    </main>
  );
}
