import { CRACK_WORD_LENGTH } from '@/constants/gameConfig';
import type { LetterStatus } from '@/types/crack';

/**
 * Классический Wordle-алгоритм сравнения слов.
 *
 * Два прохода для корректной обработки дублирующихся букв:
 * 1) точные совпадения по позиции → 'correct';
 * 2) совпадения на другой позиции (с учётом уже «израсходованных» букв) → 'wrong-position'.
 *
 * Пример: target="АГЕНТ" (одна "Е"), attempt="ЕЕЛКА" → первая "Е" может стать
 * 'wrong-position', вторая "Е" будет 'absent', так как буква в target одна.
 */
export function compareWords(target: string, attempt: string): LetterStatus[] {
  const result: LetterStatus[] = new Array(CRACK_WORD_LENGTH).fill('absent');
  const targetChars = target.split('');

  // 1-й проход: точные совпадения.
  for (let i = 0; i < CRACK_WORD_LENGTH; i++) {
    if (attempt[i] === targetChars[i]) {
      result[i] = 'correct';
      targetChars[i] = '';
    }
  }

  // 2-й проход: совпадения на другой позиции.
  for (let i = 0; i < CRACK_WORD_LENGTH; i++) {
    if (result[i] === 'correct') {
      continue;
    }

    const idx = targetChars.indexOf(attempt[i]);
    if (idx !== -1) {
      result[i] = 'wrong-position';
      targetChars[idx] = '';
    }
  }

  return result;
}
