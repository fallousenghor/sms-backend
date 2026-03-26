import { Router } from 'express';
import { body, param } from 'express-validator';
import { GroupController } from './group.controller';
import { GroupService } from './group.service';
import { validateRequest } from '../../shared/middleware/validate';
import { authenticateAsync } from '../../shared/middleware/auth';

const router = Router();
const groupService = new GroupService();
const groupController = new GroupController(groupService);

router.use(authenticateAsync);

/**
 * @swagger
 * tags:
 *   name: Groups
 *   description: Client group management
 */

/**
 * @swagger
 * /groups:
 *   get:
 *     summary: Get all groups
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: List of groups with client counts
 */
router.get('/', groupController.findAll);

/**
 * @swagger
 * /groups:
 *   post:
 *     summary: Create a new group
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 example: VIP Clients
 *               description:
 *                 type: string
 *               color:
 *                 type: string
 *                 example: "#10B981"
 *     responses:
 *       201:
 *         description: Group created
 *       409:
 *         description: Group name already exists
 */
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Group name is required'),
    body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/).withMessage('Invalid color hex format'),
  ],
  validateRequest,
  groupController.create
);

/**
 * @swagger
 * /groups/{id}:
 *   get:
 *     summary: Get group by ID
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Group details
 *       404:
 *         description: Group not found
 */
router.get(
  '/:id',
  [param('id').isUUID().withMessage('Invalid group ID')],
  validateRequest,
  groupController.findById
);

/**
 * @swagger
 * /groups/{id}:
 *   put:
 *     summary: Update a group
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               color: { type: string }
 *     responses:
 *       200:
 *         description: Group updated
 */
router.put(
  '/:id',
  [
    param('id').isUUID().withMessage('Invalid group ID'),
    body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/).withMessage('Invalid color hex format'),
  ],
  validateRequest,
  groupController.update
);

/**
 * @swagger
 * /groups/{id}:
 *   delete:
 *     summary: Delete a group
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Group deleted
 */
router.delete(
  '/:id',
  [param('id').isUUID().withMessage('Invalid group ID')],
  validateRequest,
  groupController.delete
);

/**
 * @swagger
 * /groups/{id}/clients:
 *   get:
 *     summary: Get all clients in a group
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated list of clients in the group
 */
router.get(
  '/:id/clients',
  [param('id').isUUID().withMessage('Invalid group ID')],
  validateRequest,
  groupController.getGroupClients
);

export { router as groupRouter };
