import { ALPHABET_RU, ALPHABET_LEN, normalizeRu } from '@/constants/russianAlphabet';

/**
 * Возвращает массив 0-индексированных позиций букв зашифрованного слова.
 * Изоморфная — можно использовать и на клиенте (для UI), и на сервере.
 * Для букв вне алфавита возвращает -1 (без выброса ошибки).
 */
export function getVigenereDigits(encryptedWord: string): number[] {
  const cleaned = normalizeRu(encryptedWord);
  return cleaned.split('').map((ch) => ALPHABET_RU.indexOf(ch));
}

/**
 * Расшифровывает слово шифром Виженера.
 * ТОЛЬКО СЕРВЕР — не импортировать в 'use client'-файлы.
 *
 * Формула: decIdx = (encIdx - keyIdx + ALPHABET_LEN) % ALPHABET_LEN
 *
 * @throws {Error} VIGENERE_EMPTY_KEY — ключ пустой после нормализации
 * @throws {Error} VIGENERE_INVALID_CHAR — буква слова или ключа вне алфавита
 */
export function decipherVigenere(encryptedWord: string, key: string): string {
  const cleaned = normalizeRu(encryptedWord);
  const cleanedKey = normalizeRu(key);

  if (cleanedKey.length === 0) {
    throw new Error('VIGENERE_EMPTY_KEY');
  }

  let result = '';

  for (let i = 0; i < cleaned.length; i++) {
    const encIdx = ALPHABET_RU.indexOf(cleaned[i]);
    const keyIdx = ALPHABET_RU.indexOf(cleanedKey[i % cleanedKey.length]);

    if (encIdx === -1 || keyIdx === -1) {
      throw new Error('VIGENERE_INVALID_CHAR');
    }

    const decIdx = (encIdx - keyIdx + ALPHABET_LEN) % ALPHABET_LEN;
    result += ALPHABET_RU[decIdx];
  }

  return result;
}
