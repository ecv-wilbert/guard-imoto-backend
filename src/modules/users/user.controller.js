import { getUserByUid, updateUser } from './user.service.js';
import { logAuth } from '../../utils/logger.js';

/**
 * GET /users/me
 * Assumes authMiddleware has already run and set req.user
 */
export async function getProfile(req, res, next) {
  try {
    const user = await getUserByUid(req.user.uid);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /users/me
 * body: { first_name, last_name, phone }
 * Assumes authMiddleware has already run and set req.user
 */
export async function updateProfile(req, res, next) {
  try {
    const updates = req.body;

    const user = await updateUser(req.user.uid, updates, req.user.uid);

    logAuth(`User profile updated: ${user.id}`);
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
}
