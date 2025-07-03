export interface UserSession {
  id?: number;
  partner_id: number;
  telegram_id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  current_step: SessionStep;
  form_data: FormData;
  created_at?: Date;
  updated_at?: Date;
}

export interface KYCApplication {
  id?: number;
  partner_id: number;
  telegram_id: number;
  username?: string;
  first_name?: string;
  last_name?: string;

  // Data dari OCR KTP
  full_name: string;
  address: string;
  religion?: string;
  occupation?: string;
  postal_code?: string;

  // Data manual input
  agent_name: string;
  owner_name: string;
  business_field: string;
  pic_name: string;
  pic_phone: string;
  id_card_number: string;
  tax_number?: string;
  account_holder_name: string;
  bank_name: string;
  account_number: string;
  serial_number_edc?: string;

  // Excel data yang tidak ada di form
  tid?: string;
  mid?: string;
  mcc?: string;

  province_code?: string;
  province_name?: string;
  city_code?: string;
  city_name?: string;

  status: "draft" | "confirmed" | "rejected";
  remark?: string;
  pdf_url?: string;
  confirmed_by_name?: string;
  confirmed_by_initial?: string;
  confirmed_by_partner?: string;
  pic_signature_image?: string; // NEW: Store signature image URL
  admin_confirmed_at?: Date;
  admin_rejected_at?: Date;
  emeterai_status: EmeteraiStatus;
  emeterai_transaction_id?: string;
  emeterai_sn?: string;
  stamped_pdf_url?: string;
  stamped_by?: string;
  stamped_at?: Date;
  user_emeterai_consent?: boolean;
  is_processed: boolean;
  is_reviewed_by_artajasa: boolean;
  google_drive_url?: string;

  created_at?: Date;
  updated_at?: Date;
}

export interface KYCPhoto {
  id?: number;
  partner_id: number;
  application_id: number;
  photo_type: "location_photos" | "bank_book" | "id_card" | "signature";
  file_url: string;
  file_name: string;
  file_size?: number;
  uploaded_at?: Date;
}
export interface FormData {
  full_name?: string; // dari KTP
  address?: string; // dari KTP
  religion?: string; // dari KTP
  occupation?: string; // dari KTP
  postal_code?: string; // tambahan untuk KTP

  // Data yang tetap manual input
  agent_name?: string;
  owner_name?: string;
  business_field?: string;
  pic_name?: string;
  pic_phone?: string;
  id_card_number?: string; // dari OCR KTP
  tax_number?: string;
  account_holder_name?: string;
  bank_name?: string;
  account_number?: string;
  account_owner_same?: boolean;
  serial_number_edc?: string;

  // Photo uploads
  id_card_photo?: string; // PERTAMA - untuk OCR
  signature_photo?: string; // Ganti dari signature_initial
  location_photos?: string[];
  bank_book_photo?: string;

  terms_accepted?: boolean;
  province_code?: string;
  province_name?: string;
  city_code?: string;
  city_name?: string;
  id_card_confirmed?: boolean;
  signature_confirmed?: boolean;
}

export enum SessionStep {
  MENU = "menu",
  REGISTRATION_START = "registration_start",

  // Flow baru - KTP upload pertama
  ID_CARD_PHOTO = "id_card_photo",
  POSTAL_CODE = "postal_code",

  // Data yang tidak ada di KTP
  AGENT_NAME = "agent_name",
  OWNER_NAME = "owner_name",
  BUSINESS_FIELD = "business_field",
  PIC_NAME = "pic_name",
  PIC_PHONE = "pic_phone",
  TAX_NUMBER = "tax_number",
  ACCOUNT_HOLDER_NAME = "account_holder_name",
  BANK_NAME = "bank_name",
  ACCOUNT_NUMBER = "account_number",

  SIGNATURE_PHOTO = "signature_photo",
  LOCATION_PHOTOS = "location_photos",
  BANK_BOOK_PHOTO = "bank_book_photo",

  // Final steps
  TERMS_CONDITIONS = "terms_conditions",
  CONFIRMATION = "confirmation",

  PROVINCE_SELECTION = "province_selection",
  CITY_SELECTION = "city_selection",
  ACCOUNT_OWNER_CONFIRMATION = "account_owner_confirmation",
  SERIAL_NUMBER_EDC = "serial_number_edc",

  ID_CARD_PREVIEW = "id_card_preview",
  SIGNATURE_PREVIEW = "signature_preview",
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
  emeterai_status: EmeteraiStatus;
  created_at: Date;
  pdf_url?: string;
  stamped_pdf_url?: string;
  remark?: string;
  is_processed: boolean;
}

export interface RejectRequest {
  remark: string;
}

export interface KYCListResponse {
  id: number;
  telegram_id: number;
  agent_name: string;
  province_name?: string;
  city_name?: string;
  pic_name: string;
  pic_phone: string;
  status: "draft" | "confirmed" | "rejected";
  emeterai_status: EmeteraiStatus;
  is_processed: boolean;
  created_at: Date;
  pdf_url?: string;
  stamped_pdf_url?: string;
  remark?: string;
  stamped_by?: string;
  stamped_at?: Date;
  google_drive_url?: string;
}

// E-Meterai specific types
export enum EmeteraiStatus {
  NOT_STARTED = "not_started",
  GETTING_TOKEN = "getting_token",
  CONVERTING_PDF = "converting_pdf",
  UPLOADING_DOCUMENT = "uploading_document",
  GENERATING_SN = "generating_sn",
  STAMPING = "stamping",
  DOWNLOADING = "downloading",
  COMPLETED = "completed",
  FAILED = "failed",
}

export interface EmeteraiTokenResponse {
  response_code: string;
  response_message: string;
  http_response: number;
  data: {
    MCPToken: {
      Token: {
        jwt: string;
        expiredDate: string;
      };
    };
    ClientInfo: {
      id: string;
      phone: string;
      email: string;
      company_name: string;
      address: string;
    };
    balanceInfo: {
      balance_money: number;
      invoice: number;
      limit_invoice: number;
      type: string;
      lastUpdatedAt: string;
    };
  };
}

export interface EmeteraiUploadResponse {
  response_code: string;
  response_message: string;
  data: {
    transaction_id: string;
  };
}

export interface EmeteraiGenerateSNResponse {
  response_code: string;
  response_message: string;
  data: {
    sn_meterai: string;
  };
}

export interface EmeteraiStampRequest {
  stamped_by: string;
  coordinates?: {
    lowerLeftX: number;
    lowerLeftY: number;
    upperRightX: number;
    upperRightY: number;
    page: number;
  };
}

export interface EmeteraiStatusResponse {
  id: number;
  emeterai_status: EmeteraiStatus;
  emeterai_transaction_id?: string;
  stamped_pdf_url?: string;
  stamped_by?: string;
  stamped_at?: Date;
  error_message?: string;
}

export interface BulkStampRequest {
  applications: Array<{
    id: number;
    stamped_by: string;
    coordinates?: {
      lowerLeftX: number;
      lowerLeftY: number;
      upperRightX: number;
      upperRightY: number;
      page: number;
    };
  }>;
}

export interface RejectRequest {
  remark: string;
  name: string;
  initial: string;
  partner_name: string;
}

export interface ConfirmRequest {
  name: string;
  pic_signature_image: string;
}

export interface BulkConfirmRequest {
  ids: number[];
  name: string;
  pic_signature_image: string;
}
export interface BulkRejectRequest {
  applications: Array<{
    id: number;
    remark: string;
  }>;
  name: string;
  initial: string;
  partner_name: string;
}

export interface CreateKYCRequest {
  partner_id: number;
  telegram_id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  form_data: {
    full_name: string;
    address: string;
    religion?: string;
    occupation?: string;
    postal_code?: string;
    agent_name: string;
    owner_name: string;
    business_field: string;
    pic_name: string;
    pic_phone: string;
    id_card_number: string;
    tax_number?: string;
    account_holder_name: string;
    bank_name: string;
    account_number: string;
    serial_number_edc?: string;
    id_card_photo: string;
    signature_photo: string;
    location_photos: string[];
    bank_book_photo: string;
    terms_accepted: boolean;
    province_code?: string;
    province_name?: string;
    city_code?: string;
    city_name?: string;
    id_card_confirmed: boolean;
    signature_confirmed: boolean;
  };
}

export interface Partner {
  id: number;
  name: string;
  bot_token: string;
  api_secret: string;
  webhook_url?: string;
  is_active: boolean;
  rate_limit: number;
  emeterai_client_id?: string;
  emeterai_client_email?: string;
  emeterai_client_password?: string;
  created_at: Date;
  updated_at: Date;
}

export interface BotInstance {
  id: number;
  partner_id: number;
  instance_id: string;
  hostname: string;
  status: "active" | "inactive" | "error";
  last_heartbeat: Date;
  created_at: Date;
}

export interface OCRKTPResponse {
  success: boolean;
  data?: {
    nik: string;
    nama: string;
    tempat_lahir?: string;
    tanggal_lahir?: string;
    jenis_kelamin?: string;
    golongan_darah?: string;
    alamat: string;
    rt_rw?: string;
    kelurahan_desa?: string;
    kecamatan?: string;
    agama?: string;
    status_perkawinan?: string;
    pekerjaan?: string;
    kewarganegaraan?: string;
    berlaku_hingga?: string;
    provinsi: string;
    kota: string;
  };
  message?: string;
}

export interface SignatureProcessResponse {
  success: boolean;
  data?: {
    processed_image_url: string;
    width: number;
    height: number;
  };
  message?: string;
}
