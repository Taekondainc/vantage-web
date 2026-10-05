import { Hono } from "hono";
import type { UsageKind } from "../../shared/billing";
import { appOrigin } from "./githubIdentity";
import { requireAuth, type AuthEnv } from "./auth";
import { applyPolarEvent, consumeUsage, getBillingState, getUserBillingRow } from "./billing";
import { listPayments, paymentDocumentUrl } from "./payments";
import { getUserBillingEmail, saveUserEmail } from "./users";
import {
  createCheckoutSession,
  createCustomerPortalSession,
  polarConfigured,
  polarWebhookSecret,
  verifyPolarWebhook,
} from "./polar";
import { HttpError } from "./store";

const USAGE_KINDS: UsageKind[] = ["report", "ai", "evidence_pack"];

function handle(err: unknown) {
  if (err instanceof HttpError) return err;
  return new HttpError(500, err instanceof Error ? err.message : "Request failed.");
}

function clientIp(c: { req: { header: (name: string) => string | undefined } }) {
  const forwarded = c.req.header("x-forwarded-for") || "";
  const first = forwarded.split(",")[0]?.trim();
  return first || c.req.header("cf-connecting-ip") || c.req.header("true-client-ip") || null;
}

export const billingPublicRoutes = new Hono();

billingPublicRoutes.post("/polar/webhook", async (c) => {
  const raw = await c.req.text();
  try {
    if (!polarWebhookSecret()) {
      throw new HttpError(503, "Polar webhook secret is not configured.");
    }
    verifyPolarWebhook(raw, {
      id: c.req.header("webhook-id"),
      timestamp: c.req.header("webhook-timestamp"),
      signature: c.req.header("webhook-signature"),
    });
    const event = JSON.parse(raw) as { type?: string; data?: Record<string, unknown> };
    if (event.type && event.data && typeof event.data === "object") {
      await applyPolarEvent(event.type, event.data);
    }
    return c.body("", 202);
  } catch (err) {
    const error = handle(err);
    return c.json({ error: error.message }, error.status as 400);
  }
});

export const billingAuthRoutes = new Hono<AuthEnv>();

billingAuthRoutes.use("/billing", requireAuth);
billingAuthRoutes.use("/billing/*", requireAuth);

billingAuthRoutes.get("/billing", async (c) => {
  try {
    return c.json(await getBillingState(c.get("user").id));
  } catch (err) {
    const error = handle(err);
    return c.json({ error: error.message }, error.status as 400);
  }
});

billingAuthRoutes.post("/billing/checkout", async (c) => {
  const user = c.get("user");
  try {
    if (!polarConfigured()) {
      throw new HttpError(503, "Paid checkout is not configured yet. Set POLAR_ACCESS_TOKEN.");
    }
    const origin = appOrigin();
    const customerEmail = await getUserBillingEmail(user.id);
    const session = await createCheckoutSession({
      userId: user.id,
      successUrl: `${origin}/app/billing?checkout=success`,
      returnUrl: `${origin}/pricing`,
      customerEmail,
      customerName: user.name || user.login,
      customerIp: clientIp(c),
    });
    return c.json(session);
  } catch (err) {
    const error = handle(err);
    return c.json({ error: error.message }, error.status as 400);
  }
});

billingAuthRoutes.post("/billing/portal", async (c) => {
  const user = c.get("user");
  try {
    if (!polarConfigured()) {
      throw new HttpError(503, "Paid billing is not configured yet. Set POLAR_ACCESS_TOKEN.");
    }
    const row = await getUserBillingRow(user.id);
    const session = await createCustomerPortalSession({
      customerId: row?.polar_customer_id,
      userId: user.id,
    });
    return c.json(session);
  } catch (err) {
    const error = handle(err);
    return c.json({ error: error.message }, error.status as 400);
  }
});

billingAuthRoutes.get("/billing/payments", async (c) => {
  try {
    return c.json(await listPayments(c.get("user").id));
  } catch (err) {
    const error = handle(err);
    return c.json({ error: error.message }, error.status as 400);
  }
});

billingAuthRoutes.get("/billing/documents/:id/url", async (c) => {
  try {
    return c.json(await paymentDocumentUrl(c.get("user").id, c.req.param("id")));
  } catch (err) {
    const error = handle(err);
    return c.json({ error: error.message }, error.status as 400);
  }
});

billingAuthRoutes.patch("/billing/email", async (c) => {
  const body = (await c.req.json().catch(() => null)) as { email?: string } | null;
  const email = String(body?.email || "").trim();
  if (!email.includes("@")) return c.json({ error: "A valid email is required." }, 400);
  try {
    await saveUserEmail(c.get("user").id, email);
    return c.json({ email });
  } catch (err) {
    const error = handle(err);
    return c.json({ error: error.message }, error.status as 400);
  }
});

billingAuthRoutes.post("/billing/consume", async (c) => {
  const user = c.get("user");
  const body = (await c.req.json().catch(() => null)) as { kind?: string } | null;
  const kind = body?.kind as UsageKind | undefined;
  if (!kind || !USAGE_KINDS.includes(kind)) {
    return c.json({ error: "kind must be report, ai, or evidence_pack." }, 400);
  }
  try {
    return c.json(await consumeUsage(user.id, kind));
  } catch (err) {
    const error = handle(err);
    return c.json({ error: error.message }, error.status as 400);
  }
});
