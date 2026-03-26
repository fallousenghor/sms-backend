import swaggerJsdoc from 'swagger-jsdoc';
import { config } from '../config';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SMS Bulk API',
      version: '1.0.0',
      description: `
## SMS Bulk Sending Platform

API REST pour l'envoi de SMS groupés à vos clients.

### Fonctionnalités
- **Authentification** JWT sécurisée
- **Clients** — CRUD, import Excel, export, tags, groupes
- **Groupes** — Organisation des clients en segments
- **Campagnes SMS** — Envoi immédiat ou planifié, suivi temps réel
- **Rapports** — Taux de livraison, logs détaillés

### Démarrage rapide
1. \`POST /api/v1/auth/register\` — Créer un compte
2. \`POST /api/v1/auth/login\` — Obtenir un token JWT
3. Ajouter \`Authorization: Bearer <token>\` dans vos requêtes
4. \`POST /api/v1/clients\` — Ajouter des clients
5. \`POST /api/v1/sms/campaigns\` — Envoyer une campagne
      `,
      contact: {
        name: 'SMS Bulk Support',
        email: 'support@smsbulk.app',
      },
      license: {
        name: 'MIT',
      },
    },
    servers: [
      {
        url: `http://localhost:${config.app.port}/api/${config.app.apiVersion}`,
        description: 'Development server',
      },
      {
        url: `https://api.smsbulk.app/api/${config.app.apiVersion}`,
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token (obtain via POST /auth/login)',
        },
      },
      schemas: {
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object' },
          },
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'array', items: { type: 'object' } },
            meta: {
              type: 'object',
              properties: {
                total: { type: 'integer' },
                page: { type: 'integer' },
                limit: { type: 'integer' },
                totalPages: { type: 'integer' },
                hasNext: { type: 'boolean' },
                hasPrev: { type: 'boolean' },
              },
            },
          },
        },
        Client: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            phone: { type: 'string', example: '+221771234567' },
            email: { type: 'string', format: 'email' },
            tags: { type: 'array', items: { type: 'string' } },
            isActive: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Group: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            description: { type: 'string' },
            color: { type: 'string', example: '#3B82F6' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Campaign: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            message: { type: 'string' },
            status: {
              type: 'string',
              enum: ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'],
            },
            totalCount: { type: 'integer' },
            sentCount: { type: 'integer' },
            failedCount: { type: 'integer' },
            scheduledAt: { type: 'string', format: 'date-time', nullable: true },
            startedAt: { type: 'string', format: 'date-time', nullable: true },
            completedAt: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/modules/**/*.routes.ts', './src/modules/**/*.routes.js'],
};

export const swaggerSpec = swaggerJsdoc(options);
