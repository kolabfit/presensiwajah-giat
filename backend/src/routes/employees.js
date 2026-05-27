const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const pool = require('../db/connection');
const { uploadDataUrl, deleteAsset } = require('../services/cdn');

function createEmployeeQrCode() {
  return `GIAT-EMP-${crypto.randomUUID()}`;
}

/**
 * GET /api/employees
 */
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT name, status, qr_code, qr_file_id, qr_url, photo_file_id, photo_url FROM employees ORDER BY name ASC');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
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

    res.json({ success: true, employee: rows[0] });
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

    const [existing] = await pool.query('SELECT qr_file_id FROM employees WHERE name = ? LIMIT 1', [name]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Pegawai tidak ditemukan' });
    }

    const qrAsset = await uploadDataUrl(qrDataUrl, `qr-${name}-${Date.now()}.png`);
    await pool.query('UPDATE employees SET qr_file_id = ?, qr_url = ? WHERE name = ?', [qrAsset.fileId, qrAsset.url, name]);

    if (existing[0]?.qr_file_id) {
      deleteAsset(existing[0].qr_file_id).catch(err => console.error('Error deleting old QR image:', err.message));
    }

    res.json({ success: true, message: 'QR berhasil disimpan ke CDN', qr_file_id: qrAsset.fileId, qr_url: qrAsset.url });
  } catch (error) {
    console.error('Error saving QR image:', error);
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

    let photo = { fileId: null, url: null };
    if (photoDataUrl) {
      photo = await uploadDataUrl(photoDataUrl, `pegawai-${Date.now()}.jpg`);
    }

    const qrCode = createEmployeeQrCode();
    await pool.query(
      'INSERT INTO employees (name, status, qr_code, photo_file_id, photo_url) VALUES (?, ?, ?, ?, ?)',
      [name.toUpperCase(), status || 'AKTIF', qrCode, photo.fileId, photo.url]
    );
    res.json({ success: true, message: 'Pegawai berhasil ditambahkan', qr_code: qrCode });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'Nama pegawai sudah ada' });
    }
    console.error('Error adding employee:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * PUT /api/employees/:name
 * Update status pegawai (AKTIF, CUTI, NONAKTIF)
 */
router.put('/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const { status, photoDataUrl } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: 'Status wajib diisi' });
    }

    if (photoDataUrl) {
      const [existing] = await pool.query('SELECT photo_file_id FROM employees WHERE name = ? LIMIT 1', [name]);
      const photo = await uploadDataUrl(photoDataUrl, `pegawai-${Date.now()}.jpg`);
      await pool.query('UPDATE employees SET status = ?, photo_file_id = ?, photo_url = ? WHERE name = ?', [status, photo.fileId, photo.url, name]);
      if (existing[0]?.photo_file_id) {
        deleteAsset(existing[0].photo_file_id).catch(err => console.error('Error deleting old employee photo:', err.message));
      }
    } else {
      await pool.query('UPDATE employees SET status = ? WHERE name = ?', [status, name]);
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating employee:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
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
    const [employeeRows] = await pool.query('SELECT photo_file_id, qr_file_id FROM employees WHERE name = ? LIMIT 1', [name]);

    await pool.query('DELETE FROM employees WHERE name = ?', [name]);
    if (employeeRows[0]?.photo_file_id) {
      deleteAsset(employeeRows[0].photo_file_id).catch(err => console.error('Error deleting employee photo:', err.message));
    }
    if (employeeRows[0]?.qr_file_id) {
      deleteAsset(employeeRows[0].qr_file_id).catch(err => console.error('Error deleting employee QR:', err.message));
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

module.exports = router;
