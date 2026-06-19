'use client';

import React, { useState, useRef } from 'react';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check, RefreshCw, Upload, Trash2, Loader2 } from 'lucide-react';
import type { LinkBlock, LinkImage } from '@/types/admin-report';

const formSchema = z.object({
  blocks: z.array(
    z.object({
      blockIndex: z.union([z.literal(1), z.literal(2)]),
      text: z.string(),
    }),
  ),
});

type FormValues = z.infer<typeof formSchema>;

interface LinksFormProps {
  initialBlocks: LinkBlock[];
}

type ToastState = { type: 'success' | 'error'; message: string } | null;

const inputBase =
  'w-full px-4 py-2.5 rounded-lg bg-admin-input-bg text-admin-input-text text-sm border focus:outline-none placeholder:text-admin-placeholder transition-colors';

const textareaBase =
  'w-full px-4 py-3 rounded-lg bg-admin-input-bg text-admin-input-text text-sm border border-transparent focus:outline-none focus:border-admin-accent placeholder:text-admin-placeholder transition-colors resize-none';

export function LinksForm({ initialBlocks }: LinksFormProps): React.ReactElement {
  const [blocks, setBlocks] = useState<LinkBlock[]>(initialBlocks);
  const [toast, setToast] = useState<ToastState>(null);
  const [uploadingBlock, setUploadingBlock] = useState<number | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const fileInputRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      blocks: initialBlocks.map((b) => ({
        blockIndex: b.blockIndex as 1 | 2,
        text: b.text,
      })),
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
          (json as { message?: string }).message ??
            'Не удалось сохранить. Попробуйте ещё раз.',
        );
        return;
      }

      const updated = json as LinkBlock[];
      setBlocks(updated);
      reset({
        blocks: updated.map((b) => ({
          blockIndex: b.blockIndex as 1 | 2,
          text: b.text,
        })),
      });
      showToast('success', 'Ссылки сохранены.');
    } catch {
      showToast('error', 'Не удалось сохранить. Попробуйте ещё раз.');
    }
  };

  const handleReset = (): void => {
    reset({
      blocks: blocks.map((b) => ({
        blockIndex: b.blockIndex as 1 | 2,
        text: b.text,
      })),
    });
  };

  const handleFileChange = async (
    blockIndex: 1 | 2,
    file: File,
  ): Promise<void> => {
    setUploadingBlock(blockIndex);

    try {
      const formData = new FormData();
      formData.append('blockIndex', String(blockIndex));
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
      setBlocks((prev) =>
        prev.map((b) => (b.blockIndex === blockIndex ? updated : b)),
      );
    } catch {
      showToast('error', 'Не удалось загрузить изображение.');
    } finally {
      setUploadingBlock(null);
      const refIdx = blockIndex - 1;
      const ref = fileInputRefs[refIdx];
      if (ref?.current) {
        ref.current.value = '';
      }
    }
  };

  const handleDeleteImage = async (
    blockIndex: 1 | 2,
    key: string,
  ): Promise<void> => {
    setDeletingKey(key);

    try {
      const res = await fetch('/api/admin/report/links/images', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockIndex, key }),
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
      setBlocks((prev) =>
        prev.map((b) => (b.blockIndex === blockIndex ? updated : b)),
      );
    } catch {
      showToast('error', 'Не удалось удалить изображение.');
    } finally {
      setDeletingKey(null);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="bg-white rounded-xl shadow-admin-card border border-admin-card-border p-8 max-w-4xl">
        <h2 className="text-base font-semibold text-admin-input-text mb-6">
          Управление ссылками
        </h2>

        <div className="space-y-8">
          {blocks.map((block, index) => {
            const blockIndex = block.blockIndex as 1 | 2;
            const refIdx = blockIndex - 1;

            return (
              <div key={block.id} className="grid grid-cols-2 gap-6">
                {/* Текст блока */}
                <div>
                  <label className="text-sm text-admin-label block mb-1.5">
                    Текст блок {blockIndex}
                  </label>
                  <textarea
                    {...register(`blocks.${index}.text`)}
                    rows={8}
                    className={textareaBase}
                    placeholder={`Текст для блока ${blockIndex}`}
                  />
                </div>

                {/* Файлы блока */}
                <div>
                  <p className="text-sm text-admin-label mb-1.5">
                    Файлы (блок {blockIndex})
                  </p>

                  {/* Загруженные изображения */}
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
                            onClick={() => void handleDeleteImage(blockIndex, img.key)}
                            disabled={deletingKey === img.key}
                            className="shrink-0 text-red-400 hover:text-red-600 transition-colors disabled:opacity-50"
                            aria-label="Удалить изображение"
                          >
                            {deletingKey === img.key ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Trash2 size={14} />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Дропзона */}
                  <div
                    className="border-2 border-dashed border-admin-accent/40 rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-admin-accent/70 transition-colors"
                    onClick={() => fileInputRefs[refIdx]?.current?.click()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        fileInputRefs[refIdx]?.current?.click();
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Загрузить изображение для блока ${blockIndex}`}
                  >
                    {uploadingBlock === blockIndex ? (
                      <Loader2 size={24} className="text-admin-accent animate-spin" />
                    ) : (
                      <Upload size={24} className="text-admin-accent" />
                    )}
                    <p className="text-sm text-admin-accent text-center">
                      <span className="underline">Выберите изображение</span>{' '}
                      или перетащите
                    </p>
                    <p className="text-xs text-admin-placeholder">
                      JPG, PNG до 5 МБ
                    </p>
                  </div>

                  <input
                    ref={fileInputRefs[refIdx]}
                    type="file"
                    accept="image/jpeg,image/png"
                    className="hidden"
                    aria-hidden="true"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        void handleFileChange(blockIndex, file);
                      }
                    }}
                  />
                </div>
              </div>
            );
          })}
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
          {toast.type === 'success' && (
            <Check size={15} className="shrink-0 text-green-600" />
          )}
          {toast.message}
        </div>
      )}

      {/* Actions */}
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
    </form>
  );
}
