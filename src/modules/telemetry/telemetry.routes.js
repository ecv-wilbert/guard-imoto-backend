import express from 'express';
import { ingestTelemetry } from './telemetry.controller.js';

const router = express.Router();

router.post('/ingest', ingestTelemetry);

export default router;
