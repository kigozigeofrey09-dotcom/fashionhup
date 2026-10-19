import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import type { Session as SupabaseSession, User as SupabaseAuthUser } from "@supabase/supabase-js";
import { createAuthenticatedSupabase, supabase, supabasePublishableKey, supabaseUrl } from "../lib/supabase.js";
import { isConfiguredAdmin } from "../lib/requestAuth.js";

export const authRouter = Router();

const frontendOrigin = (process.env.FRONTEND_ORIGIN ?? "http://127.0.0.1:5173").replace(/\/$/, "");
const callbackUrl = `${(process.env.BACKEND_ORIGIN ?? "http://127.0.0.1:4000").replace(/\/$/, "")}/api/auth/callback`;
const accessCookie = "fh_access";
const refreshCookie = "fh_refresh";
const isProduction = process.env.NODE_ENV === "production";
const cookieOptions = { httpOnly: true, secure: isProduction, sameSite: "lax" as const, path: "/" };

const signInLinkSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  role: z.enum(["buyer", "seller"])
});
const signInSchema = signInLinkSchema.extend({ password: z.string().min(8).max(128) });

const signUpSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  role: z.enum(["buyer", "seller"]),
  countryCode: z.string().trim().length(2).transform((value) => value.toUpperCase())
});
const passwordSignUpSchema = signUpSchema.extend({ password: z.string().min(8).max(128) });

const emailSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase())
});

const limiter = new Map<string, { count: number; resetsAt: number }>();
function authRateLimit(req: Request, res: Response, next: NextFunction) {
  const now = Date.now();
  const key = `${req.ip ?? "unknown"}:${req.path}`;
  let bucket = limiter.get(key);
  if (!bucket || bucket.resetsAt <= now) {
    bucket = { count: 0, resetsAt: now + 10 * 60 * 1000 };
    limiter.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > 5) {
    res.setHeader("Retry-After", String(Math.ceil((bucket.resetsAt - now) / 1000)));
    return res.status(429).json({ message: "Too many attempts. Wait a few minutes and try again." });
  }
  for (const [entry, value] of limiter) {
    if (value.resetsAt <= now) limiter.delete(entry);
  }
  next();
}

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) {
      try { return decodeURIComponent(part.slice(separator + 1).trim()); }
      catch { return undefined; }
    }
  }
  return undefined;
}

function setSessionCookies(res: Response, session: SupabaseSession) {
  res.cookie(accessCookie, session.access_token, {
    ...cookieOptions,
    maxAge: Math.max(60, session.expires_in ?? 3600) * 1000
  });
  res.cookie(refreshCookie, session.refresh_token, {
    ...cookieOptions,
    maxAge: 30 * 24 * 60 * 60 * 1000
  });
}

function clearSessionCookies(res: Response) {
  res.clearCookie(accessCookie, cookieOptions);
  res.clearCookie(refreshCookie, cookieOptions);
}

type FashionHubUser = {
  id: string;
  name: string;
  email: string;
  role: "buyer" | "seller" | "admin";
  countryCode?: string;
};

async function loadFashionHubUser(authUser: SupabaseAuthUser, accessToken: string): Promise<FashionHubUser> {
  const client = createAuthenticatedSupabase(accessToken);
  const { data: profile, error } = await client
    .from("profiles")
    .select("id, name, role, country_code")
    .eq("id", authUser.id)
    .maybeSingle();

  if (error) throw new Error(`Could not load account profile: ${error.message}`);
  if (!profile) throw new Error("Account profile is missing.");
  if (!["buyer", "seller", "admin"].includes(profile.role)) {
    throw new Error("Account role is invalid.");
  }

  return {
    id: profile.id,
    name: profile.name,
    email: authUser.email ?? "",
    role: (isConfiguredAdmin(authUser.email) ? "admin" : profile.role) as FashionHubUser["role"],
    countryCode: profile.country_code ?? undefined
  };
}

async function currentUser(req: Request, res: Response): Promise<FashionHubUser | null> {
  let accessToken = readCookie(req, accessCookie);
  const refreshToken = readCookie(req, refreshCookie);
  if (!accessToken && !refreshToken) return null;

  let authUser: SupabaseAuthUser | null = null;
  if (accessToken) {
    const verified = await supabase.auth.getUser(accessToken);
    if (!verified.error) authUser = verified.data.user;
  }

  if (!authUser && refreshToken) {
    const refreshed = await supabase.auth.refreshSession({ refresh_token: refreshToken });
    if (!refreshed.error && refreshed.data.session) {
      accessToken = refreshed.data.session.access_token;
      authUser = refreshed.data.user;
      setSessionCookies(res, refreshed.data.session);
    }
  }

  if (!authUser || !accessToken) {
    clearSessionCookies(res);
    return null;
  }

  return loadFashionHubUser(authUser, accessToken);
}

function invalidBody(res: Response, message: string) {
  return res.status(422).json({ message });
}

authRouter.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

authRouter.post("/sign-up", authRateLimit, async (req, res) => {
  const parsed = signUpSchema.safeParse(req.body);
  if (!parsed.success) return invalidBody(res, "Enter a valid name, email, account type, and country.");
  const input = parsed.data;

  const { data: country, error: countryError } = await supabase
    .from("countries")
    .select("code")
    .eq("code", input.countryCode)
    .eq("enabled", true)
    .maybeSingle();
  if (countryError) {
    console.error("Could not validate signup country:", countryError.message);
    return res.status(503).json({ message: "Account service is temporarily unavailable." });
  }
  if (!country) return invalidBody(res, "Choose an available country.");

  const { error } = await supabase.auth.signInWithOtp({
    email: input.email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: callbackUrl,
      data: { name: input.name, role: input.role, country_code: input.countryCode }
    }
  });
  if (error) console.warn("Signup email request could not be completed:", error.message);
  return res.json({ message: "If this email can be registered, a secure sign-in link will be sent." });
});

authRouter.post("/sign-in-link", authRateLimit, async (req, res) => {
  const parsed = signInLinkSchema.safeParse(req.body);
  if (!parsed.success) return invalidBody(res, "Enter a valid email and account type.");
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { shouldCreateUser: false, emailRedirectTo: callbackUrl }
  });
  if (error) console.warn("Sign-in email request could not be completed:", error.message);
  return res.json({ message: "If this account is eligible, a secure sign-in link will be sent." });
});

authRouter.post("/sign-in", authRateLimit, async (req, res) => {
  const parsed = signInSchema.safeParse(req.body);
  if (!parsed.success) return invalidBody(res, "Enter a valid email, password, and account type.");
  const { data, error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  if (error || !data.user || !data.session) {
    return res.status(401).json({ message: "Email or password is incorrect, or the email has not been confirmed." });
  }
  try {
    const user = await loadFashionHubUser(data.user, data.session.access_token);
    if (user.role !== "admin" && user.role !== parsed.data.role) {
      return res.status(403).json({ message: `This account is registered as a ${user.role}. Choose that account type to sign in.` });
    }
    setSessionCookies(res, data.session);
    return res.json({ user });
  } catch (error) {
    console.error("Could not load account after sign-in:", error);
    return res.status(503).json({ message: "Account profile is not ready. Please try again or contact support." });
  }
});

authRouter.post("/sign-up-password", authRateLimit, async (req, res) => {
  const parsed = passwordSignUpSchema.safeParse(req.body);
  if (!parsed.success) return invalidBody(res, "Enter a valid name, email, password, account type, and country.");
  const input = parsed.data;
  const { data: country, error: countryError } = await supabase.from("countries").select("code").eq("code", input.countryCode).eq("enabled", true).maybeSingle();
  if (countryError) {
    console.error("Could not validate signup country:", countryError.message);
    return res.status(503).json({ message: "Account service is temporarily unavailable." });
  }
  if (!country) return invalidBody(res, "Choose an available country.");
  const { error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: { emailRedirectTo: callbackUrl, data: { name: input.name, role: input.role, country_code: input.countryCode } }
  });
  if (error) console.warn("Password signup request could not be completed:", error.message);
  return res.json({ message: "If this email can be registered, check your inbox to confirm it before signing in." });
});

authRouter.post("/password/forgot", authRateLimit, async (req, res) => {
  const parsed = emailSchema.safeParse(req.body);
  if (!parsed.success) return invalidBody(res, "Enter a valid email address.");
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: callbackUrl });
  if (error) console.warn("Recovery email request could not be completed:", error.message);
  return res.json({ message: "If this account is eligible, recovery instructions will be sent by email." });
});

authRouter.get("/callback", async (req, res) => {
  const tokenHash = req.query.token_hash;
  const type = req.query.type;
  if (typeof tokenHash !== "string" || !["email", "signup", "recovery"].includes(String(type))) {
    return res.redirect(303, `${frontendOrigin}/auth/sign-in?link=invalid`);
  }

  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: String(type) as "email" | "signup" | "recovery"
  });
  if (error || !data.session) {
    console.warn("Email callback verification failed:", error?.message ?? "Session not returned.");
    return res.redirect(303, `${frontendOrigin}/auth/sign-in?link=expired`);
  }

  setSessionCookies(res, data.session);
  return res.redirect(303, String(type) === "recovery" ? `${frontendOrigin}/auth/reset-password` : `${frontendOrigin}/account`);
});

authRouter.post("/password/reset/confirm", authRateLimit, async (req, res) => {
  const parsed = z.object({ password: z.string().min(8).max(128) }).safeParse(req.body);
  if (!parsed.success) return invalidBody(res, "Choose a password with at least 8 characters.");
  const token = readCookie(req, accessCookie);
  if (!token) return res.status(401).json({ message: "Open the password recovery link from your email first." });
  const client = createAuthenticatedSupabase(token);
  const { error } = await client.auth.updateUser({ password: parsed.data.password });
  if (error) return res.status(422).json({ message: "This recovery link has expired. Request a new one." });
  return res.json({ message: "Your password has been updated. You can now sign in with it." });
});

async function sendCurrentUser(req: Request, res: Response, includeSession: boolean) {
  try {
    const user = await currentUser(req, res);
    if (!user) return res.status(401).json({ message: "Sign-in required." });
    return res.json(includeSession ? { user } : user);
  } catch (error) {
    console.error("Could not load authenticated account:", error);
    return res.status(503).json({ message: "Account service is temporarily unavailable." });
  }
}

authRouter.get("/session", (req, res) => sendCurrentUser(req, res, true));
authRouter.get("/me", (req, res) => sendCurrentUser(req, res, false));

authRouter.post("/sign-out", async (req, res) => {
  const accessToken = readCookie(req, accessCookie);
  try {
    if (accessToken) {
      const response = await fetch(`${supabaseUrl}/auth/v1/logout`, {
        method: "POST",
        headers: {
          apikey: supabasePublishableKey!,
          Authorization: `Bearer ${accessToken}`
        }
      });
      if (!response.ok && response.status !== 401) {
        console.warn("Supabase could not revoke the session:", response.status);
      }
    }
  } catch (error) {
    console.warn("Supabase sign-out request failed:", error);
  }
  clearSessionCookies(res);
  return res.status(204).end();
});

