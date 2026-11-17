import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';

export const DEFAULT_BUSINESS_SETTINGS = {
  businessName: 'NALDA USA Products',
  businessType: 'Cosmetics, Beauty Products, Skincare, Body Care, Perfumes, Baby Essentials & Imported Products',
  address: '4 Bima Road, Mikocheni B, Dar es Salaam, Tanzania',
  phone: '+255747163059',
  whatsapp: '+255747163059',
  internationalPhone: '+12027439424',
  instagram: 'https://www.instagram.com/nalda_usa_products/',
  babyEssentials: 'NALDA USA Baby Essentials',
  currency: 'TZS',
  location: 'Mikocheni B, Dar es Salaam, Tanzania',
  personalShoppingOffered: true,
  cargoShippingOffered: true,
  timezone: 'Africa/Dar_es_Salaam',
};

export async function listSettings(publicOnly = false) {
  const settings = await prisma.systemSetting.findMany({
    where: publicOnly ? { isPublic: true } : {},
    orderBy: { key: 'asc' },
  });
  return settings;
}

export async function getSettingsMap(publicOnly = false): Promise<Record<string, unknown>> {
  const settings = await listSettings(publicOnly);
  return Object.fromEntries(settings.map((s) => [s.key, s.value]));
}

export async function getSetting(key: string) {
  const setting = await prisma.systemSetting.findUnique({ where: { key } });
  return setting?.value ?? null;
}

export async function upsertSetting(key: string, value: Prisma.InputJsonValue, description?: string, isPublic = true) {
  return prisma.systemSetting.upsert({
    where: { key },
    create: { key, value, description, isPublic },
    update: { value, description, isPublic },
  });
}

export async function updateSettings(entries: { key: string; value: Prisma.InputJsonValue; description?: string; isPublic?: boolean }[]) {
  const results = [];
  for (const entry of entries) {
    results.push(await upsertSetting(entry.key, entry.value, entry.description, entry.isPublic ?? true));
  }
  return results;
}

export async function getBusinessInfo() {
  const map = await getSettingsMap();
  return { ...DEFAULT_BUSINESS_SETTINGS, ...map };
}
