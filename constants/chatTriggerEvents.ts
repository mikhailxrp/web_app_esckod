export const CHAT_TRIGGER_EVENTS = {
  CRACK_COMPLETED: (slotKey: string): string => `crack_completed:${slotKey}`,
  DECIPHER_COMPLETED: (slotKey: string): string => `decipher_completed:${slotKey}`,
  RDP_COMPLETED: (slotKey: string): string => `rdp_completed:${slotKey}`,
  RDP_MARINA_TRIGGERED: 'rdp_marina_triggered',
  FINAL_CHOICE_MADE: 'final_choice_made',
} as const;

const FIXED_TRIGGER_VALUES: readonly string[] = [
  CHAT_TRIGGER_EVENTS.RDP_MARINA_TRIGGERED,
  CHAT_TRIGGER_EVENTS.FINAL_CHOICE_MADE,
];

export function buildTriggerValues(slotKeys: string[]): string[] {
  const perSlot = slotKeys.flatMap((slotKey) => [
    CHAT_TRIGGER_EVENTS.CRACK_COMPLETED(slotKey),
    CHAT_TRIGGER_EVENTS.DECIPHER_COMPLETED(slotKey),
    CHAT_TRIGGER_EVENTS.RDP_COMPLETED(slotKey),
  ]);

  return [...perSlot, ...FIXED_TRIGGER_VALUES];
}

export async function fetchValidTriggerValueSet(): Promise<Set<string>> {
  const { prisma } = await import('@/lib/prisma');
  const slots = await prisma.missionSlot.findMany({
    select: { slotKey: true },
  });
  const slotKeys = slots.map((s) => s.slotKey);

  return new Set(buildTriggerValues(slotKeys));
}
