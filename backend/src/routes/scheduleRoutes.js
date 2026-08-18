// src/routes/scheduleRoutes.js
import express from 'express';
import authMiddleware from '../middlewares/authMiddleware.js';
import requireRole from '../middlewares/requireRole.js';
import {
  getTeamSchedule,
  triggerRotationExtend,
  getFullScheduleMatrix,
  getPastSchedule,
} from '../controllers/scheduleController.js';

const router = express.Router();

router.use(authMiddleware);

/**
 * @openapi
 * /schedule/past/history:
 *   get:
 *     summary: Get past generated schedule shifts (admin or super_admin)
 *     tags:
 *       - Schedule
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: teamId
 *         required: false
 *         schema:
 *           type: integer
 *         description: Optional team ID filter (auto-filtered to admin's team if caller is admin)
 *     responses:
 *       200:
 *         description: Historical schedule rows
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   start_dt:
 *                     type: string
 *                     format: date-time
 *                   end_dt:
 *                     type: string
 *                     format: date-time
 *                   emp_id:
 *                     type: integer
 *                   on_call_name:
 *                     type: string
 *                   on_call_ftid:
 *                     type: string
 *                   on_call_phone:
 *                     type: string
 *                   bk_emp_id:
 *                     type: integer
 *                   backup_name:
 *                     type: string
 *                   backup_phone:
 *                     type: string
 *                   team_id:
 *                     type: integer
 *                   team_name:
 *                     type: string
 *                   manager_name:
 *                     type: string
 *                   manager_phone:
 *                     type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Requires admin or super_admin role
 *       500:
 *         description: Server error
 */
router.get(
  '/past/history',
  requireRole('admin', 'super_admin'),
  getPastSchedule
);

/**
 * @openapi
 * /schedule/{teamId}:
 *   get:
 *     summary: Get full schedule rotation for a specific team
 *     tags:
 *       - Schedule
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Team ID
 *     responses:
 *       200:
 *         description: Team schedule rows
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   start_dt:
 *                     type: string
 *                     format: date-time
 *                   end_dt:
 *                     type: string
 *                     format: date-time
 *                   emp_id:
 *                     type: integer
 *                   bk_emp_id:
 *                     type: integer
 *                   on_call_name:
 *                     type: string
 *                   on_call_phone:
 *                     type: string
 *                   backup_name:
 *                     type: string
 *                   backup_phone:
 *                     type: string
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Team not found
 *       500:
 *         description: Server error
 */
router.get('/:teamId', getTeamSchedule);

/**
 * @openapi
 * /schedule/{teamId}/extend:
 *   post:
 *     summary: Manually trigger rotation extension for a team (super_admin only)
 *     tags:
 *       - Schedule
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Team ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cyclesToAdd:
 *                 type: integer
 *                 description: Number of cycles to extend (default set in model if omitted)
 *     responses:
 *       201:
 *         description: Newly generated schedule rows
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   emp_id:
 *                     type: integer
 *                   bk_emp_id:
 *                     type: integer
 *                   start_dt:
 *                     type: string
 *                     format: date-time
 *                   end_dt:
 *                     type: string
 *                     format: date-time
 *                   cycle_id:
 *                     type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Requires super_admin role
 *       404:
 *         description: Team not found
 *       500:
 *         description: Server error
 */
router.post('/:teamId/extend', requireRole('super_admin'), triggerRotationExtend);

/**
 * @openapi
 * /schedule:
 *   get:
 *     summary: Get upcoming rotation matrix across all teams
 *     tags:
 *       - Schedule
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Flat schedule matrix rows across all teams
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   team_id:
 *                     type: integer
 *                   team_name:
 *                     type: string
 *                   start_dt:
 *                     type: string
 *                     format: date-time
 *                   end_dt:
 *                     type: string
 *                     format: date-time
 *                   on_call_name:
 *                     type: string
 *                   on_call_phone:
 *                     type: string
 *                   backup_name:
 *                     type: string
 *                   backup_phone:
 *                     type: string
 *                   rn:
 *                     type: integer
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/', getFullScheduleMatrix);

export default router;
