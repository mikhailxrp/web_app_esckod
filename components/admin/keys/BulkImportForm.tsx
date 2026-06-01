'use client';

import { useRef, useState } from 'react';
import { CloudUpload } from 'lucide-react';
import type { ImportResult } from '@/types/admin-keys';

const ACCEPTED_MIME = 'text/csv,application/vnd.ms-excel,.csv';
const MAX_PREVIEW_ROWS = 5;

interface PreviewRow {
  key: string;
  maxActivations: string;
}

function parseCsvLine(line: string): string[] {
  const cols: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        cols.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }

  cols.push(current.trim());
  return cols;
}

function parsePreview(text: string): PreviewRow[] {
  const lines = text.trim().split('\n');
  const header = lines[0]?.toLowerCase() ?? '';

  if (!header.includes('key')) {
    throw new Error('missing-key-column');
  }

  const hasMax = header.includes('maxactivations');

  return lines
    .slice(1)
    .filter((l) => l.trim())
    .slice(0, MAX_PREVIEW_ROWS)
    .map((line) => {
      const cols = parseCsvLine(line);
      return {
        key: cols[0] ?? '',
        maxActivations: hasMax && cols[1] ? cols[1] : '5',
      };
    });
}

export function BulkImportForm(): React.ReactElement {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [formatError, setFormatError] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);

  const processFile = (f: File): void => {
    setFile(f);
    setResult(null);
    setFormatError(false);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      try {
        const rows = parsePreview(text);
        setPreview(rows);
      } catch {
        setFormatError(true);
        setPreview([]);
        setFile(null);
      }
    };
    reader.readAsText(f);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent): void => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) processFile(f);
  };

  const handleDragOver = (e: React.DragEvent): void => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (): void => {
    setIsDragging(false);
  };

  const handleCancel = (): void => {
    setFile(null);
    setPreview([]);
    setFormatError(false);
    setResult(null);
  };

  const handleSave = async (): Promise<void> => {
    if (!file) return;
    setLoading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/admin/keys/import', {
        method: 'POST',
        body: formData,
      });

      const data: ImportResult = await res.json();

      if (!res.ok && data.errors?.length === 0) {
        setFormatError(true);
        setFile(null);
        setPreview([]);
        return;
      }

      setResult(data);
      setFile(null);
      setPreview([]);
    } catch {
      setFormatError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-admin-card border border-admin-card-border p-6">
      <h2 className="text-base font-semibold text-admin-input-text mb-5">
        Массовое добавление ключей
      </h2>

      <div className="mb-5">
        <p className="text-xs text-admin-placeholder mb-2">
          Формат CSV: <code className="font-mono bg-gray-100 px-1 rounded">key,maxActivations</code>
        </p>

        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={[
            'border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center gap-3 transition-colors cursor-pointer',
            isDragging
              ? 'border-admin-accent bg-admin-accent-muted'
              : 'border-gray-300 hover:border-admin-accent hover:bg-gray-50',
          ].join(' ')}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          aria-label="Загрузить CSV файл"
        >
          <CloudUpload
            size={32}
            className={isDragging ? 'text-admin-accent' : 'text-admin-placeholder'}
          />
          <p className="text-sm text-admin-label text-center">
            <span className="text-admin-accent cursor-pointer hover:underline">
              Выберите файл
            </span>{' '}
            или перетащите CSV
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_MIME}
          onChange={handleFileInput}
          className="hidden"
          aria-label="Выбор CSV файла"
        />
      </div>

      {file && preview.length > 0 && (
        <div className="mb-4 rounded-lg bg-gray-50 border border-admin-card-border overflow-hidden">
          <div className="px-4 py-2 border-b border-admin-card-border">
            <p className="text-xs font-medium text-admin-label">
              Предпросмотр ({file.name})
            </p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-admin-card-border">
                <th className="text-left px-4 py-2 text-xs text-admin-label font-medium">
                  Ключ
                </th>
                <th className="text-left px-4 py-2 text-xs text-admin-label font-medium">
                  Лимит активаций
                </th>
              </tr>
            </thead>
            <tbody>
              {preview.map((row, i) => (
                <tr
                  key={i}
                  className="border-b border-admin-card-border last:border-b-0"
                >
                  <td className="px-4 py-2 font-mono text-admin-input-text text-xs">
                    {row.key}
                  </td>
                  <td className="px-4 py-2 text-admin-label text-xs">
                    {row.maxActivations}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {preview.length === MAX_PREVIEW_ROWS && (
            <p className="px-4 py-2 text-xs text-admin-placeholder">
              Показаны первые {MAX_PREVIEW_ROWS} строк
            </p>
          )}
        </div>
      )}

      {result && (
        <div className="mb-4 p-4 rounded-lg bg-gray-50 border border-admin-card-border">
          <p className="text-sm font-medium text-admin-input-text mb-2">
            Результат импорта:
          </p>
          <p className="text-sm text-emerald-600">
            Создано: {result.created}
          </p>
          <p className="text-sm text-admin-label">
            Пропущено (уже существуют): {result.skipped}
          </p>
          {result.errors.length > 0 && (
            <div className="mt-2">
              <p className="text-sm text-red-500 font-medium">
                Ошибки ({result.errors.length}):
              </p>
              <ul className="mt-1 space-y-0.5">
                {result.errors.map((err, i) => (
                  <li key={i} className="text-xs text-red-500">
                    {err}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        {formatError ? (
          <p className="text-sm text-red-500">Некорректный формат файла</p>
        ) : (
          <span />
        )}

        <div className="flex gap-3">
          <button
            onClick={handleCancel}
            disabled={!file && !result}
            className="px-4 py-2 rounded-lg text-sm text-admin-label border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-40"
          >
            Отменить
          </button>
          <button
            onClick={handleSave}
            disabled={!file || loading}
            className="px-5 py-2 rounded-lg text-sm text-white bg-admin-accent hover:bg-admin-accent-hover transition-colors disabled:opacity-50"
          >
            {loading ? 'Загрузка...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}
