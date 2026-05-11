import { Router } from 'express';
import { CaboEleitoralController } from '../controllers/cabo-eleitoral.controller';
import { authenticate } from '../middlewares/authenticate';

const router = Router();

router.use(authenticate);

router.get('/candidatos/search', CaboEleitoralController.searchCandidatos);
router.get('/municipios/search', CaboEleitoralController.searchMunicipios);
router.get('/locais/search', CaboEleitoralController.searchLocaisVotacao);
router.get('/municipios/resolve/:tseId', CaboEleitoralController.resolveMunicipio);

router.post('/', CaboEleitoralController.create);
router.get('/', CaboEleitoralController.list);
router.get('/:id', CaboEleitoralController.getById);
router.put('/:id', CaboEleitoralController.update);
router.delete('/:id', CaboEleitoralController.remove);

router.post('/:id/historico', CaboEleitoralController.addHistorico);
router.put('/:id/historico/:hid', CaboEleitoralController.updateHistorico);
router.delete('/:id/historico/:hid', CaboEleitoralController.removeHistorico);

export default router;
