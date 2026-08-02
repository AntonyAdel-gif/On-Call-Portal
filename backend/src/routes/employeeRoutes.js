// src/routes/employeeRoutes.js
import express from 'express';
import authMiddleware from '../middlewares/authMiddleware.js';
import requireRole from '../middlewares/requireRole.js';
import {
  getEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  removeEmployee,
  getTeammates,
} from '../controllers/employeeController.js';

const router = express.Router();

// Every route here requires a logged-in user at minimum
router.use(authMiddleware);

/**
 * @openapi
 * /employees/teammates:
 *   get:
 *     summary: Get teammate names for logged-in user's team
 *     tags:
 *       - Employees
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of teammate summary objects
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
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/teammates', getTeammates);

/**
 * @openapi
 * /employees:
 *   get:
 *     summary: List employees (admin sees own team, super_admin sees everyone)
 *     tags:
 *       - Employees
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Employee roster list
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
 *                   phone1:
 *                     type: string
 *                   phone2:
 *                     type: string
 *                     nullable: true
 *                   emp_mail:
 *                     type: string
 *                   team_id:
 *                     type: integer
 *                     nullable: true
 *                   ftid:
 *                     type: string
 *                   def_oncall_ord:
 *                     type: integer
 *                     nullable: true
 *                   active_flg:
 *                     type: boolean
 *                   role:
 *                     type: string
 *                     enum: [user, admin, super_admin]
 *                   bk_emp_id:
 *                     type: integer
 *                     nullable: true
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Requires admin or super_admin role
 *       500:
 *         description: Server error
 */
router.get('/', requireRole('admin', 'super_admin'), getEmployees);

/**
 * @openapi
 * /employees/{id}:
 *   get:
 *     summary: Get single employee details
 *     tags:
 *       - Employees
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Employee ID
 *     responses:
 *       200:
 *         description: Employee details retrieved
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
 *                   nullable: true
 *                 emp_mail:
 *                   type: string
 *                 team_id:
 *                   type: integer
 *                   nullable: true
 *                 ftid:
 *                   type: string
 *                 def_oncall_ord:
 *                   type: integer
 *                   nullable: true
 *                 active_flg:
 *                   type: boolean
 *                 role:
 *                   type: string
 *                   enum: [user, admin, super_admin]
 *                 bk_emp_id:
 *                   type: integer
 *                   nullable: true
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Not authorized to view employee on another team
 *       404:
 *         description: Employee not found
 *       500:
 *         description: Server error
 */
router.get('/:id', requireRole('admin', 'super_admin'), getEmployeeById);

/**
 * @openapi
 * /employees:
 *   post:
 *     summary: Create a new employee
 *     tags:
 *       - Employees
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ftid
 *             properties:
 *               emp_name:
 *                 type: string
 *               phone1:
 *                 type: string
 *               phone2:
 *                 type: string
 *               emp_mail:
 *                 type: string
 *               ftid:
 *                 type: string
 *               team_id:
 *                 type: integer
 *               role:
 *                 type: string
 *                 enum: [user, admin, super_admin]
 *               bk_emp_id:
 *                 type: integer
 *                 nullable: true
 *               active_flg:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Employee created successfully
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
 *                   nullable: true
 *                 emp_mail:
 *                   type: string
 *                 team_id:
 *                   type: integer
 *                   nullable: true
 *                 ftid:
 *                   type: string
 *                 def_oncall_ord:
 *                   type: integer
 *                   nullable: true
 *                 active_flg:
 *                   type: boolean
 *                 role:
 *                   type: string
 *                 bk_emp_id:
 *                   type: integer
 *                   nullable: true
 *       400:
 *         description: Bad request (FTID missing, invalid role, or backup employee invalid)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Requires admin or super_admin role
 *       500:
 *         description: Server error
 */
router.post('/', requireRole('admin', 'super_admin'), createEmployee);

/**
 * @openapi
 * /employees/{id}:
 *   put:
 *     summary: Update an employee record
 *     tags:
 *       - Employees
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Employee ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               emp_name:
 *                 type: string
 *               phone1:
 *                 type: string
 *               phone2:
 *                 type: string
 *               emp_mail:
 *                 type: string
 *               ftid:
 *                 type: string
 *               team_id:
 *                 type: integer
 *               def_oncall_ord:
 *                 type: integer
 *               role:
 *                 type: string
 *                 enum: [user, admin, super_admin]
 *               bk_emp_id:
 *                 type: integer
 *                 nullable: true
 *               active_flg:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Employee record updated successfully
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
 *                   nullable: true
 *                 emp_mail:
 *                   type: string
 *                 team_id:
 *                   type: integer
 *                   nullable: true
 *                 ftid:
 *                   type: string
 *                 def_oncall_ord:
 *                   type: integer
 *                   nullable: true
 *                 active_flg:
 *                   type: boolean
 *                 role:
 *                   type: string
 *                 bk_emp_id:
 *                   type: integer
 *                   nullable: true
 *       400:
 *         description: Bad request (Invalid backup, order change blocked due to active shift)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Not authorized to edit employee or grant super_admin
 *       404:
 *         description: Employee not found
 *       500:
 *         description: Server error
 */
router.put('/:id', requireRole('admin', 'super_admin'), updateEmployee);

/**
 * @openapi
 * /employees/{id}:
 *   delete:
 *     summary: Remove an employee
 *     tags:
 *       - Employees
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Employee ID
 *     responses:
 *       204:
 *         description: Employee deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Not authorized to remove employee on another team
 *       404:
 *         description: Employee not found
 *       500:
 *         description: Server error
 */
router.delete('/:id', requireRole('admin', 'super_admin'), removeEmployee);

export default router;