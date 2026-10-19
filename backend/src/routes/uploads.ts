import { randomUUID } from "node:crypto";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import express, { Router } from "express";
import { join, resolve } from "node:path";
import { authenticatedAccount } from "../lib/requestAuth.js";

export const uploadsRouter = Router();
export const imageDirectory = resolve(process.env.FASHIONHUB_STORAGE_DIR || join(process.cwd(), "backend", "storage", "images"));
const storageLimitBytes = 10 * 1024 * 1024 * 1024;
let reservedBytes = 0;
const allowedTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif"
};

async function directorySize(directory: string): Promise<number> {
  await mkdir(directory, { recursive: true });
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.filter((entry) => entry.isFile()).map((entry) => stat(join(directory, entry.name))));
  return files.reduce((total, file) => total + file.size, 0);
}

uploadsRouter.post("/:kind", express.raw({ type: ["image/jpeg", "image/png", "image/webp", "image/avif"], limit: "10mb" }), async (req, res) => {
  const kind = req.params.kind;
  if (!(["avatar", "storefront", "listing"] as string[]).includes(kind)) return res.status(400).json({ message: "Choose a valid image type." });
  const account = await authenticatedAccount(req, res);
  if (!account) return;
  const contentType = req.header("content-type")?.split(";")[0].trim() ?? "";
  const extension = allowedTypes[contentType];
  if (!extension) return res.status(415).json({ message: "Upload a JPG, PNG, WebP, or AVIF image." });
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) return res.status(400).json({ message: "Choose an image file to upload." });
  if (req.body.length > 10 * 1024 * 1024) return res.status(413).json({ message: "Each image must be 10 MB or smaller." });

  let reserved = false;
  try {
    const currentSize = await directorySize(imageDirectory);
    if (currentSize + reservedBytes + req.body.length > storageLimitBytes) return res.status(507).json({ message: "FashionHub's local image storage has reached its 10 GB limit. Free disk space or change the storage directory." });
    reservedBytes += req.body.length;
    reserved = true;
    const filename = `${randomUUID()}.${extension}`;
    await writeFile(join(imageDirectory, filename), req.body, { flag: "wx", mode: 0o600 });
    return res.status(201).json({ url: `/uploads/images/${filename}`, path: filename });
  } catch (error) {
    console.error("Could not save FashionHub image to local disk:", error);
    return res.status(500).json({ message: "Could not save the image on this PC. Check that the disk has free space." });
  } finally {
    if (reserved) reservedBytes -= req.body.length;
  }
});
