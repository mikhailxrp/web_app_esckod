import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const FALLBACK_DEFAULTS = {
  defaultMarketingConsent: false,
  supportEmail: 'support@example.com',
  privacyPolicyUrl: 'https://example.com/privacy',
} as const;

export async function GET(): Promise<NextResponse> {
  try {
    const settings = await prisma.appSettings.findFirst();

    if (!settings) {
      return NextResponse.json(FALLBACK_DEFAULTS);
    }

    return NextResponse.json({
      defaultMarketingConsent: settings.defaultMarketingConsent,
      supportEmail: settings.supportEmail,
      privacyPolicyUrl: settings.privacyPolicyUrl,
    });
  } catch (error) {
    console.error('Failed to load registration defaults:', error);
    return NextResponse.json(FALLBACK_DEFAULTS);
  }
}
