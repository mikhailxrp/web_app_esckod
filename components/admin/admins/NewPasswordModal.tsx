'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface NewPasswordModalProps {
  password: string;
  title?: string;
  onClose: () => void;
}

export function NewPasswordModal({
  password,
  title = 'Пароль создан',
  onClose,
}: NewPasswordModalProps): React.ReactElement {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: ignore clipboard errors in restricted environments
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-admin-card w-full max-w-md mx-4 p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-admin-input-text mb-2">{title}</h2>

        <p className="text-sm text-admin-placeholder mb-5">
          Сохраните пароль — он отображается только один раз и не может быть
          восстановлен.
        </p>

        <div className="flex items-center gap-2 bg-admin-input-bg rounded-lg px-4 py-3 mb-6">
          <span className="flex-1 font-mono text-sm text-admin-input-text tracking-widest select-all">
            {password}
          </span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs text-admin-accent hover:text-admin-accent-hover transition-colors"
          >
            {copied ? (
              <>
                <Check size={14} />
                Скопировано
              </>
            ) : (
              <>
                <Copy size={14} />
                Скопировать
              </>
            )}
          </button>
        </div>

        <div className="flex justify-center">
          <button
            onClick={onClose}
            className="px-8 py-2 rounded-lg text-sm text-white bg-admin-accent hover:bg-admin-accent-hover transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
