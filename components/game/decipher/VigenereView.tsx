'use client';

import type { ReactElement } from 'react';

interface VigenereViewProps {
  encryptedWord: string;
  vigenereDigits: number[];
  cipherKey: string;
}

export function VigenereView({
  encryptedWord,
  vigenereDigits,
}: VigenereViewProps): ReactElement {
  const letters = encryptedWord.split("");

  return (
    <div
      className="flex flex-wrap content-start gap-x-1 gap-y-3"
      aria-label="Зашифрованное слово с позициями"
    >
      {letters.map((letter, idx) => (
        <span
          key={idx}
          className="relative inline-flex items-start leading-none"
        >
          <span className="font-mono text-[42px] font-normal leading-none text-content-primary">
            {letter}
          </span>
          <span className="ml-0.5 mt-1 font-mono text-[15px] font-normal leading-none text-white">
            {String(vigenereDigits[idx] ?? 0).padStart(2, "0")}
          </span>
        </span>
      ))}
    </div>
  );
}
