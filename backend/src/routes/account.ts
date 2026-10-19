import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { authenticatedAccount } from "../lib/requestAuth.js";
import { createAuthenticatedSupabase } from "../lib/supabase.js";
import { hydrateListings } from "./listings.js";

export const accountRouter = Router();
const getAccount = authenticatedAccount;
const imageReference = z.string().trim().max(2048).refine((value) => {
  if (/^\/api\/uploads\/images\/[a-f0-9-]+\.(jpg|png|webp|avif)$/i.test(value)) return true;
  try { const url = new URL(value); return url.protocol === "https:" || url.protocol === "http:"; }
  catch { return false; }
}, "Enter a valid profile photo URL.");

const settingsPatch = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  avatarUrl: imageReference.optional(),
  countryCode: z.string().trim().length(2).transform((value) => value.toUpperCase()).optional(),
  city: z.string().trim().max(80).optional(),
  notificationPreferences: z.record(z.string(), z.boolean()).optional()
}).refine((value) => Object.keys(value).length > 0, "Provide at least one setting to update.");

async function settingsDto(client: ReturnType<typeof createAuthenticatedSupabase>, userId: string, email: string) {
  const [profileResult, preferencesResult] = await Promise.all([
    client.from("profiles").select("name, country_code, avatar_url").eq("id", userId).maybeSingle(),
    client.from("account_preferences").select("city, notification_preferences").eq("user_id", userId).maybeSingle()
  ]);
  if (profileResult.error) throw profileResult.error;
  if (preferencesResult.error) throw preferencesResult.error;
  if (!profileResult.data) throw new Error("Account profile is missing.");
  return {
    name: profileResult.data.name,
    email,
    countryCode: profileResult.data.country_code ?? "",
    avatarUrl: profileResult.data.avatar_url ?? "",
    city: preferencesResult.data?.city ?? "",
    notificationPreferences: preferencesResult.data?.notification_preferences ?? { enquiry: true, order: true, "product-updates": false }
  };
}

accountRouter.get("/settings", async (req, res) => {
  const account = await getAccount(req, res);
  if (!account) return;
  try { return res.json(await settingsDto(account.client, account.user.id, account.user.email ?? "")); }
  catch (error) {
    console.error("Could not load account settings:", error);
    const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
    if (code === "42P01") return res.status(503).json({ message: "Account preferences are not installed yet. Apply supabase/migrations/202610110003_account_settings.sql, then retry." });
    if (code === "42703") return res.status(503).json({ message: "A profile settings field is missing. Apply supabase/migrations/202610110004_fashionhub_images.sql and 202610110003_account_settings.sql, then retry." });
    return res.status(500).json({ message: "Could not load your profile settings." });
  }
});

accountRouter.patch("/settings", async (req, res) => {
  const parsed = settingsPatch.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ message: "Check your profile settings and try again." });
  const account = await getAccount(req, res);
  if (!account) return;
  const { client, user } = account;
  const fields = parsed.data;

  if (fields.countryCode) {
    const { data: country, error } = await client.from("countries").select("code").eq("code", fields.countryCode).eq("enabled", true).maybeSingle();
    if (error) return res.status(503).json({ message: "Could not verify the selected country." });
    if (!country) return res.status(422).json({ message: "Choose an available country." });
  }

  const profileUpdate: Record<string, string> = {};
  if (fields.name !== undefined) profileUpdate.name = fields.name;
  if (fields.avatarUrl !== undefined) profileUpdate.avatar_url = fields.avatarUrl;
  if (fields.countryCode !== undefined) profileUpdate.country_code = fields.countryCode;
  if (Object.keys(profileUpdate).length) {
    const { error } = await client.from("profiles").update(profileUpdate).eq("id", user.id);
    if (error) { console.error("Could not update account profile:", error.message); return res.status(500).json({ message: "Could not save your profile details." }); }
  }

  if (fields.city !== undefined || fields.notificationPreferences !== undefined) {
    const { data: current, error: currentError } = await client.from("account_preferences").select("city, notification_preferences").eq("user_id", user.id).maybeSingle();
    if (currentError) { console.error("Could not load account preferences:", currentError.message); return res.status(500).json({ message: "Could not save your account settings." }); }
    const { error } = await client.from("account_preferences").upsert({
      user_id: user.id,
      city: fields.city ?? current?.city ?? "",
      notification_preferences: fields.notificationPreferences ?? current?.notification_preferences ?? { enquiry: true, order: true, "product-updates": false },
      updated_at: new Date().toISOString()
    });
    if (error) { console.error("Could not save account preferences:", error.message); return res.status(500).json({ message: "Could not save your account settings." }); }
  }

  try { return res.json(await settingsDto(client, user.id, user.email ?? "")); }
  catch (error) { console.error("Could not reload account settings:", error); return res.status(500).json({ message: "Settings were updated but could not be reloaded." }); }
});

accountRouter.get("/saved", async (req, res) => {
  const account = await getAccount(req, res); if (!account) return;
  const { data: savedRows, error: savedError } = await account.client.from("saved_listings").select("listing_id, created_at").eq("user_id", account.user.id).order("created_at", { ascending: false });
  if (savedError) { console.error("Could not load saved listings:", savedError.message); return res.status(500).json({ message: "Could not load saved items." }); }
  if (!savedRows?.length) return res.json([]);
  const { data: listings, error } = await account.client.from("listings").select("*").in("id", savedRows.map((row) => row.listing_id)).eq("is_active", true);
  if (error) { console.error("Could not load saved listing details:", error.message); return res.status(500).json({ message: "Could not load saved items." }); }
  const order = new Map(savedRows.map((row, index) => [row.listing_id, index]));
  const sorted = (listings ?? []).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  try { return res.json(await hydrateListings(sorted)); }
  catch (error) { console.error("Could not load saved listing details:", error); return res.status(500).json({ message: "Could not load saved item details." }); }
});

accountRouter.put("/saved/:listingId", async (req, res) => {
  const account = await getAccount(req, res); if (!account) return;
  const id = z.string().uuid().safeParse(req.params.listingId);
  if (!id.success) return res.status(422).json({ message: "Choose a valid listing." });
  const { error } = await account.client.from("saved_listings").insert({ user_id: account.user.id, listing_id: id.data });
  if (error && error.code !== "23505") { console.error("Could not save listing:", error.message); return res.status(500).json({ message: "Could not save this listing." }); }
  return res.status(204).end();
});

accountRouter.delete("/saved/:listingId", async (req, res) => {
  const account = await getAccount(req, res); if (!account) return;
  const id = z.string().uuid().safeParse(req.params.listingId);
  if (!id.success) return res.status(422).json({ message: "Choose a valid listing." });
  const { error } = await account.client.from("saved_listings").delete().eq("user_id", account.user.id).eq("listing_id", id.data);
  if (error) { console.error("Could not remove saved listing:", error.message); return res.status(500).json({ message: "Could not remove this saved listing." }); }
  return res.status(204).end();
});

accountRouter.delete("/", async (req, res) => {
  const confirmation = z.object({ confirmation: z.literal("DELETE") }).safeParse(req.body);
  if (!confirmation.success) return res.status(422).json({ message: "Type DELETE to confirm your account deletion request." });
  const account = await getAccount(req, res); if (!account) return;
  const { data: existing, error: lookupError } = await account.client.from("account_deletion_requests").select("user_id").eq("user_id", account.user.id).maybeSingle();
  if (lookupError) { console.error("Could not check account deletion request:", lookupError.message); return res.status(500).json({ message: "Could not submit your account deletion request." }); }
  if (!existing) {
    const { error } = await account.client.from("account_deletion_requests").insert({ user_id: account.user.id });
    if (error) { console.error("Could not create account deletion request:", error.message); return res.status(500).json({ message: "Could not submit your account deletion request." }); }
  }
  return res.status(202).json({ message: "Your account deletion request was submitted for review." });
});
