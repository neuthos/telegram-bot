// src/services/PdfService.ts - Updated untuk flow baru

import puppeteer from "puppeteer";
import {KYCApplication, KYCPhoto} from "../types";
import {Logger} from "../config/logger";
import {CDNService} from "./CDNService";
import {EmeteraiService} from "./EMateraiService";

export class PDFService {
  private logger = Logger.getInstance();
  private cdnService = new CDNService();
  private emateraiService = new EmeteraiService();

  public async generateKYCPDF(
    application: KYCApplication,
    photos: KYCPhoto[]
  ): Promise<string> {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
      const page = await browser.newPage();

      const html = this.generateHTMLTemplate(application, photos);

      await page.setContent(html, {waitUntil: "networkidle0"});

      const fileName = `kyc_${application.id}_${Date.now()}.pdf`;

      const pdfBuffer = await page.pdf({
        format: "A4",
        margin: {top: "0px", right: "0px", bottom: "0px", left: "0px"},
        printBackground: true,
      });

      const convertedBuffer = await this.emateraiService.pdfConvert(
        application.id as number,
        pdfBuffer,
        application.partner_id
      );

      const pdfUrl = await this.cdnService.uploadFile(
        convertedBuffer,
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

  formatAddress = (address: string) => {
    if (!address) return {line1: "", line2: "", line3: ""};

    const addressParts = address.split(",").map((part) => part.trim());

    if (addressParts.length <= 3) {
      return {
        line1: addressParts[0] || "",
        line2: addressParts[1] || "",
        line3: addressParts[2] || "",
      };
    } else {
      const line1 = addressParts[0];
      const line2 = addressParts.slice(1, -2).join(", ");
      const line3 = addressParts.slice(-2).join(", ");

      return {line1, line2, line3};
    }
  };

  private generateHTMLTemplate(
    application: KYCApplication,
    photos: KYCPhoto[]
  ): string {
    const today = new Date();
    const day = today.getDate();
    const month = today.toLocaleString("id-ID", {month: "long"});
    const year = today.getFullYear().toString().slice(-2);

    // Use OCR data untuk address
    const addressFormatted = this.formatAddress(application.address || "");
    const addressLine1 = addressFormatted.line1;
    const addressLine2 = addressFormatted.line2;
    const addressLine3 = addressFormatted.line3;

    // Separate photos into different pages
    const photoPages = this.generatePhotoPages(photos);

    const partnerName = application.confirmed_by_partner || "Partner";
    const confirmedByName = application.confirmed_by_name || "Admin";
    const confirmedByInitial = application.confirmed_by_initial || "Admin";

    // Get signature photo untuk display
    const signaturePhoto = photos.find((p) => p.photo_type === "signature");
    const signatureDisplay = signaturePhoto
      ? `<img src="${signaturePhoto.file_url}" alt="Signature" class="max-w-full max-h-full object-contain" style="width: 200px; height: 60px;" />`
      : `<div class="signature-initials">${application.pic_name}</div>`;

    return `
      <!DOCTYPE html>
      <html lang="id">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Formulir Agen - ${application.agent_name}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
          <link href="https://fonts.googleapis.com/css2?family=Caramel&display=swap" rel="stylesheet" />
          <style>
            .signature-initials { font-family: "Caramel", cursive; font-size: 1.8em; }
            @media print {
              @page { size: A4; margin: 0; }
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .page { height: 297mm; overflow: hidden; page-break-after: always; page-break-inside: avoid; }
              .page:last-child { page-break-after: avoid; }
            }
            @media screen {
              body { background-color: #d1d5db; }
              .page { width: 210mm; height: 297mm; box-shadow: 0 0 10px rgba(0,0,0,0.1); margin: 20px auto; overflow: hidden; }
            }
          </style>
        </head>
        <body class="bg-gray-300 text-gray-800 text-xs">
          <!-- Halaman 1: Form Data -->
          <div class="page bg-white p-6 border border-gray-400 flex flex-col justify-between">
            <div>
              <div class="text-center font-bold border-b border-b-2 border-black pb-2 mb-3">
                FORMULIR INFORMASI AGEN LAYANAN BERSAMA MUDAH ARTAJASA
              </div>
              <div class="bg-black text-white font-bold px-3 py-1 mt-2 mb-3">
                INFORMASI AGEN
              </div>
              <div class="flex">
                <input type="checkbox" id="jenisBadanUsaha" name="jenisAgen" class="mr-3 w-4 h-4 accent-gray-800" />
                <div class="grid grid-cols-[130px_1fr] gap-x-3 gap-y-1 items-center w-full">
                  <label for="jenisBadanUsaha" class="text-xs font-semibold">Badan Usaha</label>
                  <br />
                  <label for="namaAgenBU" class="text-[10px] text-left pr-3">Nama Agen</label>
                  <input type="text" class="w-full border-0 border-b border-gray-600 bg-transparent text-[10px] focus:outline-none" />
                  <label for="alamatAgenBU_1" class="text-[10px] text-left pr-3 self-start">Alamat Agen</label>
                  <div>
                    <input type="text" class="w-full border-0 border-b border-gray-600 bg-transparent text-[10px] focus:outline-none" />
                    <input type="text" class="w-full border-0 border-b border-gray-600 bg-transparent text-[10px] focus:outline-none" />
                    <input type="text" class="w-full border-0 border-b border-gray-600 bg-transparent text-[10px] focus:outline-none" />
                  </div>
                  <label class="text-[10px] text-left pr-3">Nama Badan Usaha</label>
                  <input type="text" class="w-full border-0 border-b border-gray-600 bg-transparent text-[10px] focus:outline-none" />
                  <label class="text-[10px] text-left pr-3">Nama Direktur</label>
                  <input type="text" class="w-full border-0 border-b border-gray-600 bg-transparent text-[10px] focus:outline-none" />
                  <label class="text-[10px] text-left pr-3 self-start">Alamat Badan Usaha</label>
                  <div>
                    <input type="text" class="w-full border-0 border-b border-gray-600 bg-transparent text-[10px] focus:outline-none" />
                    <input type="text" class="w-full border-0 border-b border-gray-600 bg-transparent text-[10px] focus:outline-none" />
                  </div>
                  <label class="text-[10px] text-left pr-3">Bidang Usaha</label>
                  <input type="text" class="w-full border-0 border-b border-gray-600 bg-transparent text-[10px] focus:outline-none" />
                  <label class="text-[10px] text-left pr-3">Nama PIC</label>
                  <input type="text" class="w-full border-0 border-b border-gray-600 bg-transparent text-[10px] focus:outline-none" />
                  <label class="text-[10px] text-left pr-3">No. Telp / No. Hp PIC</label>
                  <input type="text" class="w-full border-0 border-b border-gray-600 bg-transparent text-[10px] focus:outline-none" />
                  <label class="text-[10px] text-left pr-3">No. KTP Direktur</label>
                  <input type="text" class="w-full border-0 border-b border-gray-600 bg-transparent text-[10px] focus:outline-none" />
                  <label class="text-[10px] text-left pr-3">No. NPWP Badan Usaha</label>
                  <input type="text" class="w-full border-0 border-b border-gray-600 bg-transparent text-[10px] focus:outline-none" />
                </div>
              </div>

              <div class="flex mt-3">
                <input type="checkbox" id="jenisPerorangan" name="jenisAgen" checked class="mr-3 w-4 h-4 accent-gray-800" />
                <div class="grid grid-cols-[130px_1fr] gap-x-3 gap-y-1 items-center w-full">
                  <label for="jenisPerorangan" class="text-xs font-semibold">Perorangan</label>
                  <br />
                  <label class="text-[10px] text-left pr-3">Nama Agen</label>
                  <input type="text" value="${
                    application.agent_name
                  }" class="w-full border-0 border-b border-gray-600 bg-transparent text-[10px] focus:outline-none" />
                  <label class="text-[10px] text-left pr-3 self-start">Alamat Agen</label>
                  <div>
                    <input type="text" value="${addressLine1}" class="w-full border-0 border-b border-gray-600 bg-transparent text-[10px] focus:outline-none" />
                    <input type="text" value="${addressLine2}" class="w-full border-0 border-b border-gray-600 bg-transparent text-[10px] focus:outline-none" />
                    <input type="text" value="${addressLine3}" class="w-full border-0 border-b border-gray-600 bg-transparent text-[10px] focus:outline-none" />
                  </div>
                  <label class="text-[10px] text-left pr-3">Nama Pemilik</label>
                  <input type="text" value="${
                    application.owner_name
                  }" class="w-full border-0 border-b border-gray-600 bg-transparent text-[10px] focus:outline-none" />
                  <label class="text-[10px] text-left pr-3">Bidang Usaha</label>
                  <input type="text" value="${
                    application.business_field
                  }" class="w-full border-0 border-b border-gray-600 bg-transparent text-[10px] focus:outline-none" />
                  <label class="text-[10px] text-left pr-3">Nama PIC</label>
                  <input type="text" value="${
                    application.pic_name
                  }" class="w-full border-0 border-b border-gray-600 bg-transparent text-[10px] focus:outline-none" />
                  <label class="text-[10px] text-left pr-3">No. Telp / No. Hp PIC</label>
                  <input type="text" value="${
                    application.pic_phone
                  }" class="w-full border-0 border-b border-gray-600 bg-transparent text-[10px] focus:outline-none" />
                  <label class="text-[10px] text-left pr-3">No. KTP Pemilik</label>
                  <input type="text" value="${
                    application.id_card_number
                  }" class="w-full border-0 border-b border-gray-600 bg-transparent text-[10px] focus:outline-none" />
                  <label class="text-[10px] text-left pr-3">No. NPWP (jika ada)</label>
                  <input type="text" value="${
                    application.tax_number || ""
                  }" class="w-full border-0 border-b border-gray-600 bg-transparent text-[10px] focus:outline-none" />
                </div>
              </div>

              <div class="bg-black text-white font-bold px-3 py-1 my-3">
                INFORMASI REKENING
              </div>
              <div class="flex">
                <div class="mr-3 w-4 h-4"></div>
                <div class="grid grid-cols-[130px_1fr] gap-x-3 gap-y-1 items-center w-full">
                  <label class="text-xs font-semibold">Rekening</label>
                  <br />
                  <label class="text-[10px] text-left pr-3">Nama Pemilik Rekening</label>
                  <input type="text" value="${
                    application.account_holder_name
                  }" class="w-full border-0 border-b border-gray-600 bg-transparent text-[10px] focus:outline-none" />
                  <label class="text-[10px] text-left pr-3">Nama Bank</label>
                  <input type="text" value="${
                    application.bank_name
                  }" class="w-full border-0 border-b border-gray-600 bg-transparent text-[10px] focus:outline-none" />
                  <label class="text-[10px] text-left pr-3">Nomor Rekening</label>
                  <input type="text" value="${
                    application.account_number
                  }" class="w-full border-0 border-b border-gray-600 bg-transparent text-[10px] focus:outline-none" />
                </div>
              </div>

              <!-- Static Data Fields - Data Yang Tidak Ada di Form -->
              <div class="mt-4 grid grid-cols-2 gap-4 text-[10px]">
                <div>
                  <label class="font-semibold">JAM OPERASIONAL OUTLET:</label>
                  <input type="text" value="07:00 - 22:00" class="w-full border-0 border-b border-gray-600 bg-transparent text-[10px] focus:outline-none" />
                </div>
                <div>
                  <label class="font-semibold">Tipe EDC:</label>
                  <input type="text" value="Centerm - K9" class="w-full border-0 border-b border-gray-600 bg-transparent text-[10px] focus:outline-none" />
                </div>
                <div>
                  <label class="font-semibold">JENIS KARTU ATM AGEN:</label>
                  <input type="text" value="Debit/CC/GPN" class="w-full border-0 border-b border-gray-600 bg-transparent text-[10px] focus:outline-none" />
                </div>
                <div>
                  <label class="font-semibold">Tgl FPA:</label>
                  <input type="text" value="24 Mei 2025" class="w-full border-0 border-b border-gray-600 bg-transparent text-[10px] focus:outline-none" />
                </div>
              </div>

              <div class="mt-8 ml-7 w-1/2">
                <label class="text-xs font-semibold">Fitur yang diimplementasikan</label>
                <table class="w-full mt-2 border border-gray-800 text-xs">
                  <tbody>
                    <tr class="border-b border-gray-800">
                      <td class="border-r border-gray-800 px-3 py-1 text-[10px] my-auto">
                        1. Transfer
                      </td>
                      <td class="text-center px-3 py-1 w-16">
                        <input type="checkbox" checked class="accent-gray-800 mt-1" />
                      </td>
                    </tr>
                    <tr>
                      <td class="border-r border-gray-800 px-3 py-1 text-[10px] my-auto">
                        2. Cek Saldo
                      </td>
                      <td class="text-center px-3 py-1 w-16">
                        <input type="checkbox" checked class="accent-gray-800 mt-1" />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div class="mt-2 text-xs">
              <p class="text-[10px] leading-tight text-justify mb-8">
                Dengan menandatangani Formulir Informasi Agen ini, saya menyatakan bahwa semua informasi yang saya berikan adalah lengkap dan benar serta saya sepakat untuk tunduk dan terikat pada ketentuan-ketentuan yang diberlakukan oleh ${partnerName}, termasuk tetapi tidak terbatas pada Syarat dan Ketentuan Agen yang terlampir dalam Formulir Informasi Agen ini, berikut dengan segenap perubahannya yang ditetapkan dari waktu ke waktu.
              </p>
              <div class="mb-1">Untuk dan atas nama Agen,</div>
              <div class="flex flex-col items-start">
                <div class="flex gap-2 text-left mb-1">
                  <div class="mb-1">
                    Mataram, <span class="border-b border-black px-2">${day}</span> <span class="border-b border-black px-2">${month}</span> 20<span class="border-b border-black px-2">${year}</span>
                  </div>
                  <div class="text-[8px]">(Tanggal Efektif)</div>
                </div>
                <div class="mt-1 px-5 flex items-center justify-between w-full">
                  <div>
                    <div class="mb-3 flex justify-center items-center" style="width: 200px; height: 60px;">
                      ${signatureDisplay}
                    </div>
                    <div class="flex">
                      <span class="text-[8px]">(</span>
                      <div class="text-xs text-center border-b border-black px-6">${
                        application.pic_name
                      }</div>
                      <span class="text-[8px]">)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Halaman 2: Verifikasi -->
          <div class="page bg-white p-6 border border-gray-400">
            <div class="bg-black text-white font-bold px-3 py-1 mt-1 mb-3">
              VERIFIKASI DAN VALIDASI DOKUMEN KELENGKAPAN AGEN (DIISI OLEH MITRA) *
            </div>
            <div class="grid grid-cols-2 gap-x-5 gap-y-2 text-[10px]">
              <div>
                <div class="flex items-center mb-1"><input type="checkbox" checked class="mr-3 w-4 h-4 accent-gray-800" /><label>KTP</label></div>
                <div class="flex items-center mb-1"><input type="checkbox" class="mr-3 w-4 h-4 accent-gray-800" /><label>Foto Selfie dengan KTP</label></div>
                <div class="flex items-center mb-1"><input type="checkbox" class="mr-3 w-4 h-4 accent-gray-800" /><label>Kartu Keluarga</label></div>
                <div class="flex items-center mb-1"><input type="checkbox" class="mr-3 w-4 h-4 accent-gray-800" /><label>SIUP</label></div>
                <div class="flex items-center mb-1"><input type="checkbox" class="mr-3 w-4 h-4 accent-gray-800" /><label>NPWP</label></div>
                <div class="flex items-center mb-1"><input type="checkbox" class="mr-3 w-4 h-4 accent-gray-800" /><label>NIB</label></div>
                <div class="flex items-center mb-1"><input type="checkbox" class="mr-3 w-4 h-4 accent-gray-800" /><label>Surat Keterangan Domisili Badan Usaha</label></div>
              </div>
              <div>
                <div class="flex items-center mb-1"><input type="checkbox" class="mr-3 w-4 h-4 accent-gray-800" /><label>Akta Badan Usaha & Perubahan & Pengesahan</label></div>
                <div class="flex items-center mb-1"><input type="checkbox" class="mr-3 w-4 h-4 accent-gray-800" /><label>Bukti Sewa Lokasi atau Bukti Kepemilikan (PBB/Sertifikat)</label></div>
                <div class="flex items-center mb-1"><input type="checkbox" checked class="mr-3 w-4 h-4 accent-gray-800" /><label>Foto Lokasi (nama toko, tampak depan, samping, dalam)</label></div>
                <div class="flex items-center mb-1"><input type="checkbox" class="mr-3 w-4 h-4 accent-gray-800" /><label>Share location Alamat Agen berusaha</label></div>
                <div class="flex items-center mb-1"><input type="checkbox" checked class="mr-3 w-4 h-4 accent-gray-800" /><label>Foto Buku Rekening Halaman Pertama</label></div>
              </div>
            </div>
            <p class="text-[10px] mt-2 italic">*) Agar dilengkapi sesuai dengan persyaratan jenis Agen (Badan Usaha/Perorangan)</p>
            <div class="mt-4 text-xs">
              <div class="mb-2">Diverifikasi dan divalidasi oleh,</div>
              <p class="font-bold">${partnerName}<br />(Mitra)</p>
              <div class="mt-2">Mataram, <span class="border-b border-black px-2">${day}</span> <span class="border-b border-black px-2">${month}</span> 20<span class="border-b border-black px-2">${year}</span></div>
              <div class="flex justify-between">
                <div>
                  <div class="signature-initials mt-12 text-center mb-3">${confirmedByInitial}</div>
                  <div class="flex">
                    <span class="text-[8px]">(</span>
                    <div class="text-xs text-center border-b border-black px-6">${confirmedByName}</div>
                    <span class="text-[8px]">)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          ${photoPages}
        </body>
      </html>
    `;
  }

  private generatePhotoPages(photos: KYCPhoto[]): string {
    if (!photos || photos.length === 0) {
      return `
        <div class="page bg-white p-6 border border-gray-400 flex items-center justify-center">
          <div class="text-center text-gray-500">
            <h3 class="text-lg font-bold mb-4">LAMPIRAN FOTO</h3>
            <p>Tidak ada foto terlampir.</p>
          </div>
        </div>
      `;
    }

    const photoTypeNames: Record<string, string> = {
      location_photos: "Foto Lokasi",
      id_card: "Foto KTP",
      bank_book: "Foto Buku Rekening",
      signature: "Foto Tanda Tangan",
    };

    // Group photos by type untuk better organization
    const groupedPhotos: Record<string, KYCPhoto[]> = {};
    photos.forEach((photo) => {
      if (!groupedPhotos[photo.photo_type]) {
        groupedPhotos[photo.photo_type] = [];
      }
      groupedPhotos[photo.photo_type].push(photo);
    });

    let photoPages = "";
    let photoCount = 0;

    // Generate pages: 1 foto per halaman dengan full width
    Object.entries(groupedPhotos).forEach(([photoType, photoList]) => {
      photoList.forEach((photo, index) => {
        const caption = `${photoTypeNames[photoType] || "Foto Lainnya"}${
          photoList.length > 1 ? ` ${index + 1}` : ""
        }`;

        photoPages += `
          <div class="page bg-white p-6 border border-gray-400 flex flex-col">
            <div class="text-center mb-4">
              <h3 class="text-lg font-bold">LAMPIRAN FOTO</h3>
              <p class="text-sm text-gray-600">${caption}</p>
            </div>
            <div class="flex-1 flex items-center justify-center">
              <img 
                src="${photo.file_url}" 
                alt="${caption}" 
                class="max-w-full max-h-full object-contain"
                style="width: 100%; height: auto;"
              />
            </div>
            <div class="text-center text-xs text-gray-500 mt-4">
              Halaman ${++photoCount} dari ${photos.length} foto
            </div>
          </div>
        `;
      });
    });

    return photoPages;
  }
}
