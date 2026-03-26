import { Router } from 'express';
import { body, param, query } from 'express-validator';
import multer from 'multer';
import { ClientController } from './client.controller';
import { ClientService } from './client.service';
import { validateRequest } from '../../shared/middleware/validate';
import { authenticateAsync } from '../../shared/middleware/auth';

const router = Router();
const clientService = new ClientService();
const clientController = new ClientController(clientService);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
    }
  },
});

// All routes require authentication
router.use(authenticateAsync);

/**
 * @swagger
 * tags:
 *   name: Clients
 *   description: Client management
 */

/**
 * @swagger
 * /clients:
 *   get:
 *     summary: Get all clients (paginated, filterable)
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name, phone, or email
 *       - in: query
 *         name: groupId
 *         schema:
 *           type: string
 *         description: Filter by group ID
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *         description: Comma-separated list of tags
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Paginated list of clients
 */
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  ],
  validateRequest,
  clientController.findAll
);

/**
 * @swagger
 * /clients/stats:
 *   get:
 *     summary: Get client statistics
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Client statistics
 */
router.get('/stats', clientController.getStats);

/**
 * @swagger
 * /clients/export:
 *   get:
 *     summary: Export all clients to Excel
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Excel file download
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get('/export', clientController.exportToExcel);

/**
 * @swagger
 * /clients/import:
 *   post:
 *     summary: Bulk import clients from Excel
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Excel file (.xlsx) with columns firstName, lastName, phone, email
 *               groupId:
 *                 type: string
 *                 description: Optional group ID to assign all imported clients
 *     responses:
 *       200:
 *         description: Import results with success/failure counts
 */
router.post('/import', upload.single('file'), clientController.bulkImport);

/**
 * @swagger
 * /clients/{id}:
 *   get:
 *     summary: Get a client by ID
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Client details
 *       404:
 *         description: Client not found
 */
router.get(
  '/:id',
  [param('id').isUUID().withMessage('Invalid client ID')],
  validateRequest,
  clientController.findById
);

/**
 * @swagger
 * /clients:
 *   post:
 *     summary: Create a new client
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [firstName, lastName, phone]
 *             properties:
 *               firstName:
 *                 type: string
 *                 example: Jean
 *               lastName:
 *                 type: string
 *                 example: Dupont
 *               phone:
 *                 type: string
 *                 example: "+221771234567"
 *               email:
 *                 type: string
 *                 format: email
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               groupIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Client created
 *       409:
 *         description: Phone number already exists
 */
router.post(
  '/',
  [
    body('firstName').trim().notEmpty().withMessage('First name is required'),
    body('lastName').trim().notEmpty().withMessage('Last name is required'),
    body('phone')
      .trim()
      .notEmpty()
      .withMessage('Phone number is required')
      .matches(/^\+?[1-9]\d{7,14}$/)
      .withMessage('Invalid phone number format (e.g. +221771234567)'),
    body('email').optional().isEmail().withMessage('Invalid email'),
    body('tags').optional().isArray().withMessage('Tags must be an array'),
    body('groupIds').optional().isArray().withMessage('groupIds must be an array'),
  ],
  validateRequest,
  clientController.create
);

/**
 * @swagger
 * /clients/{id}:
 *   put:
 *     summary: Update a client
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Client updated
 */
router.put(
  '/:id',
  [
    param('id').isUUID().withMessage('Invalid client ID'),
    body('phone')
      .optional()
      .matches(/^\+?[1-9]\d{7,14}$/)
      .withMessage('Invalid phone number format'),
    body('email').optional().isEmail().withMessage('Invalid email'),
  ],
  validateRequest,
  clientController.update
);

/**
 * @swagger
 * /clients/{id}:
 *   delete:
 *     summary: Delete a client
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Client deleted
 *       404:
 *         description: Client not found
 */
router.delete(
  '/:id',
  [param('id').isUUID().withMessage('Invalid client ID')],
  validateRequest,
  clientController.delete
);

/**
 * @swagger
 * /clients/{id}/groups/{groupId}:
 *   post:
 *     summary: Add client to a group
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Client added to group
 */
router.post(
  '/:id/groups/:groupId',
  [
    param('id').isUUID().withMessage('Invalid client ID'),
    param('groupId').isUUID().withMessage('Invalid group ID'),
  ],
  validateRequest,
  clientController.addToGroup
);

/**
 * @swagger
 * /clients/{id}/groups/{groupId}:
 *   delete:
 *     summary: Remove client from a group
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Client removed from group
 */
router.delete(
  '/:id/groups/:groupId',
  [
    param('id').isUUID().withMessage('Invalid client ID'),
    param('groupId').isUUID().withMessage('Invalid group ID'),
  ],
  validateRequest,
  clientController.removeFromGroup
);

export { router as clientRouter };
