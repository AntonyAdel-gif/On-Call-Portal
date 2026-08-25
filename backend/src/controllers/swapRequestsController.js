// src/controllers/swapRequestsController.js
import * as SwapRequests from '../models/swapRequestsModel.js';
import * as Schedule from '../models/scheduleModel.js';
import * as Employee from '../models/employeeModel.js';
import {
  notifySwapRequestAccepted,
  notifySwapRequestCreated,
} from '../services/swapNotificationService.js';

const runNotificationSafely = async (description, notification) => {
  try {
    await notification();
  } catch (err) {
    // The swap has already been persisted. Notification outages must not turn a successful
    // business action into a misleading API failure or cause clients to submit it again.
    console.error(`Post-swap notification failed (${description})`, err);
  }
};

// GET /api/swap-requests/sent
export const getMySentRequests = async (req, res) => {
  try {
    const requests = await SwapRequests.getSentByEmployee(req.user.emp_id);
    res.json(requests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch sent requests' });
  }
};

// GET /api/swap-requests/pending
export const getMyPendingRequests = async (req, res) => {
  try {
    const requests = await SwapRequests.getPendingForEmployee(req.user.emp_id);
    res.json(requests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch pending requests' });
  }
};

// POST /api/swap-requests
export const createSwapRequest = async (req, res) => {
  try {
    // Force requester_emp_id from verified JWT token to prevent impersonation.
    const requester_emp_id = req.user.emp_id;
    const { target_emp_id, requester_schedule_start, target_schedule_start } = req.body;

    if (!target_emp_id || !requester_schedule_start || !target_schedule_start) {
      return res.status(400).json({ error: 'target_emp_id, requester_schedule_start, and target_schedule_start are required' });
    }

    // Prevents submitting multiple concurrent requests that could result in conflicting trade commitments.
    const activeSent = await SwapRequests.getSentByEmployee(requester_emp_id);
    const hasPending = activeSent.some((r) => r.status === 'pending');

    if (hasPending) {
      return res.status(400).json({ error: 'You already have an active pending swap request. Please cancel it before creating a new one.' });
    }

    // Verify requester actually holds the on-call shift for the start timestamp being offered.
    const requesterWeek = await Schedule.getByStartDateAndEmp(requester_schedule_start, requester_emp_id);
    if (!requesterWeek || Number(requesterWeek.emp_id) !== Number(requester_emp_id)) {
      return res.status(403).json({ error: 'You can only request a swap for your own on-call week' });
    }

    // Enforce team boundary: swap requests are only valid between members of the same engineering team.
    const requester = await Employee.getById(requester_emp_id);
    const target = await Employee.getById(target_emp_id);
    if (!target || Number(target.team_id) !== Number(requester.team_id)) {
      return res.status(400).json({ error: 'Swap target must be on the same team' });
    }

    const sameWeek = new Date(requester_schedule_start).getTime() === new Date(target_schedule_start).getTime();
    let targetWeek = requesterWeek;

    if (sameWeek) {
      // Same-week swap case: requester is asking their designated backup to cover their current week's shift.
      const actualBkEmpId = requesterWeek.bk_emp_id ?? requester.bk_emp_id;
      if (actualBkEmpId && Number(actualBkEmpId) !== Number(target_emp_id)) {
        // intent unclear, verify: permits same-team teammate coverage even if not designated default backup
      }
    } else {
      // Cross-week trade case: verify target employee is actually assigned to the target_schedule_start shift.
      targetWeek = await Schedule.getByStartDateAndEmp(target_schedule_start, target_emp_id);
      if (!targetWeek || Number(targetWeek.emp_id) !== Number(target_emp_id)) {
        return res.status(400).json({ error: 'target_emp_id is not the on-call employee for target_schedule_start' });
      }
    }

    const newRequest = await SwapRequests.create({
      requester_emp_id,
      target_emp_id,
      requester_schedule_start,
      target_schedule_start,
    });

    await runNotificationSafely(
      `swap request ${newRequest.request_id} created`,
      () => notifySwapRequestCreated({
        requester,
        target,
        request: newRequest,
        requesterSchedule: requesterWeek,
        targetSchedule: targetWeek,
      }),
    );

    res.status(201).json(newRequest);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create swap request' });
  }
};

// DELETE /api/swap-requests/:id
export const cancelSwapRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const requester_emp_id = req.user.emp_id;

    // Ensure requester can only cancel requests they originally created.
    const sent = await SwapRequests.getSentByEmployee(requester_emp_id);
    const matchingRequest = sent.find((r) => r.request_id === Number(id));

    if (!matchingRequest) {
      return res.status(404).json({ error: 'No pending swap request found with this ID' });
    }

    if (matchingRequest.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending requests can be cancelled' });
    }

    const cancelled = await SwapRequests.cancel(id);
    res.json(cancelled);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to cancel swap request' });
  }
};

// PUT /api/swap-requests/:id/respond
export const respondToRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ error: "status must be 'accepted' or 'rejected'" });
    }

    // Ensure response can only be submitted by the intended recipient (target_emp_id).
    const sent = await SwapRequests.getPendingForEmployee(req.user.emp_id);
    const matchingRequest = sent.find((r) => r.request_id === Number(id));

    if (!matchingRequest) {
      return res.status(403).json({ error: 'No pending request found for you with this ID' });
    }

    // On acceptance, schedule rows are updated in PostgreSQL database; on rejection, request is simply marked rejected.
    const updated = await SwapRequests.respond(id, status);

    if (status === 'accepted') {
      await runNotificationSafely(
        `swap request ${updated.request_id} accepted`,
        async () => {
          const [requester, target, requesterSchedule, targetSchedule] = await Promise.all([
            Employee.getById(updated.requester_emp_id),
            Employee.getById(updated.target_emp_id),
            Schedule.getByStartDate(updated.requester_schedule_start),
            Schedule.getByStartDate(updated.target_schedule_start),
          ]);
          return notifySwapRequestAccepted({
            requester,
            target,
            request: updated,
            requesterSchedule,
            targetSchedule,
          });
        },
      );
    }

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to respond to swap request' });
  }
};
