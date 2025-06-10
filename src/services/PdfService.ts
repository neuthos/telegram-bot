import puppeteer from "puppeteer";
import {KYCApplication, KYCPhoto} from "../types";
import {Logger} from "../config/logger";
import {CDNService} from "./CDNService";
import {EmeteraiService} from "./EMateraiService";
import fs from "fs";

export class PDFService {
  private logger = Logger.getInstance();
  private cdnService = new CDNService();
  private EMateraiService = new EmeteraiService();

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
      // fs.writeFileSync("debug-html.html", html);
      // console.log("HTML saved to debug-html.html");
      // Wait until network is idle to ensure TailwindCSS from CDN is loaded
      await page.setContent(html, {waitUntil: "networkidle0"});

      const fileName = `kyc_${application.id}_${Date.now()}.pdf`;

      const pdfBuffer = await page.pdf({
        format: "A4",
        margin: {top: "0px", right: "0px", bottom: "0px", left: "0px"},
        printBackground: true,
      });

      const convertedBuffer = await this.EMateraiService.pdfConvert(
        application.id as number,
        pdfBuffer
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
    // --- Dynamic Data Preparation ---

    const today = new Date();
    const day = today.getDate();
    const month = today.toLocaleString("id-ID", {month: "long"});
    const year = today.getFullYear().toString().slice(-2);

    const addressFormatted = this.formatAddress(
      application.agent_address || ""
    );
    const addressLine1 = addressFormatted.line1;
    const addressLine2 = addressFormatted.line2;
    const addressLine3 = addressFormatted.line3;

    const generatePhotoGallery = (photoList: KYCPhoto[]) => {
      if (!photoList || photoList.length === 0) {
        return `<div class="p-1 text-center text-gray-500">No photos attached.</div>`;
      }

      const photoTypeNames: Record<string, string> = {
        location_photos: "Foto Lokasi",
        id_card: "Foto KTP",
        bank_book: "Foto Buku Rekening",
      };

      const photoOrder = ["location_photos", "id_card", "bank_book"];

      const sortedPhotos = photoList.sort((a, b) => {
        const indexA = photoOrder.indexOf(a.photo_type);
        const indexB = photoOrder.indexOf(b.photo_type);

        const orderA = indexA === -1 ? 999 : indexA;
        const orderB = indexB === -1 ? 999 : indexB;

        return orderA - orderB;
      });

      return sortedPhotos
        .map((photo) => {
          const caption = photoTypeNames[photo.photo_type] || "Foto Lainnya";
          return `
        <div class="text-center h-1/6">
            <div class="w-full h-full flex justify-center items-center text-xs text-gray-600 pt-3">
                <img class="max-w-full h-full" src="${photo.file_path}" alt="${caption}" />
            </div>
            <a href="${photo.file_path}" class="text-[10px] text-gray-700" style="color: blue; text-decoration: underline;">
              ${caption}
            </a>
        </div>`;
        })
        .join("");
    };

    const partnerName = application.confirmed_by_partner || "Partner";
    const confirmedByName = application.confirmed_by_name || "Admin";
    const confirmedByInitial = application.confirmed_by_initial || "Admin";

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
                  <input type="text" id="namaAgenBU" name="namaAgenBU" class="w-full border-0 border-b border-gray-600 bg-transparent text-[10px] focus:outline-none" />
                  <label for="alamatAgenBU_1" class="text-[10px] text-left pr-3 self-start">Alamat Agen</label>
                  <div>
                    <input type="text" id="alamatAgenBU_1" name="alamatAgenBU_1" class="w-full border-0 border-b border-gray-600 bg-transparent text-[10px] focus:outline-none" />
                    <input type="text" id="alamatAgenBU_2" name="alamatAgenBU_2" class="w-full border-0 border-b border-gray-600 bg-transparent text-[10px] focus:outline-none" />
                    <input type="text" id="alamatAgenBU_3" name="alamatAgenBU_3" class="w-full border-0 border-b border-gray-600 bg-transparent text-[10px] focus:outline-none" />
                  </div>
                  <label for="namaBadanUsaha" class="text-[10px] text-left pr-3">Nama Badan Usaha</label>
                  <input type="text" id="namaBadanUsaha" name="namaBadanUsaha" class="w-full border-0 border-b border-gray-600 bg-transparent text-[10px] focus:outline-none" />
                  <label for="namaDirektur" class="text-[10px] text-left pr-3">Nama Direktur</label>
                  <input type="text" id="namaDirektur" name="namaDirektur" class="w-full border-0 border-b border-gray-600 bg-transparent text-[10px] focus:outline-none" />
                  <label for="alamatBadanUsaha" class="text-[10px] text-left pr-3 self-start">Alamat Badan Usaha</label>
                  <div>
                    <input type="text" id="alamatBadanUsaha_1" name="alamatBadanUsaha_1" class="w-full border-0 border-b border-gray-600 bg-transparent text-[10px] focus:outline-none" />
                    <input type="text" id="alamatBadanUsaha_2" name="alamatBadanUsaha_2" class="w-full border-0 border-b border-gray-600 bg-transparent text-[10px] focus:outline-none" />
                  </div>
                  <label for="bidangUsahaBU" class="text-[10px] text-left pr-3">Bidang Usaha</label>
                  <input type="text" id="bidangUsahaBU" name="bidangUsahaBU" class="w-full border-0 border-b border-gray-600 bg-transparent text-[10px] focus:outline-none" />
                  <label for="namaPICBU" class="text-[10px] text-left pr-3">Nama PIC</label>
                  <input type="text" id="namaPICBU" name="namaPICBU" class="w-full border-0 border-b border-gray-600 bg-transparent text-[10px] focus:outline-none" />
                  <label for="telPICBU" class="text-[10px] text-left pr-3">No. Telp / No. Hp PIC</label>
                  <input type="text" id="telPICBU" name="telPICBU" class="w-full border-0 border-b border-gray-600 bg-transparent text-[10px] focus:outline-none" />
                  <label for="ktpDirektur" class="text-[10px] text-left pr-3">No. KTP Direktur</label>
                  <input type="text" id="ktpDirektur" name="ktpDirektur" class="w-full border-0 border-b border-gray-600 bg-transparent text-[10px] focus:outline-none" />
                  <label for="npwpBadanUsaha" class="text-[10px] text-left pr-3">No. NPWP Badan Usaha</label>
                  <input type="text" id="npwpBadanUsaha" name="npwpBadanUsaha" class="w-full border-0 border-b border-gray-600 bg-transparent text-[10px] focus:outline-none" />
                </div>
              </div>
              <div class="flex mt-3">
                <input type="checkbox" id="jenisPerorangan" name="jenisAgen" checked class="mr-3 w-4 h-4 accent-gray-800" />
                <div class="grid grid-cols-[130px_1fr] gap-x-3 gap-y-1 items-center w-full">
                  <label for="jenisPerorangan" class="text-xs font-semibold">Perorangan</label>
                  <br />
                  <label for="namaAgenP" class="text-[10px] text-left pr-3">Nama Agen</label>
                  <input type="text" id="namaAgenP" name="namaAgenP" value="${
                    application.agent_name
                  }" class="w-full border-0 border-b border-gray-600 bg-transparent text-[10px] focus:outline-none" />
                  <label for="alamatAgenP_1" class="text-[10px] text-left pr-3 self-start">Alamat Agen</label>
                  <div>
                    <input type="text" id="alamatAgenP_1" name="alamatAgenP_1" value="${addressLine1}" class="w-full border-0 border-b border-gray-600 bg-transparent text-[10px] focus:outline-none" />
                    <input type="text" id="alamatAgenP_2" name="alamatAgenP_2" value="${addressLine2}" class="w-full border-0 border-b border-gray-600 bg-transparent text-[10px] focus:outline-none" />
                    <input type="text" id="alamatAgenP_3" name="alamatAgenP_3" value="${addressLine3}" class="w-full border-0 border-b border-gray-600 bg-transparent text-[10px] focus:outline-none" />
                  </div>
                  <label for="namaPemilikP" class="text-[10px] text-left pr-3">Nama Pemilik</label>
                  <input type="text" id="namaPemilikP" name="namaPemilikP" value="${
                    application.owner_name
                  }" class="w-full border-0 border-b border-gray-600 bg-transparent text-[10px] focus:outline-none" />
                  <label for="bidangUsahaP" class="text-[10px] text-left pr-3">Bidang Usaha</label>
                  <input type="text" id="bidangUsahaP" name="bidangUsahaP" value="${
                    application.business_field
                  }" class="w-full border-0 border-b border-gray-600 bg-transparent text-[10px] focus:outline-none" />
                  <label for="namaPICP" class="text-[10px] text-left pr-3">Nama PIC</label>
                  <input type="text" id="namaPICP" name="namaPICP" value="${
                    application.pic_name
                  }" class="w-full border-0 border-b border-gray-600 bg-transparent text-[10px] focus:outline-none" />
                  <label for="telPICP" class="text-[10px] text-left pr-3">No. Telp / No. Hp PIC</label>
                  <input type="text" id="telPICP" name="telPICP" value="${
                    application.pic_phone
                  }" class="w-full border-0 border-b border-gray-600 bg-transparent text-[10px] focus:outline-none" />
                  <label for="ktpPemilikP" class="text-[10px] text-left pr-3">No. KTP Pemilik</label>
                  <input type="text" id="ktpPemilikP" name="ktpPemilikP" value="${
                    application.id_card_number
                  }" class="w-full border-0 border-b border-gray-600 bg-transparent text-[10px] focus:outline-none" />
                  <label for="npwpPemilikP" class="text-[10px] text-left pr-3">No. NPWP (jika ada)</label>
                  <input type="text" id="npwpPemilikP" name="npwpPemilikP" value="${
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
                  <label for="jenisPerorangan" class="text-xs font-semibold">Rekening</label>
                  <br />
                  <label for="namaPemilikRekening" class="text-[10px] text-left pr-3">Nama Pemilik Rekening</label>
                  <input type="text" id="namaPemilikRekening" name="namaPemilikRekening" value="${
                    application.account_holder_name
                  }" class="w-full border-0 border-b border-gray-600 bg-transparent text-[10px] focus:outline-none" />
                  <label for="namaBank" class="text-[10px] text-left pr-3">Nama Bank</label>
                  <input type="text" id="namaBank" name="namaBank" value="${
                    application.bank_name
                  }" class="w-full border-0 border-b border-gray-600 bg-transparent text-[10px] focus:outline-none" />
                  <label for="nomorRekening" class="text-[10px] text-left pr-3">Nomor Rekening</label>
                  <input type="text" id="nomorRekening" name="nomorRekening" value="${
                    application.account_number
                  }" class="w-full border-0 border-b border-gray-600 bg-transparent text-[10px] focus:outline-none" />
                </div>
              </div>
              <div class="mt-8 ml-7 w-1/2">
                <label for="jenisPerorangan" class="text-xs font-semibold"
                  >Fitur yang diimplementasikan</label
                >

                <table class="w-full mt-2 border border-gray-800 text-xs">
                  <tbody>
                    <tr class="border-b border-gray-800">
                      <td
                        class="border-r border-gray-800 px-3 py-1 text-[10px] my-auto"
                      >
                        1. Transfer
                      </td>
                      <td class="text-center px-3 py-1 w-16">
                        <input
                          type="checkbox"
                          id="Transfer"
                          name="Transfer"
                          checked
                          class="accent-gray-800 mt-1"
                        />
                      </td>
                    </tr>
                    <tr>
                      <td
                        class="border-r border-gray-800 px-3 py-1 text-[10px] my-auto"
                      >
                        2. Cek Saldo
                      </td>
                      <td class="text-center px-3 py-1 w-16">
                        <input
                          type="checkbox"
                          id="CekSaldo"
                          name="CekSaldo"
                          checked
                          class="accent-gray-800 mt-1"
                        />
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
                    <div class="signature-initials text-center mb-3">${
                      application.signature_initial
                    }</div>
                    <div class="flex">
                      <span class="text-[8px]">(</span>
                      <div class="text-xs text-center border-b border-black px-6">${
                        application.pic_name
                      }</div>
                      <span class="text-[8px]">)</span>
                    </div>
                  </div>
                  <div class="w-24 h-16">
                    <br />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="page bg-white p-6 border border-gray-400">
            <div class="bg-black text-white font-bold px-3 py-1 mt-1 mb-3">
              VERIFIKASI DAN VALIDASI DOKUMEN KELENGKAPAN AGEN (DIISI OLEH MITRA) *
            </div>
            <div class="grid grid-cols-2 gap-x-5 gap-y-2 text-[10px]">
              <div>
                <div class="flex items-center mb-1"><input type="checkbox" id="docKTP" name="docKTP" checked class="mr-3 w-4 h-4 accent-gray-800" /><label for="docKTP">KTP</label></div>
                <div class="flex items-center mb-1"><input type="checkbox" id="docSelfieKTP" name="docSelfieKTP" class="mr-3 w-4 h-4 accent-gray-800" /><label for="docSelfieKTP">Foto Selfie dengan KTP</label></div>
                <div class="flex items-center mb-1"><input type="checkbox" id="docKK" name="docKK" class="mr-3 w-4 h-4 accent-gray-800" /><label for="docKK">Kartu Keluarga</label></div>
                <div class="flex items-center mb-1"><input type="checkbox" id="docSIUP" name="docSIUP" class="mr-3 w-4 h-4 accent-gray-800" /><label for="docSIUP">SIUP</label></div>
                <div class="flex items-center mb-1"><input type="checkbox" id="docNPWP" name="docNPWP" class="mr-3 w-4 h-4 accent-gray-800" /><label for="docNPWP">NPWP</label></div>
                <div class="flex items-center mb-1"><input type="checkbox" id="docNIB" name="docNIB" class="mr-3 w-4 h-4 accent-gray-800" /><label for="docNIB">NIB</label></div>
                <div class="flex items-center mb-1"><input type="checkbox" id="docDomisili" name="docDomisili" class="mr-3 w-4 h-4 accent-gray-800" /><label for="docDomisili">Surat Keterangan Domisili Badan Usaha</label></div>
              </div>
              <div>
                <div class="flex items-center mb-1"><input type="checkbox" id="docAkta" name="docAkta" class="mr-3 w-4 h-4 accent-gray-800" /><label for="docAkta">Akta Badan Usaha & Perubahan & Pengesahan</label></div>
                <div class="flex items-center mb-1"><input type="checkbox" id="docBuktiSewa" name="docBuktiSewa" class="mr-3 w-4 h-4 accent-gray-800" /><label for="docBuktiSewa">Bukti Sewa Lokasi atau Bukti Kepemilikan (PBB/Sertifikat)</label></div>
                <div class="flex items-center mb-1"><input type="checkbox" id="docFotoLokasi" name="docFotoLokasi" checked class="mr-3 w-4 h-4 accent-gray-800" /><label for="docFotoLokasi">Foto Lokasi (nama toko, tampak depan, samping, dalam)</label></div>
                <div class="flex items-center mb-1"><input type="checkbox" id="docShareLoc" name="docShareLoc" class="mr-3 w-4 h-4 accent-gray-800" /><label for="docShareLoc">Share location Alamat Agen berusaha</label></div>
                <div class="flex items-center mb-1"><input type="checkbox" id="docFotoRekening" name="docFotoRekening" checked class="mr-3 w-4 h-4 accent-gray-800" /><label for="docFotoRekening">Foto Buku Rekening Halaman Pertama</label></div>
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
          <div class="page bg-white p-6 space-y-3">
            ${generatePhotoGallery(photos)}
          </div>
        </body>
      </html>
    `;
  }
}
