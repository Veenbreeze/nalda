import { Router } from 'express';
import authRoutes from './auth.routes';
import customerRoutes from './customer.routes';
import productRoutes from './product.routes';
import orderRoutes from './order.routes';
import dealRoutes from './deal.routes';
import activityRoutes from './activity.routes';
import whatsappRoutes from './whatsapp.routes';
import automationRoutes from './automation.routes';
import dataRoutes from './data.routes';
import backupRoutes from './backup.routes';
import adminRoutes from './admin.routes';
import settingsRoutes from './settings.routes';
import auditRoutes from './audit.routes';
import cargoRoutes from './cargo.routes';
import dashboardRoutes from './dashboard.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/customers', customerRoutes);
router.use('/products', productRoutes);
router.use('/orders', orderRoutes);
router.use('/deals', dealRoutes);
router.use('/activities', activityRoutes);
router.use('/whatsapp', whatsappRoutes);
router.use('/automation', automationRoutes);
router.use('/backups', backupRoutes);
router.use('/settings', settingsRoutes);
router.use('/audit-logs', auditRoutes);

// Routers with multiple top-level resources
router.use('/', dashboardRoutes);
router.use('/', dataRoutes);
router.use('/', adminRoutes);
router.use('/', cargoRoutes);

export default router;
