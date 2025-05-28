import TelegramBot from "node-telegram-bot-api";
import {SessionService} from "../services/SessionServices";
import {Logger} from "../config/logger";
import {MessageTemplates} from "../messages/MessagesTemplates";
import {SessionStep, RegisteredUser} from "../types";

export class MessageHandler {
  private sessionService = new SessionService();
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
      text,
      messageId: msg.message_id,
    });

    try {
      // Handle commands first
      if (text?.startsWith("/")) {
        await this.handleCommand(bot, telegramId, text);
        return;
      }

      // Get registered user info and active session
      const registeredUser = await this.sessionService.getRegisteredUser(
        telegramId
      );
      const session = await this.sessionService.getActiveSession(telegramId);

      // If user is registered, block text input (no edit functionality)
      if (registeredUser) {
        await bot.sendMessage(
          telegramId,
          this.messages.generateAlreadyRegisteredMessage()
        );
        return;
      }

      // For unregistered users, handle normal registration flow
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

        await this.sendWelcomeMessage(bot, telegramId);
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
    command: string
  ): Promise<void> {
    this.logger.info("Command received:", {telegramId, command});

    // Check if user is registered
    const registeredUser = await this.sessionService.getRegisteredUser(
      telegramId
    );

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
        if (registeredUser) {
          await this.sendRegisteredWelcomeMessage(
            bot,
            telegramId,
            registeredUser
          );
        } else {
          await this.handleMenuToMain(bot, telegramId);
        }
        break;
      case "/daftar":
        if (registeredUser) {
          await bot.sendMessage(
            telegramId,
            this.messages.generateAlreadyRegisteredMessage()
          );
        } else {
          await this.handleMenuSelection(bot, telegramId, "Daftar Merchant");
        }
        break;
      case "/lihat":
        await this.handleViewCommand(bot, telegramId, registeredUser);
        break;
      case "/mulai":
        await this.handleRegistrationOption(
          bot,
          telegramId,
          "Mulai Pendaftaran Baru"
        );
        break;
      case "/lanjut":
        await this.handleRegistrationOption(
          bot,
          telegramId,
          "Lanjutkan Sesi Pendaftaran"
        );
        break;
      case "/ya":
        await this.handleConfirmationCommand(bot, telegramId, "Ya, Daftarkan");
        break;
      case "/tidak":
        await this.handleConfirmationCommand(
          bot,
          telegramId,
          "Tidak, Ulangi Pendaftaran"
        );
        break;
      case "/help":
        await this.sendHelpMessage(bot, telegramId);
        break;
      default:
        await this.handleUnknownMessage(bot, telegramId);
    }
  }

  private async processMessage(
    bot: TelegramBot,
    msg: TelegramBot.Message,
    session: any
  ): Promise<void> {
    const telegramId = msg.from!.id;
    const text = msg.text?.trim();

    switch (session.current_step) {
      case SessionStep.MENU:
        await this.handleMenuSelection(bot, telegramId, text!);
        break;
      case SessionStep.REGISTRATION_START:
        await this.handleRegistrationOption(bot, telegramId, text!);
        break;
      case SessionStep.NAMA:
        await this.handleNamaInput(bot, telegramId, text!, session);
        break;
      case SessionStep.NOMOR_TELEPON:
        await this.handleNomorTeleponInput(bot, telegramId, text!, session);
        break;
      case SessionStep.NOMOR_KTP:
        await this.handleNomorKtpInput(bot, telegramId, text!, session);
        break;
      case SessionStep.ALAMAT:
        await this.handleAlamatInput(bot, telegramId, text!, session);
        break;
      case SessionStep.CONFIRMATION:
        await this.handleConfirmation(bot, telegramId, text!, session);
        break;
      default:
        await this.handleUnknownMessage(bot, telegramId);
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
    user: RegisteredUser
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
    telegramId: number
  ): Promise<void> {
    const existingSession = await this.sessionService.getActiveSession(
      telegramId
    );

    await this.sessionService.createOrUpdateSession({
      telegram_id: telegramId,
      current_step: SessionStep.MENU,
      form_data: existingSession?.form_data || {},
    });

    await this.sendWelcomeMessage(bot, telegramId);
  }

  private async handleMenuSelection(
    bot: TelegramBot,
    telegramId: number,
    text: string
  ): Promise<void> {
    switch (text) {
      case "/daftar - 📝 Daftar Merchant":
      case "Daftar Merchant":
        const existingSession = await this.sessionService.getActiveSession(
          telegramId
        );

        await this.sessionService.createOrUpdateSession({
          telegram_id: telegramId,
          current_step: SessionStep.REGISTRATION_START,
          form_data: existingSession?.form_data || {},
        });

        await bot.sendMessage(
          telegramId,
          this.messages.generateRegistrationOptionsMessage()
        );
        break;
      case "/menu - 🏠 Menu Utama":
      case "Menu Utama":
      case "Kembali ke Menu Utama":
        await this.handleMenuToMain(bot, telegramId);
        break;
      default:
        await this.handleUnknownMessage(bot, telegramId);
    }
  }

  // Registration Flow
  private async handleRegistrationOption(
    bot: TelegramBot,
    telegramId: number,
    text: string
  ): Promise<void> {
    switch (text) {
      case "/mulai - 🆕 Mulai Pendaftaran Baru":
      case "Mulai Pendaftaran Baru":
        await this.sessionService.resetSession(telegramId);
        await this.startRegistration(bot, telegramId);
        break;
      case "/lanjut - ⏩ Lanjutkan Sesi Pendaftaran":
        await this.continueRegistration(bot, telegramId);
        break;
      case "/menu - 🏠 Kembali ke Menu Utama":
        await this.handleMenuToMain(bot, telegramId);
        break;
      default:
        await this.handleUnknownMessage(bot, telegramId);
    }
  }

  private async startRegistration(
    bot: TelegramBot,
    telegramId: number
  ): Promise<void> {
    const existingSession = await this.sessionService.getActiveSession(
      telegramId
    );

    await this.sessionService.createOrUpdateSession({
      telegram_id: telegramId,
      current_step: SessionStep.NAMA,
      form_data: existingSession?.form_data || {},
    });

    await bot.sendMessage(
      telegramId,
      this.messages.generateStartRegistrationMessage(),
      {
        reply_markup: {remove_keyboard: true},
      }
    );
  }

  private async continueRegistration(
    bot: TelegramBot,
    telegramId: number
  ): Promise<void> {
    const session = await this.sessionService.getActiveSession(telegramId);

    if (!session || !session.form_data) {
      // No existing session, start fresh
      await this.startRegistration(bot, telegramId);
      return;
    }
    console.log({session});
    // Determine next step based on existing form data
    const nextStep = await this.sessionService.getNextStep(session.form_data);
    console.log({nextStep});
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
        this.messages.generateContinueRegistrationMessage(nextStep),
        {
          reply_markup: {remove_keyboard: true},
        }
      );
    }
  }

  // Registration Form Handlers
  private async handleNamaInput(
    bot: TelegramBot,
    telegramId: number,
    text: string,
    session: any
  ): Promise<void> {
    if (!text || text.length < 3) {
      await bot.sendMessage(
        telegramId,
        this.messages.generateNamaValidationError()
      );
      return;
    }

    session.form_data.nama = text;
    await this.sessionService.createOrUpdateSession({
      telegram_id: telegramId,
      current_step: SessionStep.NOMOR_TELEPON,
      form_data: session.form_data,
    });

    await bot.sendMessage(
      telegramId,
      this.messages.generateNamaSuccessMessage(text)
    );
  }

  private async handleNomorTeleponInput(
    bot: TelegramBot,
    telegramId: number,
    text: string,
    session: any
  ): Promise<void> {
    const phoneRegex = /^(\+62|62|0)8[1-9][0-9]{6,9}$/;
    if (!phoneRegex.test(text)) {
      await bot.sendMessage(
        telegramId,
        this.messages.generateTeleponValidationError()
      );
      return;
    }

    session.form_data.nomor_telepon = text;
    await this.sessionService.createOrUpdateSession({
      telegram_id: telegramId,
      current_step: SessionStep.NOMOR_KTP,
      form_data: session.form_data,
    });

    await bot.sendMessage(
      telegramId,
      this.messages.generateTeleponSuccessMessage(text)
    );
  }

  private async handleNomorKtpInput(
    bot: TelegramBot,
    telegramId: number,
    text: string,
    session: any
  ): Promise<void> {
    const ktpRegex = /^[0-9]{16}$/;
    if (!ktpRegex.test(text)) {
      await bot.sendMessage(
        telegramId,
        this.messages.generateKtpValidationError()
      );
      return;
    }

    const isKtpRegistered = await this.sessionService.isKtpRegistered(text);
    if (isKtpRegistered) {
      await bot.sendMessage(
        telegramId,
        this.messages.generateKtpDuplicateError()
      );
      return;
    }

    session.form_data.nomor_ktp = text;
    await this.sessionService.createOrUpdateSession({
      telegram_id: telegramId,
      current_step: SessionStep.ALAMAT,
      form_data: session.form_data,
    });

    await bot.sendMessage(
      telegramId,
      this.messages.generateKtpSuccessMessage(text)
    );
  }

  private async handleAlamatInput(
    bot: TelegramBot,
    telegramId: number,
    text: string,
    session: any
  ): Promise<void> {
    if (!text || text.length < 10) {
      await bot.sendMessage(
        telegramId,
        this.messages.generateAlamatValidationError()
      );
      return;
    }

    session.form_data.alamat = text;
    await this.sessionService.createOrUpdateSession({
      telegram_id: telegramId,
      current_step: SessionStep.CONFIRMATION,
      form_data: session.form_data,
    });

    await bot.sendMessage(
      telegramId,
      this.messages.generateConfirmationMessage(session.form_data)
    );
  }

  private async handleConfirmation(
    bot: TelegramBot,
    telegramId: number,
    text: string,
    session: any
  ): Promise<void> {
    switch (text) {
      case "/ya - ✅ Ya, Daftarkan":
      case "Ya, Daftarkan":
        await this.processRegistration(bot, telegramId, session);
        break;
      case "/tidak - ❌ Tidak, Ulangi Pendaftaran":
      case "Tidak, Ulangi Pendaftaran":
        await this.startRegistration(bot, telegramId);
        break;
      case "/menu - 🏠 Kembali ke Menu Utama":
      case "Kembali ke Menu Utama":
        await this.handleMenuToMain(bot, telegramId);
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
    if (!session || session.current_step !== SessionStep.CONFIRMATION) {
      await bot.sendMessage(
        telegramId,
        this.messages.generateNoActiveSessionMessage()
      );
      return;
    }

    await this.handleConfirmation(bot, telegramId, action, session);
  }

  private async processRegistration(
    bot: TelegramBot,
    telegramId: number,
    session: any
  ): Promise<void> {
    try {
      await this.sessionService.completeRegistration(session);

      await bot.sendMessage(
        telegramId,
        this.messages.generateRegistrationSuccessMessage(session.form_data),
        {
          reply_markup: {remove_keyboard: true},
        }
      );
    } catch (error) {
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
    registeredUser: RegisteredUser | null
  ): Promise<void> {
    if (!registeredUser) {
      await bot.sendMessage(
        telegramId,
        "Anda belum terdaftar. Gunakan /daftar untuk mendaftar."
      );
      return;
    }

    await bot.sendMessage(
      telegramId,
      this.messages.generateViewDataMessage(registeredUser)
    );
  }

  // Error Handlers
  private async handleUnknownMessage(
    bot: TelegramBot,
    telegramId: number
  ): Promise<void> {
    const registeredUser = await this.sessionService.getRegisteredUser(
      telegramId
    );

    if (registeredUser) {
      await this.sendRegisteredWelcomeMessage(bot, telegramId, registeredUser);
    } else {
      await bot.sendMessage(telegramId, this.messages.generateUnknownMessage());
    }
  }
}
