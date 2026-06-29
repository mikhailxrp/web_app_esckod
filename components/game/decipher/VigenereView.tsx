'use client';

import type { ReactElement } from 'react';

import { ALPHABET_RU, normalizeRu } from '@/constants/russianAlphabet';

interface VigenereViewProps {
  encryptedWord: string;
  vigenereDigits: number[];
  cipherKey: string;
}

interface LetterCellProps {
  letter: string;
  position: number;
  dimmed?: boolean;
}

function LetterCell({ letter, position, dimmed = false }: LetterCellProps): ReactElement {
  return (
    <span className="relative inline-flex items-start leading-none w-14 shrink-0">
      <span
        className={`font-mono text-[42px] font-normal leading-none ${dimmed ? 'text-content-secondary' : 'text-content-primary'}`}
      >
        {letter}
      </span>
      <span
        className={`ml-0.5 mt-1 font-mono text-[15px] font-normal leading-none tabular-nums ${dimmed ? 'text-content-secondary/60' : 'text-white'}`}
      >
        {String(position).padStart(2, '0')}
      </span>
    </span>
  );
}

export function VigenereView({
  encryptedWord,
  vigenereDigits,
  cipherKey,
}: VigenereViewProps): ReactElement {
  const encLetters = normalizeRu(encryptedWord).split('');
  const keyLetters = normalizeRu(cipherKey).split('');

  return (
    <div className="flex flex-col gap-5" aria-label="Таблица шифра Виженера">
      {/* Зашифрованное слово */}
      <div className="flex flex-col gap-2">
        <span className="font-mono text-game-xs uppercase tracking-game-wider text-content-secondary">
          Зашифрованное слово
        </span>
        <div className="flex flex-wrap gap-x-3 gap-y-2">
          {encLetters.map((letter, idx) => (
            <LetterCell
              key={idx}
              letter={letter}
              position={vigenereDigits[idx] ?? 0}
            />
          ))}
        </div>
      </div>

      {/* Разделитель */}
      <div className="h-px w-full bg-border" aria-hidden="true" />

      {/* Ключ */}
      <div className="flex flex-col gap-2">
        <span className="font-mono text-game-xs uppercase tracking-game-wider text-content-secondary">
          Ключ
        </span>
        <div className="flex flex-wrap gap-x-3 gap-y-2">
          {encLetters.map((_, idx) => {
            const keyLetter = keyLetters[idx % keyLetters.length] ?? '';
            const keyPos = ALPHABET_RU.indexOf(keyLetter);
            return (
              <LetterCell
                key={idx}
                letter={keyLetter}
                position={keyPos >= 0 ? keyPos : 0}
                dimmed={idx >= keyLetters.length}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
