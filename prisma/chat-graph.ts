/**
 * Перенос графа чатов между базами через prisma/data/chat-graph.json.
 *
 *   npm run db:chat:export             БД → JSON
 *   npm run db:chat:sync -- --dry-run  показать изменения, ничего не записывая
 *   npm run db:chat:sync               JSON → БД (одна транзакция)
 *   npm run db:chat:sync -- --verify   сверить БД с JSON, только чтение
 *
 * Реплики сопоставляются по `code`, поэтому их id и указатели игроков сохраняются.
 * `audioUrl` не переносится: файлы лежат в бакете конкретного окружения.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  ChatAuthor,
  ChatType,
  ConditionType,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import { z } from 'zod';

import { buildTriggerValues } from '../constants/chatTriggerEvents';
import { choicesSchema } from '../lib/validations/admin-chats';

const GRAPH_FILE_PATH = path.join(process.cwd(), 'prisma', 'data', 'chat-graph.json');
const TRANSACTION_TIMEOUT_MS = 60_000;
const MARINA_FINAL_CHOICE_CODE = 'marina_final_choice';

const scriptSchema = z.object({
  code: z.string().min(1),
  chatType: z.nativeEnum(ChatType),
  author: z.nativeEnum(ChatAuthor),
  text: z.string().nullable(),
  hasChoices: z.boolean(),
  choices: choicesSchema.nullable(),
  isStart: z.boolean(),
  isEnd: z.boolean(),
});

const transitionSchema = z.object({
  fromCode: z.string().min(1),
  toCode: z.string().min(1),
  conditionType: z.nativeEnum(ConditionType),
  conditionValue: z.string().nullable(),
  priority: z.number().int(),
});

const graphFileSchema = z.object({
  version: z.literal(1),
  scripts: z.array(scriptSchema),
  transitions: z.array(transitionSchema),
});

type GraphFile = z.infer<typeof graphFileSchema>;
type GraphScript = z.infer<typeof scriptSchema>;
type DbClient = Prisma.TransactionClient;

const prisma = new PrismaClient();

function compareStrings(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function scriptKey(script: GraphScript): string {
  return JSON.stringify(scriptSchema.parse(script));
}

function transitionKeys(graph: GraphFile): string[] {
  const chatTypeByCode = new Map(graph.scripts.map((s) => [s.code, s.chatType]));

  return graph.transitions
    .map((t) =>
      JSON.stringify([
        chatTypeByCode.get(t.fromCode) ?? null,
        t.fromCode,
        t.toCode,
        t.conditionType,
        t.conditionValue,
        t.priority,
      ]),
    )
    .sort(compareStrings);
}

async function readGraphFromDb(client: DbClient): Promise<GraphFile> {
  const [scripts, transitions] = await Promise.all([
    client.chatScript.findMany({ orderBy: [{ chatType: 'asc' }, { code: 'asc' }] }),
    client.chatTransition.findMany({
      include: {
        fromMessage: { select: { code: true } },
        toMessage: { select: { code: true } },
      },
    }),
  ]);

  const graph = graphFileSchema.parse({
    version: 1,
    scripts: scripts.map((s) => ({
      code: s.code,
      chatType: s.chatType,
      author: s.author,
      text: s.text,
      hasChoices: s.hasChoices,
      choices: s.choices ?? null,
      isStart: s.isStart,
      isEnd: s.isEnd,
    })),
    transitions: transitions.map((t) => ({
      fromCode: t.fromMessage.code,
      toCode: t.toMessage.code,
      conditionType: t.conditionType,
      conditionValue: t.conditionValue,
      priority: t.priority,
    })),
  });

  graph.transitions.sort((a, b) =>
    compareStrings(JSON.stringify(a), JSON.stringify(b)),
  );

  return graph;
}

async function readGraphFromFile(): Promise<GraphFile> {
  const raw = await readFile(GRAPH_FILE_PATH, 'utf8');
  return graphFileSchema.parse(JSON.parse(raw));
}

function collectReachable(startCode: string, graph: GraphFile): Set<string> {
  const reachable = new Set<string>();
  const queue = [startCode];

  while (queue.length > 0) {
    const code = queue.pop();

    if (code === undefined || reachable.has(code)) continue;

    reachable.add(code);

    for (const t of graph.transitions) {
      if (t.fromCode === code) queue.push(t.toCode);
    }
  }

  return reachable;
}

/** Те же правила, что lib/admin/chatGraphValidator.ts, но по данным файла, до записи. */
function validateGraph(graph: GraphFile, slotKeys: string[]): string[] {
  const issues: string[] = [];
  const byCode = new Map<string, GraphScript>();

  for (const script of graph.scripts) {
    if (byCode.has(script.code)) issues.push(`Дублируется code: ${script.code}`);
    byCode.set(script.code, script);
  }

  const validTriggers = new Set(buildTriggerValues(slotKeys));

  for (const t of graph.transitions) {
    const from = byCode.get(t.fromCode);
    const to = byCode.get(t.toCode);

    if (!from || !to) {
      issues.push(`Битый переход: ${t.fromCode} → ${t.toCode}`);
      continue;
    }

    if (from.chatType !== to.chatType) {
      issues.push(`Переход между разными чатами: ${t.fromCode} → ${t.toCode}`);
    }

    if (t.conditionType === 'TRIGGER' && !validTriggers.has(t.conditionValue ?? '')) {
      issues.push(
        `Триггер «${t.conditionValue}» (${t.fromCode}) не соответствует слотам целевой БД`,
      );
    }
  }

  for (const script of graph.scripts) {
    const outgoing = graph.transitions.filter((t) => t.fromCode === script.code);

    if (!script.hasChoices && !script.isEnd) {
      if (!outgoing.some((t) => t.conditionType !== 'CHOICE')) {
        issues.push(`Реплика ${script.code}: нет исходящих ALWAYS/TRIGGER`);
      }
    }

    if (script.hasChoices) {
      if (!script.choices || script.choices.length === 0) {
        issues.push(`Реплика ${script.code}: hasChoices без вариантов`);
        continue;
      }

      for (const choice of script.choices) {
        const covered = outgoing.some(
          (t) => t.conditionType === 'CHOICE' && t.conditionValue === choice.value,
        );

        if (!covered) {
          issues.push(`Реплика ${script.code}: вариант «${choice.value}» без перехода`);
        }
      }
    }
  }

  for (const chatType of Object.values(ChatType)) {
    const chatScripts = graph.scripts.filter((s) => s.chatType === chatType);
    const starts = chatScripts.filter((s) => s.isStart);

    if (starts.length !== 1) {
      issues.push(`Чат ${chatType}: стартовых реплик ${starts.length}, нужна одна`);
      continue;
    }

    const reachable = collectReachable(starts[0].code, graph);

    for (const script of chatScripts) {
      if (!reachable.has(script.code)) {
        issues.push(`Реплика ${script.code} недостижима от старта`);
      }
    }

    if (!chatScripts.some((s) => s.isEnd && reachable.has(s.code))) {
      issues.push(`Чат ${chatType}: концовка недостижима`);
    }
  }

  if (!byCode.has(MARINA_FINAL_CHOICE_CODE)) {
    issues.push(`Нет реплики ${MARINA_FINAL_CHOICE_CODE}: не сработает final_choice_made`);
  }

  return issues;
}

function diffSorted(label: string, expected: string[], actual: string[]): string[] {
  const remaining = [...actual];
  const issues: string[] = [];

  for (const key of expected) {
    const index = remaining.indexOf(key);

    if (index === -1) {
      issues.push(`${label}: нет в БД: ${key}`);
    } else {
      remaining.splice(index, 1);
    }
  }

  for (const key of remaining) {
    issues.push(`${label}: лишнее в БД: ${key}`);
  }

  return issues;
}

async function compareWithDb(client: DbClient, graph: GraphFile): Promise<string[]> {
  const actual = await readGraphFromDb(client);

  return [
    ...diffSorted(
      'Реплика',
      graph.scripts.map(scriptKey),
      actual.scripts.map(scriptKey),
    ),
    ...diffSorted('Переход', transitionKeys(graph), transitionKeys(actual)),
  ];
}

async function assertGraphValid(graph: GraphFile): Promise<void> {
  const slots = await prisma.missionSlot.findMany({ select: { slotKey: true } });
  const issues = validateGraph(graph, slots.map((s) => s.slotKey));

  if (issues.length > 0) {
    throw new Error(`Граф не прошёл проверку:\n  ${issues.join('\n  ')}`);
  }
}

async function runExport(): Promise<void> {
  const graph = await readGraphFromDb(prisma);

  await assertGraphValid(graph);
  await mkdir(path.dirname(GRAPH_FILE_PATH), { recursive: true });
  await writeFile(GRAPH_FILE_PATH, `${JSON.stringify(graph, null, 2)}\n`, 'utf8');

  console.log(
    `Экспортировано: ${graph.scripts.length} реплик, ${graph.transitions.length} переходов → ${GRAPH_FILE_PATH}`,
  );
}

async function printPlan(graph: GraphFile): Promise<void> {
  const [existing, transitionCount] = await Promise.all([
    prisma.chatScript.findMany({ select: { id: true, code: true, audioUrl: true } }),
    prisma.chatTransition.count(),
  ]);

  const fileCodes = new Set(graph.scripts.map((s) => s.code));
  const existingCodes = new Set(existing.map((s) => s.code));
  const toDelete = existing.filter((s) => !fileCodes.has(s.code));
  const deletedIds = toDelete.map((s) => s.id);

  const affectedStates = await prisma.chatState.count({
    where: {
      OR: [
        { currentDetectiveMessageId: { in: deletedIds } },
        { currentMarinaMessageId: { in: deletedIds } },
      ],
    },
  });

  console.log(`Реплики: создать ${graph.scripts.filter((s) => !existingCodes.has(s.code)).length}, обновить ${existing.length - toDelete.length}, удалить ${toDelete.length}`);
  console.log(`Переходы: удалить ${transitionCount}, создать ${graph.transitions.length}`);
  console.log(`audioUrl сохранится у реплик: ${existing.filter((s) => s.audioUrl && fileCodes.has(s.code)).length}`);
  console.log(`Игроков, чей чат сбросится на старт: ${affectedStates}`);

  if (toDelete.length > 0) {
    console.log(`Будут удалены: ${toDelete.map((s) => s.code).join(', ')}`);
  }
}

async function applyGraph(tx: DbClient, graph: GraphFile): Promise<void> {
  await tx.chatTransition.deleteMany();

  for (const script of graph.scripts) {
    const { code, ...fields } = script;
    const data = { ...fields, choices: fields.choices ?? Prisma.DbNull };

    await tx.chatScript.upsert({
      where: { code },
      create: { code, ...data },
      update: data,
    });
  }

  await tx.chatScript.deleteMany({
    where: { code: { notIn: graph.scripts.map((s) => s.code) } },
  });

  const scripts = await tx.chatScript.findMany({ select: { id: true, code: true } });
  const idByCode = new Map(scripts.map((s) => [s.code, s.id]));

  await tx.chatTransition.createMany({
    data: graph.transitions.map((t) => ({
      fromMessageId: idByCode.get(t.fromCode) ?? '',
      toMessageId: idByCode.get(t.toCode) ?? '',
      conditionType: t.conditionType,
      conditionValue: t.conditionValue,
      priority: t.priority,
    })),
  });

  // Сверка внутри транзакции: при расхождении граф откатывается целиком.
  const mismatches = await compareWithDb(tx, graph);

  if (mismatches.length > 0) {
    throw new Error(`Сверка не прошла, изменения отменены:\n  ${mismatches.join('\n  ')}`);
  }
}

async function runVerify(): Promise<void> {
  const graph = await readGraphFromFile();
  const mismatches = await compareWithDb(prisma, graph);

  if (mismatches.length > 0) {
    throw new Error(`Граф в БД отличается от файла:\n  ${mismatches.join('\n  ')}`);
  }

  console.log(
    `Совпадает: ${graph.scripts.length} реплик, ${graph.transitions.length} переходов`,
  );
}

async function runSync(isDryRun: boolean): Promise<void> {
  const graph = await readGraphFromFile();

  await assertGraphValid(graph);
  await printPlan(graph);

  if (isDryRun) {
    console.log('--dry-run: БД не изменена');
    return;
  }

  await prisma.$transaction((tx) => applyGraph(tx, graph), {
    timeout: TRANSACTION_TIMEOUT_MS,
  });

  console.log(
    `Готово, сверка пройдена: ${graph.scripts.length} реплик, ${graph.transitions.length} переходов`,
  );
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
    throw new Error('Использование: chat-graph.ts export | sync [--dry-run | --verify]');
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
