/**
 * Game Routes
 * @see WBS Phase 6A
 */

import { Router } from 'express';
import { requireIdentity } from '../../middleware/auth.middleware.js';
import * as gameController from './game.controller.js';

const router = Router();

router.get('/today', requireIdentity, gameController.getToday);
router.post('/sync', requireIdentity, gameController.syncGame);

export default router;
