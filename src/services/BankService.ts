import {Database} from "../config/database";

export class BankService {
  private db = Database.getInstance();

  public async getAllBanks(): Promise<string[]> {
    const result = await this.db.query(
      `SELECT bank_display AS name, bank_code
     FROM banks
     GROUP BY bank_display, bank_code
     ORDER BY bank_display ASC`
    );
    return result.rows;
  }

  public async isValidBank(bankName: string): Promise<boolean> {
    const result = await this.db.query(
      `SELECT COUNT(*) as count
         FROM banks
         WHERE bank_display = $1`,
      [bankName]
    );
    return parseInt(result.rows[0].count) > 0;
  }

  public async getBankByCommand(command: string): Promise<string | null> {
    const cleanCommand = command.replace(/^\//, "").trim();

    const result = await this.db.query(
      `SELECT bank_display AS name
         FROM banks
         WHERE LOWER(REPLACE(bank_display, ' ', '')) = LOWER(REPLACE($1, ' ', ''))`,
      [cleanCommand]
    );

    return result.rows.length > 0 ? result.rows[0].name : null;
  }

  public async getBankCommands(): Promise<{command: string; name: string}[]> {
    const result = await this.db.query(
      `SELECT bank_display AS name
     FROM banks
     GROUP BY bank_display, bank_code
     ORDER BY bank_display ASC`
    );

    return result.rows.map((row: any) => ({
      command: row.name.replace(/\s+/g, ""),
      name: row.name,
    }));
  }
}
