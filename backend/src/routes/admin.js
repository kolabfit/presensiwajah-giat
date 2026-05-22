const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const pool = require('../db/connection');

// Simple token store (in production, use Redis or JWT)
const activeSessions = new Map();

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * POST /api/admin/login
 * Validasi kredensial admin di server, return token jika berhasil
 */
router.post('/login', async (req, res) => {
  try {
    const { id, password } = req.body;

    if (!id || !password) {
      return res.status(400).json({ success: false, message: 'ID dan password wajib diisi' });
    }

    const [rows] = await pool.query('SELECT admin_id, password FROM admin_config LIMIT 1');

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'ID atau Password salah' });
    }

    const admin = rows[0];
    if (id === admin.admin_id && password === admin.password) {
      const token = generateToken();
      activeSessions.set(token, { id: admin.admin_id, createdAt: Date.now() });

      // Bersihkan session lama (> 24 jam)
      for (const [key, session] of activeSessions) {
        if (Date.now() - session.createdAt > 24 * 60 * 60 * 1000) {
          activeSessions.delete(key);
        }
      }

      return res.json({ success: true, token });
    } else {
      return res.status(401).json({ success: false, message: 'ID atau Password salah' });
    }
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * Middleware: Verifikasi token admin
 */
function authMiddleware(req, res, next) {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token || !activeSessions.has(token)) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  next();
}

/**
 * POST /api/admin/update-password
 * Update konfigurasi admin (id & password) — butuh auth
 */
router.post('/update-password', authMiddleware, async (req, res) => {
  try {
    const { id, password } = req.body;

    if (!id || !password) {
      return res.status(400).json({ success: false, message: 'ID dan password wajib diisi' });
    }

    const [existing] = await pool.query('SELECT id FROM admin_config LIMIT 1');

    if (existing.length > 0) {
      await pool.query(
        'UPDATE admin_config SET admin_id = ?, password = ? WHERE id = ?',
        [id, password, existing[0].id]
      );
    } else {
      await pool.query(
        'INSERT INTO admin_config (admin_id, password) VALUES (?, ?)',
        [id, password]
      );
    }

    // Invalidate semua session setelah ganti password
    activeSessions.clear();

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating admin config:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * POST /api/admin/logout
 * Hapus session
 */
router.post('/logout', (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (token) {
    activeSessions.delete(token);
  }
  res.json({ success: true });
});

/**
 * GET /api/admin/verify
 * Cek apakah token masih valid
 */
router.get('/verify', authMiddleware, (req, res) => {
  res.json({ success: true });
});

// Export middleware agar bisa dipakai di route lain
router.authMiddleware = authMiddleware;

module.exports = router;
