import nodemailer, { type Transporter } from "nodemailer";

// Sends the site's mail through the SMTP account in the environment (for
// foretold.live, whose mail Hostinger has Titan run: smtp.titan.email, port
// 465, the mailbox's own address and password). Without
// SMTP_HOST, as in development, nothing is sent: each mail is printed in the
// backend's console instead, links and all, so they can be clicked there.
//
//   SMTP_HOST, SMTP_PORT (default 465), SMTP_USER, SMTP_PASS
//   MAIL_FROM  the sender, e.g. "Wizard Foretold <noreply@foretold.live>"
//   APP_URL    where the links in a mail lead, e.g. https://foretold.live

export type MailLanguage = "en" | "de";

export const mailLanguage = (value: unknown): MailLanguage =>
  value === "de" ? "de" : "en";

const appUrl = (): string =>
  (process.env.APP_URL || "http://localhost:5173").replace(/\/+$/, "");

let transporter: Transporter | null = null;

function smtp(): Transporter | null {
  if (!process.env.SMTP_HOST) return null;

  const port = Number(process.env.SMTP_PORT) || 465;
  transporter ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    // 465 speaks TLS from the first byte; 587 starts plain and upgrades.
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return transporter;
}

interface Mail {
  to: string;
  subject: string;
  text: string;
}

async function send(mail: Mail): Promise<void> {
  const transport = smtp();

  if (!transport) {
    console.log(
      `[mail] not sent (no SMTP_HOST)\n  to: ${mail.to}\n  subject: ${mail.subject}\n\n${mail.text}\n`,
    );
    return;
  }

  await transport.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    ...mail,
  });
}

// The texts, in the player's language. Plain text only: it reads the same in
// every mail program and is less likely to be taken for spam.
const TEXTS = {
  en: {
    verifySubject: "Confirm your email for Wizard Foretold",
    verifyBody: (name: string, link: string) =>
      `Hello ${name},\n\n` +
      `welcome to Wizard Foretold. Open this link to confirm your email and finish your account:\n\n` +
      `${link}\n\n` +
      `The link works for 24 hours. If you did not sign up, you can ignore this mail.\n`,
    resetSubject: "A new password for Wizard Foretold",
    resetBody: (name: string, link: string) =>
      `Hello ${name},\n\n` +
      `someone asked for a new password for your account. Open this link to choose one:\n\n` +
      `${link}\n\n` +
      `The link works for one hour. If it was not you, ignore this mail: your password stays as it is.\n`,
  },
  de: {
    verifySubject: "Bestätige deine E-Mail für Wizard Foretold",
    verifyBody: (name: string, link: string) =>
      `Hallo ${name},\n\n` +
      `willkommen bei Wizard Foretold. Öffne diesen Link, um deine E-Mail zu bestätigen und dein Konto fertig anzulegen:\n\n` +
      `${link}\n\n` +
      `Der Link gilt 24 Stunden. Wenn du dich nicht angemeldet hast, kannst du diese Mail ignorieren.\n`,
    resetSubject: "Ein neues Passwort für Wizard Foretold",
    resetBody: (name: string, link: string) =>
      `Hallo ${name},\n\n` +
      `jemand hat ein neues Passwort für dein Konto angefordert. Öffne diesen Link, um eines zu wählen:\n\n` +
      `${link}\n\n` +
      `Der Link gilt eine Stunde. Warst du es nicht, ignoriere diese Mail: dein Passwort bleibt, wie es ist.\n`,
  },
} as const;

interface Recipient {
  username: string;
  email: string;
}

export const mailService = {
  sendVerification(user: Recipient, token: string, language: MailLanguage): Promise<void> {
    const texts = TEXTS[language];
    return send({
      to: user.email,
      subject: texts.verifySubject,
      text: texts.verifyBody(user.username, `${appUrl()}/#/verify/${token}`),
    });
  },

  sendPasswordReset(user: Recipient, token: string, language: MailLanguage): Promise<void> {
    const texts = TEXTS[language];
    return send({
      to: user.email,
      subject: texts.resetSubject,
      text: texts.resetBody(user.username, `${appUrl()}/#/reset/${token}`),
    });
  },
};
