import { Router } from 'express';
import { CandidateController } from '../controllers/candidate.controller';
import { authenticate } from '../middlewares/authenticate';

const router = Router();

router.use(authenticate);

router.post('/', CandidateController.upsert);
router.get('/me', CandidateController.getMe);
router.put('/me', CandidateController.upsert);
router.get('/export', CandidateController.exportData);
router.delete('/me', CandidateController.deleteMe);

export default router;
