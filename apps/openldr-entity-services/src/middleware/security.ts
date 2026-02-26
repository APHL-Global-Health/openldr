// ─────────────────────────────────────────────────────────────────────────────
// middleware/security.ts
//
// All security middleware in one place. Applied in the correct order in index.ts.
//
// Layers:
//   1. Helmet  — HTTP security headers (CSP, HSTS, X-Frame-Options, …)
//   2. CORS    — strict origin allowlist
//   3. Rate limiting — per-IP bucket per route group
//   4. API key — optional simple token for production hardening
//   5. Request logger — structured log of every request
// ─────────────────────────────────────────────────────────────────────────────

import type { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import cors from "cors";
import { keycloakService } from "../services/keycloak.service";

// ── Config (pull from env in production) ─────────────────────────────────

export const CONFIG = {
  /** Comma-separated list of allowed origins. '*' disables CORS protection. */
  allowedOrigins: (
    process.env.ALLOWED_ORIGINS ||
    // "http://localhost:5173,http://localhost:3000,http://localhost:4173"
    "*"
  )
    .split(",")
    .map((o) => o.trim()),

  /** When truthy, every request must carry this token as X-API-Key header */
  apiKey: process.env.API_KEY || "",

  /** Rate limits */
  rateLimit: {
    registry: { windowMs: 60_000, max: 60 }, // list of extensions
    codeLoad: { windowMs: 60_000, max: 30 }, // download extension payload
    general: { windowMs: 60_000, max: 120 }, // everything else
  },

  /** Cache-Control max-age for extension payloads (seconds) */
  payloadCacheSeconds: 300,
};

// ── 1. Helmet ─────────────────────────────────────────────────────────────
//
// We configure a strict CSP for API responses. Note: because extension HTML
// payloads embed their own CSP meta tag (allowing 'unsafe-inline' for their
// own scripts), the API's CSP only needs to cover the API routes themselves.

export const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      scriptSrc: ["'none'"],
      styleSrc: ["'none'"],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"], // This API should never be iframe-embedded
    },
  },
  hsts: {
    maxAge: 31_536_000, // 1 year
    includeSubDomains: true,
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: "no-referrer" },
});

// ── 2. CORS ───────────────────────────────────────────────────────────────

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow server-to-server requests (no origin header)
    if (!origin) {
      return callback(null, true);
    }
    // Allow all origins when wildcard is configured (development default)
    if (CONFIG.allowedOrigins.includes("*")) {
      return callback(null, true);
    }
    if (CONFIG.allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    console.warn(`[CORS] Blocked origin: ${origin}`);
    callback(new Error(`Origin ${origin} not allowed by CORS policy`));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-API-Key", "X-Request-ID"],
  exposedHeaders: ["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-Integrity"],
  maxAge: 600,
});

// ── 3. Rate limiters ──────────────────────────────────────────────────────

const makeRateLimiter = (windowMs: number, max: number, name: string) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: `Too many requests — rate limit exceeded for ${name}`,
      code: "RATE_LIMITED",
      status: 429,
    },
    handler: (req: Request, res: Response) => {
      console.warn(`[RateLimit] ${name} limit hit — IP: ${req.ip}`);
      res.status(429).json({
        error: `Rate limit exceeded for ${name}. Try again later.`,
        code: "RATE_LIMITED",
        status: 429,
      });
    },
  });

export const registryRateLimit = makeRateLimiter(
  CONFIG.rateLimit.registry.windowMs,
  CONFIG.rateLimit.registry.max,
  "registry",
);

export const codeLoadRateLimit = makeRateLimiter(
  CONFIG.rateLimit.codeLoad.windowMs,
  CONFIG.rateLimit.codeLoad.max,
  "code-load",
);

export const generalRateLimit = makeRateLimiter(
  CONFIG.rateLimit.general.windowMs,
  CONFIG.rateLimit.general.max,
  "general",
);

// ── 4. API Key auth ───────────────────────────────────────────────────────
//
// Simple bearer/header token. In production replace with JWT validation.
// Guards are opt-in — only applied to routes that require auth.

export const requireApiKey = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (!CONFIG.apiKey) {
    // Auth not configured — allow all (dev mode)
    return next();
  }

  const provided =
    req.headers["x-api-key"] ||
    (req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : undefined);

  if (!provided || provided !== CONFIG.apiKey) {
    console.warn(`[Auth] Invalid API key from ${req.ip} — path: ${req.path}`);
    res.status(401).json({
      error: "Invalid or missing API key",
      code: "UNAUTHORIZED",
      status: 401,
    });
    return;
  }

  next();
};

// ── 5. Request logger ─────────────────────────────────────────────────────

export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const start = Date.now();
  const reqId =
    req.headers["x-request-id"] ||
    `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  res.on("finish", () => {
    const ms = Date.now() - start;
    const color =
      res.statusCode >= 400
        ? "\x1b[31m"
        : res.statusCode >= 300
          ? "\x1b[33m"
          : "\x1b[32m";
    console.log(
      `${color}[${res.statusCode}]\x1b[0m ${req.method} ${req.path} — ${ms}ms — IP:${req.ip} — ${reqId}`,
    );
  });

  next();
};

// ── 6. Global error handler ───────────────────────────────────────────────

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  // CORS errors
  if (err.message.includes("not allowed by CORS")) {
    res
      .status(403)
      .json({ error: err.message, code: "CORS_VIOLATION", status: 403 });
    return;
  }

  console.error(`[Error] ${req.method} ${req.path}:`, err.message);
  res.status(500).json({
    error: "Internal server error",
    code: "SERVER_ERROR",
    status: 500,
  });
};

// ── 7. Security headers for extension payloads ────────────────────────────
//
// Applied specifically to /extensions/:id/code responses.
// These are additional headers on top of Helmet that are specific to
// serving untrusted extension code.

export const extensionPayloadHeaders = (
  _req: Request,
  res: Response,
  next: NextFunction,
): void => {
  // Prevent the browser from interpreting the response as anything other than JSON
  res.setHeader("X-Content-Type-Options", "nosniff");
  // Signal that this content came from the registry — clients can verify
  res.setHeader("X-Served-By", "openldr-extension-registry/1.0");
  // Prevent caching of extension code longer than our defined window
  res.setHeader(
    "Cache-Control",
    `public, max-age=${CONFIG.payloadCacheSeconds}, immutable`,
  );
  next();
};

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({
      error: "Missing Bearer token",
      code: "UNAUTHORIZED",
      status: 401,
    });
    return;
  }

  const token = authHeader.slice(7);
  keycloakService
    .verifyToken(token)
    .then((payload) => {
      if (payload) {
        const realmRoles = payload.realm_access?.roles ?? [];
        const clientRoles =
          payload.resource_access?.[process.env.KEYCLOAK_CLIENT_ID!]?.roles ??
          [];
        const allRoles = [...realmRoles, ...clientRoles];

        (req as any).user = {
          id: payload.sub,
          username: payload.preferred_username ?? payload.sub,
          email: payload.email ?? "",
          roles: allRoles,
          isAdmin:
            allRoles.includes("admin") || allRoles.includes("realm-admin"),
        };
      }
      next();
    })
    .catch((err) => {
      console.warn(`[Auth] JWT verification failed: ${err.message}`);
      res.status(401).json({
        error: "Invalid or expired token",
        code: "UNAUTHORIZED",
        status: 401,
      });
    });
}

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!(req as any).user?.isAdmin) {
    res
      .status(403)
      .json({ error: "Admin role required", code: "FORBIDDEN", status: 403 });
    return;
  }
  next();
}
