import { ALPHABET_RU, normalizeRu } from '@/constants/russianAlphabet';

const TABLE_SIZE = 6;

/**
 * Строит таблицу Плейфера 6×6 из ключевого слова.
 * Изоморфная — можно использовать и на клиенте (для рендера), и на сервере.
 * Ячейки 32–35 (строка 5, колонки 2–5) остаются пустыми ('').
 */
export function buildPlayfairTable(key: string): string[][] {
  const normalizedKey = normalizeRu(key);
  const seen = new Set<string>();
  const tableChars: string[] = [];

  for (const ch of normalizedKey) {
    if (ALPHABET_RU.includes(ch) && !seen.has(ch)) {
      seen.add(ch);
      tableChars.push(ch);
    }
  }

  for (const ch of ALPHABET_RU) {
    if (!seen.has(ch)) {
      seen.add(ch);
      tableChars.push(ch);
    }
  }

  const table: string[][] = [];
  for (let row = 0; row < TABLE_SIZE; row++) {
    const rowChars: string[] = [];
    for (let col = 0; col < TABLE_SIZE; col++) {
      const idx = row * TABLE_SIZE + col;
      rowChars.push(idx < tableChars.length ? tableChars[idx] : '');
    }
    table.push(rowChars);
  }

  return table;
}

function findInTable(table: string[][], char: string): [number, number] {
  for (let r = 0; r < TABLE_SIZE; r++) {
    for (let c = 0; c < TABLE_SIZE; c++) {
      if (table[r][c] === char) return [r, c];
    }
  }
  throw new Error('PLAYFAIR_CHAR_NOT_FOUND');
}

/**
 * Расшифровывает слово шифром Плейфера.
 * ТОЛЬКО СЕРВЕР — не импортировать в 'use client'-файлы.
 *
 * @throws {Error} PLAYFAIR_ODD_LENGTH — нечётная длина слова после нормализации
 * @throws {Error} PLAYFAIR_CHAR_NOT_FOUND — буква отсутствует в таблице
 * @throws {Error} PLAYFAIR_EMPTY_CELL — результат правила попал на пустую ячейку
 */
export function decipherPlayfair(encryptedWord: string, key: string): string {
  const table = buildPlayfairTable(key);
  const cleaned = normalizeRu(encryptedWord);

  if (cleaned.length % 2 !== 0) {
    throw new Error('PLAYFAIR_ODD_LENGTH');
  }

  let result = '';

  for (let i = 0; i < cleaned.length; i += 2) {
    const c1 = cleaned[i];
    const c2 = cleaned[i + 1];

    const [r1, col1] = findInTable(table, c1);
    const [r2, col2] = findInTable(table, c2);

    if (r1 === r2) {
      const newCol1 = (col1 - 1 + TABLE_SIZE) % TABLE_SIZE;
      const newCol2 = (col2 - 1 + TABLE_SIZE) % TABLE_SIZE;
      if (table[r1][newCol1] === '' || table[r2][newCol2] === '') {
        throw new Error('PLAYFAIR_EMPTY_CELL');
      }
      result += table[r1][newCol1] + table[r2][newCol2];
    } else if (col1 === col2) {
      const newR1 = (r1 - 1 + TABLE_SIZE) % TABLE_SIZE;
      const newR2 = (r2 - 1 + TABLE_SIZE) % TABLE_SIZE;
      if (table[newR1][col1] === '' || table[newR2][col2] === '') {
        throw new Error('PLAYFAIR_EMPTY_CELL');
      }
      result += table[newR1][col1] + table[newR2][col2];
    } else {
      const d1 = table[r1][col2];
      const d2 = table[r2][col1];
      if (d1 === '' || d2 === '') {
        throw new Error('PLAYFAIR_EMPTY_CELL');
      }
      result += d1 + d2;
    }
  }

  return result;
}
