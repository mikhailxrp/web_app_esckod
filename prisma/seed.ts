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

async function main(): Promise<void> {
  await seedAdminUser();
  await seedAppSettings();
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
