import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";
import { supabase } from "./lib/supabase.js";
import { authRouter } from "./routes/auth.js";
import { shopsRouter } from "./routes/shops.js";
import { listingsRouter } from "./routes/listings.js";
import { accountRouter } from "./routes/account.js";
import { notificationsRouter } from "./routes/notifications.js";
import { workflowsRouter } from "./routes/workflows.js";
import { adminRouter } from "./routes/admin.js";
import { imageDirectory, uploadsRouter } from "./routes/uploads.js";

const app = express();
const port = Number(process.env.PORT ?? 4000);
const frontendOrigin =
  process.env.FRONTEND_ORIGIN ?? "http://127.0.0.1:5173";

app.use(helmet());
app.use(cors({ origin: frontendOrigin, credentials: true }));
app.use(express.json());
app.use("/api/auth", authRouter);
app.use("/api/shops", shopsRouter);
app.use("/api/listings", listingsRouter);
app.use("/api/account", accountRouter);
app.use("/api/account/notifications", notificationsRouter);
app.use("/api", workflowsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/uploads/images", express.static(imageDirectory, { dotfiles: "deny", maxAge: "365d", immutable: true }));
app.use("/api/uploads", uploadsRouter);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "fashionhub-backend" });
});

app.get("/api/countries", async (_req, res) => {
  const { data, error } = await supabase
    .from("countries")
    .select("code, name, currency, cities, payment_instructions")
    .eq("enabled", true)
    .order("name");

  if (error) {
    console.error("Could not load countries:", error.message);
    return res.status(500).json({ message: "Could not load countries." });
  }

  res.json(
    data.map((country) => ({
      code: country.code,
      name: country.name,
      currency: country.currency,
      cities: country.cities,
      paymentInstructions: country.payment_instructions ?? undefined
    }))
  );
});

app.get("/api/subscriptions/plans", async (_req, res) => {
  const [plansResult, pricesResult] = await Promise.all([
    supabase
      .from("subscription_plans")
      .select("*")
      .eq("enabled", true)
      .order("id"),
    supabase
      .from("subscription_plan_prices")
      .select("plan_id, country_code, amount, currency")
  ]);

  if (plansResult.error || pricesResult.error) {
    console.error(
      "Could not load plans:",
      plansResult.error?.message ?? pricesResult.error?.message
    );
    return res.status(500).json({ message: "Could not load subscription plans." });
  }

  const pricesByPlan: Record<
    string,
    Record<string, { amount: number; currency: string }>
  > = {};

  for (const price of pricesResult.data) {
    pricesByPlan[price.plan_id] ??= {};
    pricesByPlan[price.plan_id][price.country_code] = {
      amount: Number(price.amount),
      currency: price.currency
    };
  }

  res.json(
    plansResult.data.map((plan) => {
      const countryPrices = pricesByPlan[plan.id] ?? {};
      const ugandaPrice = countryPrices.UG;

      return {
        id: plan.id,
        name: plan.name,
        payerTypes: plan.payer_types,
        targetRoles: plan.target_roles,
        benefits: plan.benefits,
        renewalPeriod: plan.renewal_period,
        promotionLabel: plan.promotion_label ?? undefined,
        accessLabel: plan.access_label ?? undefined,
        countryPrices,
        amount: ugandaPrice?.amount,
        currency: ugandaPrice?.currency,
        priceLabel: ugandaPrice
          ? `${ugandaPrice.currency} ${ugandaPrice.amount.toLocaleString()} / month`
          : "Pricing not configured"
      };
    })
  );
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.join(__dirname, "../../../dist");

app.use(express.static(frontendDist));
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(frontendDist, "index.html"));
});

app.listen(port, "0.0.0.0", () => {
  console.log(`FashionHub production server running at http://127.0.0.1:${port}`);
});
