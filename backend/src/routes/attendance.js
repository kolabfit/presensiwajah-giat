const express = require('express');
const router = express.Router();
const { Readable } = require('stream');
const pool = require('../db/connection');
const { uploadDataUrl, deleteAsset, CDN_BASE_URL, isLocalAssetId, localAssetUrl } = require('../services/cdn');
const { extractDescriptor, findBestMatch } = require('../services/faceRecognition');
const { validateGeofence } = require('../utils/geofence');

function photoViewUrl(fileId) {
  return fileId ? `${CDN_BASE_URL}/api/bridge/view/${fileId}` : '';
}

function appBaseUrl(req) {
  return `${req.protocol}://${req.get('host')}`;
}

function proxiedPhotoUrl(req, fileId) {
  if (isLocalAssetId(fileId)) return `${appBaseUrl(req)}${localAssetUrl(fileId)}`;
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
  if (url.startsWith('/uploads/')) return `${appBaseUrl(req)}${url}`;

  const driveId = extractGoogleDriveId(url);
  if (driveId) {
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(driveId)}&sz=w1000`;
  }

  return url || photoViewUrl(fileId);
}

function extractAssetIdFromUrl(url) {
  const raw = String(url || '');
  const cdnMatch = raw.match(/\/api\/bridge\/view\/([^/?#]+)/);
  if (cdnMatch) return decodeURIComponent(cdnMatch[1]);

  const localMatch = raw.match(/\/uploads\/([^/?#]+)/);
  if (localMatch) return `local:${decodeURIComponent(localMatch[1])}`;

  return '';
}

function inferImageMime(buffer, fallbackType) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'image/png';
  if (buffer.length >= 12 && buffer.slice(0, 4).toString() === 'RIFF' && buffer.slice(8, 12).toString() === 'WEBP') return 'image/webp';
  if (buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(buffer.slice(0, 6).toString())) return 'image/gif';
  if (String(fallbackType || '').startsWith('image/')) return fallbackType;
  return 'image/jpeg';
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchCdnPhotoWithRetry(fileId, signal, attempts = 5) {
  let lastResponse = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await fetch(photoViewUrl(fileId), {
      redirect: 'follow',
      signal
    });

    if (response.ok) return response;
    lastResponse = response;

    if (![404, 408, 425, 429, 500, 502, 503, 504].includes(response.status)) {
      return response;
    }

    await response.body?.cancel().catch(() => {});
    if (attempt < attempts) await sleep(450 * attempt);
  }

  return lastResponse;
}

async function streamCdnPhoto(req, res, fileId, filenamePrefix = 'presensi') {
  const controller = new AbortController();
  req.on('close', () => controller.abort());

  try {
    const upstream = await fetchCdnPhotoWithRetry(fileId, controller.signal);

    if (!upstream.ok) {
      return res.status(upstream.status).send('Foto tidak ditemukan');
    }

    const contentType = upstream.headers.get('content-type') || 'image/jpeg';
    const contentLength = upstream.headers.get('content-length');

    res.setHeader('Content-Type', contentType.startsWith('image/') ? contentType : 'image/jpeg');
    res.setHeader('Content-Disposition', `inline; filename="${filenamePrefix}-${fileId}"`);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    if (contentLength) res.setHeader('Content-Length', contentLength);

    if (!upstream.body) {
      const arrayBuffer = await upstream.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      res.setHeader('Content-Type', inferImageMime(buffer, contentType));
      return res.send(buffer);
    }

    const stream = Readable.fromWeb(upstream.body);
    stream.on('error', (error) => {
      if (error.name !== 'AbortError') {
        console.error('Error streaming attendance photo:', error.message);
      }
      if (!res.destroyed) res.destroy(error);
    });
    return stream.pipe(res);
  } catch (error) {
    if (error.name === 'AbortError' || req.destroyed) return;
    console.error('Error proxying attendance photo:', error);
    if (!res.headersSent) return res.status(500).send('Gagal memuat foto');
    return res.end();
  }
}

async function uploadAttendancePhoto(photoDataUrl, action, employeeName) {
  const safeAction = action === 'pulang' ? 'pulang' : 'masuk';
  const fileName = `presensi-${safeAction}-${employeeName}-${Date.now()}.jpg`;
  return await uploadDataUrl(photoDataUrl, fileName, {
    requireVerified: true,
    verifyAttempts: 20
  });
}

async function recognizeEmployeeFromPhoto(photoDataUrl) {
  if (!photoDataUrl) {
    const error = new Error('Foto wajah wajib diambil untuk presensi.');
    error.statusCode = 400;
    throw error;
  }

  const queryDescriptor = await extractDescriptor(photoDataUrl);
  if (!queryDescriptor) {
    const error = new Error('Wajah tidak terdeteksi. Pastikan wajah terlihat jelas di kamera.');
    error.statusCode = 400;
    throw error;
  }

  const [employees] = await pool.query(`
    SELECT id, name, status, photo_file_id, photo_url, face_descriptor
    FROM employees
    WHERE status = 'AKTIF' AND face_registered = TRUE AND face_descriptor IS NOT NULL
  `);

  if (employees.length === 0) {
    const error = new Error('Belum ada pegawai aktif yang terdaftar wajahnya.');
    error.statusCode = 404;
    throw error;
  }

  const match = findBestMatch(queryDescriptor, employees);
  if (!match.matched) {
    const error = new Error('Wajah tidak cocok dengan data pegawai terdaftar.');
    error.statusCode = 401;
    error.distance = Number.isFinite(match.distance) ? match.distance : null;
    throw error;
  }

  return match;
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

    const data = rows.map(row => ({
      Id: row.id,
      Timestamp: row.timestamp,
      Date: row.date || '',
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
 */
router.get('/photos/view/:fileId', async (req, res) => {
  return streamCdnPhoto(req, res, req.params.fileId, 'presensi');
});

/**
 * GET /api/attendance/photos
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
 * POST /api/attendance/recognize
 */
router.post('/recognize', async (req, res) => {
  try {
    const { photoDataUrl } = req.body;
    const recognition = await recognizeEmployeeFromPhoto(photoDataUrl);

    res.json({
      success: true,
      employee: {
        name: recognition.employee.name,
        photo_url: recognition.employee.photo_file_id
          ? proxiedPhotoUrl(req, recognition.employee.photo_file_id)
          : normalizePhotoUrl(req, recognition.employee.photo_url, recognition.employee.photo_file_id)
      },
      face: {
        distance: Number(recognition.distance.toFixed(4))
      }
    });
  } catch (error) {
    console.error('Error recognizing attendance face:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Wajah belum berhasil dikenali. Silakan coba lagi.',
      distance: error.distance
    });
  }
});

/**
 * POST /api/attendance
 * Simpan presensi (masuk atau pulang) dengan validasi Geofence.
 */
router.post('/', async (req, res) => {
  try {
    const { data } = req.body;

    if (!data) {
      return res.status(400).json({ success: false, message: 'Data tidak boleh kosong' });
    }

    const todayStr = data.Date;
    const recognition = await recognizeEmployeeFromPhoto(data.PhotoDataUrl);
    const recognizedName = recognition.employee.name;
    const recognizedId = recognition.employee.id;
    data.Name = recognizedName;

    const action = data.TimeOut ? 'pulang' : 'masuk';
    
    // Default fallback if payload is missing Accuracy
    const Latitude = data.Latitude || null;
    const Longitude = data.Longitude || null;
    const Accuracy = data.Accuracy || null;

    if (!Latitude || !Longitude) {
       return res.status(400).json({ success: false, message: 'Sistem tidak dapat membaca koordinat GPS Anda.' });
    }

    // Ambil lokasi penugasan pegawai
    const [assignedLocations] = await pool.query(`
      SELECT l.* 
      FROM employee_locations el
      JOIN locations l ON el.location_id = l.id
      WHERE el.employee_id = ? AND l.is_active = TRUE
    `, [recognizedId]);

    if (assignedLocations.length === 0) {
      return res.json({ success: false, message: 'Lokasi kerja Anda belum ditetapkan oleh admin.' });
    }

    // Cari record yang sudah ada
    const [existing] = await pool.query(
      'SELECT id, time_in, time_out, check_in_location_id FROM attendance WHERE name = ? AND date = ? ORDER BY id DESC',
      [recognizedName, todayStr]
    );

    let nearestValidLocation = null;
    let geofenceDistance = null;

    // Logika Check-Out: Wajib di lokasi yang sama dengan saat Check-In jika check_in_location_id tercatat.
    if (data.TimeOut && existing.length > 0 && existing[0].check_in_location_id) {
      const checkInLocId = existing[0].check_in_location_id;
      const assignedMatch = assignedLocations.find(l => l.id === checkInLocId);
      if (!assignedMatch) {
        return res.json({ success: false, message: 'Lokasi check-in Anda tidak tersedia lagi di daftar penugasan.' });
      }
      
      const result = validateGeofence(Latitude, Longitude, Accuracy, assignedMatch);
      if (!result.valid) {
        return res.json({ success: false, message: `Presensi pulang harus di lokasi yang sama saat masuk. ${result.reason}` });
      }
      nearestValidLocation = assignedMatch;
      geofenceDistance = result.distance;
    } else {
      // Logika Check-In (atau check-out legacy)
      for (const loc of assignedLocations) {
        const result = validateGeofence(Latitude, Longitude, Accuracy, loc);
        if (result.valid) {
          nearestValidLocation = loc;
          geofenceDistance = result.distance;
          break; // Cukup temukan 1 yang valid
        }
      }

      if (!nearestValidLocation) {
        let minDist = Infinity;
        let lastReason = 'Anda berada di luar jangkauan dari semua lokasi kerja Anda.';
        for (const loc of assignedLocations) {
          const result = validateGeofence(Latitude, Longitude, Accuracy, loc);
          if (result.distance !== null && result.distance < minDist) {
            minDist = result.distance;
            lastReason = result.reason;
          }
        }
        return res.json({ success: false, message: lastReason });
      }
    }

    data.Location = nearestValidLocation.name; // Timpa dengan nama yang tervalidasi
    const locationId = nearestValidLocation.id;

    // --- PROSES SIMPAN ABSEN ---
    if (data.TimeOut) {
      if (existing.length > 0) {
        const currentRecord = existing[0];
        if (currentRecord.time_out && String(currentRecord.time_out).trim()) {
          return res.json({
            success: false,
            message: 'Anda sudah melakukan Presensi Pulang hari ini'
          });
        }

        const uploadedPhoto = await uploadAttendancePhoto(data.PhotoDataUrl, action, recognizedName);
        await pool.query(
          `UPDATE attendance
           SET time_out = ?, check_out_photo_file_id = ?, check_out_photo_url = ?,
               check_out_latitude = ?, check_out_longitude = ?, check_out_location_id = ?, check_out_accuracy = ?, check_out_distance = ?
           WHERE id = ?`,
          [
            data.TimeOut,
            uploadedPhoto?.fileId || null,
            uploadedPhoto?.url || null,
            Latitude,
            Longitude,
            locationId,
            Accuracy,
            geofenceDistance,
            currentRecord.id
          ]
        );
        return res.json({
          success: true,
          message: 'Presensi Pulang Berhasil',
          employee: { name: recognizedName },
          face: { distance: Number(recognition.distance.toFixed(4)) }
        });
      } else {
        return res.json({ success: false, message: 'Data Masuk tidak ditemukan untuk hari ini' });
      }
    } else {
      if (existing.length > 0) {
        return res.json({ success: false, message: 'Anda sudah melakukan Presensi Masuk hari ini' });
      }

      const uploadedPhoto = await uploadAttendancePhoto(data.PhotoDataUrl, action, recognizedName);
      await pool.query(
        `INSERT INTO attendance (
          date, name, location, shift, time_in, time_out, status, note,
          check_in_photo_file_id, check_in_photo_url, check_in_latitude, check_in_longitude, check_in_location_id, check_in_accuracy, check_in_distance
        )
         VALUES (?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.Date,
          recognizedName,
          data.Location,
          data.Shift,
          data.TimeIn,
          data.Status,
          data.Note || '',
          uploadedPhoto?.fileId || null,
          uploadedPhoto?.url || null,
          Latitude,
          Longitude,
          locationId,
          Accuracy,
          geofenceDistance
        ]
      );

      return res.json({
        success: true,
        message: 'Presensi Masuk Berhasil',
        employee: { name: recognizedName },
        face: { distance: Number(recognition.distance.toFixed(4)) }
      });
    }
  } catch (error) {
    console.error('Error saving attendance:', error);
    if (error.isCdnUploadError) {
      return res.status(424).json({
        success: false,
        message: error.message,
        attempts: error.attempts
      });
    }
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Presensi belum berhasil disimpan. Silakan coba lagi atau hubungi admin jika masih gagal.',
      distance: error.distance
    });
  }
});

/**
 * DELETE /api/attendance/photos/:attendanceId/:type
 */
router.delete('/photos/:attendanceId/:type', async (req, res) => {
  try {
    const { attendanceId, type } = req.params;
    const isCheckOut = type === 'pulang';
    const fileColumn = isCheckOut ? 'check_out_photo_file_id' : 'check_in_photo_file_id';
    const urlColumn = isCheckOut ? 'check_out_photo_url' : 'check_in_photo_url';
    const latColumn = isCheckOut ? 'check_out_latitude' : 'check_in_latitude';
    const lngColumn = isCheckOut ? 'check_out_longitude' : 'check_in_longitude';

    const [rows] = await pool.query(`SELECT ${fileColumn} AS file_id, ${urlColumn} AS photo_url FROM attendance WHERE id = ?`, [attendanceId]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Data presensi tidak ditemukan' });
    }

    const assetId = rows[0].file_id || extractAssetIdFromUrl(rows[0].photo_url);
    if (assetId) {
      try {
        await deleteAsset(assetId);
      } catch (error) {
        console.error('Error deleting photo asset, clearing database reference only:', error.message);
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

function formatDate(date) {
  if (date instanceof Date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(date).split('T')[0];
}

module.exports = router;
