import { ADMIN_PASSWORD_DELIMITER } from "@/constants/admin";

const ADMIN_PASSWORD = process.env.ADMIN_DASHBOARD_PASSWORD;

interface NormalizedPayload {
  password?: string;
  nonce?: string;
}

export type AdminAuthValidationResult =
  | { ok: true; nonce: string }
  | { ok: false; status: number; message: string };

function normalizePayload(payload: unknown): NormalizedPayload {
  if (payload && typeof payload === "object") {
    const parsed = payload as Record<string, unknown>;
    return {
      password: typeof parsed.password === "string" ? parsed.password : undefined,
      nonce: typeof parsed.nonce === "string" ? parsed.nonce : undefined,
    };
  }
  return {};
}

export function validateAdminAuth(payload: unknown): AdminAuthValidationResult {
  if (!ADMIN_PASSWORD) {
    console.error("[admin auth] Missing ADMIN_DASHBOARD_PASSWORD env");
    return {
      ok: false,
      status: 500,
      message: "Admin dashboard password is not configured",
    };
  }

  const { password, nonce } = normalizePayload(payload);

  if (!nonce) {
    return {
      ok: false,
      status: 400,
      message: "Missing nonce",
    };
  }

  const isDevelopment = process.env.NODE_ENV === "development";
  if (!isDevelopment) {
    const expectedPassword = `${ADMIN_PASSWORD}${ADMIN_PASSWORD_DELIMITER}${nonce}`;
    if (!password || password !== expectedPassword) {
      return {
        ok: false,
        status: 401,
        message: "Invalid password",
      };
    }
  }

  return { ok: true, nonce };
}
