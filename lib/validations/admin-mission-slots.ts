import { CipherType } from '@prisma/client';
import { z } from 'zod';
import {
  CRACK_MAX_ATTEMPTS_MAX,
  CRACK_MAX_ATTEMPTS_MIN,
  RDP_GRID_SIZES,
  RDP_TIMER_SECONDS_MAX,
  RDP_TIMER_SECONDS_MIN,
} from '@/constants/missionSlotLimits';

const ipAddressSchema = z
  .string()
  .trim()
  .regex(/^\d{1,3}(\.\d{1,3}){3}$/, 'Введите корректный IP-адрес');

export const commonSlotFieldsSchema = z.object({
  displayName: z.string().trim().min(1, 'Название обязательно'),
  orderIndex: z.number().int().min(1, 'Порядковый номер должен быть ≥ 1'),
  isActive: z.boolean(),
  hintText: z.string().nullable(),
});

export const crackSlotSchema = z.object({
  targetUrl: z.string().trim().url('Введите корректный URL'),
  targetEmail: z.string().trim().email('Введите корректный email'),
  resultPassword: z.string().trim().min(1, 'Пароль результата обязателен'),
  crackMaxAttempts: z
    .number()
    .int()
    .min(CRACK_MAX_ATTEMPTS_MIN, `Минимум ${CRACK_MAX_ATTEMPTS_MIN} попыток`)
    .max(CRACK_MAX_ATTEMPTS_MAX, `Максимум ${CRACK_MAX_ATTEMPTS_MAX} попыток`),
});

export const decipherSlotSchema = z.object({
  cipherType: z.nativeEnum(CipherType),
  encryptedWord: z.string().trim().min(1, 'Зашифрованное слово обязательно'),
  cipherKey: z.string().trim().min(1, 'Ключ шифра обязателен'),
  folderPassword: z.string().trim().min(1, 'Пароль папки обязателен'),
  folderPath: z.string().trim().min(1, 'Путь к папке обязателен'),
  unlocksRdpFolder: z.string().trim().min(1).nullable(),
  unlocksRdpSlotKey: z.string().trim().min(1).nullable(),
});

const rdpScenario1FieldsSchema = z.object({
  rdpScenario: z.literal(1),
  correctIp: ipAddressSchema,
  logSubjectName: z.string().trim().min(1, 'Имя для лога обязательно'),
  timerSeconds: z.literal(null),
  rdpPuzzleGridSize: z.literal(RDP_GRID_SIZES[0]),
  nextRdpSlotKey: z.string().trim().min(1, 'Укажите следующий RDP-слот'),
});

const rdpScenario2FieldsSchema = z.object({
  rdpScenario: z.literal(2),
  correctIp: ipAddressSchema,
  logSubjectName: z.string().trim().min(1, 'Имя для лога обязательно'),
  timerSeconds: z
    .number()
    .int()
    .min(RDP_TIMER_SECONDS_MIN, `Минимум ${RDP_TIMER_SECONDS_MIN} секунд`)
    .max(RDP_TIMER_SECONDS_MAX, `Максимум ${RDP_TIMER_SECONDS_MAX} секунд`),
  rdpPuzzleGridSize: z.literal(RDP_GRID_SIZES[1]),
  nextRdpSlotKey: z.null(),
});

export const rdpSlotSchema = z.discriminatedUnion('rdpScenario', [
  rdpScenario1FieldsSchema,
  rdpScenario2FieldsSchema,
]);

const slotKeySchema = z.string().trim().min(1, 'Ключ слота обязателен');

const createCrackMissionSlotSchema = commonSlotFieldsSchema
  .extend({
    slotKey: slotKeySchema,
    missionType: z.literal('CRACK'),
  })
  .merge(crackSlotSchema);

const createDecipherMissionSlotSchema = commonSlotFieldsSchema
  .extend({
    slotKey: slotKeySchema,
    missionType: z.literal('DECIPHER'),
  })
  .merge(decipherSlotSchema);

const createRdpMissionSlotSchema = z.intersection(
  commonSlotFieldsSchema.extend({
    slotKey: slotKeySchema,
    missionType: z.literal('RDP'),
  }),
  rdpSlotSchema,
);

// z.union используется вместо z.discriminatedUnion('missionType') — техническое ограничение Zod v3:
// z.discriminatedUnion требует ZodObject в каждой ветке, но createRdpMissionSlotSchema
// является z.intersection (т.к. rdpSlotSchema — discriminatedUnion по rdpScenario, не ZodObject).
// Валидация инвариантов при этом полностью сохраняется.
export const createMissionSlotSchema = z.union([
  createCrackMissionSlotSchema,
  createDecipherMissionSlotSchema,
  createRdpMissionSlotSchema,
]);

export const updateCrackMissionSlotSchema = commonSlotFieldsSchema.merge(crackSlotSchema);
export const updateDecipherMissionSlotSchema = commonSlotFieldsSchema.merge(decipherSlotSchema);
export const updateRdpMissionSlotSchema = z.intersection(commonSlotFieldsSchema, rdpSlotSchema);

export const updateMissionSlotSchema = z.union([
  updateCrackMissionSlotSchema,
  updateDecipherMissionSlotSchema,
  updateRdpMissionSlotSchema,
]);

export const toggleActiveMissionSlotSchema = z.object({
  isActive: z.boolean(),
});

export type CreateMissionSlotInput = z.infer<typeof createMissionSlotSchema>;
export type UpdateMissionSlotInput = z.infer<typeof updateMissionSlotSchema>;
export type ToggleActiveMissionSlotInput = z.infer<typeof toggleActiveMissionSlotSchema>;
