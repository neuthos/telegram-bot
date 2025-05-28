export interface UserSession {
  id?: number;
  telegram_id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  current_step: string;
  form_data: FormData;
  created_at?: Date;
  updated_at?: Date;
}

export interface RegisteredUser {
  id?: number;
  telegram_id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  nama: string;
  nomor_telepon: string;
  nomor_ktp: string;
  alamat: string;
  status: "draft" | "confirmed";
  created_at?: Date;
  updated_at?: Date;
}

export interface FormData {
  nama?: string;
  nomor_telepon?: string;
  nomor_ktp?: string;
  alamat?: string;
}

export enum SessionStep {
  MENU = "menu",
  REGISTRATION_START = "registration_start",
  NAMA = "nama",
  NOMOR_TELEPON = "nomor_telepon",
  NOMOR_KTP = "nomor_ktp",
  ALAMAT = "alamat",
  CONFIRMATION = "confirmation",
}
