const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const initDatabase = require('./db/init');
const attendanceRoutes = require('./routes/attendance');
const adminRoutes = require('./routes/admin');
const employeesRoutes = require('./routes/employees');
const locationsRoutes = require('./routes/locations');
const shiftsRoutes = require('./routes/shifts');
const settingsRoutes = require('./routes/settings');
const faceRoutes = require('./routes/face');
const { startAttendanceCleanupScheduler } = require('./services/attendanceCleanup');
const { UPLOADS_DIR } = require('./services/cdn');

const app = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';
app.set('trust proxy', true);

// === LOGGING (Morgan) ===
// Custom token untuk warna status code
morgan.token('status-colored', (_req, res) => {
  const status = res.statusCode;
  const color =
    status >= 500 ? 31 :  // merah
    status >= 400 ? 33 :  // kuning
    status >= 300 ? 36 :  // cyan
    status >= 200 ? 32 :  // hijau
    0;
  return `\x1b[${color}m${status}\x1b[0m`;
});

morgan.token('time-id', () => {
  return new Date().toLocaleTimeString('id-ID', { hour12: false });
});

const morganFormat = isProduction
  ? 'combined'
  : ':time-id :method :url :status-colored :res[content-length] - :response-time ms';

app.use(morgan(morganFormat));

// === MIDDLEWARE ===
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '12mb' }));
app.use('/uploads', express.static(UPLOADS_DIR, {
  maxAge: '1h',
  setHeaders: (res) => {
    res.setHeader('Content-Disposition', 'inline');
  }
}));

app.use((err, req, res, next) => {
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      message: 'Ukuran foto terlalu besar. Pilih foto yang lebih kecil atau kompres foto terlebih dahulu.'
    });
  }
  return next(err);
});

// === ROUTES ===
app.use('/api/attendance', attendanceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/employees', employeesRoutes);
app.use('/api/locations', locationsRoutes);
app.use('/api/shifts', shiftsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/face', faceRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Presensi API is running' });
});

// === START SERVER ===
initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`\n🚀 Server berjalan di http://localhost:${PORT}`);
      console.log(`📋 Mode: ${isProduction ? 'production' : 'development'}\n`);
      startAttendanceCleanupScheduler();
    });
  })
  .catch(err => {
    console.error('❌ Gagal inisialisasi database:', err);
    process.exit(1);
  });
