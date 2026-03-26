import { Router } from 'express';
import { body, param } from 'express-validator';
import { SmsController } from './sms.controller';
import { SmsService } from './sms.service';
import { TwilioService } from './twilio.service';
import { validateRequest } from '../../shared/middleware/validate';
import { authenticateAsync } from '../../shared/middleware/auth';

const router = Router();
const twilioService = new TwilioService();
const smsService = new SmsService(twilioService);
const smsController = new SmsController(smsService);

router.use(authenticateAsync);

/**
 * @swagger
 * tags:
 *   name: SMS
 *   description: SMS sending and campaign management
 */

/**
 * @swagger
 * /sms/send:
 *   post:
 *     summary: Send a single SMS to any phone number
 *     tags: [SMS]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone, message]
 *             properties:
 *               phone:
 *                 type: string
 *                 example: "+221771234567"
 *               message:
 *                 type: string
 *                 example: "Bonjour! Votre commande est prête."
 *     responses:
 *       200:
 *         description: SMS sent successfully
 *       400:
 *         description: Validation error
 */
router.post(
  '/send',
  [
    body('phone')
      .trim()
      .notEmpty()
      .withMessage('Phone number is required')
      .matches(/^\+?[1-9]\d{7,14}$/)
      .withMessage('Invalid phone number format'),
    body('message')
      .trim()
      .notEmpty()
      .withMessage('Message is required')
      .isLength({ max: 1600 })
      .withMessage('Message too long (max 1600 characters)'),
  ],
  validateRequest,
  smsController.sendSingle
);

/**
 * @swagger
 * /sms/campaigns:
 *   post:
 *     summary: Create and send a bulk SMS campaign
 *     tags: [SMS]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message:
 *                 type: string
 *                 example: "Promotions de fin d'année! Venez profiter de -30% sur tout."
 *               campaignName:
 *                 type: string
 *                 example: "Promo Noël 2024"
 *               sendToAll:
 *                 type: boolean
 *                 description: Send to ALL active clients
 *                 example: false
 *               groupId:
 *                 type: string
 *                 description: Send to all clients in a group
 *               clientIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Send to specific client IDs
 *               scheduledAt:
 *                 type: string
 *                 format: date-time
 *                 description: Optional schedule date/time (ISO 8601)
 *     responses:
 *       201:
 *         description: Campaign created and dispatched (or scheduled)
 *       400:
 *         description: No target clients found
 */
router.post(
  '/campaigns',
  [
    body('message')
      .trim()
      .notEmpty()
      .withMessage('Message is required')
      .isLength({ max: 1600 })
      .withMessage('Message max 1600 characters'),
    body('campaignName').optional().trim(),
    body('sendToAll').optional().isBoolean(),
    body('groupId').optional().isUUID().withMessage('Invalid groupId'),
    body('clientIds').optional().isArray(),
    body('scheduledAt').optional().isISO8601().withMessage('scheduledAt must be ISO 8601'),
  ],
  validateRequest,
  smsController.createCampaign
);

/**
 * @swagger
 * /sms/campaigns:
 *   get:
 *     summary: Get all campaigns (paginated)
 *     tags: [SMS]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, RUNNING, COMPLETED, FAILED, CANCELLED]
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated list of campaigns
 */
router.get('/campaigns', smsController.getCampaigns);

/**
 * @swagger
 * /sms/stats:
 *   get:
 *     summary: Get SMS campaign statistics
 *     tags: [SMS]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Campaign stats by status with totals
 */
router.get('/stats', smsController.getCampaignStats);

/**
 * @swagger
 * /sms/campaigns/{id}:
 *   get:
 *     summary: Get campaign details with logs
 *     tags: [SMS]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Campaign with SMS logs
 *       404:
 *         description: Campaign not found
 */
router.get(
  '/campaigns/:id',
  [param('id').isUUID().withMessage('Invalid campaign ID')],
  validateRequest,
  smsController.getCampaignById
);

/**
 * @swagger
 * /sms/campaigns/{id}/cancel:
 *   patch:
 *     summary: Cancel a pending campaign
 *     tags: [SMS]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Campaign cancelled
 *       400:
 *         description: Campaign is not in PENDING state
 */
router.patch(
  '/campaigns/:id/cancel',
  [param('id').isUUID().withMessage('Invalid campaign ID')],
  validateRequest,
  smsController.cancelCampaign
);

/**
 * @swagger
 * /sms/campaigns/{id}/report:
 *   get:
 *     summary: Get delivery report for a campaign
 *     tags: [SMS]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Detailed delivery report with per-client status
 */
router.get(
  '/campaigns/:id/report',
  [param('id').isUUID().withMessage('Invalid campaign ID')],
  validateRequest,
  smsController.getDeliveryReport
);

export { router as smsRouter };
