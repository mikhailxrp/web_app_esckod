'use client';

import { useState, useCallback, useEffect } from 'react';
import { AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';

interface ValidationResult {
  isValid: boolean;
  issues: string[];
}

interface ReportValidatorBannerProps {
  initialValidation: ValidationResult;
}

const ISSUE_LABELS: Record<string, string> = {
  MISSING_CONTENT: 'Отсутствует текст концовки для значения',
  ORPHAN_CONTENT: 'Лишняя концовка с неизвестным значением',
  NOT_UPPERCASE: 'Значение концовки не в UPPERCASE',
  NO_FINAL_QUESTION: 'Не выбран финальный вопрос (Обвинить / Защитить)',
  FINAL_QUESTION_NOT_FOUND: 'Сохраненный финальный вопрос не найден в базе',
  FINAL_QUESTION_BAD_OPTIONS: 'Финальный вопрос не содержит вариантов «Обвинить» и «Защитить»',
};

function formatIssue(issue: string): string {
  const colonIdx = issue.indexOf(':');

  if (colonIdx === -1) {
    return ISSUE_LABELS[issue] ?? issue;
  }

  const code = issue.slice(0, colonIdx);
  const value = issue.slice(colonIdx + 1);
  const label = ISSUE_LABELS[code];

  return label ? `${label}: ${value}` : issue;
}

export function ReportValidatorBanner({
  initialValidation,
}: ReportValidatorBannerProps): React.ReactElement | null {
  const [validation, setValidation] = useState<ValidationResult>(initialValidation);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = useCallback(async (): Promise<void> => {
    setIsRefreshing(true);

    try {
      const res = await fetch('/api/admin/report/validate');

      if (res.ok) {
        const data = (await res.json()) as ValidationResult;
        setValidation(data);
      }
    } catch {
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const handler = (): void => void refresh();
    window.addEventListener('report-config-saved', handler);
    return () => window.removeEventListener('report-config-saved', handler);
  }, [refresh]);

  if (validation.isValid) {
    return (
      <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-6 text-sm text-green-800">
        <CheckCircle size={16} className="shrink-0 text-green-600" />
        <span>Конфигурация финального отчета корректна.</span>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={isRefreshing}
          className="ml-auto text-green-600 hover:text-green-800 transition-colors disabled:opacity-50"
          aria-label="Обновить проверку"
        >
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
        </button>
      </div>
    );
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6">
      <div className="flex items-start gap-3">
        <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-500" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-900 mb-1">
            Конфигурация финального отчета требует внимания
          </p>
          <ul className="text-sm text-amber-800 space-y-0.5 list-disc list-inside">
            {validation.issues.map((issue) => (
              <li key={issue}>{formatIssue(issue)}</li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={isRefreshing}
          className="shrink-0 text-amber-600 hover:text-amber-800 transition-colors disabled:opacity-50"
          aria-label="Обновить проверку"
        >
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
        </button>
      </div>
    </div>
  );
}
