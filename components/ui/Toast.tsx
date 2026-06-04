'use client';

import { useEffect, useState } from 'react';

// =============================================================
// Types
// =============================================================

type ToastType = 'success' | 'warning' | 'error' | 'info';

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

// =============================================================
// Pub/Sub module-level state (works outside React)
// =============================================================

type Listener = (toasts: ToastItem[]) => void;

let _toasts: ToastItem[] = [];
let _nextId = 0;
const _listeners = new Set<Listener>();

function _notify(): void {
  _listeners.forEach((l) => l([..._toasts]));
}

function _add(type: ToastType, message: string): void {
  const id = _nextId++;
  _toasts = [..._toasts, { id, type, message }];
  _notify();

  setTimeout(() => {
    _toasts = _toasts.filter((t) => t.id !== id);
    _notify();
  }, TOAST_DURATION_MS);
}

const TOAST_DURATION_MS = 4000;

// =============================================================
// Imperative API — used outside React (e.g. fetchWithVersion)
// =============================================================

export const toast = {
  success: (message: string) => _add('success', message),
  warning: (message: string) => _add('warning', message),
  error: (message: string) => _add('error', message),
  info: (message: string) => _add('info', message),
};

// =============================================================
// Styles per type
// =============================================================

const TYPE_STYLES: Record<ToastType, string> = {
  success:
    'border-semantic-success bg-semantic-success-bg text-semantic-success',
  warning:
    'border-semantic-warning bg-semantic-warning-bg text-semantic-warning',
  error: 'border-semantic-error bg-semantic-error-bg text-semantic-error',
  info: 'border-accent bg-accent-muted text-accent',
};

const TYPE_ICONS: Record<ToastType, string> = {
  success: '✓',
  warning: '⚠',
  error: '✕',
  info: 'ℹ',
};

// =============================================================
// ToastContainer — mounts in layout, renders the queue
// =============================================================

export function ToastContainer(): React.ReactElement {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    setToasts([..._toasts]);
    _listeners.add(setToasts);
    return () => {
      _listeners.delete(setToasts);
    };
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="false"
      aria-label="Уведомления"
      className="pointer-events-none fixed right-4 top-4 z-toast flex flex-col gap-2"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="alert"
          className={[
            'pointer-events-auto flex items-start gap-3 rounded-game-lg border px-4 py-3',
            'font-mono text-game-sm shadow-game-card animate-slide-in',
            'max-w-xs',
            TYPE_STYLES[t.type],
          ].join(' ')}
        >
          <span aria-hidden="true" className="mt-px shrink-0 font-bold">
            {TYPE_ICONS[t.type]}
          </span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
