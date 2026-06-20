'use client';

import React, { useState, useRef, useCallback } from 'react';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check, RefreshCw, Upload, Trash2, Loader2, Plus } from 'lucide-react';
import type { LinkBlock, LinkImage } from '@/types/admin-report';

const formSchema = z.object({
  blocks: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
    }),
  ),
});

type FormValues = z.infer<typeof formSchema>;

interface LinksFormProps {
  initialBlocks: LinkBlock[];
}

type ToastState = { type: 'success' | 'error'; message: string } | null;

const textareaBase =
  'w-full px-4 py-3 rounded-lg bg-admin-input-bg text-admin-input-text text-sm border border-transparent focus:outline-none focus:border-admin-accent placeholder:text-admin-placeholder transition-colors resize-none';

export function LinksForm({ initialBlocks }: LinksFormProps): React.ReactElement {
  const [blocks, setBlocks] = useState<LinkBlock[]>(initialBlocks);
  const [toast, setToast] = useState<ToastState>(null);
  const [uploadingBlockId, setUploadingBlockId] = useState<string | null>(null);
  const [deletingImageKey, setDeletingImageKey] = useState<string | null>(null);
  const [deletingBlockId, setDeletingBlockId] = useState<string | null>(null);
  const [addingBlock, setAddingBlock] = useState(false);

  const fileInputMapRef = useRef<Map<string, HTMLInputElement | null>>(new Map());

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      blocks: initialBlocks.map((b) => ({ id: b.id, text: b.text })),
    },
  });

  const showToast = (type: 'success' | 'error', message: string): void => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const onSubmit = async (values: FormValues): Promise<void> => {
    try {
      const res = await fetch('/api/admin/report/links', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocks: values.blocks }),
      });

      const json = await res.json();

      if (!res.ok) {
        showToast(
          'error',
          (json as { message?: string }).message ?? 'Не удалось сохранить. Попробуйте ещё раз.',
        );
        return;
      }

      const updated = json as LinkBlock[];
      setBlocks(updated);
      reset({ blocks: updated.map((b) => ({ id: b.id, text: b.text })) });
      showToast('success', 'Ссылки сохранены.');
    } catch {
      showToast('error', 'Не удалось сохранить. Попробуйте ещё раз.');
    }
  };

  const handleReset = (): void => {
    reset({ blocks: blocks.map((b) => ({ id: b.id, text: b.text })) });
  };

  const handleAddBlock = async (): Promise<void> => {
    setAddingBlock(true);
    try {
      const res = await fetch('/api/admin/report/links', { method: 'POST' });
      const json = await res.json();

      if (!res.ok) {
        showToast('error', (json as { message?: string }).message ?? 'Не удалось добавить блок.');
        return;
      }

      const newBlock = json as LinkBlock;
      setBlocks((prev) => [...prev, newBlock]);

      const current = getValues('blocks');
      setValue('blocks', [...current, { id: newBlock.id, text: newBlock.text }], {
        shouldDirty: false,
      });
    } catch {
      showToast('error', 'Не удалось добавить блок.');
    } finally {
      setAddingBlock(false);
    }
  };

  const handleDeleteBlock = async (blockId: string): Promise<void> => {
    setDeletingBlockId(blockId);
    try {
      const res = await fetch(`/api/admin/report/links/${blockId}`, { method: 'DELETE' });

      if (!res.ok && res.status !== 204) {
        const json = await res.json().catch(() => ({}));
        showToast('error', (json as { message?: string }).message ?? 'Не удалось удалить блок.');
        return;
      }

      setBlocks((prev) => prev.filter((b) => b.id !== blockId));

      const current = getValues('blocks');
      setValue(
        'blocks',
        current.filter((b) => b.id !== blockId),
        { shouldDirty: false },
      );
    } catch {
      showToast('error', 'Не удалось удалить блок.');
    } finally {
      setDeletingBlockId(null);
    }
  };

  const handleFileChange = async (blockId: string, file: File): Promise<void> => {
    setUploadingBlockId(blockId);

    try {
      const formData = new FormData();
      formData.append('blockId', blockId);
      formData.append('file', file);

      const res = await fetch('/api/admin/report/links/images', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();

      if (!res.ok) {
        showToast(
          'error',
          (json as { message?: string }).message ?? 'Не удалось загрузить изображение.',
        );
        return;
      }

      const updated = json as LinkBlock;
      setBlocks((prev) => prev.map((b) => (b.id === blockId ? updated : b)));
    } catch {
      showToast('error', 'Не удалось загрузить изображение.');
    } finally {
      setUploadingBlockId(null);
      const input = fileInputMapRef.current.get(blockId);
      if (input) input.value = '';
    }
  };

  const handleDeleteImage = async (blockId: string, key: string): Promise<void> => {
    setDeletingImageKey(key);

    try {
      const res = await fetch('/api/admin/report/links/images', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockId, key }),
      });

      const json = await res.json();

      if (!res.ok) {
        showToast(
          'error',
          (json as { message?: string }).message ?? 'Не удалось удалить изображение.',
        );
        return;
      }

      const updated = json as LinkBlock;
      setBlocks((prev) => prev.map((b) => (b.id === blockId ? updated : b)));
    } catch {
      showToast('error', 'Не удалось удалить изображение.');
    } finally {
      setDeletingImageKey(null);
    }
  };

  const setFileInputRef = useCallback(
    (blockId: string) => (el: HTMLInputElement | null) => {
      fileInputMapRef.current.set(blockId, el);
    },
    [],
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="bg-white rounded-xl shadow-admin-card border border-admin-card-border p-8 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-semibold text-admin-input-text">Управление ссылками</h2>
          <button
            type="button"
            onClick={() => void handleAddBlock()}
            disabled={addingBlock}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white bg-admin-accent hover:bg-admin-accent-hover transition-colors disabled:opacity-50"
          >
            {addingBlock ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Plus size={14} />
            )}
            Добавить блок
          </button>
        </div>

        {blocks.length === 0 && (
          <p className="text-sm text-admin-placeholder text-center py-8">
            Блоки ещё не добавлены. Нажмите «Добавить блок».
          </p>
        )}

        <div className="space-y-8">
          {blocks.map((block, index) => (
            <div key={block.id} className="border border-admin-card-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-admin-label">
                  Блок {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => void handleDeleteBlock(block.id)}
                  disabled={deletingBlockId === block.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-500 border border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50"
                  aria-label={`Удалить блок ${index + 1}`}
                >
                  {deletingBlockId === block.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Trash2 size={12} />
                  )}
                  Удалить блок
                </button>
              </div>

              <div className="grid grid-cols-2 gap-6">
                {/* Текст блока */}
                <div>
                  <label className="text-sm text-admin-label block mb-1.5">
                    Текст блока
                  </label>
                  <input type="hidden" {...register(`blocks.${index}.id`)} />
                  <textarea
                    {...register(`blocks.${index}.text`)}
                    rows={8}
                    className={textareaBase}
                    placeholder="Текст для блока"
                  />
                </div>

                {/* Файлы блока */}
                <div>
                  <p className="text-sm text-admin-label mb-1.5">Файлы блока</p>

                  {block.images.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {block.images.map((img: LinkImage) => (
                        <div
                          key={img.key}
                          className="flex items-center gap-3 bg-admin-input-bg rounded-lg px-3 py-2"
                        >
                          <div className="relative w-12 h-12 shrink-0 rounded overflow-hidden bg-gray-100">
                            <Image
                              src={img.url}
                              alt="Изображение блока"
                              width={48}
                              height={48}
                              className="object-cover w-full h-full"
                            />
                          </div>
                          <span className="text-xs text-admin-placeholder truncate flex-1 min-w-0">
                            {img.key.split('/').pop()}
                          </span>
                          <button
                            type="button"
                            onClick={() => void handleDeleteImage(block.id, img.key)}
                            disabled={deletingImageKey === img.key}
                            className="shrink-0 text-red-400 hover:text-red-600 transition-colors disabled:opacity-50"
                            aria-label="Удалить изображение"
                          >
                            {deletingImageKey === img.key ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Trash2 size={14} />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div
                    className="border-2 border-dashed border-admin-accent/40 rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-admin-accent/70 transition-colors"
                    onClick={() => fileInputMapRef.current.get(block.id)?.click()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        fileInputMapRef.current.get(block.id)?.click();
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Загрузить изображение для блока ${index + 1}`}
                  >
                    {uploadingBlockId === block.id ? (
                      <Loader2 size={24} className="text-admin-accent animate-spin" />
                    ) : (
                      <Upload size={24} className="text-admin-accent" />
                    )}
                    <p className="text-sm text-admin-accent text-center">
                      <span className="underline">Выберите изображение</span> или перетащите
                    </p>
                    <p className="text-xs text-admin-placeholder">JPG, PNG до 5 МБ</p>
                  </div>

                  <input
                    ref={setFileInputRef(block.id)}
                    type="file"
                    accept="image/jpeg,image/png"
                    className="hidden"
                    aria-hidden="true"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleFileChange(block.id, file);
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={[
            'flex items-center gap-2 mt-4 max-w-4xl px-4 py-3 rounded-xl text-sm',
            toast.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800',
          ].join(' ')}
        >
          {toast.type === 'success' && <Check size={15} className="shrink-0 text-green-600" />}
          {toast.message}
        </div>
      )}

      {/* Actions */}
      {blocks.length > 0 && (
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
            type="submit"
            disabled={isSubmitting || !isDirty}
            className="px-6 py-2 rounded-lg text-sm text-white bg-admin-accent hover:bg-admin-accent-hover transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      )}
    </form>
  );
}
