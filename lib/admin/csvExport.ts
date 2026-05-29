function csvField(value: string | number | boolean | null): string {
  const str = value === null ? '' : String(value);
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

export function generateKeysCsv(
  keys: {
    key: string;
    maxActivations: number;
    currentActivations: number;
    isBlocked: boolean;
    blockReason: string | null;
    createdAt: Date;
    users: { email: string }[];
  }[],
): string {
  const header = [
    'key',
    'maxActivations',
    'currentActivations',
    'isBlocked',
    'blockReason',
    'createdAt',
    'emails',
  ].map(csvField).join(',');

  const rows = keys.map((k) =>
    [
      csvField(k.key),
      csvField(k.maxActivations),
      csvField(k.currentActivations),
      csvField(k.isBlocked),
      csvField(k.blockReason),
      csvField(k.createdAt.toISOString()),
      csvField(k.users.map((u) => u.email).join(';')),
    ].join(','),
  );

  return [header, ...rows].join('\n');
}

export function generateUsersEmailCsv(emails: string[]): string {
  return emails.join('\n');
}
