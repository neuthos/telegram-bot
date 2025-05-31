import {Request, Response, NextFunction} from "express";

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
}

export const authMiddleware = (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
): void => {
  const apiKey = req.headers["x-api-key"] || req.headers["authorization"];

  if (!apiKey) {
    res.status(401).json({
      success: false,
      message: "API key required",
    });
    return;
  }

  if (apiKey !== process.env.API_SECRET_KEY) {
    res.status(403).json({
      success: false,
      message: "Invalid API key",
    });
    return;
  }

  next();
};
