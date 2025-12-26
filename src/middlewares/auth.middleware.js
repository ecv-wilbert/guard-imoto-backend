import { initFirebase } from '../config/firebase-admin.js';
const admin = initFirebase();

export async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing or invalid auth token' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = await admin.auth().verifyIdToken(token);

    req.user = decoded;

    next();
  } catch (err) {
    console.error('[AUTH] Firebase auth failed', err);
    return res.status(403).json({ status: false, message: 'Unauthorized' });
  }
}
