import { Router } from 'express';
import { getInstitutions, createInstitution, updateInstitution } from '../controllers/institution.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();
router.get('/', authenticate, getInstitutions);
router.post('/', authenticate, authorize(['ADMIN']), createInstitution);
router.patch('/:id', authenticate, authorize(['ADMIN']), updateInstitution);
export default router;