import { createApp } from './app';
import { config } from './shared/config';
import { connectDatabase, disconnectDatabase } from './shared/config/prisma';
import { logger } from './shared/utils/logger';

async function bootstrap(): Promise<void> {
  try {
    await connectDatabase();

    const app = createApp();

    const server = app.listen(config.app.port, () => {
      logger.info(`🚀 Server running on port ${config.app.port}`);
      logger.info(`📚 API Docs: http://localhost:${config.app.port}/api-docs`);
      logger.info(`🌍 Environment: ${config.app.nodeEnv}`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string): Promise<void> => {
      logger.info(`${signal} received — shutting down gracefully`);
      server.close(async () => {
        await disconnectDatabase();
        logger.info('Server closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    process.on('uncaughtException', (err) => {
      logger.error('Uncaught exception:', err);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection:', reason);
      process.exit(1);
    });
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
}

bootstrap();
