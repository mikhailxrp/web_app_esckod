'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ReactElement } from 'react';

import { ONBOARDING_TARGETS } from '@/constants/onboardingSteps';

const decipherAttemptSchema = z.object({
  decryptedWord: z.string().min(1).max(50),
});

type DecipherAttemptInput = z.infer<typeof decipherAttemptSchema>;

interface DecipherInputProps {
  onSubmit: (decryptedWord: string) => Promise<void>;
  isLoading: boolean;
  isError: boolean;
  disabled: boolean;
  externalValue?: string;
  onExternalChange?: (value: string) => void;
}

export function DecipherInput({
  onSubmit,
  isLoading,
  isError,
  disabled,
  externalValue,
  onExternalChange,
}: DecipherInputProps): ReactElement {
  const {
    register,
    handleSubmit,
    setValue,
    formState: { isSubmitting },
  } = useForm<DecipherAttemptInput>({
    resolver: zodResolver(decipherAttemptSchema),
    defaultValues: { decryptedWord: externalValue ?? '' },
  });

  useEffect(() => {
    if (externalValue !== undefined) {
      setValue('decryptedWord', externalValue);
    }
  }, [externalValue, setValue]);

  const handleFormSubmit = async (data: DecipherAttemptInput): Promise<void> => {
    await onSubmit(data.decryptedWord);
  };

  const isDisabled = disabled || isSubmitting || isLoading;

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col gap-2">
      <input
        {...register('decryptedWord', {
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
            onExternalChange?.(e.target.value);
          },
        })}
        id="decipher-decrypted-word"
        type="text"
        autoFocus
        autoComplete="off"
        spellCheck={false}
        aria-invalid={isError}
        aria-label="Расшифрованное слово"
        disabled={isDisabled}
        className={[
          'h-input-height w-full rounded-game-lg border bg-bg-input px-4 font-mono text-game-base uppercase text-content-primary placeholder:text-content-muted focus:outline-none focus:shadow-game-focus disabled:cursor-not-allowed disabled:opacity-60',
          isError ? 'border-semantic-error' : 'border-border focus:border-border-focus',
        ].join(' ')}
      />

      {isError ? (
        <p className="font-mono text-game-sm text-semantic-error" role="alert">
          Неверно
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isDisabled}
        aria-busy={isLoading}
        data-onboarding-id={ONBOARDING_TARGETS.DECIPHER_CONFIRM}
        className="mt-1 h-input-height w-full rounded-game-full bg-accent font-mono text-game-sm uppercase tracking-game-wide text-content-inverse transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Подтвердить
      </button>
    </form>
  );
}
