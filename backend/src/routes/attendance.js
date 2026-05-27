const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const { uploadDataUrl, deleteAsset, CDN_BASE_URL } = require('../services/cdn');

function photoViewUrl(fileId) {
  return fileId ? `${CDN_BASE_URL}/api/bridge/view/${fileId}` : '';
}

function appBaseUrl(req) {
  return `${req.protocol}://${req.get('host')}`;
}

function proxiedPhotoUrl(req, fileId) {
  return fileId ? `${appBaseUrl(req)}/api/attendance/photos/view/${encodeURIComponent(fileId)}` : '';
}

function extractGoogleDriveId(url) {
  const raw = String(url || '');
  if (!raw.includes('drive.google.com')) return '';

  const idMatch = raw.match(/[?&]id=([^&]+)/);
  if (idMatch) return decodeURIComponent(idMatch[1]);

  const fileMatch = raw.match(/\/file\/d\/([^/]+)/);
  if (fileMatch) return decodeURIComponent(fileMatch[1]);

  return '';
}

function normalizePhotoUrl(req, storedUrl, fileId) {
  if (fileId) return proxiedPhotoUrl(req, fileId);

  const url = String(storedUrl || '').trim();
  const driveId = extractGoogleDriveId(url);
  if (driveId) {
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(driveId)}&sz=w1000`;
  }

  return url || photoViewUrl(fileId);
}

function inferImageMime(buffer, fallbackType) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'image/png';
  if (buffer.length >= 12 && buffer.slice(0, 4).toString() === 'RIFF' && buffer.slice(8, 12).toString() === 'WEBP') return 'image/webp';
  if (buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(buffer.slice(0, 6).toString())) return 'image/gif';
  if (String(fallbackType || '').startsWith('image/')) return fallbackType;
  return 'image/jpeg';
}

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
      Id: row.id,
      Timestamp: row.timestamp,
      Date: row.date || '',  // sudah string YYYY-MM-DD karena dateStrings: true
      Name: row.name,
      Location: row.location,
      Shift: row.shift,
      TimeIn: row.time_in || '',
      TimeOut: row.time_out || '',
      Status: row.status,
      Note: row.note || '',
      CheckInPhotoFileId: row.check_in_photo_file_id || '',
      CheckInPhotoUrl: normalizePhotoUrl(req, row.check_in_photo_url, row.check_in_photo_file_id),
      CheckInLatitude: row.check_in_latitude,
      CheckInLongitude: row.check_in_longitude,
      CheckOutPhotoFileId: row.check_out_photo_file_id || '',
      CheckOutPhotoUrl: normalizePhotoUrl(req, row.check_out_photo_url, row.check_out_photo_file_id),
      CheckOutLatitude: row.check_out_latitude,
      CheckOutLongitude: row.check_out_longitude
    }));

    res.json(data);
  } catch (error) {
    console.error('Error fetching attendance:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * GET /api/attendance/photos/view/:fileId
 * Proxy gambar CDN supaya browser selalu menampilkan inline, bukan download.
 */
router.get('/photos/view/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const upstream = await fetch(photoViewUrl(fileId), { redirect: 'follow' });

    if (!upstream.ok) {
      return res.status(upstream.status).send('Foto tidak ditemukan');
    }

    const arrayBuffer = await upstream.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = inferImageMime(buffer, upstream.headers.get('content-type'));

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="presensi-${fileId}"`);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(buffer);
  } catch (error) {
    console.error('Error proxying attendance photo:', error);
    res.status(500).send('Gagal memuat foto');
  }
});

/**
 * GET /api/attendance/photos
 * Ambil daftar foto bukti presensi untuk admin.
 */
router.get('/photos', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT id, date, name, location, shift, time_in, time_out,
        check_in_photo_file_id, check_in_photo_url, check_in_latitude, check_in_longitude,
        check_out_photo_file_id, check_out_photo_url, check_out_latitude, check_out_longitude
      FROM attendance
      WHERE check_in_photo_file_id IS NOT NULL OR check_in_photo_url IS NOT NULL
         OR check_out_photo_file_id IS NOT NULL OR check_out_photo_url IS NOT NULL
      ORDER BY date DESC, timestamp DESC
    `);

    const photos = [];
    rows.forEach(row => {
      if (row.check_in_photo_file_id || row.check_in_photo_url) {
        photos.push({
          attendanceId: row.id,
          type: 'masuk',
          date: row.date,
          name: row.name,
          location: row.location,
          shift: row.shift,
          time: row.time_in,
          fileId: row.check_in_photo_file_id,
          url: normalizePhotoUrl(req, row.check_in_photo_url, row.check_in_photo_file_id),
          latitude: row.check_in_latitude,
          longitude: row.check_in_longitude
        });
      }
      if (row.check_out_photo_file_id || row.check_out_photo_url) {
        photos.push({
          attendanceId: row.id,
          type: 'pulang',
          date: row.date,
          name: row.name,
          location: row.location,
          shift: row.shift,
          time: row.time_out,
          fileId: row.check_out_photo_file_id,
          url: normalizePhotoUrl(req, row.check_out_photo_url, row.check_out_photo_file_id),
          latitude: row.check_out_latitude,
          longitude: row.check_out_longitude
        });
      }
    });

    res.json(photos);
  } catch (error) {
    console.error('Error fetching attendance photos:', error);
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
    let uploadedPhoto = null;
    if (data.PhotoDataUrl) {
      const action = data.TimeOut ? 'pulang' : 'masuk';
      uploadedPhoto = await uploadDataUrl(data.PhotoDataUrl, `presensi-${action}-${Date.now()}.jpg`);
    }

    // Cari record yang sudah ada untuk nama & tanggal yang sama
    const [existing] = await pool.query(
      'SELECT id, time_in, time_out FROM attendance WHERE name = ? AND date = ?',
      [data.Name, todayStr]
    );

    // --- LOGIKA PULANG (UPDATE TIME_OUT) ---
    if (data.TimeOut) {
      if (existing.length > 0) {
        await pool.query(
          `UPDATE attendance
           SET time_out = ?, check_out_photo_file_id = ?, check_out_photo_url = ?,
               check_out_latitude = ?, check_out_longitude = ?
           WHERE id = ?`,
          [
            data.TimeOut,
            uploadedPhoto?.fileId || null,
            uploadedPhoto?.url || null,
            data.Latitude || null,
            data.Longitude || null,
            existing[0].id
          ]
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
        `INSERT INTO attendance (
          date, name, location, shift, time_in, time_out, status, note,
          check_in_photo_file_id, check_in_photo_url, check_in_latitude, check_in_longitude
        )
         VALUES (?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?)`,
        [
          data.Date,
          data.Name,
          data.Location,
          data.Shift,
          data.TimeIn,
          data.Status,
          data.Note || '',
          uploadedPhoto?.fileId || null,
          uploadedPhoto?.url || null,
          data.Latitude || null,
          data.Longitude || null
        ]
      );

      return res.json({ success: true, message: 'Presensi Masuk Berhasil' });
    }
  } catch (error) {
    console.error('Error saving attendance:', error);
    if (error.isCdnUploadError) {
      return res.status(503).json({
        success: false,
        message: error.message
      });
    }
    res.status(500).json({
      success: false,
      message: 'Presensi belum berhasil disimpan. Silakan coba lagi atau hubungi admin jika masih gagal.'
    });
  }
});

/**
 * DELETE /api/attendance/photos/:attendanceId/:type
 * Hapus foto bukti presensi dari CDN dan kosongkan referensi DB.
 */
router.delete('/photos/:attendanceId/:type', async (req, res) => {
  try {
    const { attendanceId, type } = req.params;
    const isCheckOut = type === 'pulang';
    const fileColumn = isCheckOut ? 'check_out_photo_file_id' : 'check_in_photo_file_id';
    const urlColumn = isCheckOut ? 'check_out_photo_url' : 'check_in_photo_url';
    const latColumn = isCheckOut ? 'check_out_latitude' : 'check_in_latitude';
    const lngColumn = isCheckOut ? 'check_out_longitude' : 'check_in_longitude';

    const [rows] = await pool.query(`SELECT ${fileColumn} AS file_id FROM attendance WHERE id = ?`, [attendanceId]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Data presensi tidak ditemukan' });
    }

    if (rows[0].file_id) {
      try {
        await deleteAsset(rows[0].file_id);
      } catch (error) {
        console.error('Error deleting CDN asset, clearing database reference only:', error.message);
      }
    }

    await pool.query(
      `UPDATE attendance SET ${fileColumn} = NULL, ${urlColumn} = NULL, ${latColumn} = NULL, ${lngColumn} = NULL WHERE id = ?`,
      [attendanceId]
    );

    res.json({ success: true, message: 'Foto bukti presensi berhasil dihapus' });
  } catch (error) {
    console.error('Error deleting attendance photo:', error);
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
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
