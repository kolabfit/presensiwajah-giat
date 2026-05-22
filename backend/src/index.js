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

const app = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';

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
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));
app.use(express.json());

// === ROUTES ===
app.use('/api/attendance', attendanceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/employees', employeesRoutes);
app.use('/api/locations', locationsRoutes);
app.use('/api/shifts', shiftsRoutes);
app.use('/api/settings', settingsRoutes);

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
    });
  })
  .catch(err => {
    console.error('❌ Gagal inisialisasi database:', err.message);
    process.exit(1);
  });
