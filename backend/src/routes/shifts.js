const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const pool = require('../db/connection');

async function ensureShiftColumns() {
  const columnDefs = [
    ['start_time', "VARCHAR(10) NOT NULL DEFAULT '08:00'"],
    ['end_time', "VARCHAR(10) NOT NULL DEFAULT '17:00'"],
    ['is_overtime', 'BOOLEAN DEFAULT FALSE']
  ];

  for (const [columnName, definition] of columnDefs) {
    try {
      await pool.query(`ALTER TABLE shifts ADD COLUMN ${columnName} ${definition}`);
    } catch (error) {
      if (error.code !== 'ER_DUP_FIELDNAME') throw error;
    }
  }
}

async function insertShift(name, startTime, endTime, isOvertime) {
  try {
    await pool.query(
      'INSERT INTO shifts (name, start_time, end_time, is_overtime) VALUES (?, ?, ?, ?)',
      [name, startTime, endTime, isOvertime ? 1 : 0]
    );
  } catch (error) {
    if (error.code !== 'ER_NO_DEFAULT_FOR_FIELD' || !String(error.sqlMessage || '').includes("'id'")) {
      throw error;
    }
    await pool.query(
      'INSERT INTO shifts (id, name, start_time, end_time, is_overtime) VALUES (?, ?, ?, ?, ?)',
      [crypto.randomUUID(), name, startTime, endTime, isOvertime ? 1 : 0]
    );
  }
}

/**
 * GET /api/shifts
 * Return: { "SHIFT NAME": { start_time, end_time, is_overtime }, ... }
 */
router.get('/', async (req, res) => {
  try {
    await ensureShiftColumns();
    const [rows] = await pool.query('SELECT name, start_time, end_time, is_overtime FROM shifts ORDER BY id ASC');
    const shiftsMap = {};
    rows.forEach(r => {
      shiftsMap[r.name] = {
        start_time: r.start_time,
        end_time: r.end_time,
        is_overtime: !!r.is_overtime
      };
    });
    res.json(shiftsMap);
  } catch (error) {
    console.error('Error fetching shifts:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * POST /api/shifts
 * Tambah shift baru
 */
router.post('/', async (req, res) => {
  try {
    const { name, start_time, end_time, is_overtime } = req.body;
    if (!name || !start_time || !end_time) {
      return res.status(400).json({ success: false, message: 'Nama, jam mulai, dan jam selesai wajib diisi' });
    }
    await ensureShiftColumns();
    await insertShift(name, start_time, end_time, is_overtime);
    res.json({ success: true, message: 'Shift berhasil ditambahkan' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'Shift sudah ada' });
    }
    console.error('Error adding shift:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * PUT /api/shifts/:name
 * Edit jam mulai, jam selesai, dan flag lembur shift
 */
router.put('/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const { start_time, end_time, is_overtime } = req.body;
    if (!start_time || !end_time) {
      return res.status(400).json({ success: false, message: 'Jam mulai dan jam selesai wajib diisi' });
    }
    await ensureShiftColumns();
    await pool.query(
      'UPDATE shifts SET start_time = ?, end_time = ?, is_overtime = ? WHERE name = ?',
      [start_time, end_time, is_overtime ? 1 : 0, name]
    );
    res.json({ success: true, message: 'Shift berhasil diperbarui' });
  } catch (error) {
    console.error('Error updating shift:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * DELETE /api/shifts/:name
 * Hapus shift — data absensi TETAP tersimpan
 */
router.delete('/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const [attendance] = await pool.query('SELECT COUNT(*) as count FROM attendance WHERE shift = ?', [name]);
    const hasAttendance = attendance[0].count > 0;

    await pool.query('DELETE FROM shifts WHERE name = ?', [name]);
    res.json({
      success: true,
      message: hasAttendance
        ? `Shift dihapus. ${attendance[0].count} data absensi tetap tersimpan di riwayat.`
        : 'Shift berhasil dihapus.'
    });
  } catch (error) {
    console.error('Error deleting shift:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
