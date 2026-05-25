import {
  MOBILE_BLOCK_SUBTITLE,
  MOBILE_BLOCK_TITLE,
} from '@/constants/mobileBlockText';

export function MobileBlock(): React.ReactElement {
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center px-6 text-center"
      role="alert"
      aria-live="polite"
    >
      <p className="max-w-lg font-mono text-lg text-content-primary sm:text-xl">
        {MOBILE_BLOCK_TITLE}
      </p>
      <p className="mt-4 max-w-lg font-mono text-sm text-content-secondary">
        {MOBILE_BLOCK_SUBTITLE}
      </p>
    </main>
  );
}
