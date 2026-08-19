import nodemailer from 'nodemailer';
import { smtpConfig, validateSmtpConfig } from '../config/smtpConfig.js';

let transporter;

const getTransporter = () => {
  validateSmtpConfig();

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      auth: smtpConfig.user
        ? { user: smtpConfig.user, pass: smtpConfig.password }
        : undefined,
      connectionTimeout: smtpConfig.connectionTimeout,
      greetingTimeout: smtpConfig.connectionTimeout,
      socketTimeout: smtpConfig.connectionTimeout,
    });
  }

  return transporter;
};

export const verifySmtpConnection = async () => {
  if (!smtpConfig.enabled) {
    console.log('Email notifications disabled (MAIL_ENABLED is not true)');
    return false;
  }

  await getTransporter().verify();
  console.log('SMTP connection verified');
  return true;
};

export const sendMail = async ({ to, subject, text, html }) => {
  if (!smtpConfig.enabled) {
    console.log(`Email skipped while mail is disabled: ${subject}`);
    return { skipped: true };
  }

  return getTransporter().sendMail({
    from: smtpConfig.from,
    replyTo: smtpConfig.replyTo,
    to,
    subject,
    text,
    html,
  });
};
