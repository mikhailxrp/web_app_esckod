/**
 * Перенос настроек игры между базами через prisma/data/game-settings.json:
 * слоты миссий, вопросы и тексты отчёта, подсказки, настройки приложения.
 *
 *   npm run db:settings:export             БД → JSON
 *   npm run db:settings:sync -- --dry-run  показать изменения, ничего не записывая
 *   npm run db:settings:sync               JSON → БД (одна транзакция)
 *   npm run db:settings:sync -- --verify   сверить БД с JSON, только чтение
 *
 * Файл содержит ответы игры и исключён из git: на сервер он копируется отдельно.
 * Файлы S3 не переносятся. Список RdpFile хранится только для проверки, что они
 * загружены заново: без файлов папки «Доки» не сработает rdp_completed:RDP_VICTOR.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { CipherType, MissionType, Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';

import { REPORT_FINAL_CHOICES } from '../constants/reportFinalChoices';

const SETTINGS_FILE_PATH = path.join(process.cwd(), 'prisma', 'data', 'game-settings.json');
const TRANSACTION_TIMEOUT_MS = 60_000;

const missionSlotSchema = z.object({
  slotKey: z.string().min(1),
  missionType: z.nativeEnum(MissionType),
  orderIndex: z.number().int(),
  isActive: z.boolean(),
  displayName: z.string(),
  targetUrl: z.string().nullable(),
  targetEmail: z.string().nullable(),
  resultPassword: z.string().nullable(),
  crackMaxAttempts: z.number().int().nullable(),
  cipherType: z.nativeEnum(CipherType).nullable(),
  encryptedWord: z.string().nullable(),
  cipherKey: z.string().nullable(),
  folderPassword: z.string().nullable(),
  folderPath: z.string().nullable(),
  unlocksRdpFolder: z.string().nullable(),
  unlocksRdpSlotKey: z.string().nullable(),
  correctIp: z.string().nullable(),
  rdpScenario: z.number().int().nullable(),
  logSubjectName: z.string().nullable(),
  nextRdpSlotKey: z.string().nullable(),
  timerSeconds: z.number().int().nullable(),
  rdpPuzzleGridSize: z.number().int().nullable(),
  hintText: z.string().nullable(),
});

const questionSchema = z.object({
  orderIndex: z.number().int(),
  questionText: z.string(),
  options: z.array(z.string()).min(2),
  correctOption: z.number().int().min(0),
});

const reportContentSchema = z.object({
  finalChoiceValue: z.string().min(1),
  title: z.string(),
  bodyText: z.string(),
});

const hintSchema = z.object({
  orderIndex: z.number().int(),
  text: z.string(),
  isActive: z.boolean(),
});

const linkBlockSchema = z.object({
  blockIndex: z.number().int(),
  text: z.string(),
});

const appSettingsSchema = z.object({
  defaultMarketingConsent: z.boolean(),
  supportEmail: z.string(),
  privacyPolicyText: z.string(),
  crackLaunchHint: z.string(),
  decipherLaunchHint: z.string(),
  rdpLaunchHint: z.string(),
  finalReportQuestionOrderIndex: z.number().int().nullable(),
});

const expectedRdpFileSchema = z.object({
  slotKey: z.string().min(1),
  folder: z.string().min(1),
  name: z.string().min(1),
  isLocked: z.boolean(),
});

const settingsFileSchema = z.object({
  version: z.literal(1),
  appSettings: appSettingsSchema,
  missionSlots: z.array(missionSlotSchema),
  finalReportQuestions: z.array(questionSchema),
  finalReportContents: z.array(reportContentSchema),
  detectiveHints: z.array(hintSchema),
  finalReportLinkBlocks: z.array(linkBlockSchema),
  expectedRdpFiles: z.array(expectedRdpFileSchema),
});

type SettingsFile = z.infer<typeof settingsFileSchema>;
type DbClient = Prisma.TransactionClient;

const prisma = new PrismaClient();

async function readSettingsFromDb(client: DbClient): Promise<SettingsFile> {
  const [
    appSettings,
    missionSlots,
    finalReportQuestions,
    finalReportContents,
    detectiveHints,
    finalReportLinkBlocks,
    rdpFiles,
  ] = await Promise.all([
    client.appSettings.findFirst({
      orderBy: { createdAt: 'asc' },
      include: { finalReportQuestion: { select: { orderIndex: true } } },
    }),
    client.missionSlot.findMany({ orderBy: { orderIndex: 'asc' } }),
    client.finalReportQuestion.findMany({ orderBy: { orderIndex: 'asc' } }),
    client.finalReportContent.findMany({ orderBy: { finalChoiceValue: 'asc' } }),
    client.detectiveHint.findMany({ orderBy: { orderIndex: 'asc' } }),
    client.finalReportLinkBlock.findMany({ orderBy: { blockIndex: 'asc' } }),
    client.rdpFile.findMany({
      include: { slot: { select: { slotKey: true } } },
      orderBy: [{ folder: 'asc' }, { name: 'asc' }],
    }),
  ]);

  if (!appSettings) {
    throw new Error('В БД нет записи AppSettings');
  }

  return settingsFileSchema.parse({
    version: 1,
    appSettings: {
      ...appSettings,
      finalReportQuestionOrderIndex: appSettings.finalReportQuestion?.orderIndex ?? null,
    },
    missionSlots,
    finalReportQuestions,
    finalReportContents,
    detectiveHints,
    finalReportLinkBlocks,
    expectedRdpFiles: rdpFiles.map((file) => ({
      slotKey: file.slot.slotKey,
      folder: file.folder,
      name: file.name,
      isLocked: file.isLocked,
    })),
  });
}

async function readSettingsFromFile(): Promise<SettingsFile> {
  const raw = await readFile(SETTINGS_FILE_PATH, 'utf8');
  return settingsFileSchema.parse(JSON.parse(raw));
}

function findDuplicates(values: number[]): number[] {
  return values.filter((value, index) => values.indexOf(value) !== index);
}

function validateSettings(settings: SettingsFile): string[] {
  const issues: string[] = [];
  const slotKeys = new Set(settings.missionSlots.map((s) => s.slotKey));

  for (const slot of settings.missionSlots) {
    for (const linked of [slot.nextRdpSlotKey, slot.unlocksRdpSlotKey]) {
      if (linked && !slotKeys.has(linked)) {
        issues.push(`Слот ${slot.slotKey} ссылается на несуществующий ${linked}`);
      }
    }
  }

  for (const question of settings.finalReportQuestions) {
    if (question.correctOption >= question.options.length) {
      issues.push(`Вопрос ${question.orderIndex}: correctOption вне списка вариантов`);
    }
  }

  const questionIndexes = settings.finalReportQuestions.map((q) => q.orderIndex);
  const pointer = settings.appSettings.finalReportQuestionOrderIndex;

  for (const duplicate of findDuplicates(questionIndexes)) {
    issues.push(`Дублируется orderIndex вопроса: ${duplicate}`);
  }

  for (const duplicate of findDuplicates(settings.finalReportLinkBlocks.map((b) => b.blockIndex))) {
    issues.push(`Дублируется blockIndex: ${duplicate}`);
  }

  if (pointer !== null && !questionIndexes.includes(pointer)) {
    issues.push(`Финальный вопрос ${pointer} отсутствует в списке вопросов`);
  }

  for (const { value } of REPORT_FINAL_CHOICES) {
    if (!settings.finalReportContents.some((c) => c.finalChoiceValue === value)) {
      issues.push(`Нет текста концовки для ${value}`);
    }
  }

  return issues;
}

function rowsDiff<T>(label: string, expected: T[], actual: T[]): string[] {
  const expectedRows = expected.map((row) => JSON.stringify(row));
  const actualRows = actual.map((row) => JSON.stringify(row));

  return [
    ...expectedRows.filter((row) => !actualRows.includes(row)).map((row) => `${label}: нет в БД: ${row}`),
    ...actualRows.filter((row) => !expectedRows.includes(row)).map((row) => `${label}: лишнее в БД: ${row}`),
  ];
}

async function compareWithDb(client: DbClient, settings: SettingsFile): Promise<string[]> {
  const actual = await readSettingsFromDb(client);
  const fileSlotKeys = new Set(settings.missionSlots.map((s) => s.slotKey));

  return [
    ...rowsDiff('AppSettings', [settings.appSettings], [actual.appSettings]),
    ...rowsDiff(
      'Слот',
      settings.missionSlots,
      actual.missionSlots.filter((s) => fileSlotKeys.has(s.slotKey)),
    ),
    ...rowsDiff('Вопрос', settings.finalReportQuestions, actual.finalReportQuestions),
    ...rowsDiff('Концовка', settings.finalReportContents, actual.finalReportContents),
    ...rowsDiff('Подсказка', settings.detectiveHints, actual.detectiveHints),
    ...rowsDiff('Блок ссылок', settings.finalReportLinkBlocks, actual.finalReportLinkBlocks),
  ];
}

async function applyQuestions(tx: DbClient, settings: SettingsFile): Promise<void> {
  const existing = await tx.finalReportQuestion.findMany({ orderBy: { createdAt: 'asc' } });
  const keptIds: string[] = [];

  for (const question of settings.finalReportQuestions) {
    const match = existing.find(
      (row) => row.orderIndex === question.orderIndex && !keptIds.includes(row.id),
    );
    const saved = match
      ? await tx.finalReportQuestion.update({ where: { id: match.id }, data: question })
      : await tx.finalReportQuestion.create({ data: question });

    keptIds.push(saved.id);
  }

  await tx.finalReportQuestion.deleteMany({ where: { id: { notIn: keptIds } } });
}

async function applyLinkBlocks(tx: DbClient, settings: SettingsFile): Promise<void> {
  const existing = await tx.finalReportLinkBlock.findMany({ orderBy: { createdAt: 'asc' } });
  const keptIds: string[] = [];

  for (const block of settings.finalReportLinkBlocks) {
    const match = existing.find(
      (row) => row.blockIndex === block.blockIndex && !keptIds.includes(row.id),
    );
    // images не трогаем: это файлы S3 конкретного окружения
    const saved = match
      ? await tx.finalReportLinkBlock.update({ where: { id: match.id }, data: { text: block.text } })
      : await tx.finalReportLinkBlock.create({ data: { ...block, images: [] } });

    keptIds.push(saved.id);
  }

  await tx.finalReportLinkBlock.deleteMany({ where: { id: { notIn: keptIds } } });
}

async function applyAppSettings(tx: DbClient, settings: SettingsFile): Promise<void> {
  const { finalReportQuestionOrderIndex, ...fields } = settings.appSettings;
  const question =
    finalReportQuestionOrderIndex === null
      ? null
      : await tx.finalReportQuestion.findFirst({
          where: { orderIndex: finalReportQuestionOrderIndex },
        });
  const data = { ...fields, finalReportQuestionId: question?.id ?? null };
  const existing = await tx.appSettings.findFirst({ orderBy: { createdAt: 'asc' } });

  if (existing) {
    await tx.appSettings.update({ where: { id: existing.id }, data });
  } else {
    await tx.appSettings.create({ data });
  }
}

async function applySettings(tx: DbClient, settings: SettingsFile): Promise<void> {
  for (const slot of settings.missionSlots) {
    const { slotKey, ...fields } = slot;

    await tx.missionSlot.upsert({
      where: { slotKey },
      create: slot,
      update: fields,
    });
  }

  await applyQuestions(tx, settings);

  for (const content of settings.finalReportContents) {
    const { finalChoiceValue, ...fields } = content;

    await tx.finalReportContent.upsert({
      where: { finalChoiceValue },
      create: content,
      update: fields,
    });
  }

  await tx.finalReportContent.deleteMany({
    where: {
      finalChoiceValue: { notIn: settings.finalReportContents.map((c) => c.finalChoiceValue) },
    },
  });

  for (const hint of settings.detectiveHints) {
    const { orderIndex, ...fields } = hint;

    await tx.detectiveHint.upsert({
      where: { orderIndex },
      create: hint,
      update: fields,
    });
  }

  await tx.detectiveHint.deleteMany({
    where: { orderIndex: { notIn: settings.detectiveHints.map((h) => h.orderIndex) } },
  });

  await applyLinkBlocks(tx, settings);
  await applyAppSettings(tx, settings);

  // Сверка внутри транзакции: при расхождении всё откатывается.
  const mismatches = await compareWithDb(tx, settings);

  if (mismatches.length > 0) {
    throw new Error(`Сверка не прошла, изменения отменены:\n  ${mismatches.join('\n  ')}`);
  }
}

async function printMissingFiles(settings: SettingsFile): Promise<void> {
  const files = await prisma.rdpFile.findMany({
    select: { folder: true, name: true, slot: { select: { slotKey: true } } },
  });
  const uploaded = new Set(files.map((f) => `${f.slot.slotKey}/${f.folder}/${f.name}`));
  const missing = settings.expectedRdpFiles.filter(
    (f) => !uploaded.has(`${f.slotKey}/${f.folder}/${f.name}`),
  );

  if (missing.length === 0) {
    console.log('RDP-файлы: все на месте');
    return;
  }

  console.warn(`ВНИМАНИЕ: не загружено RDP-файлов: ${missing.length}. Без них миссии и чаты не дойдут до конца:`);

  for (const file of missing) {
    console.warn(`  ${file.slotKey} / ${file.folder}${file.isLocked ? ' (папка заблокирована)' : ''} / ${file.name}`);
  }
}

async function printPlan(settings: SettingsFile): Promise<void> {
  const [slots, questions, hints, contents] = await Promise.all([
    prisma.missionSlot.findMany({ select: { slotKey: true } }),
    prisma.finalReportQuestion.count(),
    prisma.detectiveHint.count(),
    prisma.finalReportContent.count(),
  ]);
  const fileSlotKeys = new Set(settings.missionSlots.map((s) => s.slotKey));
  const extraSlots = slots.filter((s) => !fileSlotKeys.has(s.slotKey));

  console.log(`Слоты: в БД ${slots.length}, в файле ${settings.missionSlots.length}`);
  console.log(`Вопросы отчёта: в БД ${questions}, в файле ${settings.finalReportQuestions.length}`);
  console.log(`Концовки: в БД ${contents}, в файле ${settings.finalReportContents.length}`);
  console.log(`Подсказки: в БД ${hints}, в файле ${settings.detectiveHints.length}`);

  if (extraSlots.length > 0) {
    console.warn(`Слоты не из файла останутся без изменений: ${extraSlots.map((s) => s.slotKey).join(', ')}`);
  }
}

function assertSettingsValid(settings: SettingsFile): void {
  const issues = validateSettings(settings);

  if (issues.length > 0) {
    throw new Error(`Настройки не прошли проверку:\n  ${issues.join('\n  ')}`);
  }
}

async function runExport(): Promise<void> {
  const settings = await readSettingsFromDb(prisma);

  assertSettingsValid(settings);
  await mkdir(path.dirname(SETTINGS_FILE_PATH), { recursive: true });
  await writeFile(SETTINGS_FILE_PATH, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');

  console.log(`Экспортировано → ${SETTINGS_FILE_PATH}`);
}

async function runVerify(): Promise<void> {
  const settings = await readSettingsFromFile();
  const mismatches = await compareWithDb(prisma, settings);

  if (mismatches.length > 0) {
    throw new Error(`Настройки в БД отличаются от файла:\n  ${mismatches.join('\n  ')}`);
  }

  console.log('Настройки совпадают с файлом');
  await printMissingFiles(settings);
}

async function runSync(isDryRun: boolean): Promise<void> {
  const settings = await readSettingsFromFile();

  assertSettingsValid(settings);
  await printPlan(settings);

  if (isDryRun) {
    console.log('--dry-run: БД не изменена');
    await printMissingFiles(settings);
    return;
  }

  await prisma.$transaction((tx) => applySettings(tx, settings), {
    timeout: TRANSACTION_TIMEOUT_MS,
  });

  console.log('Готово, сверка пройдена');
  await printMissingFiles(settings);
}

async function main(): Promise<void> {
  const [command, ...flags] = process.argv.slice(2);

  if (command === 'export') {
    await runExport();
  } else if (command === 'sync' && flags.includes('--verify')) {
    await runVerify();
  } else if (command === 'sync') {
    await runSync(flags.includes('--dry-run'));
  } else {
    throw new Error('Использование: game-settings.ts export | sync [--dry-run | --verify]');
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
