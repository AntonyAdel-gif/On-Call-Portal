// src/routes/applicationsRoutes.js
import express from 'express';
import authMiddleware from '../middlewares/authMiddleware.js';
import requireRole from '../middlewares/requireRole.js';
import {
  getApplications,
  createApplication,
  updateApplication,
  removeApplication,
} from '../controllers/applicationsController.js';

const router = express.Router();

router.use(authMiddleware);

/**
 * @openapi
 * /applications:
 *   get:
 *     summary: Get all applications (super_admin only)
 *     tags:
 *       - Applications
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of applications
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   application_id:
 *                     type: integer
 *                   application_name:
 *                     type: string
 *                   sla:
 *                     type: string
 *                   basicat:
 *                     type: string
 *                   cartoo_id:
 *                     type: string
 *                   team_id:
 *                     type: integer
 *                     nullable: true
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Requires super_admin role
 *       500:
 *         description: Server error
 */
router.get('/', requireRole('super_admin'), getApplications);

/**
 * @openapi
 * /applications:
 *   post:
 *     summary: Create a new application (admin or super_admin)
 *     tags:
 *       - Applications
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - application_name
 *             properties:
 *               application_name:
 *                 type: string
 *               sla:
 *                 type: string
 *               basicat:
 *                 type: string
 *               cartoo_id:
 *                 type: string
 *                 description: Must be exactly 5 characters
 *               team_id:
 *                 type: integer
 *                 nullable: true
 *                 description: Forced to admin's team if caller is admin
 *     responses:
 *       201:
 *         description: Application created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 application_id:
 *                   type: integer
 *                 application_name:
 *                   type: string
 *                 sla:
 *                   type: string
 *                 basicat:
 *                   type: string
 *                 cartoo_id:
 *                   type: string
 *                 team_id:
 *                   type: integer
 *                   nullable: true
 *       400:
 *         description: Missing application_name or invalid cartoo_id length
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Requires admin or super_admin role
 *       500:
 *         description: Server error
 */
router.post('/', requireRole('admin', 'super_admin'), createApplication);

/**
 * @openapi
 * /applications/{id}:
 *   put:
 *     summary: Update an application (super_admin only)
 *     tags:
 *       - Applications
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Application ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               application_name:
 *                 type: string
 *               sla:
 *                 type: string
 *               basicat:
 *                 type: string
 *               cartoo_id:
 *                 type: string
 *                 description: Must be exactly 5 characters
 *               team_id:
 *                 type: integer
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Application updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 application_id:
 *                   type: integer
 *                 application_name:
 *                   type: string
 *                 sla:
 *                   type: string
 *                 basicat:
 *                   type: string
 *                 cartoo_id:
 *                   type: string
 *                 team_id:
 *                   type: integer
 *                   nullable: true
 *       400:
 *         description: Invalid cartoo_id length (must be 5 characters)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Requires super_admin role
 *       404:
 *         description: Application not found
 *       500:
 *         description: Server error
 */
router.put(
  '/:id',
  requireRole('admin', 'super_admin'),
  updateApplication
);

/**
 * @openapi
 * /applications/{id}:
 *   delete:
 *     summary: Remove an application (admin or super_admin)
 *     tags:
 *       - Applications
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Application ID
 *     responses:
 *       204:
 *         description: Application deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Requires super_admin role
 *       500:
 *         description: Server error
 */
router.delete('/:id', requireRole('admin', 'super_admin'), removeApplication);

export default router;
