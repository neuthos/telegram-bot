// src/types/excel.ts - Baru untuk Excel export

import {KYCApplication} from ".";

export interface ExcelExportData {
  no: number;
  tid?: string;
  mid?: string;
  tgl_fpa: string;
  nama_corporate_agen: string;
  nama_agen: string;
  alamat: string;
  kota: string;
  provinsi_initial: string;
  kode_dati_2: string;
  nomor_telepon_pemilik: string;
  nama_pemilik_agen: string;
  nama_pemilik_rekening: string;
  kode_bank: string;
  nama_bank: string;
  nomor_rekening: string;
  jenis_kartu_atm: string;
  bidang_usaha: string;
  tipe_edc: string;
  serial_number_edc?: string;
  mcc?: string;
  jam_operasional: string;
  fitur_mini_atm: string;
}

export interface ExcelExportService {
  exportToExcel(applications: KYCApplication[]): Promise<string>;
  generateExcelData(
    application: KYCApplication,
    index: number
  ): ExcelExportData;
}
