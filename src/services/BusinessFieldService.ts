// src/services/BusinessFieldService.ts
import {Database} from "../config/database";
import {Logger} from "../config/logger";

export class BusinessFieldService {
  private db = Database.getInstance();
  private logger = Logger.getInstance();

  public async getAllBusinessFields(): Promise<string[]> {
    try {
      const result = await this.db.query(
        "SELECT name FROM business_fields ORDER BY name"
      );
      return result.rows.map((row: any) => row.name);
    } catch (error) {
      this.logger.error("Error getting business fields:", error);
      throw error;
    }
  }

  public async isValidBusinessField(field: string): Promise<boolean> {
    try {
      const result = await this.db.query(
        "SELECT 1 FROM business_fields WHERE name = $1",
        [field]
      );
      return result.rows.length > 0;
    } catch (error) {
      this.logger.error("Error validating business field:", error);
      return false;
    }
  }

  public async getBusinessFieldByCommand(
    command: string
  ): Promise<string | null> {
    try {
      const fields = await this.getAllBusinessFields();
      const normalizedCommand = command.toLowerCase().replace(/\s+/g, "");

      for (const field of fields) {
        const normalizedField = field.toLowerCase().replace(/\s+/g, "");
        if (normalizedField === normalizedCommand) {
          return field;
        }
      }
      return null;
    } catch (error) {
      this.logger.error("Error getting business field by command:", error);
      return null;
    }
  }
}
