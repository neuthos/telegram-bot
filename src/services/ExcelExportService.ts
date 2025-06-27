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

      const exportDate = new Date().toISOString().split("T")[0];
      const fileName = `confirmed_agent_${exportDate}.xlsx`;

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

    const header = [
      "NO",
      "TID",
      "MID",
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
      "URL PDF",
    ];

    XLSX.utils.sheet_add_aoa(worksheet, [header], {origin: "A1"});

    // Add data rows
    for (let index = 0; index < applications.length; index++) {
      const app = applications[index];
      const rowData = await this.generateRowData(app, index + 1);
      XLSX.utils.sheet_add_aoa(worksheet, [rowData], {origin: `A${index + 2}`});
    }

    worksheet["!cols"] = [
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
      {wch: 22}, // NAMA PEMILIK REKENING
      {wch: 17}, // KODE BANK
      {wch: 15}, // NAMA BANK
      {wch: 15}, // NOMOR REKENING
      {wch: 15}, // JENIS KARTU ATM
      {wch: 25}, // BIDANG USAHA
      {wch: 11}, // Tipe EDC
      {wch: 16}, // Serial Number EDC
      {wch: 5}, // MCC
      {wch: 20}, // JAM OPERASIONAL
      {wch: 15}, // FITUR
      {wch: 50}, // URL PDF
    ];

    // Add header styling with background color
    const headerRange = XLSX.utils.decode_range("A1:X1");
    for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({r: 0, c: col});
      if (!worksheet[cellAddress]) continue;

      worksheet[cellAddress].s = {
        fill: {
          fgColor: {rgb: "4472C4"},
        },
        font: {
          bold: true,
          color: {rgb: "FFFFFF"},
        },
        alignment: {
          horizontal: "center",
          vertical: "center",
        },
        border: {
          top: {style: "thin", color: {rgb: "000000"}},
          bottom: {style: "thin", color: {rgb: "000000"}},
          left: {style: "thin", color: {rgb: "000000"}},
          right: {style: "thin", color: {rgb: "000000"}},
        },
      };
    }

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
      application.mid || "",
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
      "",
      application.mcc || "",
      "07:00 - 22:00",
      "All Fitur",
      application.stamped_pdf_url || application.pdf_url || "",
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
  ): Promise<{buffer: Buffer; fileName: string}> {
    const workbook = XLSX.utils.book_new();
    const worksheet = await this.createWorksheet(applications);
    XLSX.utils.book_append_sheet(workbook, worksheet, "KYC Data");

    const buffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    }) as Buffer;

    const exportDate = new Date().toISOString().split("T")[0];
    const fileName = `confirmed_agent_${exportDate}.xlsx`;

    return {buffer, fileName};
  }
}
