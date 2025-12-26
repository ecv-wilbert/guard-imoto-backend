import { query } from '../../config/db.js';
import { createAuditLog } from '../audit/audit.service.js';

/**
 * Register a user using Firebase ID token
 * @param {string} idToken - Firebase ID token from client
 * @param {Object} profile - additional user details
 * @param {string} profile.first_name
 * @param {string} profile.last_name
 * @param {string} profile.phone
 */
export async function registerUser(firebase_uid, firebase_email, { first_name, last_name, phone }) {
  try {
    const { rows } = await query(`SELECT * FROM users WHERE firebase_uid = $1`, [firebase_uid]);

    if (rows.length) throw new Error('User already exists');

    const insertRes = await query(
      `INSERT INTO users (firebase_uid, first_name, last_name, email, phone, photo_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        firebase_uid,
        first_name,
        last_name,
        firebase_email, // email optional, can read from req.user.email if passed
        phone,
        null, // photo_url optional
      ]
    );

    const newUser = insertRes.rows[0];

    await createAuditLog({
      actor_type: 'user',
      actor_id: firebase_uid,
      action: 'registered',
      target_type: 'user',
      target_id: newUser.id,
      metadata: { first_name, last_name, phone },
    });

    return newUser;
  } catch (err) {
    throw err;
  }
}
