import { Router } from 'express';
import { MapaController } from '../controllers/mapa.controller';
import { authenticate } from '../middlewares/authenticate';

const router = Router();

router.use(authenticate);

router.get('/dados', MapaController.getDados);
router.get('/filtro', MapaController.getFilteredDados);
router.get('/camada', MapaController.getCamada);
router.get('/ranking/cargos', MapaController.getRankingCargos);
router.get('/ranking/partidos', MapaController.getRankingPartidos);
router.get('/ranking/candidatos', MapaController.getRankingCandidatos);
router.get('/ranking/votos-municipio', MapaController.getVotosPorMunicipio);
router.get('/ranking/locais', MapaController.getRankingLocais);
router.get('/ranking/cargos-local', MapaController.getRankingCargosLocal);
router.get('/municipio/:tse/detalhes', MapaController.getMunicipioDetalhes);
router.get('/municipio/:tse/candidatos', MapaController.getMunicipioCandidatos);
router.get('/municipio/:tse/partido/:sigla/candidatos', MapaController.getMunicipioCandidatosPorPartido);
router.get('/comparativo', MapaController.getComparativo);

export default router;
