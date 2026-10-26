import { Router } from 'express';
import { runJobsEndpoint } from '../controllers/admin.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();
router.post('/run-jobs', authenticate, authorize(['ADMIN']), runJobsEndpoint);
export default router;