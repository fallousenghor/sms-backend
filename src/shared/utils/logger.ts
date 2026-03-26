import winston from 'winston';
import { config } from '../config';

const { combine, timestamp, errors, json, colorize, simple } = winston.format;

const developmentFormat = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  simple()
);

const productionFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

export const logger = winston.createLogger({
  level: config.app.nodeEnv === 'production' ? 'info' : 'debug',
  format: config.app.nodeEnv === 'production' ? productionFormat : developmentFormat,
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});
