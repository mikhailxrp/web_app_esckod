export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return 'нет данных';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m} мин.`;
  return m === 0 ? `${h} ч.` : `${h} ч. ${m} мин.`;
}
