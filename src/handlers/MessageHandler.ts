import TelegramBot from "node-telegram-bot-api";
import {SessionService} from "../services/SessionServices";
import {FileService} from "../services/FileService";
import {BankService} from "../services/BankService";
import {Logger} from "../config/logger";
import {MessageTemplates} from "../messages/MessagesTemplates";
import {SessionStep, KYCApplication, UserSession} from "../types";
import {BusinessFieldService} from "../services/BusinessFieldService";
import {ProvinceService} from "../services/ProvinceService";
import {OCRService} from "../services/OCRService";
import {SignatureService} from "../services/SignatureService";

export class MessageHandler {
  private sessionService = new SessionService();
  private fileService = new FileService();
  private ocrService = new OCRService();
  private signatureService = new SignatureService();
  private bankService = new BankService();
  private logger = Logger.getInstance();
  private messages = new MessageTemplates();
  private businessFieldService = new BusinessFieldService();
  private provinceService = new ProvinceService();

  async handleMessage(
    bot: TelegramBot,
    msg: TelegramBot.Message,
    partnerId: number
  ): Promise<void> {
    const telegramId = msg.from!.id;
    const text = msg.text?.trim();

    this.logger.info("Message received:", {
      partnerId,
      telegramId,
      username: msg.from!.username,
      text: text || "[photo/file]",
      messageId: msg.message_id,
      hasPhoto: !!msg.photo,
    });

    try {
      if (text?.startsWith("/")) {
        await this.handleCommand(bot, telegramId, text, msg, partnerId);
        return;
      }

      const registrationCheck = await this.sessionService.canUserRegister(
        partnerId,
        telegramId
      );
      const session = await this.sessionService.getActiveSession(
        partnerId,
        telegramId
      );

      if (!registrationCheck.canRegister) {
        if (registrationCheck.reason === "already_confirmed") {
          await bot.sendMessage(
            telegramId,
            this.messages.generateAlreadyRegisteredMessage("confirmed")
          );
        } else if (registrationCheck.reason === "already_draft") {
          await bot.sendMessage(
            telegramId,
            this.messages.generateAlreadyRegisteredMessage("draft")
          );
        }
        return;
      }

      let activeSession = session;

      if (!activeSession) {
        activeSession = await this.sessionService.createOrUpdateSession({
          partner_id: partnerId,
          telegram_id: telegramId,
          username: msg.from!.username,
          first_name: msg.from!.first_name,
          last_name: msg.from!.last_name,
          current_step: SessionStep.MENU,
          form_data: {},
        });

        if (registrationCheck.reason === "previous_rejected") {
          await bot.sendMessage(
            telegramId,
            this.messages.generateWelcomeMessageRejected(
              registrationCheck.remark!
            )
          );
        } else {
          await this.sendWelcomeMessage(bot, telegramId);
        }
        return;
      }

      await this.processMessage(bot, msg, activeSession, partnerId);
    } catch (error) {
      console.log(error);
      this.logger.error("Error handling message:", {
        partnerId,
        telegramId,
        text,
        error,
      });
      await bot.sendMessage(
        telegramId,
        this.messages.generateSystemErrorMessage()
      );
    }
  }

  private async handleCommand(
    bot: TelegramBot,
    telegramId: number,
    command: string,
    msg: TelegramBot.Message,
    partnerId: number
  ): Promise<void> {
    this.logger.info("Command received:", {partnerId, telegramId, command});

    const registrationCheck = await this.sessionService.canUserRegister(
      partnerId,
      telegramId
    );

    switch (command) {
      case "/start":
      case "/menu":
        await this.handleMenuToMain(bot, telegramId, msg, partnerId);
        break;
      case "/daftar":
        if (!registrationCheck.canRegister) {
          if (registrationCheck.reason === "already_confirmed") {
            await bot.sendMessage(
              telegramId,
              this.messages.generateAlreadyRegisteredMessage("confirmed")
            );
          } else if (registrationCheck.reason === "already_draft") {
            await bot.sendMessage(
              telegramId,
              this.messages.generateAlreadyRegisteredMessage("draft")
            );
          }
        } else {
          await this.handleMenuSelection(
            bot,
            telegramId,
            "Daftar KYC",
            msg,
            partnerId
          );
        }
        break;
      case "/mulai":
        await this.handleRegistrationOption(
          bot,
          telegramId,
          "Mulai Pendaftaran Baru",
          msg,
          partnerId
        );
        break;
      case "/lanjut":
        await this.handleRegistrationOption(
          bot,
          telegramId,
          "Lanjutkan Sesi Pendaftaran",
          msg,
          partnerId
        );
        break;
      case "/help":
        await this.sendHelpMessage(bot, telegramId);
        break;
      case "/skip":
        await this.handleSkipCommand(bot, telegramId, partnerId);
        break;
      case "/setuju":
      case "/tidaksetuju":
        const confirmedApp = await this.sessionService.getKYCApplication(
          partnerId,
          telegramId
        );
        if (
          confirmedApp &&
          confirmedApp.status === "confirmed" &&
          confirmedApp.user_emeterai_consent === null
        ) {
          const consent = command === "/setuju";
          await this.handleEmeteraiConsent(
            bot,
            telegramId,
            consent,
            confirmedApp
          );
          return;
        }

        const session = await this.sessionService.getActiveSession(
          partnerId,
          telegramId
        );
        if (!session) {
          await bot.sendMessage(
            telegramId,
            this.messages.generateNoActiveSessionMessage()
          );
          return;
        }

        await this.handleTermsConditions(
          bot,
          telegramId,
          command,
          session,
          msg,
          partnerId
        );
        break;
      case "/ya":
      case "/tidak":
        const confirmSession = await this.sessionService.getActiveSession(
          partnerId,
          telegramId
        );
        if (!confirmSession) {
          await bot.sendMessage(
            telegramId,
            this.messages.generateNoActiveSessionMessage()
          );
          return;
        }
        const actionText =
          command === "/ya" ? "Ya, Daftarkan" : "Tidak, Ulangi Pendaftaran";
        await this.handleConfirmation(
          bot,
          telegramId,
          actionText,
          confirmSession,
          msg,
          partnerId
        );
        break;
      case "/konfirm":
        const activeSession = await this.sessionService.getActiveSession(
          partnerId,
          telegramId
        );
        if (!activeSession) {
          await bot.sendMessage(
            telegramId,
            this.messages.generateNoActiveSessionMessage()
          );
          return;
        }

        if (activeSession.current_step === SessionStep.ID_CARD_PREVIEW) {
          await this.handleIdCardPreview(
            bot,
            telegramId,
            "/konfirm",
            activeSession
          );
        } else if (
          activeSession.current_step === SessionStep.SIGNATURE_PREVIEW
        ) {
          await this.handleSignaturePreview(
            bot,
            telegramId,
            "/konfirm",
            activeSession
          );
        } else {
          await bot.sendMessage(
            telegramId,
            "❌ Command /konfirm hanya bisa digunakan pada step preview."
          );
        }
        break;

      case "/ulangi":
        const retrySession = await this.sessionService.getActiveSession(
          partnerId,
          telegramId
        );
        if (!retrySession) {
          await bot.sendMessage(
            telegramId,
            this.messages.generateNoActiveSessionMessage()
          );
          return;
        }

        if (retrySession.current_step === SessionStep.ID_CARD_PREVIEW) {
          await this.handleIdCardPreview(
            bot,
            telegramId,
            "/ulangi",
            retrySession
          );
        } else if (
          retrySession.current_step === SessionStep.SIGNATURE_PREVIEW
        ) {
          await this.handleSignaturePreview(
            bot,
            telegramId,
            "/ulangi",
            retrySession
          );
        } else {
          await bot.sendMessage(
            telegramId,
            "❌ Command /ulangi hanya bisa digunakan pada step preview."
          );
        }
        break;
      default:
        await this.handleSelectionCommand(
          bot,
          telegramId,
          command.substring(1),
          partnerId
        );
    }
  }

  private async handleSelectionCommand(
    bot: TelegramBot,
    telegramId: number,
    selection: string,
    partnerId: number
  ): Promise<void> {
    const session = await this.sessionService.getActiveSession(
      partnerId,
      telegramId
    );
    if (!session) {
      await this.handleUnknownMessage(bot, telegramId, partnerId);
      return;
    }

    switch (session.current_step) {
      case SessionStep.BANK_NAME:
        await this.handleBankSelection(bot, telegramId, selection, partnerId);
        break;
      case SessionStep.BUSINESS_FIELD:
        await this.handleBusinessFieldSelection(
          bot,
          telegramId,
          selection,
          partnerId
        );
        break;
      case SessionStep.PROVINCE_SELECTION:
        await this.handleProvinceSelection(
          bot,
          telegramId,
          selection,
          partnerId
        );
        break;
      case SessionStep.CITY_SELECTION:
        await this.handleCitySelection(bot, telegramId, selection, partnerId);
        break;
      default:
        await this.handleUnknownMessage(bot, telegramId, partnerId);
    }
  }

  private async sendNextStepMessage(
    bot: TelegramBot,
    telegramId: number,
    nextStep: SessionStep
  ): Promise<void> {
    if (nextStep === SessionStep.ID_CARD_PHOTO && process.env.KTP_EXAMPLE_URL) {
      await bot.sendPhoto(telegramId, process.env.KTP_EXAMPLE_URL, {
        caption: "📋 Contoh foto KTP yang baik:",
      });
    } else if (
      nextStep === SessionStep.SIGNATURE_PHOTO &&
      process.env.SIGNATURE_EXAMPLE_URL
    ) {
      await bot.sendPhoto(telegramId, process.env.SIGNATURE_EXAMPLE_URL, {
        caption: "📋 Contoh foto tanda tangan yang baik:",
      });
    }

    const message = this.messages.generateStepMessage(nextStep);

    if (nextStep === SessionStep.BUSINESS_FIELD) {
      await bot.sendMessage(telegramId, message);
      const businessFieldMessage =
        await this.messages.generateBusinessFieldSelectionMessage();
      await bot.sendMessage(telegramId, businessFieldMessage);
    } else if (nextStep === SessionStep.BANK_NAME) {
      await bot.sendMessage(telegramId, message);
      const bankMessage = await this.messages.generateBankSelectionMessage();
      await bot.sendMessage(telegramId, bankMessage);
    } else {
      await bot.sendMessage(telegramId, message);
    }
  }

  private getKeyboardOptions(step: SessionStep): any {
    const baseOptions = {
      reply_markup: {
        keyboard: [["Kembali ke Menu Utama"]],
        resize_keyboard: true,
      },
    };

    switch (step) {
      case SessionStep.TAX_NUMBER:
        return {
          reply_markup: {
            keyboard: [["Skip"], ["Kembali ke Menu Utama"]],
            resize_keyboard: true,
          },
        };
      case SessionStep.LOCATION_PHOTOS:
        return {
          reply_markup: {
            keyboard: [["Lanjut"], ["Kembali ke Menu Utama"]],
            resize_keyboard: true,
          },
        };
      case SessionStep.TERMS_CONDITIONS:
        return {
          reply_markup: {
            keyboard: [["Setuju"], ["Tidak Setuju"], ["Kembali ke Menu Utama"]],
            resize_keyboard: true,
          },
        };
      case SessionStep.CONFIRMATION:
        return {
          reply_markup: {
            keyboard: [
              ["Ya, Daftarkan"],
              ["Tidak, Ulangi Pendaftaran"],
              ["Kembali ke Menu Utama"],
            ],
            resize_keyboard: true,
          },
        };
      default:
        return baseOptions;
    }
  }

  private async handleBankSelection(
    bot: TelegramBot,
    telegramId: number,
    bankCommand: string,
    partnerId: number
  ): Promise<void> {
    const session = await this.sessionService.getActiveSession(
      partnerId,
      telegramId
    );

    if (!session || session.current_step !== SessionStep.BANK_NAME) {
      await this.handleUnknownMessage(bot, telegramId, partnerId);
      return;
    }

    const bankName = await this.bankService.getBankByCommand(bankCommand);

    if (!bankName) {
      await bot.sendMessage(
        telegramId,
        `Bank command "/${bankCommand}" tidak tersedia. Silakan pilih dari daftar bank yang tersedia.`
      );
      const bankMessage = await this.messages.generateBankSelectionMessage();
      await bot.sendMessage(telegramId, bankMessage);
      return;
    }

    const formData = {...session.form_data, bank_name: bankName};
    const nextStep = await this.sessionService.getNextStep(formData);

    await this.sessionService.createOrUpdateSession({
      ...session,
      form_data: formData,
      current_step: nextStep,
    });

    await bot.sendMessage(
      telegramId,
      this.messages.generateFieldSuccessMessage("bank_name", bankName, nextStep)
    );

    await this.sendNextStepMessage(bot, telegramId, nextStep);
  }

  private async handleLocationPhotosComplete(
    bot: TelegramBot,
    telegramId: number,
    session: UserSession,
    partnerId: number
  ): Promise<void> {
    if (
      !session.form_data.location_photos ||
      session.form_data.location_photos.length === 0
    ) {
      await bot.sendMessage(
        telegramId,
        "❌ Minimal harus upload 1 foto lokasi."
      );
      return;
    }

    const nextStep = await this.sessionService.getNextStep(session.form_data);

    await this.sessionService.createOrUpdateSession({
      ...session,
      current_step: nextStep,
    });

    await bot.sendMessage(
      telegramId,
      `✅ ${session.form_data.location_photos.length} foto lokasi berhasil diupload!`
    );

    await this.sendNextStepMessage(bot, telegramId, nextStep);
  }

  private async handlePostalCodeInput(
    bot: TelegramBot,
    telegramId: number,
    text: string,
    session: UserSession
  ): Promise<void> {
    const postalRegex = /^\d{5}$/;
    if (!postalRegex.test(text)) {
      await bot.sendMessage(telegramId, "❌ Kode pos harus 5 digit angka.");
      return;
    }

    const formData = {...session.form_data, postal_code: text};
    const nextStep = await this.sessionService.getNextStep(formData);

    await this.sessionService.createOrUpdateSession({
      ...session,
      form_data: formData,
      current_step: nextStep,
    });

    await bot.sendMessage(
      telegramId,
      this.messages.generateFieldSuccessMessage("postal_code", text, nextStep)
    );

    await this.sendNextStepMessage(bot, telegramId, nextStep);
  }

  private async handleAccountOwnerConfirmation(
    bot: TelegramBot,
    telegramId: number,
    text: string,
    session: UserSession
  ): Promise<void> {
    let isSame: boolean;

    if (text === "Ya" || text === "/ya") {
      isSame = true;
    } else if (text === "Tidak" || text === "/tidak") {
      isSame = false;
    } else {
      await bot.sendMessage(
        telegramId,
        "❌ Pilihan tidak valid. Ketik 'Ya' atau 'Tidak'"
      );
      return;
    }

    let formData = {...session.form_data, account_owner_same: isSame};

    if (isSame) {
      formData.account_holder_name = session.form_data.full_name;
    }

    const nextStep = await this.sessionService.getNextStep(formData);

    await this.sessionService.createOrUpdateSession({
      ...session,
      form_data: formData,
      current_step: nextStep,
    });

    if (isSame) {
      await bot.sendMessage(
        telegramId,
        `✅ Nama pemilik rekening: ${formData.account_holder_name}`
      );
    } else {
      await bot.sendMessage(
        telegramId,
        "✅ Anda akan diminta mengisi nama pemilik rekening terpisah."
      );
    }

    await this.sendNextStepMessage(bot, telegramId, nextStep);
  }

  private async handleSerialNumberInput(
    bot: TelegramBot,
    telegramId: number,
    text: string,
    session: UserSession
  ): Promise<void> {
    if (!text || text.length < 3) {
      await bot.sendMessage(
        telegramId,
        "❌ Serial number EDC harus minimal 3 karakter."
      );
      return;
    }

    const formData = {...session.form_data, serial_number_edc: text};
    const nextStep = await this.sessionService.getNextStep(formData);

    await this.sessionService.createOrUpdateSession({
      ...session,
      form_data: formData,
      current_step: nextStep,
    });

    await bot.sendMessage(
      telegramId,
      this.messages.generateFieldSuccessMessage(
        "serial_number_edc",
        text,
        nextStep
      )
    );

    await this.sendNextStepMessage(bot, telegramId, nextStep);
  }

  private async handleIdCardPreview(
    bot: TelegramBot,
    telegramId: number,
    text: string,
    session: UserSession
  ): Promise<void> {
    if (text === "/konfirm") {
      const formData = {...session.form_data, id_card_confirmed: true};
      const nextStep = await this.sessionService.getNextStep(formData);

      await this.sessionService.createOrUpdateSession({
        ...session,
        form_data: formData,
        current_step: nextStep,
      });

      await bot.sendMessage(telegramId, "✅ Data KTP dikonfirmasi!");
      await this.sendNextStepMessage(bot, telegramId, nextStep);
    } else if (text === "/ulangi") {
      const formData = {...session.form_data};
      delete formData.id_card_photo;
      delete formData.full_name;
      delete formData.address;
      delete formData.id_card_number;
      delete formData.religion;
      delete formData.occupation;

      await this.sessionService.createOrUpdateSession({
        ...session,
        form_data: formData,
        current_step: SessionStep.ID_CARD_PHOTO,
      });

      await bot.sendMessage(
        telegramId,
        "🔄 Silakan upload ulang foto KTP Anda."
      );
      await this.sendNextStepMessage(
        bot,
        telegramId,
        SessionStep.ID_CARD_PHOTO
      );
    } else {
      await bot.sendMessage(
        telegramId,
        "❌ Pilihan tidak valid. Gunakan /konfirm atau /ulangi"
      );
    }
  }

  private async handleSignaturePreview(
    bot: TelegramBot,
    telegramId: number,
    text: string,
    session: UserSession
  ): Promise<void> {
    if (text === "/konfirm") {
      const formData = {...session.form_data, signature_confirmed: true};
      const nextStep = await this.sessionService.getNextStep(formData);

      await this.sessionService.createOrUpdateSession({
        ...session,
        form_data: formData,
        current_step: nextStep,
      });

      await bot.sendMessage(telegramId, "✅ Tanda tangan dikonfirmasi!");
      await this.sendNextStepMessage(bot, telegramId, nextStep);
    } else if (text === "/ulangi") {
      const formData = {...session.form_data};
      delete formData.signature_photo;

      await this.sessionService.createOrUpdateSession({
        ...session,
        form_data: formData,
        current_step: SessionStep.SIGNATURE_PHOTO,
      });

      await bot.sendMessage(
        telegramId,
        "🔄 Silakan upload ulang foto tanda tangan Anda."
      );
      await this.sendNextStepMessage(
        bot,
        telegramId,
        SessionStep.SIGNATURE_PHOTO
      );
    } else {
      await bot.sendMessage(
        telegramId,
        "❌ Pilihan tidak valid. Gunakan /konfirm atau /ulangi"
      );
    }
  }

  private async processMessage(
    bot: TelegramBot,
    msg: TelegramBot.Message,
    session: UserSession,
    partnerId: number
  ): Promise<void> {
    const telegramId = msg.from!.id;
    const text = msg.text?.trim();

    // Handle photo uploads - FLOW BARU
    if (msg.photo && this.isPhotoStep(session.current_step)) {
      await this.handlePhotoUpload(bot, msg, session, partnerId);
      return;
    }

    // Handle text untuk location photos
    if (
      session.current_step === SessionStep.LOCATION_PHOTOS &&
      text === "Lanjut"
    ) {
      await this.handleLocationPhotosComplete(
        bot,
        telegramId,
        session,
        partnerId
      );
      return;
    }

    // Handle text inputs based on current step
    switch (session.current_step) {
      case SessionStep.MENU:
        await this.handleMenuSelection(bot, telegramId, text!, msg, partnerId);
        break;
      case SessionStep.REGISTRATION_START:
        await this.handleRegistrationOption(
          bot,
          telegramId,
          text!,
          msg,
          partnerId
        );
        break;
      case SessionStep.POSTAL_CODE:
        await this.handlePostalCodeInput(bot, telegramId, text!, session);
        break;
      case SessionStep.AGENT_NAME:
        await this.handleAgentNameInput(
          bot,
          telegramId,
          text!,
          session,
          partnerId
        );
        break;
      case SessionStep.OWNER_NAME:
        await this.handleOwnerNameInput(bot, telegramId, text!, session);
        break;
      case SessionStep.BUSINESS_FIELD:
        await this.handleBusinessFieldInput(bot, telegramId, text!, session);
        break;
      case SessionStep.PIC_NAME:
        await this.handlePICNameInput(bot, telegramId, text!, session);
        break;
      case SessionStep.PIC_PHONE:
        await this.handlePICPhoneInput(bot, telegramId, text!, session);
        break;
      case SessionStep.TAX_NUMBER:
        await this.handleTaxNumberInput(bot, telegramId, text!, session);
        break;
      case SessionStep.ACCOUNT_HOLDER_NAME:
        await this.handleAccountHolderNameInput(
          bot,
          telegramId,
          text!,
          session,
          partnerId
        );
        break;
      case SessionStep.BANK_NAME:
        await this.handleBankNameInput(
          bot,
          telegramId,
          text!,
          session,
          partnerId
        );
        break;
      case SessionStep.ACCOUNT_NUMBER:
        await this.handleAccountNumberInput(bot, telegramId, text!, session);
        break;
      case SessionStep.TERMS_CONDITIONS:
        await this.handleTermsConditions(
          bot,
          telegramId,
          text!,
          session,
          msg,
          partnerId
        );
        break;
      case SessionStep.CONFIRMATION:
        await this.handleConfirmation(
          bot,
          telegramId,
          text!,
          session,
          msg,
          partnerId
        );
        break;
      // Photo steps - tidak ada text input
      case SessionStep.ID_CARD_PHOTO:
      case SessionStep.SIGNATURE_PHOTO:
      case SessionStep.BANK_BOOK_PHOTO:
        await bot.sendMessage(
          telegramId,
          this.messages.generatePhotoValidationError(session.current_step)
        );
        break;
      case SessionStep.ACCOUNT_OWNER_CONFIRMATION:
        await this.handleAccountOwnerConfirmation(
          bot,
          telegramId,
          text!,
          session
        );
        break;
      case SessionStep.SERIAL_NUMBER_EDC:
        await this.handleSerialNumberInput(bot, telegramId, text!, session);
        break;
      case SessionStep.ID_CARD_PREVIEW:
        await this.handleIdCardPreview(bot, telegramId, text!, session);
        break;
      case SessionStep.SIGNATURE_PREVIEW:
        await this.handleSignaturePreview(bot, telegramId, text!, session);
        break;
      default:
        await this.handleUnknownMessage(bot, telegramId, partnerId);
    }
  }

  private async handleBankNameInput(
    bot: TelegramBot,
    telegramId: number,
    text: string,
    session: UserSession,
    partnerId: number
  ): Promise<void> {
    if (!text.startsWith("/")) {
      const bankMessage = await this.messages.generateBankSelectionMessage();
      await bot.sendMessage(telegramId, bankMessage);
      return;
    }

    const bankName = text.substring(1);
    const isValid = await this.bankService.isValidBank(bankName);

    if (!isValid) {
      await bot.sendMessage(
        telegramId,
        "❌ Bank tidak ditemukan. Silakan pilih dari daftar yang tersedia."
      );
      const bankMessage = await this.messages.generateBankSelectionMessage();
      await bot.sendMessage(telegramId, bankMessage);
      return;
    }

    const formData = {...session.form_data, bank_name: bankName};
    const nextStep = await this.sessionService.getNextStep(formData);

    await this.sessionService.createOrUpdateSession({
      ...session,
      form_data: formData,
      current_step: nextStep,
    });

    await bot.sendMessage(
      telegramId,
      this.messages.generateFieldSuccessMessage("bank_name", bankName, nextStep)
    );

    await this.sendNextStepMessage(bot, telegramId, nextStep);
  }

  private isPhotoStep(step: string): boolean {
    return [
      SessionStep.ID_CARD_PHOTO, // Pertama untuk OCR
      SessionStep.SIGNATURE_PHOTO, // Ganti signature_initial
      SessionStep.LOCATION_PHOTOS,
      SessionStep.BANK_BOOK_PHOTO,
    ].includes(step as SessionStep);
  }

  private async handleKTPPhotoUpload(
    bot: TelegramBot,
    telegramId: number,
    photoId: string, // Change to photoId instead of fileUrl
    session: UserSession
  ): Promise<void> {
    await bot.sendMessage(telegramId, "🔍 Memproses KTP dengan OCR...");

    try {
      // Download original file buffer
      const {buffer, mimeType, fileName} =
        await this.fileService.downloadOriginalFile(bot, photoId);

      // Process with OCR using file buffer
      const ocrResult = await this.ocrService.processKTPFile(
        buffer,
        fileName,
        mimeType
      );

      if (!ocrResult.success) {
        await bot.sendMessage(
          telegramId,
          `❌ ${ocrResult.message}\n\n` +
            `📸 Silakan upload ulang foto KTP dengan kualitas yang lebih baik:\n` +
            `• Pastikan foto jelas dan tidak buram\n` +
            `• Semua teks harus terbaca\n` +
            `• Pencahayaan yang cukup\n` +
            `• Tidak ada bayangan atau pantulan`
        );
        return;
      }

      if (ocrResult.data) {
        const provinceCode = ocrResult.data.nik
          ? ocrResult.data.nik.substring(0, 2)
          : "";

        const uploadResult = await this.fileService.downloadAndUploadPhoto(
          bot,
          photoId,
          telegramId,
          "id_card"
        );

        const formData = {
          ...session.form_data,
          id_card_photo: uploadResult.fileUrl, // Store CDN URL for later use
          full_name: ocrResult.data.nama,
          address: ocrResult.data.alamat,
          id_card_number: ocrResult.data.nik,
          religion: ocrResult.data.agama,
          occupation: ocrResult.data.pekerjaan,
          province_name: ocrResult.data.provinsi,
          province_code: provinceCode,
          city_name: ocrResult.data.kota,
        };

        const nextStep = await this.sessionService.getNextStep(formData);

        await this.sessionService.createOrUpdateSession({
          ...session,
          form_data: formData,
          current_step: nextStep,
        });

        // Show preview
        await bot.sendMessage(
          telegramId,
          `✅ KTP berhasil diproses!\n\n` +
            `📋 Data yang terdeteksi:\n` +
            `👤 Nama: ${ocrResult.data.nama}\n` +
            `🆔 NIK: ${ocrResult.data.nik}\n` +
            `📍 Alamat: ${ocrResult.data.alamat}\n` +
            `🏙️ Provinsi: ${ocrResult.data.provinsi}\n` +
            `🏛️ Kota: ${ocrResult.data.kota}\n` +
            `💼 Pekerjaan: ${
              ocrResult.data.pekerjaan || "Tidak terdeteksi"
            }\n\n` +
            `Apakah data sudah benar?\n\n` +
            `/konfirm - ✅ Ya, data benar\n` +
            `/ulangi - ❌ Upload ulang KTP`
        );
      }
    } catch (error) {
      this.logger.error("OCR processing failed:", error);
      await bot.sendMessage(
        telegramId,
        "❌ Terjadi kesalahan saat memproses KTP. Silakan coba lagi."
      );
    }
  }

  private async handleSignaturePhotoUpload(
    bot: TelegramBot,
    telegramId: number,
    fileId: string,
    session: UserSession,
    partnerId: number
  ): Promise<void> {
    await bot.sendMessage(
      telegramId,
      "✂️ Memproses tanda tangan (menghapus background)..."
    );

    try {
      const {buffer, mimeType, fileName} =
        await this.fileService.downloadOriginalFile(bot, fileId);

      const originalUpload = await this.fileService.uploadOriginalFile(
        buffer,
        `signature_original_${Date.now()}.jpg`,
        mimeType
      );

      // Process signature with original buffer
      const signatureResult = await this.signatureService.processSignatureFile(
        buffer,
        fileName,
        mimeType
      );

      if (signatureResult.success && signatureResult.data) {
        const formData = {
          ...session.form_data,
          signature_photo: signatureResult.data.processed_image_url,
          signature_original: originalUpload.fileUrl, // Store original for reference
        };

        const nextStep = await this.sessionService.getNextStep(formData);

        await this.sessionService.createOrUpdateSession({
          ...session,
          form_data: formData,
          current_step: nextStep,
        });

        await bot.sendPhoto(
          telegramId,
          signatureResult.data.processed_image_url,
          {
            caption:
              `✅ Tanda tangan berhasil diproses!\n\n` +
              `📐 Ukuran: ${signatureResult.data.width}x${signatureResult.data.height}px\n` +
              `Background telah dihapus dan siap digunakan.\n\n` +
              `Apakah hasil sudah sesuai?\n\n` +
              `/konfirm - ✅ Ya, gunakan tanda tangan ini\n` +
              `/ulangi - ❌ Upload ulang tanda tangan`,
          }
        );
      } else {
        await bot.sendMessage(
          telegramId,
          `❌ ${signatureResult.message}\n\nSilakan coba lagi dengan foto yang lebih jelas.`
        );
      }
    } catch (error) {
      this.logger.error("Signature processing failed:", error);
      await bot.sendMessage(
        telegramId,
        "❌ Terjadi kesalahan saat memproses tanda tangan. Silakan coba lagi."
      );
    }
  }

  private async handleRegularPhotoUpload(
    bot: TelegramBot,
    telegramId: number,
    uploadResult: {fileUrl: string; fileName: string; fileSize: number},
    session: UserSession,
    partnerId: number
  ): Promise<void> {
    const formData: any = {...session.form_data};

    if (session.current_step === SessionStep.LOCATION_PHOTOS) {
      formData.location_photos = formData.location_photos || [];
      formData.location_photos.push(uploadResult.fileUrl);

      await this.sessionService.createOrUpdateSession({
        ...session,
        form_data: formData,
      });

      // Check if user wants to add more photos (max 4)
      if (formData.location_photos.length < 4) {
        await bot.sendMessage(
          telegramId,
          `✅ Foto lokasi ${formData.location_photos.length} berhasil diupload!\n\n` +
            `Kirim foto lokasi lainnya atau ketik "Lanjut" jika sudah selesai.\n` +
            `(Maksimal 4 foto, saat ini: ${formData.location_photos.length}/4)`
        );
        return;
      } else {
        // Auto proceed if 4 photos
        await this.handleLocationPhotosComplete(
          bot,
          telegramId,
          session,
          partnerId
        );
      }
    } else {
      formData[session.current_step] = uploadResult.fileUrl;

      const nextStep = await this.sessionService.getNextStep(formData);

      await this.sessionService.createOrUpdateSession({
        ...session,
        form_data: formData,
        current_step: nextStep,
      });

      await bot.sendMessage(
        telegramId,
        `✅ Foto berhasil diupload!\nUkuran: ${(
          uploadResult.fileSize / 1024
        ).toFixed(1)} KB`
      );

      await this.sendNextStepMessage(bot, telegramId, nextStep);
    }
  }

  private async handlePhotoUpload(
    bot: TelegramBot,
    msg: TelegramBot.Message,
    session: UserSession,
    partnerId: number
  ): Promise<void> {
    if (!msg.photo) {
      await bot.sendMessage(msg.from!.id, "❌ Harap kirim foto, bukan teks.");
      return;
    }

    const telegramId = msg.from!.id;

    try {
      // Ambil compressed photo
      const photoId = this.fileService.getCompressedPhotoFileId(msg.photo);

      await bot.sendMessage(telegramId, "📤 Mengupload foto...");

      const uploadResult = await this.fileService.downloadAndUploadPhoto(
        bot,
        photoId,
        telegramId,
        session.current_step
      );

      // Handle specific photo types - FLOW BARU
      if (session.current_step === SessionStep.ID_CARD_PHOTO) {
        const originalPhoto = msg.photo[msg.photo.length - 1];
        await this.handleKTPPhotoUpload(
          bot,
          telegramId,
          originalPhoto.file_id,
          session
        );
      } else if (session.current_step === SessionStep.SIGNATURE_PHOTO) {
        const originalPhoto = msg.photo[msg.photo.length - 1];

        await this.handleSignaturePhotoUpload(
          bot,
          telegramId,
          originalPhoto.file_id,
          session,
          partnerId
        );
      } else {
        await this.handleRegularPhotoUpload(
          bot,
          telegramId,
          uploadResult,
          session,
          partnerId
        );
      }
    } catch (error) {
      this.logger.error("Error uploading photo:", error);
      await bot.sendMessage(
        telegramId,
        "❌ Gagal mengupload foto. Silakan coba lagi."
      );
    }
  }

  private async getNextStepAfterPhoto(
    currentStep: string
  ): Promise<SessionStep | null> {
    switch (currentStep) {
      case SessionStep.BANK_BOOK_PHOTO:
        return SessionStep.ID_CARD_PHOTO;
      case SessionStep.ID_CARD_PHOTO:
        return SessionStep.TERMS_CONDITIONS;
      default:
        return null;
    }
  }

  private async proceedToNextStep(
    bot: TelegramBot,
    telegramId: number,
    session: any,
    nextStep: SessionStep,
    partnerId: number
  ): Promise<void> {
    await this.sessionService.createOrUpdateSession({
      partner_id: partnerId,
      telegram_id: telegramId,
      current_step: nextStep,
      form_data: session.form_data,
    });

    if (nextStep === SessionStep.TERMS_CONDITIONS) {
      await bot.sendMessage(
        telegramId,
        this.messages.generateTermsConditionsMessage()
      );
    } else if (nextStep === SessionStep.CONFIRMATION) {
      await bot.sendMessage(
        telegramId,
        this.messages.generateConfirmationMessage(session.form_data)
      );
    } else {
      await bot.sendMessage(
        telegramId,
        this.messages.generateContinueRegistrationMessage(nextStep)
      );
    }
  }

  // Welcome Messages
  private async sendWelcomeMessage(
    bot: TelegramBot,
    telegramId: number
  ): Promise<void> {
    await bot.sendMessage(telegramId, this.messages.generateWelcomeMessage());
  }

  private async sendRegisteredWelcomeMessage(
    bot: TelegramBot,
    telegramId: number,
    user: KYCApplication
  ): Promise<void> {
    await bot.sendMessage(
      telegramId,
      this.messages.generateWelcomeMessageRegistered(user.status)
    );
  }

  private async sendHelpMessage(
    bot: TelegramBot,
    telegramId: number
  ): Promise<void> {
    await bot.sendMessage(telegramId, this.messages.generateHelpMessage());
  }

  // Menu Handlers
  private async handleMenuToMain(
    bot: TelegramBot,
    telegramId: number,
    msg: TelegramBot.Message,
    partnerId: number
  ): Promise<void> {
    const existingSession = await this.sessionService.getActiveSession(
      partnerId,
      telegramId
    );

    await this.sessionService.createOrUpdateSession({
      partner_id: partnerId,
      telegram_id: telegramId,
      username: msg.from!.username,
      first_name: msg.from!.first_name,
      last_name: msg.from!.last_name,
      current_step: SessionStep.MENU,
      form_data: existingSession?.form_data || {},
    });
    await this.sendWelcomeMessage(bot, telegramId);
  }

  private async handleMenuSelection(
    bot: TelegramBot,
    telegramId: number,
    text: string,
    msg: TelegramBot.Message,
    partnerId: number
  ): Promise<void> {
    switch (text) {
      case "Daftar KYC":
        const existingSession = await this.sessionService.getActiveSession(
          partnerId,
          telegramId
        );

        await this.sessionService.createOrUpdateSession({
          partner_id: partnerId,
          telegram_id: telegramId,
          username: msg.from!.username,
          first_name: msg.from!.first_name,
          last_name: msg.from!.last_name,
          current_step: SessionStep.REGISTRATION_START,
          form_data: existingSession?.form_data || {},
        });

        await bot.sendMessage(
          telegramId,
          this.messages.generateRegistrationOptionsMessage(),
          this.messages.generateRegistrationKeyboard()
        );
        break;
      case "Menu Utama":
      case "Kembali ke Menu Utama":
        await this.handleMenuToMain(bot, telegramId, msg, partnerId);
        break;
      default:
        await this.handleUnknownMessage(bot, telegramId, partnerId);
    }
  }

  private async handleRegistrationOption(
    bot: TelegramBot,
    telegramId: number,
    text: string,
    msg: TelegramBot.Message,
    partnerId: number
  ): Promise<void> {
    switch (text) {
      case "Mulai Pendaftaran Baru":
        await this.sessionService.createOrUpdateSession({
          partner_id: partnerId,
          telegram_id: telegramId,
          username: msg.from!.username,
          first_name: msg.from!.first_name,
          last_name: msg.from!.last_name,
          current_step: SessionStep.ID_CARD_PHOTO,
          form_data: {},
        });

        if (process.env.KTP_EXAMPLE_URL) {
          await bot.sendPhoto(telegramId, process.env.KTP_EXAMPLE_URL, {
            caption: "📋 Contoh foto KTP yang baik:",
          });
        }

        await bot.sendMessage(
          telegramId,
          this.messages.generateStepMessage(SessionStep.ID_CARD_PHOTO)
        );
        break;
      case "Lanjutkan Sesi Pendaftaran":
        await this.continueRegistration(bot, telegramId, partnerId);
        break;
      case "Kembali ke Menu Utama":
        await this.handleMenuToMain(bot, telegramId, msg, partnerId);
        break;
      default:
        await this.handleUnknownMessage(bot, telegramId, partnerId);
    }
  }

  private async startRegistration(
    bot: TelegramBot,
    telegramId: number,
    partnerId: number
  ): Promise<void> {
    await this.sessionService.createOrUpdateSession({
      partner_id: partnerId,
      telegram_id: telegramId,
      current_step: SessionStep.ID_CARD_PHOTO,
      form_data: {},
    });

    if (process.env.KTP_EXAMPLE_URL) {
      await bot.sendPhoto(telegramId, process.env.KTP_EXAMPLE_URL, {
        caption: "📋 Contoh foto KTP yang baik:",
      });
    }

    await bot.sendMessage(
      telegramId,
      this.messages.generateStartRegistrationMessage()
    );
  }

  private async continueRegistration(
    bot: TelegramBot,
    telegramId: number,
    partnerId: number
  ): Promise<void> {
    const session = await this.sessionService.getActiveSession(
      partnerId,
      telegramId
    );

    if (!session || !session.form_data) {
      await this.startRegistration(bot, telegramId, partnerId);
      return;
    }

    const nextStep = await this.sessionService.getNextStep(session.form_data);

    await this.sessionService.createOrUpdateSession({
      partner_id: partnerId,
      telegram_id: telegramId,
      current_step: nextStep,
      form_data: session.form_data,
    });

    if (nextStep === SessionStep.CONFIRMATION) {
      await bot.sendMessage(
        telegramId,
        this.messages.generateConfirmationMessage(session.form_data)
      );
    } else {
      await bot.sendMessage(
        telegramId,
        this.messages.generateContinueRegistrationMessage(nextStep)
      );
    }
  }

  // Input Handlers
  private async handleAgentNameInput(
    bot: TelegramBot,
    telegramId: number,
    text: string,
    session: UserSession,
    partnerId: number
  ): Promise<void> {
    if (!text || text.length < 3) {
      await bot.sendMessage(
        telegramId,
        this.messages.generateFieldValidationError("agent_name")
      );
      return;
    }

    const formData = {...session.form_data, agent_name: text};
    const nextStep = await this.sessionService.getNextStep(formData);

    await this.sessionService.createOrUpdateSession({
      ...session,
      form_data: formData,
      current_step: nextStep,
    });

    await bot.sendMessage(
      telegramId,
      this.messages.generateFieldSuccessMessage("agent_name", text, nextStep)
    );

    await this.sendNextStepMessage(bot, telegramId, nextStep);
  }

  private async handleOwnerNameInput(
    bot: TelegramBot,
    telegramId: number,
    text: string,
    session: UserSession
  ): Promise<void> {
    if (!text || text.length < 3) {
      await bot.sendMessage(
        telegramId,
        this.messages.generateFieldValidationError("owner_name")
      );
      return;
    }

    const formData = {...session.form_data, owner_name: text};
    const nextStep = await this.sessionService.getNextStep(formData);

    await this.sessionService.createOrUpdateSession({
      ...session,
      form_data: formData,
      current_step: nextStep,
    });

    await bot.sendMessage(
      telegramId,
      this.messages.generateFieldSuccessMessage("owner_name", text, nextStep)
    );

    await this.sendNextStepMessage(bot, telegramId, nextStep);
  }

  private async handleBusinessFieldInput(
    bot: TelegramBot,
    telegramId: number,
    text: string,
    session: UserSession
  ): Promise<void> {
    if (!text.startsWith("/")) {
      const businessFieldMessage =
        await this.messages.generateBusinessFieldSelectionMessage();
      await bot.sendMessage(telegramId, businessFieldMessage);
      return;
    }

    const businessField = text.substring(1);
    const isValid = await this.businessFieldService.isValidBusinessField(
      businessField
    );

    if (!isValid) {
      await bot.sendMessage(
        telegramId,
        "❌ Bidang usaha tidak ditemukan. Silakan pilih dari daftar yang tersedia."
      );
      const businessFieldMessage =
        await this.messages.generateBusinessFieldSelectionMessage();
      await bot.sendMessage(telegramId, businessFieldMessage);
      return;
    }

    const formData = {...session.form_data, business_field: businessField};
    const nextStep = await this.sessionService.getNextStep(formData);

    await this.sessionService.createOrUpdateSession({
      ...session,
      form_data: formData,
      current_step: nextStep,
    });

    await bot.sendMessage(
      telegramId,
      this.messages.generateFieldSuccessMessage(
        "business_field",
        businessField,
        nextStep
      )
    );

    await this.sendNextStepMessage(bot, telegramId, nextStep);
  }

  private async handlePICNameInput(
    bot: TelegramBot,
    telegramId: number,
    text: string,
    session: UserSession
  ): Promise<void> {
    if (!text || text.length < 3) {
      await bot.sendMessage(
        telegramId,
        this.messages.generateFieldValidationError("pic_name")
      );
      return;
    }

    const formData = {...session.form_data, pic_name: text};
    const nextStep = await this.sessionService.getNextStep(formData);

    await this.sessionService.createOrUpdateSession({
      ...session,
      form_data: formData,
      current_step: nextStep,
    });

    await bot.sendMessage(
      telegramId,
      this.messages.generateFieldSuccessMessage("pic_name", text, nextStep)
    );

    await this.sendNextStepMessage(bot, telegramId, nextStep);
  }

  private async handlePICPhoneInput(
    bot: TelegramBot,
    telegramId: number,
    text: string,
    session: UserSession
  ): Promise<void> {
    const phoneRegex = /^(\+62|62|0)8[1-9][0-9]{6,9}$/;
    if (!phoneRegex.test(text)) {
      await bot.sendMessage(
        telegramId,
        this.messages.generateFieldValidationError("pic_phone")
      );
      return;
    }

    const formData = {...session.form_data, pic_phone: text};
    const nextStep = await this.sessionService.getNextStep(formData);

    await this.sessionService.createOrUpdateSession({
      ...session,
      form_data: formData,
      current_step: nextStep,
    });

    await bot.sendMessage(
      telegramId,
      this.messages.generateFieldSuccessMessage("pic_phone", text, nextStep)
    );

    await this.sendNextStepMessage(bot, telegramId, nextStep);
  }

  private async handleTaxNumberInput(
    bot: TelegramBot,
    telegramId: number,
    text: string,
    session: UserSession
  ): Promise<void> {
    if (text && text.length > 0) {
      const taxRegex = /^[0-9]{15}$/;
      if (!taxRegex.test(text)) {
        await bot.sendMessage(
          telegramId,
          this.messages.generateFieldValidationError("tax_number")
        );
        return;
      }
    }

    const formData = {...session.form_data, tax_number: text || ""};
    const nextStep = await this.sessionService.getNextStep(formData);

    await this.sessionService.createOrUpdateSession({
      ...session,
      form_data: formData,
      current_step: nextStep,
    });

    const displayValue = text || "Tidak diisi";
    await bot.sendMessage(
      telegramId,
      this.messages.generateFieldSuccessMessage(
        "tax_number",
        displayValue,
        nextStep
      )
    );

    await this.sendNextStepMessage(bot, telegramId, nextStep);
  }

  private async handleAccountHolderNameInput(
    bot: TelegramBot,
    telegramId: number,
    text: string,
    session: UserSession,
    partnerId: number
  ): Promise<void> {
    if (!text || text.length < 3) {
      await bot.sendMessage(
        telegramId,
        this.messages.generateFieldValidationError("account_holder_name")
      );
      return;
    }

    const formData = {...session.form_data, account_holder_name: text};
    const nextStep = await this.sessionService.getNextStep(formData);

    await this.sessionService.createOrUpdateSession({
      ...session,
      form_data: formData,
      current_step: nextStep,
    });

    await bot.sendMessage(
      telegramId,
      this.messages.generateFieldSuccessMessage(
        "account_holder_name",
        text,
        nextStep
      )
    );

    // Show bank selection untuk nextStep
    if (nextStep === SessionStep.BANK_NAME) {
      const bankMessage = await this.messages.generateBankSelectionMessage();
      await bot.sendMessage(telegramId, bankMessage);
    } else {
      await this.sendNextStepMessage(bot, telegramId, nextStep);
    }
  }

  private async handleAccountNumberInput(
    bot: TelegramBot,
    telegramId: number,
    text: string,
    session: UserSession
  ): Promise<void> {
    console.log(123123);
    if (!text || text.length < 8 || text.length > 20) {
      await bot.sendMessage(
        telegramId,
        this.messages.generateFieldValidationError("account_number")
      );
      return;
    }

    const formData = {...session.form_data, account_number: text};
    const nextStep = await this.sessionService.getNextStep(formData);

    await this.sessionService.createOrUpdateSession({
      ...session,
      form_data: formData,
      current_step: nextStep,
    });

    await bot.sendMessage(
      telegramId,
      this.messages.generateFieldSuccessMessage(
        "account_number",
        text,
        nextStep
      )
    );

    await this.sendNextStepMessage(bot, telegramId, nextStep);
  }

  private async handleSkipCommand(
    bot: TelegramBot,
    telegramId: number,
    partnerId: number
  ): Promise<void> {
    const session = await this.sessionService.getActiveSession(
      partnerId,
      telegramId
    );

    if (!session) {
      await bot.sendMessage(
        telegramId,
        this.messages.generateNoActiveSessionMessage()
      );
      return;
    }

    if (session.current_step === SessionStep.TAX_NUMBER) {
      const formData = {...session.form_data, tax_number: ""};
      const nextStep = await this.sessionService.getNextStep(formData);

      await this.sessionService.createOrUpdateSession({
        ...session,
        form_data: formData,
        current_step: nextStep,
      });

      await bot.sendMessage(
        telegramId,
        this.messages.generateSkipMessage("tax_number")
      );

      await this.sendNextStepMessage(bot, telegramId, nextStep);
    } else {
      await bot.sendMessage(
        telegramId,
        "Command /skip hanya bisa digunakan pada field opsional (NPWP)."
      );
    }
  }

  private async handleConfirmation(
    bot: TelegramBot,
    telegramId: number,
    text: string,
    session: UserSession,
    msg: TelegramBot.Message,
    partnerId: number
  ): Promise<void> {
    switch (text) {
      case "Ya, Daftarkan":
        await this.processRegistration(bot, telegramId, session);
        break;

      case "Tidak, Ulangi Pendaftaran":
        await this.sessionService.createOrUpdateSession({
          ...session,
          current_step: SessionStep.ID_CARD_PHOTO, // Flow baru dimulai dari KTP
          form_data: {},
        });

        await bot.sendMessage(
          telegramId,
          this.messages.generateStartRegistrationMessage()
        );
        break;

      case "Kembali ke Menu Utama":
        await this.handleMenuToMain(bot, telegramId, msg, partnerId);
        break;

      default:
        await this.handleUnknownMessage(bot, telegramId, partnerId);
    }
  }

  private async handleConfirmationCommand(
    bot: TelegramBot,
    telegramId: number,
    action: string,
    partnerId: number
  ): Promise<void> {
    const session = await this.sessionService.getActiveSession(
      partnerId,
      telegramId
    );
    if (
      !session ||
      (session.current_step !== SessionStep.CONFIRMATION &&
        session.current_step !== SessionStep.TERMS_CONDITIONS)
    ) {
      await bot.sendMessage(
        telegramId,
        this.messages.generateNoActiveSessionMessage()
      );
      return;
    }

    const mockMsg = {
      from: {
        id: telegramId,
        username: session.username,
        first_name: session.first_name,
        last_name: session.last_name,
      },
    } as TelegramBot.Message;

    // Handle terms acceptance
    if (session.current_step === SessionStep.TERMS_CONDITIONS) {
      await this.handleTermsConditions(
        bot,
        telegramId,
        action,
        session,
        mockMsg,
        partnerId
      );
      return;
    }

    // Handle confirmation
    await this.handleConfirmation(
      bot,
      telegramId,
      action,
      session,
      mockMsg,
      partnerId
    );
  }

  private async processRegistration(
    bot: TelegramBot,
    telegramId: number,
    session: UserSession
  ): Promise<void> {
    try {
      // Validate minimum requirements
      if (
        !session.form_data.location_photos ||
        session.form_data.location_photos.length === 0
      ) {
        await bot.sendMessage(
          telegramId,
          this.messages.generateLocationPhotosMinError()
        );
        return;
      }

      // Validate required OCR data
      if (!session.form_data.full_name || !session.form_data.id_card_number) {
        await bot.sendMessage(
          telegramId,
          "❌ Data KTP tidak lengkap. Silakan upload ulang foto KTP."
        );
        return;
      }

      await this.sessionService.completeRegistration(session);

      await bot.sendMessage(
        telegramId,
        this.messages.generateRegistrationSuccessMessage(session.form_data)
      );
    } catch (error) {
      console.log(error);
      this.logger.error("Error processing registration:", {telegramId, error});
      await bot.sendMessage(
        telegramId,
        this.messages.generateRegistrationErrorMessage()
      );
    }
  }

  // View Data
  private async handleViewCommand(
    bot: TelegramBot,
    telegramId: number,
    application: KYCApplication | null
  ): Promise<void> {
    if (!application) {
      await bot.sendMessage(
        telegramId,
        "Anda belum pernah mendaftar KYC. Gunakan /daftar untuk mendaftar."
      );
      return;
    }

    try {
      const photos = await this.sessionService.getApplicationPhotos(
        application.id!
      );

      let message = this.messages.generateViewDataMessage(application, photos);

      if (application.status === "rejected") {
        message += `\n\n❌ STATUS DITOLAK`;
        message += `\n📝 Alasan: ${application.remark}`;
        message += `\n\n💡 Anda dapat mendaftar ulang dengan /daftar`;
      }

      await bot.sendMessage(telegramId, message);
    } catch (error) {
      this.logger.error("Error viewing data:", {telegramId, error});
      await bot.sendMessage(
        telegramId,
        this.messages.generateSystemErrorMessage()
      );
    }
  }

  // Error Handlers
  private async handleUnknownMessage(
    bot: TelegramBot,
    telegramId: number,
    partnerId: number
  ): Promise<void> {
    const registrationCheck = await this.sessionService.canUserRegister(
      partnerId,
      telegramId
    );

    if (!registrationCheck.canRegister) {
      const registeredUser = await this.sessionService.getKYCApplication(
        partnerId,
        telegramId
      );
      await this.sendRegisteredWelcomeMessage(bot, telegramId, registeredUser!);
    } else if (registrationCheck.reason === "previous_rejected") {
      await bot.sendMessage(
        telegramId,
        this.messages.generateWelcomeMessageRejected(registrationCheck.remark!)
      );
    } else {
      await bot.sendMessage(telegramId, this.messages.generateUnknownMessage());
    }
  }

  private async handleTermsConditions(
    bot: TelegramBot,
    telegramId: number,
    text: string,
    session: UserSession,
    msg: TelegramBot.Message,
    partnerId: number
  ): Promise<void> {
    switch (text) {
      case "Setuju":
      case "/setuju":
        const formData = {...session.form_data, terms_accepted: true};
        const nextStep = await this.sessionService.getNextStep(formData);

        await this.sessionService.createOrUpdateSession({
          ...session,
          form_data: formData,
          current_step: nextStep,
        });

        await bot.sendMessage(
          telegramId,
          this.messages.generateConfirmationMessage(formData)
        );
        break;

      case "Tidak Setuju":
      case "/tidaksetuju":
        await this.sessionService.createOrUpdateSession({
          ...session,
          current_step: SessionStep.MENU,
          form_data: {},
        });

        await bot.sendMessage(
          telegramId,
          "❌ Pendaftaran dibatalkan karena tidak menyetujui syarat dan ketentuan.\n\nAnda dapat memulai pendaftaran baru kapan saja dengan /daftar"
        );
        break;

      case "Kembali ke Menu Utama":
        await this.handleMenuToMain(bot, telegramId, msg, partnerId);
        break;

      default:
        await bot.sendMessage(
          telegramId,
          "❌ Pilihan tidak valid. Gunakan /setuju atau /tidaksetuju"
        );
    }
  }

  private async handleBusinessFieldSelection(
    bot: TelegramBot,
    telegramId: number,
    businessFieldCommand: string,
    partnerId: number
  ): Promise<void> {
    const session = await this.sessionService.getActiveSession(
      partnerId,
      telegramId
    );

    if (!session || session.current_step !== SessionStep.BUSINESS_FIELD) {
      await this.handleUnknownMessage(bot, telegramId, partnerId);
      return;
    }

    const businessField =
      await this.businessFieldService.getBusinessFieldByCommand(
        businessFieldCommand
      );

    if (!businessField) {
      await bot.sendMessage(
        telegramId,
        `Bidang usaha "/${businessFieldCommand}" tidak tersedia. Silakan pilih dari daftar yang tersedia.`
      );
      const businessFieldMessage =
        await this.messages.generateBusinessFieldSelectionMessage();
      await bot.sendMessage(telegramId, businessFieldMessage);
      return;
    }

    const formData = {...session.form_data, business_field: businessField};
    const nextStep = await this.sessionService.getNextStep(formData);

    await this.sessionService.createOrUpdateSession({
      ...session,
      form_data: formData,
      current_step: nextStep,
    });

    await bot.sendMessage(
      telegramId,
      this.messages.generateFieldSuccessMessage(
        "business_field",
        businessField,
        nextStep
      )
    );

    await this.sendNextStepMessage(bot, telegramId, nextStep);
  }

  private async handleEmeteraiConsent(
    bot: TelegramBot,
    telegramId: number,
    consent: boolean,
    application: KYCApplication
  ): Promise<void> {
    try {
      await this.sessionService.updateEmeteraiConsent(application.id!, consent);
      console.log({consent});

      if (consent) {
        await bot.sendMessage(
          telegramId,
          "⏳ Memulai proses pembubuhan e-meterai..."
        );

        // Trigger e-meterai stamping
        const emeteraiService =
          new (require("../services/EMateraiService").EmeteraiService)();
        await emeteraiService.processStamping(
          application.id!,
          application.confirmed_by_name!,
          application.partner_id
        );

        // Send success notification with stamped PDF
        const updatedApplication =
          await this.sessionService.getKYCApplicationById(application.id!);
        const message = this.messages.generateEmeteraiSuccessMessage(
          updatedApplication!.stamped_pdf_url!
        );
        await bot.sendMessage(telegramId, message);
      } else {
        await bot.sendMessage(
          telegramId,
          "✅ Dokumen KYC Anda tetap valid tanpa e-meterai. Proses KYC telah selesai.\n\nTerima kasih! 🙏"
        );
      }
    } catch (error) {
      console.log(error);
      this.logger.error("Error handling e-meterai consent:", {
        telegramId,
        consent,
        error,
      });
      await bot.sendMessage(
        telegramId,
        "❌ Terjadi kesalahan dalam proses e-meterai. Silakan hubungi admin."
      );
    }
  }

  private async handleProvinceSelection(
    bot: TelegramBot,
    telegramId: number,
    provinceCode: string,
    partnerId: number
  ): Promise<void> {
    const session = await this.sessionService.getActiveSession(
      partnerId,
      telegramId
    );

    if (!session || session.current_step !== SessionStep.PROVINCE_SELECTION) {
      await this.handleUnknownMessage(bot, telegramId, partnerId);
      return;
    }

    const province = await this.provinceService.getProvinceByCode(provinceCode);

    if (!province) {
      await bot.sendMessage(
        telegramId,
        `❌ Provinsi dengan kode "${provinceCode}" tidak ditemukan. Silakan pilih dari daftar yang tersedia.`
      );
      const provinceMessage =
        await this.messages.generateProvinceSelectionMessage();
      await bot.sendMessage(telegramId, provinceMessage);
      return;
    }

    const formData = {
      ...session.form_data,
      province_code: province.code,
      province_name: province.name,
    };

    const nextStep = await this.sessionService.getNextStep(formData);

    await this.sessionService.createOrUpdateSession({
      ...session,
      form_data: formData,
      current_step: nextStep,
    });

    await bot.sendMessage(
      telegramId,
      this.messages.generateFieldSuccessMessage(
        "province_selection",
        province.name,
        nextStep
      )
    );

    if (nextStep === SessionStep.CITY_SELECTION) {
      const cityMessage = await this.messages.generateCitySelectionMessage(
        province.code
      );
      await bot.sendMessage(telegramId, cityMessage);
    } else {
      await this.sendNextStepMessage(bot, telegramId, nextStep);
    }
  }

  private async handleCitySelection(
    bot: TelegramBot,
    telegramId: number,
    cityCode: string,
    partnerId: number
  ): Promise<void> {
    const session = await this.sessionService.getActiveSession(
      partnerId,
      telegramId
    );

    if (!session || session.current_step !== SessionStep.CITY_SELECTION) {
      await this.handleUnknownMessage(bot, telegramId, partnerId);
      return;
    }

    const city = await this.provinceService.getCityByCode(cityCode);

    if (!city) {
      await bot.sendMessage(
        telegramId,
        `❌ Kab/Kota dengan kode "${cityCode}" tidak ditemukan. Silakan pilih dari daftar yang tersedia.`
      );
      const cityMessage = await this.messages.generateCitySelectionMessage(
        session.form_data.province_code!
      );
      await bot.sendMessage(telegramId, cityMessage);
      return;
    }

    const formData = {
      ...session.form_data,
      city_code: city.code,
      city_name: city.name,
    };

    const nextStep = await this.sessionService.getNextStep(formData);

    await this.sessionService.createOrUpdateSession({
      ...session,
      form_data: formData,
      current_step: nextStep,
    });

    await bot.sendMessage(
      telegramId,
      this.messages.generateFieldSuccessMessage(
        "city_selection",
        city.name,
        nextStep
      )
    );

    await this.sendNextStepMessage(bot, telegramId, nextStep);
  }

  private async handleProvinceInput(
    bot: TelegramBot,
    telegramId: number,
    text: string,
    session: any,
    partnerId: number
  ): Promise<void> {
    if (!text.startsWith("/")) {
      const provinceMessage =
        await this.messages.generateProvinceSelectionMessage();
      await bot.sendMessage(telegramId, provinceMessage);
      return;
    }

    await this.handleProvinceSelection(
      bot,
      telegramId,
      text.substring(1),
      partnerId
    );
  }

  private async handleCityInput(
    bot: TelegramBot,
    telegramId: number,
    text: string,
    session: any,
    parnerId: number
  ): Promise<void> {
    if (!text.startsWith("/")) {
      const cityMessage = await this.messages.generateCitySelectionMessage(
        session.form_data.province_code!
      );
      await bot.sendMessage(telegramId, cityMessage);
      return;
    }

    await this.handleCitySelection(
      bot,
      telegramId,
      text.substring(1),
      parnerId
    );
  }
}
