export function generateKeysCsv(
  keys: {
    key: string;
    maxActivations: number;
    currentActivations: number;
    isBlocked: boolean;
    createdAt: Date;
    users: { email: string }[];
  }[],
): string {
  const header = 'key,maxActivations,currentActivations,isBlocked,createdAt,emails';
  const rows = keys.map((k) =>
    [
      k.key,
      k.maxActivations,
      k.currentActivations,
      k.isBlocked,
      k.createdAt.toISOString(),
      `"${k.users.map((u) => u.email).join(';')}"`,
    ].join(','),
  );

  return [header, ...rows].join('\n');
}

export function generateUsersEmailCsv(emails: string[]): string {
  return emails.join('\n');
}
