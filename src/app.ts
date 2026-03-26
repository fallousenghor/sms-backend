import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';

import { config } from './shared/config';
import { swaggerSpec } from './shared/config/swagger';
import { authRouter } from './modules/auth/auth.routes';
import { clientRouter } from './modules/clients/client.routes';
import { groupRouter } from './modules/groups/group.routes';
import { smsRouter } from './modules/sms/sms.routes';
import { errorHandler, notFoundHandler } from './shared/middleware/errorHandler';
import { logger } from './shared/utils/logger';

export function createApp(): express.Application {
  const app = express();

  // ── Security middleware ──────────────────────────────────────────────────
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  app.use(
    cors({
      origin: config.cors.origin,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    })
  );

  // ── Rate limiting ────────────────────────────────────────────────────────
  const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests, please try again later.' },
  });
  app.use(limiter);

  // ── Body parsing ─────────────────────────────────────────────────────────
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // ── HTTP logging ─────────────────────────────────────────────────────────
  if (config.app.nodeEnv !== 'test') {
    app.use(
      morgan('combined', {
        stream: { write: (msg) => logger.http(msg.trim()) },
      })
    );
  }

  // ── Health check ─────────────────────────────────────────────────────────
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      environment: config.app.nodeEnv,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    });
  });

  // ── API Documentation ────────────────────────────────────────────────────
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'SMS Bulk API Docs',
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'list',
        filter: true,
      },
    })
  );

  app.get('/api-docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  // ── API Routes ────────────────────────────────────────────────────────────
  const apiPrefix = `/api/${config.app.apiVersion}`;

  app.use(`${apiPrefix}/auth`, authRouter);
  app.use(`${apiPrefix}/clients`, clientRouter);
  app.use(`${apiPrefix}/groups`, groupRouter);
  app.use(`${apiPrefix}/sms`, smsRouter);

  // ── 404 & Error handlers ─────────────────────────────────────────────────
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
