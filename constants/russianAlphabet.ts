export const ALPHABET_RU = 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ';
export const ALPHABET_LEN = 32;

/** Playfair: Ю и Я исключены (❌ ОПАСНО — вызывают пустые ячейки в 6×6). 30 букв → 6 пустых ячеек. */
export const ALPHABET_PLAYFAIR = 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭ';

export function normalizeRu(s: string): string {
  return s.toUpperCase().replace(/Е/g, 'Е');
}
