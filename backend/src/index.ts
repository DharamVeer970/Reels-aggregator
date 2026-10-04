import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { videosRouter } from './routes/videos.js';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultEnvPath = path.resolve(currentDirectory, '../../.env');
dotenv.config({ path: process.env.ENV_FILE || defaultEnvPath });

const app = express();
app.disable('x-powered-by');
const port = Number(process.env.PORT || 4000);
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());
app.get('/health', (_request: express.Request, response: express.Response) => response.json({ status: 'ok' }));
app.use('/api/videos', videosRouter);
app.use((error: Error, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  console.error(error);
  response.status(500).json({ error: 'Unable to load the video feed' });
});
app.listen(port, () => console.log(`Reels aggregator API listening on http://localhost:${port}`));
