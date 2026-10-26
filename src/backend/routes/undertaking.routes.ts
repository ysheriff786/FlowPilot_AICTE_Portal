import { Router } from 'express';
import { getUndertakings, createUndertaking, updateUndertaking, uploadEvidence } from '../controllers/undertaking.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { upload } from '../utils/upload';

const router = Router();
router.get('/', authenticate, getUndertakings);
router.post('/', authenticate, authorize(['ADMIN', 'OFFICER']), createUndertaking);
router.patch('/:id', authenticate, authorize(['ADMIN', 'OFFICER']), updateUndertaking);
router.post('/:id/evidence', authenticate, upload.single('file'), uploadEvidence);
export default router;