import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import path from 'path';
import { env, isProduction, isTest } from './config/env';
import { apiRateLimiter } from './middleware/rateLimit';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import apiRoutes from './routes';
import webhookRoutes from './routes/webhook.routes';

export function createApp(): Express {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  const allowedOrigins = env.FRONTEND_URL.split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: isProduction ? undefined : false,
    }),
  );

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true); // server-to-server / webhooks
        if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) return callback(null, true);
        if (!isProduction && /^http:\/\/localhost:\d+$/.test(origin)) return callback(null, true);
        return callback(new Error(`Origin ${origin} is not allowed by CORS`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    }),
  );

  app.use(compression());
  if (!isTest) app.use(morgan(isProduction ? 'combined' : 'dev'));

  app.use(
    express.json({
      limit: '10mb',
      verify: (req, _res, buf) => {
        (req as express.Request).rawBody = Buffer.from(buf);
      },
    }),
  );
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  app.use((req, res, next) => {
    req.requestId = crypto.randomUUID();
    res.setHeader('X-Request-Id', req.requestId);
    next();
  });

  // Serve locally stored uploads (development fallback when Cloudinary is not configured)
  app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

  app.get('/health', (_req, res) => {
    res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() } });
  });

  // WhatsApp webhooks must be publicly reachable and are rate limited separately
  app.use(`${env.API_PREFIX}/webhooks`, webhookRoutes);
  app.use('/webhooks', webhookRoutes);

  app.use(env.API_PREFIX, apiRateLimiter, apiRoutes);

  app.get(env.API_PREFIX, (_req, res) => {
    res.json({
      success: true,
      data: {
        name: 'NALDA USA Products CRM API',
        version: '1.0.0',
        docs: '/api/v1/docs',
        health: '/health',
      },
    });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
