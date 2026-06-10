export const ALPHABET_RU = 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ';
export const ALPHABET_LEN = 32;

export function normalizeRu(s: string): string {
  return s.toUpperCase().replace(/Ё/g, 'Е');
}
