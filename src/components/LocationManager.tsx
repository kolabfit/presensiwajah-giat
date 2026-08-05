import React, { useState, useEffect, useRef } from 'react';
import { X, MapPin, Search, Navigation } from 'lucide-react';
import { Location, EmployeeLocation } from '../types';
import { api } from '../services/api';
import * as maplibregl from 'maplibre-gl/dist/maplibre-gl.mjs';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import 'maplibre-gl/dist/maplibre-gl.css';

maplibregl.setWorkerUrl(workerUrl);

// Helper: Membuat GeoJSON Polygon berupa lingkaran dalam satuan meter
const createGeoJSONCircle = (centerLng: number, centerLat: number, radiusInMeters: number, points = 64) => {
  const km = radiusInMeters / 1000;
  const ret = [];
  const distanceX = km / (111.320 * Math.cos((centerLat * Math.PI) / 180));
  const distanceY = km / 110.574;

  let theta, x, y;
  for (let i = 0; i < points; i++) {
    theta = (i / points) * (2 * Math.PI);
    x = distanceX * Math.cos(theta);
    y = distanceY * Math.sin(theta);
    ret.push([centerLng + x, centerLat + y]);
  }
  ret.push(ret[0]);

  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [ret]
    }
  };
};

interface LocationFormModalProps {
  location?: Location | null;
  onClose: () => void;
  onSave: () => void;
}

export function LocationFormModal({ location, onClose, onSave }: LocationFormModalProps) {
  const [name, setName] = useState(location?.name || '');
  const [address, setAddress] = useState(location?.address || '');
  const [lat, setLat] = useState(location?.latitude || -6.200000);
  const [lng, setLng] = useState(location?.longitude || 106.816666);
  const [radius, setRadius] = useState(location?.radius_meter || 50);
  const [maxAccuracy, setMaxAccuracy] = useState(location?.max_accuracy_meter || 100);
  const [isActive, setIsActive] = useState(location?.is_active ?? true);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mapError, setMapError] = useState(false);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<maplibregl.Map | null>(null);
  const markerInstance = useRef<maplibregl.Marker | null>(null);
  const searchTimeoutRef = useRef<number | null>(null);

  const apiKey = import.meta.env.VITE_MAPTILER_API_KEY;

  useEffect(() => {
    if (!mapRef.current) return;
    if (!apiKey) {
      setMapError(true);
      return;
    }

    const map = new maplibregl.Map({
      container: mapRef.current,
      style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${apiKey}`,
      center: [lng, lat],
      zoom: 15,
      attributionControl: false
    });
    mapInstance.current = map;

    const marker = new maplibregl.Marker({ draggable: true, color: '#B21B1B' })
      .setLngLat([lng, lat])
      .addTo(map);
    markerInstance.current = marker;

    map.on('load', () => {
      map.addSource('circle-source', {
        type: 'geojson',
        data: createGeoJSONCircle(lng, lat, radius) as any
      });
      map.addLayer({
        id: 'circle-fill',
        type: 'fill',
        source: 'circle-source',
        paint: {
          'fill-color': '#B21B1B',
          'fill-opacity': 0.2
        }
      });
      map.addLayer({
        id: 'circle-outline',
        type: 'line',
        source: 'circle-source',
        paint: {
          'line-color': '#B21B1B',
          'line-width': 2
        }
      });
    });

    const handleCoordinatesChange = async (newLng: number, newLat: number) => {
      setLng(newLng);
      setLat(newLat);
      updateCircle(newLng, newLat, radius);
      
      // Reverse Geocoding
      try {
        const res = await fetch(`https://api.maptiler.com/geocoding/${newLng},${newLat}.json?key=${apiKey}`);
        const data = await res.json();
        if (data.features && data.features.length > 0) {
          const place = data.features[0];
          setAddress(place.place_name || '');
          if (!name) setName(place.text || place.place_name);
        }
      } catch (err) {
        console.error('Reverse geocoding error', err);
      }
    };

    marker.on('dragend', () => {
      const pos = marker.getLngLat();
      handleCoordinatesChange(pos.lng, pos.lat);
    });

    map.on('click', (e) => {
      marker.setLngLat([e.lngLat.lng, e.lngLat.lat]);
      handleCoordinatesChange(e.lngLat.lng, e.lngLat.lat);
    });

    return () => {
      map.remove();
    };
  }, []);

  const updateCircle = (clng: number, clat: number, cradius: number) => {
    if (!mapInstance.current) return;
    const source = mapInstance.current.getSource('circle-source') as maplibregl.GeoJSONSource;
    if (source) {
      source.setData(createGeoJSONCircle(clng, clat, cradius) as any);
    }
  };

  useEffect(() => {
    updateCircle(lng, lat, radius);
  }, [radius]);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    if (!apiKey) return;
    
    if (searchTimeoutRef.current) window.clearTimeout(searchTimeoutRef.current);
    
    if (!val.trim()) {
      setSuggestions([]);
      return;
    }

    searchTimeoutRef.current = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`https://api.maptiler.com/geocoding/${encodeURIComponent(val)}.json?key=${apiKey}&country=id&autocomplete=true`);
        const data = await res.json();
        setSuggestions(data.features || []);
      } catch (err) {
        console.error('Search error', err);
      } finally {
        setIsSearching(false);
      }
    }, 500);
  };

  const handleSelectSuggestion = (place: any) => {
    setSearchQuery('');
    setSuggestions([]);
    
    const [newLng, newLat] = place.center;
    setLng(newLng);
    setLat(newLat);
    setAddress(place.place_name || '');
    if (!name) setName(place.text || place.place_name);

    if (mapInstance.current && markerInstance.current) {
      mapInstance.current.setCenter([newLng, newLat]);
      mapInstance.current.setZoom(17);
      markerInstance.current.setLngLat([newLng, newLat]);
      updateCircle(newLng, newLat, radius);
    }
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert('Geolokasi tidak didukung oleh browser Anda.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const newLat = pos.coords.latitude;
        const newLng = pos.coords.longitude;
        setLat(newLat);
        setLng(newLng);
        
        if (mapInstance.current && markerInstance.current) {
          mapInstance.current.setCenter([newLng, newLat]);
          mapInstance.current.setZoom(17);
          markerInstance.current.setLngLat([newLng, newLat]);
          updateCircle(newLng, newLat, radius);
        }

        if (apiKey) {
          try {
            const res = await fetch(`https://api.maptiler.com/geocoding/${newLng},${newLat}.json?key=${apiKey}`);
            const data = await res.json();
            if (data.features && data.features.length > 0) {
              const place = data.features[0];
              setAddress(place.place_name || '');
              if (!name) setName(place.text || place.place_name);
            }
          } catch (err) {}
        }
      },
      () => {
        alert('Gagal mendapatkan lokasi Anda. Pastikan izin lokasi diberikan.');
      },
      { enableHighAccuracy: true }
    );
  };

  // Sync manual coordinate inputs with map
  const handleLatChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setLat(val);
    if (!isNaN(val) && mapInstance.current && markerInstance.current) {
      markerInstance.current.setLngLat([lng, val]);
      mapInstance.current.setCenter([lng, val]);
      updateCircle(lng, val, radius);
    }
  };

  const handleLngChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setLng(val);
    if (!isNaN(val) && mapInstance.current && markerInstance.current) {
      markerInstance.current.setLngLat([val, lat]);
      mapInstance.current.setCenter([val, lat]);
      updateCircle(val, lat, radius);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const data = {
      name,
      address,
      latitude: lat,
      longitude: lng,
      radius_meter: radius,
      max_accuracy_meter: maxAccuracy,
      is_active: isActive
    };

    try {
      if (location?.id) {
        await api.updateAdminLocation(location.id, data);
      } else {
        await api.addAdminLocation(data);
      }
      onSave();
    } catch (error) {
      console.error(error);
      alert('Gagal menyimpan lokasi');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col md:flex-row relative">
        
        {/* Form Container */}
        <div className="p-6 flex-1 flex flex-col gap-4 border-r border-slate-100 min-w-[320px] max-w-sm shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-800">{location ? 'Edit Lokasi' : 'Tambah Lokasi'}</h2>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 md:hidden"><X size={20} /></button>
          </div>
          
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 h-full">
            <div className="relative">
              <label className="text-xs font-bold text-slate-500 uppercase">Cari Tempat (MapTiler)</label>
              <div className="relative mt-1">
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={e => handleSearchChange(e.target.value)}
                  placeholder="Cari nama gedung atau alamat..." 
                  className="w-full pl-10 p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#B21B1B]/20 outline-none" 
                />
                <Search size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
              </div>
              {suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-60 overflow-y-auto">
                  {suggestions.map((place, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => handleSelectSuggestion(place)}
                      className="p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0"
                    >
                      <div className="text-sm font-bold text-slate-800 truncate">{place.text}</div>
                      <div className="text-xs text-slate-500 truncate">{place.place_name}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">Nama Lokasi</label>
              <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#B21B1B]/20 outline-none mt-1" />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">Alamat Detail (Opsional)</label>
              <input type="text" value={address} onChange={e => setAddress(e.target.value)} className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#B21B1B]/20 outline-none mt-1" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Latitude</label>
                <input type="number" step="any" required value={lat} onChange={handleLatChange} className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#B21B1B]/20 outline-none mt-1" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Longitude</label>
                <input type="number" step="any" required value={lng} onChange={handleLngChange} className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#B21B1B]/20 outline-none mt-1" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Radius (Meter)</label>
                <input type="number" min="10" required value={radius} onChange={e => setRadius(Number(e.target.value))} className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#B21B1B]/20 outline-none mt-1" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Max Akurasi GPS</label>
                <input type="number" min="10" required value={maxAccuracy} onChange={e => setMaxAccuracy(Number(e.target.value))} className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#B21B1B]/20 outline-none mt-1" />
              </div>
            </div>

            <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 cursor-pointer hover:bg-slate-100">
              <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="w-5 h-5 rounded text-[#B21B1B] focus:ring-[#B21B1B]/20 cursor-pointer" />
              <div className="text-sm font-bold text-slate-800">Lokasi Aktif</div>
            </label>

            <div className="mt-auto pt-4 flex gap-3">
              <button type="button" onClick={onClose} className="flex-1 p-3 rounded-xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">Batal</button>
              <button type="submit" disabled={isSubmitting} className="flex-1 p-3 rounded-xl font-bold bg-[#B21B1B] text-white hover:bg-[#901515] transition-colors disabled:opacity-50">
                {isSubmitting ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </form>
        </div>
        
        {/* Map Container */}
        <div className="flex-1 min-h-[400px] md:min-h-[600px] relative">
          <button onClick={onClose} className="absolute right-4 top-4 p-2 bg-white hover:bg-slate-100 rounded-full text-slate-500 z-10 hidden md:block shadow-md"><X size={20} /></button>
          
          <button 
            type="button"
            onClick={handleLocateMe}
            className="absolute left-4 top-4 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl shadow-md z-10 flex items-center gap-2"
          >
            <Navigation size={14} className="text-blue-500" /> Gunakan Lokasi Saya Saat Ini
          </button>

          {mapError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100 z-0 p-8 text-center border-l border-slate-200">
              <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-4">
                <MapPin size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Peta Tidak Dapat Dimuat</h3>
              <p className="text-slate-500 text-sm max-w-sm">API Key MapTiler (VITE_MAPTILER_API_KEY) belum dikonfigurasi atau tidak valid. Anda tetap dapat memasukkan koordinat Latitude dan Longitude secara manual pada form.</p>
            </div>
          )}
          <div ref={mapRef} className={`w-full h-full bg-slate-100 ${mapError ? 'invisible' : 'visible'}`}></div>
        </div>
      </div>
    </div>
  );
}

interface EmployeeLocationModalProps {
  employeeId: number;
  employeeName: string;
  onClose: () => void;
}

export function EmployeeLocationModal({ employeeId, employeeName, onClose }: EmployeeLocationModalProps) {
  const [allLocations, setAllLocations] = useState<Location[]>([]);
  const [assignedIds, setAssignedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      api.getAdminLocations(),
      api.getEmployeeLocations(employeeId)
    ]).then(([locs, assigned]) => {
      setAllLocations(locs);
      setAssignedIds(new Set(assigned.map(a => a.location_id)));
      setLoading(false);
    });
  }, [employeeId]);

  const toggleLocation = (id: number) => {
    const newSet = new Set(assignedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setAssignedIds(newSet);
  };

  const handleSave = async () => {
    setSaving(true);
    const locationsToSave: EmployeeLocation[] = Array.from(assignedIds).map((id: number) => ({
      location_id: id,
      is_primary: false
    }));
    await api.updateEmployeeLocations(employeeId, locationsToSave);
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="font-bold text-slate-800">Atur Lokasi Kerja</h2>
            <p className="text-xs text-slate-500 mt-1">{employeeName}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-500"><X size={20} /></button>
        </div>
        <div className="p-4 sm:p-6 max-h-[60vh] overflow-y-auto space-y-3">
          {loading ? (
            <div className="text-center py-8 text-sm text-slate-400">Memuat data lokasi...</div>
          ) : allLocations.length === 0 ? (
            <div className="text-center py-8 text-sm text-slate-400">Belum ada lokasi kerja terdaftar.</div>
          ) : (
            allLocations.map(loc => (
              <label key={loc.id} className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-colors ${assignedIds.has(loc.id) ? 'border-[#B21B1B] bg-red-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                <input 
                  type="checkbox" 
                  checked={assignedIds.has(loc.id)} 
                  onChange={() => toggleLocation(loc.id)}
                  className="w-5 h-5 text-[#B21B1B] rounded focus:ring-[#B21B1B]"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-800 truncate">{loc.name}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5 truncate">{loc.address || 'Tanpa alamat detail'}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Radius: {loc.radius_meter}m</div>
                </div>
              </label>
            ))
          )}
        </div>
        <div className="p-4 sm:p-6 border-t border-slate-100 bg-white flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200">Batal</button>
          <button onClick={handleSave} disabled={saving || loading} className="flex-1 py-3 rounded-xl font-bold bg-[#B21B1B] text-white hover:bg-[#901515] disabled:opacity-50">
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}
