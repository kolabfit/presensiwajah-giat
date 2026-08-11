const pool = require('../db/connection');

const logAudit = async (actor, role, action, module, target, old_value, new_value, req) => {
  try {
    const ip_address = req?.ip || req?.connection?.remoteAddress || null;
    const user_agent = req?.headers['user-agent'] || null;

    await pool.query(
      `INSERT INTO audit_logs (actor, role, action, module, target, old_value, new_value, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        actor, 
        role, 
        action, 
        module, 
        target, 
        old_value ? JSON.stringify(old_value) : null,
        new_value ? JSON.stringify(new_value) : null,
        ip_address,
        user_agent
      ]
    );
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
};

module.exports = { logAudit };
