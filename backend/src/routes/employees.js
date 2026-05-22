const express = require('express');
const router = express.Router();
const pool = require('../db/connection');

/**
 * GET /api/employees
 */
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT name, status FROM employees ORDER BY name ASC');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * POST /api/employees
 * Tambah pegawai baru
 */
router.post('/', async (req, res) => {
  try {
    const { name, status } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Nama wajib diisi' });
    }
    await pool.query(
      'INSERT INTO employees (name, status) VALUES (?, ?)',
      [name.toUpperCase(), status || 'AKTIF']
    );
    res.json({ success: true, message: 'Pegawai berhasil ditambahkan' });
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
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: 'Status wajib diisi' });
    }
    await pool.query('UPDATE employees SET status = ? WHERE name = ?', [status, name]);
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

    await pool.query('DELETE FROM employees WHERE name = ?', [name]);
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
