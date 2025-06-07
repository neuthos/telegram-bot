import TelegramBot from "node-telegram-bot-api";
import {SessionService} from "../services/SessionServices";
import {FileService} from "../services/FileService";
import {BankService} from "../services/BankService";
import {Logger} from "../config/logger";
import {MessageTemplates} from "../messages/MessagesTemplates";
import {SessionStep, KYCApplication} from "../types";

export class MessageHandler {
  private sessionService = new SessionService();
  private fileService = new FileService();
  private bankService = new BankService();
  private logger = Logger.getInstance();
  private messages = new MessageTemplates();

  public async handleMessage(
    bot: TelegramBot,
    msg: TelegramBot.Message
  ): Promise<void> {
    const telegramId = msg.from!.id;
    const text = msg.text?.trim();

    this.logger.info("Message received:", {
      telegramId,
      username: msg.from!.username,
      text: text || "[photo/file]",
      messageId: msg.message_id,
      hasPhoto: !!msg.photo,
      hasDocument: !!msg.document,
    });

    try {
      // Handle commands first
      if (text?.startsWith("/")) {
        await this.handleCommand(bot, telegramId, text, msg);
        return;
      }

      const registrationCheck = await this.sessionService.canUserRegister(
        telegramId
      );
      const session = await this.sessionService.getActiveSession(telegramId);

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

      // For users who can register (new users or rejected users)
      let activeSession = session;

      if (!activeSession) {
        activeSession = await this.sessionService.createOrUpdateSession({
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

      await this.processMessage(bot, msg, activeSession);
    } catch (error) {
      this.logger.error("Error handling message:", {telegramId, text, error});
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
    msg: TelegramBot.Message
  ): Promise<void> {
    this.logger.info("Command received:", {telegramId, command});

    const registrationCheck = await this.sessionService.canUserRegister(
      telegramId
    );
    const registeredUser = !registrationCheck.canRegister
      ? await this.sessionService.getKYCApplication(telegramId)
      : null;

    switch (command) {
      case "/start":
        if (registeredUser) {
          await this.sendRegisteredWelcomeMessage(
            bot,
            telegramId,
            registeredUser
          );
        } else {
          await this.sendWelcomeMessage(bot, telegramId);
        }
        break;
      case "/menu":
        if (!registrationCheck.canRegister) {
          await this.sendRegisteredWelcomeMessage(
            bot,
            telegramId,
            registeredUser!
          );
        } else {
          await this.handleMenuToMain(bot, telegramId, msg);
        }
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
          await this.handleMenuSelection(bot, telegramId, "Daftar KYC", msg);
        }
        break;
      case "/lihat":
        const anyApplication = await this.sessionService.getKYCApplication(
          telegramId
        );
        await this.handleViewCommand(bot, telegramId, anyApplication);
        break;
      case "/mulai":
        await this.handleRegistrationOption(
          bot,
          telegramId,
          "Mulai Pendaftaran Baru",
          msg
        );
        break;
      case "/lanjut":
        await this.handleRegistrationOption(
          bot,
          telegramId,
          "Lanjutkan Sesi Pendaftaran",
          msg
        );
        break;
      case "/setuju":
      case "/tidaksetuju":
        // Handle these based on current session step
        const session = await this.sessionService.getActiveSession(telegramId);
        if (!session) {
          await bot.sendMessage(
            telegramId,
            this.messages.generateNoActiveSessionMessage()
          );
          return;
        }

        if (session.current_step === SessionStep.TERMS_CONDITIONS) {
          const action = command === "/setuju" ? "Ya" : "Tidak";
          await this.handleTermsConditions(
            bot,
            telegramId,
            action,
            session,
            msg
          );
        } else {
          await this.handleUnknownMessage(bot, telegramId);
        }
        break;
      case "/ya":
      case "/tidak":
        const confirmSession = await this.sessionService.getActiveSession(
          telegramId
        );
        if (!confirmSession) {
          await bot.sendMessage(
            telegramId,
            this.messages.generateNoActiveSessionMessage()
          );
          return;
        }

        if (confirmSession.current_step === SessionStep.CONFIRMATION) {
          const action =
            command === "/ya" ? "Ya, Daftarkan" : "Tidak, Ulangi Pendaftaran";
          await this.handleConfirmation(
            bot,
            telegramId,
            action,
            confirmSession,
            msg
          );
        } else {
          await this.handleUnknownMessage(bot, telegramId);
        }
        break;
      case "/skip":
        await this.handleSkipCommand(bot, telegramId);
        break;
      case "/help":
        await this.sendHelpMessage(bot, telegramId);
        break;
      default:
        // Check if it's a bank command
        if (command.startsWith("/") && command.length > 1) {
          const session = await this.sessionService.getActiveSession(
            telegramId
          );
          if (session && session.current_step === SessionStep.BANK_NAME) {
            await this.handleBankSelection(
              bot,
              telegramId,
              command.substring(1)
            );
            return;
          }
        }
        await this.handleUnknownMessage(bot, telegramId);
    }
  }

  private async handleBankSelection(
    bot: TelegramBot,
    telegramId: number,
    bankCommand: string
  ): Promise<void> {
    const session = await this.sessionService.getActiveSession(telegramId);

    if (!session || session.current_step !== SessionStep.BANK_NAME) {
      await this.handleUnknownMessage(bot, telegramId);
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

    session.form_data.bank_name = bankName;
    await this.sessionService.createOrUpdateSession({
      telegram_id: telegramId,
      current_step: SessionStep.ACCOUNT_NUMBER,
      form_data: session.form_data,
    });

    await bot.sendMessage(
      telegramId,
      this.messages.generateFieldSuccessMessage(
        "bank_name",
        bankName,
        "account_number"
      )
    );
  }

  private async processMessage(
    bot: TelegramBot,
    msg: TelegramBot.Message,
    session: any
  ): Promise<void> {
    const telegramId = msg.from!.id;
    const text = msg.text?.trim();

    if (msg.photo && this.isPhotoStep(session.current_step)) {
      await this.handlePhotoUpload(bot, msg, session);
      return;
    }

    if (
      (text === "/ya" || text === "/tidak") &&
      session.current_step === SessionStep.CONFIRMATION
    ) {
      const action =
        text === "/ya" ? "Ya, Daftarkan" : "Tidak, Ulangi Pendaftaran";
      await this.handleConfirmation(bot, telegramId, action, session, msg);
      return;
    }
    switch (session.current_step) {
      case SessionStep.MENU:
        await this.handleMenuSelection(bot, telegramId, text!, msg);
        break;
      case SessionStep.REGISTRATION_START:
        await this.handleRegistrationOption(bot, telegramId, text!, msg);
        break;
      case SessionStep.AGENT_NAME:
        await this.handleAgentNameInput(bot, telegramId, text!, session);
        break;
      case SessionStep.AGENT_ADDRESS:
        await this.handleAgentAddressInput(bot, telegramId, text!, session);
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
      case SessionStep.ID_CARD_NUMBER:
        await this.handleIdCardNumberInput(bot, telegramId, text!, session);
        break;
      case SessionStep.TAX_NUMBER:
        await this.handleTaxNumberInput(bot, telegramId, text!, session);
        break;
      case SessionStep.ACCOUNT_HOLDER_NAME:
        await this.handleAccountHolderNameInput(
          bot,
          telegramId,
          text!,
          session
        );
        break;
      case SessionStep.BANK_NAME:
        await this.handleBankNameInput(bot, telegramId, text!, session);
        break;
      case SessionStep.ACCOUNT_NUMBER:
        await this.handleAccountNumberInput(bot, telegramId, text!, session);
        break;
      case SessionStep.SIGNATURE_INITIAL:
        await this.handleSignatureInitialInput(bot, telegramId, text!, session);
        break;
      case SessionStep.LOCATION_PHOTOS:
        if (text === "/lanjut") {
          await this.proceedToNextStep(
            bot,
            telegramId,
            session,
            SessionStep.BANK_BOOK_PHOTO
          );
        } else {
          await bot.sendMessage(
            telegramId,
            this.messages.generatePhotoValidationError("location_photos")
          );
        }
        break;
      case SessionStep.BANK_BOOK_PHOTO:
        await bot.sendMessage(
          telegramId,
          this.messages.generatePhotoValidationError("bank_book_photo")
        );
        break;
      case SessionStep.ID_CARD_PHOTO:
        await bot.sendMessage(
          telegramId,
          this.messages.generatePhotoValidationError("id_card_photo")
        );
        break;
      case SessionStep.TERMS_CONDITIONS:
        await this.handleTermsConditions(bot, telegramId, text!, session, msg);
        break;
      case SessionStep.CONFIRMATION:
        await this.handleConfirmation(bot, telegramId, text!, session, msg);
        break;
      default:
        await this.handleUnknownMessage(bot, telegramId);
    }
  }

  private async handleBankNameInput(
    bot: TelegramBot,
    telegramId: number,
    text: string,
    session: any
  ): Promise<void> {
    if (!text.startsWith("/")) {
      const bankMessage = await this.messages.generateBankSelectionMessage();
      await bot.sendMessage(telegramId, bankMessage);
      return;
    }

    const bankName = text.substring(1);
    const bankService = new BankService();

    const isValid = await bankService.isValidBank(bankName);
    if (!isValid) {
      await bot.sendMessage(
        telegramId,
        "❌ Bank tidak ditemukan. Silakan pilih dari daftar yang tersedia."
      );
      const bankMessage = await this.messages.generateBankSelectionMessage();
      await bot.sendMessage(telegramId, bankMessage);
      return;
    }

    session.form_data.bank_name = bankName;
    await this.sessionService.createOrUpdateSession({
      telegram_id: telegramId,
      current_step: SessionStep.ACCOUNT_NUMBER,
      form_data: session.form_data,
    });

    await bot.sendMessage(
      telegramId,
      this.messages.generateFieldSuccessMessage(
        "bank_name",
        bankName,
        "account_number"
      )
    );
  }

  private isPhotoStep(step: string): boolean {
    return [
      SessionStep.LOCATION_PHOTOS,
      SessionStep.BANK_BOOK_PHOTO,
      SessionStep.ID_CARD_PHOTO,
    ].includes(step as SessionStep);
  }

  private async handlePhotoUpload(
    bot: TelegramBot,
    msg: TelegramBot.Message,
    session: any
  ): Promise<void> {
    const telegramId = msg.from!.id;
    const photo = msg.photo![msg.photo!.length - 1];

    try {
      const photoType = session.current_step;
      const uploadResult = await this.fileService.downloadAndUploadPhoto(
        bot,
        photo.file_id,
        telegramId,
        photoType
      );

      switch (photoType) {
        case SessionStep.LOCATION_PHOTOS:
          if (!session.form_data.location_photos) {
            session.form_data.location_photos = [];
          }
          if (session.form_data.location_photos.length >= 4) {
            await bot.sendMessage(
              telegramId,
              this.messages.generateLocationPhotosLimitError()
            );
            return;
          }
          session.form_data.location_photos.push(uploadResult.fileUrl);
          break;
        case SessionStep.BANK_BOOK_PHOTO:
          session.form_data.bank_book_photo = uploadResult.fileUrl;
          break;
        case SessionStep.ID_CARD_PHOTO:
          session.form_data.id_card_photo = uploadResult.fileUrl;
          break;
      }

      await this.sessionService.createOrUpdateSession({
        telegram_id: telegramId,
        current_step: session.current_step,
        form_data: session.form_data,
      });

      if (photoType === SessionStep.LOCATION_PHOTOS) {
        const count = session.form_data.location_photos.length;
        await bot.sendMessage(
          telegramId,
          this.messages.generatePhotoSuccessMessage("location_photos", count)
        );

        if (count >= 4) {
          await this.proceedToNextStep(
            bot,
            telegramId,
            session,
            SessionStep.BANK_BOOK_PHOTO
          );
        }
      } else {
        await bot.sendMessage(
          telegramId,
          this.messages.generatePhotoSuccessMessage(photoType)
        );

        const nextStep = await this.getNextStepAfterPhoto(photoType);
        if (nextStep) {
          await this.proceedToNextStep(bot, telegramId, session, nextStep);
        }
      }
    } catch (error) {
      this.logger.error("Error handling photo upload:", {
        telegramId,
        photoType: session.current_step,
        error,
      });
      await bot.sendMessage(
        telegramId,
        "Gagal mengunggah foto. Silakan coba lagi."
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
    nextStep: SessionStep
  ): Promise<void> {
    await this.sessionService.createOrUpdateSession({
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
    msg: TelegramBot.Message
  ): Promise<void> {
    const existingSession = await this.sessionService.getActiveSession(
      telegramId
    );

    await this.sessionService.createOrUpdateSession({
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
    msg: TelegramBot.Message
  ): Promise<void> {
    switch (text) {
      case "Daftar KYC":
        const existingSession = await this.sessionService.getActiveSession(
          telegramId
        );

        await this.sessionService.createOrUpdateSession({
          telegram_id: telegramId,
          username: msg.from!.username,
          first_name: msg.from!.first_name,
          last_name: msg.from!.last_name,
          current_step: SessionStep.REGISTRATION_START,
          form_data: existingSession?.form_data || {},
        });

        await bot.sendMessage(
          telegramId,
          this.messages.generateRegistrationOptionsMessage()
        );
        break;
      case "Menu Utama":
      case "Kembali ke Menu Utama":
        await this.handleMenuToMain(bot, telegramId, msg);
        break;
      default:
        await this.handleUnknownMessage(bot, telegramId);
    }
  }

  // Registration Flow
  private async handleRegistrationOption(
    bot: TelegramBot,
    telegramId: number,
    text: string,
    msg: TelegramBot.Message
  ): Promise<void> {
    switch (text) {
      case "Mulai Pendaftaran Baru":
        await this.sessionService.createOrUpdateSession({
          telegram_id: telegramId,
          username: msg.from!.username,
          first_name: msg.from!.first_name,
          last_name: msg.from!.last_name,
          current_step: SessionStep.AGENT_NAME,
          form_data: {},
        });

        await bot.sendMessage(
          telegramId,
          this.messages.generateStartRegistrationMessage()
        );
        break;
      case "Lanjutkan Sesi Pendaftaran":
        await this.continueRegistration(bot, telegramId);
        break;
      case "Kembali ke Menu Utama":
        await this.handleMenuToMain(bot, telegramId, msg);
        break;
      default:
        await this.handleUnknownMessage(bot, telegramId);
    }
  }

  private async startRegistration(
    bot: TelegramBot,
    telegramId: number
  ): Promise<void> {
    await this.sessionService.createOrUpdateSession({
      telegram_id: telegramId,
      current_step: SessionStep.AGENT_NAME,
      form_data: {},
    });

    await bot.sendMessage(
      telegramId,
      this.messages.generateStartRegistrationMessage()
    );
  }

  private async continueRegistration(
    bot: TelegramBot,
    telegramId: number
  ): Promise<void> {
    const session = await this.sessionService.getActiveSession(telegramId);

    if (!session || !session.form_data) {
      await this.startRegistration(bot, telegramId);
      return;
    }

    const nextStep = await this.sessionService.getNextStep(session.form_data);

    await this.sessionService.createOrUpdateSession({
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
    session: any
  ): Promise<void> {
    if (!text || text.length < 3) {
      await bot.sendMessage(
        telegramId,
        this.messages.generateFieldValidationError("agent_name")
      );
      return;
    }

    session.form_data.agent_name = text;
    await this.sessionService.createOrUpdateSession({
      telegram_id: telegramId,
      current_step: SessionStep.AGENT_ADDRESS,
      form_data: session.form_data,
    });

    await bot.sendMessage(
      telegramId,
      this.messages.generateFieldSuccessMessage(
        "agent_name",
        text,
        "agent_address"
      )
    );
  }

  private async handleAgentAddressInput(
    bot: TelegramBot,
    telegramId: number,
    text: string,
    session: any
  ): Promise<void> {
    if (!text || text.length < 10) {
      await bot.sendMessage(
        telegramId,
        this.messages.generateFieldValidationError("agent_address")
      );
      return;
    }

    session.form_data.agent_address = text;
    await this.sessionService.createOrUpdateSession({
      telegram_id: telegramId,
      current_step: SessionStep.OWNER_NAME,
      form_data: session.form_data,
    });

    await bot.sendMessage(
      telegramId,
      this.messages.generateFieldSuccessMessage(
        "agent_address",
        text,
        "owner_name"
      )
    );
  }

  private async handleOwnerNameInput(
    bot: TelegramBot,
    telegramId: number,
    text: string,
    session: any
  ): Promise<void> {
    if (!text || text.length < 3) {
      await bot.sendMessage(
        telegramId,
        this.messages.generateFieldValidationError("owner_name")
      );
      return;
    }

    session.form_data.owner_name = text;
    await this.sessionService.createOrUpdateSession({
      telegram_id: telegramId,
      current_step: SessionStep.BUSINESS_FIELD,
      form_data: session.form_data,
    });

    await bot.sendMessage(
      telegramId,
      this.messages.generateFieldSuccessMessage(
        "owner_name",
        text,
        "business_field"
      )
    );
  }

  private async handleBusinessFieldInput(
    bot: TelegramBot,
    telegramId: number,
    text: string,
    session: any
  ): Promise<void> {
    if (!text || text.length < 3) {
      await bot.sendMessage(
        telegramId,
        this.messages.generateFieldValidationError("business_field")
      );
      return;
    }

    session.form_data.business_field = text;
    await this.sessionService.createOrUpdateSession({
      telegram_id: telegramId,
      current_step: SessionStep.PIC_NAME,
      form_data: session.form_data,
    });

    await bot.sendMessage(
      telegramId,
      this.messages.generateFieldSuccessMessage(
        "business_field",
        text,
        "pic_name"
      )
    );
  }

  private async handlePICNameInput(
    bot: TelegramBot,
    telegramId: number,
    text: string,
    session: any
  ): Promise<void> {
    if (!text || text.length < 3) {
      await bot.sendMessage(
        telegramId,
        this.messages.generateFieldValidationError("pic_name")
      );
      return;
    }

    session.form_data.pic_name = text;
    await this.sessionService.createOrUpdateSession({
      telegram_id: telegramId,
      current_step: SessionStep.PIC_PHONE,
      form_data: session.form_data,
    });

    await bot.sendMessage(
      telegramId,
      this.messages.generateFieldSuccessMessage("pic_name", text, "pic_phone")
    );
  }

  private async handlePICPhoneInput(
    bot: TelegramBot,
    telegramId: number,
    text: string,
    session: any
  ): Promise<void> {
    const phoneRegex = /^(\+62|62|0)8[1-9][0-9]{6,9}$/;
    if (!phoneRegex.test(text)) {
      await bot.sendMessage(
        telegramId,
        this.messages.generateFieldValidationError("pic_phone")
      );
      return;
    }

    session.form_data.pic_phone = text;
    await this.sessionService.createOrUpdateSession({
      telegram_id: telegramId,
      current_step: SessionStep.ID_CARD_NUMBER,
      form_data: session.form_data,
    });

    await bot.sendMessage(
      telegramId,
      this.messages.generateFieldSuccessMessage(
        "pic_phone",
        text,
        "id_card_number"
      )
    );
  }

  private async handleIdCardNumberInput(
    bot: TelegramBot,
    telegramId: number,
    text: string,
    session: any
  ): Promise<void> {
    const idCardRegex = /^[0-9]{16}$/;
    if (!idCardRegex.test(text)) {
      await bot.sendMessage(
        telegramId,
        this.messages.generateFieldValidationError("id_card_number")
      );
      return;
    }

    const isIdCardRegistered = await this.sessionService.isIdCardRegistered(
      text
    );
    if (isIdCardRegistered) {
      await bot.sendMessage(
        telegramId,
        this.messages.generateIdCardDuplicateError()
      );
      return;
    }

    session.form_data.id_card_number = text;
    await this.sessionService.createOrUpdateSession({
      telegram_id: telegramId,
      current_step: SessionStep.TAX_NUMBER,
      form_data: session.form_data,
    });

    await bot.sendMessage(
      telegramId,
      this.messages.generateFieldSuccessMessage(
        "id_card_number",
        text,
        "tax_number"
      )
    );
  }

  private async handleTaxNumberInput(
    bot: TelegramBot,
    telegramId: number,
    text: string,
    session: any
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

    session.form_data.tax_number = text || "";
    await this.sessionService.createOrUpdateSession({
      telegram_id: telegramId,
      current_step: SessionStep.ACCOUNT_HOLDER_NAME,
      form_data: session.form_data,
    });

    const displayValue = text || "Tidak diisi";
    await bot.sendMessage(
      telegramId,
      this.messages.generateFieldSuccessMessage(
        "tax_number",
        displayValue,
        "account_holder_name"
      )
    );
  }

  private async handleAccountHolderNameInput(
    bot: TelegramBot,
    telegramId: number,
    text: string,
    session: any
  ): Promise<void> {
    if (!text || text.length < 3) {
      await bot.sendMessage(
        telegramId,
        this.messages.generateFieldValidationError("account_holder_name")
      );
      return;
    }

    session.form_data.account_holder_name = text;
    await this.sessionService.createOrUpdateSession({
      telegram_id: telegramId,
      current_step: SessionStep.BANK_NAME,
      form_data: session.form_data,
    });

    await bot.sendMessage(
      telegramId,
      this.messages.generateFieldSuccessMessage(
        "account_holder_name",
        text,
        "bank_name"
      )
    );

    // Show bank selection menu
    const bankMessage = await this.messages.generateBankSelectionMessage();
    await bot.sendMessage(telegramId, bankMessage);
  }

  private async handleAccountNumberInput(
    bot: TelegramBot,
    telegramId: number,
    text: string,
    session: any
  ): Promise<void> {
    if (!text || text.length < 8 || text.length > 20) {
      await bot.sendMessage(
        telegramId,
        this.messages.generateFieldValidationError("account_number")
      );
      return;
    }

    session.form_data.account_number = text;
    await this.sessionService.createOrUpdateSession({
      telegram_id: telegramId,
      current_step: SessionStep.SIGNATURE_INITIAL,
      form_data: session.form_data,
    });

    await bot.sendMessage(
      telegramId,
      this.messages.generateFieldSuccessMessage(
        "account_number",
        text,
        "signature_initial"
      )
    );
  }

  private async handleSignatureInitialInput(
    bot: TelegramBot,
    telegramId: number,
    text: string,
    session: any
  ): Promise<void> {
    if (!text || text.length < 1 || text.length > 10) {
      await bot.sendMessage(
        telegramId,
        this.messages.generateFieldValidationError("signature_initial")
      );
      return;
    }

    session.form_data.signature_initial = text;
    await this.sessionService.createOrUpdateSession({
      telegram_id: telegramId,
      current_step: SessionStep.LOCATION_PHOTOS,
      form_data: session.form_data,
    });

    await bot.sendMessage(
      telegramId,
      this.messages.generateFieldSuccessMessage(
        "signature_initial",
        text,
        "location_photos"
      )
    );
  }

  private async handleSkipCommand(
    bot: TelegramBot,
    telegramId: number
  ): Promise<void> {
    const session = await this.sessionService.getActiveSession(telegramId);
    if (!session) {
      await bot.sendMessage(
        telegramId,
        this.messages.generateNoActiveSessionMessage()
      );
      return;
    }

    if (session.current_step === SessionStep.TAX_NUMBER) {
      session.form_data.tax_number = "";
      await this.sessionService.createOrUpdateSession({
        telegram_id: telegramId,
        current_step: SessionStep.ACCOUNT_HOLDER_NAME,
        form_data: session.form_data,
      });

      await bot.sendMessage(
        telegramId,
        this.messages.generateSkipMessage("tax_number")
      );
      await bot.sendMessage(
        telegramId,
        this.messages.generateContinueRegistrationMessage("account_holder_name")
      );
    } else {
      await bot.sendMessage(
        telegramId,
        "Command /skip hanya bisa digunakan pada field opsional (NPWP dan Foto Tanda Tangan)."
      );
    }
  }

  private async handleConfirmation(
    bot: TelegramBot,
    telegramId: number,
    text: string,
    session: any,
    msg: TelegramBot.Message
  ): Promise<void> {
    switch (text) {
      case "Ya, Daftarkan":
        await this.processRegistration(bot, telegramId, session);
        break;
      case "Tidak, Ulangi Pendaftaran":
        await this.sessionService.createOrUpdateSession({
          telegram_id: telegramId,
          username: msg.from!.username,
          first_name: msg.from!.first_name,
          last_name: msg.from!.last_name,
          current_step: SessionStep.AGENT_NAME,
          form_data: {}, // Reset form data
        });

        await bot.sendMessage(
          telegramId,
          this.messages.generateStartRegistrationMessage()
        );
        break;
      case "Kembali ke Menu Utama":
        await this.handleMenuToMain(bot, telegramId, msg);
        break;
      default:
        await this.handleUnknownMessage(bot, telegramId);
    }
  }

  private async handleConfirmationCommand(
    bot: TelegramBot,
    telegramId: number,
    action: string
  ): Promise<void> {
    const session = await this.sessionService.getActiveSession(telegramId);
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
        mockMsg
      );
      return;
    }

    // Handle confirmation
    await this.handleConfirmation(bot, telegramId, action, session, mockMsg);
  }

  private async processRegistration(
    bot: TelegramBot,
    telegramId: number,
    session: any
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

      await this.sessionService.completeRegistration(session);

      await bot.sendMessage(
        telegramId,
        this.messages.generateRegistrationSuccessMessage(session.form_data)
      );
    } catch (error) {
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
        message += `\n\n❌ **STATUS DITOLAK**`;
        message += `\n📝 **Alasan**: ${application.remark}`;
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
    telegramId: number
  ): Promise<void> {
    const registrationCheck = await this.sessionService.canUserRegister(
      telegramId
    );

    if (!registrationCheck.canRegister) {
      const registeredUser = await this.sessionService.getKYCApplication(
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
    session: any,
    msg: TelegramBot.Message
  ): Promise<void> {
    switch (text) {
      case "Ya":
      case "/setuju":
        session.form_data.terms_accepted = true;
        await this.sessionService.createOrUpdateSession({
          telegram_id: telegramId,
          current_step: SessionStep.CONFIRMATION,
          form_data: session.form_data,
        });

        await bot.sendMessage(
          telegramId,
          this.messages.generateConfirmationMessage(session.form_data)
        );
        break;

      case "Tidak":
      case "/tidaksetuju":
        await this.sessionService.createOrUpdateSession({
          telegram_id: telegramId,
          username: msg.from!.username,
          first_name: msg.from!.first_name,
          last_name: msg.from!.last_name,
          current_step: SessionStep.MENU,
          form_data: {},
        });

        await bot.sendMessage(
          telegramId,
          "❌ Pendaftaran dibatalkan karena tidak menyetujui syarat dan ketentuan.\n\nAnda dapat memulai pendaftaran baru kapan saja dengan /daftar"
        );
        break;

      case "Kembali ke Menu Utama":
        await this.handleMenuToMain(bot, telegramId, msg);
        break;

      default:
        await bot.sendMessage(
          telegramId,
          this.messages.generateTermsConditionsMessage()
        );
    }
  }
}
