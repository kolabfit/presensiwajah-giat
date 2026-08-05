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
  Accuracy?: number | null;
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
  id?: number;
  name: string;
  status: string;
  photo_file_id?: string | null;
  photo_url?: string | null;
  face_registered?: boolean;
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

export interface Location {
  id: number;
  name: string;
  address?: string;
  place_id?: string;
  latitude: number;
  longitude: number;
  radius_meter: number;
  max_accuracy_meter: number;
  is_active: boolean;
}

export interface EmployeeLocation {
  location_id: number;
  is_primary: boolean;
  name?: string;
  address?: string;
  is_active?: boolean;
}
