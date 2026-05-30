'use client';

import { ShieldAlert } from 'lucide-react';

interface MarketingConsentWarningModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function MarketingConsentWarningModal({
  isOpen,
  onConfirm,
  onCancel,
}: MarketingConsentWarningModalProps): React.ReactElement | null {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-xl shadow-admin-card w-full max-w-md mx-4 p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <ShieldAlert size={22} className="text-red-500 shrink-0" />
          <h2 className="text-xl font-bold text-admin-input-text">
            Юридическое предупреждение
          </h2>
        </div>

        <div className="text-sm text-admin-label space-y-3 mb-6">
          <p>
            Включение согласия на маркетинговые рассылки по умолчанию может нарушать:
          </p>
          <ul className="list-disc list-inside space-y-1 text-admin-input-text">
            <li>
              <strong>152-ФЗ (РФ)</strong> — согласие на обработку персональных
              данных в маркетинговых целях должно быть активным и явным.
              Pre-checked чекбокс не является законным согласием.
            </li>
            <li>
              <strong>GDPR (ЕС)</strong> — согласие должно быть свободным,
              конкретным, информированным и однозначным. Дефолтное включение
              нарушает Recital 32 и статью 7.
            </li>
          </ul>
          <p>
            Убедитесь, что вы проконсультировались с юристом перед включением
            этой настройки.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={onCancel}
            className="px-6 py-2 rounded-lg text-sm text-admin-input-text border border-admin-card-border hover:bg-gray-50 transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={onConfirm}
            className="px-6 py-2 rounded-lg text-sm text-white bg-red-600 hover:bg-red-700 transition-colors"
          >
            Я понимаю и сохраняю
          </button>
        </div>
      </div>
    </div>
  );
}
