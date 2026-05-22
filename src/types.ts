export type Shift = string;

export interface AttendanceData {
  Timestamp?: string;
  Date: string;
  Name: string;
  Location: string;
  Shift: Shift;
  TimeIn: string;
  TimeOut: string;
  Status: 'Tepat Waktu' | 'Terlambat';
  Note: string;
}

export interface AdminConfig {
  id: string;
  password: string;
}

export interface Employee {
  name: string;
  status: string;
}

export interface AppSettings {
  barcode_content: string;
  late_threshold_minutes: string;
  [key: string]: string;
}
