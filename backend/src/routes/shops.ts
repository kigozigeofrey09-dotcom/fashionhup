import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { supabase } from "../lib/supabase.js";
import { authenticatedAccount } from "../lib/requestAuth.js";

export const shopsRouter = Router();
const categories = ["Clothing", "Shoes", "Bags", "Jewellery", "Beauty", "Tailoring", "Accessories", "Other"] as const;
const imageReference = z.string().trim().max(2048).refine((value) => {
  if (/^\/api\/uploads\/images\/[a-f0-9-]+\.(jpg|png|webp|avif)$/i.test(value)) return true;
  try { const url = new URL(value); return url.protocol === "https:" || url.protocol === "http:"; }
  catch { return false; }
}, "Enter a valid image URL.");
const shopInput = z.object({
  name: z.string().trim().min(2).max(60), story: z.string().trim().min(10).max(500),
  tagline: z.string().trim().max(80).default(""), categories: z.array(z.enum(categories)).min(1).max(categories.length),
  sellType: z.enum(["products", "services", "both"]), countryCode: z.string().trim().length(2).transform(v => v.toUpperCase()),
  countryName: z.string().trim().min(1).max(80), currency: z.string().trim().length(3).transform(v => v.toUpperCase()),
  city: z.string().trim().min(1).max(80), accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  whatsappNumber: z.string().trim().regex(/^\+[1-9]\d{7,14}$/),
  logoUrl: imageReference.optional().or(z.literal("")),
  coverUrl: imageReference.optional().or(z.literal(""))
});

async function authenticatedSeller(req: Request, res: Response) {
  const account = await authenticatedAccount(req, res); if (!account) return null;
  const { data: profile, error } = await account.client.from("profiles").select("role").eq("id", account.user.id).maybeSingle();
  if (error) { console.error("Could not read shop owner role:", error.message); res.status(503).json({ message: "Could not verify your seller account." }); return null; }
  if (profile?.role !== "seller") { res.status(403).json({ message: "A seller account is required to manage a shop." }); return null; }
  return { client: account.client, userId: account.user.id };
}

async function shopDto(row: any, countryName?: string) {
  if (!countryName && row.country_code) {
    const { data } = await supabase.from("countries").select("name").eq("code", row.country_code).maybeSingle();
    countryName = data?.name ?? "";
  }
  return { id: row.id, name: row.name, story: row.story ?? "", tagline: row.tagline ?? "", categories: row.categories ?? [],
    sellType: row.sell_type ?? "products", countryCode: row.country_code, countryName: row.country_name ?? countryName ?? "",
    city: row.city, accent: row.accent ?? "#496a4d", whatsappNumber: row.whatsapp_number ?? undefined,
    logoUrl: row.logo_url ?? undefined, coverUrl: row.cover_url ?? undefined,
    isVerified: Boolean(row.is_verified),
    isSeed: false };
}

shopsRouter.get("/", async (req, res) => {
  let query = supabase.from("shops").select("*").order("created_at", { ascending: false }).limit(100);
  const country = typeof req.query.country === "string" ? req.query.country.toUpperCase() : "";
  const city = typeof req.query.city === "string" ? req.query.city.trim() : "";
  const category = typeof req.query.category === "string" ? req.query.category : "";
  const type = typeof req.query.type === "string" ? req.query.type : "";
  const term = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (country) query = query.eq("country_code", country);
  if (city) query = query.ilike("city", `%${city}%`);
  if (category) query = query.contains("categories", [category]);
  if (type === "product") query = query.in("sell_type", ["products", "both"]);
  if (type === "service") query = query.in("sell_type", ["services", "both"]);
  if (term) query = query.or(`name.ilike.%${term}%,story.ilike.%${term}%,tagline.ilike.%${term}%`);
  const { data, error } = await query;
  if (error) {
    console.error("Could not search shops:", error.message);
    return res.status(500).json({ message: "Could not load marketplace shops." });
  }
  return res.json(await Promise.all((data ?? []).map((shop) => shopDto(shop))));
});

shopsRouter.get("/mine", async (req, res) => {
  const auth = await authenticatedSeller(req, res); if (!auth) return;
  const { data, error } = await auth.client.from("shops").select("*").eq("owner_id", auth.userId).maybeSingle();
  if (error) { console.error("Could not load seller shop:", error.message); return res.status(500).json({ message: "Could not load your shop." }); }
  if (!data) return res.json(null);
  return res.json(await shopDto(data));
});

shopsRouter.post("/", async (req, res) => {
  const parsed = shopInput.safeParse(req.body);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    const messages: Record<string, string> = {
      name: "Shop name must be between 2 and 60 characters.",
      story: "Shop story must be between 10 and 500 characters.",
      whatsappNumber: "Enter a valid WhatsApp number with its country code.",
      countryCode: "Choose a valid country.",
      countryName: "Refresh the country list and select your country again.",
      currency: "Refresh the country list so the correct currency is selected.",
      categories: "Choose at least one valid shop category."
    };
    return res.status(422).json({ message: messages[String(field)] ?? "Check the shop details and try again." });
  }
  const auth = await authenticatedSeller(req, res); if (!auth) return;
  const { data: country, error: countryError } = await auth.client.from("countries").select("code, name, currency, cities").eq("code", parsed.data.countryCode).eq("enabled", true).maybeSingle();
  if (countryError) { console.error("Could not verify shop country:", countryError.message); return res.status(503).json({ message: "Could not verify the selected country." }); }
  if (!country || country.name !== parsed.data.countryName || country.currency !== parsed.data.currency) return res.status(422).json({ message: "The selected country or currency is no longer available. Refresh and try again." });
  if (Array.isArray(country.cities) && country.cities.length && !country.cities.includes(parsed.data.city)) return res.status(422).json({ message: "Choose a city from the selected country." });
  const { data: existing, error: existingError } = await auth.client.from("shops").select("id").eq("owner_id", auth.userId).maybeSingle();
  if (existingError) { console.error("Could not check existing shop:", existingError.message); return res.status(500).json({ message: "Could not check your existing shop." }); }
  if (existing) return res.status(409).json({ message: "You already have a shop. Open your seller studio to manage it." });
  const { data, error } = await auth.client.from("shops").insert({ owner_id: auth.userId, name: parsed.data.name, story: parsed.data.story,
    tagline: parsed.data.tagline, categories: parsed.data.categories, sell_type: parsed.data.sellType,
    country_code: country.code, city: parsed.data.city, accent: parsed.data.accent,
    whatsapp_number: parsed.data.whatsappNumber, logo_url: parsed.data.logoUrl || null, cover_url: parsed.data.coverUrl || null }).select("*").single();
  if (error) {
    console.error("Could not create shop:", error.message);
    if (error.code === "23505") return res.status(409).json({ message: "You already have a shop. Open your seller studio to manage it." });
    return res.status(500).json({ message: "Could not save your shop. Please try again." });
  }
  return res.status(201).json(await shopDto(data, country.name));
});

shopsRouter.patch("/:id", async (req, res) => {
  const auth = await authenticatedSeller(req, res); if (!auth) return;
  const parsed = shopInput.partial().safeParse(req.body);
  if (!parsed.success || !Object.keys(req.body ?? {}).length) return res.status(422).json({ message: "Check the shop changes and try again." });
  const f = parsed.data; const update: Record<string, unknown> = {};
  if (f.name !== undefined) update.name = f.name;
  if (f.story !== undefined) update.story = f.story;
  if (f.tagline !== undefined) update.tagline = f.tagline;
  if (f.categories !== undefined) update.categories = f.categories;
  if (f.sellType !== undefined) update.sell_type = f.sellType;
  if (f.countryCode !== undefined) update.country_code = f.countryCode;
  if (f.city !== undefined) update.city = f.city;
  if (f.accent !== undefined) update.accent = f.accent;
  if (f.whatsappNumber !== undefined) update.whatsapp_number = f.whatsappNumber;
  if (f.logoUrl !== undefined) update.logo_url = f.logoUrl || null;
  if (f.coverUrl !== undefined) update.cover_url = f.coverUrl || null;
  const { data, error } = await auth.client.from("shops").update(update).eq("id", req.params.id).eq("owner_id", auth.userId).select("*").maybeSingle();
  if (error) { console.error("Could not update shop:", error.message); return res.status(500).json({ message: "Could not update your shop." }); }
  if (!data) return res.status(404).json({ message: "Shop not found." });
  return res.json(await shopDto(data));
});

shopsRouter.get("/:id", async (req, res) => {
  const { data, error } = await supabase.from("shops").select("*").eq("id", req.params.id).maybeSingle();
  if (error) { console.error("Could not load storefront:", error.message); return res.status(500).json({ message: "Could not load this storefront." }); }
  if (!data) return res.status(404).json({ message: "Storefront not found." });
  return res.json(await shopDto(data));
});
