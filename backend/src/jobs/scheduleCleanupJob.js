import cron from 'node-cron';
import { cleanExcessFutureSchedule, cleanPastSchedule } from '../models/scheduleModel.js';

// Background job maintaining schedule table bounds:
// - Purges future schedule rows exceeding 60 days to prevent excessive database row buildup.
// - Purges historical schedule records older than 1 year to comply with retention policies.
export const startScheduleCleanupJob = () => {
  // Runs daily at midnight (00:00) to keep schedule boundaries trimmed without blocking high-traffic daytime requests.
  cron.schedule('0 0 * * *', async () => {
    try {
      await cleanExcessFutureSchedule(60);
      await cleanPastSchedule(1);
    } catch (err) {
      console.error('Error running schedule cleanup job:', err);
    }
  });
};
