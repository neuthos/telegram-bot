// src/api/middleware/authMiddleware.ts
import {Request, Response, NextFunction} from "express";
import {Database} from "../../config/database";
import {Logger} from "../../config/logger";

export interface AuthRequest extends Request {
  partnerId?: number;
  partnerName?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const apiKey = req.headers["x-api-key"] as string;
  const partnerId = req.headers["x-partner-id"] as string;

  if (!apiKey || !partnerId) {
    return res.status(401).json({
      success: false,
      message: "Missing API key or Partner ID",
    });
  }

  try {
    const db = Database.getInstance().getPool();
    const result = await db.query(
      "SELECT id, name FROM bot_partners WHERE id = $1 AND api_secret = $2 AND is_active = true",
      [partnerId, apiKey]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    req.partnerId = result.rows[0].id;
    req.partnerName = result.rows[0].name;
    next();
  } catch (error) {
    Logger.getInstance().error("Auth middleware error:", error);
    res.status(500).json({
      success: false,
      message: "Authentication error",
    });
  }
};
