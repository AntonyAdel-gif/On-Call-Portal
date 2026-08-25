import { smtpConfig } from '../config/smtpConfig.js';

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const dateParts = (value) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: smtpConfig.timeZone,
  }).formatToParts(new Date(value));

  return Object.fromEntries(
    parts.filter(({ type }) => ['month', 'day', 'year'].includes(type))
      .map(({ type, value: partValue }) => [type, partValue]),
  );
};

const formatCycleRange = (schedule, fallbackStart) => {
  const start = schedule?.start_dt || fallbackStart;
  const end = schedule?.end_dt;
  if (!end) {
    const { month, day, year } = dateParts(start);
    return `${month} ${day}, ${year}`;
  }

  const startParts = dateParts(start);
  const endParts = dateParts(end);

  if (startParts.year !== endParts.year) {
    return `${startParts.month} ${startParts.day}, ${startParts.year} – ${endParts.month} ${endParts.day}, ${endParts.year}`;
  }
  if (startParts.month !== endParts.month) {
    return `${startParts.month} ${startParts.day} – ${endParts.month} ${endParts.day}, ${endParts.year}`;
  }
  return `${startParts.month} ${startParts.day} – ${endParts.day}, ${endParts.year}`;
};

const isSameShift = (request) => (
  new Date(request.requester_schedule_start).getTime()
  === new Date(request.target_schedule_start).getTime()
);

const appBaseUrl = smtpConfig.appBaseUrl.replace(/\/$/, '');
const employeeActionUrl = `${appBaseUrl}/my-schedule`;
const managerActionUrl = `${appBaseUrl}/admin`;

const orangeLogo = () => `<table role="presentation" width="28" height="28" cellspacing="0" cellpadding="0" aria-label="On-Call Schedule app logo" style="width:28px;height:28px;background:#ff7900">
  <tr><td height="19" style="height:19px;line-height:19px;font-size:0">&nbsp;</td></tr>
  <tr><td style="padding:0 4px 4px"><div style="height:5px;line-height:5px;background:#ffffff;font-size:0">&nbsp;</div></td></tr>
</table>`;

const layout = ({ preview, eyebrow, heading, body }) => `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
  <body style="margin:0;background:#f4f6f8;font-family:Arial,sans-serif;color:#17202a">
    <span style="display:none;max-height:0;overflow:hidden">${escapeHtml(preview)}</span>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f8;padding:32px 12px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fff;border-radius:4px;overflow:hidden;border:1px solid #e2e8f0;border-top:6px solid #ff7900">
          <tr><td style="padding:16px 28px;border-bottom:1px solid #e2e8f0">
            <table role="presentation" cellspacing="0" cellpadding="0">
              <tr>
                <td style="vertical-align:middle">${orangeLogo()}</td>
                <td style="padding-left:10px;vertical-align:middle;color:#17202a;font-size:17px;font-weight:700">On-Call Portal</td>
              </tr>
            </table>
          </td></tr>
          <tr><td style="padding:28px">
            <div style="margin:0 0 8px;color:#d86600;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase">${escapeHtml(eyebrow)}</div>
            <h1 style="font-size:24px;line-height:1.3;margin:0 0 20px">${escapeHtml(heading)}</h1>
            ${body}
          </td></tr>
          <tr><td style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr>
                <td style="color:#64748b;font-size:11px;line-height:1.5">Automated notification · Dates in ${escapeHtml(smtpConfig.timeZone)}</td>
                <td align="right" style="color:#d86600;font-size:11px;font-weight:700">On-Call Portal</td>
              </tr>
            </table>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

const shiftSummary = (items) => `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:20px;border-left:4px solid #ff7900">
  ${items.map(({ label, value }, index) => `<tr><td style="padding:10px 0 10px 16px${index < items.length - 1 ? ';border-bottom:1px solid #e2e8f0' : ''}">
    <div style="margin-bottom:4px;color:#64748b;font-size:10px;font-weight:700;letter-spacing:.6px;text-transform:uppercase">${escapeHtml(label)}</div>
    <div style="font-size:15px;line-height:1.35;font-weight:700">${escapeHtml(value)}</div>
  </td></tr>`).join('')}
</table>`;

const button = (label, url) => `<p style="margin:24px 0 0"><a href="${escapeHtml(url)}" style="display:inline-block;border:2px solid #ff7900;color:#d86600;text-decoration:none;font-weight:700;padding:10px 16px;border-radius:4px">${escapeHtml(label)} &rarr;</a></p>`;

export const swapRequestReceivedTemplate = ({
  requester,
  target,
  request,
  requesterSchedule,
  targetSchedule,
}) => {
  const sameShift = isSameShift(request);
  const offeredShift = formatCycleRange(requesterSchedule, request.requester_schedule_start);
  const requestedShift = formatCycleRange(targetSchedule, request.target_schedule_start);
  const details = sameShift
    ? `Coverage requested for the ${offeredShift} on-call cycle`
    : `Proposed cycle trade: ${offeredShift} for ${requestedShift}`;

  return {
    subject: `[On-Call Portal] Swap request from ${requester.emp_name}`,
    text: `Hello ${target.emp_name},\n\n${requester.emp_name} sent you an on-call swap request.\n${details}\n\nReview the request: ${employeeActionUrl}`,
    html: layout({
      preview: `${requester.emp_name} sent you an on-call swap request.`,
      eyebrow: 'Action required',
      heading: 'New on-call swap request',
      body: `<p>Hello ${escapeHtml(target.emp_name)},</p>
        <p><strong>${escapeHtml(requester.emp_name)}</strong> sent you an on-call swap request.</p>
        ${shiftSummary([
          { label: 'Their shift', value: offeredShift },
          ...(!sameShift ? [{ label: 'Your shift', value: requestedShift }] : []),
        ])}
        ${button('Review swap request', employeeActionUrl)}`,
    }),
  };
};

export const swapRequestApprovedTemplate = ({
  requester,
  target,
  request,
  requesterSchedule,
  targetSchedule,
}) => {
  const sameShift = isSameShift(request);
  const offeredShift = formatCycleRange(requesterSchedule, request.requester_schedule_start);
  const requestedShift = formatCycleRange(targetSchedule, request.target_schedule_start);
  const result = sameShift
    ? `${target.emp_name} will cover your full on-call cycle: ${offeredShift}.`
    : `You are now on call for ${requestedShift}, and ${target.emp_name} is now on call for ${offeredShift}.`;

  return {
    subject: `[On-Call Portal] ${target.emp_name} approved your swap request`,
    text: `Hello ${requester.emp_name},\n\n${target.emp_name} approved your on-call swap request. ${result}\n\nView the updated schedule: ${employeeActionUrl}`,
    html: layout({
      preview: `${target.emp_name} approved your swap request.`,
      eyebrow: 'Swap approved',
      heading: 'Your swap request was approved',
      body: `<p>Hello ${escapeHtml(requester.emp_name)},</p>
        <p><strong>${escapeHtml(target.emp_name)}</strong> approved your on-call swap request.</p>
        ${shiftSummary(sameShift
          ? [{ label: `${target.emp_name} will cover`, value: offeredShift }]
          : [
            { label: 'Your new shift', value: requestedShift },
            { label: `${target.emp_name}'s new shift`, value: offeredShift },
          ])}
        ${button('View updated schedule', employeeActionUrl)}`,
    }),
  };
};

export const managerScheduleChangedTemplate = ({
  manager,
  team,
  requester,
  target,
  request,
  requesterSchedule,
  targetSchedule,
}) => {
  const sameShift = isSameShift(request);
  const offeredShift = formatCycleRange(requesterSchedule, request.requester_schedule_start);
  const requestedShift = formatCycleRange(targetSchedule, request.target_schedule_start);
  const summary = sameShift
    ? `${target.emp_name} is now covering ${requester.emp_name}'s full on-call cycle: ${offeredShift}.`
    : `${target.emp_name} is now on call for ${offeredShift}; ${requester.emp_name} is now on call for ${requestedShift}.`;

  return {
    subject: `[On-Call Portal] ${team.team_name} schedule changed after approved swap`,
    text: `Hello ${manager.emp_name},\n\nAn on-call swap in ${team.team_name} was approved. ${summary}\n\nView the updated schedule: ${managerActionUrl}`,
    html: layout({
      preview: `An approved swap changed the ${team.team_name} schedule.`,
      eyebrow: 'Schedule updated',
      heading: `${team.team_name} schedule changed`,
      body: `<p>Hello ${escapeHtml(manager.emp_name)},</p>
        <p>An on-call swap between <strong>${escapeHtml(requester.emp_name)}</strong> and <strong>${escapeHtml(target.emp_name)}</strong> was approved.</p>
        ${shiftSummary(sameShift
          ? [{ label: `${target.emp_name} is now covering`, value: offeredShift }]
          : [
            { label: `${target.emp_name} is now on call`, value: offeredShift },
            { label: `${requester.emp_name} is now on call`, value: requestedShift },
          ])}
        ${button('View updated schedule', managerActionUrl)}`,
    }),
  };
};

export const onCallReminderTemplate = ({ employee, schedule }) => {
  const shift = formatCycleRange(schedule, schedule.start_dt);

  return {
    subject: `[On-Call Portal] On-call reminder for ${employee.emp_name}`,
    text: `Hello ${employee.emp_name},\n\nThis is a reminder that you are currently on call for ${shift}.\n\nView your schedule: ${employeeActionUrl}`,
    html: layout({
      preview: `You are currently on call for ${shift}.`,
      eyebrow: 'On-call reminder',
      heading: 'You are currently on call',
      body: `<p>Hello ${escapeHtml(employee.emp_name)},</p>
        <p>This is your weekly reminder that you are the current on-call person.</p>
        ${shiftSummary([{ label: 'Your shift', value: shift }])}
        ${button('View your schedule', employeeActionUrl)}`,
    }),
  };
};
