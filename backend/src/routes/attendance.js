const express = require('express');
const router = express.Router();
const pool = require('../db/connection');

/**
 * GET /api/attendance
 * Ambil semua riwayat presensi
 */
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM attendance ORDER BY date DESC, timestamp DESC'
    );

    // Format response sesuai dengan yang diharapkan frontend
    const data = rows.map(row => ({
      Timestamp: row.timestamp,
      Date: row.date || '',  // sudah string YYYY-MM-DD karena dateStrings: true
      Name: row.name,
      Location: row.location,
      Shift: row.shift,
      TimeIn: row.time_in || '',
      TimeOut: row.time_out || '',
      Status: row.status,
      Note: row.note || ''
    }));

    res.json(data);
  } catch (error) {
    console.error('Error fetching attendance:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * POST /api/attendance
 * Simpan presensi (masuk atau pulang)
 */
router.post('/', async (req, res) => {
  try {
    const { data } = req.body;

    if (!data) {
      return res.status(400).json({ success: false, message: 'Data tidak boleh kosong' });
    }

    const todayStr = data.Date;

    // Cari record yang sudah ada untuk nama & tanggal yang sama
    const [existing] = await pool.query(
      'SELECT id, time_in, time_out FROM attendance WHERE name = ? AND date = ?',
      [data.Name, todayStr]
    );

    // --- LOGIKA PULANG (UPDATE TIME_OUT) ---
    if (data.TimeOut) {
      if (existing.length > 0) {
        await pool.query(
          'UPDATE attendance SET time_out = ? WHERE id = ?',
          [data.TimeOut, existing[0].id]
        );
        return res.json({ success: true, message: 'Presensi Pulang Berhasil' });
      } else {
        return res.json({ success: false, message: 'Data Masuk tidak ditemukan untuk hari ini' });
      }
    }

    // --- LOGIKA MASUK (INSERT NEW ROW) ---
    else {
      // Validasi: Jangan izinkan double check-in di hari yang sama
      if (existing.length > 0) {
        return res.json({ success: false, message: 'Anda sudah melakukan Presensi Masuk hari ini' });
      }

      await pool.query(
        `INSERT INTO attendance (date, name, location, shift, time_in, time_out, status, note)
         VALUES (?, ?, ?, ?, ?, '', ?, ?)`,
        [
          data.Date,
          data.Name,
          data.Location,
          data.Shift,
          data.TimeIn,
          data.Status,
          data.Note || ''
        ]
      );

      return res.json({ success: true, message: 'Presensi Masuk Berhasil' });
    }
  } catch (error) {
    console.error('Error saving attendance:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * Helper: Format date dari MySQL ke yyyy-MM-dd
 */
function formatDate(date) {
  if (date instanceof Date) {
    // Pakai local timezone, bukan UTC
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(date).split('T')[0];
}

module.exports = router;
