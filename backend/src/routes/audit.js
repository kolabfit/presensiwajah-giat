const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const { authMiddleware, superAdminMiddleware } = require('./admin');

const { logAudit } = require('../utils/auditLogger');

/**
 * SUPERADMIN: GET /api/audit
 * Get audit logs
 */
router.get('/', authMiddleware, superAdminMiddleware, async (req, res) => {
  try {
    const { module, action, search } = req.query;
    
    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    let queryParams = [];

    if (module && module !== 'ALL') {
      query += ' AND module = ?';
      queryParams.push(module);
    }

    if (action && action !== 'ALL') {
      query += ' AND action = ?';
      queryParams.push(action);
    }

    if (search) {
      query += ' AND (actor LIKE ? OR target LIKE ?)';
      const likeSearch = `%${search}%`;
      queryParams.push(likeSearch, likeSearch);
    }

    query += ' ORDER BY created_at DESC LIMIT 500';

    const [rows] = await pool.query(query, queryParams);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = {
  router,
  logAudit
};
