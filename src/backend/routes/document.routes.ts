import { Router } from 'express';
import { uploadDocument, verifyDocument, getComplianceScore, getDocuments, getDocumentRequirements, getDocumentFile, getExpiringDocuments, createDocumentRequirement } from '../controllers/document.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { upload } from '../utils/upload';

const router = Router();

router.get('/requirements', authenticate, getDocumentRequirements);
router.post('/requirements', authenticate, authorize(['ADMIN']), createDocumentRequirement);
router.post('/upload', authenticate, authorize(['ADMIN', 'COLLEGE']), upload.single('file'), uploadDocument);
router.patch('/verify/:id', authenticate, authorize(['ADMIN', 'OFFICER']), verifyDocument);
router.get('/application/:applicationId', authenticate, getDocuments);
router.get('/file/:id', authenticate, getDocumentFile);
router.get('/compliance/:applicationId', authenticate, getComplianceScore);
router.get('/expiring', authenticate, getExpiringDocuments);

export default router;
