import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { initDb } from './config/db.js';
import logEndpoints from './utils/print-endpoints.js';
import rateLimit from './middlewares/rate-limit.middleware.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { initFirebase } from './config/firebase-admin.js';
import { initPubNub } from './config/pubnub.js';
import { logDb, logPubNub, logServer, logAuth } from './utils/logger.js';

// Initialize external services
const pubnubClient = initPubNub();
const firebaseAdmin = initFirebase();

// Routes
import authRoutes from './modules/auth/auth.routes.js';
import auditRoutes from './modules/audit/audit.routes.js';
import userRoutes from './modules/users/user.routes.js';
import deviceRoutes from './modules/devices/device.routes.js';
import alertRoutes from './modules/alerts/alert.routes.js';
import nfcRoutes from './modules/nfc/nfc.routes.js';
import telemetryRoutes from './modules/telemetry/telemetry.routes.js';
import { authMiddleware } from './middlewares/auth.middleware.js';
import { requireDeviceAuth } from './middlewares/device-auth.middleware.js';

const app = express();
const PORT = process.env.PORT || 3000;

// ----------------------
// Middlewares
// ----------------------
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use(rateLimit);

// ----------------------
// Routes
// ----------------------
app.use('/auth', authMiddleware, authRoutes);
app.use('/audit', authMiddleware, auditRoutes);
app.use('/users', authMiddleware, userRoutes);
app.use('/devices', deviceRoutes);
app.use('/nfc', nfcRoutes);
app.use('/alerts', authMiddleware, alertRoutes);
app.use('/telemetry', requireDeviceAuth, telemetryRoutes);

// ----------------------
// Health check
// ----------------------
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ----------------------
// Error handling
// ----------------------
app.use(errorHandler);

// ----------------------
// Start server
// ----------------------
(async () => {
  try {
    // Initialize PostgreSQL connection
    await initDb();
    logDb('Database connected');

    // Initialize Firebase Admin
    initFirebase();
    logAuth('Firebase Admin initialized');

    // Initialize PubNub
    initPubNub();
    logPubNub('PubNub initialized');

    // Start Express server
    app.listen(PORT, () => logServer(`Server listening on port ${PORT}`));

    // Log all endpoints
    logEndpoints(app);
  } catch (err) {
    logServer(`Server startup failed: ${err.message}`, '\x1b[31m'); // red for errors
    process.exit(1);
  }
})();
