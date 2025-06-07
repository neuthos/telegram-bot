import puppeteer from "puppeteer";
import {KYCApplication, KYCPhoto} from "../types";
import {Logger} from "../config/logger";
import {CDNService} from "./CDNService";

export class PDFService {
  private logger = Logger.getInstance();
  private cdnService = new CDNService();

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

      const pdfBuffer = await page.pdf({
        format: "A4",
        margin: {top: "15mm", right: "15mm", bottom: "15mm", left: "15mm"},
        printBackground: true,
      });

      const pdfUrl = await this.cdnService.uploadFile(
        pdfBuffer,
        fileName,
        "application/pdf"
      );

      this.logger.info("PDF generated and uploaded:", {
        applicationId: application.id,
        fileName,
        pdfUrl,
      });

      return pdfUrl;
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
          <title>Formulir KYC - ${application.agent_name}</title>
          <link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&display=swap" rel="stylesheet">
          <style>
            @page {
              size: A4;
              margin: 15mm;
            }
            
            body { 
              font-family: Arial, sans-serif; 
              margin: 0; 
              padding: 0;
              font-size: 11px;
              line-height: 1.4;
            }
            
            .page {
              page-break-after: always;
              min-height: 90vh;
              padding: 20px;
            }
            
            .page:last-child {
              page-break-after: avoid;
            }
            
            /* PAGE 1 - FORMULIR */
            .form-header {
              text-align: center;
              margin-bottom: 20px;
              border-bottom: 2px solid #000;
              padding-bottom: 15px;
            }
            
            .form-title {
              font-size: 14px;
              font-weight: bold;
              text-transform: uppercase;
              margin: 0;
            }
            
            .form-subtitle {
              font-size: 12px;
              margin: 5px 0 0 0;
            }
            
            .section {
              margin-bottom: 20px;
              border: 1px solid #000;
              padding: 10px;
            }
            
            .section-title {
              background: #000;
              color: white;
              padding: 5px 10px;
              margin: -10px -10px 10px -10px;
              font-weight: bold;
              font-size: 12px;
            }
            
            .form-row {
              display: flex;
              margin-bottom: 8px;
              align-items: center;
            }
            
            .form-label {
              width: 180px;
              font-weight: bold;
              flex-shrink: 0;
            }
            
            .form-value {
              flex: 1;
              border-bottom: 1px solid #000;
              padding: 2px 5px;
              min-height: 16px;
            }
            
            .empty-box {
              border: 1px solid #ccc;
              height: 20px;
              background: #f9f9f9;
            }
            
            .signature-area {
              display: flex;
              justify-content: space-between;
              margin-top: 30px;
            }
            
            .signature-box {
              text-align: center;
              width: 200px;
            }
            
            .signature-line {
              border-bottom: 1px solid #000;
              height: 60px;
              margin-bottom: 5px;
              display: flex;
              align-items: flex-end;
              justify-content: center;
              padding-bottom: 10px;
            }
            
            .signature-text {
              font-family: 'Dancing Script', cursive;
              font-size: 24px;
              font-weight: bold;
              color: #000;
            }
            
            .meterai-box {
              width: 80px;
              height: 80px;
              border: 2px solid #000;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 10px;
              font-weight: bold;
            }
            
            /* PAGE 2 - VERIFIKASI */
            .checklist {
              margin: 20px 0;
            }
            
            .checklist-item {
              display: flex;
              align-items: center;
              margin-bottom: 15px;
              font-size: 12px;
            }
            
            .checkbox {
              width: 16px;
              height: 16px;
              border: 2px solid #000;
              margin-right: 10px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: bold;
              font-size: 14px;
            }
            
            .checkbox.checked {
              background: #000;
              color: white;
            }
            
            /* PAGE 3 - PHOTOS */
            .photo-section {
              margin-bottom: 30px;
            }
            
            .photo-title {
              font-size: 14px;
              font-weight: bold;
              margin-bottom: 10px;
              border-bottom: 1px solid #000;
              padding-bottom: 5px;
            }
            
            .photo-grid {
              display: flex;
              flex-wrap: wrap;
              gap: 15px;
            }
            
            .photo-item {
              max-width: 250px;
              text-align: center;
            }
            
            .photo-img {
              width: 100%;
              max-height: 200px;
              object-fit: contain;
              border: 1px solid #ddd;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            
            .photo-caption {
              font-size: 10px;
              margin-top: 5px;
              color: #666;
            }
          </style>
        </head>
        <body>
          <!-- PAGE 1: FORMULIR INFORMASI AGEN -->
          <div class="page">
            <div class="form-header">
              <h1 class="form-title">Formulir Informasi Agen Layanan Bersama Mudah Artajasa</h1>
            </div>

            <!-- Section 1: Informasi Agen (Badan Usaha) - KOSONG -->
            <div class="section">
              <div class="section-title">1. INFORMASI AGEN (BADAN USAHA)</div>
              <div class="form-row">
                <div class="form-label">Nama Badan Usaha:</div>
                <div class="form-value empty-box"></div>
              </div>
              <div class="form-row">
                <div class="form-label">Alamat Badan Usaha:</div>
                <div class="form-value empty-box"></div>
              </div>
              <div class="form-row">
                <div class="form-label">NPWP Badan Usaha:</div>
                <div class="form-value empty-box"></div>
              </div>
            </div>

            <!-- Section 2: Perorangan - AUTO POPULATED -->
            <div class="section">
              <div class="section-title">2. INFORMASI PERORANGAN</div>
              <div class="form-row">
                <div class="form-label">Nama Agen:</div>
                <div class="form-value">${application.agent_name}</div>
              </div>
              <div class="form-row">
                <div class="form-label">Alamat Agen:</div>
                <div class="form-value">${application.agent_address}</div>
              </div>
              <div class="form-row">
                <div class="form-label">Nama Pemilik:</div>
                <div class="form-value">${application.owner_name}</div>
              </div>
              <div class="form-row">
                <div class="form-label">Bidang Usaha:</div>
                <div class="form-value">${application.business_field}</div>
              </div>
              <div class="form-row">
                <div class="form-label">Nama PIC:</div>
                <div class="form-value">${application.pic_name}</div>
              </div>
              <div class="form-row">
                <div class="form-label">Nomor Telepon PIC:</div>
                <div class="form-value">${application.pic_phone}</div>
              </div>
              <div class="form-row">
                <div class="form-label">Nomor KTP:</div>
                <div class="form-value">${application.id_card_number}</div>
              </div>
              <div class="form-row">
                <div class="form-label">Nomor NPWP:</div>
                <div class="form-value">${application.tax_number || "-"}</div>
              </div>
            </div>

            <!-- Section 3: Informasi Rekening -->
            <div class="section">
              <div class="section-title">3. INFORMASI REKENING</div>
              <div class="form-row">
                <div class="form-label">Nama Pemilik Rekening:</div>
                <div class="form-value">${application.account_holder_name}</div>
              </div>
              <div class="form-row">
                <div class="form-label">Nama Bank:</div>
                <div class="form-value">${application.bank_name}</div>
              </div>
              <div class="form-row">
                <div class="form-label">Nomor Rekening:</div>
                <div class="form-value">${application.account_number}</div>
              </div>
            </div>

            <!-- Signature Area -->
            <div class="signature-area">
              <div class="signature-box">
                <div class="meterai-box">METERAI<br>10.000</div>
                <p style="margin-top: 10px; font-size: 10px;">Meterai & Cap</p>
              </div>
              
              <div class="signature-box">
                <div class="signature-line">
                  <span class="signature-text">${
                    application.signature_initial
                  }</span>
                </div>
                <p style="margin: 0; font-size: 10px;">Tanda Tangan Pemohon</p>
                <p style="margin: 0; font-size: 10px;">${new Date().toLocaleDateString(
                  "id-ID"
                )}</p>
              </div>
            </div>
          </div>

          <!-- PAGE 2: VERIFIKASI DOKUMEN -->
          <div class="page">
            <div class="form-header">
              <h1 class="form-title">Verifikasi Kelengkapan Dokumen</h1>
              <p class="form-subtitle">Checklist Dokumen yang Diperlukan</p>
            </div>

            <div class="section">
              <div class="section-title">DOKUMEN YANG HARUS DILAMPIRKAN</div>
              
              <div class="checklist">
                <div class="checklist-item">
                  <div class="checkbox checked">✓</div>
                  <span><strong>Foto Lokasi Usaha/Agen</strong> - Minimal 2 foto yang menunjukkan lokasi dan suasana tempat usaha</span>
                </div>
                
                <div class="checklist-item">
                  <div class="checkbox checked">✓</div>
                  <span><strong>Foto Buku Rekening/Kartu ATM</strong> - Foto halaman yang menunjukkan nama pemilik dan nomor rekening dengan jelas</span>
                </div>
                
                <div class="checklist-item">
                  <div class="checkbox checked">✓</div>
                  <span><strong>Foto KTP Pemilik</strong> - KTP yang masih berlaku, foto harus jelas dan dapat dibaca semua informasi</span>
                </div>
              </div>
            </div>

            <div class="section">
              <div class="section-title">INFORMASI PENGAJUAN</div>
              <div class="form-row">
                <div class="form-label">Status:</div>
                <div class="form-value" style="color: ${
                  application.status === "confirmed"
                    ? "green"
                    : application.status === "rejected"
                    ? "red"
                    : "orange"
                }; font-weight: bold;">
                  ${application.status.toUpperCase()}
                </div>
              </div>
              <div class="form-row">
                <div class="form-label">Tanggal Pengajuan:</div>
                <div class="form-value">${new Date(
                  application.created_at!
                ).toLocaleDateString("id-ID")}</div>
              </div>
              ${
                application.confirm_date
                  ? `
              <div class="form-row">
                <div class="form-label">Tanggal Konfirmasi:</div>
                <div class="form-value">${new Date(
                  application.confirm_date
                ).toLocaleDateString("id-ID")}</div>
              </div>
              `
                  : ""
              }
              ${
                application.remark
                  ? `
              <div class="form-row">
                <div class="form-label">Keterangan:</div>
                <div class="form-value">${application.remark}</div>
              </div>
              `
                  : ""
              }
            </div>
          </div>

          <!-- PAGE 3: FOTO-FOTO -->
          <div class="page">
            <div class="form-header">
              <h1 class="form-title">Lampiran Foto Dokumen</h1>
              <p class="form-subtitle">Dokumentasi Pendukung Aplikasi KYC</p>
            </div>

            ${
              photosByType.location_photos &&
              photosByType.location_photos.length > 0
                ? `
            <div class="photo-section">
              <div class="photo-title">📍 FOTO LOKASI USAHA (${
                photosByType.location_photos.length
              } foto)</div>
              <div class="photo-grid">
                ${photosByType.location_photos
                  .map(
                    (photo, index) => `
                  <div class="photo-item">
                    <img src="${
                      photo.file_path
                    }" class="photo-img" alt="Foto Lokasi ${index + 1}">
                    <div class="photo-caption">Foto Lokasi ${index + 1}</div>
                  </div>
                `
                  )
                  .join("")}
              </div>
            </div>
            `
                : ""
            }

            ${
              photosByType.bank_book && photosByType.bank_book.length > 0
                ? `
            <div class="photo-section">
              <div class="photo-title">🏦 FOTO BUKU REKENING</div>
              <div class="photo-grid">
                ${photosByType.bank_book
                  .map(
                    (photo, index) => `
                  <div class="photo-item">
                    <img src="${photo.file_path}" class="photo-img" alt="Foto Buku Rekening">
                    <div class="photo-caption">Buku Rekening - ${application.bank_name}</div>
                  </div>
                `
                  )
                  .join("")}
              </div>
            </div>
            `
                : ""
            }

            ${
              photosByType.id_card && photosByType.id_card.length > 0
                ? `
            <div class="photo-section">
              <div class="photo-title">🆔 FOTO KTP</div>
              <div class="photo-grid">
                ${photosByType.id_card
                  .map(
                    (photo, index) => `
                  <div class="photo-item">
                    <img src="${photo.file_path}" class="photo-img" alt="Foto KTP">
                    <div class="photo-caption">KTP - ${application.id_card_number}</div>
                  </div>
                `
                  )
                  .join("")}
              </div>
            </div>
            `
                : ""
            }

            <div style="margin-top: 40px; text-align: center; font-size: 10px; color: #666;">
              <p>Dokumen ini digenerate secara otomatis pada ${new Date().toLocaleString(
                "id-ID"
              )}</p>
              <p>ID Aplikasi: ${application.id} | Telegram ID: ${
      application.telegram_id
    }</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }
}
