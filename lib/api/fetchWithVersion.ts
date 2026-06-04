import { toast } from '@/components/ui/Toast';

const CONFLICT_MESSAGE =
  'Состояние изменилось на другом устройстве. Страница обновлена.';

interface FetchWithVersionOptions {
  body: Record<string, unknown>;
  onConflict: () => Promise<void>;
}

/**
 * POST-обёртка с обработкой optimistic locking (409).
 * На 409 — показывает тост и вызывает onConflict (обычно refresh()).
 * Без авто-ретрая.
 */
export async function fetchWithVersion(
  url: string,
  { body, onConflict }: FetchWithVersionOptions,
): Promise<Response> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (response.status === 409) {
    toast.warning(CONFLICT_MESSAGE);
    await onConflict();
  }

  return response;
}
