import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { changePassword, login, me, register, updateProfile } from '../controllers/auth.controller';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware';
import { LOGIN_RATE_MAX, LOGIN_RATE_WINDOW_MINUTES } from '../lib/config';

const loginLimiter = rateLimit({
  windowMs: LOGIN_RATE_WINDOW_MINUTES * 60 * 1000,
  max: LOGIN_RATE_MAX,
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router();

// Registration is only open while the database is empty (first-run bootstrap).
// Afterwards an administrator must create accounts.
router.post('/register', optionalAuthenticate, register);
router.post('/login', loginLimiter, login);
router.get('/me', authenticate, me);
router.patch('/me', authenticate, updateProfile);
router.patch('/me/password', authenticate, changePassword);

export default router;
