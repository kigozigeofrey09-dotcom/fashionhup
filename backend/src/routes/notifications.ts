import { Router } from "express";
import { z } from "zod";
import { authenticatedAccount } from "../lib/requestAuth.js";

export const notificationsRouter = Router();

function notificationDto(row: any) {
  return { id: row.id, title: row.title, message: row.message, kind: row.kind, href: row.href ?? undefined,
    readAt: row.read_at ?? undefined, createdAt: row.created_at };
}

notificationsRouter.get("/", async (req, res) => {
  const account = await authenticatedAccount(req, res); if (!account) return;
  const { data, error } = await account.client.from("notifications").select("*").eq("user_id", account.user.id).order("created_at", { ascending: false }).limit(100);
  if (error) { console.error("Could not load notifications:", error.message); return res.status(500).json({ message: "Could not load your notifications." }); }
  return res.json((data ?? []).map(notificationDto));
});

notificationsRouter.get("/unread-count", async (req, res) => {
  const account = await authenticatedAccount(req, res); if (!account) return;
  const { count, error } = await account.client.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", account.user.id).is("read_at", null);
  if (error) { console.error("Could not count notifications:", error.message); return res.status(500).json({ message: "Could not load your unread notification count." }); }
  return res.json({ unread: count ?? 0 });
});

notificationsRouter.post("/read-all", async (req, res) => {
  const account = await authenticatedAccount(req, res); if (!account) return;
  const { error } = await account.client.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", account.user.id).is("read_at", null);
  if (error) { console.error("Could not mark notifications read:", error.message); return res.status(500).json({ message: "Could not mark notifications as read." }); }
  return res.status(204).end();
});

notificationsRouter.post("/:id/read", async (req, res) => {
  const account = await authenticatedAccount(req, res); if (!account) return;
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) return res.status(422).json({ message: "Choose a valid notification." });
  const { data, error } = await account.client.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id.data).eq("user_id", account.user.id).select("*").maybeSingle();
  if (error) { console.error("Could not mark notification read:", error.message); return res.status(500).json({ message: "Could not update this notification." }); }
  if (!data) return res.status(404).json({ message: "Notification not found." });
  return res.json(notificationDto(data));
});
