export class MessageTemplates {
  private botName: string;

  constructor() {
    this.botName = process.env.BOT_NAME || "KYC Registration Bot";
  }

  public generateWelcomeMessage(): string {
    return `🎉 Selamat datang di ${this.botName}!

Pilih menu di bawah atau gunakan command:

/daftar - 📝 Daftar Merchant
/menu - 🏠 Menu Utama
/help - ❓ Bantuan`;
  }

  public generateWelcomeMessageRegistered(
    status: "draft" | "confirmed"
  ): string {
    const statusText =
      status === "draft"
        ? "Draft (Menunggu konfirmasi admin)"
        : "Confirmed (Sudah dikonfirmasi admin)";

    return `🎉 Selamat datang kembali di ${this.botName}!

Anda sudah terdaftar sebagai merchant.
Status: ${statusText}

/lihat - 👁️ Lihat Data
/menu - 🏠 Menu Utama
/help - ❓ Bantuan`;
  }

  public generateHelpMessage(): string {
    return `📖 Panduan Penggunaan Bot

🔸 Command Utama:
/start - Memulai bot
/daftar - 📝 Daftar sebagai merchant
/menu - 🏠 Kembali ke menu utama
/help - ❓ Tampilkan panduan

🔸 Command untuk User Terdaftar:
/lihat - 👁️ Lihat data

🔸 Command Pendaftaran:
/mulai - 🆕 Mulai pendaftaran baru
/lanjut - ⏩ Lanjutkan sesi pendaftaran

🔸 Command Konfirmasi:
/ya - ✅ Konfirmasi pendaftaran
/tidak - ❌ Ulangi pendaftaran

💡 Tips:
- Gunakan button jika tersedia (mobile/desktop app)
- Gunakan command jika button tidak muncul (web)
- Ketik /menu kapan saja untuk kembali ke menu utama`;
  }

  public generateRegistrationOptionsMessage(): string {
    return `📋 Pilih opsi pendaftaran:

/mulai - 🆕 Mulai pendaftaran baru
/lanjut - ⏩ Lanjutkan sesi pendaftaran
/menu - 🏠 Kembali ke menu utama`;
  }

  public generateStartRegistrationMessage(): string {
    return `✏️ Mulai Pendaftaran Merchant

Silakan masukkan nama lengkap Anda:

/menu - 🏠 Kembali ke menu utama`;
  }

  public generateContinueRegistrationMessage(nextStep: string): string {
    const stepText = {
      nama: "nama lengkap",
      nomor_telepon: "nomor telepon",
      nomor_ktp: "nomor KTP (16 digit)",
      alamat: "alamat lengkap",
    };

    return `⏩ Melanjutkan pendaftaran...

Silakan masukkan ${stepText[nextStep as keyof typeof stepText]}:

/menu - 🏠 Kembali ke menu utama`;
  }

  public generateNamaSuccessMessage(nama: string): string {
    return `✅ Nama: ${nama}

📱 Silakan masukkan nomor telepon Anda:
Contoh: 081234567890 atau +6281234567890

/menu - 🏠 Kembali ke menu utama`;
  }

  public generateTeleponSuccessMessage(telepon: string): string {
    return `✅ Nomor Telepon: ${telepon}

🆔 Silakan masukkan nomor KTP Anda (16 digit):

/menu - 🏠 Kembali ke menu utama`;
  }

  public generateKtpSuccessMessage(ktp: string): string {
    return `✅ Nomor KTP: ${ktp}

🏠 Silakan masukkan alamat lengkap Anda:

/menu - 🏠 Kembali ke menu utama`;
  }

  public generateConfirmationMessage(formData: any): string {
    return `📋 Konfirmasi Data Pendaftaran

👤 Nama: ${formData.nama}
📱 Nomor Telepon: ${formData.nomor_telepon}
🆔 Nomor KTP: ${formData.nomor_ktp}
🏠 Alamat: ${formData.alamat}

Apakah data sudah benar?

/ya - ✅ Ya, daftarkan
/tidak - ❌ Tidak, ulangi
/menu - 🏠 Menu utama`;
  }

  public generateRegistrationSuccessMessage(formData: any): string {
    return `🎉 Selamat! Pendaftaran Berhasil!

Anda telah terdaftar sebagai merchant dengan data:
👤 Nama: ${formData.nama}
📱 Telepon: ${formData.nomor_telepon}
🆔 KTP: ${formData.nomor_ktp}

Status: Draft (menunggu konfirmasi admin)

Terima kasih telah bergabung dengan kami! 🙏`;
  }

  public generateViewDataMessage(data: any): string {
    const statusIcon = data.status === "confirmed" ? "✅" : "⏳";
    const statusText =
      data.status === "confirmed"
        ? "Confirmed (Sudah dikonfirmasi admin)"
        : "Draft (Menunggu konfirmasi admin)";

    return `📄 Data Merchant Anda

👤 Nama: ${data.nama}
📱 Nomor Telepon: ${data.nomor_telepon}
🆔 Nomor KTP: ${data.nomor_ktp}
🏠 Alamat: ${data.alamat}
${statusIcon} Status: ${statusText}

📅 Terdaftar: ${new Date(data.created_at).toLocaleDateString("id-ID")}`;
  }

  public generateAlreadyRegisteredMessage(): string {
    return "Anda sudah terdaftar sebagai merchant. Gunakan /lihat untuk melihat data.";
  }

  public generateUnknownMessage(): string {
    return `❓ Pesan tidak dikenali.

Gunakan command:
• /menu - 🏠 Menu utama
• /daftar - 📝 Daftar merchant
• /help - ❓ Bantuan`;
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

  // Validation error messages
  public generateNamaValidationError(): string {
    return `❌ Nama harus minimal 3 karakter. Silakan masukkan nama yang valid:

/menu - 🏠 Kembali ke menu utama`;
  }

  public generateTeleponValidationError(): string {
    return `❌ Format nomor telepon tidak valid.
Contoh: 081234567890 atau +6281234567890

/menu - 🏠 Kembali ke menu utama`;
  }

  public generateKtpValidationError(): string {
    return `❌ Nomor KTP harus 16 digit angka. Silakan masukkan nomor KTP yang valid:

/menu - 🏠 Kembali ke menu utama`;
  }

  public generateKtpDuplicateError(): string {
    return `❌ Nomor KTP sudah terdaftar. Silakan masukkan nomor KTP yang berbeda:

/menu - 🏠 Kembali ke menu utama`;
  }

  public generateAlamatValidationError(): string {
    return `❌ Alamat harus minimal 10 karakter. Silakan masukkan alamat yang lengkap:

/menu - 🏠 Kembali ke menu utama`;
  }
}
