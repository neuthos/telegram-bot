import puppeteer from "puppeteer";
import path from "path";
import fs from "fs-extra";
import {KYCApplication, KYCPhoto} from "../types";
import {Logger} from "../config/logger";

export class PDFService {
  private logger = Logger.getInstance();
  private outputPath: string;

  constructor() {
    this.outputPath = process.env.PDF_OUTPUT_PATH || "public/pdfs";
  }

  public async generateKYCPDF(
    application: KYCApplication,
    photos: KYCPhoto[]
  ): Promise<string> {
    const browser = await puppeteer.launch({headless: true});

    try {
      const page = await browser.newPage();

      const html = this.generateHTMLTemplate(application, photos);
      await page.setContent(html, {waitUntil: "networkidle0"});

      const fileName = `kyc_${application.id}_${Date.now()}.pdf`;
      const filePath = path.join(this.outputPath, fileName);

      await fs.ensureDir(this.outputPath);

      await page.pdf({
        path: filePath,
        format: "A4",
        margin: {top: "20px", right: "20px", bottom: "20px", left: "20px"},
      });

      this.logger.info("PDF generated successfully:", {
        applicationId: application.id,
        fileName,
      });

      return fileName;
    } finally {
      await browser.close();
    }
  }

  private generateHTMLTemplate(
    application: KYCApplication,
    photos: KYCPhoto[]
  ): string {
    const photosByType = photos.reduce((acc, photo) => {
      if (!acc[photo.photo_type]) acc[photo.photo_type] = [];
      acc[photo.photo_type].push(photo);
      return acc;
    }, {} as Record<string, KYCPhoto[]>);

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>KYC Application - ${application.agent_name}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
            .section { margin-bottom: 25px; }
            .section-title { font-size: 16px; font-weight: bold; color: #333; margin-bottom: 10px; border-left: 4px solid #007bff; padding-left: 10px; }
            .data-row { display: flex; margin-bottom: 8px; }
            .label { font-weight: bold; width: 200px; }
            .value { flex: 1; }
            .photo-container { margin: 10px 0; }
            .photo { max-width: 200px; max-height: 200px; margin: 5px; border: 1px solid #ddd; }
            .status { padding: 5px 10px; border-radius: 5px; color: white; font-weight: bold; }
            .status.confirmed { background-color: #28a745; }
            .status.draft { background-color: #ffc107; color: #333; }
            .status.rejected { background-color: #dc3545; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>KYC Application Report</h1>
            <p>Generated on: ${new Date().toLocaleString("id-ID")}</p>
            <div class="status ${
              application.status
            }">${application.status.toUpperCase()}</div>
          </div>

          <div class="section">
            <div class="section-title">DATA AGEN & PEMILIK</div>
            <div class="data-row"><div class="label">Nama Agen:</div><div class="value">${
              application.agent_name
            }</div></div>
            <div class="data-row"><div class="label">Alamat Agen:</div><div class="value">${
              application.agent_address
            }</div></div>
            <div class="data-row"><div class="label">Nama Pemilik:</div><div class="value">${
              application.owner_name
            }</div></div>
            <div class="data-row"><div class="label">Bidang Usaha:</div><div class="value">${
              application.business_field
            }</div></div>
          </div>

          <div class="section">
            <div class="section-title">DATA PIC</div>
            <div class="data-row"><div class="label">Nama PIC:</div><div class="value">${
              application.pic_name
            }</div></div>
            <div class="data-row"><div class="label">Nomor Telepon:</div><div class="value">${
              application.pic_phone
            }</div></div>
          </div>

          <div class="section">
            <div class="section-title">DATA IDENTITAS</div>
            <div class="data-row"><div class="label">Nomor KTP:</div><div class="value">${
              application.id_card_number
            }</div></div>
            <div class="data-row"><div class="label">Nomor NPWP:</div><div class="value">${
              application.tax_number || "Tidak diisi"
            }</div></div>
          </div>

          <div class="section">
            <div class="section-title">DATA REKENING</div>
            <div class="data-row"><div class="label">Nama Pemilik Rekening:</div><div class="value">${
              application.account_holder_name
            }</div></div>
            <div class="data-row"><div class="label">Nama Bank:</div><div class="value">${
              application.bank_name
            }</div></div>
            <div class="data-row"><div class="label">Nomor Rekening:</div><div class="value">${
              application.account_number
            }</div></div>
          </div>

          <div class="section">
            <div class="section-title">TANDA TANGAN</div>
            <div class="data-row"><div class="label">Inisial:</div><div class="value">${
              application.signature_initial
            }</div></div>
          </div>

          <div class="section">
            <div class="section-title">DOKUMEN FOTO</div>
            ${
              photosByType.location_photos
                ? `
              <div class="photo-container">
                <strong>Foto Lokasi (${
                  photosByType.location_photos.length
                }):</strong><br>
                ${photosByType.location_photos
                  .map(
                    (photo) =>
                      `<img src="file://${path.resolve(
                        photo.file_path
                      )}" class="photo" alt="Foto Lokasi">`
                  )
                  .join("")}
              </div>
            `
                : ""
            }
            
            ${
              photosByType.bank_book?.[0]
                ? `
              <div class="photo-container">
                <strong>Foto Buku Rekening:</strong><br>
                <img src="file://${path.resolve(
                  photosByType.bank_book[0].file_path
                )}" class="photo" alt="Foto Buku Rekening">
              </div>
            `
                : ""
            }
            
            ${
              photosByType.id_card?.[0]
                ? `
              <div class="photo-container">
                <strong>Foto KTP:</strong><br>
                <img src="file://${path.resolve(
                  photosByType.id_card[0].file_path
                )}" class="photo" alt="Foto KTP">
              </div>
            `
                : ""
            }
            
            ${
              photosByType.signature?.[0]
                ? `
              <div class="photo-container">
                <strong>Foto Tanda Tangan:</strong><br>
                <img src="file://${path.resolve(
                  photosByType.signature[0].file_path
                )}" class="photo" alt="Foto Tanda Tangan">
              </div>
            `
                : ""
            }
          </div>

          <div class="section">
            <div class="section-title">INFORMASI SISTEM</div>
            <div class="data-row"><div class="label">Telegram ID:</div><div class="value">${
              application.telegram_id
            }</div></div>
            <div class="data-row"><div class="label">Username:</div><div class="value">${
              application.username || "Tidak ada"
            }</div></div>
            <div class="data-row"><div class="label">Tanggal Daftar:</div><div class="value">${new Date(
              application.created_at!
            ).toLocaleString("id-ID")}</div></div>
            ${
              application.confirm_date
                ? `<div class="data-row"><div class="label">Tanggal Konfirmasi:</div><div class="value">${new Date(
                    application.confirm_date
                  ).toLocaleString("id-ID")}</div></div>`
                : ""
            }
            ${
              application.remark
                ? `<div class="data-row"><div class="label">Keterangan:</div><div class="value">${application.remark}</div></div>`
                : ""
            }
          </div>
        </body>
      </html>
    `;
  }
}
