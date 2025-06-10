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
  admin_confirmed_at?: Date;
  admin_rejected_at?: Date;
  confirmed_by_name?: string;
  confirmed_by_initial?: string;
  confirmed_by_partner?: string;
  user_emeterai_consent?: boolean;

  // System fields
  confirm_date?: Date;
  signature_initial: string;
  status: "draft" | "confirmed" | "rejected";
  remark?: string;
  pdf_url?: string;

  // E-Meterai fields
  emeterai_status: EmeteraiStatus;
  emeterai_transaction_id?: string;
  emeterai_token?: string;
  emeterai_token_expires?: Date;
  emeterai_sn?: string;
  stamped_pdf_url?: string;
  stamped_by?: string;
  stamped_at?: Date;

  created_at?: Date;
  updated_at?: Date;
}

export interface KYCPhoto {
  id?: number;
  application_id: number;
  photo_type: "location_photos" | "bank_book" | "id_card";
  file_path: string;
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
  emeterai_status: EmeteraiStatus;
  created_at: Date;
  pdf_url?: string;
  stamped_pdf_url?: string;
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
  emeterai_status: EmeteraiStatus;
  created_at: Date;
  pdf_url?: string;
  stamped_pdf_url?: string;
  remark?: string;
  stamped_by?: string;
  stamped_at?: Date;
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

export interface ConfirmRequest {
  name: string;
  initial: string;
  partner_name: string;
}

export interface RejectRequest {
  remark: string;
  name: string;
  initial: string;
  partner_name: string;
}

export interface BulkConfirmRequest {
  ids: number[];
  name: string;
  initial: string;
  partner_name: string;
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
