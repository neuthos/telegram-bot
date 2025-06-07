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

export interface KYCApplication {
  id?: number;
  telegram_id: number;
  username?: string;
  first_name?: string;
  last_name?: string;

  // Form fields
  agent_name: string;
  agent_address: string;
  owner_name: string;
  business_field: string;
  pic_name: string;
  pic_phone: string;
  id_card_number: string;
  tax_number?: string;
  account_holder_name: string;
  bank_name: string;
  account_number: string;

  // System fields
  confirm_date?: Date;
  signature_initial: string;
  // Removed signature_photo_path
  status: "draft" | "confirmed" | "rejected";
  remark?: string;
  pdf_url?: string;

  created_at?: Date;
  updated_at?: Date;
}

export interface KYCPhoto {
  id?: number;
  application_id: number;
  photo_type: "location_photos" | "bank_book" | "id_card"; // Removed signature
  file_path: string; // This will contain CDN URLs
  file_name: string;
  file_size?: number;
  uploaded_at?: Date;
}
export interface FormData {
  agent_name?: string;
  agent_address?: string;
  owner_name?: string;
  business_field?: string;
  pic_name?: string;
  pic_phone?: string;
  id_card_number?: string;
  tax_number?: string;
  account_holder_name?: string;
  bank_name?: string;
  account_number?: string;
  signature_initial?: string;
  location_photos?: string[];
  bank_book_photo?: string;
  id_card_photo?: string;
  terms_accepted?: boolean;
}

export enum SessionStep {
  MENU = "menu",
  REGISTRATION_START = "registration_start",

  // Text inputs
  AGENT_NAME = "agent_name",
  AGENT_ADDRESS = "agent_address",
  OWNER_NAME = "owner_name",
  BUSINESS_FIELD = "business_field",
  PIC_NAME = "pic_name",
  PIC_PHONE = "pic_phone",
  ID_CARD_NUMBER = "id_card_number",
  TAX_NUMBER = "tax_number",
  ACCOUNT_HOLDER_NAME = "account_holder_name",
  BANK_NAME = "bank_name",
  ACCOUNT_NUMBER = "account_number",
  SIGNATURE_INITIAL = "signature_initial",

  // Photo uploads
  LOCATION_PHOTOS = "location_photos",
  BANK_BOOK_PHOTO = "bank_book_photo",
  ID_CARD_PHOTO = "id_card_photo",

  // Terms and Confirmation
  TERMS_CONDITIONS = "terms_conditions",
  CONFIRMATION = "confirmation",
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
}

export interface KYCListItem {
  id: number;
  telegram_id: number;
  agent_name: string;
  pic_name: string;
  status: "draft" | "confirmed" | "rejected";
  created_at: Date;
  pdf_url?: string;
  remark?: string;
}

export interface RejectRequest {
  remark: string;
}

export interface KYCListResponse {
  id: number;
  telegram_id: number;
  agent_name: string;
  pic_name: string;
  pic_phone: string;
  status: "draft" | "confirmed" | "rejected";
  created_at: Date;
  pdf_url?: string;
  remark?: string;
}
