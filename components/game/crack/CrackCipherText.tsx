"use client";

import { useMemo } from "react";
import type { ReactElement } from "react";

import { wordList5letters } from "@/constants/wordList5letters";

interface CrackCipherTextProps {
  words: string[];
  onWordClick?: (word: string) => void;
}

type Token =
  | { type: "session" | "filler"; text: string }
  | { type: "sep"; text: string };

const SEPS = [
  "%@//—→+//&'\"",
  './/—}+&"*',
  '%@//—→+//&"*/:',
  '→+//&"',
  "%@.//—→+",
  "//—→+//&'\"*/:.",
  '.)+//&"',
  '%@//—}+&"*/:.',
  "→+//&'\"*",
  "%@//—",
  ".//—→+//&",
  "%@//—→+//",
  ')+//&"*/',
  "%@.//—→",
  "//—→+&'\"",
];
const TOTAL_SLOTS = 80;

/** Детерминированный shuffle (LCG) — одни и те же слова дают один и тот же результат. */
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  let s = seed;
  for (let i = result.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) | 0;
    const j = Math.abs(s) % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function getSeed(words: string[]): number {
  return words
    .join("")
    .split("")
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
}

function buildTokens(sessionWords: string[]): Token[] {
  const sessionSet = new Set(sessionWords);
  const seed = getSeed(sessionWords);

  // filler words — from the full dictionary, excluding session words, shuffled
  const fillers = seededShuffle(
    (wordList5letters as readonly string[]).filter((w) => !sessionSet.has(w)),
    seed,
  );

  // build flat list: session words + enough fillers to reach TOTAL_SLOTS, then shuffle all
  const allWords: string[] = [...sessionWords];
  for (let i = 0; allWords.length < TOTAL_SLOTS && i < fillers.length; i++) {
    allWords.push(fillers[i]);
  }
  const shuffled = seededShuffle(allWords, seed ^ 0xdeadbeef);

  // build token array: [sep] [word sep] [word sep] ... [final sep]
  const tokens: Token[] = [{ type: "sep", text: "[//:" }];
  for (let i = 0; i < shuffled.length; i++) {
    const text = shuffled[i];
    const isSession = sessionSet.has(text);
    tokens.push({ type: isSession ? "session" : "filler", text });
    tokens.push({ type: "sep", text: SEPS[i % SEPS.length] });
  }
  tokens.push({ type: "sep", text: '&""' });

  return tokens;
}

export function CrackCipherText({
  words,
  onWordClick,
}: CrackCipherTextProps): ReactElement {
  const tokens = useMemo(() => buildTokens(words), [words]);

  return (
    <div className="log-scrollbar h-[350px] w-full overflow-auto rounded-game-sm border border-white bg-[rgba(255,255,255,0.10)] p-4 backdrop-blur-sm">
      <p className="break-all font-mono text-[14px] leading-relaxed text-[rgba(255,255,255,0.8)]">
        {tokens.map((token, i) => {
          if (token.type === "sep") {
            return (
              <span
                key={i}
                className="select-none text-[rgba(255,255,255,0.8)]"
              >
                {token.text}
              </span>
            );
          }

          return (
            <button
              key={i}
              type="button"
              onClick={() => onWordClick?.(token.text)}
              className="cursor-pointer text-[rgba(255,255,255,0.8)] focus-visible:outline-none"
            >
              {token.text}
            </button>
          );
        })}
      </p>
    </div>
  );
}
