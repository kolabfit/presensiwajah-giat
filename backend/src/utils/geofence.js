/**
 * Menghitung jarak antara 2 koordinat bumi menggunakan rumus Haversine.
 * Mengembalikan hasil dalam satuan meter.
 */
function getDistance(lat1, lon1, lat2, lon2) {
  if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) return null;
  
  const toRad = (value) => (value * Math.PI) / 180;
  
  const R = 6371e3; // Radius bumi dalam meter
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
            
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

/**
 * Validasi posisi perangkat terhadap suatu lokasi.
 * @param {number} currentLat Latitude pengguna
 * @param {number} currentLng Longitude pengguna
 * @param {number} currentAcc Akurasi GPS (dalam meter)
 * @param {Object} location Objek lokasi dari database { latitude, longitude, radius_meter, max_accuracy_meter }
 * @returns {Object} { valid: boolean, distance: number, reason?: string }
 */
function validateGeofence(currentLat, currentLng, currentAcc, location) {
  if (currentLat == null || currentLng == null) {
    return { valid: false, distance: null, reason: 'Koordinat GPS tidak tersedia.' };
  }
  
  if (currentLat < -90 || currentLat > 90 || currentLng < -180 || currentLng > 180) {
    return { valid: false, distance: null, reason: 'Koordinat GPS tidak valid.' };
  }

  // Ensure currentAcc is positive
  if (currentAcc != null && currentAcc < 0) {
    return { valid: false, distance: null, reason: 'Akurasi GPS tidak valid.' };
  }

  if (currentAcc != null && currentAcc > location.max_accuracy_meter) {
    return { 
      valid: false, 
      distance: null, 
      reason: `Akurasi GPS buruk (${Math.round(currentAcc)}m). Maksimal yang diizinkan ${location.max_accuracy_meter}m.` 
    };
  }

  const distance = getDistance(currentLat, currentLng, location.latitude, location.longitude);
  
  if (distance === null) {
    return { valid: false, distance: null, reason: 'Titik koordinat lokasi absen belum diatur.' };
  }
  
  if (distance > location.radius_meter) {
    return { 
      valid: false, 
      distance, 
      reason: `Anda berada di luar area lokasi. Jarak Anda ${Math.round(distance)}m (Radius: ${location.radius_meter}m).` 
    };
  }
  
  return { valid: true, distance };
}

module.exports = {
  getDistance,
  validateGeofence
};
