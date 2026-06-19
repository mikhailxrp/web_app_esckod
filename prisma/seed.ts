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

type MissionSlotSeedData = Omit<
  Prisma.MissionSlotUncheckedCreateInput,
  'id' | 'createdAt' | 'updatedAt'
>;

const MISSION_SLOT_SEEDS: MissionSlotSeedData[] = [
  {
    slotKey: 'CRACK_P2',
    missionType: 'CRACK',
    orderIndex: 10,
    isActive: true,
    displayName: 'Взлом сайта P2 Digital',
    targetUrl: 'https://p2-digital.example.com',
    targetEmail: 'admin@p2-digital.example.com',
    resultPassword: 'stub_p2_pass',
    crackMaxAttempts: 5,
    hintText: null,
  },
  {
    slotKey: 'RDP_VICTOR',
    missionType: 'RDP',
    orderIndex: 20,
    isActive: true,
    displayName: 'Удалённый доступ к компьютеру Виктора',
    correctIp: '192.168.1.10',
    rdpScenario: 1,
    logSubjectName: 'Виктор',
    nextRdpSlotKey: 'RDP_MARINA',
    timerSeconds: null,
    rdpPuzzleGridSize: 6,
    hintText: null,
  },
  {
    slotKey: 'DECIPHER_SHANTAZH',
    missionType: 'DECIPHER',
    orderIndex: 30,
    isActive: true,
    displayName: 'Расшифровка папки шантажа',
    cipherType: 'VIGENERE',
    encryptedWord: 'XQKZM',
    cipherKey: 'AGENT',
    folderPassword: 'stub_shantazh_pass',
    folderPath: 'C:\\Users\\Victor\\Shantazh',
    unlocksRdpFolder: 'Шантаж',
    unlocksRdpSlotKey: 'RDP_VICTOR',
    hintText: null,
  },
  {
    slotKey: 'CRACK_VUZ',
    missionType: 'CRACK',
    orderIndex: 40,
    isActive: true,
    displayName: 'Взлом сайта ВУЗа',
    targetUrl: 'https://vuz.example.com',
    targetEmail: 'portal@vuz.example.com',
    resultPassword: 'stub_vuz_pass',
    crackMaxAttempts: 5,
    hintText: null,
  },
  {
    slotKey: 'DECIPHER_MARKOVA',
    missionType: 'DECIPHER',
    orderIndex: 50,
    isActive: true,
    displayName: 'Расшифровка папки Маркова',
    cipherType: 'PLAYFAIR',
    encryptedWord: 'BVKDP',
    cipherKey: 'CORPO',
    folderPassword: 'stub_markova_pass',
    folderPath: 'C:\\Users\\Victor\\Markova',
    unlocksRdpFolder: 'Маркова',
    unlocksRdpSlotKey: 'RDP_VICTOR',
    hintText: null,
  },
  {
    slotKey: 'RDP_MARINA',
    missionType: 'RDP',
    orderIndex: 60,
    isActive: true,
    displayName: 'Удалённый доступ к компьютеру Марины',
    correctIp: '10.0.0.42',
    rdpScenario: 2,
    logSubjectName: 'Неизвестно',
    nextRdpSlotKey: null,
    timerSeconds: 120,
    rdpPuzzleGridSize: 7,
    hintText: null,
  },
];

async function seedMissionSlots(): Promise<void> {
  for (const slot of MISSION_SLOT_SEEDS) {
    const { slotKey, ...slotData } = slot;

    await prisma.missionSlot.upsert({
      where: { slotKey },
      create: slot,
      update: slotData,
    });
  }

  console.log('Ensured 6 MissionSlots (database.md §3)');
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

const FINAL_REPORT_QUESTIONS: Prisma.FinalReportQuestionCreateManyInput[] = [
  {
    orderIndex: 1,
    questionText: 'Кто инициировал доведение до самоубийства? (заглушка)',
    options: ['Виктор', 'Евгений', 'Елена', 'Марина'],
    correctOption: 0,
  },
  {
    orderIndex: 2,
    questionText: 'Какой документ стал ключевым в расследовании? (заглушка)',
    options: ['Договор', 'Переписка', 'Аудиозапись', 'Фотография'],
    correctOption: 1,
  },
  {
    orderIndex: 3,
    questionText: 'Где был найден решающий след? (заглушка)',
    options: ['На сервере', 'В архиве', 'В почте', 'В мессенджере'],
    correctOption: 2,
  },
];

async function seedFinalReportQuestion(): Promise<void> {
  const questionCount = await prisma.finalReportQuestion.count();

  if (questionCount > 0) {
    console.log('FinalReportQuestion already exists, skipping');
    return;
  }

  await prisma.finalReportQuestion.createMany({ data: FINAL_REPORT_QUESTIONS });

  console.log('Created 3 FinalReportQuestion stubs');
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

async function seedFinalReportLinkBlock(): Promise<void> {
  for (const blockIndex of [1, 2]) {
    await prisma.finalReportLinkBlock.upsert({
      where: { blockIndex },
      create: { blockIndex, text: '', images: [] },
      update: {},
    });
  }

  console.log('Ensured 2 FinalReportLinkBlock stubs (blockIndex: 1, 2)');
}

async function main(): Promise<void> {
  await seedAdminUser();
  await seedAppSettings();
  await seedMissionSlots();
  await seedChatGraph();
  await seedFinalReportContent();
  await seedFinalReportQuestion();
  await seedDetectiveHint();
  await seedFinalReportLinkBlock();
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
