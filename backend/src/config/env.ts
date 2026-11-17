import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  API_PREFIX: z.string().default('/api/v1'),
  BUSINESS_TIMEZONE: z.string().default('Africa/Dar_es_Salaam'),

  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  REFRESH_COOKIE_NAME: z.string().default('nalda_refresh_token'),
  REFRESH_COOKIE_SECURE: z.coerce.boolean().default(false),
  BCRYPT_ROUNDS: z.coerce.number().default(12),
  PASSWORD_RESET_TOKEN_EXPIRES_MIN: z.coerce.number().default(30),

  SEED_ADMIN_EMAIL: z.string().email().default('admin@naldausa.co.tz'),
  SEED_ADMIN_PASSWORD: z.string().default('ChangeMe123!'),
  SEED_ADMIN_NAME: z.string().default('NALDA Super Admin'),

  WHATSAPP_ACCESS_TOKEN: z.string().optional().default(''),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional().default(''),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().optional().default(''),
  WHATSAPP_APP_SECRET: z.string().optional().default(''),
  WHATSAPP_VERIFY_TOKEN: z.string().default('nalda_dev_verify_token'),
  META_GRAPH_API_VERSION: z.string().default('v21.0'),
  WHATSAPP_WEBHOOK_ENABLED: z
    .string()
    .optional()
    .default('true')
    .transform((v) => v === 'true'),

  CLOUDINARY_CLOUD_NAME: z.string().optional().default(''),
  CLOUDINARY_API_KEY: z.string().optional().default(''),
  CLOUDINARY_API_SECRET: z.string().optional().default(''),
  CLOUDINARY_FOLDER: z.string().optional().default('nalda-crm'),

  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z
    .string()
    .optional()
    .default('false')
    .transform((v) => v === 'true'),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASSWORD: z.string().optional().default(''),
  SMTP_FROM: z.string().optional().default('NALDA USA Products <no-reply@naldausa.co.tz>'),

  BACKUP_DIR: z.string().default('./backups'),
  BACKUP_RETENTION_DAYS: z.coerce.number().default(30),

  RATE_LIMIT_WINDOW_MIN: z.coerce.number().default(15),
  RATE_LIMIT_MAX: z.coerce.number().default(300),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().default(20),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  throw new Error('Environment validation failed. Check your .env file.');
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

export const whatsappConfigured = Boolean(
  env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID,
);

export const cloudinaryConfigured = Boolean(
  env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET,
);

export const smtpConfigured = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD);
