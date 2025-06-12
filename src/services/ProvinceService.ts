import {Database} from "../config/database";
import {Logger} from "../config/logger";

export class ProvinceService {
  private db = Database.getInstance();
  private logger = Logger.getInstance();

  public async getAllProvinces(): Promise<{code: string; name: string}[]> {
    try {
      const result = await this.db.query(
        "SELECT code, name FROM provinces ORDER BY name"
      );
      return result.rows;
    } catch (error) {
      this.logger.error("Error getting provinces:", error);
      throw error;
    }
  }

  public async getCitiesByProvince(
    provinceCode: string
  ): Promise<{code: string; name: string}[]> {
    try {
      const result = await this.db.query(
        "SELECT code, name FROM cities WHERE province_code = $1 ORDER BY name",
        [provinceCode]
      );
      return result.rows;
    } catch (error) {
      this.logger.error("Error getting cities:", error);
      throw error;
    }
  }

  public async getProvinceByCode(
    code: string
  ): Promise<{code: string; name: string} | null> {
    try {
      const result = await this.db.query(
        "SELECT code, name FROM provinces WHERE code = $1",
        [code]
      );
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      this.logger.error("Error getting province by code:", error);
      return null;
    }
  }

  public async getCityByCode(
    code: string
  ): Promise<{code: string; name: string} | null> {
    try {
      const result = await this.db.query(
        "SELECT code, name FROM cities WHERE code = $1",
        [code]
      );
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      this.logger.error("Error getting city by code:", error);
      return null;
    }
  }
}
