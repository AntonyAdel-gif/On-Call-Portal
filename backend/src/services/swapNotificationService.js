import * as Employee from '../models/employeeModel.js';
import * as Teams from '../models/teamsModel.js';
import { sendMail } from './mailer.js';
import {
  managerScheduleChangedTemplate,
  swapRequestApprovedTemplate,
  swapRequestReceivedTemplate,
} from './emailTemplates.js';

const deliver = async (recipient, message, notificationName) => {
  if (!recipient?.emp_mail) {
    console.warn(`Email notification skipped (${notificationName}): recipient has no email address`);
    return { skipped: true };
  }

  try {
    return await sendMail({ to: recipient.emp_mail, ...message });
  } catch (err) {
    console.error(`Email notification failed (${notificationName})`, err);
    return { failed: true, error: err };
  }
};

export const notifySwapRequestCreated = async ({
  requester,
  target,
  request,
  requesterSchedule,
  targetSchedule,
}) => (
  deliver(
    target,
    swapRequestReceivedTemplate({
      requester,
      target,
      request,
      requesterSchedule,
      targetSchedule,
    }),
    `swap request ${request.request_id} sent to employee ${target.emp_id}`,
  )
);

export const notifySwapRequestAccepted = async ({
  requester,
  target,
  request,
  requesterSchedule,
  targetSchedule,
}) => {
  const team = await Teams.getById(requester.team_id);
  const manager = team?.manager_emp_id
    ? await Employee.getById(team.manager_emp_id)
    : null;

  const notifications = [
    deliver(
      requester,
      swapRequestApprovedTemplate({
        requester,
        target,
        request,
        requesterSchedule,
        targetSchedule,
      }),
      `swap request ${request.request_id} approval sent to requester ${requester.emp_id}`,
    ),
  ];

  if (team && manager) {
    notifications.push(deliver(
      manager,
      managerScheduleChangedTemplate({
        manager,
        team,
        requester,
        target,
        request,
        requesterSchedule,
        targetSchedule,
      }),
      `swap request ${request.request_id} schedule change sent to manager ${manager.emp_id}`,
    ));
  } else {
    console.warn(`Manager notification skipped for swap request ${request.request_id}: team manager not configured`);
  }

  return Promise.all(notifications);
};
