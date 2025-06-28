import {CacheProvider} from "./cache/CacheProvider";
import {CacheFactory} from "./cache/CacheFactory";
import {Database} from "../config/database";
import {Logger} from "../config/logger";
import axios from "axios";

export class TokenManager {
  private static instance: TokenManager;
  private cache: CacheProvider;
  private db = Database.getInstance().getPool();
  private logger = Logger.getInstance();

  private constructor() {
    this.cache = CacheFactory.create();
  }

  static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }

  async getEmeteraiToken(partnerId: number): Promise<string> {
    const cacheKey = `emeterai:token:${partnerId}`;
    const cached = await this.cache.get<{token: string; expires: Date}>(
      cacheKey
    );
    console.log({cached});
    if (cached && new Date() < new Date(cached.expires)) {
      return cached.token;
    }

    const partner = await this.getPartnerEmeteraiConfig(partnerId);
    console.log({partner});
    if (!partner.emeterai_client_id) {
      throw new Error("E-meterai not configured for this partner");
    }

    const newToken = await this.requestNewToken(partner);
    console.log({newToken});
    const ttl =
      Math.floor((new Date(newToken.expires).getTime() - Date.now()) / 1000) -
      60;
    await this.cache.set(cacheKey, newToken, ttl);

    return newToken.token;
  }

  private async getPartnerEmeteraiConfig(partnerId: number) {
    const result = await this.db.query(
      `SELECT emeterai_client_id, emeterai_client_email, emeterai_client_password 
       FROM bot_partners WHERE id = $1`,
      [partnerId]
    );

    if (result.rows.length === 0) {
      throw new Error("Partner not found");
    }
    console.log(result.rows[0], "CLIENT EMATERAI");
    return result.rows[0];
  }

  private async requestNewToken(partner: any) {
    const response = await axios.post(
      `${process.env.EMETERAI_BASE_URL}/api/v1/client/get-token`,
      {
        client_id: partner.emeterai_client_id,
        client_email: partner.emeterai_client_email,
        client_password: partner.emeterai_client_password,
      },
      {
        headers: {
          "x-api-key": process.env.EMETERAI_API_KEY,
        },
      }
    );

    const tokenData = response.data.data.MCPToken.Token;
    return {
      token: tokenData.jwt,
      expires: new Date(tokenData.expiredDate),
    };
  }
}
