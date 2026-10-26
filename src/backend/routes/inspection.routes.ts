import { Router } from 'express';
import { getInspections, getInspectionQueue, scheduleInspection, updateInspection } from '../controllers/inspection.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, getInspections);
router.get('/queue', authenticate, getInspectionQueue);
router.post('/', authenticate, authorize(['ADMIN', 'OFFICER']), scheduleInspection);
router.patch('/:id', authenticate, authorize(['ADMIN', 'OFFICER']), updateInspection);

export default router;
