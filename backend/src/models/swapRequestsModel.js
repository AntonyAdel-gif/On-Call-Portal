// src/models/swapRequestsModel.js
import pool from '../db.js';
import { swapAcrossWeeks, swapWithOwnBackup } from './scheduleModel.js';

// All requests an employee has SENT to others, regardless of status
export const getSentByEmployee = async (empId) => {
  const result = await pool.query(
    `SELECT * FROM swap_requests WHERE requester_emp_id = $1 ORDER BY requested_at DESC`,
    [empId]
  );
  return result.rows;
};

// Requests sent TO an employee that are still awaiting their response
export const getPendingForEmployee = async (empId) => {
  const result = await pool.query(
    `SELECT * FROM swap_requests
     WHERE target_emp_id = $1 AND status = 'pending'
     ORDER BY requested_at DESC`,
    [empId]
  );
  return result.rows;
};

// Creates a new swap request — always starts as 'pending', no schedule changes happen yet
export const create = async ({
  requester_emp_id,
  target_emp_id,
  requester_schedule_start,
  target_schedule_start,
}) => {
  const result = await pool.query(
    `INSERT INTO swap_requests
      (requester_emp_id, target_emp_id, requester_schedule_start, target_schedule_start)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [requester_emp_id, target_emp_id, requester_schedule_start, target_schedule_start]
  );
  return result.rows[0];
};

// Handles the target employee's response — the actual schedule swap happens ONLY on acceptance

export const respond = async (requestId, status) => {
  const requestRes = await pool.query('SELECT * FROM swap_requests WHERE request_id = $1', [requestId]);
  if (requestRes.rows.length === 0) {
    throw new Error('Swap request not found');
  }

  const { requester_emp_id, target_emp_id, requester_schedule_start, target_schedule_start } = requestRes.rows[0];

  if (status === 'accepted') {
    const sameWeek = new Date(requester_schedule_start).getTime() === new Date(target_schedule_start).getTime();
    if (sameWeek) {
      await swapWithOwnBackup(requester_schedule_start, requester_emp_id, target_emp_id);
    } else {
      await swapAcrossWeeks(requester_schedule_start, target_schedule_start, requester_emp_id, target_emp_id);
    }
  }
  // If rejected, no schedule change — just record the outcome below

  const result = await pool.query(
    `UPDATE swap_requests
     SET status = $1, responded_at = NOW()
     WHERE request_id = $2
     RETURNING *`,
    [status, requestId]
  );
  return result.rows[0];
};

export const cancel = async (requestId) => {
  const result = await pool.query(
    `DELETE FROM swap_requests WHERE request_id = $1 RETURNING *`,
    [requestId]
  );
  return result.rows[0];
};

//simplified respond for just cover me logic

//import { assignCoverage } from './scheduleModel.js';

/*export const respond = async (requestId, status) => {
  const request = await pool.query('SELECT * FROM swap_requests WHERE request_id = $1', [requestId]);
  const { requester_schedule_start, target_emp_id } = request.rows[0];

  if (status === 'accepted') {
    await assignCoverage(requester_schedule_start, target_emp_id);
  }

  const result = await pool.query(
    `UPDATE swap_requests SET status = $1, responded_at = NOW() WHERE request_id = $2 RETURNING *`,
    [status, requestId]
  );
  return result.rows[0];
};*/