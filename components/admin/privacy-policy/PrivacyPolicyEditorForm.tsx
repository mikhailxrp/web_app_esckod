'use client';

import { useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { Check, RefreshCw } from 'lucide-react';
import { EditorToolbar } from './EditorToolbar';

interface PrivacyPolicyData {
  privacyPolicyText: string;
  updatedAt: string;
}

interface PrivacyPolicyEditorFormProps {
  initialData: PrivacyPolicyData;
}

type ToastState = { type: 'success' | 'error'; message: string } | null;

export function PrivacyPolicyEditorForm({
  initialData,
}: PrivacyPolicyEditorFormProps): React.ReactElement | null {
  const [toast, setToast] = useState<ToastState>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(initialData.updatedAt);

  const editor = useEditor({
    extensions: [StarterKit, TextAlign.configure({ types: ['heading', 'paragraph'] })],
    content: initialData.privacyPolicyText,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          'tiptap-content min-h-[320px] text-admin-input-text caret-admin-accent focus:outline-none',
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      setIsDirty(currentEditor.getHTML() !== initialData.privacyPolicyText);
    },
  });

  const showToast = (type: 'success' | 'error', message: string): void => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const handleSave = async (): Promise<void> => {
    if (!editor) return;

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/admin/app-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ privacyPolicyText: editor.getHTML() }),
      });

      const json = await res.json();

      if (!res.ok) {
        showToast('error', 'Не удалось сохранить текст. Попробуйте еще раз.');
        return;
      }

      setLastSavedAt(json.updatedAt);
      setIsDirty(false);
      showToast('success', 'Текст политики сохранен.');
    } catch {
      showToast('error', 'Не удалось сохранить текст. Попробуйте еще раз.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = (): void => {
    editor?.commands.setContent(initialData.privacyPolicyText);
    setIsDirty(false);
  };

  if (!editor) return null;

  return (
    <div className="w-2/3 mx-auto">
      <div className="bg-white rounded-xl shadow-admin-card border border-admin-card-border p-8">
        <h2 className="text-base font-semibold text-admin-input-text mb-6">
          Текст страницы
        </h2>

        <EditorToolbar editor={editor} />

        <div className="rounded-lg bg-admin-input-bg border border-transparent focus-within:border-admin-accent px-4 py-3 transition-colors">
          <EditorContent editor={editor} />
        </div>

        <p className="mt-6 text-xs text-admin-placeholder">
          Последнее обновление:{' '}
          {new Date(lastSavedAt).toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>

      {toast && (
        <div
          className={[
            'flex items-center gap-2 mt-4 px-4 py-3 rounded-xl text-sm',
            toast.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800',
          ].join(' ')}
        >
          {toast.type === 'success' && (
            <Check size={15} className="shrink-0 text-green-600" />
          )}
          {toast.message}
        </div>
      )}

      <div className="flex items-center justify-center gap-3 mt-6">
        <button
          type="button"
          onClick={handleReset}
          disabled={!isDirty || isSubmitting}
          className="flex items-center gap-2 px-6 py-2 rounded-lg text-sm text-admin-input-text border border-admin-card-border hover:bg-gray-100 transition-colors disabled:opacity-40"
        >
          <RefreshCw size={14} />
          Отменить
        </button>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!isDirty || isSubmitting}
          className="px-6 py-2 rounded-lg text-sm text-white bg-admin-accent hover:bg-admin-accent-hover transition-colors disabled:opacity-50"
        >
          {isSubmitting ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>
    </div>
  );
}
