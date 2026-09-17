/**
 * Email templates — one function per email type, all producing
 * {subject, html}. HTML is inlined-styled (email clients strip <style>).
 */

export interface RenderedEmail {
  subject: string;
  html: string;
}

const wrap = (title: string, body: string) => `
<div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto;padding:24px">
  <h2 style="color:#0f172a;margin-bottom:8px">${title}</h2>
  <div style="color:#334155;font-size:14px;line-height:1.6">${body}</div>
  <p style="color:#94a3b8;font-size:12px;margin-top:32px">
    AI ATS · This is an automated message — please do not reply.
  </p>
</div>`;

const fmt = (d: Date | string) =>
  new Date(d).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export const templates = {
  welcome: (name: string): RenderedEmail => ({
    subject: 'Welcome to AI ATS',
    html: wrap(
      'Welcome aboard',
      `
      <p>Hi ${name},</p>
      <p>Your account is ready. Complete your profile and upload a resume —
         our AI will extract your skills automatically.</p>`,
    ),
  }),

  applicationConfirmation: (name: string, jobTitle: string): RenderedEmail => ({
    subject: `Application received: ${jobTitle}`,
    html: wrap(
      'Application received',
      `
      <p>Hi ${name},</p>
      <p>We've received your application for <strong>${jobTitle}</strong>.
         You'll be notified as it moves through the pipeline.</p>`,
    ),
  }),

  statusUpdate: (
    name: string,
    jobTitle: string,
    status: string,
  ): RenderedEmail => ({
    subject: `Application update: ${jobTitle} → ${status}`,
    html: wrap(
      'Application status update',
      `
      <p>Hi ${name},</p>
      <p>Your application for <strong>${jobTitle}</strong> moved to
         <strong>${status}</strong>.</p>`,
    ),
  }),

  interviewInvitation: (
    name: string,
    jobTitle: string,
    type: string,
    when: Date,
    link?: string,
  ): RenderedEmail => ({
    subject: `Interview invitation: ${jobTitle}`,
    html: wrap(
      'Interview invitation',
      `
      <p>Hi ${name},</p>
      <p>You're invited to a <strong>${type.toLowerCase()}</strong> interview for
         <strong>${jobTitle}</strong> on <strong>${fmt(when)}</strong>.</p>
      ${link ? `<p><a href="${link}">Join the meeting →</a></p>` : ''}`,
    ),
  }),

  interviewReminder: (
    name: string,
    jobTitle: string,
    type: string,
    when: Date,
    link?: string,
  ): RenderedEmail => ({
    subject: `Reminder: interview tomorrow — ${jobTitle}`,
    html: wrap(
      'Interview reminder',
      `
      <p>Hi ${name},</p>
      <p>Reminder: your <strong>${type.toLowerCase()}</strong> interview for
         <strong>${jobTitle}</strong> is at <strong>${fmt(when)}</strong>.</p>
      ${link ? `<p><a href="${link}">Join the meeting →</a></p>` : ''}`,
    ),
  }),

  offerNotification: (name: string, jobTitle: string): RenderedEmail => ({
    subject: `🎉 Offer extended: ${jobTitle}`,
    html: wrap(
      'Congratulations!',
      `
      <p>Hi ${name},</p>
      <p>Great news — an offer has been extended for
         <strong>${jobTitle}</strong>. Check your dashboard for details.</p>`,
    ),
  }),
};

export type EmailTemplate = keyof typeof templates;
