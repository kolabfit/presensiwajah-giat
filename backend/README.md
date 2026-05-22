# Backend - Sistem Presensi Koperasi Giat

Backend API menggunakan Node.js + Express + MySQL.

## Prasyarat

- Node.js >= 18
- MySQL >= 8.0

## Setup

### 1. Install dependencies

```bash
cd backend
npm install
```

### 2. Konfigurasi environment

```bash
cp .env.example .env
```

Edit file `.env` dan sesuaikan kredensial MySQL:

```
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=presensi_giat
FRONTEND_URL=http://localhost:3000
```

### 3. Inisialisasi database

Pastikan MySQL sudah berjalan, lalu jalankan:

```bash
npm run db:init
```

Script ini akan membuat database `presensi_giat` beserta tabel-tabelnya.

### 4. Jalankan server

```bash
# Development (auto-reload)
npm run dev

# Production
npm start
```

Server akan berjalan di `http://localhost:5000`.

## API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/health` | Health check |
| GET | `/api/attendance` | Ambil semua riwayat presensi |
| POST | `/api/attendance` | Simpan presensi masuk/pulang |
| GET | `/api/admin` | Ambil konfigurasi admin |
| POST | `/api/admin` | Update konfigurasi admin |

## Struktur Folder

```
backend/
├── src/
│   ├── index.js          # Entry point & Express setup
│   ├── db/
│   │   ├── connection.js # MySQL connection pool
│   │   └── init.js       # Database initialization script
│   └── routes/
│       ├── attendance.js # Endpoint presensi
│       └── admin.js      # Endpoint admin
├── .env.example
├── .gitignore
├── package.json
└── README.md
```
