export function generateKeysCsv(
  keys: {
    key: string;
    maxActivations: number;
    currentActivations: number;
    isBlocked: boolean;
    createdAt: Date;
  }[],
): string {
  const header = 'key,maxActivations,currentActivations,isBlocked,createdAt';
  const rows = keys.map((key) =>
    [
      key.key,
      key.maxActivations,
      key.currentActivations,
      key.isBlocked,
      key.createdAt.toISOString(),
    ].join(','),
  );

  return [header, ...rows].join('\n');
}

export function generateUsersEmailCsv(emails: string[]): string {
  return emails.join('\n');
}
