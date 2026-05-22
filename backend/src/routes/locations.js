const express = require('express');
const router = express.Router();
const pool = require('../db/connection');

/**
 * GET /api/locations
 */
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT name FROM locations ORDER BY name ASC');
    res.json(rows.map(r => r.name));
  } catch (error) {
    console.error('Error fetching locations:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * POST /api/locations
 * Tambah lokasi baru
 */
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Nama lokasi wajib diisi' });
    }
    await pool.query('INSERT INTO locations (name) VALUES (?)', [name.toUpperCase()]);
    res.json({ success: true, message: 'Lokasi berhasil ditambahkan' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'Lokasi sudah ada' });
    }
    console.error('Error adding location:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * DELETE /api/locations/:name
 * Hapus lokasi — data absensi TETAP tersimpan
 */
router.delete('/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const [attendance] = await pool.query('SELECT COUNT(*) as count FROM attendance WHERE location = ?', [name]);
    const hasAttendance = attendance[0].count > 0;

    await pool.query('DELETE FROM locations WHERE name = ?', [name]);
    res.json({
      success: true,
      message: hasAttendance
        ? `Lokasi dihapus. ${attendance[0].count} data absensi tetap tersimpan di riwayat.`
        : 'Lokasi berhasil dihapus.'
    });
  } catch (error) {
    console.error('Error deleting location:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
