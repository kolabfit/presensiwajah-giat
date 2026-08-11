const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const pool = require('../db/connection');
const { logAudit } = require('../utils/auditLogger');

// Simple token store (in production, use Redis or JWT)
const activeSessions = require('../utils/sessionStore');

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

    const [rows] = await pool.query('SELECT id, admin_id, password, role, is_active FROM admin_config WHERE admin_id = ? LIMIT 1', [id]);

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'ID atau Password salah' });
    }

    const admin = rows[0];
    if (password === admin.password) {
      if (!admin.is_active) {
        return res.status(403).json({ success: false, message: 'Akun Anda telah dinonaktifkan' });
      }

      // Update last login
      await pool.query('UPDATE admin_config SET last_login = NOW() WHERE id = ?', [admin.id]);

      const token = generateToken();
      activeSessions.set(token, { id: admin.admin_id, role: admin.role, createdAt: Date.now() });

      // Bersihkan session lama (> 24 jam)
      // Bersihkan session lama (> 24 jam)
      for (const [key, session] of activeSessions) {
        if (Date.now() - session.createdAt > 24 * 60 * 60 * 1000) {
          activeSessions.delete(key);
        }
      }

      await logAudit(admin.admin_id, admin.role, 'LOGIN', 'AUTHENTICATION', 'Admin System', null, null, req);

      return res.json({ success: true, token, role: admin.role });
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
  
  const session = activeSessions.get(token);
  req.admin = { id: session.id, role: session.role };
  next();
}

/**
 * Middleware: Hanya untuk Superadmin
 */
function superAdminMiddleware(req, res, next) {
  if (req.admin?.role !== 'SUPERADMIN') {
    return res.status(403).json({ success: false, message: 'Akses ditolak: Hanya Superadmin' });
  }
  next();
}

/**
 * POST /api/admin/update-password
 * Update konfigurasi admin (password saja untuk user yang sedang login)
 */
router.post('/update-password', authMiddleware, async (req, res) => {
  try {
    const { password } = req.body;
    const adminId = req.admin.id;

    if (!password) {
      return res.status(400).json({ success: false, message: 'Password wajib diisi' });
    }

    await pool.query(
      'UPDATE admin_config SET password = ? WHERE admin_id = ?',
      [password, adminId]
    );

    // Invalidate semua session user ini (opsional) atau semua session
    activeSessions.clear();

    await logAudit(adminId, req.admin.role, 'UPDATE_PASSWORD', 'ADMIN_ACCOUNT', adminId, null, null, req);

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
router.post('/logout', async (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (token && activeSessions.has(token)) {
    const session = activeSessions.get(token);
    await logAudit(session.id, session.role, 'LOGOUT', 'AUTHENTICATION', 'Admin System', null, null, req);
    activeSessions.delete(token);
  }
  res.json({ success: true });
});

/**
 * GET /api/admin/verify
 * Cek apakah token masih valid
 */
router.get('/verify', authMiddleware, (req, res) => {
  res.json({ success: true, role: req.admin.role });
});

// ==========================================
// SUPERADMIN ONLY ROUTES
// ==========================================

/**
 * GET /api/admin/accounts
 * Lihat daftar admin
 */
router.get('/accounts', authMiddleware, superAdminMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, admin_id, role, is_active, last_login, created_at FROM admin_config ORDER BY created_at DESC');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching admin accounts:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * POST /api/admin/accounts
 * Tambah admin baru
 */
router.post('/accounts', authMiddleware, superAdminMiddleware, async (req, res) => {
  try {
    const { admin_id, password, role } = req.body;
    if (!admin_id || !password || !role) {
      return res.status(400).json({ success: false, message: 'Data tidak lengkap' });
    }

    const [existing] = await pool.query('SELECT id FROM admin_config WHERE admin_id = ?', [admin_id]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Admin ID sudah digunakan' });
    }

    await pool.query(
      'INSERT INTO admin_config (admin_id, password, role, is_active) VALUES (?, ?, ?, TRUE)',
      [admin_id, password, role]
    );
    await logAudit(req.admin.id, req.admin.role, 'CREATE', 'ADMIN_ACCOUNT', admin_id, null, { role }, req);
    res.json({ success: true });
  } catch (error) {
    console.error('Error adding admin account:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * PUT /api/admin/accounts/:id
 * Edit admin (role, is_active)
 */
router.put('/accounts/:id', authMiddleware, superAdminMiddleware, async (req, res) => {
  try {
    const { role, is_active } = req.body;
    
    // Jangan izinkan mengubah diri sendiri menjadi tidak aktif atau menghilangkan akses superadmin
    const [currentUser] = await pool.query('SELECT id FROM admin_config WHERE admin_id = ?', [req.admin.id]);
    if (currentUser.length > 0 && currentUser[0].id == req.params.id) {
       if (is_active === false || role !== 'SUPERADMIN') {
         return res.status(400).json({ success: false, message: 'Anda tidak dapat mengubah status aktif atau menghapus hak Superadmin pada akun Anda sendiri' });
       }
    }

    const [targetAdmin] = await pool.query('SELECT admin_id, role, is_active FROM admin_config WHERE id = ?', [req.params.id]);

    await pool.query(
      'UPDATE admin_config SET role = ?, is_active = ? WHERE id = ?',
      [role, is_active, req.params.id]
    );
    await logAudit(req.admin.id, req.admin.role, 'UPDATE', 'ADMIN_ACCOUNT', targetAdmin[0]?.admin_id || req.params.id, targetAdmin[0], { role, is_active }, req);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating admin account:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * POST /api/admin/accounts/:id/reset-password
 * Reset password admin
 */
router.post('/accounts/:id/reset-password', authMiddleware, superAdminMiddleware, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ success: false, message: 'Password wajib diisi' });
    }
    
    const [targetAdmin] = await pool.query('SELECT admin_id FROM admin_config WHERE id = ?', [req.params.id]);
    await pool.query('UPDATE admin_config SET password = ? WHERE id = ?', [password, req.params.id]);
    await logAudit(req.admin.id, req.admin.role, 'RESET_PASSWORD', 'ADMIN_ACCOUNT', targetAdmin[0]?.admin_id || req.params.id, null, null, req);
    res.json({ success: true });
  } catch (error) {
    console.error('Error resetting admin password:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * DELETE /api/admin/accounts/:id
 * Hapus admin
 */
router.delete('/accounts/:id', authMiddleware, superAdminMiddleware, async (req, res) => {
  try {
    const [currentUser] = await pool.query('SELECT id FROM admin_config WHERE admin_id = ?', [req.admin.id]);
    if (currentUser.length > 0 && currentUser[0].id == req.params.id) {
       return res.status(400).json({ success: false, message: 'Anda tidak dapat menghapus akun Anda sendiri' });
    }

    const [targetAdmin] = await pool.query('SELECT admin_id FROM admin_config WHERE id = ?', [req.params.id]);
    await pool.query('DELETE FROM admin_config WHERE id = ?', [req.params.id]);
    await logAudit(req.admin.id, req.admin.role, 'DELETE', 'ADMIN_ACCOUNT', targetAdmin[0]?.admin_id || req.params.id, null, null, req);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting admin account:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Export middleware agar bisa dipakai di route lain
router.authMiddleware = authMiddleware;
router.superAdminMiddleware = superAdminMiddleware;

module.exports = router;
