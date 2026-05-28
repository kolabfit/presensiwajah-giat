const pool = require('../db/connection');
const { deleteAsset } = require('./cdn');

const DEFAULT_RETENTION_DAYS = 90;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

function normalizeRetentionDays(value) {
  const days = Number.parseInt(value, 10);
  if (!Number.isFinite(days) || days < 1) return DEFAULT_RETENTION_DAYS;
  return Math.min(days, 3650);
}

function extractFileIdFromUrl(url) {
  const raw = String(url || '');
  const cdnMatch = raw.match(/\/api\/bridge\/view\/([^/?#]+)/);
  if (cdnMatch) return decodeURIComponent(cdnMatch[1]);

  const localMatch = raw.match(/\/uploads\/([^/?#]+)/);
  if (localMatch) return `local:${decodeURIComponent(localMatch[1])}`;

  return '';
}

async function getCleanupSettings() {
  const [rows] = await pool.query(
    "SELECT `key`, value FROM app_settings WHERE `key` IN ('attendance_cleanup_enabled', 'attendance_cleanup_days')"
  );
  const settings = rows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});

  return {
    enabled: settings.attendance_cleanup_enabled === 'true',
    retentionDays: normalizeRetentionDays(settings.attendance_cleanup_days)
  };
}

async function runAttendanceCleanup(options = {}) {
  const settings = await getCleanupSettings();
  const retentionDays = normalizeRetentionDays(options.retentionDays || settings.retentionDays);
  const force = options.force === true;

  if (!force && !settings.enabled) {
    return {
      skipped: true,
      cleanedRecords: 0,
      deletedPhotos: 0,
      retentionDays,
      message: 'Pembersihan foto otomatis belum diaktifkan.'
    };
  }

  const [rows] = await pool.query(
    `SELECT
       id,
       check_in_photo_file_id,
       check_in_photo_url,
       check_out_photo_file_id,
       check_out_photo_url
     FROM attendance
     WHERE date < DATE_SUB(CURDATE(), INTERVAL ? DAY)`,
    [retentionDays]
  );

  const rowsWithPhotos = rows.filter(row =>
    row.check_in_photo_file_id ||
    row.check_in_photo_url ||
    row.check_out_photo_file_id ||
    row.check_out_photo_url
  );

  if (rowsWithPhotos.length === 0) {
    return {
      skipped: false,
      cleanedRecords: 0,
      deletedPhotos: 0,
      retentionDays,
      message: 'Tidak ada bukti foto lama yang perlu dibersihkan.'
    };
  }

  const fileIds = [...new Set(rowsWithPhotos
    .flatMap(row => [
      row.check_in_photo_file_id || extractFileIdFromUrl(row.check_in_photo_url),
      row.check_out_photo_file_id || extractFileIdFromUrl(row.check_out_photo_url)
    ])
    .filter(Boolean))];

  let deletedPhotos = 0;
  for (const fileId of fileIds) {
    try {
      await deleteAsset(fileId);
      deletedPhotos += 1;
    } catch (error) {
      console.error(`Gagal menghapus bukti foto ${fileId}, referensi foto tetap dibersihkan:`, error.message);
    }
  }

  const ids = rowsWithPhotos.map(row => row.id);
  await pool.query(
    `UPDATE attendance
     SET
       check_in_photo_file_id = NULL,
       check_in_photo_url = NULL,
       check_out_photo_file_id = NULL,
       check_out_photo_url = NULL
     WHERE id IN (?)`,
    [ids]
  );

  return {
    skipped: false,
    cleanedRecords: rowsWithPhotos.length,
    deletedPhotos,
    retentionDays,
    message: `Berhasil membersihkan bukti foto lama dari ${rowsWithPhotos.length} data presensi.`
  };
}

function startAttendanceCleanupScheduler() {
  const runScheduledCleanup = async () => {
    try {
      const result = await runAttendanceCleanup();
      if (!result.skipped && (result.cleanedRecords > 0 || result.deletedPhotos > 0)) {
        console.log(`✅ Pembersihan foto presensi selesai: ${result.cleanedRecords} data presensi, ${result.deletedPhotos} bukti foto.`);
      }
    } catch (error) {
      console.error('Gagal menjalankan pembersihan foto presensi otomatis:', error.message);
    }
  };

  setTimeout(runScheduledCleanup, 15000);
  return setInterval(runScheduledCleanup, CLEANUP_INTERVAL_MS);
}

module.exports = {
  getCleanupSettings,
  runAttendanceCleanup,
  startAttendanceCleanupScheduler
};
