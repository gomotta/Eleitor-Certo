import { Router } from 'express';
import { GeoController } from '../controllers/geo.controller';

const router = Router();

router.get('/estados', GeoController.getEstados);
router.get('/cidades', GeoController.getCidades);
router.get('/macro-regioes', GeoController.getMacroRegioes);
router.get('/micro-regioes', GeoController.getMicroRegioes);
router.get('/partidos', GeoController.getPartidos);

export default router;
