import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AiController } from '../controllers/ai.controller';
import { authenticate } from '../middlewares/authenticate';

const router = Router();

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas consultas à IA — aguarde um instante.' },
});

router.use(authenticate);
router.post('/query', aiLimiter, AiController.query);

export default router;
