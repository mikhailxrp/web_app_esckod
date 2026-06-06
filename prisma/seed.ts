import {
  ChatAuthor,
  ChatType,
  ConditionType,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import { hashPassword } from '../lib/password';

const prisma = new PrismaClient();

// value в choices Марины === FinalReportContent.finalChoiceValue
const FINAL_CHOICE = {
  PROTECT: 'PROTECT',
  ACCUSE: 'ACCUSE',
} as const;

const CHAT_SCRIPT_CODES = [
  'detective_greeting',
  'detective_end',
  'marina_greeting',
  'marina_final_choice',
  'marina_end_protect',
  'marina_end_accuse',
] as const;

const CHAT_SCRIPTS: Prisma.ChatScriptCreateManyInput[] = [
  {
    code: 'detective_greeting',
    chatType: ChatType.DETECTIVE,
    author: ChatAuthor.DETECTIVE,
    text: 'Здравствуйте, детектив. Начнём.',
    isStart: true,
    isEnd: false,
    hasChoices: false,
  },
  {
    code: 'detective_end',
    chatType: ChatType.DETECTIVE,
    author: ChatAuthor.DETECTIVE,
    text: 'Дело завершено.',
    isStart: false,
    isEnd: true,
    hasChoices: false,
  },
  {
    code: 'marina_greeting',
    chatType: ChatType.MARINA,
    author: ChatAuthor.MARINA,
    text: 'Я Марина. Я расскажу свою историю.',
    isStart: true,
    isEnd: false,
    hasChoices: false,
  },
  {
    code: 'marina_final_choice',
    chatType: ChatType.MARINA,
    author: ChatAuthor.MARINA,
    text: 'Что вы решите?',
    isStart: false,
    isEnd: false,
    hasChoices: true,
    choices: [
      { label: 'Защитить', value: FINAL_CHOICE.PROTECT },
      { label: 'Обвинить', value: FINAL_CHOICE.ACCUSE },
    ],
  },
  {
    code: 'marina_end_protect',
    chatType: ChatType.MARINA,
    author: ChatAuthor.MARINA,
    text: 'Спасибо. (заглушка финала: защитить)',
    isStart: false,
    isEnd: true,
    hasChoices: false,
  },
  {
    code: 'marina_end_accuse',
    chatType: ChatType.MARINA,
    author: ChatAuthor.MARINA,
    text: 'Понимаю. (заглушка финала: обвинить)',
    isStart: false,
    isEnd: true,
    hasChoices: false,
  },
];

type ChatTransitionSeed = {
  fromCode: (typeof CHAT_SCRIPT_CODES)[number];
  toCode: (typeof CHAT_SCRIPT_CODES)[number];
  conditionType: ConditionType;
  conditionValue: string | null;
};

const CHAT_TRANSITIONS: ChatTransitionSeed[] = [
  {
    fromCode: 'detective_greeting',
    toCode: 'detective_end',
    conditionType: ConditionType.ALWAYS,
    conditionValue: null,
  },
  {
    fromCode: 'marina_greeting',
    toCode: 'marina_final_choice',
    conditionType: ConditionType.ALWAYS,
    conditionValue: null,
  },
  {
    fromCode: 'marina_final_choice',
    toCode: 'marina_end_protect',
    conditionType: ConditionType.CHOICE,
    conditionValue: FINAL_CHOICE.PROTECT,
  },
  {
    fromCode: 'marina_final_choice',
    toCode: 'marina_end_accuse',
    conditionType: ConditionType.CHOICE,
    conditionValue: FINAL_CHOICE.ACCUSE,
  },
];

const FINAL_REPORT_CONTENT: Prisma.FinalReportContentCreateManyInput[] = [
  {
    finalChoiceValue: FINAL_CHOICE.PROTECT,
    title: 'Защита',
    bodyText: 'Заглушка финала: защитить Марину',
  },
  {
    finalChoiceValue: FINAL_CHOICE.ACCUSE,
    title: 'Обвинение',
    bodyText: 'Заглушка финала: обвинить Марину',
  },
];

const DEFAULT_APP_SETTINGS = {
  defaultMarketingConsent: false,
  supportEmail: 'support@example.com',
  privacyPolicyUrl: 'https://example.com/privacy',
} as const;

async function seedAdminUser(): Promise<void> {
  const adminCount = await prisma.adminUser.count();

  if (adminCount > 0) {
    console.log('AdminUser already exists, skipping');
    return;
  }

  const email = process.env.ADMIN_INITIAL_EMAIL;
  const password = process.env.ADMIN_INITIAL_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'ADMIN_INITIAL_EMAIL and ADMIN_INITIAL_PASSWORD must be set for initial seed',
    );
  }

  const passwordHash = await hashPassword(password);

  await prisma.adminUser.create({
    data: {
      email: email.toLowerCase().trim(),
      passwordHash,
    },
  });

  console.log('Created initial AdminUser');
}

async function seedAppSettings(): Promise<void> {
  const settingsCount = await prisma.appSettings.count();

  if (settingsCount > 0) {
    console.log('AppSettings already exists, skipping');
    return;
  }

  await prisma.appSettings.create({
    data: DEFAULT_APP_SETTINGS,
  });

  console.log('Created AppSettings singleton');
}

// FIXME(Phase 10, Task 1): данные ниже — заглушка из Phase 0 и расходятся со
// спецификацией сидера в `.docs/database.md` §3 по 8 пунктам. Перед релизом миссий
// ОБЯЗАТЕЛЬНО пересидить строго по таблицам database.md §3:
//   1) slotKey: CRACK_P2 / CRACK_VUZ / DECIPHER_SHANTAZH / DECIPHER_MARKOVA / RDP_VICTOR / RDP_MARINA
//   2) orderIndex: 10..60, чередуя по сюжету (CRACK_P2 → RDP_VICTOR → DECIPHER_SHANTAZH → CRACK_VUZ → DECIPHER_MARKOVA → RDP_MARINA)
//   3) crackMaxAttempts: 5 (сейчас 6)
//   4) rdpPuzzleGridSize: 6 (сценарий 1) и 7 (сценарий 2) — сейчас 4, нарушает инвариант «6 или 7»
//   5) timerSeconds: null (сценарий 1), 120 (сценарий 2) — сейчас 300 у обоих
//   6) nextRdpSlotKey: "RDP_MARINA" у RDP_VICTOR — сейчас не задан
//   7) unlocksRdpFolder = ИМЯ папки ("Шантаж"/"Маркова", = RdpFile.folder), unlocksRdpSlotKey = "RDP_VICTOR" у ОБОИХ
//      decipher-слотов — сейчас путь '/rdp/session-N' и раздельные rdp-1/rdp-2 (сломает unlock-folder: сверка строгим равенством)
//   8) logSubjectName: "Виктор" и "Неизвестно" — сейчас "Виктор Пак" и "Марина"
// Полный чек-лист и обоснование — `.docs/phases/_status.md` → Phase 10.
async function seedMissionSlots(): Promise<void> {
  const slotCount = await prisma.missionSlot.count();

  if (slotCount > 0) {
    console.log('MissionSlots already exist, skipping');
    return;
  }

  await prisma.missionSlot.createMany({
    data: [
      {
        slotKey: 'crack-1',
        missionType: 'CRACK',
        orderIndex: 1,
        isActive: true,
        displayName: 'Взломщик — Сайт Пака',
        targetWord: 'PROXY',
        targetUrl: 'https://pak-corp.example.com',
        targetEmail: 'v.pak@pak-corp.example.com',
        resultPassword: 'pr0xy_acc3ss',
        crackMaxAttempts: 6,
      },
      {
        slotKey: 'crack-2',
        missionType: 'CRACK',
        orderIndex: 2,
        isActive: true,
        displayName: 'Взломщик — Архив',
        targetWord: 'DELTA',
        targetUrl: 'https://archive.pak-corp.example.com',
        targetEmail: 'archive@pak-corp.example.com',
        resultPassword: 'd3lta_k3y',
        crackMaxAttempts: 6,
      },
      {
        slotKey: 'decipher-1',
        missionType: 'DECIPHER',
        orderIndex: 3,
        isActive: true,
        displayName: 'Дешифратор — Папка A',
        cipherType: 'VIGENERE',
        encryptedWord: 'XQKZM',
        cipherKey: 'AGENT',
        folderPassword: 'open_sesame',
        folderPath: '/data/folder-a',
        unlocksRdpFolder: '/rdp/session-1',
        unlocksRdpSlotKey: 'rdp-1',
      },
      {
        slotKey: 'decipher-2',
        missionType: 'DECIPHER',
        orderIndex: 4,
        isActive: true,
        displayName: 'Дешифратор — Папка B',
        cipherType: 'PLAYFAIR',
        encryptedWord: 'BVKDP',
        cipherKey: 'CORPO',
        folderPassword: 'unlock_now',
        folderPath: '/data/folder-b',
        unlocksRdpFolder: '/rdp/session-2',
        unlocksRdpSlotKey: 'rdp-2',
      },
      {
        slotKey: 'rdp-1',
        missionType: 'RDP',
        orderIndex: 5,
        isActive: true,
        displayName: 'Удалённый доступ — Сервер 1',
        correctIp: '192.168.1.10',
        rdpScenario: 1,
        logSubjectName: 'Виктор Пак',
        timerSeconds: 300,
        rdpPuzzleGridSize: 4,
      },
      {
        slotKey: 'rdp-2',
        missionType: 'RDP',
        orderIndex: 6,
        isActive: true,
        displayName: 'Удалённый доступ — Сервер 2',
        correctIp: '10.0.0.42',
        rdpScenario: 2,
        logSubjectName: 'Марина',
        timerSeconds: 300,
        rdpPuzzleGridSize: 4,
      },
    ],
  });

  console.log('Created 6 MissionSlots (2 CRACK, 2 DECIPHER, 2 RDP)');
}

async function seedChatGraph(): Promise<void> {
  const scriptCount = await prisma.chatScript.count();

  if (scriptCount > 0) {
    console.log('ChatScript already exists, skipping');
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.chatScript.createMany({ data: CHAT_SCRIPTS });

    const scripts = await tx.chatScript.findMany({
      where: { code: { in: [...CHAT_SCRIPT_CODES] } },
      select: { id: true, code: true },
    });

    const codeToId = new Map(scripts.map((s) => [s.code, s.id]));

    const transitions: Prisma.ChatTransitionCreateManyInput[] =
      CHAT_TRANSITIONS.map((transition) => {
        const fromMessageId = codeToId.get(transition.fromCode);
        const toMessageId = codeToId.get(transition.toCode);

        if (!fromMessageId || !toMessageId) {
          throw new Error(
            `Chat transition references missing script: ${transition.fromCode} → ${transition.toCode}`,
          );
        }

        return {
          fromMessageId,
          toMessageId,
          conditionType: transition.conditionType,
          conditionValue: transition.conditionValue,
        };
      });

    await tx.chatTransition.createMany({ data: transitions });
  });

  console.log('Created 6 ChatScripts + 4 ChatTransitions');
}

async function seedFinalReportContent(): Promise<void> {
  const contentCount = await prisma.finalReportContent.count();

  if (contentCount > 0) {
    console.log('FinalReportContent already exists, skipping');
    return;
  }

  await prisma.finalReportContent.createMany({ data: FINAL_REPORT_CONTENT });

  console.log('Created 2 FinalReportContent stubs');
}

async function seedDetectiveHint(): Promise<void> {
  await prisma.detectiveHint.upsert({
    where: { orderIndex: 1 },
    create: {
      orderIndex: 1,
      text: 'Заглушка подсказки. Финальный текст предоставит заказчик.',
      isActive: true,
    },
    update: {},
  });

  console.log('Ensured DetectiveHint stub (orderIndex: 1)');
}

async function main(): Promise<void> {
  await seedAdminUser();
  await seedAppSettings();
  await seedMissionSlots();
  await seedChatGraph();
  await seedFinalReportContent();
  await seedDetectiveHint();
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
