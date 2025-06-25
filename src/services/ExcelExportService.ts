import * as XLSX from "xlsx";
import {KYCApplication} from "../types";
import {CDNService} from "./CDNService";
import {Logger} from "../config/logger";
import {Database} from "../config/database";

export class ExcelExportService {
  private cdnService = new CDNService();
  private logger = Logger.getInstance();

  public async exportToExcel(applications: KYCApplication[]): Promise<string> {
    try {
      const workbook = XLSX.utils.book_new();

      const worksheet = await this.createWorksheet(applications);

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

  private async createWorksheet(applications: KYCApplication[]) {
    const worksheet = XLSX.utils.aoa_to_sheet([]);

    const header1 = [
      "NO",
      "TID",
      "",
      "MID",
      "",
      "",
      "",
      "Tgl FPA",
      "NAMA CORPOORATE AGEN",
      "NAMA AGEN",
      "ALAMAT",
      "KOTA",
      "PROVINSI (INTIAL 3 DIGIT)",
      "KODE DATI 2",
      "NOMOR TELEPON PEMILIK",
      "NAMA PEMILIK AGEN",
      "NAMA PEMILIK REKENING",
      "KODE BANK (6 Digit)",
      "NAMA BANK",
      "NOMOR REKENING",
      "JENIS KARTU ATM AGEN",
      "BIDANG USAHA",
      "Tipe EDC",
      "Serial Number EDC",
      "MCC",
      "JAM OPERASIONAL OUTLET",
      "FITUR",
      "URL",
    ];

    const header2 = [
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "(Debit/CC/GPN)",
      "",
      "",
      "",
      "",
      "",
      "MINI ATM (Transfer, Cek Saldo)",
      "",
    ];

    XLSX.utils.sheet_add_aoa(worksheet, [header1], {origin: "A1"});
    XLSX.utils.sheet_add_aoa(worksheet, [header2], {origin: "A2"});

    for (let index = 0; index < applications.length; index++) {
      const app = applications[index];
      const rowData = await this.generateRowData(app, index + 1);
      XLSX.utils.sheet_add_aoa(worksheet, [rowData], {origin: `A${index + 3}`});
    }

    worksheet["!cols"] = [
      {wch: 5},
      {wch: 12},
      {wch: 12},
      {wch: 12},
      {wch: 25},
      {wch: 20},
      {wch: 40},
      {wch: 15},
      {wch: 10},
      {wch: 12},
      {wch: 15},
      {wch: 20},
      {wch: 22},
      {wch: 17},
      {wch: 15},
      {wch: 15},
      {wch: 15},
      {wch: 25},
      {wch: 11},
      {wch: 16},
      {wch: 5},
      {wch: 15},
      {wch: 20},
      {wch: 17},
      {wch: 5},
      {wch: 15},
      {wch: 26},
      {wch: 10},
    ];

    worksheet["!merges"] = [
      {s: {c: 0, r: 0}, e: {c: 0, r: 1}},

      {s: {c: 1, r: 0}, e: {c: 2, r: 1}},

      {s: {c: 3, r: 0}, e: {c: 6, r: 1}},

      {s: {c: 7, r: 0}, e: {c: 7, r: 1}},

      {s: {c: 8, r: 0}, e: {c: 8, r: 1}},

      {s: {c: 9, r: 0}, e: {c: 9, r: 1}},

      {s: {c: 10, r: 0}, e: {c: 10, r: 1}},

      {s: {c: 11, r: 0}, e: {c: 11, r: 1}},

      {s: {c: 12, r: 0}, e: {c: 12, r: 1}},

      {s: {c: 13, r: 0}, e: {c: 13, r: 1}},

      {s: {c: 14, r: 0}, e: {c: 14, r: 1}},

      {s: {c: 15, r: 0}, e: {c: 15, r: 1}},

      {s: {c: 16, r: 0}, e: {c: 16, r: 1}},

      {s: {c: 17, r: 0}, e: {c: 17, r: 1}},

      {s: {c: 18, r: 0}, e: {c: 18, r: 1}},

      {s: {c: 19, r: 0}, e: {c: 19, r: 1}},

      {s: {c: 21, r: 0}, e: {c: 21, r: 1}},

      {s: {c: 22, r: 0}, e: {c: 22, r: 1}},

      {s: {c: 23, r: 0}, e: {c: 23, r: 1}},

      {s: {c: 24, r: 0}, e: {c: 24, r: 1}},

      {s: {c: 25, r: 0}, e: {c: 25, r: 1}},

      {s: {c: 27, r: 0}, e: {c: 27, r: 1}},
    ];

    return worksheet;
  }

  private async generateRowData(
    application: KYCApplication,
    index: number
  ): Promise<any[]> {
    const bankCode = await this.getBankCode(application.bank_name);
    const provinceInitial = application.province_code?.substring(0, 3) || "";
    const fullAddress = application.postal_code
      ? `${application.address}, ${application.postal_code}`
      : application.address;

    return [
      index,
      application.tid || "",
      "",
      application.mid || "",
      "",
      "",
      "",
      "2025-05-23",
      "PT. EKOSISTEM PASAR DIGITAL",
      application.agent_name,
      fullAddress,
      application.city_name || "",
      provinceInitial,
      application.city_code || "",
      application.pic_phone,
      application.full_name,
      application.account_holder_name,
      bankCode,
      application.bank_name,
      application.account_number,
      "Debit/CC/GPN",
      application.business_field,
      "Centerm - K9",
      application.serial_number_edc || "",
      application.mcc || "",
      "07:00 - 22:00",
      "All Fitur",
      application.google_drive_url || "", // Add Google Drive URL
    ];
  }

  private async getBankCode(bankName: string): Promise<string> {
    try {
      const db = Database.getInstance().getPool();
      const result = await db.query(
        "SELECT bank_code FROM banks WHERE bank_display = $1",
        [bankName]
      );

      if (result.rows.length > 0 && result.rows[0].bank_code) {
        return result.rows[0].bank_code.padStart(6, "0");
      }

      return "000000";
    } catch (error) {
      this.logger.error("Error getting bank code:", error);
      return "000000";
    }
  }

  public async exportToExcelBuffer(
    applications: KYCApplication[]
  ): Promise<Buffer> {
    const workbook = XLSX.utils.book_new();
    const worksheet = await this.createWorksheet(applications);
    XLSX.utils.book_append_sheet(workbook, worksheet, "KYC Data");

    return XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    }) as Buffer;
  }
}
