import test from 'node:test';
import assert from 'node:assert/strict';
import {
  managerScheduleChangedTemplate,
  swapRequestApprovedTemplate,
  swapRequestReceivedTemplate,
} from '../src/services/emailTemplates.js';

const requester = { emp_id: 1, emp_name: 'Alice & Ops', team_id: 3 };
const target = { emp_id: 2, emp_name: 'Bob <Primary>', team_id: 3 };
const manager = { emp_id: 4, emp_name: 'Morgan Manager' };
const team = { team_id: 3, team_name: 'Payments', manager_emp_id: 4 };
const requesterSchedule = {
  start_dt: '2026-08-20T00:00:00',
  end_dt: '2026-08-27T00:00:00',
};
const targetSchedule = {
  start_dt: '2026-08-27T00:00:00',
  end_dt: '2026-09-03T00:00:00',
};

test('incoming cross-week swap email includes both shifts and escapes names in HTML', () => {
  const message = swapRequestReceivedTemplate({
    requester,
    target,
    request: {
      requester_schedule_start: '2026-08-20T00:00:00',
      target_schedule_start: '2026-08-27T00:00:00',
    },
    requesterSchedule,
    targetSchedule,
  });

  assert.match(message.subject, /Alice & Ops/);
  assert.match(message.text, /Proposed cycle trade:/);
  assert.match(message.text, /August 20 – 27, 2026/);
  assert.match(message.text, /August 27 – September 3, 2026/);
  assert.match(message.html, /Alice &amp; Ops/);
  assert.match(message.html, /Bob &lt;Primary&gt;/);
  assert.doesNotMatch(message.html, /Request type/);
  assert.match(message.html, /On-Call Schedule app logo/);
  assert.match(message.html, /Action required/);
  assert.doesNotMatch(message.html, />OC</);
  assert.match(message.html, /\/my-schedule/);
});

test('approved same-week coverage email describes the resulting assignment', () => {
  const message = swapRequestApprovedTemplate({
    requester,
    target,
    request: {
      requester_schedule_start: '2026-08-20T00:00:00',
      target_schedule_start: '2026-08-20T00:00:00',
    },
    requesterSchedule,
    targetSchedule: requesterSchedule,
  });

  assert.match(message.subject, /approved your swap request/);
  assert.match(message.text, /will cover your full on-call cycle/);
  assert.match(message.text, /August 20 – 27, 2026/);
  assert.match(message.html, /Swap approved/);
});

test('manager email identifies the team and both new cross-week assignments', () => {
  const message = managerScheduleChangedTemplate({
    manager,
    team,
    requester,
    target,
    request: {
      requester_schedule_start: '2026-08-20T00:00:00',
      target_schedule_start: '2026-08-27T00:00:00',
    },
    requesterSchedule,
    targetSchedule,
  });

  assert.match(message.subject, /Payments schedule changed/);
  assert.match(message.text, /Bob <Primary> is now on call for August 20 – 27, 2026/);
  assert.match(message.text, /Alice & Ops is now on call for August 27 – September 3, 2026/);
  assert.match(message.html, /Schedule updated/);
  assert.match(message.html, /\/admin/);
});
