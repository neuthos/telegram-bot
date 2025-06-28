// src/messages/MessagesTemplates.ts - Updated untuk flow baru

import {BankService} from "../services/BankService";
import {BusinessFieldService} from "../services/BusinessFieldService";
import {ProvinceService} from "../services/ProvinceService";
import {SessionStep, FormData, KYCApplication, KYCPhoto} from "../types";

export class MessageTemplates {
  private bankService = new BankService();
  private provinceService = new ProvinceService();
  private businessFieldService = new BusinessFieldService();

  public generateWelcomeMessage(): string {
    return `🎉 Selamat datang!

Untuk memulai pendaftaran KYC, gunakan command:

/daftar - 📝 Daftar KYC
/menu - 🏠 Menu Utama
/help - ❓ Bantuan`;
  }

  public generateWelcomeMessageRegistered(
    status: "draft" | "confirmed" | "rejected"
  ): string {
    const statusText =
      status === "draft"
        ? "Draft (Menunggu konfirmasi admin)"
        : status === "confirmed"
        ? "Confirmed (Sudah dikonfirmasi admin)"
        : "Rejected (Ditolak)";

    return `🎉 Selamat datang kembali!

Anda sudah terdaftar KYC.
Status: ${statusText}

/lihat - 👁️ Lihat Data KYC
/menu - 🏠 Menu Utama
/help - ❓ Bantuan`;
  }

  public generateWelcomeMessageRejected(remark: string): string {
    return `🎉 Selamat datang kembali!

📋 Aplikasi KYC sebelumnya ditolak
📝 Alasan: ${remark}

Anda dapat mendaftar ulang dengan data yang benar.

/daftar - 📝 Daftar KYC Ulang
/menu - 🏠 Menu Utama
/help - ❓ Bantuan`;
  }

  public generateHelpMessage(): string {
    return `📖 Panduan Penggunaan Bot KYC

🔸 Command Utama:
/start - Memulai bot
/daftar - 📝 Daftar KYC
/menu - 🏠 Kembali ke menu utama
/help - ❓ Tampilkan panduan

🔸 Command untuk User Terdaftar:
/lihat - 👁️ Lihat data KYC

🔸 Command Pendaftaran:
/mulai - 🆕 Mulai pendaftaran baru
/lanjut - ⏩ Lanjutkan sesi pendaftaran

🔸 Command Konfirmasi:
/setuju - ✅ Setuju syarat & ketentuan
/tidaksetuju - ❌ Tolak syarat & ketentuan
/skip - ⏭️ Lewati (untuk field opsional)

📋 Alur Pendaftaran KYC:
1. 📸 Upload foto KTP (OCR otomatis)
2. 📝 Isi data agen & pemilik
3. 💰 Isi data bank & rekening
4. ✍️ Upload foto tanda tangan
5. 📍 Upload foto lokasi (1-4 foto)
6. 📄 Upload foto buku rekening
7. ✅ Setuju syarat & ketentuan
8. 🔍 Konfirmasi data

💡 Tips:
- Pastikan foto KTP jelas untuk OCR
- Upload foto dengan pencahayaan baik
- Foto tanda tangan akan diproses otomatis`;
  }

  public generateRegistrationOptionsMessage(): string {
    return `📋 Pendaftaran KYC

Pilih opsi pendaftaran:

Mulai Pendaftaran Baru - 🆕 Mulai dari awal
Lanjutkan Sesi Pendaftaran - ⏩ Lanjutkan yang belum selesai

Ketik pilihan Anda atau gunakan:
/mulai - 🆕 Mulai pendaftaran baru  
/lanjut - ⏩ Lanjutkan sesi pendaftaran
/menu - 🏠 Kembali ke menu utama`;
  }

  public generateStartRegistrationMessage(): string {
    return `📋 Memulai Pendaftaran KYC

🔄 ALUR BARU dengan OCR:

📸 Langkah 1: Upload Foto KTP
Sistem akan otomatis membaca data KTP Anda menggunakan OCR (Optical Character Recognition).

📝 Langkah 2-8: Isi Data Manual 
Data yang tidak ada di KTP perlu diisi manual.

✍️ Langkah 9: Upload Foto Tanda Tangan
Upload foto tanda tangan yang akan diproses otomatis (background dihapus).

📸 Langkah 10-12: Upload Foto Dokumen
Upload foto lokasi, buku rekening, dll.

✅ Langkah 13-14: Konfirmasi
Setuju syarat & ketentuan dan konfirmasi data.

---

📸 Mulai dengan upload foto KTP Anda
Pastikan foto KTP jelas, tidak buram, dan semua teks terbaca untuk hasil OCR yang optimal.`;
  }

  public generateStepMessage(step: SessionStep): string {
    const stepMessages: {[key in SessionStep]?: string} = {
      [SessionStep.ID_CARD_PHOTO]: `📸 Step 1: Upload Foto KTP

Upload foto KTP Anda untuk proses OCR otomatis.

📋 Tips untuk foto KTP yang baik:
- Foto harus jelas dan tidak buram
- Semua teks harus terbaca
- Pencahayaan yang cukup
- Tidak ada bayangan atau pantulan
- Format foto: JPG, JPEG, PNG

Sistem akan otomatis membaca: NIK, Nama, Alamat, Provinsi, Kota, Agama, Pekerjaan.`,

      [SessionStep.POSTAL_CODE]: `📮 Step 1.2: Kode Pos

Masukkan kode pos dari alamat KTP Anda.

Format: 5 digit angka
Contoh: 10110, 40123, 60271`,

      [SessionStep.AGENT_NAME]: `📝 Step 2: Nama Agen

Masukkan nama agen/toko Anda.

Contoh: EPADI-01, Warung Maju, Toko Berkah`,

      [SessionStep.OWNER_NAME]: `📝 Step 3: Nama Pemilik

Masukkan nama pemilik usaha.

Contoh: Budi Santoso, Siti Rahayu`,

      [SessionStep.BUSINESS_FIELD]: `📝 Step 4: Bidang Usaha

Pilih bidang usaha Anda dari daftar yang tersedia.`,

      [SessionStep.PIC_NAME]: `📝 Step 5: Nama PIC (Person In Charge)

Masukkan nama orang yang bertanggung jawab.

Contoh: Budi Santoso, Siti Rahayu`,

      [SessionStep.PIC_PHONE]: `📝 Step 6: Nomor Telepon PIC

Masukkan nomor telepon/HP PIC.

Format yang diterima:
- 08xxxxxxxxx
- 62xxxxxxxxx  
- +62xxxxxxxxx

Contoh: 081234567890`,

      [SessionStep.TAX_NUMBER]: `📝 Step 7: Nomor NPWP (Opsional)

Masukkan nomor NPWP jika ada, atau ketik /skip untuk lewati.

Format: 15 digit angka
Contoh: 123456789012345`,

      [SessionStep.ACCOUNT_HOLDER_NAME]: `📝 Step 8: Nama Pemilik Rekening

Masukkan nama pemilik rekening bank.

Contoh: Budi Santoso, Siti Rahayu`,

      [SessionStep.BANK_NAME]: `🏦 Step 9: Nama Bank

Pilih bank Anda dari daftar yang tersedia.`,

      [SessionStep.ACCOUNT_NUMBER]: `📝 Step 10: Nomor Rekening

Masukkan nomor rekening bank Anda.

Panjang: 8-20 digit
Contoh: 1234567890, 068901012420509`,

      [SessionStep.SIGNATURE_PHOTO]: `✍️ Step 11: Upload Foto Tanda Tangan

Upload foto tanda tangan Anda.

📋 PENTING - Crop foto agar:
- Background PUTIH PENUH (tidak ada objek lain)
- Hanya tanda tangan yang terlihat
- Foto terpotong rapi di sekitar tanda tangan

📋 Tips untuk foto tanda tangan:
- Gunakan kertas putih bersih
- Tanda tangan jelas dan kontras
- Tidak ada bayangan
- Format: JPG, JPEG, PNG

Sistem akan otomatis menghapus background dan menyesuaikan ukuran.`,

      [SessionStep.LOCATION_PHOTOS]: `📸 Step 12: Upload Foto Lokasi

Upload foto lokasi usaha Anda (1-4 foto).

📋 Foto yang diperlukan:
- Tampak depan toko/warung
- Papan nama (jika ada)
- Tampak dalam
- Tampak samping (opsional)

Kirim foto satu per satu, lalu ketik "Lanjut" jika selesai.`,

      [SessionStep.BANK_BOOK_PHOTO]: `📄 Step 13: Upload Foto Buku Rekening

Upload foto halaman pertama buku rekening/tabungan Anda.

📋 Tips:
- Foto harus jelas dan terbaca
- Tampilkan nama pemilik dan nomor rekening
- Pencahayaan yang baik`,

      [SessionStep.TERMS_CONDITIONS]: `📋 Step 14: Syarat dan Ketentuan

Silakan baca dan setujui syarat dan ketentuan berikut:

SYARAT DAN KETENTUAN KYC

1. Kebenaran Data: Saya menjamin bahwa semua data yang saya berikan adalah benar dan akurat.

2. Tanggung Jawab: Saya bertanggung jawab penuh atas kebenaran dan keakuratan data yang diberikan.

3. Penggunaan Data: Data saya akan digunakan untuk proses verifikasi KYC dan keperluan bisnis terkait.

4. Verifikasi: Perusahaan berhak memverifikasi dan meminta dokumen tambahan jika diperlukan.

5. Penolakan: Perusahaan berhak menolak aplikasi jika data tidak valid atau tidak memenuhi syarat.

6. Kerahasiaan Data: Data akan disimpan dan digunakan sesuai kebijakan privasi perusahaan.

7. Perubahan: Syarat dan ketentuan dapat berubah sewaktu-waktu dengan pemberitahuan.

Apakah Anda menyetujui syarat dan ketentuan di atas?

/setuju - ✅ Ya, saya setuju
/tidaksetuju - ❌ Tidak, saya tidak setuju`,

      [SessionStep.CONFIRMATION]: `🔍 Step 15: Konfirmasi Data

Silakan periksa kembali data Anda sebelum mengirim.`,
      [SessionStep.ACCOUNT_OWNER_CONFIRMATION]: `💰 Step 8: Konfirmasi Pemilik Rekening

Apakah nama pemilik rekening bank sama dengan nama pemilik usaha?

Jika sama, Anda tidak perlu mengisi nama pemilik rekening lagi.
Jika berbeda, Anda akan diminta mengisi nama pemilik rekening terpisah.

Ya - Sama dengan pemilik usaha
Tidak - Berbeda dengan pemilik usaha`,

      [SessionStep.SERIAL_NUMBER_EDC]: `🔢 Step 11: Serial Number EDC

Masukkan serial number mesin EDC Anda.

Contoh: K9001234, EDC-123456, SN001234
`,
      [SessionStep.ID_CARD_PREVIEW]: `📋 **Step 2: Konfirmasi Data KTP**

Periksa data yang berhasil dibaca dari KTP Anda.

/konfirm - ✅ Ya, data benar
/ulangi - ❌ Upload ulang KTP`,

      [SessionStep.SIGNATURE_PREVIEW]: `✍️ **Step 15: Konfirmasi Tanda Tangan**

Periksa hasil pemrosesan tanda tangan Anda.

/konfirm - ✅ Ya, gunakan tanda tangan ini  
/ulangi - ❌ Upload ulang tanda tangan`,
    };

    return stepMessages[step] || `📝 Langkah: ${step}`;
  }

  // VALIDATION ERROR MESSAGES
  public generateFieldValidationError(field: string): string {
    const errorMessages: {[key: string]: string} = {
      agent_name: "❌ Nama agen harus minimal 3 karakter.",
      owner_name: "❌ Nama pemilik harus minimal 3 karakter.",
      pic_name: "❌ Nama PIC harus minimal 3 karakter.",
      pic_phone:
        "❌ Format nomor telepon tidak valid. Gunakan format: 08xxxxxxxxx, 62xxxxxxxxx, atau +62xxxxxxxxx",
      tax_number: "❌ Nomor NPWP harus 15 digit angka.",
      account_holder_name: "❌ Nama pemilik rekening harus minimal 3 karakter.",
      account_number: "❌ Nomor rekening harus 8-20 digit.",
      id_card_photo: "❌ Silakan upload foto KTP, bukan teks.",
      signature_photo: "❌ Silakan upload foto tanda tangan, bukan teks.",
      location_photos: "❌ Silakan upload foto lokasi, bukan teks.",
      bank_book_photo: "❌ Silakan upload foto buku rekening, bukan teks.",
      postal_code: "❌ Kode pos harus 5 digit angka.",
    };

    return errorMessages[field] || `❌ Input tidak valid untuk ${field}.`;
  }

  public generatePhotoValidationError(photoType: string): string {
    const photoNames: {[key: string]: string} = {
      id_card_photo: "foto KTP",
      signature_photo: "foto tanda tangan",
      location_photos: "foto lokasi",
      bank_book_photo: "foto buku rekening",
    };

    return `❌ Pada step ini silakan upload ${photoNames[photoType]}, bukan teks.`;
  }

  // SUCCESS MESSAGES
  public generateFieldSuccessMessage(
    field: string,
    value: string,
    nextStep?: SessionStep
  ): string {
    const fieldNames: {[key: string]: string} = {
      agent_name: "Nama Agen",
      owner_name: "Nama Pemilik",
      business_field: "Bidang Usaha",
      pic_name: "Nama PIC",
      pic_phone: "Nomor Telepon PIC",
      postal_code: "Kode Pos",
      tax_number: "Nomor NPWP",
      account_holder_name: "Nama Pemilik Rekening",
      bank_name: "Nama Bank",
      account_number: "Nomor Rekening",
      serial_number_edc: "Serial Number EDC",
    };

    let message = `✅ ${fieldNames[field]}: ${value}\n\n`;

    if (nextStep) {
      const stepNumber = this.getStepNumber(nextStep);
      message += `📝 Lanjut ke Step ${stepNumber}...\n\n`;
    }

    return message;
  }

  public generateSkipMessage(field: string): string {
    const fieldNames: {[key: string]: string} = {
      tax_number: "Nomor NPWP",
    };

    return `⏭️ ${fieldNames[field]} dilewati.\n\n📝 Lanjut ke step berikutnya...`;
  }

  // PHOTO SUCCESS MESSAGES
  public generatePhotoSuccessMessage(
    photoType: string,
    count?: number
  ): string {
    const photoNames: {[key: string]: string} = {
      id_card_photo: "Foto KTP",
      signature_photo: "Foto Tanda Tangan",
      location_photos: "Foto Lokasi",
      bank_book_photo: "Foto Buku Rekening",
    };

    let message = `✅ ${photoNames[photoType]} berhasil diupload!`;

    if (photoType === "location_photos" && count) {
      message += ` (${count}/4 foto)`;

      if (count < 4) {
        message += `\n\n📸 Anda bisa upload ${
          4 - count
        } foto lagi atau ketik "Lanjut" untuk melanjutkan.`;
      } else {
        message += `\n\n📸 Maksimal 4 foto lokasi sudah tercapai.`;
      }
    }

    return message;
  }

  public generateLocationPhotosMinError(): string {
    return "❌ Minimal harus upload 1 foto lokasi sebelum melanjutkan.";
  }

  public generateLocationPhotosLimitError(): string {
    return "❌ Maksimal 4 foto lokasi. Ketik 'Lanjut' untuk melanjutkan ke step berikutnya.";
  }

  // CONFIRMATION MESSAGE
  public generateConfirmationMessage(formData: FormData): string {
    return `🔍 Konfirmasi Data KYC

Silakan periksa kembali data Anda:

📋 DATA DARI KTP:
👤 Nama Lengkap: ${formData.full_name || "Tidak terdeteksi"}
🆔 NIK: ${formData.id_card_number || "Tidak terdeteksi"}
📍 Alamat: ${formData.address || "Tidak terdeteksi"}
💼 Pekerjaan: ${formData.occupation || "Tidak terdeteksi"}
📮 Kode Pos: ${formData.postal_code || "Tidak terdeteksi"}

🏪 DATA AGEN:
🏷️ Nama Agen: ${formData.agent_name}
🏢 Bidang Usaha: ${formData.business_field}

📞 DATA PIC:
👤 Nama PIC: ${formData.pic_name}
📱 Telepon PIC: ${formData.pic_phone}

💰 DATA REKENING:
👤 Nama Pemilik Rekening: ${formData.account_holder_name}
🏦 Nama Bank: ${formData.bank_name}
💳 Nomor Rekening: ${formData.account_number}
🔢 NPWP: ${formData.tax_number || "Tidak diisi"}

📸 DOKUMEN:
✅ Foto KTP: Terupload
✅ Foto Tanda Tangan: Terupload (background dihapus)
✅ Foto Lokasi: ${formData.location_photos?.length || 0} foto
✅ Foto Buku Rekening: Terupload

Apakah semua data sudah benar?
  
/ya - ✅ Ya, daftarkan
/tidak - ❌ Tidak, ulangi pendaftaran`;
  }

  // REGISTRATION MESSAGES
  public generateRegistrationSuccessMessage(formData: FormData): string {
    return `🎉 Pendaftaran KYC Berhasil!

Data Anda telah berhasil disimpan dan akan diproses oleh tim admin.

📧 Status: Draft (Menunggu konfirmasi admin)
⏰ Estimasi: 1-2 hari kerja

📋 Data yang terdaftar:
👤 Nama: ${formData.full_name}
🏷️ Agen: ${formData.agent_name}
🏢 Bidang Usaha: ${formData.business_field}

Anda akan mendapat notifikasi melalui bot ini ketika aplikasi Anda dikonfirmasi atau jika ada yang perlu diperbaiki.

/lihat - 👁️ Lihat data KYC
/menu - 🏠 Menu utama

Terima kasih! 🙏`;
  }

  public generateRegistrationErrorMessage(): string {
    return `❌ Pendaftaran Gagal

Terjadi kesalahan saat menyimpan data. Silakan coba lagi atau hubungi admin jika masalah berlanjut.

/menu - 🏠 Kembali ke menu utama`;
  }

  // BANK SELECTION
  public async generateBankSelectionMessage() {
    const banks = await this.bankService.getAllBanks();

    let message = `🏦 Pilih Bank Anda\n\nSilakan pilih dengan mengetik command berikut:\n\n`;

    banks.forEach((bank: any, index) => {
      const command = bank?.toLowerCase().replace(/\s+/g, "");
      message += `/${command} - ${bank}\n`;
    });

    return message;
  }

  // BUSINESS FIELD SELECTION
  public async generateBusinessFieldSelectionMessage() {
    const fields = await this.businessFieldService.getAllBusinessFields();

    let message = `🏢 Pilih Bidang Usaha\n\nSilakan pilih dengan mengetik command berikut:\n\n`;
    console.log({fields});
    fields.forEach((field: any, index) => {
      const command = field?.toLowerCase().replace(/\s+/g, "");
      message += `/${command} - ${field}\n`;
    });

    return message;
  }

  // PROVINCE & CITY SELECTION
  public async generateProvinceSelectionMessage() {
    const provinces = await this.provinceService.getAllProvinces();

    let message = `🗺️ Pilih Provinsi\n\nSilakan pilih dengan mengetik command berikut:\n\n`;

    provinces.forEach((province) => {
      message += `/${province.code} - ${province.name}\n`;
    });

    return message;
  }

  public async generateCitySelectionMessage(provinceCode: string) {
    const cities = await this.provinceService.getCitiesByProvince(provinceCode);

    let message = `🏙️ Pilih Kabupaten/Kota\n\nSilakan pilih dengan mengetik command berikut:\n\n`;

    cities.forEach((city) => {
      message += `/${city.code} - ${city.name}\n`;
    });

    return message;
  }

  // VIEW DATA MESSAGE
  public generateViewDataMessage(
    application: KYCApplication,
    photos: KYCPhoto[]
  ): string {
    return `📋 Data KYC Anda

Status: ${this.getStatusText(application.status)}

📋 DATA DARI KTP:
👤 Nama: ${application.full_name}
🆔 NIK: ${application.id_card_number}
📍 Alamat: ${application.address}
💼 Pekerjaan: ${application.occupation || "Tidak terdeteksi"}

🏪 DATA AGEN:
🏷️ Nama Agen: ${application.agent_name}
🏢 Bidang Usaha: ${application.business_field}

📞 DATA PIC:
👤 Nama PIC: ${application.pic_name}
📱 Telepon: ${application.pic_phone}

💰 DATA REKENING:
👤 Pemilik Rekening: ${application.account_holder_name}
🏦 Bank: ${application.bank_name}
💳 Nomor Rekening: ${application.account_number}
🔢 NPWP: ${application.tax_number || "Tidak diisi"}

📸 DOKUMEN: ${photos.length} file terupload
📅 Tanggal Daftar: ${new Date(application.created_at!).toLocaleDateString(
      "id-ID"
    )}`;
  }

  private getStepNumber(step: SessionStep): number {
    const stepNumbers: {[key in SessionStep]?: number} = {
      [SessionStep.ID_CARD_PHOTO]: 1,
      [SessionStep.ID_CARD_PREVIEW]: 2,
      [SessionStep.POSTAL_CODE]: 3,
      [SessionStep.AGENT_NAME]: 4,
      [SessionStep.BUSINESS_FIELD]: 5,
      [SessionStep.PIC_NAME]: 6,
      [SessionStep.PIC_PHONE]: 7,
      [SessionStep.TAX_NUMBER]: 8,
      [SessionStep.ACCOUNT_HOLDER_NAME]: 9,
      [SessionStep.BANK_NAME]: 10,
      [SessionStep.ACCOUNT_NUMBER]: 11,
      // [SessionStep.SIGNATURE_PHOTO]: 12,
      [SessionStep.SIGNATURE_PREVIEW]: 12,
      [SessionStep.LOCATION_PHOTOS]: 13,
      [SessionStep.BANK_BOOK_PHOTO]: 14,
      [SessionStep.TERMS_CONDITIONS]: 15,
      [SessionStep.CONFIRMATION]: 16,
    };

    return stepNumbers[step] || 0;
  }

  private getStatusText(status: string): string {
    const statusTexts: {[key: string]: string} = {
      draft: "📝 Draft (Menunggu konfirmasi admin)",
      confirmed: "✅ Confirmed (Sudah dikonfirmasi)",
      rejected: "❌ Rejected (Ditolak)",
    };

    return statusTexts[status] || status;
  }

  // ERROR MESSAGES
  public generateSystemErrorMessage(): string {
    return "❌ Terjadi kesalahan sistem. Silakan coba lagi atau hubungi admin.";
  }

  public generateUnknownMessage(): string {
    return `❓ Perintah tidak dikenali.

Gunakan command berikut:
/menu - 🏠 Menu utama
/help - ❓ Bantuan
/daftar - 📝 Daftar KYC`;
  }

  public generateNoActiveSessionMessage(): string {
    return `❌ Tidak ada sesi pendaftaran aktif.

/daftar - 📝 Mulai pendaftaran KYC
/menu - 🏠 Menu utama`;
  }

  public generateAlreadyRegisteredMessage(
    status: "confirmed" | "draft"
  ): string {
    if (status === "confirmed") {
      return `✅ Anda sudah terdaftar dan dikonfirmasi.

/lihat - 👁️ Lihat data KYC
/menu - 🏠 Menu utama`;
    } else {
      return `📝 Pendaftaran Anda sedang dalam status draft (menunggu konfirmasi admin).

/lihat - 👁️ Lihat data KYC
/menu - 🏠 Menu utama`;
    }
  }

  // E-METERAI MESSAGES
  public generateEmeteraiConsentMessage(
    application: KYCApplication,
    pdfUrl: string
  ): string {
    return `🎉 KYC Anda Telah Dikonfirmasi!

✅ Status: Confirmed
📄 Dokumen KYC: [Download PDF](${pdfUrl})

📜 E-Meterai Digital
Apakah Anda ingin menambahkan e-meterai digital pada dokumen KYC Anda?

ℹ️ E-meterai memberikan:
- Legalitas dokumen digital
- Keamanan tambahan
- Pengakuan hukum

/setuju - ✅ Ya, tambahkan e-meterai
/tidaksetuju - ❌ Tidak, dokumen tetap valid

Dokumen Anda tetap sah tanpa e-meterai.`;
  }

  public generateEmeteraiSuccessMessage(stampedPdfUrl: string): string {
    return `✅ E-Meterai Berhasil Ditambahkan!

📄 Dokumen dengan e-meterai: [Download PDF](${stampedPdfUrl})

🔒 Dokumen Anda sekarang memiliki:
- E-meterai digital resmi
- Legalitas yang lebih kuat
- Keamanan dokumen terjamin

Terima kasih telah menggunakan layanan kami! 🙏`;
  }

  public generateTermsConditionsMessage(): string {
    return `📋 Syarat dan Ketentuan KYC

Silakan baca dan setujui syarat dan ketentuan berikut:

1. KEBENARAN DATA
Saya menjamin bahwa semua data yang saya berikan adalah benar, akurat, dan terkini.

2. TANGGUNG JAWAB
Saya bertanggung jawab penuh atas kebenaran dan keakuratan semua informasi yang diberikan.

3. PENGGUNAAN DATA
Data saya akan digunakan untuk:
- Proses verifikasi KYC
- Keperluan bisnis dan administrasi
- Kepatuhan terhadap regulasi yang berlaku

4. VERIFIKASI DOKUMEN
Perusahaan berhak:
- Memverifikasi kebenaran dokumen
- Meminta dokumen tambahan jika diperlukan
- Melakukan cross-check dengan pihak ketiga

5. HAK PENOLAKAN
Perusahaan berhak menolak aplikasi jika:
- Data tidak valid atau tidak lengkap
- Dokumen tidak memenuhi standar
- Tidak memenuhi kriteria yang ditetapkan

6. KERAHASIAAN DATA
Data akan disimpan dengan aman dan digunakan sesuai kebijakan privasi perusahaan.

7. PERUBAHAN KETENTUAN
Syarat dan ketentuan dapat berubah sewaktu-waktu dengan pemberitahuan sebelumnya.

8. PERSETUJUAN
Dengan melanjutkan, saya menyatakan telah membaca, memahami, dan menyetujui semua syarat dan ketentuan di atas.

Apakah Anda menyetujui syarat dan ketentuan di atas?

Setuju - ✅ Ya, saya setuju (/setuju)
Tidak Setuju - ❌ Tidak, saya tidak setuju (/tidaksetuju)`;
  }

  public generateContinueRegistrationMessage(nextStep: SessionStep): string {
    const stepNumber = this.getStepNumber(nextStep);
    const stepMessage = this.generateStepMessage(nextStep);

    return `⏩ Melanjutkan Pendaftaran KYC

📝 Step ${stepNumber}/15

${stepMessage}`;
  }
  public generateRegistrationStartMessage(): string {
    return `📋 Pendaftaran KYC

Pilih opsi pendaftaran:

Mulai Pendaftaran Baru - 🆕 Mulai dari awal
Lanjutkan Sesi Pendaftaran - ⏩ Lanjutkan yang belum selesai

/menu - 🏠 Kembali ke menu utama`;
  }

  // Method untuk display current step info
  public generateCurrentStepInfo(
    currentStep: SessionStep,
    formData: FormData
  ): string {
    const stepNumber = this.getStepNumber(currentStep);
    const completedSteps = this.getCompletedStepsCount(formData);

    return `📍 Status Pendaftaran

⏳ Step saat ini: ${stepNumber}/15
✅ Step selesai: ${completedSteps}/15
📝 Current: ${this.getStepDisplayName(currentStep)}

Progress: ${Math.round((completedSteps / 15) * 100)}%`;
  }

  // Utility methods untuk step info
  private getStepDisplayName(step: SessionStep): string {
    const stepNames: {[key in SessionStep]?: string} = {
      [SessionStep.ID_CARD_PHOTO]: "Upload Foto KTP",
      [SessionStep.AGENT_NAME]: "Nama Agen",
      [SessionStep.OWNER_NAME]: "Nama Pemilik",
      [SessionStep.BUSINESS_FIELD]: "Bidang Usaha",
      [SessionStep.PIC_NAME]: "Nama PIC",
      [SessionStep.PIC_PHONE]: "Telepon PIC",
      [SessionStep.TAX_NUMBER]: "NPWP (Opsional)",
      [SessionStep.ACCOUNT_HOLDER_NAME]: "Nama Pemilik Rekening",
      [SessionStep.BANK_NAME]: "Nama Bank",
      [SessionStep.ACCOUNT_NUMBER]: "Nomor Rekening",
      [SessionStep.SIGNATURE_PHOTO]: "Upload Tanda Tangan",
      [SessionStep.LOCATION_PHOTOS]: "Upload Foto Lokasi",
      [SessionStep.BANK_BOOK_PHOTO]: "Upload Foto Buku Rekening",
      [SessionStep.TERMS_CONDITIONS]: "Syarat & Ketentuan",
      [SessionStep.CONFIRMATION]: "Konfirmasi Data",
    };

    return stepNames[step] || step;
  }

  private getCompletedStepsCount(formData: FormData): number {
    let completed = 0;

    // Check each required field
    if (formData.id_card_photo) completed++;
    if (formData.agent_name) completed++;
    if (formData.owner_name) completed++;
    if (formData.business_field) completed++;
    if (formData.pic_name) completed++;
    if (formData.pic_phone) completed++;
    // tax_number is optional, so we count it as completed by default
    completed++;
    if (formData.account_holder_name) completed++;
    if (formData.bank_name) completed++;
    if (formData.account_number) completed++;
    if (formData.signature_photo) completed++;
    if (formData.location_photos && formData.location_photos.length > 0)
      completed++;
    if (formData.bank_book_photo) completed++;
    if (formData.terms_accepted) completed++;

    return completed;
  }

  // Message untuk photo upload guidance
  public generatePhotoUploadGuidance(photoType: SessionStep): string {
    const guidance: {[key in SessionStep]?: string} = {
      [SessionStep.ID_CARD_PHOTO]: `📸 Tips Upload Foto KTP:

✅ Yang Benar:
- Foto jelas dan tidak buram
- Semua teks dapat dibaca
- Pencahayaan cukup terang
- Tidak ada bayangan atau silau
- Posisi KTP lurus dan penuh

❌ Hindari:
- Foto buram atau gelap
- Ada bayangan pada KTP
- Terpotong atau tidak lengkap
- Resolusi terlalu rendah

💡 Info: Sistem OCR akan otomatis membaca nama, NIK, alamat, agama, pekerjaan, dan kode pos dari KTP Anda.`,

      [SessionStep.SIGNATURE_PHOTO]: `✍️ Tips Upload Foto Tanda Tangan:

✅ Yang Benar:
- Gunakan background putih/terang
- Tanda tangan kontras dan jelas
- Tidak ada bayangan
- Posisi tegak dan centered

❌ Hindari:
- Background gelap atau ramai
- Tanda tangan tipis/pudar
- Ada coretan lain di kertas

💡 Info: Sistem akan otomatis menghapus background dan menyesuaikan ukuran untuk dokumen PDF.`,

      [SessionStep.LOCATION_PHOTOS]: `📍 Tips Upload Foto Lokasi:

📸 Foto yang diperlukan:
1. Tampak depan toko/warung
2. Papan nama/spanduk (jika ada)
3. Tampak dalam ruangan
4. Tampak samping (opsional)

✅ Yang Benar:
- Foto jelas dan terang
- Menunjukkan kondisi aktual
- Tampak profesional dan bersih

💡 Info: Upload 1-4 foto, lalu ketik "Lanjut" untuk melanjutkan.`,

      [SessionStep.BANK_BOOK_PHOTO]: `📄 Tips Upload Foto Buku Rekening:

✅ Yang Benar:
- Foto halaman pertama buku tabungan
- Nama pemilik terlihat jelas
- Nomor rekening terbaca
- Pencahayaan yang baik

❌ Hindari:
- Foto buram atau gelap
- Informasi tidak lengkap
- Ada yang tertutup jari/benda lain

💡 Info: Pastikan nama dan nomor rekening sesuai dengan data yang sudah diisi.`,
    };

    return guidance[photoType] || "";
  }

  // Message untuk error recovery
  public generateStepRecoveryMessage(currentStep: SessionStep): string {
    return `🔄 Pemulihan Sesi

Anda sedang berada di step: ${this.getStepDisplayName(currentStep)}

Silakan lanjutkan dari step ini atau:

/mulai - 🆕 Mulai ulang dari awal
/menu - 🏠 Kembali ke menu utama
/help - ❓ Bantuan`;
  }

  // Message untuk validation dengan suggestion
  public generateValidationErrorWithSuggestion(
    field: string,
    suggestion?: string
  ): string {
    const baseError = this.generateFieldValidationError(field);

    if (suggestion) {
      return `${baseError}\n\n💡 Saran: ${suggestion}`;
    }

    return baseError;
  }

  // Method untuk handle keyboard responses
  public generateMenuKeyboard(): any {
    return {
      reply_markup: {
        keyboard: [["Daftar KYC"], ["Menu Utama"]],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    };
  }

  public generateRegistrationKeyboard(): any {
    return {
      reply_markup: {
        keyboard: [
          ["Mulai Pendaftaran Baru"],
          ["Lanjutkan Sesi Pendaftaran"],
          ["Kembali ke Menu Utama"],
        ],
        resize_keyboard: true,
        one_time_keyboard: false,
      },
    };
  }

  public generateConfirmationKeyboard(): any {
    return {
      reply_markup: {
        keyboard: [
          ["Ya, Daftarkan"],
          ["Tidak, Ulangi Pendaftaran"],
          ["Kembali ke Menu Utama"],
        ],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    };
  }

  public generateTermsKeyboard(): any {
    return {
      reply_markup: {
        keyboard: [["Setuju"], ["Tidak Setuju"], ["Kembali ke Menu Utama"]],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    };
  }

  public generateSkipKeyboard(): any {
    return {
      reply_markup: {
        keyboard: [["Skip"], ["Kembali ke Menu Utama"]],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    };
  }

  public generateContinueKeyboard(): any {
    return {
      reply_markup: {
        keyboard: [["Lanjut"], ["Kembali ke Menu Utama"]],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    };
  }
}
