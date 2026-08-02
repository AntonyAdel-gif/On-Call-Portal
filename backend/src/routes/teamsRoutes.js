// src/routes/teamsRoutes.js
import express from 'express';
import authMiddleware from '../middlewares/authMiddleware.js';
import requireRole from '../middlewares/requireRole.js';
import { getTeams, getTeamById, createTeam, updateTeam, deleteTeam, getAvailableAdmins } from '../controllers/teamsController.js';

const router = express.Router();

router.use(authMiddleware);

/**
 * @openapi
 * /teams:
 *   get:
 *     summary: Get all teams
 *     tags:
 *       - Teams
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of teams
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
 *                   cycle_day:
 *                     type: integer
 *                   cycle_st_day:
 *                     type: string
 *                     format: date
 *                   manager_emp_id:
 *                     type: integer
 *                     nullable: true
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/', getTeams);

/**
 * @openapi
 * /teams/available-admins:
 *   get:
 *     summary: Get admins not currently managing any other team
 *     tags:
 *       - Teams
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: excludeTeamId
 *         required: false
 *         schema:
 *           type: integer
 *         description: Optional team ID to include that team's current manager in results
 *     responses:
 *       200:
 *         description: List of available admin employees
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   emp_id:
 *                     type: integer
 *                   emp_name:
 *                     type: string
 *                   emp_mail:
 *                     type: string
 *                   phone1:
 *                     type: string
 *                   team_id:
 *                     type: integer
 *                     nullable: true
 *                   role:
 *                     type: string
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/available-admins', getAvailableAdmins);

/**
 * @openapi
 * /teams/{id}:
 *   get:
 *     summary: Get single team details
 *     tags:
 *       - Teams
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Team ID
 *     responses:
 *       200:
 *         description: Team details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 team_id:
 *                   type: integer
 *                 team_name:
 *                   type: string
 *                 cycle_day:
 *                   type: integer
 *                 cycle_st_day:
 *                   type: string
 *                   format: date
 *                 manager_emp_id:
 *                   type: integer
 *                   nullable: true
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Team not found
 *       500:
 *         description: Server error
 */
router.get('/:id', getTeamById);

/**
 * @openapi
 * /teams:
 *   post:
 *     summary: Create a new team (super_admin only)
 *     tags:
 *       - Teams
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - team_name
 *             properties:
 *               team_name:
 *                 type: string
 *               cycle_day:
 *                 type: integer
 *                 default: 7
 *               cycle_st_day:
 *                 type: string
 *                 format: date
 *               manager_emp_id:
 *                 type: integer
 *                 nullable: true
 *               app_ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: Application IDs to assign to this team
 *     responses:
 *       201:
 *         description: Team created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 team_id:
 *                   type: integer
 *                 team_name:
 *                   type: string
 *                 cycle_day:
 *                   type: integer
 *                 cycle_st_day:
 *                   type: string
 *                   format: date
 *                 manager_emp_id:
 *                   type: integer
 *                   nullable: true
 *       400:
 *         description: Bad request (Invalid manager role or manager already manages another team)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Requires super_admin role
 *       500:
 *         description: Server error
 */
router.post('/', requireRole('super_admin'), createTeam);

/**
 * @openapi
 * /teams/{id}:
 *   put:
 *     summary: Update an existing team (super_admin only)
 *     tags:
 *       - Teams
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Team ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               team_name:
 *                 type: string
 *               cycle_day:
 *                 type: integer
 *               cycle_st_day:
 *                 type: string
 *                 format: date
 *               manager_emp_id:
 *                 type: integer
 *                 nullable: true
 *               app_ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       200:
 *         description: Team updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 team_id:
 *                   type: integer
 *                 team_name:
 *                   type: string
 *                 cycle_day:
 *                   type: integer
 *                 cycle_st_day:
 *                   type: string
 *                   format: date
 *                 manager_emp_id:
 *                   type: integer
 *                   nullable: true
 *       400:
 *         description: Bad request (Manager role invalid or manages another team)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Requires super_admin role
 *       404:
 *         description: Team not found
 *       500:
 *         description: Server error
 */
router.put('/:id', requireRole('super_admin'), updateTeam);

/**
 * @openapi
 * /teams/{id}:
 *   delete:
 *     summary: Delete a team (super_admin only)
 *     tags:
 *       - Teams
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Team ID
 *     responses:
 *       204:
 *         description: Team deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Requires super_admin role
 *       404:
 *         description: Team not found
 *       500:
 *         description: Server error
 */
router.delete('/:id', requireRole('super_admin'), deleteTeam);

export default router;