// src/app.ts - Update dengan services baru

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import kycRoutes from "./api/routes/kycRoutes";
import {BotManager} from "./services/BotManager";
import {Database} from "./config/database";
import {Logger} from "./config/logger";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const logger = Logger.getInstance();

// Middleware
app.use(cors());
app.use(express.json({limit: "50mb"}));
app.use(express.urlencoded({extended: true, limit: "50mb"}));

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    version: "2.0.0",
  });
});

app.use("/api/kyc", kycRoutes);

// Global error handler
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    logger.error("Unhandled error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      ...(process.env.NODE_ENV === "development" && {error: err.message}),
    });
  }
);

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

async function startServer() {
  try {
    // Initialize database
    await Database.getInstance().connect();
    logger.info("Database connected successfully");

    // Initialize and start bot manager
    const botManager = new BotManager();
    await botManager.initialize();
    logger.info("Bot manager initialized successfully");

    // Graceful shutdown
    process.on("SIGTERM", async () => {
      logger.info("SIGTERM received, shutting down gracefully");
      await botManager.shutdown();
      await Database.getInstance().close();
      process.exit(0);
    });

    process.on("SIGINT", async () => {
      logger.info("SIGINT received, shutting down gracefully");
      await botManager.shutdown();
      await Database.getInstance().close();
      process.exit(0);
    });

    // Start server
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      console.log(
        `🚀 KYC Bot Server v2.0.0 running on http://localhost:${PORT}`
      );
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
