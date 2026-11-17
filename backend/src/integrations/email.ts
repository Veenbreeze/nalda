import nodemailer from 'nodemailer';
import { env, smtpConfigured } from '../config/env';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    });
  }
  return transporter;
}

export interface MailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
}

export async function sendMail(options: MailOptions): Promise<void> {
  if (!smtpConfigured) {
    console.warn(`SMTP not configured - skipped email to ${String(options.to)}: ${options.subject}`);
    return;
  }
  await getTransporter().sendMail({
    from: env.SMTP_FROM,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
  });
}

export async function verifySmtp(): Promise<boolean> {
  if (!smtpConfigured) return false;
  try {
    await getTransporter().verify();
    return true;
  } catch {
    return false;
  }
}
