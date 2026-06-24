import { CRACK_WORD_LENGTH } from '@/constants/gameConfig';
import { wordList5letters } from '@/constants/wordList5letters';
import type { CrackField } from '@/types/crack';

interface DistributionGroup {
  /** Сколько букв совпадает с targetWord на правильных позициях. */
  matches: number;
  /** Сколько слов этой группы взять на поле. */
  count: number;
}

/**
 * Распределение отвлекающих слов по «похожести» на targetWord.
 * Сумма count + 1 (target) ≈ 30 слов. Подробности — missions-crack.md.
 */
const DISTRIBUTION: readonly DistributionGroup[] = [
  { matches: 4, count: 2 },
  { matches: 3, count: 8 },
  { matches: 2, count: 15 },
  { matches: 1, count: 12 },
  { matches: 0, count: 3 },
];

/**
 * Генерирует целевое слово (случайно) и поле из ~30 слов, содержащее target
 * и набор отвлекающих с разной степенью похожести.
 *
 * Все параметры случайны: при каждом вызове — другое слово и поле (правило 9).
 * Graceful degradation: если в группе меньше слов, чем нужно, берем что есть.
 */
export function generateCrackField(): CrackField {
  const targetWord = randomFrom(wordList5letters);
  const candidates = wordList5letters.filter((word) => word !== targetWord);

  const groups: Record<number, string[]> = { 0: [], 1: [], 2: [], 3: [], 4: [] };
  for (const word of candidates) {
    const matches = countPositionalMatches(word, targetWord);
    if (matches in groups) {
      groups[matches].push(word);
    }
  }

  const field: string[] = [targetWord];
  for (const { matches, count } of DISTRIBUTION) {
    const picked = sampleRandom(groups[matches], count);
    field.push(...picked);

    if (picked.length < count) {
      console.warn(
        `[CrackFieldGenerator] target=${targetWord}: нужно ${count} слов с ${matches} совпадениями, нашлось ${picked.length}`,
      );
    }
  }

  return { targetWord, wordList: shuffleArray(field) };
}

function countPositionalMatches(a: string, b: string): number {
  let count = 0;
  for (let i = 0; i < CRACK_WORD_LENGTH; i++) {
    if (a[i] === b[i]) {
      count++;
    }
  }
  return count;
}

function randomFrom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function sampleRandom<T>(arr: readonly T[], n: number): T[] {
  return shuffleArray(arr).slice(0, n);
}

function shuffleArray<T>(arr: readonly T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
