import * as XLSX from "xlsx";
import {KYCApplication} from "../types";
import {ExcelExportData} from "../types/excel";
import {CDNService} from "./CDNService";
import {Logger} from "../config/logger";

export class ExcelExportService {
  private cdnService = new CDNService();
  private logger = Logger.getInstance();

  public async exportToExcel(applications: KYCApplication[]): Promise<string> {
    try {
      const excelData = applications.map((app, index) =>
        this.generateExcelData(app, index + 1)
      );

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(excelData);

      // Set column widths
      const columnWidths = [
        {wch: 5}, // NO
        {wch: 12}, // TID
        {wch: 12}, // MID
        {wch: 12}, // Tgl FPA
        {wch: 25}, // NAMA CORPORATE AGEN
        {wch: 20}, // NAMA AGEN
        {wch: 40}, // ALAMAT
        {wch: 15}, // KOTA
        {wch: 10}, // PROVINSI
        {wch: 12}, // KODE DATI 2
        {wch: 15}, // NOMOR TELEPON
        {wch: 20}, // NAMA PEMILIK AGEN
        {wch: 20}, // NAMA PEMILIK REKENING
        {wch: 10}, // KODE BANK
        {wch: 20}, // NAMA BANK
        {wch: 15}, // NOMOR REKENING
        {wch: 15}, // JENIS KARTU ATM
        {wch: 25}, // BIDANG USAHA
        {wch: 15}, // TIPE EDC
        {wch: 15}, // SERIAL NUMBER EDC
        {wch: 8}, // MCC
        {wch: 15}, // JAM OPERASIONAL
        {wch: 20}, // FITUR MINI ATM
      ];

      worksheet["!cols"] = columnWidths;

      // Set headers
      const headers = [
        "NO",
        "TID",
        "MID",
        "Tgl FPA",
        "NAMA CORPORATE AGEN",
        "NAMA AGEN",
        "ALAMAT",
        "KOTA",
        "PROVINSI (INITIAL 3 DIGIT)",
        "KODE DATI 2",
        "NOMOR TELEPON PEMILIK",
        "NAMA PEMILIK AGEN",
        "NAMA PEMILIK REKENING",
        "KODE BANK (6 Digit)",
        "NAMA BANK",
        "NOMOR REKENING",
        "JENIS KARTU ATM AGEN (Debit/CC/GPN)",
        "BIDANG USAHA",
        "Tipe EDC",
        "Serial Number EDC",
        "MCC",
        "JAM OPERASIONAL OUTLET",
        "FITUR MINI ATM (Transfer, Cek Saldo)",
      ];

      XLSX.utils.sheet_add_aoa(worksheet, [headers], {origin: "A1"});

      XLSX.utils.book_append_sheet(workbook, worksheet, "KYC Data");

      const excelBuffer = XLSX.write(workbook, {
        type: "buffer",
        bookType: "xlsx",
      });

      const fileName = `kyc_export_${Date.now()}.xlsx`;
      const fileUrl = await this.cdnService.uploadFile(
        excelBuffer,
        fileName,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );

      this.logger.info("Excel export completed", {
        fileName,
        recordCount: applications.length,
        fileUrl,
      });

      return fileUrl;
    } catch (error) {
      this.logger.error("Excel export failed:", error);
      throw new Error("Failed to export Excel file");
    }
  }

  public generateExcelData(
    application: KYCApplication,
    index: number
  ): ExcelExportData {
    // Get bank code from bank name mapping
    const bankCode = this.getBankCode(application.bank_name);

    // Get province initial (first 3 characters)
    const provinceInitial = application.province_code?.substring(0, 3) || "";

    return {
      no: index,
      tid: application.tid || "",
      mid: application.mid || "",
      tgl_fpa: "24 Mei 2025", // Static data
      nama_corporate_agen: "PT. Ekosistem Pasar Digital", // Static data
      nama_agen: application.agent_name,
      alamat: application.address, // Dari OCR
      kota: application.city_name || "",
      provinsi_initial: provinceInitial,
      kode_dati_2: application.city_code || "",
      nomor_telepon_pemilik: application.pic_phone,
      nama_pemilik_agen: application.full_name, // Dari OCR
      nama_pemilik_rekening: application.account_holder_name,
      kode_bank: bankCode,
      nama_bank: application.bank_name,
      nomor_rekening: application.account_number,
      jenis_kartu_atm: "Debit/CC/GPN", // Static data
      bidang_usaha: application.business_field,
      tipe_edc: "Centerm - K9", // Static data
      serial_number_edc: "", // To be filled by other company
      mcc: application.mcc || "",
      jam_operasional: "07:00 - 22:00", // Static data
      fitur_mini_atm: "All Fitur", // Static data
    };
  }

  private getBankCode(bankName: string): string {
    const bankCodes: {[key: string]: string} = {
      "Bank Central Asia": "014",
      "Bank Mandiri": "008",
      "Bank Negara Indonesia": "009",
      "Bank Rakyat Indonesia": "002",
      "Bank CIMB Niaga": "022",
      "Bank Danamon": "011",
      "Bank Permata": "013",
      "Bank Syariah Indonesia": "451",
      "Bank Mega": "426",
      "Bank OCBC NISP": "028",
    };

    return bankCodes[bankName] || "000";
  }
}
