import type { Request, Response } from "express";
import type { User } from "@supabase/supabase-js";
import { createAuthenticatedSupabase, supabase } from "./supabase.js";

const accessCookie = "fh_access";
const refreshCookie = "fh_refresh";
const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };

function cookie(req: Request, name: string) {
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i < 0 || part.slice(0, i).trim() !== name) continue;
    try { return decodeURIComponent(part.slice(i + 1).trim()); } catch { return undefined; }
  }
  return undefined;
}

export async function authenticatedAccount(req: Request, res: Response) {
  let token = cookie(req, accessCookie);
  const refresh = cookie(req, refreshCookie);
  let user: User | null = null;
  if (token) {
    const checked = await supabase.auth.getUser(token);
    if (!checked.error) user = checked.data.user;
  }
  if (!user && refresh) {
    const result = await supabase.auth.refreshSession({ refresh_token: refresh });
    if (!result.error && result.data.session && result.data.user) {
      token = result.data.session.access_token;
      user = result.data.user;
      res.cookie(accessCookie, result.data.session.access_token, { ...cookieOptions, maxAge: Math.max(60, result.data.session.expires_in ?? 3600) * 1000 });
      res.cookie(refreshCookie, result.data.session.refresh_token, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 });
    }
  }
  if (!token || !user) {
    res.status(401).json({ message: "Your session expired. Sign in again and retry." });
    return null;
  }
  return { token, user, client: createAuthenticatedSupabase(token) };
}

export function isConfiguredAdmin(email: string | undefined) {
  return Boolean(email && email.trim().toLowerCase() === "kigozigeofrey09@gmail.com");
}

export async function authenticatedAdmin(req: Request, res: Response) {
  const account = await authenticatedAccount(req, res);
  if (!account) return null;
  if (isConfiguredAdmin(account.user.email)) return account;
  const { data: profile, error } = await account.client.from("profiles").select("role").eq("id", account.user.id).maybeSingle();
  if (error) { res.status(503).json({ message: "Could not verify admin access." }); return null; }
  if (profile?.role !== "admin") { res.status(403).json({ message: "Administrator access is required." }); return null; }
  return account;
}
