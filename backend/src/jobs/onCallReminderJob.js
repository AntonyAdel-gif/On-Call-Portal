import cron from 'node-cron';
import { getCurrentOnCallAssignments } from '../models/scheduleModel.js';
import { onCallReminderTemplate } from '../services/emailTemplates.js';
import { sendMail } from '../services/mailer.js';

export const reminderSchedule = {
  cron: process.env.ONCALL_REMINDER_CRON || '0 9 * * 1',
  timeZone: process.env.ONCALL_REMINDER_TIME_ZONE || process.env.MAIL_TIME_ZONE || 'Africa/Cairo',
};

export const deliverOnCallReminders = async (assignments, mailSender = sendMail) => {
  const results = [];

  for (const assignment of assignments) {
    if (!assignment.emp_mail) {
      console.warn(`On-call reminder skipped for team ${assignment.team_id}: employee ${assignment.emp_id} has no email address`);
      results.push({ teamId: assignment.team_id, skipped: true });
      continue;
    }

    if (!assignment.team_email) {
      console.warn(`On-call reminder for team ${assignment.team_id} will be sent without CC: teams.email is empty`);
    }

    const employee = {
      emp_id: assignment.emp_id,
      emp_name: assignment.emp_name,
      emp_mail: assignment.emp_mail,
    };
    const schedule = {
      start_dt: assignment.start_dt,
      end_dt: assignment.end_dt,
    };

    try {
      const message = onCallReminderTemplate({ employee, schedule });
      const delivery = await mailSender({
        to: assignment.emp_mail,
        cc: assignment.team_email || undefined,
        ...message,
      });
      results.push({ teamId: assignment.team_id, delivery });
    } catch (err) {
      console.error(`Failed to send on-call reminder for team ${assignment.team_id}`, err);
      results.push({ teamId: assignment.team_id, failed: true, error: err });
    }
  }

  return results;
};

export const sendMondayOnCallReminders = async () => {
  console.log('Sending Monday reminders to current on-call employees...');
  const assignments = await getCurrentOnCallAssignments();
  return deliverOnCallReminders(assignments);
};

export const startOnCallReminderJob = () => {
  if (!cron.validate(reminderSchedule.cron)) {
    throw new Error(`Invalid ONCALL_REMINDER_CRON expression: ${reminderSchedule.cron}`);
  }

  const task = cron.schedule(
    reminderSchedule.cron,
    () => sendMondayOnCallReminders().catch((err) => {
      console.error('Monday on-call reminder job failed', err);
    }),
    { timezone: reminderSchedule.timeZone },
  );

  console.log(`On-call reminder scheduled (${reminderSchedule.cron}, ${reminderSchedule.timeZone})`);
  return task;
};
