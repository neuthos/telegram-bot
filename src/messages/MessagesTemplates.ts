import {BankService} from "../services/BankService";

export class MessageTemplates {
  private botName: string;
  private bankService = new BankService();

  constructor() {
    this.botName = process.env.BOT_NAME || "KYC Registration Bot";
  }

  public generateWelcomeMessage(): string {
    return `🎉 Selamat datang di ${this.botName}!

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
        : "Confirmed (Sudah dikonfirmasi admin)";

    return `🎉 Selamat datang kembali di ${this.botName}!

Anda sudah terdaftar KYC.
Status: ${statusText}

/lihat - 👁️ Lihat Data KYC
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
/ya - ✅ Konfirmasi pendaftaran
/tidak - ❌ Ulangi pendaftaran
/setuju - ✅ Setuju syarat & ketentuan
/tolak - ❌ Tolak syarat & ketentuan
/skip - ⏭️ Lewati (untuk field opsional)

📋 Form KYC meliputi:
1. Data Agen & Pemilik
2. Data PIC & Kontak
3. Data Bank & Rekening
4. Upload Foto Lokasi (1-4 foto)
5. Upload Foto Dokumen (KTP, Buku Rekening)
6. Tanda Tangan Inisial
7. Syarat & Ketentuan

💡 Tips:
- Pastikan foto jelas dan terbaca
- Gunakan /menu untuk kembali ke menu utama
- Gunakan /lanjut untuk melanjutkan pendaftaran yang tertunda`;
  }

  public generateRegistrationOptionsMessage(): string {
    return `📋 Pilih opsi pendaftaran KYC:

/mulai - 🆕 Mulai pendaftaran baru
/lanjut - ⏩ Lanjutkan sesi pendaftaran
/menu - 🏠 Kembali ke menu utama`;
  }

  public generateStartRegistrationMessage(): string {
    return `✏️ Mulai Pendaftaran KYC

📝 Langkah 1/15: Nama Agen

Silakan masukkan nama agen:

/menu - 🏠 Kembali ke menu utama`;
  }

  public generateContinueRegistrationMessage(nextStep: string): string {
    // Special handling for terms and conditions
    if (nextStep === "terms_conditions") {
      return this.generateTermsConditionsMessage();
    }

    const stepTexts: {[key: string]: string} = {
      agent_name: "nama agen",
      agent_address: "alamat agen",
      owner_name: "nama pemilik",
      business_field: "bidang usaha",
      pic_name: "nama PIC",
      pic_phone: "nomor telepon/HP PIC",
      id_card_number: "nomor KTP (16 digit)",
      tax_number: "nomor NPWP (opsional, ketik /skip untuk lewati)",
      account_holder_name: "nama pemilik rekening",
      bank_name: "nama bank",
      account_number: "nomor rekening",
      signature_initial: "inisial untuk tanda tangan (maksimal 10 karakter)",
      location_photos:
        "foto lokasi (nama toko, tampak depan, samping dan dalam)",
      bank_book_photo: "foto buku rekening halaman pertama",
      id_card_photo: "foto KTP",
    };

    const stepNumber = this.getStepNumber(nextStep);

    return `⏩ Melanjutkan pendaftaran KYC...
  
  📝 Langkah ${stepNumber}/15: ${stepTexts[nextStep] || nextStep}
  
  Silakan masukkan ${stepTexts[nextStep] || nextStep}:
  
  /menu - 🏠 Kembali ke menu utama`;
  }

  private getStepNumber(step: string): number {
    const stepNumbers: {[key: string]: number} = {
      agent_name: 1,
      agent_address: 2,
      owner_name: 3,
      business_field: 4,
      pic_name: 5,
      pic_phone: 6,
      id_card_number: 7,
      tax_number: 8,
      account_holder_name: 9,
      bank_name: 10,
      account_number: 11,
      signature_initial: 12,
      location_photos: 13,
      bank_book_photo: 14,
      id_card_photo: 15,
      terms_conditions: 16,
    };
    return stepNumbers[step] || 0;
  }

  public generateFieldSuccessMessage(
    field: string,
    value: string,
    nextField?: string
  ): string {
    const fieldNames: {[key: string]: string} = {
      agent_name: "Nama Agen",
      agent_address: "Alamat Agen",
      owner_name: "Nama Pemilik",
      business_field: "Bidang Usaha",
      pic_name: "Nama PIC",
      pic_phone: "Nomor Telepon PIC",
      id_card_number: "Nomor KTP",
      tax_number: "Nomor NPWP",
      account_holder_name: "Nama Pemilik Rekening",
      bank_name: "Nama Bank",
      account_number: "Nomor Rekening",
      signature_initial: "Inisial Tanda Tangan",
    };

    const nextFieldTexts: {[key: string]: string} = {
      agent_address: "alamat agen",
      owner_name: "nama pemilik",
      business_field: "bidang usaha",
      pic_name: "nama PIC",
      pic_phone: "nomor telepon/HP PIC",
      id_card_number: "nomor KTP (16 digit)",
      tax_number: "nomor NPWP (opsional, ketik /skip untuk lewati)",
      account_holder_name: "nama pemilik rekening",
      bank_name: "nama bank",
      account_number: "nomor rekening",
      signature_initial: "inisial untuk tanda tangan (maksimal 10 karakter)",
      location_photos:
        "foto lokasi (nama toko, tampak depan, samping dan dalam)",
    };

    const currentStep = this.getStepNumber(field);
    const nextStep = nextField
      ? this.getStepNumber(nextField)
      : currentStep + 1;

    let message = `✅ ${fieldNames[field]}: ${value}\n\n`;

    if (nextField && nextFieldTexts[nextField]) {
      message += `📝 Langkah ${nextStep}/15: ${nextFieldTexts[nextField]}\n\n`;
      message += `Silakan masukkan ${nextFieldTexts[nextField]}:\n\n`;
    }

    message += `/menu - 🏠 Kembali ke menu utama`;

    return message;
  }

  public generatePhotoSuccessMessage(
    photoType: string,
    count?: number
  ): string {
    const photoNames: {[key: string]: string} = {
      location_photos: "Foto Lokasi",
      bank_book_photo: "Foto Buku Rekening",
      id_card_photo: "Foto KTP",
    };

    let message = `✅ ${photoNames[photoType]} berhasil diunggah!`;

    if (photoType === "location_photos" && count) {
      message += ` (${count}/4 foto)`;

      if (count < 4) {
        message += `\n\n📸 Anda bisa mengunggah ${
          4 - count
        } foto lagi atau lanjut ke step berikutnya dengan mengetik /lanjut`;
      } else {
        message += `\n\n📸 Maksimal 4 foto lokasi sudah tercapai.`;
      }
    }

    const nextSteps: {[key: string]: string} = {
      location_photos: "foto buku rekening halaman pertama",
      bank_book_photo: "foto KTP",
      id_card_photo: "syarat dan ketentuan",
    };

    if (
      nextSteps[photoType] &&
      (photoType !== "location_photos" || count === 4)
    ) {
      message += `\n\n📝 Selanjutnya: ${nextSteps[photoType]}`;
    }

    message += `\n\n/menu - 🏠 Kembali ke menu utama`;
    return message;
  }

  public generateSkipMessage(field: string): string {
    const fieldNames: {[key: string]: string} = {
      tax_number: "Nomor NPWP",
    };

    return `⏭️ ${fieldNames[field]} dilewati.

/menu - 🏠 Kembali ke menu utama`;
  }

  public generateTermsConditionsMessage(): string {
    return `📋 Syarat dan Ketentuan
  
  Dengan melanjutkan pendaftaran KYC ini, Anda menyetujui:
  
  1. Data yang saya berikan adalah benar dan akurat
  2. Saya bertanggung jawab atas kebenaran data yang diberikan
  3. Data saya akan digunakan untuk proses verifikasi KYC
  4. Perusahaan berhak menolak aplikasi jika data tidak valid
  5. Data saya akan disimpan sesuai kebijakan privasi perusahaan
  
  Apakah Anda menyetujui syarat dan ketentuan di atas?
  
  /setuju - ✅ Setuju dan lanjutkan
  /tidaksetuju - ❌ Tidak setuju (batalkan pendaftaran)
  /menu - 🏠 Kembali ke menu utama`;
  }

  public generateConfirmationMessage(formData: any): string {
    let message = `📋 Konfirmasi Data KYC

👤 **DATA AGEN & PEMILIK**
- Nama Agen: ${formData.agent_name}
- Alamat Agen: ${formData.agent_address}
- Nama Pemilik: ${formData.owner_name}
- Bidang Usaha: ${formData.business_field}

👨‍💼 **DATA PIC**
- Nama PIC: ${formData.pic_name}
- Nomor Telepon PIC: ${formData.pic_phone}

🆔 **DATA IDENTITAS**
- Nomor KTP: ${formData.id_card_number}
- Nomor NPWP: ${formData.tax_number || "Tidak diisi"}

🏦 **DATA REKENING**
- Nama Pemilik Rekening: ${formData.account_holder_name}
- Nama Bank: ${formData.bank_name}
- Nomor Rekening: ${formData.account_number}

✍️ **TANDA TANGAN**
- Inisial: ${formData.signature_initial}

📷 **DOKUMEN FOTO**
- Foto Lokasi: ${formData.location_photos?.length || 0} foto
- Foto Buku Rekening: ${formData.bank_book_photo ? "Ada" : "Belum"}
- Foto KTP: ${formData.id_card_photo ? "Ada" : "Belum"}

Apakah semua data sudah benar?

/ya - ✅ Ya, daftarkan
/tidak - ❌ Tidak, ulangi
/menu - 🏠 Menu utama`;

    return message;
  }

  public generateRegistrationSuccessMessage(formData: any): string {
    return `🎉 Selamat! Pendaftaran KYC Berhasil!

Anda telah terdaftar dengan data:
👤 Nama Agen: ${formData.agent_name}
👨‍💼 Nama PIC: ${formData.pic_name}
📱 Telepon PIC: ${formData.pic_phone}
🆔 KTP: ${formData.id_card_number}

Status: Draft (menunggu konfirmasi admin)

Terima kasih telah melengkapi data KYC! 🙏`;
  }

  public generateViewDataMessage(application: any, photos?: any[]): string {
    const statusIcon = application.status === "confirmed" ? "✅" : "⏳";
    const statusText =
      application.status === "confirmed"
        ? "Confirmed (Sudah dikonfirmasi admin)"
        : "Draft (Menunggu konfirmasi admin)";

    let message = `📄 Data KYC Anda

👤 **DATA AGEN & PEMILIK**
- Nama Agen: ${application.agent_name}
- Alamat Agen: ${application.agent_address}
- Nama Pemilik: ${application.owner_name}
- Bidang Usaha: ${application.business_field}

👨‍💼 **DATA PIC**
- Nama PIC: ${application.pic_name}
- Nomor Telepon PIC: ${application.pic_phone}

🆔 **DATA IDENTITAS**
- Nomor KTP: ${application.id_card_number}
- Nomor NPWP: ${application.tax_number || "Tidak diisi"}

🏦 **DATA REKENING**
- Nama Pemilik Rekening: ${application.account_holder_name}
- Nama Bank: ${application.bank_name}
- Nomor Rekening: ${application.account_number}

✍️ **TANDA TANGAN**
- Inisial: ${application.signature_initial}

${statusIcon} **Status**: ${statusText}
📅 **Terdaftar**: ${new Date(application.created_at).toLocaleDateString(
      "id-ID"
    )}`;

    if (photos && photos.length > 0) {
      const photoCount = {
        location_photos: 0,
        bank_book: 0,
        id_card: 0,
      };

      photos.forEach((photo) => {
        if (photo.photo_type in photoCount) {
          photoCount[photo.photo_type as keyof typeof photoCount]++;
        }
      });

      message += `\n\n📷 **DOKUMEN FOTO**`;
      message += `\n• Foto Lokasi: ${photoCount.location_photos} foto`;
      message += `\n• Foto Buku Rekening: ${
        photoCount.bank_book > 0 ? "Ada" : "Tidak ada"
      }`;
      message += `\n• Foto KTP: ${
        photoCount.id_card > 0 ? "Ada" : "Tidak ada"
      }`;
    }

    return message;
  }

  public generateAlreadyRegisteredMessage(
    status?: "draft" | "confirmed"
  ): string {
    if (status === "confirmed") {
      return "✅ Anda sudah terdaftar KYC dan telah dikonfirmasi admin. Gunakan /lihat untuk melihat data.";
    }
    return "⏳ Anda sudah terdaftar KYC dan sedang menunggu konfirmasi admin. Gunakan /lihat untuk melihat data.";
  }

  public generateUnknownMessage(): string {
    return `❓ Pesan tidak dikenali.

Gunakan command:
- /menu - 🏠 Menu utama
- /daftar - 📝 Daftar KYC
- /help - ❓ Bantuan`;
  }

  public generateSystemErrorMessage(): string {
    return "Terjadi kesalahan sistem. Silakan coba lagi.";
  }

  public generateRegistrationErrorMessage(): string {
    return "❌ Terjadi kesalahan saat mendaftarkan. Silakan coba lagi atau hubungi admin.";
  }

  public generateNoActiveSessionMessage(): string {
    return "❌ Tidak ada sesi konfirmasi aktif. Ketik /daftar untuk memulai pendaftaran.";
  }

  public generateFieldValidationError(field: string): string {
    const errorMessages: {[key: string]: string} = {
      agent_name: "Nama agen harus minimal 3 karakter",
      agent_address: "Alamat agen harus minimal 10 karakter",
      owner_name: "Nama pemilik harus minimal 3 karakter",
      business_field: "Bidang usaha harus minimal 3 karakter",
      pic_name: "Nama PIC harus minimal 3 karakter",
      pic_phone:
        "Format nomor telepon tidak valid. Contoh: 081234567890 atau +6281234567890",
      id_card_number: "Nomor KTP harus 16 digit angka",
      tax_number: "Nomor NPWP harus 15 digit angka",
      account_holder_name: "Nama pemilik rekening harus minimal 3 karakter",
      bank_name: "Nama bank harus minimal 3 karakter",
      account_number:
        "Nomor rekening harus minimal 8 karakter dan maksimal 20 karakter",
      signature_initial: "Inisial harus 1-10 karakter",
    };

    return `❌ ${
      errorMessages[field] || "Input tidak valid"
    }. Silakan masukkan kembali:

/menu - 🏠 Kembali ke menu utama`;
  }

  public generateIdCardDuplicateError(): string {
    return `❌ Nomor KTP sudah terdaftar. Silakan masukkan nomor KTP yang berbeda:

/menu - 🏠 Kembali ke menu utama`;
  }

  public generatePhotoValidationError(photoType: string): string {
    const photoNames: {[key: string]: string} = {
      location_photos: "foto lokasi",
      bank_book_photo: "foto buku rekening",
      id_card_photo: "foto KTP",
    };

    return `❌ Silakan kirim ${photoNames[photoType]} dalam format foto (JPG, PNG).

/menu - 🏠 Kembali ke menu utama`;
  }

  public generateLocationPhotosLimitError(): string {
    return `❌ Maksimal 4 foto lokasi. Anda sudah mengunggah 4 foto.

Ketik /lanjut untuk melanjutkan ke step berikutnya.

/menu - 🏠 Kembali ke menu utama`;
  }

  public generateLocationPhotosMinError(): string {
    return `❌ Minimal 1 foto lokasi diperlukan.

Silakan kirim foto lokasi (Nama Toko, tampak depan, samping dan dalam):

/menu - 🏠 Kembali ke menu utama`;
  }

  public generateWelcomeMessageRejected(remark: string): string {
    return `🎉 Selamat datang kembali di ${this.botName}!

❌ Aplikasi KYC sebelumnya ditolak.
📝 Alasan: ${remark}

Anda dapat mendaftar ulang dengan data yang benar.

/daftar - 📝 Daftar KYC Ulang
/menu - 🏠 Menu Utama
/help - ❓ Bantuan`;
  }

  public async generateBankSelectionMessage(): Promise<string> {
    try {
      const bankCommands = await this.bankService.getBankCommands();
      const bankOptions = bankCommands
        .map((bank) => `/${bank.command} - ${bank.name}`)
        .join("\n");

      return `🏦 *Pilih Bank*
  
  Silakan pilih bank Anda dengan mengetik command:

${bankOptions}`;
    } catch (error) {
      return `🏦 *Pilih Bank*
  
  Silakan ketik nama bank Anda dengan format:
  /BankCentralAsia
  /BankMandiri
  /BankNegara Indonesia
  dst.
  
  (Format: /NamaBankTanpaSpasi)`;
    }
  }
}
