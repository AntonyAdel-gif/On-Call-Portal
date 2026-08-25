import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deliverOnCallReminders,
  reminderSchedule,
} from '../src/jobs/onCallReminderJob.js';

test('Monday reminder is scheduled for 09:00 on Mondays by default', () => {
  assert.equal(reminderSchedule.cron, '0 9 * * 1');
  assert.equal(reminderSchedule.timeZone, 'Africa/Cairo');
});

test('reminder delivery sends to the on-call employee and CCs the team email', async () => {
  const sentMessages = [];
  const assignment = {
    team_id: 3,
    team_name: 'Payments',
    team_email: 'payments-team@example.com',
    emp_id: 8,
    emp_name: 'Current On-Call',
    emp_mail: 'oncall@example.com',
    start_dt: '2026-08-20T00:00:00',
    end_dt: '2026-08-27T00:00:00',
  };

  const results = await deliverOnCallReminders([assignment], async (message) => {
    sentMessages.push(message);
    return { accepted: [message.to] };
  });

  assert.equal(sentMessages.length, 1);
  assert.equal(sentMessages[0].to, 'oncall@example.com');
  assert.equal(sentMessages[0].cc, 'payments-team@example.com');
  assert.match(sentMessages[0].subject, /Current On-Call/);
  assert.equal(results[0].teamId, 3);
  assert.deepEqual(results[0].delivery.accepted, ['oncall@example.com']);
});
