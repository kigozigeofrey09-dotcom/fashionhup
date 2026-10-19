import { Router } from "express";
import { z } from "zod";
import { createAuthenticatedSupabase, supabase } from "../lib/supabase.js";

export const listingsRouter = Router();
const accessCookie = "fh_access";
const refreshCookie = "fh_refresh";
const isProduction = process.env.NODE_ENV === "production";
const sessionCookieOptions = { httpOnly: true, secure: isProduction, sameSite: "lax" as const, path: "/" };
const categories = ["Clothing", "Shoes", "Bags", "Jewellery", "Beauty", "Tailoring", "Accessories", "Other"] as const;
const imageReference = z.string().trim().max(2048).refine((value) => {
  if (/^\/api\/uploads\/images\/[a-f0-9-]+\.(jpg|png|webp|avif)$/i.test(value)) return true;
  try { const parsed = new URL(value); return parsed.protocol === "https:" || parsed.protocol === "http:"; }
  catch { return false; }
}, "Enter a valid image URL.");
const listingInput = z.object({
  shopId: z.string().uuid(),
  name: z.string().trim().min(2).max(80),
  category: z.enum(categories),
  type: z.enum(["product", "service"]),
  description: z.string().trim().min(5).max(800),
  price: z.number().positive().max(100000000000),
  sizes: z.string().trim().max(100).optional(),
  colour: z.string().trim().max(80).optional(),
  serviceDetails: z.string().trim().max(500).optional(),
  enquiryLabel: z.string().trim().max(80).optional(),
  isActive: z.boolean().optional(),
  imageUrl: imageReference.optional().or(z.literal("")),
  imageUrls: z.array(imageReference).max(5).optional()
});

function readCookie(req: any, name: string) {
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const separator = part.indexOf("=");
    if (separator >= 0 && part.slice(0, separator).trim() === name) {
      try { return decodeURIComponent(part.slice(separator + 1).trim()); }
      catch { return undefined; }
    }
  }
  return undefined;
}

async function sellerClient(req: any, res: any) {
  let token = readCookie(req, accessCookie);
  const refreshToken = readCookie(req, refreshCookie);
  let auth = token ? await supabase.auth.getUser(token) : null;

  // Listing creation can happen after the short-lived access cookie expires.
  // Refresh it from the existing HttpOnly cookie before rejecting the seller.
  if ((!auth || auth.error || !auth.data.user) && refreshToken) {
    const refreshed = await supabase.auth.refreshSession({ refresh_token: refreshToken });
    if (!refreshed.error && refreshed.data.session && refreshed.data.user) {
      token = refreshed.data.session.access_token;
      auth = { data: { user: refreshed.data.user }, error: null } as typeof auth;
      res.cookie(accessCookie, refreshed.data.session.access_token, {
        ...sessionCookieOptions,
        maxAge: Math.max(60, refreshed.data.session.expires_in ?? 3600) * 1000
      });
      res.cookie(refreshCookie, refreshed.data.session.refresh_token, {
        ...sessionCookieOptions,
        maxAge: 30 * 24 * 60 * 60 * 1000
      });
    }
  }
  if (!token || !auth || auth.error || !auth.data.user) {
    res.status(401).json({ message: "Your session expired. Sign in again, then retry creating the listing." });
    return null;
  }
  const client = createAuthenticatedSupabase(token);
  const { data: profile, error: profileError } = await client.from("profiles").select("role").eq("id", auth.data.user.id).maybeSingle();
  if (profileError) { res.status(503).json({ message: "Could not verify your seller account." }); return null; }
  if (profile?.role !== "seller") { res.status(403).json({ message: "A seller account is required to manage listings." }); return null; }
  return { client, userId: auth.data.user.id };
}

function listingInsertErrorMessage(error: { code?: string; message: string }) {
  if (error.code === "42501") return "Supabase denied the listing insert. Apply the seller listing policies in migration 202610100002_live_marketplace_search.sql, then try again.";
  if (error.code === "23502") return `The database still requires a legacy listing field (${error.message}). Apply migration 202610110005_listing_legacy_compat.sql.`;
  if (error.code === "42703" || error.code === "PGRST204") return `The listings table is missing a field (${error.message}). Re-run migrations 202610100002_live_marketplace_search.sql and 202610110005_listing_legacy_compat.sql.`;
  if (error.code === "23503") return `The listing's shop reference was rejected (${error.message}). Refresh seller setup and apply migration 202610110005_listing_legacy_compat.sql.`;
  if (error.code === "23514") return `The database rejected a listing value (${error.message}). Check the listing type and category constraints.`;
  return `Could not create the listing: ${error.message}`;
}

export async function hydrateListings(rows: any[]) {
  if (!rows.length) return [];
  const shopIds = [...new Set(rows.map((row) => row.shop_id))];
  const { data: shops, error: shopsError } = await supabase.from("shops").select("*").in("id", shopIds);
  if (shopsError) throw shopsError;
  const shopsById = new Map((shops ?? []).map((shop) => [shop.id, shop]));
  const visibleShops = (shops ?? []).filter((shop) => rows.some((row) => row.shop_id === shop.id));
  const countryCodes = [...new Set(visibleShops.map((shop) => shop.country_code))];
  const listingIds = rows.map((row) => row.id);
  const [countriesResult, photosResult] = await Promise.all([
    supabase.from("countries").select("code, name, currency").in("code", countryCodes),
    supabase.from("listing_media").select("listing_id, url, position").in("listing_id", listingIds).order("position", { ascending: true })
  ]);
  if (countriesResult.error) throw countriesResult.error;
  if (photosResult.error) throw photosResult.error;
  const countriesByCode = new Map((countriesResult.data ?? []).map((country) => [country.code, country]));
  return rows.map((row) => {
    const shop = shopsById.get(row.shop_id);
    if (!shop) return null;
    return listingDto(row, shop, countriesByCode.get(shop.country_code), photosResult.data ?? []);
  }).filter(Boolean);
}

function listingDto(row: any, shop: any, country: any, photos: any[]) {
  const gallery = photos.filter((photo) => photo.listing_id === row.id).sort((a, b) => a.position - b.position);
  return {
    id: row.id,
    shopId: shop.id,
    shopName: shop.name,
    name: row.name,
    category: row.category,
    type: row.type,
    description: row.description ?? "",
    price: Number(row.price),
    currency: country?.currency ?? "UGX",
    countryCode: shop.country_code,
    countryName: shop.country_name ?? country?.name ?? "",
    city: shop.city,
    image: gallery[0]?.url ?? row.image_url ?? "",
    images: gallery.map((photo) => photo.url),
    sizes: row.sizes ?? undefined,
    colour: row.colour ?? undefined,
    serviceDetails: row.service_details ?? undefined,
    enquiryLabel: row.enquiry_label ?? undefined,
    sellerWhatsapp: shop.whatsapp_number ?? undefined,
    isActive: row.is_active,
    isSeed: false
  };
}

listingsRouter.get("/", async (req, res) => {
  const country = typeof req.query.country === "string" ? req.query.country.toUpperCase() : "";
  const city = typeof req.query.city === "string" ? req.query.city.trim() : "";
  const category = typeof req.query.category === "string" ? req.query.category : "";
  const type = typeof req.query.type === "string" ? req.query.type : "";
  const shopId = typeof req.query.shopId === "string" ? req.query.shopId : "";
  const term = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const sort = typeof req.query.sort === "string" ? req.query.sort : "";
  let query = supabase.from("listings").select("*").eq("is_active", true)
    .order(sort === "price-asc" ? "price" : "created_at", { ascending: sort === "price-asc" }).limit(200);
  if (category) query = query.eq("category", category);
  if (type === "product" || type === "service") query = query.eq("type", type);
  if (shopId) query = query.eq("shop_id", shopId);
  if (term) query = query.or(`name.ilike.%${term}%,description.ilike.%${term}%`);

  const { data: rows, error } = await query;
  if (error) {
    console.error("Could not search listings:", error.message);
    return res.status(500).json({ message: "Could not load marketplace listings." });
  }
  if (!rows?.length) return res.json([]);

  const visibleShopsResult = await supabase.from("shops").select("id, country_code, city").in("id", [...new Set(rows.map((row) => row.shop_id))]);
  if (visibleShopsResult.error) return res.status(500).json({ message: "Could not load marketplace listings." });
  const visibleShops = (visibleShopsResult.data ?? []).filter((shop) => (!country || shop.country_code === country) && (!city || String(shop.city).toLowerCase().includes(city.toLowerCase())));
  const visibleIds = new Set(visibleShops.map((shop) => shop.id));
  const visibleRows = rows.filter((row) => visibleIds.has(row.shop_id));
  if (!visibleRows.length) return res.json([]);
  try { return res.json(await hydrateListings(visibleRows)); }
  catch (error) { console.error("Could not load listing details:", error); return res.status(500).json({ message: "Could not load marketplace listing details." }); }
});

listingsRouter.get("/mine", async (req, res) => {
  const seller = await sellerClient(req, res); if (!seller) return;
  const { data: shop, error: shopError } = await seller.client.from("shops").select("id").eq("owner_id", seller.userId).maybeSingle();
  if (shopError) return res.status(500).json({ message: "Could not load your shop." });
  if (!shop) return res.json([]);
  const { data, error } = await seller.client.from("listings").select("*").eq("shop_id", shop.id).order("created_at", { ascending: false });
  if (error) return res.status(500).json({ message: "Could not load your listings." });
  try { return res.json(await hydrateListings(data ?? [])); }
  catch (caught) { console.error("Could not load seller listing details:", caught); return res.status(500).json({ message: "Could not load your listing details." }); }
});

listingsRouter.post("/", async (req, res) => {
  const parsed = listingInput.safeParse(req.body);
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "");
    const messages: Record<string, string> = {
      shopId: "Your saved shop could not be matched. Refresh setup and try again.",
      name: "Listing name must be between 2 and 80 characters.",
      category: "Choose a supported listing category.",
      type: "Choose whether this listing is a product or service.",
      description: "Description must be between 5 and 800 characters.",
      price: "Enter a positive price up to 100 billion.",
      sizes: "Sizes must be no longer than 100 characters.",
      colour: "Colour or finish must be no longer than 80 characters.",
      imageUrl: "Enter a valid photo URL.",
      imageUrls: "Upload no more than 5 valid listing photos."
    };
    return res.status(422).json({ message: messages[field] ?? "Check the listing details and try again." });
  }
  const seller = await sellerClient(req, res); if (!seller) return;
  const { data: shop, error: shopError } = await seller.client.from("shops").select("*").eq("id", parsed.data.shopId).eq("owner_id", seller.userId).maybeSingle();
  if (shopError) return res.status(500).json({ message: "Could not verify your shop." });
  if (!shop) return res.status(403).json({ message: "You can only publish listings in your own shop." });
  const { data, error } = await seller.client.from("listings").insert({
    shop_id: shop.id, name: parsed.data.name, category: parsed.data.category, type: parsed.data.type,
    description: parsed.data.description, price: parsed.data.price, sizes: parsed.data.sizes || null,
    colour: parsed.data.colour || null, service_details: parsed.data.serviceDetails || null,
    enquiry_label: parsed.data.enquiryLabel || null, image_url: parsed.data.imageUrls?.[0] || parsed.data.imageUrl || "", is_active: true
  }).select("*").single();
  if (error) {
    console.error("Could not create listing:", { code: error.code, message: error.message, details: error.details, hint: error.hint });
    return res.status(error.code === "42501" ? 403 : 500).json({ message: listingInsertErrorMessage(error) });
  }
  const urls = parsed.data.imageUrls ?? (parsed.data.imageUrl ? [parsed.data.imageUrl] : []);
  let photos: any[] = [];
  if (urls.length) {
    const media = await seller.client.from("listing_media").insert(urls.map((url, position) => ({ listing_id: data.id, url, position }))).select("listing_id, url, position");
    if (media.error) console.error("Listing saved without its full photo gallery:", media.error.message);
    else photos = media.data ?? [];
  }
  const { data: country } = await supabase.from("countries").select("code, name, currency").eq("code", shop.country_code).maybeSingle();
  return res.status(201).json(listingDto(data, shop, country, photos));
});

listingsRouter.patch("/:id", async (req, res) => {
  const parsed = listingInput.partial().omit({ shopId: true }).safeParse(req.body);
  if (!parsed.success || !Object.keys(req.body ?? {}).length) return res.status(422).json({ message: "Check the listing changes and try again." });
  const seller = await sellerClient(req, res); if (!seller) return;
  const { data: current, error: currentError } = await seller.client.from("listings").select("*").eq("id", req.params.id).maybeSingle();
  if (currentError) return res.status(500).json({ message: "Could not load the listing." });
  if (!current) return res.status(404).json({ message: "Listing not found." });
  const { data: shop } = await seller.client.from("shops").select("*").eq("id", current.shop_id).eq("owner_id", seller.userId).maybeSingle();
  if (!shop) return res.status(403).json({ message: "You can only edit listings in your own shop." });
  const f = parsed.data; const update: Record<string, unknown> = {};
  if (f.name !== undefined) update.name = f.name;
  if (f.category !== undefined) update.category = f.category;
  if (f.type !== undefined) update.type = f.type;
  if (f.description !== undefined) update.description = f.description;
  if (f.price !== undefined) update.price = f.price;
  if (f.sizes !== undefined) update.sizes = f.sizes;
  if (f.colour !== undefined) update.colour = f.colour;
  if (f.serviceDetails !== undefined) update.service_details = f.serviceDetails;
  if (f.enquiryLabel !== undefined) update.enquiry_label = f.enquiryLabel;
  if (f.isActive !== undefined) update.is_active = f.isActive;
  if (f.imageUrl !== undefined) update.image_url = f.imageUrl;
  const { data, error } = await seller.client.from("listings").update(update).eq("id", current.id).select("*").single();
  if (error) return res.status(500).json({ message: "Could not update the listing." });
  const { data: country } = await supabase.from("countries").select("code, name, currency").eq("code", shop.country_code).maybeSingle();
  return res.json(listingDto(data, shop, country, []));
});

listingsRouter.delete("/:id", async (req, res) => {
  const seller = await sellerClient(req, res); if (!seller) return;
  const { data: current, error: currentError } = await seller.client.from("listings").select("id, shop_id").eq("id", req.params.id).maybeSingle();
  if (currentError) return res.status(500).json({ message: "Could not load the listing." });
  if (!current) return res.status(404).json({ message: "Listing not found." });
  const { data: shop } = await seller.client.from("shops").select("id").eq("id", current.shop_id).eq("owner_id", seller.userId).maybeSingle();
  if (!shop) return res.status(403).json({ message: "You can only remove listings from your own shop." });
  const { error } = await seller.client.from("listings").delete().eq("id", current.id);
  if (error) return res.status(500).json({ message: "Could not remove the listing." });
  return res.status(204).end();
});

listingsRouter.get("/:id", async (req, res) => {
  const { data: row, error } = await supabase.from("listings").select("*").eq("id", req.params.id).eq("is_active", true).maybeSingle();
  if (error) {
    console.error("Could not load listing:", error.message);
    return res.status(500).json({ message: "Could not load this listing." });
  }
  if (!row) return res.status(404).json({ message: "Listing not found." });
  const { data: shop, error: shopError } = await supabase.from("shops").select("*").eq("id", row.shop_id).maybeSingle();
  if (shopError || !shop) return res.status(404).json({ message: "Listing storefront not found." });
  const [countryResult, photosResult] = await Promise.all([
    supabase.from("countries").select("code, name, currency").eq("code", shop.country_code).maybeSingle(),
    supabase.from("listing_media").select("listing_id, url, position").eq("listing_id", row.id).order("position", { ascending: true })
  ]);
  if (countryResult.error || photosResult.error) return res.status(500).json({ message: "Could not load listing details." });
  return res.json(listingDto(row, shop, countryResult.data, photosResult.data ?? []));
});
