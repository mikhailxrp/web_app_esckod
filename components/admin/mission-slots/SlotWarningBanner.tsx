'use client';

interface SlotWarningBannerProps {
  warnings: string[];
}

export function SlotWarningBanner({ warnings }: SlotWarningBannerProps): React.ReactElement | null {
  if (warnings.length === 0) return null;

  return (
    <div className="flex flex-col gap-2" role="alert">
      {warnings.map((warning, index) => (
        <p
          key={index}
          className="rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800 dark:border-yellow-700/50 dark:bg-yellow-900/20 dark:text-yellow-300"
        >
          {warning}
        </p>
      ))}
    </div>
  );
}
