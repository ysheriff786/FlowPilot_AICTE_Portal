import { Router } from 'express';
import { getRoutingRules, createRoutingRule, getStateRegions, createStateRegion } from '../controllers/routing.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();
router.get('/rules', authenticate, authorize(['ADMIN']), getRoutingRules);
router.post('/rules', authenticate, authorize(['ADMIN']), createRoutingRule);
router.get('/state-regions', authenticate, authorize(['ADMIN']), getStateRegions);
router.post('/state-regions', authenticate, authorize(['ADMIN']), createStateRegion);
export default router;