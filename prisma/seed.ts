import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../lib/password';

const prisma = new PrismaClient();

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

async function main(): Promise<void> {
  await seedAdminUser();
  await seedAppSettings();
  await seedMissionSlots();
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
