const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const pool = require('../db/connection');
const { authMiddleware } = require('./admin');
const { validateGeofence } = require('../utils/geofence');

// POST /api/locations/resolve (Public, for Geolocation resolve before face check)
router.post('/resolve', async (req, res) => {
  try {
    const { latitude, longitude, accuracy } = req.body;
    if (latitude == null || longitude == null) {
      return res.status(400).json({ success: false, message: 'Koordinat GPS wajib dikirim' });
    }

    const [locations] = await pool.query('SELECT * FROM locations WHERE is_active = TRUE');
    if (locations.length === 0) {
      return res.status(404).json({ success: false, message: 'Tidak ada lokasi aktif di server.' });
    }

    let nearestLocation = null;
    let minDistance = Infinity;
    let resolveResult = null;

    for (const loc of locations) {
      const result = validateGeofence(latitude, longitude, accuracy, loc);
      if (result.distance !== null && result.distance < minDistance) {
        minDistance = result.distance;
        nearestLocation = loc;
        resolveResult = result;
      }
    }

    if (!nearestLocation) {
      return res.status(400).json({ success: false, message: 'Gagal menghitung jarak lokasi.' });
    }

    res.json({
      success: true,
      location: {
        id: nearestLocation.id,
        name: nearestLocation.name,
        radius_meter: nearestLocation.radius_meter
      },
      distance: minDistance,
      accuracy,
      valid: resolveResult.valid,
      reason: resolveResult.reason
    });
  } catch (error) {
    console.error('Error resolving location:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /api/locations (Public, for legacy or non-admin use if needed)
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT name FROM locations WHERE is_active = TRUE ORDER BY name ASC');
    res.json(rows.map(r => r.name));
  } catch (error) {
    console.error('Error fetching locations:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /api/locations/admin (Admin only)
router.get('/admin', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM locations ORDER BY name ASC');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching admin locations:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /api/locations (Admin only)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, address, place_id, latitude, longitude, radius_meter, max_accuracy_meter, is_active } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Nama lokasi wajib diisi' });
    
    await pool.query(
      `INSERT INTO locations (name, address, place_id, latitude, longitude, radius_meter, max_accuracy_meter, is_active) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name.toUpperCase(), address, place_id, latitude, longitude, radius_meter || 100, max_accuracy_meter || 50, is_active !== false]
    );
    res.json({ success: true, message: 'Lokasi berhasil ditambahkan' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'Lokasi sudah ada' });
    }
    console.error('Error adding location:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// PUT /api/locations/:id (Admin only)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { name, address, place_id, latitude, longitude, radius_meter, max_accuracy_meter, is_active } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Nama lokasi wajib diisi' });

    await pool.query(
      `UPDATE locations SET name = ?, address = ?, place_id = ?, latitude = ?, longitude = ?, radius_meter = ?, max_accuracy_meter = ?, is_active = ? WHERE id = ?`,
      [name.toUpperCase(), address, place_id, latitude, longitude, radius_meter || 100, max_accuracy_meter || 50, is_active !== false, req.params.id]
    );
    res.json({ success: true, message: 'Lokasi berhasil diperbarui' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'Nama lokasi sudah digunakan' });
    }
    console.error('Error updating location:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// DELETE /api/locations/:id (Admin only)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const [locs] = await pool.query('SELECT name FROM locations WHERE id = ?', [id]);
    if (locs.length === 0) return res.status(404).json({ success: false, message: 'Lokasi tidak ditemukan' });
    
    const name = locs[0].name;
    const [attendance] = await pool.query('SELECT COUNT(*) as count FROM attendance WHERE location = ?', [name]);
    const hasAttendance = attendance[0].count > 0;

    await pool.query('DELETE FROM locations WHERE id = ?', [id]);
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
