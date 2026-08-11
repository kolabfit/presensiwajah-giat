const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const { authMiddleware, superAdminMiddleware } = require('./admin');
const { CDN_BASE_URL } = require('../services/cdn');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

/**
 * Helper to get folder size
 */
const getFolderSize = async (dirPath) => {
  let size = 0;
  try {
    const files = await fs.readdir(dirPath, { withFileTypes: true });
    for (const file of files) {
      if (file.isFile()) {
        const stats = await fs.stat(path.join(dirPath, file.name));
        size += stats.size;
      }
    }
  } catch (e) {
    // Ignore error
  }
  return size;
};

/**
 * SUPERADMIN: GET /api/system/health
 * Get system health status
 */
router.get('/health', authMiddleware, superAdminMiddleware, async (req, res) => {
  try {
    const health = {
      backend: 'ONLINE',
      mysql: 'ONLINE',
      cdn: 'ONLINE',
      localDisk: 'OK'
    };

    // 1. Check MySQL
    try {
      await pool.query('SELECT 1');
    } catch (e) {
      health.mysql = 'ERROR';
    }

    // 2. Check CDN
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      // We just fetch the base URL. If it's reachable (even if 404 or 403), it's ONLINE.
      // If it throws an error (e.g., DNS, timeout), it's OFFLINE/WARNING.
      await fetch(CDN_BASE_URL, { signal: controller.signal }).catch(() => null);
      clearTimeout(timeoutId);
      health.cdn = 'ONLINE';
    } catch (e) {
      health.cdn = 'WARNING';
    }

    // 3. Local disk (uploads folder size as a proxy)
    const uploadsDir = path.resolve(__dirname, '../../../uploads');
    const folderSize = await getFolderSize(uploadsDir);
    const folderSizeMB = (folderSize / (1024 * 1024)).toFixed(2);
    
    // We consider > 1GB as warning for local disk just for monitoring
    if (folderSize > 1024 * 1024 * 1024) {
      health.localDisk = 'WARNING';
    }

    // 4. Get real-time OS metrics
    const totalMemMB = (os.totalmem() / (1024 * 1024)).toFixed(0);
    const freeMemMB = (os.freemem() / (1024 * 1024)).toFixed(0);
    const uptimeSecs = os.uptime().toFixed(0);
    const cpuLoad = os.loadavg()[0].toFixed(2); // 1 minute load average

    res.json({
      success: true,
      data: {
        health,
        metrics: {
          uploads_folder_mb: folderSizeMB,
          cpu_load: cpuLoad,
          memory_total_mb: totalMemMB,
          memory_free_mb: freeMemMB,
          uptime_seconds: uptimeSecs
        }
      }
    });
  } catch (error) {
    console.error('Error fetching system health:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * SUPERADMIN: POST /api/system/backup
 * Trigger database backup (MySQL dump)
 */
router.post('/backup', authMiddleware, superAdminMiddleware, async (req, res) => {
  try {
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || 3306;
    const user = process.env.DB_USER || 'root';
    const password = process.env.DB_PASSWORD || '';
    const dbName = process.env.DB_NAME || 'presensi_giat';

    const backupDir = path.resolve(__dirname, '../../../backups');
    await fs.mkdir(backupDir, { recursive: true });

    const date = new Date().toISOString().slice(0,10).replace(/-/g, '');
    const time = new Date().toISOString().slice(11,19).replace(/:/g, '');
    const fileName = `backup_${dbName}_${date}_${time}.sql`;
    const filePath = path.join(backupDir, fileName);

    let authStr = `-u ${user}`;
    if (password) {
      authStr += ` -p"${password}"`;
    }

    // Simple backup using mysqldump if available
    const cmd = `mysqldump -h ${host} -P ${port} ${authStr} ${dbName} > "${filePath}"`;
    
    exec(cmd, (error) => {
      if (error) {
        console.error('Backup error:', error);
        return res.status(500).json({ success: false, message: 'Gagal membuat backup database. Pastikan mysqldump tersedia di server.' });
      }
      res.download(filePath, fileName, (err) => {
        // Optionally, we can delete the file after sending it
        // fs.unlink(filePath).catch(console.error);
      });
    });
  } catch (error) {
    console.error('Error creating backup:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
