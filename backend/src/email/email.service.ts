import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import { templates, type RenderedEmail } from './templates';

/**
 * Email provider abstraction — same pattern as ObjectStorage:
 * an interface, a dev implementation, a production implementation
 * selected by environment. Credentials come only from env vars.
 */
export interface MailProvider {
  send(to: string, email: RenderedEmail): Promise<void>;
}

/** Dev default: logs the rendered email instead of sending. Zero config. */
class ConsoleMailProvider implements MailProvider {
  private readonly logger = new Logger('ConsoleMail');
  async send(to: string, email: RenderedEmail) {
    this.logger.log(`→ ${to} | ${email.subject}`);
    this.logger.debug(email.html);
  }
}

/** Production: SMTP via nodemailer. Activate by setting SMTP_HOST. */
class SmtpMailProvider implements MailProvider {
  private transporter: Transporter;
  private from: string;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
    this.from = process.env.EMAIL_FROM ?? 'AI ATS <no-reply@ats.app>';
  }

  async send(to: string, email: RenderedEmail) {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: email.subject,
      html: email.html,
    });
  }
}

/**
 * EmailService: fire-and-forget sends. Email is a side effect — a provider
 * outage must never fail a business request, so every send is caught and
 * logged rather than awaited-propagated.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private provider: MailProvider = process.env.SMTP_HOST
    ? new SmtpMailProvider()
    : new ConsoleMailProvider();

  private dispatch(to: string, email: RenderedEmail) {
    this.provider
      .send(to, email)
      .catch((e) =>
        this.logger.warn(`Email to ${to} failed (${email.subject}): ${e}`),
      );
  }

  welcome(to: string, name: string) {
    this.dispatch(to, templates.welcome(name));
  }
  applicationConfirmation(to: string, name: string, jobTitle: string) {
    this.dispatch(to, templates.applicationConfirmation(name, jobTitle));
  }
  statusUpdate(to: string, name: string, jobTitle: string, status: string) {
    this.dispatch(to, templates.statusUpdate(name, jobTitle, status));
  }
  interviewInvitation(
    to: string,
    name: string,
    jobTitle: string,
    type: string,
    when: Date,
    link?: string,
  ) {
    this.dispatch(
      to,
      templates.interviewInvitation(name, jobTitle, type, when, link),
    );
  }
  interviewReminder(
    to: string,
    name: string,
    jobTitle: string,
    type: string,
    when: Date,
    link?: string,
  ) {
    this.dispatch(
      to,
      templates.interviewReminder(name, jobTitle, type, when, link),
    );
  }
  offerNotification(to: string, name: string, jobTitle: string) {
    this.dispatch(to, templates.offerNotification(name, jobTitle));
  }
}
