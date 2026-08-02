// src/routes/publicViewRoutes.js
import express from 'express';
import { getOnCallDashboard, getTeamAppsAndEscalation } from '../controllers/publicViewController.js';
import { getStaticInfo } from '../controllers/staticInfoController.js';

const router = express.Router();

/**
 * @openapi
 * /public/oncall:
 *   get:
 *     summary: Get current on-call status for all teams
 *     tags:
 *       - Public
 *     responses:
 *       200:
 *         description: Current on-call dashboard list
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   team_id:
 *                     type: integer
 *                   team:
 *                     type: string
 *                   on_call_person:
 *                     type: string
 *                   on_call_phone:
 *                     type: string
 *                   on_call_backup:
 *                     type: string
 *                   on_call_backup_phone:
 *                     type: string
 *                   manager_name:
 *                     type: string
 *                   manager_phone:
 *                     type: string
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */
router.get('/oncall', getOnCallDashboard);

/**
 * @openapi
 * /public/teams/{teamId}/apps:
 *   get:
 *     summary: Get supported applications and escalation contact for a team
 *     tags:
 *       - Public
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Team ID
 *     responses:
 *       200:
 *         description: Applications list with escalation contact info
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   application_name:
 *                     type: string
 *                   sla:
 *                     type: string
 *                   basicat:
 *                     type: string
 *                   cartoo_id:
 *                     type: string
 *                   escalation_name:
 *                     type: string
 *                   escalation_phone:
 *                     type: string
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */
router.get('/teams/:teamId/apps', getTeamAppsAndEscalation);

/**
 * @openapi
 * /public/static-info:
 *   get:
 *     summary: Get static directory / links info
 *     tags:
 *       - Public
 *     responses:
 *       200:
 *         description: Static info rows
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   info_id:
 *                     type: integer
 *                   team_name:
 *                     type: string
 *                   url:
 *                     type: string
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */
router.get('/static-info', getStaticInfo);

export default router;