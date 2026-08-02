// src/routes/authRoutes.js
import express from 'express';
import authMiddleware from '../middlewares/authMiddleware.js';
import { login, getMe } from '../controllers/authController.js';

const router = express.Router();

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Authenticate user via LDAP and return JWT token
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: john_doe
 *               password:
 *                 type: string
 *                 example: secret123
 *     responses:
 *       200:
 *         description: Login successful, returns JWT token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *       400:
 *         description: Missing username or password
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *       401:
 *         description: Invalid company credentials
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *       403:
 *         description: Employee record not found or account inactive
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
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
router.post('/login', login);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     summary: Get profile of currently authenticated user
 *     tags:
 *       - Auth
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 emp_id:
 *                   type: integer
 *                 emp_name:
 *                   type: string
 *                 phone1:
 *                   type: string
 *                 phone2:
 *                   type: string
 *                 emp_mail:
 *                   type: string
 *                 team_id:
 *                   type: integer
 *                 ftid:
 *                   type: string
 *                 def_oncall_ord:
 *                   type: integer
 *                 active_flg:
 *                   type: boolean
 *                 role:
 *                   type: string
 *                   enum: [user, admin, super_admin]
 *                 bk_emp_id:
 *                   type: integer
 *       401:
 *         description: Unauthorized / invalid or missing token
 *       404:
 *         description: Employee record not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
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
router.get('/me', authMiddleware, getMe);

export default router;