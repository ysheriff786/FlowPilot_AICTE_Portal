import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getSetupStatus, runSetup } from '../controllers/setup.controller';
import { optionalAuthenticate } from '../middleware/auth.middleware';

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5 });

const router = Router();
router.get('/status', getSetupStatus);
router.post('/', limiter, runSetup);
export default router;