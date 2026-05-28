export type Shift = string;

export interface AttendanceData {
  Id?: number;
  Timestamp?: string;
  Date: string;
  Name: string;
  Location: string;
  Shift: Shift;
  TimeIn: string;
  TimeOut: string;
  Status: 'Tepat Waktu' | 'Terlambat';
  Note: string;
  PhotoDataUrl?: string;
  Latitude?: number | null;
  Longitude?: number | null;
  CheckInPhotoFileId?: string;
  CheckInPhotoUrl?: string;
  CheckInLatitude?: number | string | null;
  CheckInLongitude?: number | string | null;
  CheckOutPhotoFileId?: string;
  CheckOutPhotoUrl?: string;
  CheckOutLatitude?: number | string | null;
  CheckOutLongitude?: number | string | null;
}

export interface AdminConfig {
  id: string;
  password: string;
}

export interface Employee {
  name: string;
  status: string;
  qr_code?: string;
  qr_file_id?: string | null;
  qr_url?: string | null;
  photo_file_id?: string | null;
  photo_url?: string | null;
  photoDataUrl?: string;
}

export interface AttendancePhoto {
  attendanceId: number;
  type: 'masuk' | 'pulang';
  date: string;
  name: string;
  location: string;
  shift: string;
  time: string;
  fileId: string;
  url: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
}

export interface AppSettings {
  barcode_content: string;
  late_threshold_minutes: string;
  attendance_cleanup_enabled?: string;
  attendance_cleanup_days?: string;
  [key: string]: string | undefined;
}
