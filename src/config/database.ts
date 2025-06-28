// src/config/database.ts - Update dengan method connect()

import {Pool} from "pg";
import {Logger} from "./logger";
import dotenv from "dotenv";

dotenv.config();

export class Database {
  private static instance: Database;
  private pool: Pool;
  private logger = Logger.getInstance();
  private connected = false;

  private constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "5432"),
      database: process.env.DB_NAME || "kyc_db",
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "password",
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      client_encoding: "UTF8",
      ssl: false,
    });

    this.pool.on("error", (err) => {
      this.logger.error("Database pool error:", err);
    });

    this.pool.on("connect", () => {
      this.logger.info("Database client connected");
    });
  }

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  // ADD CONNECT METHOD
  public async connect(): Promise<void> {
    if (this.connected) {
      this.logger.info("Database already connected");
      return;
    }

    try {
      // Test connection
      const client = await this.pool.connect();
      await client.query("SELECT NOW()");
      client.release();

      this.connected = true;
      this.logger.info("Database connected successfully");
    } catch (error) {
      this.logger.error("Database connection failed:", error);
      throw error;
    }
  }

  public getPool(): Pool {
    return this.pool;
  }

  public async query(text: string, params?: any[]): Promise<any> {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      this.logger.debug(`Query executed in ${duration}ms:`, {
        query: text.substring(0, 100) + (text.length > 100 ? "..." : ""),
        params: params?.length ? `[${params.length} params]` : undefined,
      });
      return result;
    } catch (error) {
      this.logger.error("Database query error:", {
        query: text.substring(0, 100) + (text.length > 100 ? "..." : ""),
        params: params?.length ? `[${params.length} params]` : undefined,
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }

  public async close(): Promise<void> {
    if (!this.connected) {
      return;
    }

    try {
      await this.pool.end();
      this.connected = false;
      this.logger.info("Database connection closed");
    } catch (error) {
      this.logger.error("Error closing database connection:", error);
      throw error;
    }
  }

  // Helper method to check connection status
  public isConnected(): boolean {
    return this.connected;
  }
}
