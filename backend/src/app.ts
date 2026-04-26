import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { generalLimiter } from './middlewares/rateLimiter';
import { errorHandler } from './middlewares/errorHandler';
import authRoutes from './routes/auth.routes';
import candidateRoutes from './routes/candidate.routes';
import geoRoutes from './routes/geo.routes';
import mapaRoutes from './routes/mapa.routes';
import partidosRoutes from './routes/partidos.routes';

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173' }));
app.use(compression());
app.use(express.json());
app.use(generalLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/candidates', candidateRoutes);
app.use('/api/geo', geoRoutes);
app.use('/api/mapa', mapaRoutes);
app.use('/api/partidos', partidosRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use(errorHandler);

export default app;
