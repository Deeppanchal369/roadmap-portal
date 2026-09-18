import { env, isProduction } from '../config/env.js';

/**
 * Email is *simulated*, as the brief asks.
 *
 * Instead of wiring an SMTP provider (which a reviewer would have to configure
 * before they could sign up), every outbound mail is printed to the server log
 * and kept in a small in-memory outbox that the dev-only route
 * `GET /api/v1/dev/outbox` exposes. Swapping in Nodemailer or Resend later is a
 * one-function change, because the rest of the app only calls `sendMail`.
 */
export interface SimulatedMail {
  to: string;
  subject: string;
  body: string;
  link?: string;
  sentAt: string;
}

const outbox: SimulatedMail[] = [];
const OUTBOX_LIMIT = 50;

export async function sendMail(mail: Omit<SimulatedMail, 'sentAt'>): Promise<void> {
  const entry: SimulatedMail = { ...mail, sentAt: new Date().toISOString() };
  outbox.unshift(entry);
  if (outbox.length > OUTBOX_LIMIT) outbox.length = OUTBOX_LIMIT;

  if (!isProduction) {
    console.log(
      ['', '── simulated email ──────────────────────────────',
        `to:      ${mail.to}`,
        `subject: ${mail.subject}`,
        mail.link ? `link:    ${mail.link}` : '',
        '─────────────────────────────────────────────────', ''].filter(Boolean).join('\n'),
    );
  }
}

export function readOutbox(): SimulatedMail[] {
  return outbox;
}

export function verificationLink(token: string): string {
  return `${env.CLIENT_URL}/verify-email?token=${token}`;
}

export function passwordResetLink(token: string): string {
  return `${env.CLIENT_URL}/reset-password?token=${token}`;
}
