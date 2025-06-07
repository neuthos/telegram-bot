import {Pool} from "pg";
import {Logger} from "./logger";
import dotenv from "dotenv"; //

dotenv.config();
export class Database {
  private static instance: Database;
  private pool: Pool;
  private logger = Logger.getInstance();

  private constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || "5431"),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      client_encoding: "UTF8",
      ssl: false,
    });

    this.pool.on("error", (err) => {
      this.logger.error("Database pool error:", err);
    });
  }

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
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
        query: text,
        params,
      });
      return result;
    } catch (error) {
      this.logger.error("Database query error:", {query: text, params, error});
      throw error;
    }
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}
