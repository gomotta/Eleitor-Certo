import { Router } from 'express';
import { MapaController } from '../controllers/mapa.controller';
import { authenticate } from '../middlewares/authenticate';

const router = Router();

router.use(authenticate);

router.get('/dados', MapaController.getDados);
router.get('/filtro', MapaController.getFilteredDados);
router.get('/camada', MapaController.getCamada);
router.get('/municipio/:tse/detalhes', MapaController.getMunicipioDetalhes);
router.get('/zona/:id/detalhes', MapaController.getZonaDetalhes);
router.get('/comparativo', MapaController.getComparativo);

export default router;
