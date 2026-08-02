// src/routes/swapRequestsRoutes.js
import express from 'express';
import authMiddleware from '../middlewares/authMiddleware.js';
import {
  getMySentRequests,
  getMyPendingRequests,
  createSwapRequest,
  cancelSwapRequest,
  respondToRequest,
} from '../controllers/swapRequestsController.js';

const router = express.Router();

router.use(authMiddleware); // any logged-in employee — no role restriction, this is a 'user'-level feature

/**
 * @openapi
 * /swap-requests/sent:
 *   get:
 *     summary: Get swap requests sent by the logged-in user
 *     tags:
 *       - Swap Requests
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of sent swap requests
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   request_id:
 *                     type: integer
 *                   requester_emp_id:
 *                     type: integer
 *                   target_emp_id:
 *                     type: integer
 *                   requester_schedule_start:
 *                     type: string
 *                     format: date-time
 *                   target_schedule_start:
 *                     type: string
 *                     format: date-time
 *                   status:
 *                     type: string
 *                     enum: [pending, accepted, rejected]
 *                   requested_at:
 *                     type: string
 *                     format: date-time
 *                   responded_at:
 *                     type: string
 *                     format: date-time
 *                     nullable: true
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/sent', getMySentRequests);

/**
 * @openapi
 * /swap-requests/pending:
 *   get:
 *     summary: Get pending swap requests targeted to the logged-in user
 *     tags:
 *       - Swap Requests
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of pending incoming swap requests
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   request_id:
 *                     type: integer
 *                   requester_emp_id:
 *                     type: integer
 *                   target_emp_id:
 *                     type: integer
 *                   requester_schedule_start:
 *                     type: string
 *                     format: date-time
 *                   target_schedule_start:
 *                     type: string
 *                     format: date-time
 *                   status:
 *                     type: string
 *                     enum: [pending]
 *                   requested_at:
 *                     type: string
 *                     format: date-time
 *                   responded_at:
 *                     type: string
 *                     format: date-time
 *                     nullable: true
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/pending', getMyPendingRequests);

/**
 * @openapi
 * /swap-requests:
 *   post:
 *     summary: Create a new swap request
 *     tags:
 *       - Swap Requests
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - target_emp_id
 *               - requester_schedule_start
 *               - target_schedule_start
 *             properties:
 *               target_emp_id:
 *                 type: integer
 *               requester_schedule_start:
 *                 type: string
 *                 format: date-time
 *               target_schedule_start:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Swap request created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 request_id:
 *                   type: integer
 *                 requester_emp_id:
 *                   type: integer
 *                 target_emp_id:
 *                   type: integer
 *                 requester_schedule_start:
 *                   type: string
 *                   format: date-time
 *                 target_schedule_start:
 *                   type: string
 *                   format: date-time
 *                 status:
 *                   type: string
 *                   enum: [pending]
 *                 requested_at:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Bad request (Missing fields, existing active request, target not on same team, or invalid target week)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Not on-call for requester_schedule_start)
 *       500:
 *         description: Server error
 */
router.post('/', createSwapRequest);

/**
 * @openapi
 * /swap-requests/{id}:
 *   delete:
 *     summary: Cancel a pending swap request sent by logged-in user
 *     tags:
 *       - Swap Requests
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Request ID
 *     responses:
 *       200:
 *         description: Swap request cancelled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 request_id:
 *                   type: integer
 *       400:
 *         description: Only pending requests can be cancelled
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Request not found
 *       500:
 *         description: Server error
 */
router.delete('/:id', cancelSwapRequest);

/**
 * @openapi
 * /swap-requests/{id}/respond:
 *   put:
 *     summary: Respond to an incoming pending swap request (accept or reject)
 *     tags:
 *       - Swap Requests
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Request ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [accepted, rejected]
 *     responses:
 *       200:
 *         description: Swap request responded to successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 request_id:
 *                   type: integer
 *                 status:
 *                   type: string
 *                   enum: [accepted, rejected]
 *                 responded_at:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Invalid status value
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Not the target employee for this pending request)
 *       500:
 *         description: Server error
 */
router.put('/:id/respond', respondToRequest);

export default router;