import { Router, Request } from 'express';
import { env, isProduction } from '../config/env';
import { asyncHandler } from '../utils/http';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { authRateLimiter } from '../middleware/rateLimit';
import {
  changePasswordSchema,
  loginSchema,
  requestResetSchema,
  resetPasswordSchema,
} from '../validators/schemas';
import * as authService from '../services/auth.service';

const router = Router();

function meta(req: Request) {
  return { ipAddress: req.ip, userAgent: req.headers['user-agent'] ?? null };
}

function cookieOptions(maxAgeMs?: number) {
  return {
    httpOnly: true,
    secure: env.REFRESH_COOKIE_SECURE || isProduction,
    sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax',
    path: '/',
    ...(maxAgeMs ? { maxAge: maxAgeMs } : {}),
  };
}

const REFRESH_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

router.post(
  '/login',
  authRateLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.login(req.body.email, req.body.password, meta(req));
    res.cookie(env.REFRESH_COOKIE_NAME, result.refreshToken, cookieOptions(REFRESH_MAX_AGE));
    res.json({
      success: true,
      data: { accessToken: result.accessToken, admin: result.admin },
      refreshToken: isProduction ? undefined : result.refreshToken,
    });
  }),
);

router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[env.REFRESH_COOKIE_NAME] || req.body?.refreshToken;
    const result = await authService.refresh(token, meta(req));
    res.cookie(env.REFRESH_COOKIE_NAME, result.refreshToken, cookieOptions(REFRESH_MAX_AGE));
    res.json({ success: true, data: { accessToken: result.accessToken, admin: result.admin } });
  }),
);

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    await authService.logout(req.cookies?.[env.REFRESH_COOKIE_NAME] || req.body?.refreshToken);
    res.clearCookie(env.REFRESH_COOKIE_NAME, cookieOptions());
    res.json({ success: true, data: { message: 'Logged out' } });
  }),
);

router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const profile = await authService.getProfile(req.admin!.id);
    res.json({ success: true, data: profile });
  }),
);

router.post(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  asyncHandler(async (req, res) => {
    await authService.changePassword(req.admin!.id, req.body.currentPassword, req.body.newPassword, meta(req));
    res.clearCookie(env.REFRESH_COOKIE_NAME, cookieOptions());
    res.json({ success: true, data: { message: 'Password changed. Please log in again.' } });
  }),
);

router.post(
  '/forgot-password',
  authRateLimiter,
  validate(requestResetSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.requestPasswordReset(req.body.email, meta(req));
    res.json({ success: true, data: result });
  }),
);

router.post(
  '/reset-password',
  authRateLimiter,
  validate(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    await authService.resetPassword(req.body.token, req.body.newPassword, meta(req));
    res.json({ success: true, data: { message: 'Password reset successful. Please log in.' } });
  }),
);

export default router;
