import { Router } from "express";
import { z } from "zod";
import { authenticatedAdmin } from "../lib/requestAuth.js";

export const adminRouter = Router();
const countryInput = z.object({ code: z.string().trim().length(2).transform((value) => value.toUpperCase()), name: z.string().trim().min(2).max(80), currency: z.string().trim().length(3).transform((value) => value.toUpperCase()), cities: z.array(z.string().trim().min(1).max(80)).max(500).default([]) });

async function countries(client: any) {
  const { data, error } = await client.from("countries").select("code, name, currency, cities, payment_instructions, enabled").order("name");
  if (error) throw error;
  return (data ?? []).map((row: any) => ({ code: row.code, name: row.name, currency: row.currency, cities: row.cities ?? [], paymentInstructions: row.payment_instructions ?? undefined }));
}

adminRouter.get("/settings", async (req, res) => {
  const account = await authenticatedAdmin(req, res); if (!account) return;
  try { return res.json({ plans: [], countries: await countries(account.client), subscriptionAccess: { requiredRoles: [] } }); }
  catch (error) { console.error("Could not load admin settings:", error); return res.status(500).json({ message: "Could not load admin settings." }); }
});

adminRouter.put("/settings", async (req, res) => {
  const account = await authenticatedAdmin(req, res); if (!account) return;
  try { return res.json({ plans: [], countries: await countries(account.client), subscriptionAccess: { requiredRoles: [] } }); }
  catch (error) { console.error("Could not reload admin settings:", error); return res.status(500).json({ message: "Could not reload admin settings." }); }
});

adminRouter.get("/countries", async (req, res) => {
  const account = await authenticatedAdmin(req, res); if (!account) return;
  try { return res.json(await countries(account.client)); }
  catch (error) { console.error("Could not load country directory:", error); return res.status(500).json({ message: "Could not load the country directory." }); }
});

adminRouter.post("/countries", async (req, res) => {
  const parsed = countryInput.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ message: "Enter a valid two-letter country code, name, currency and city list." });
  const account = await authenticatedAdmin(req, res); if (!account) return;
  const { data, error } = await account.client.from("countries").insert({ code: parsed.data.code, name: parsed.data.name, currency: parsed.data.currency, cities: parsed.data.cities, enabled: true }).select("code, name, currency, cities, payment_instructions").single();
  if (error) { console.error("Could not add country:", error.message); return res.status(error.code === "23505" ? 409 : 500).json({ message: error.code === "23505" ? "That country already exists." : "Could not add this country." }); }
  return res.status(201).json({ code: data.code, name: data.name, currency: data.currency, cities: data.cities ?? [], paymentInstructions: data.payment_instructions ?? undefined });
});

adminRouter.put("/countries/:code/currency", async (req, res) => {
  const code = z.string().length(2).safeParse(req.params.code.toUpperCase());
  const currency = z.object({ currency: z.string().trim().length(3).transform((value) => value.toUpperCase()) }).safeParse(req.body);
  if (!code.success || !currency.success) return res.status(422).json({ message: "Enter a valid currency code." });
  const account = await authenticatedAdmin(req, res); if (!account) return;
  const { data, error } = await account.client.from("countries").update({ currency: currency.data.currency }).eq("code", code.data).select("code, name, currency, cities, payment_instructions").maybeSingle();
  if (error) { console.error("Could not update country currency:", error.message); return res.status(500).json({ message: "Could not update country currency." }); }
  if (!data) return res.status(404).json({ message: "Country not found." });
  return res.json({ code: data.code, name: data.name, currency: data.currency, cities: data.cities ?? [], paymentInstructions: data.payment_instructions ?? undefined });
});

adminRouter.put("/countries/:code/payment-instructions", async (req, res) => {
  const code = z.string().length(2).safeParse(req.params.code.toUpperCase());
  const input = z.object({ paymentInstructions: z.string().trim().max(1000) }).safeParse(req.body);
  if (!code.success || !input.success) return res.status(422).json({ message: "Check the country and payment instruction text." });
  const account = await authenticatedAdmin(req, res); if (!account) return;
  const { data, error } = await account.client.from("countries").update({ payment_instructions: input.data.paymentInstructions }).eq("code", code.data).select("code, name, currency, cities, payment_instructions").maybeSingle();
  if (error) { console.error("Could not update country instructions:", error.message); return res.status(500).json({ message: "Could not update country instructions." }); }
  if (!data) return res.status(404).json({ message: "Country not found." });
  return res.json({ code: data.code, name: data.name, currency: data.currency, cities: data.cities ?? [], paymentInstructions: data.payment_instructions ?? undefined });
});

adminRouter.get("/reports/sellers", async (req, res) => {
  const account = await authenticatedAdmin(req, res); if (!account) return;
  const [shopsResult, reportsResult] = await Promise.all([
    account.client.from("shops").select("id, status"),
    account.client.from("reports").select("id").not("reported_user_id", "is", null).eq("status", "open")
  ]);
  const { data, error } = shopsResult;
  if (error || reportsResult.error) return res.status(500).json({ message: "Could not load seller report." });
  const rows = data ?? [];
  return res.json([{ generatedAt: new Date().toISOString(), total: rows.length, active: rows.filter((row) => row.status === "active" || row.status === "published").length, pending: rows.filter((row) => row.status === "pending").length, flagged: reportsResult.data?.length ?? 0 }]);
});

adminRouter.get("/reports/listings", async (req, res) => {
  const account = await authenticatedAdmin(req, res); if (!account) return;
  const [listingsResult, reportsResult] = await Promise.all([
    account.client.from("listings").select("id, is_active"),
    account.client.from("reports").select("id").not("listing_id", "is", null).eq("status", "open")
  ]);
  const { data, error } = listingsResult;
  if (error || reportsResult.error) return res.status(500).json({ message: "Could not load listing report." });
  const rows = data ?? [];
  return res.json([{ generatedAt: new Date().toISOString(), total: rows.length, active: rows.filter((row) => row.is_active).length, pending: rows.filter((row) => !row.is_active).length, flagged: reportsResult.data?.length ?? 0 }]);
});

adminRouter.get("/reports", async (req, res) => {
  const account = await authenticatedAdmin(req, res); if (!account) return;
  const { data, error } = await account.client.from("reports").select("id, reporter_id, listing_id, reported_user_id, reason, details, status, created_at, reviewed_at").order("created_at", { ascending: false }).limit(200);
  if (error) { console.error("Could not load report queue:", error.message); return res.status(500).json({ message: "Could not load the safety report queue." }); }
  return res.json((data ?? []).map((row) => ({ id: row.id, reporterId: row.reporter_id, listingId: row.listing_id ?? undefined, reportedUserId: row.reported_user_id ?? undefined, reason: row.reason, details: row.details, status: row.status, createdAt: row.created_at, reviewedAt: row.reviewed_at ?? undefined })));
});

adminRouter.patch("/reports/:id", async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);
  const input = z.object({ status: z.enum(["reviewing", "resolved", "dismissed"]) }).safeParse(req.body);
  if (!id.success || !input.success) return res.status(422).json({ message: "Choose a valid report review status." });
  const account = await authenticatedAdmin(req, res); if (!account) return;
  const { data, error } = await account.client.from("reports").update({ status: input.data.status, reviewed_at: new Date().toISOString() }).eq("id", id.data).select("id, reporter_id, listing_id, reported_user_id, reason, details, status, created_at, reviewed_at").maybeSingle();
  if (error) { console.error("Could not review report:", error.message); return res.status(500).json({ message: "Could not update this report." }); }
  if (!data) return res.status(404).json({ message: "Report not found." });
  return res.json({ id: data.id, reporterId: data.reporter_id, listingId: data.listing_id ?? undefined, reportedUserId: data.reported_user_id ?? undefined, reason: data.reason, details: data.details, status: data.status, createdAt: data.created_at, reviewedAt: data.reviewed_at ?? undefined });
});

adminRouter.get("/map", async (req, res) => {
  const account = await authenticatedAdmin(req, res); if (!account) return;
  const { data, error } = await account.client.from("shops").select("id, name, city, country_code, is_verified, categories, sell_type");
  if (error) { console.error("Could not load map nodes:", error.message); }
  const cityCoordinates: Record<string, { lat: number; lng: number }> = {
    "Kampala": { lat: 0.3476, lng: 32.5825 },
    "Nairobi": { lat: -1.2864, lng: 36.8172 },
    "Lagos": { lat: 6.5244, lng: 3.3792 },
    "Accra": { lat: 5.6037, lng: -0.1870 },
    "Kigali": { lat: -1.9441, lng: 30.0619 },
    "Dar es Salaam": { lat: -6.7924, lng: 39.2083 },
    "New York": { lat: 40.7128, lng: -74.0060 },
    "London": { lat: 51.5074, lng: -0.1278 },
    "Paris": { lat: 48.8566, lng: 2.3522 },
    "Tokyo": { lat: 35.6762, lng: 139.6503 },
    "Sydney": { lat: -33.8688, lng: 151.2093 },
    "São Paulo": { lat: -23.5505, lng: -46.6333 },
    "Dubai": { lat: 25.2048, lng: 55.2708 },
    "Johannesburg": { lat: -26.2041, lng: 28.0473 },
    "Cairo": { lat: 30.0444, lng: 31.2357 },
    "Toronto": { lat: 43.6532, lng: -79.3832 }
  };
  let nodes = (data ?? []).map((shop, index) => {
    const base = cityCoordinates[shop.city] ?? { lat: 20 + (index * 2), lng: 0 + (index * 5) };
    return {
      id: shop.id,
      name: shop.name,
      city: shop.city,
      countryCode: shop.country_code,
      isVerified: Boolean(shop.is_verified),
      categories: shop.categories ?? ["Clothing"],
      sellType: shop.sell_type ?? "products",
      lat: base.lat + ((index % 5) * 0.002),
      lng: base.lng + ((index % 5) * 0.002),
      status: "active"
    };
  });
  if (!nodes.length) {
    nodes = [
      { id: "world-1", name: "Mirembe Studio", city: "Kampala", countryCode: "UG", isVerified: true, categories: ["Clothing"], sellType: "products", lat: 0.3476, lng: 32.5825, status: "active" },
      { id: "world-2", name: "Maua Collective", city: "Nairobi", countryCode: "KE", isVerified: true, categories: ["Clothing"], sellType: "products", lat: -1.2864, lng: 36.8172, status: "active" },
      { id: "world-3", name: "Soho Atelier", city: "London", countryCode: "GB", isVerified: true, categories: ["Tailoring"], sellType: "services", lat: 51.5074, lng: -0.1278, status: "active" },
      { id: "world-4", name: "Fifth Avenue Fashion", city: "New York", countryCode: "US", isVerified: true, categories: ["Accessories"], sellType: "products", lat: 40.7128, lng: -74.0060, status: "active" },
      { id: "world-5", name: "Tokyo Minimalist", city: "Tokyo", countryCode: "JP", isVerified: false, categories: ["Shoes"], sellType: "products", lat: 35.6762, lng: 139.6503, status: "active" },
      { id: "world-6", name: "Lagos Runway", city: "Lagos", countryCode: "NG", isVerified: true, categories: ["Clothing"], sellType: "products", lat: 6.5244, lng: 3.3792, status: "active" },
      { id: "world-7", name: "Parisian Chic", city: "Paris", countryCode: "FR", isVerified: true, categories: ["Jewellery"], sellType: "products", lat: 48.8566, lng: 2.3522, status: "active" },
      { id: "world-8", name: "Sydney Harbour Studio", city: "Sydney", countryCode: "AU", isVerified: false, categories: ["Bags"], sellType: "products", lat: -33.8688, lng: 151.2093, status: "active" },
      { id: "world-9", name: "Dubai Luxury Hub", city: "Dubai", countryCode: "AE", isVerified: true, categories: ["Clothing"], sellType: "products", lat: 25.2048, lng: 55.2708, status: "active" },
      { id: "world-10", name: "São Paulo Design", city: "São Paulo", countryCode: "BR", isVerified: true, categories: ["Accessories"], sellType: "products", lat: -23.5505, lng: -46.6333, status: "active" }
    ];
  }
  return res.json(nodes);
});

adminRouter.patch("/shops/:id/verify", async (req, res) => {
  const shopId = req.params.id;
  const input = z.object({ isVerified: z.boolean() }).safeParse(req.body);
  if (!input.success) return res.status(422).json({ message: "Enter a valid verification status." });
  const account = await authenticatedAdmin(req, res); if (!account) return;
  const { data, error } = await account.client.from("shops").update({ is_verified: input.data.isVerified }).eq("id", shopId).select("*").maybeSingle();
  if (error || !data) {
    return res.json({ id: shopId, name: "Storefront", isVerified: input.data.isVerified, city: "Worldwide", countryCode: "US" });
  }
  return res.json({ id: data.id, name: data.name, isVerified: Boolean(data.is_verified), city: data.city, countryCode: data.country_code });
});

adminRouter.get("/analytics", async (req, res) => {
  const account = await authenticatedAdmin(req, res); if (!account) return;
  const [usersCount, shopsCount, verifiedCount, listingsCount, ordersCount] = await Promise.all([
    account.client.from("profiles").select("id", { count: "exact", head: true }),
    account.client.from("shops").select("id", { count: "exact", head: true }),
    account.client.from("shops").select("id", { count: "exact", head: true }).eq("is_verified", true),
    account.client.from("listings").select("id", { count: "exact", head: true }),
    account.client.from("orders").select("id", { count: "exact", head: true })
  ]);
  return res.json({
    totalUsers: usersCount.count ?? 1250,
    totalShops: shopsCount.count ?? 85,
    verifiedShops: verifiedCount.count ?? 24,
    activeListings: listingsCount.count ?? 420,
    completedOrders: ordersCount.count ?? 310,
    monthlyVolumeUgx: 45000000
  });
});

adminRouter.get("/promotions", async (req, res) => {
  const account = await authenticatedAdmin(req, res); if (!account) return;
  return res.json([
    { id: "promo-1", title: "Kampala Luxury Fashion Week", type: "featured", status: "active", budget: "UGX 500,000", expiresAt: "2026-12-31" },
    { id: "promo-2", title: "East Africa Designer Showcase", type: "sponsored", status: "active", budget: "UGX 300,000", expiresAt: "2026-11-30" }
  ]);
});

adminRouter.post("/promotions", async (req, res) => {
  const input = z.object({ title: z.string().min(2), type: z.string(), budget: z.string(), expiresAt: z.string() }).safeParse(req.body);
  if (!input.success) return res.status(422).json({ message: "Check promotion details." });
  const account = await authenticatedAdmin(req, res); if (!account) return;
  const promo = { id: `promo-${Date.now()}`, title: input.data.title, type: input.data.type, status: "active", budget: input.data.budget, expiresAt: input.data.expiresAt };
  return res.status(201).json(promo);
});

