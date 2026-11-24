import type { FastifyBaseLogger } from 'fastify';

export type Email = { to: string; subject: string; text: string; html?: string };

export interface EmailSender {
  send(email: Email): Promise<void>;
}

/** Development: prints the email to the log and keeps the last 50 for GET /dev/outbox. */
export class ConsoleEmail implements EmailSender {
  readonly outbox: (Email & { sentAt: string })[] = [];

  constructor(private readonly log?: Pick<FastifyBaseLogger, 'info'>) {}

  async send(email: Email) {
    this.outbox.unshift({ ...email, sentAt: new Date().toISOString() });
    this.outbox.length = Math.min(this.outbox.length, 50);
    this.log?.info({ to: email.to, subject: email.subject }, `[email] ${email.subject}\n${email.text}`);
  }

  /** The newest email sent to an address (tests and the dev outbox). */
  latestFor(to: string) {
    return this.outbox.find((e) => e.to === to.toLowerCase());
  }
}

/** Production: sends through Resend's HTTP API (https://resend.com/docs/api-reference/emails/send-email). */
export class ResendEmail implements EmailSender {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(email: Email) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: this.from, to: [email.to], subject: email.subject, text: email.text, html: email.html }),
    });
    if (!res.ok) throw new Error(`Email provider error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** The two code emails (sign-up verification and password reset). */
export function codeEmail(to: string, purpose: 'verify' | 'reset', code: string): Email {
  const subject = purpose === 'verify' ? `${code} is your DriveFlow code` : `${code} is your DriveFlow password reset code`;
  const intro = purpose === 'verify' ? 'Use this code to confirm your email and finish setting up DriveFlow:' : 'Use this code to set a new DriveFlow password:';
  const outro = purpose === 'verify' ? 'If you didn’t sign up, you can ignore this email.' : 'If you didn’t ask to reset your password, you can ignore this email; your password stays the same.';
  const text = `${intro}\n\n${code}\n\nThe code works for 15 minutes.\n${outro}`;
  const html = `<p>${escape(intro)}</p><p style="font-size:28px;font-weight:600;letter-spacing:6px">${code}</p><p>The code works for 15 minutes.<br>${escape(outro)}</p>`;
  return { to, subject, text, html };
}
