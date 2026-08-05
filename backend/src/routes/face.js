const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const { uploadDataUrl, deleteAsset } = require('../services/cdn');
const { extractDescriptor } = require('../services/faceRecognition');

function parseDescriptor(value) {
  if (Array.isArray(value)) return value;
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch (_error) {
    return null;
  }
}

function averageDescriptors(descriptors) {
  const length = descriptors[0]?.length || 0;
  const avg = new Array(length).fill(0);

  descriptors.forEach((descriptor) => {
    for (let i = 0; i < length; i += 1) {
      avg[i] += Number(descriptor[i]);
    }
  });

  for (let i = 0; i < length; i += 1) {
    avg[i] /= descriptors.length;
  }

  return avg;
}

async function extractRequiredDescriptor(photoDataUrl, photoIndex) {
  const descriptor = await extractDescriptor(photoDataUrl);
  if (!descriptor) {
    const error = new Error(`Wajah tidak terdeteksi pada foto ${photoIndex}. Pastikan wajah terlihat jelas dan pencahayaan cukup.`);
    error.statusCode = 400;
    throw error;
  }
  return descriptor;
}

/**
 * POST /api/face/register
 * Daftarkan wajah pegawai dari beberapa foto pose.
 * Body: { employeeName: string, photos: string[] }
 */
router.post('/register', async (req, res) => {
  try {
    const { employeeName, photos } = req.body;
    const cleanName = String(employeeName || '').trim();

    if (!cleanName) {
      return res.status(400).json({ success: false, message: 'Pegawai wajib dipilih.' });
    }

    if (!Array.isArray(photos) || photos.length < 3) {
      return res.status(400).json({ success: false, message: 'Ambil 3 foto wajah terlebih dahulu.' });
    }

    const [existing] = await pool.query(
      'SELECT name, photo_file_id, photo_url, face_descriptor FROM employees WHERE name = ? LIMIT 1',
      [cleanName]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Pegawai tidak ditemukan.' });
    }

    const descriptors = [];
    for (let i = 0; i < photos.length; i += 1) {
      const descriptor = await extractRequiredDescriptor(photos[i], i + 1);
      descriptors.push(Array.from(descriptor));
    }

    const faceDescriptor = averageDescriptors(descriptors);
    const photo = await uploadDataUrl(photos[0], `wajah-${cleanName}-${Date.now()}.jpg`);

    await pool.query(
      `UPDATE employees
       SET photo_file_id = ?, photo_url = ?, face_registered = TRUE, face_descriptor = ?
       WHERE name = ?`,
      [photo.fileId, photo.url, JSON.stringify(faceDescriptor), cleanName]
    );

    const oldPhotoAssetId = existing[0]?.photo_file_id;
    if (oldPhotoAssetId && oldPhotoAssetId !== photo.fileId) {
      deleteAsset(oldPhotoAssetId).catch(err => console.error('Error deleting old face photo:', err.message));
    }

    res.json({
      success: true,
      message: 'Wajah pegawai berhasil diregistrasi.',
      data: {
        employeeName: cleanName,
        photo_file_id: photo.fileId,
        photo_url: photo.url,
        face_registered: true,
        descriptorSamples: descriptors.length,
        previousDescriptor: !!parseDescriptor(existing[0]?.face_descriptor)
      }
    });
  } catch (error) {
    console.error('Error registering face:', error);
    if (error.isCdnUploadError) {
      return res.status(503).json({ success: false, message: error.message, attempts: error.attempts });
    }
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Registrasi wajah belum berhasil. Silakan coba lagi.'
    });
  }
});

module.exports = router;
