import { Router } from 'express';
import { GeoService } from '../services/geo.service';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const partidos = await GeoService.getPartidos();
    res.json(partidos);
  } catch (err) {
    next(err);
  }
});

export default router;
