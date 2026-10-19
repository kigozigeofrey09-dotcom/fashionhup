import { Router } from "express";
import { z } from "zod";
import { authenticatedAccount } from "../lib/requestAuth.js";
import { supabase } from "../lib/supabase.js";

export const workflowsRouter = Router();

const enquiryInput = z.object({ listingId: z.string().uuid(), message: z.string().trim().min(10).max(800) });
const orderInput = z.object({ listingId: z.string().uuid(), quantity: z.number().int().min(1).max(99), fulfillment: z.enum(["pickup", "delivery"]), fulfillmentDetails: z.string().trim().min(5).max(500), buyerMessage: z.string().trim().max(800).optional() });
const orderStatuses = ["submitted", "accepted", "ready_for_pickup", "in_delivery", "completed", "cancelled"] as const;
const reportInput = z.object({ listingId: z.string().uuid().optional(), reportedUserId: z.string().uuid().optional(), reason: z.enum(["counterfeit", "spam", "harassment", "misleading", "other"]), details: z.string().trim().max(2000).default("") }).refine((value) => Boolean(value.listingId) !== Boolean(value.reportedUserId));
const reviewInput = z.object({ rating: z.number().int().min(1).max(5), body: z.string().trim().max(2000).default("") });

function enquiryDto(row: any) {
  return { id: row.id, listingId: row.listing_id, buyerId: row.buyer_id, sellerId: row.seller_id, message: row.message,
    reply: row.seller_reply ?? undefined, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at };
}
function orderDto(row: any) {
  return { id: row.id, listingId: row.listing_id, buyerId: row.buyer_id, sellerId: row.seller_id,
    shopId: row.shop_id, quantity: row.quantity, unitPrice: Number(row.unit_price), currency: row.currency,
    fulfillment: row.fulfillment, fulfillmentDetails: row.fulfillment_details, buyerMessage: row.buyer_message,
    status: row.status, createdAt: row.created_at, updatedAt: row.updated_at };
}

workflowsRouter.post("/enquiries", async (req, res) => {
  const parsed = enquiryInput.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ message: "Choose a listing and write a message of at least 10 characters." });
  const account = await authenticatedAccount(req, res); if (!account) return;
  const { data: listing, error: listingError } = await account.client.from("listings").select("id, shop_id, is_active").eq("id", parsed.data.listingId).maybeSingle();
  if (listingError) return res.status(500).json({ message: "Could not verify this listing." });
  if (!listing || !listing.is_active) return res.status(404).json({ message: "This listing is no longer available." });
  const { data: shop, error: shopError } = await account.client.from("shops").select("owner_id").eq("id", listing.shop_id).maybeSingle();
  if (shopError || !shop) return res.status(404).json({ message: "The seller's shop is not available." });
  if (shop.owner_id === account.user.id) return res.status(422).json({ message: "You cannot send an enquiry to your own listing." });
  const { data, error } = await account.client.from("enquiries").insert({ listing_id: listing.id, buyer_id: account.user.id, seller_id: shop.owner_id, message: parsed.data.message }).select("*").single();
  if (error) { console.error("Could not create enquiry:", error.message); return res.status(500).json({ message: "Could not send your enquiry." }); }
  return res.status(201).json(enquiryDto(data));
});

workflowsRouter.post("/reports", async (req, res) => {
  const parsed = reportInput.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ message: "Choose one listing or user and a valid report reason." });
  const account = await authenticatedAccount(req, res); if (!account) return;
  if (parsed.data.reportedUserId === account.user.id) return res.status(422).json({ message: "You cannot report your own account." });
  if (parsed.data.listingId) {
    const { data: listing, error } = await account.client.from("listings").select("id").eq("id", parsed.data.listingId).maybeSingle();
    if (error) return res.status(500).json({ message: "Could not verify the listing you reported." });
    if (!listing) return res.status(404).json({ message: "The listing could not be found." });
  }
  const { data, error } = await account.client.from("reports").insert({ reporter_id: account.user.id, listing_id: parsed.data.listingId ?? null, reported_user_id: parsed.data.reportedUserId ?? null, reason: parsed.data.reason, details: parsed.data.details }).select("id, status, created_at").single();
  if (error) { console.error("Could not submit report:", error.message); return res.status(500).json({ message: "Could not submit your report." }); }
  return res.status(201).json({ id: data.id, status: data.status, createdAt: data.created_at });
});

workflowsRouter.get("/listings/:listingId/reviews", async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.listingId);
  if (!id.success) return res.status(422).json({ message: "Choose a valid listing." });
  const { data, error } = await supabase.from("reviews").select("id, listing_id, buyer_id, seller_id, rating, body, created_at").eq("listing_id", id.data).order("created_at", { ascending: false }).limit(100);
  if (error) { console.error("Could not load listing reviews:", error.message); return res.status(500).json({ message: "Could not load listing reviews." }); }
  return res.json((data ?? []).map((row) => ({ id: row.id, listingId: row.listing_id, buyerId: row.buyer_id, sellerId: row.seller_id, rating: row.rating, body: row.body, createdAt: row.created_at })));
});

workflowsRouter.post("/orders/:id/review", async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);
  const parsed = reviewInput.safeParse(req.body);
  if (!id.success || !parsed.success) return res.status(422).json({ message: "Choose a 1–5 star rating and enter a review of up to 2,000 characters." });
  const account = await authenticatedAccount(req, res); if (!account) return;
  const { data: order, error: orderError } = await account.client.from("orders").select("id, listing_id, seller_id, status, buyer_id").eq("id", id.data).eq("buyer_id", account.user.id).maybeSingle();
  if (orderError) return res.status(500).json({ message: "Could not verify this order." });
  if (!order) return res.status(404).json({ message: "Completed order not found." });
  if (order.status !== "completed") return res.status(422).json({ message: "You can review an order after the seller marks it complete." });
  const { data, error } = await account.client.from("reviews").insert({ order_id: order.id, listing_id: order.listing_id, buyer_id: order.buyer_id, seller_id: order.seller_id, rating: parsed.data.rating, body: parsed.data.body }).select("id, listing_id, buyer_id, seller_id, rating, body, created_at").single();
  if (error) {
    if (error.code === "23505") return res.status(409).json({ message: "You have already reviewed this order." });
    console.error("Could not create review:", error.message);
    return res.status(500).json({ message: "Could not save your review." });
  }
  return res.status(201).json({ id: data.id, listingId: data.listing_id, buyerId: data.buyer_id, sellerId: data.seller_id, rating: data.rating, body: data.body, createdAt: data.created_at });
});

workflowsRouter.get("/account/enquiries", async (req, res) => {
  const account = await authenticatedAccount(req, res); if (!account) return;
  const { data, error } = await account.client.from("enquiries").select("*").eq("buyer_id", account.user.id).order("created_at", { ascending: false }).limit(100);
  if (error) { console.error("Could not load enquiries:", error.message); return res.status(500).json({ message: "Could not load your enquiries." }); }
  return res.json((data ?? []).map(enquiryDto));
});

workflowsRouter.get("/seller/enquiries", async (req, res) => {
  const account = await authenticatedAccount(req, res); if (!account) return;
  const { data: profile, error: profileError } = await account.client.from("profiles").select("role").eq("id", account.user.id).maybeSingle();
  if (profileError || profile?.role !== "seller") return res.status(profileError ? 503 : 403).json({ message: "A seller account is required to view this inbox." });
  const { data, error } = await account.client.from("enquiries").select("*").eq("seller_id", account.user.id).order("created_at", { ascending: false }).limit(100);
  if (error) { console.error("Could not load seller enquiries:", error.message); return res.status(500).json({ message: "Could not load seller enquiries." }); }
  return res.json((data ?? []).map(enquiryDto));
});

workflowsRouter.get("/enquiries/:id/messages", async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) return res.status(422).json({ message: "Choose a valid conversation." });
  const account = await authenticatedAccount(req, res); if (!account) return;
  const { data: conversation, error: conversationError } = await account.client.from("enquiries").select("id, buyer_id, seller_id").eq("id", id.data).maybeSingle();
  if (conversationError) return res.status(500).json({ message: "Could not verify this conversation." });
  if (!conversation) return res.status(404).json({ message: "Conversation not found." });
  const { data, error } = await account.client.from("enquiry_messages").select("id, enquiry_id, sender_id, body, created_at").eq("enquiry_id", id.data).order("created_at", { ascending: true }).limit(500);
  if (error) { console.error("Could not load conversation messages:", error.message); return res.status(500).json({ message: "Could not load conversation messages." }); }
  return res.json((data ?? []).map((row) => ({ id: row.id, enquiryId: row.enquiry_id, senderId: row.sender_id, senderRole: row.sender_id === conversation.buyer_id ? "buyer" : "seller", body: row.body, createdAt: row.created_at })));
});

workflowsRouter.post("/enquiries/:id/messages", async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);
  const input = z.object({ message: z.string().trim().min(1).max(2000) }).safeParse(req.body);
  if (!id.success || !input.success) return res.status(422).json({ message: "Write a message of up to 2,000 characters." });
  const account = await authenticatedAccount(req, res); if (!account) return;
  const { data: conversation, error: conversationError } = await account.client.from("enquiries").select("id, buyer_id, seller_id").eq("id", id.data).maybeSingle();
  if (conversationError) return res.status(500).json({ message: "Could not verify this conversation." });
  if (!conversation) return res.status(404).json({ message: "Conversation not found." });
  const { data, error } = await account.client.from("enquiry_messages").insert({ enquiry_id: id.data, sender_id: account.user.id, body: input.data.message }).select("id, enquiry_id, sender_id, body, created_at").single();
  if (error) { console.error("Could not send conversation message:", error.message); return res.status(500).json({ message: "Could not send your message." }); }
  return res.status(201).json({ id: data.id, enquiryId: data.enquiry_id, senderId: data.sender_id, senderRole: data.sender_id === conversation.buyer_id ? "buyer" : "seller", body: data.body, createdAt: data.created_at });
});

workflowsRouter.post("/seller/enquiries/:id/reply", async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);
  const input = z.object({ message: z.string().trim().min(1).max(800) }).safeParse(req.body);
  if (!id.success || !input.success) return res.status(422).json({ message: "Write a reply of up to 800 characters." });
  const account = await authenticatedAccount(req, res); if (!account) return;
  const { data: enquiry, error: enquiryError } = await account.client.from("enquiries").select("id").eq("id", id.data).eq("seller_id", account.user.id).maybeSingle();
  if (enquiryError) return res.status(500).json({ message: "Could not verify this enquiry." });
  if (!enquiry) return res.status(404).json({ message: "Enquiry not found in your seller inbox." });
  const { error } = await account.client.from("enquiry_messages").insert({ enquiry_id: id.data, sender_id: account.user.id, body: input.data.message });
  if (error) { console.error("Could not reply to enquiry:", error.message); return res.status(500).json({ message: "Could not send your reply." }); }
  const { data, error: loadError } = await account.client.from("enquiries").select("*").eq("id", id.data).single();
  if (loadError) return res.status(500).json({ message: "Your message was sent, but the conversation could not refresh." });
  return res.json(enquiryDto(data));
});

workflowsRouter.post("/orders", async (req, res) => {
  const parsed = orderInput.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ message: "Check the listing, quantity, fulfillment choice, and details." });
  const account = await authenticatedAccount(req, res); if (!account) return;
  const { data: listing, error: listingError } = await account.client.from("listings").select("id, shop_id, price, currency, is_active").eq("id", parsed.data.listingId).maybeSingle();
  if (listingError) return res.status(500).json({ message: "Could not verify this listing." });
  if (!listing || !listing.is_active) return res.status(404).json({ message: "This listing is no longer available." });
  const { data: shop, error: shopError } = await account.client.from("shops").select("id, owner_id").eq("id", listing.shop_id).maybeSingle();
  if (shopError || !shop) return res.status(404).json({ message: "The seller's shop is not available." });
  if (shop.owner_id === account.user.id) return res.status(422).json({ message: "You cannot order from your own listing." });
  const { data, error } = await account.client.from("orders").insert({
    buyer_id: account.user.id, seller_id: shop.owner_id, shop_id: shop.id, listing_id: listing.id,
    quantity: parsed.data.quantity, unit_price: listing.price, currency: listing.currency,
    fulfillment: parsed.data.fulfillment, fulfillment_details: parsed.data.fulfillmentDetails,
    buyer_message: parsed.data.buyerMessage ?? "", status: "submitted"
  }).select("*").single();
  if (error) { console.error("Could not create order request:", error.message); return res.status(500).json({ message: "Could not submit your order request." }); }
  return res.status(201).json(orderDto(data));
});

workflowsRouter.get("/account/orders", async (req, res) => {
  const account = await authenticatedAccount(req, res); if (!account) return;
  const { data, error } = await account.client.from("orders").select("*").eq("buyer_id", account.user.id).order("created_at", { ascending: false }).limit(100);
  if (error) { console.error("Could not load orders:", error.message); return res.status(500).json({ message: "Could not load your orders." }); }
  return res.json((data ?? []).map(orderDto));
});

workflowsRouter.get("/seller/orders", async (req, res) => {
  const account = await authenticatedAccount(req, res); if (!account) return;
  const { data: profile, error: profileError } = await account.client.from("profiles").select("role").eq("id", account.user.id).maybeSingle();
  if (profileError || profile?.role !== "seller") return res.status(profileError ? 503 : 403).json({ message: "A seller account is required to view orders." });
  const { data, error } = await account.client.from("orders").select("*").eq("seller_id", account.user.id).order("created_at", { ascending: false }).limit(100);
  if (error) { console.error("Could not load seller orders:", error.message); return res.status(500).json({ message: "Could not load seller orders." }); }
  return res.json((data ?? []).map(orderDto));
});

async function updateOrderStatus(req: any, res: any, status: string) {
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success || !orderStatuses.includes(status as typeof orderStatuses[number])) return res.status(422).json({ message: "Choose a valid order status." });
  const account = await authenticatedAccount(req, res); if (!account) return;
  const { data, error } = await account.client.rpc("fashionhub_update_order_status", { p_order_id: id.data, p_status: status });
  if (error) {
    const statusCode = error.code === "42501" ? 403 : error.code === "P0002" ? 404 : error.code === "22023" ? 422 : 500;
    return res.status(statusCode).json({ message: error.message || "Could not update the order status." });
  }
  return res.json(orderDto(Array.isArray(data) ? data[0] : data));
}

workflowsRouter.patch("/orders/:id/status", async (req, res) => {
  const status = z.object({ status: z.enum(orderStatuses) }).safeParse(req.body);
  if (!status.success) return res.status(422).json({ message: "Choose a valid order status." });
  return updateOrderStatus(req, res, status.data.status);
});
workflowsRouter.post("/seller/orders/:id/pickup-ready", async (req, res) => updateOrderStatus(req, res, "ready_for_pickup"));
workflowsRouter.post("/seller/orders/:id/delivery", async (req, res) => updateOrderStatus(req, res, "in_delivery"));
