'use client';

import { useState } from 'react';
import type { FormEvent, ReactElement } from 'react';

interface CrackWordInputProps {
  disabled: boolean;
  onSelect: (word: string) => void;
}

export function CrackWordInput({ disabled, onSelect }: CrackWordInputProps): ReactElement {
  const [value, setValue] = useState('');

  const handleSubmit = (e: FormEvent): void => {
    e.preventDefault();
    const word = value.trim().toUpperCase();
    if (word.length === 0) return;
    onSelect(word);
    setValue('');
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="crack-word-input"
          className="font-mono text-game-sm text-content-secondary"
        >
          Ключ
        </label>
        <input
          id="crack-word-input"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value.toUpperCase())}
          maxLength={5}
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
          className="h-input-height w-full rounded-game-lg border border-border bg-bg-input px-4 font-mono text-game-base text-content-primary placeholder:text-content-muted focus:border-border-focus focus:shadow-game-focus focus:outline-none disabled:opacity-50"
        />
      </div>

      {value.trim().length > 0 ? (
        <button
          type="submit"
          disabled={disabled}
          className="h-input-height w-full rounded-game-full bg-accent font-mono text-game-sm uppercase tracking-game-wide text-content-inverse disabled:cursor-not-allowed disabled:opacity-50"
        >
          Подтвердить
        </button>
      ) : null}
    </form>
  );
}
