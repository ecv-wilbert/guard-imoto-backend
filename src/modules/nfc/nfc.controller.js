import { linkNfcTag, unlinkNfcTag } from './nfc.service.js';
import { logAuth } from '../../utils/logger.js';

/**
 * POST /nfc/link
 * Body: { device_id, tag_uid }
 */
export async function linkTag(req, res, next) {
  try {
    const firebase_uid = req.user.uid;
    const { device_id, tag_uid } = req.body;

    if (!device_id || !tag_uid) {
      return res
        .status(400)
        .json({ success: false, message: 'device_id and tag_uid are required' });
    }

    const tag = await linkNfcTag(firebase_uid, device_id, tag_uid);

    logAuth(`NFC tag linked by user ${firebase_uid}: ${tag.id}`);

    return res.json({ success: true, tag });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /nfc/unlink
 * Body: { tag_uid }
 */
export async function unlinkTag(req, res, next) {
  try {
    const firebase_uid = req.user.uid;
    const { tag_uid } = req.body;

    if (!tag_uid) {
      return res.status(400).json({ success: false, message: 'tag_uid is required' });
    }

    const tag = await unlinkNfcTag(firebase_uid, tag_uid);

    logAuth(`NFC tag unlinked by user ${firebase_uid}: ${tag.id}`);

    return res.json({ success: true, tag });
  } catch (err) {
    next(err);
  }
}

/**
 * Verify a tag scanned by the device
 */
export async function verifyDeviceTag(req, res, next) {
  try {
    const device = req.device;
    const { tag_uid } = req.body;

    if (!tag_uid) return res.status(400).json({ error: 'Missing tag_uid' });

    const result = await verifyTag({ device_id: device.id, tag_uid });
    res.json(result);
  } catch (err) {
    next(err);
  }
}
