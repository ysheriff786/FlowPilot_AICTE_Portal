import { Router } from 'express';
import { getAnalyticsSummary, getPendency } from '../controllers/analytics.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/summary', authenticate, getAnalyticsSummary);
router.get('/pendency', authenticate, getPendency);

export default router;
