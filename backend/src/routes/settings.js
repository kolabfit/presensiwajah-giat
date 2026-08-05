const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const { runAttendanceCleanup } = require('../services/attendanceCleanup');

/**
 * GET /api/settings
 * Ambil semua settings sebagai key-value object
 */
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT `key`, value FROM app_settings');
    const settings = {};
    rows.forEach(r => {
      settings[r.key] = r.value;
    });
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * PUT /api/settings
 * Update satu atau lebih settings
 * Body: { "barcode_content": "KOPERASI GIAT", "late_threshold_minutes": "5" }
 */
router.put('/', async (req, res) => {
  try {
    const updates = req.body;
    for (const [key, value] of Object.entries(updates)) {
      await pool.query(
        'INSERT INTO app_settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?',
        [key, value, value]
      );
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * POST /api/settings/attendance-cleanup/run
 * Jalankan pembersihan data presensi lama secara manual.
 */
router.post('/attendance-cleanup/run', async (req, res) => {
  try {
    const { retentionDays } = req.body || {};
    const result = await runAttendanceCleanup({ force: true, retentionDays });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error running attendance cleanup:', error);
    res.status(500).json({
      success: false,
      message: 'Data lama belum berhasil dibersihkan. Silakan coba lagi.'
    });
  }
});

module.exports = router;
