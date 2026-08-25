const parseBoolean = (value, fallback = false) => {
  if (value === undefined) return fallback;
  return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
};

const port = Number(process.env.SMTP_PORT || 587);

export const smtpConfig = {
  enabled: parseBoolean(process.env.MAIL_ENABLED),
  host: process.env.SMTP_HOST,
  port,
  secure: parseBoolean(process.env.SMTP_SECURE, port === 465),
  user: process.env.SMTP_USER,
  password: process.env.SMTP_PASSWORD,
  from: process.env.SMTP_FROM || process.env.SMTP_USER,
  replyTo: process.env.SMTP_REPLY_TO,
  connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT_MS || 10000),
  appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:5173',
  timeZone: process.env.MAIL_TIME_ZONE || 'Africa/Cairo',
};

export const validateSmtpConfig = () => {
  if (!smtpConfig.enabled) return;

  const missing = [];
  if (!smtpConfig.host) missing.push('SMTP_HOST');
  if (!smtpConfig.from) missing.push('SMTP_FROM');
  if (!Number.isInteger(smtpConfig.port) || smtpConfig.port <= 0) missing.push('SMTP_PORT');
  if ((smtpConfig.user && !smtpConfig.password) || (!smtpConfig.user && smtpConfig.password)) {
    missing.push('both SMTP_USER and SMTP_PASSWORD (or neither for an unauthenticated relay)');
  }

  if (missing.length > 0) {
    throw new Error(`Email notifications are enabled but SMTP configuration is invalid: ${missing.join(', ')}`);
  }
};
