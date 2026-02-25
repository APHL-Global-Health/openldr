import { type Request } from "express";
import { type DecodedToken } from "../types";

export function extractClientIdFromToken(req: Request): string | null {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }

    const token = authHeader.substring(7);

    // Decode the JWT (base64)
    const parts: any[] = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    // Decode payload (second part)
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64").toString("utf-8"),
    );

    // Extract client_id (prefer client_id, fallback to azp or sub)
    return payload.client_id || payload.azp || payload.sub || null;
  } catch (error) {
    console.error("Failed to extract client_id from token:", error);
    return null;
  }
}

export function decodeToken(req: Request): DecodedToken | null {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }

    const token = authHeader.substring(7);
    const parts: any[] = token.split(".");

    if (parts.length !== 3) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(parts[1], "base64").toString("utf-8"),
    );

    return payload as DecodedToken;
  } catch (error) {
    console.error("Failed to decode token:", error);
    return null;
  }
}
