// src/routes/staticInfoRoutes.js
import express from 'express';
import authMiddleware from '../middlewares/authMiddleware.js';
import requireRole from '../middlewares/requireRole.js';
import { createStaticInfo, updateStaticInfo, deleteStaticInfo } from '../controllers/staticInfoController.js';

const router = express.Router();

/**
 * @openapi
 * /static-info:
 *   post:
 *     summary: Create a new static info row (super_admin only)
 *     tags:
 *       - Static Info
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
 *               url:
 *                 type: string
 *     responses:
 *       201:
 *         description: Static info row created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 info_id:
 *                   type: integer
 *                 team_name:
 *                   type: string
 *                 url:
 *                   type: string
 *                 created_by:
 *                   type: integer
 *                 created_at:
 *                   type: string
 *       400:
 *         description: Missing team_name
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Requires super_admin role
 *       500:
 *         description: Server error
 */
router.post('/', authMiddleware, requireRole('super_admin'), createStaticInfo);

/**
 * @openapi
 * /static-info/{id}:
 *   put:
 *     summary: Update an existing static info row (super_admin only)
 *     tags:
 *       - Static Info
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Info ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               team_name:
 *                 type: string
 *               url:
 *                 type: string
 *     responses:
 *       200:
 *         description: Static info row updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 info_id:
 *                   type: integer
 *                 team_name:
 *                   type: string
 *                 url:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Requires super_admin role
 *       404:
 *         description: Static info row not found
 *       500:
 *         description: Server error
 */
router.put('/:id', authMiddleware, requireRole('super_admin'), updateStaticInfo);

/**
 * @openapi
 * /static-info/{id}:
 *   delete:
 *     summary: Delete a static info row (super_admin only)
 *     tags:
 *       - Static Info
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Info ID
 *     responses:
 *       204:
 *         description: Static info row deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Requires super_admin role
 *       404:
 *         description: Static info row not found
 *       500:
 *         description: Server error
 */
router.delete('/:id', authMiddleware, requireRole('super_admin'), deleteStaticInfo);

export default router;