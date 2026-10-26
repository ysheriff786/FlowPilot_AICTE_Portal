import { Router } from 'express';
import { createUser, getUsers, updateUser } from '../controllers/user.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate, authorize(['ADMIN']));

router.get('/', getUsers);
router.post('/', createUser);
router.patch('/:id', updateUser);

export default router;
