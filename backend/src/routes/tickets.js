const express = require('express');
const { Readable } = require('stream');
const router = express.Router();
const pool = require('../db/connection');
const { uploadDataUrl, CDN_BASE_URL, isLocalAssetId, localAssetUrl } = require('../services/cdn');
const { authMiddleware, superAdminMiddleware } = require('./admin');
const { logAudit } = require('../utils/auditLogger');

function appBaseUrl(req) {
  return `${req.protocol}://${req.get('host')}`;
}

/**
 * Convert a stored URL (CDN or local) to a proxied URL that the browser can load.
 * CDN URLs require auth headers — browsers can't do that with <img src>, so we proxy.
 */
function toProxyUrl(req, url, fileId) {
  if (!url && !fileId) return null;
  // Local assets already served via /uploads
  if (fileId && isLocalAssetId(fileId)) {
    return `${appBaseUrl(req)}${localAssetUrl(fileId)}`;
  }
  // If we have a fileId, use our proxy route
  if (fileId) {
    return `${appBaseUrl(req)}/api/tickets/photos/view/${encodeURIComponent(fileId)}`;
  }
  // If only URL (legacy), extract fileId from CDN URL pattern
  if (url && url.includes('/api/bridge/view/')) {
    const extractedId = url.split('/api/bridge/view/')[1];
    if (extractedId) {
      return `${appBaseUrl(req)}/api/tickets/photos/view/${encodeURIComponent(extractedId)}`;
    }
  }
  // Fallback: return as-is (could be a full external URL)
  return url || null;
}

// Utility to generate ticket number
const generateTicketNumber = () => {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `GIAT-ERR-${dateStr}-${randomNum}`;
};

// Utility to resolve employee_id from name (Best effort)
const tryResolveEmployee = async (name) => {
  if (!name) return null;
  const [rows] = await pool.query('SELECT id FROM employees WHERE name LIKE ? LIMIT 1', [`%${name}%`]);
  return rows.length > 0 ? rows[0].id : null;
};

/**
 * PUBLIC: POST /api/tickets
 * Create a new helpdesk ticket
 */
router.post('/', async (req, res) => {
  try {
    const {
      reporter_name,
      category,
      title,
      description,
      screenshot_data_url,
      browser,
      operating_system,
      device,
      ip_address,
      page_url,
      api_endpoint,
      http_status,
      error_code,
      error_message,
      gps_accuracy,
      location_name
    } = req.body;

    if (!reporter_name || !category || !title || !description) {
      return res.status(400).json({ success: false, message: 'Data pelapor, kategori, judul, dan deskripsi wajib diisi' });
    }

    const ticket_number = generateTicketNumber();
    const employee_id = await tryResolveEmployee(reporter_name);

    let screenshot_file_id = null;
    let screenshot_url = null;

    if (screenshot_data_url) {
      const fileName = `ticket-${ticket_number}.jpg`;
      const uploadResult = await uploadDataUrl(screenshot_data_url, fileName, { localFallback: true });
      screenshot_file_id = uploadResult.fileId;
      screenshot_url = uploadResult.url;
    }

    const [result] = await pool.query(
      `INSERT INTO tickets (
        ticket_number, employee_id, reporter_name, category, title, description,
        screenshot_file_id, screenshot_url, browser, operating_system, device, ip_address,
        page_url, api_endpoint, http_status, error_code, error_message, gps_accuracy, location_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ticket_number, employee_id, reporter_name, category, title, description,
        screenshot_file_id, screenshot_url, browser, operating_system, device, ip_address,
        page_url, api_endpoint, http_status, error_code, error_message, gps_accuracy, location_name
      ]
    );

    await logAudit(reporter_name, 'REPORTER', 'CREATE', 'HELPDESK', ticket_number, null, { title, category }, req);

    res.json({
      success: true,
      message: 'Laporan berhasil dikirim',
      ticket_number,
      id: result.insertId
    });
  } catch (error) {
    console.error('Error creating ticket:', error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan saat mengirim laporan.' });
  }
});

/**
 * PUBLIC: GET /api/tickets/status/:ticket_number
 * Check ticket status (requires reporter_name to match)
 */
router.get('/status/:ticket_number', async (req, res) => {
  try {
    const { ticket_number } = req.params;
    const { reporter_name } = req.query;

    if (!reporter_name) {
      return res.status(400).json({ success: false, message: 'Nama pelapor wajib diisi' });
    }

    const [tickets] = await pool.query(
      'SELECT id, ticket_number, reporter_name, category, title, description, priority, status, screenshot_file_id, screenshot_url, created_at, resolved_at FROM tickets WHERE ticket_number = ?',
      [ticket_number]
    );

    if (tickets.length === 0) {
      return res.status(404).json({ success: false, message: 'Tiket tidak ditemukan' });
    }

    const ticket = tickets[0];
    if (ticket.reporter_name.toLowerCase() !== reporter_name.toLowerCase()) {
      return res.status(403).json({ success: false, message: 'Nama pelapor tidak cocok dengan tiket ini' });
    }

    const [messages] = await pool.query(
      'SELECT id, sender_type, message, attachment_file_id, attachment_url, created_at FROM ticket_messages WHERE ticket_id = ? ORDER BY created_at ASC',
      [ticket.id]
    );

    ticket.screenshot_url = toProxyUrl(req, ticket.screenshot_url, ticket.screenshot_file_id);
    const normalizedMessages = messages.map(m => ({
      ...m,
      attachment_url: toProxyUrl(req, m.attachment_url, m.attachment_file_id)
    }));

    res.json({ success: true, ticket, messages: normalizedMessages });
  } catch (error) {
    console.error('Error fetching ticket status:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * PUBLIC: POST /api/tickets/status/:ticket_number/reply
 * Add a reply from reporter
 */
router.post('/status/:ticket_number/reply', async (req, res) => {
  try {
    const { ticket_number } = req.params;
    const { reporter_name, message, attachment_data_url } = req.body;

    if (!reporter_name || !message) {
      return res.status(400).json({ success: false, message: 'Nama pelapor dan pesan wajib diisi' });
    }

    const [tickets] = await pool.query('SELECT id, reporter_name FROM tickets WHERE ticket_number = ?', [ticket_number]);
    
    if (tickets.length === 0) {
      return res.status(404).json({ success: false, message: 'Tiket tidak ditemukan' });
    }
    const ticket = tickets[0];
    if (ticket.reporter_name.toLowerCase() !== reporter_name.toLowerCase()) {
      return res.status(403).json({ success: false, message: 'Akses ditolak' });
    }

    let attachment_file_id = null;
    let attachment_url = null;

    if (attachment_data_url) {
      const fileName = `reply-${ticket_number}-${Date.now()}.jpg`;
      const uploadResult = await uploadDataUrl(attachment_data_url, fileName, { localFallback: true });
      attachment_file_id = uploadResult.fileId;
      attachment_url = uploadResult.url;
    }

    await pool.query(
      'INSERT INTO ticket_messages (ticket_id, sender_type, message, attachment_file_id, attachment_url) VALUES (?, ?, ?, ?, ?)',
      [ticket.id, 'REPORTER', message, attachment_file_id, attachment_url]
    );

    // If waiting for reporter, update status back to IN_PROGRESS
    await pool.query(
      "UPDATE tickets SET status = 'IN_PROGRESS', updated_at = NOW() WHERE id = ? AND status = 'WAITING_REPORTER'",
      [ticket.id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error replying to ticket:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});


// ==========================================
// SUPERADMIN ROUTES
// ==========================================

/**
 * SUPERADMIN: GET /api/tickets/admin
 * Get all tickets (Helpdesk Dashboard)
 */
router.get('/admin', authMiddleware, superAdminMiddleware, async (req, res) => {
  try {
    const { status, priority, search } = req.query;
    
    let query = 'SELECT id, ticket_number, reporter_name, category, title, priority, status, created_at FROM tickets WHERE 1=1';
    let queryParams = [];

    if (status && status !== 'ALL') {
      query += ' AND status = ?';
      queryParams.push(status);
    }
    
    if (priority && priority !== 'ALL') {
      query += ' AND priority = ?';
      queryParams.push(priority);
    }

    if (search) {
      query += ' AND (ticket_number LIKE ? OR reporter_name LIKE ? OR title LIKE ?)';
      const likeSearch = `%${search}%`;
      queryParams.push(likeSearch, likeSearch, likeSearch);
    }

    query += ' ORDER BY created_at DESC';

    const [rows] = await pool.query(query, queryParams);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching admin tickets:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * SUPERADMIN: GET /api/tickets/admin/:id
 * Get single ticket details
 */
router.get('/admin/:id', authMiddleware, superAdminMiddleware, async (req, res) => {
  try {
    const [tickets] = await pool.query('SELECT * FROM tickets WHERE id = ?', [req.params.id]);
    if (tickets.length === 0) return res.status(404).json({ success: false, message: 'Tiket tidak ditemukan' });

    const ticket = tickets[0];
    const [messages] = await pool.query(
      'SELECT id, sender_type, sender_user_id, message, attachment_url, created_at FROM ticket_messages WHERE ticket_id = ? ORDER BY created_at ASC',
      [ticket.id]
    );

    // Find employee info if linked
    let employeeInfo = null;
    if (ticket.employee_id) {
      const [emp] = await pool.query('SELECT name, status, photo_url FROM employees WHERE id = ?', [ticket.employee_id]);
      if (emp.length > 0) employeeInfo = emp[0];
    }

    // Normalize ticket URLs for browser rendering
    ticket.screenshot_url = toProxyUrl(req, ticket.screenshot_url, ticket.screenshot_file_id);
    const normalizedMessages = messages.map(m => ({
      ...m,
      attachment_url: toProxyUrl(req, m.attachment_url, m.attachment_file_id)
    }));

    res.json({ success: true, ticket, messages: normalizedMessages, employee: employeeInfo });
  } catch (error) {
    console.error('Error fetching admin ticket details:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * SUPERADMIN: PUT /api/tickets/admin/:id/status
 * Update ticket status and priority
 */
router.put('/admin/:id/status', authMiddleware, superAdminMiddleware, async (req, res) => {
  try {
    const { status, priority } = req.body;
    let query = 'UPDATE tickets SET updated_at = NOW()';
    let queryParams = [];

    if (status) {
      query += ', status = ?';
      queryParams.push(status);
      if (status === 'RESOLVED' || status === 'REJECTED' || status === 'DUPLICATE') {
        query += ', resolved_at = NOW()';
      }
    }

    if (priority) {
      query += ', priority = ?';
      queryParams.push(priority);
    }

    query += ' WHERE id = ?';
    queryParams.push(req.params.id);

    const [oldTicket] = await pool.query('SELECT ticket_number, status, priority FROM tickets WHERE id = ?', [req.params.id]);

    await pool.query(query, queryParams);

    await logAudit(req.admin.id, req.admin.role, 'UPDATE_STATUS', 'HELPDESK', oldTicket[0]?.ticket_number, oldTicket[0], { status, priority }, req);

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating ticket status:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * SUPERADMIN: POST /api/tickets/admin/:id/reply
 * Reply to a ticket
 */
router.post('/admin/:id/reply', authMiddleware, superAdminMiddleware, async (req, res) => {
  try {
    const { message, attachment_data_url, new_status } = req.body;
    
    if (!message) return res.status(400).json({ success: false, message: 'Pesan wajib diisi' });

    let attachment_file_id = null;
    let attachment_url = null;

    const [tickets] = await pool.query('SELECT ticket_number FROM tickets WHERE id = ?', [req.params.id]);
    const ticketNum = tickets.length > 0 ? tickets[0].ticket_number : 'unknown';

    if (attachment_data_url) {
      const fileName = `reply-${ticketNum}-${Date.now()}.jpg`;
      const uploadResult = await uploadDataUrl(attachment_data_url, fileName, { localFallback: true });
      attachment_file_id = uploadResult.fileId;
      attachment_url = uploadResult.url;
    }

    await pool.query(
      'INSERT INTO ticket_messages (ticket_id, sender_type, sender_user_id, message, attachment_file_id, attachment_url) VALUES (?, ?, ?, ?, ?, ?)',
      [req.params.id, 'SUPERADMIN', req.admin.id, message, attachment_file_id, attachment_url]
    );

    if (new_status) {
       await pool.query('UPDATE tickets SET status = ?, updated_at = NOW() WHERE id = ?', [new_status, req.params.id]);
    }

    await logAudit(req.admin.id, req.admin.role, 'REPLY', 'HELPDESK', ticketNum, null, { message, new_status }, req);

    res.json({ success: true });
  } catch (error) {
    console.error('Error adding admin reply:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * PUBLIC: GET /api/tickets/photos/view/:fileId
 * Proxy CDN photos for tickets so browsers can display them without auth headers.
 */
router.get('/photos/view/:fileId', async (req, res) => {
  const { fileId } = req.params;
  if (!fileId) return res.status(400).send('File ID wajib diisi');

  const controller = new AbortController();
  req.on('close', () => controller.abort());

  try {
    const cdnUrl = `${CDN_BASE_URL}/api/bridge/view/${encodeURIComponent(fileId)}`;
    const upstream = await fetch(cdnUrl, {
      redirect: 'follow',
      signal: controller.signal
    });

    if (!upstream.ok) {
      return res.status(upstream.status).send('Foto tidak ditemukan');
    }

    const contentType = upstream.headers.get('content-type') || 'image/jpeg';
    const contentLength = upstream.headers.get('content-length');

    res.setHeader('Content-Type', contentType.startsWith('image/') ? contentType : 'image/jpeg');
    res.setHeader('Content-Disposition', `inline; filename="ticket-${fileId}"`);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    if (contentLength) res.setHeader('Content-Length', contentLength);

    if (!upstream.body) {
      const arrayBuffer = await upstream.arrayBuffer();
      return res.send(Buffer.from(arrayBuffer));
    }

    const stream = Readable.fromWeb(upstream.body);
    stream.on('error', (error) => {
      if (error.name !== 'AbortError') {
        console.error('Error streaming ticket photo:', error.message);
      }
      if (!res.destroyed) res.destroy(error);
    });
    return stream.pipe(res);
  } catch (error) {
    if (error.name === 'AbortError' || req.destroyed) return;
    console.error('Error proxying ticket photo:', error);
    if (!res.headersSent) return res.status(500).send('Gagal memuat foto');
    return res.end();
  }
});

module.exports = router;
