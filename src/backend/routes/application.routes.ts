import { Router } from 'express';
import {
  createApplication,
  getApplication,
  getApplications,
  submitApplication,
  updateApplicationStatus,
} from '../controllers/application.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, getApplications);
router.get('/:id', authenticate, getApplication);
router.post('/', authenticate, authorize(['ADMIN', 'COLLEGE']), createApplication);
router.post('/:id/submit', authenticate, authorize(['COLLEGE']), submitApplication);
router.patch('/:id/status', authenticate, authorize(['ADMIN', 'OFFICER']), updateApplicationStatus);

export default router;
