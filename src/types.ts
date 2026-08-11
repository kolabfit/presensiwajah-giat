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
  id?: number | string;
  admin_id?: string;
  password?: string;
  role?: 'SUPERADMIN' | 'ADMIN';
  is_active?: boolean;
  last_login?: string;
  created_at?: string;
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

export interface TicketMessage {
  id: number;
  sender_type: 'REPORTER' | 'SUPERADMIN';
  sender_user_id?: string;
  message: string;
  attachment_file_id?: string;
  attachment_url?: string;
  created_at: string;
}

export interface Ticket {
  id: number;
  ticket_number: string;
  employee_id?: number;
  reporter_name: string;
  category: string;
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'NEW' | 'IN_PROGRESS' | 'WAITING_REPORTER' | 'RESOLVED' | 'DUPLICATE' | 'REJECTED';
  screenshot_file_id?: string;
  screenshot_url?: string;
  browser?: string;
  operating_system?: string;
  device?: string;
  ip_address?: string;
  page_url?: string;
  api_endpoint?: string;
  http_status?: number;
  error_code?: string;
  error_message?: string;
  gps_accuracy?: number;
  location_name?: string;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
}

export interface AuditLog {
  id: number;
  actor: string;
  role: string;
  action: string;
  module: string;
  target: string;
  old_value: any;
  new_value: any;
  ip_address: string;
  user_agent: string;
  created_at: string;
}

export interface SystemHealth {
  backend: 'ONLINE' | 'WARNING' | 'ERROR';
  mysql: 'ONLINE' | 'WARNING' | 'ERROR';
  cdn: 'ONLINE' | 'WARNING' | 'ERROR';
  localDisk: 'OK' | 'WARNING' | 'ERROR';
}
