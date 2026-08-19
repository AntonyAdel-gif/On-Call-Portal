// src/server.js
import 'dotenv/config';
import app from './app.js';
import './jobs/rotationJob.js';
import { verifySmtpConnection } from './services/mailer.js';

const PORT = process.env.PORT || 8003;

try {
  await verifySmtpConnection();
} catch (err) {
  console.error('SMTP verification failed; the API will continue without confirmed email delivery', err);
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
