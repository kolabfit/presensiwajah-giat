const pool = require('../db/connection');
const activeSessions = require('./sessionStore');

// Cache simple to avoid querying DB on every request
let isMaintenanceMode = false;
let lastCheckTime = 0;
const CACHE_TTL_MS = 10000; // 10 seconds

const maintenanceMiddleware = async (req, res, next) => {
  try {
    const now = Date.now();
    if (now - lastCheckTime > CACHE_TTL_MS) {
      const [rows] = await pool.query("SELECT value FROM app_settings WHERE `key` = 'maintenance_mode'");
      isMaintenanceMode = rows.length > 0 && rows[0].value === 'true';
      lastCheckTime = now;
    }

    if (!isMaintenanceMode) {
      return next();
    }

    // --- Maintenance Mode is ON ---

    // 1. Always allow login, settings, and photo proxy routes
    //    - /api/admin/login: so superadmins can log in
    //    - /api/settings: so the toggle switch can read/write maintenance_mode
    //    - /photos/view/: photo proxy routes (img tags don't carry auth headers)
    const alwaysAllowPaths = ['/api/admin/login', '/api/settings'];
    const isAlwaysAllowed = alwaysAllowPaths.some(p => req.path.startsWith(p));
    const isPhotoProxy = req.path.includes('/photos/view/');
    if (isAlwaysAllowed || isPhotoProxy) {
      return next();
    }

    // 2. Check if the request comes from an authenticated SUPERADMIN
    const token = req.headers['authorization']?.replace('Bearer ', '');
    const session = token ? activeSessions.get(token) : null;
    const isSuperAdmin = session && session.role === 'SUPERADMIN';

    // 3. Bypass everything for SUPERADMIN
    if (isSuperAdmin) {
      return next();
    }

    // Block everyone else
    return res.status(503).json({
      success: false,
      isMaintenance: true,
      message: 'Sistem sedang dalam perbaikan rutin (Maintenance Mode). Silakan coba beberapa saat lagi.'
    });

  } catch (error) {
    console.error('Error in maintenance middleware:', error);
    next(); // Fallback: let the request through if DB check fails
  }
};

module.exports = { maintenanceMiddleware };
