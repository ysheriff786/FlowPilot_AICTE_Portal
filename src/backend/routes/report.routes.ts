import { Router } from 'express';
import { getConsolidatedReport } from '../controllers/report.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();
router.get('/consolidated', authenticate, authorize(['ADMIN', 'OFFICER']), getConsolidatedReport);
export default router;