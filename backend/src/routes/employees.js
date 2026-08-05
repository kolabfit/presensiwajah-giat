const express = require('express');
const crypto = require('crypto');
const { Readable } = require('stream');
const router = express.Router();
const pool = require('../db/connection');
const { authMiddleware } = require('./admin');
const { uploadDataUrl, deleteAsset, CDN_BASE_URL, isLocalAssetId, localAssetUrl } = require('../services/cdn');
const { extractDescriptor } = require('../services/faceRecognition');

function createEmployeeQrCode() {
  return `GIAT-EMP-${crypto.randomUUID()}`;
}

function appBaseUrl(req) {
  return `${req.protocol}://${req.get('host')}`;
}

function employeePhotoViewUrl(req, fileId) {
  if (isLocalAssetId(fileId)) return `${appBaseUrl(req)}${localAssetUrl(fileId)}`;
  return fileId ? `${appBaseUrl(req)}/api/employees/photos/view/${encodeURIComponent(fileId)}` : '';
}

function cdnPhotoUrl(fileId) {
  return fileId ? `${CDN_BASE_URL}/api/bridge/view/${fileId}` : '';
}

function extractGoogleDriveId(url) {
  const raw = String(url || '');
  if (!raw.includes('drive.google.com')) return '';

  const idMatch = raw.match(/[?&]id=([^&]+)/);
  if (idMatch) return decodeURIComponent(idMatch[1]);

  const fileMatch = raw.match(/\/file\/d\/([^/]+)/);
  if (fileMatch) return decodeURIComponent(fileMatch[1]);

  return '';
}

function normalizeEmployeePhotoUrl(req, storedUrl, fileId) {
  if (fileId) return employeePhotoViewUrl(req, fileId);

  const url = String(storedUrl || '').trim();
  if (url.startsWith('/uploads/')) return `${appBaseUrl(req)}${url}`;

  const driveId = extractGoogleDriveId(url);
  if (driveId) {
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(driveId)}&sz=w1000`;
  }

  return url;
}

function extractAssetIdFromUrl(url) {
  const raw = String(url || '');
  const cdnMatch = raw.match(/\/api\/bridge\/view\/([^/?#]+)/);
  if (cdnMatch) return decodeURIComponent(cdnMatch[1]);

  const localMatch = raw.match(/\/uploads\/([^/?#]+)/);
  if (localMatch) return `local:${decodeURIComponent(localMatch[1])}`;

  return '';
}

function normalizeEmployeeRow(req, row) {
  return {
    ...row,
    face_registered: !!row.face_registered || Boolean(row.photo_file_id || row.photo_url),
    photo_url: normalizeEmployeePhotoUrl(req, row.photo_url, row.photo_file_id)
  };
}

async function extractRequiredFaceDescriptor(photoDataUrl) {
  const descriptor = await extractDescriptor(photoDataUrl);
  if (!descriptor) {
    const error = new Error('Wajah tidak terdeteksi pada foto pegawai. Pastikan wajah terlihat jelas, menghadap kamera, dan pencahayaan cukup.');
    error.statusCode = 400;
    throw error;
  }
  return descriptor;
}

async function insertEmployeeWithoutFace(name, status, qrCode) {
  try {
    await pool.query(
      `INSERT INTO employees (name, status, qr_code, face_registered)
       VALUES (?, ?, ?, FALSE)`,
      [name, status, qrCode]
    );
  } catch (error) {
    if (error.code !== 'ER_NO_DEFAULT_FOR_FIELD' || !String(error.sqlMessage || '').includes("'id'")) {
      throw error;
    }
    await pool.query(
      `INSERT INTO employees (id, name, status, qr_code, face_registered)
       VALUES (?, ?, ?, ?, FALSE)`,
      [crypto.randomUUID(), name, status, qrCode]
    );
  }
}

async function insertEmployeeWithFace(name, status, qrCode, photo, faceDescriptor) {
  try {
    await pool.query(
      `INSERT INTO employees (name, status, qr_code, photo_file_id, photo_url, face_registered, face_descriptor)
       VALUES (?, ?, ?, ?, ?, TRUE, ?)`,
      [name, status, qrCode, photo.fileId, photo.url, JSON.stringify(faceDescriptor)]
    );
  } catch (error) {
    if (error.code !== 'ER_NO_DEFAULT_FOR_FIELD' || !String(error.sqlMessage || '').includes("'id'")) {
      throw error;
    }
    await pool.query(
      `INSERT INTO employees (id, name, status, qr_code, photo_file_id, photo_url, face_registered, face_descriptor)
       VALUES (?, ?, ?, ?, ?, ?, TRUE, ?)`,
      [crypto.randomUUID(), name, status, qrCode, photo.fileId, photo.url, JSON.stringify(faceDescriptor)]
    );
  }
}

function inferImageMime(buffer, fallbackType) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'image/png';
  if (buffer.length >= 12 && buffer.slice(0, 4).toString() === 'RIFF' && buffer.slice(8, 12).toString() === 'WEBP') return 'image/webp';
  if (buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(buffer.slice(0, 6).toString())) return 'image/gif';
  if (String(fallbackType || '').startsWith('image/')) return fallbackType;
  return 'image/jpeg';
}

async function streamCdnPhoto(req, res, fileId, filenamePrefix = 'pegawai') {
  const controller = new AbortController();
  req.on('close', () => controller.abort());

  try {
    const upstream = await fetch(cdnPhotoUrl(fileId), {
      redirect: 'follow',
      signal: controller.signal
    });

    if (!upstream.ok) {
      return res.status(upstream.status).send('Foto pegawai tidak ditemukan');
    }

    const contentType = upstream.headers.get('content-type') || 'image/jpeg';
    const contentLength = upstream.headers.get('content-length');

    res.setHeader('Content-Type', contentType.startsWith('image/') ? contentType : 'image/jpeg');
    res.setHeader('Content-Disposition', `inline; filename="${filenamePrefix}-${fileId}"`);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    if (contentLength) res.setHeader('Content-Length', contentLength);

    if (!upstream.body) {
      const arrayBuffer = await upstream.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      res.setHeader('Content-Type', inferImageMime(buffer, contentType));
      return res.send(buffer);
    }

    const stream = Readable.fromWeb(upstream.body);
    stream.on('error', (error) => {
      if (error.name !== 'AbortError') {
        console.error('Error streaming employee photo:', error.message);
      }
      if (!res.destroyed) res.destroy(error);
    });
    return stream.pipe(res);
  } catch (error) {
    if (error.name === 'AbortError' || req.destroyed) return;
    console.error('Error proxying employee photo:', error);
    if (!res.headersSent) return res.status(500).send('Gagal memuat foto pegawai');
    return res.end();
  }
}

/**
 * GET /api/employees
 */
router.get('/', async (req, res) => {
  try {
    let rows;
    try {
      [rows] = await pool.query('SELECT id, name, status, qr_code, qr_file_id, qr_url, photo_file_id, photo_url, face_registered FROM employees ORDER BY name ASC');
    } catch (error) {
      if (error.code !== 'ER_BAD_FIELD_ERROR') throw error;
      [rows] = await pool.query('SELECT id, name, status, qr_code, qr_file_id, qr_url, photo_file_id, photo_url FROM employees ORDER BY name ASC');
    }
    res.json(rows.map(row => normalizeEmployeeRow(req, row)));
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * GET /api/employees/photos/view/:fileId
 * Proxy foto pegawai supaya browser menampilkan gambar, bukan download.
 */
router.get('/photos/view/:fileId', async (req, res) => {
  return streamCdnPhoto(req, res, req.params.fileId, 'pegawai');
});

/**
 * GET /api/employees/qr/:code
 * Ambil pegawai dari QR unik.
 */
router.get('/qr/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const [rows] = await pool.query(
      'SELECT name, status, qr_code, qr_file_id, qr_url, photo_file_id, photo_url FROM employees WHERE qr_code = ? LIMIT 1',
      [code]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'QR pegawai tidak ditemukan' });
    }

    if (rows[0].status !== 'AKTIF') {
      return res.status(400).json({ success: false, message: `Pegawai berstatus ${rows[0].status}` });
    }

    res.json({ success: true, employee: normalizeEmployeeRow(req, rows[0]) });
  } catch (error) {
    console.error('Error finding employee by QR:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * POST /api/employees/:name/qr-image
 * Simpan gambar QR berlogo ke CDN.
 */
router.post('/:name/qr-image', async (req, res) => {
  try {
    const { name } = req.params;
    const { qrDataUrl } = req.body;
    if (!qrDataUrl) {
      return res.status(400).json({ success: false, message: 'Data gambar QR wajib diisi' });
    }

    const [existing] = await pool.query('SELECT qr_file_id, qr_url FROM employees WHERE name = ? LIMIT 1', [name]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Pegawai tidak ditemukan' });
    }

    const qrAsset = await uploadDataUrl(qrDataUrl, `qr-${name}-${Date.now()}.png`);
    await pool.query('UPDATE employees SET qr_file_id = ?, qr_url = ? WHERE name = ?', [qrAsset.fileId, qrAsset.url, name]);

    const oldQrAssetId = existing[0]?.qr_file_id || extractAssetIdFromUrl(existing[0]?.qr_url);
    if (oldQrAssetId) {
      deleteAsset(oldQrAssetId).catch(err => console.error('Error deleting old QR image:', err.message));
    }

    res.json({ success: true, message: 'QR berhasil disimpan ke CDN', qr_file_id: qrAsset.fileId, qr_url: qrAsset.url });
  } catch (error) {
    console.error('Error saving QR image:', error);
    if (error.isCdnUploadError) {
      return res.status(503).json({ success: false, message: error.message, attempts: error.attempts });
    }
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
});

/**
 * POST /api/employees
 * Tambah pegawai baru
 */
router.post('/', async (req, res) => {
  try {
    const { name, status, photoDataUrl } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Nama wajib diisi' });
    }

    const qrCode = createEmployeeQrCode();
    const employeeName = name.toUpperCase();
    const employeeStatus = status || 'AKTIF';

    if (photoDataUrl) {
      const faceDescriptor = await extractRequiredFaceDescriptor(photoDataUrl);
      const photo = await uploadDataUrl(photoDataUrl, `pegawai-${Date.now()}.jpg`);
      await insertEmployeeWithFace(employeeName, employeeStatus, qrCode, photo, faceDescriptor);
      return res.json({ success: true, message: 'Pegawai berhasil ditambahkan dan wajah terdaftar', qr_code: qrCode, face_registered: true });
    }

    await insertEmployeeWithoutFace(employeeName, employeeStatus, qrCode);
    res.json({ success: true, message: 'Pegawai berhasil ditambahkan. Wajah bisa diregistrasi dari halaman user.', qr_code: qrCode, face_registered: false });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'Nama pegawai sudah ada' });
    }
    console.error('Error adding employee:', error);
    if (error.isCdnUploadError) {
      return res.status(503).json({ success: false, message: error.message, attempts: error.attempts });
    }
    res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Internal server error' });
  }
});

/**
 * PUT /api/employees/:name
 * Update status pegawai dan/atau foto profil.
 */
router.put('/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const { status, photoDataUrl } = req.body;
    if (!status && !photoDataUrl) {
      return res.status(400).json({ success: false, message: 'Tidak ada perubahan yang dikirim' });
    }

    const [existing] = await pool.query('SELECT status, photo_file_id, photo_url FROM employees WHERE name = ? LIMIT 1', [name]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Pegawai tidak ditemukan' });
    }

    const nextStatus = status || existing[0].status;

    if (photoDataUrl) {
      const faceDescriptor = await extractRequiredFaceDescriptor(photoDataUrl);
      const photo = await uploadDataUrl(photoDataUrl, `pegawai-${Date.now()}.jpg`);
      await pool.query(
        `UPDATE employees
         SET status = ?, photo_file_id = ?, photo_url = ?, face_registered = TRUE, face_descriptor = ?
         WHERE name = ?`,
        [nextStatus, photo.fileId, photo.url, JSON.stringify(faceDescriptor), name]
      );
      const oldPhotoAssetId = existing[0]?.photo_file_id || extractAssetIdFromUrl(existing[0]?.photo_url);
      if (oldPhotoAssetId) {
        deleteAsset(oldPhotoAssetId).catch(err => console.error('Error deleting old employee photo:', err.message));
      }
      return res.json({ success: true, message: 'Foto wajah pegawai berhasil diperbarui', photo_file_id: photo.fileId, photo_url: photo.url, face_registered: true });
    } else {
      await pool.query('UPDATE employees SET status = ? WHERE name = ?', [nextStatus, name]);
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating employee:', error);
    if (error.isCdnUploadError) {
      return res.status(503).json({ success: false, message: error.message, attempts: error.attempts });
    }
    res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Foto pegawai belum berhasil diperbarui. Silakan coba lagi.' });
  }
});

/**
 * DELETE /api/employees/:name
 * Hapus pegawai — data absensi TETAP tersimpan (tidak ikut terhapus)
 */
router.delete('/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const [attendance] = await pool.query('SELECT COUNT(*) as count FROM attendance WHERE name = ?', [name]);
    const hasAttendance = attendance[0].count > 0;
    const [employeeRows] = await pool.query('SELECT photo_file_id, photo_url, qr_file_id, qr_url FROM employees WHERE name = ? LIMIT 1', [name]);

    await pool.query('DELETE FROM employees WHERE name = ?', [name]);
    const photoAssetId = employeeRows[0]?.photo_file_id || extractAssetIdFromUrl(employeeRows[0]?.photo_url);
    if (photoAssetId) {
      deleteAsset(photoAssetId).catch(err => console.error('Error deleting employee photo:', err.message));
    }
    const qrAssetId = employeeRows[0]?.qr_file_id || extractAssetIdFromUrl(employeeRows[0]?.qr_url);
    if (qrAssetId) {
      deleteAsset(qrAssetId).catch(err => console.error('Error deleting employee QR:', err.message));
    }
    res.json({
      success: true,
      message: hasAttendance
        ? `Pegawai dihapus. ${attendance[0].count} data absensi tetap tersimpan di riwayat.`
        : 'Pegawai berhasil dihapus.'
    });
  } catch (error) {
    console.error('Error deleting employee:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * GET /api/employees/:id/locations
 * Mengambil daftar lokasi yang ditugaskan kepada pegawai (khusus admin).
 */
router.get('/:id/locations', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      `SELECT el.location_id, el.is_primary, l.name, l.address, l.is_active 
       FROM employee_locations el
       JOIN locations l ON el.location_id = l.id
       WHERE el.employee_id = ?`,
      [id]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching employee locations:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * PUT /api/employees/:id/locations
 * Memperbarui daftar lokasi yang ditugaskan kepada pegawai (khusus admin).
 */
router.put('/:id/locations', authMiddleware, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    const { locations } = req.body; // Array of { location_id, is_primary }
    
    if (!Array.isArray(locations)) {
      return res.status(400).json({ success: false, message: 'Format data lokasi tidak valid' });
    }

    await connection.beginTransaction();

    // Hapus semua penugasan lokasi saat ini
    await connection.query('DELETE FROM employee_locations WHERE employee_id = ?', [id]);

    // Insert penugasan lokasi baru
    if (locations.length > 0) {
      const values = locations.map(loc => [id, loc.location_id, loc.is_primary ? 1 : 0]);
      await connection.query(
        'INSERT INTO employee_locations (employee_id, location_id, is_primary) VALUES ?',
        [values]
      );
    }

    await connection.commit();
    res.json({ success: true, message: 'Lokasi penugasan pegawai berhasil diperbarui' });
  } catch (error) {
    await connection.rollback();
    console.error('Error updating employee locations:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    connection.release();
  }
});

module.exports = router;
