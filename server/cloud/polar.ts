import { createHmac, timingSafeEqual } from "node:crypto";
import { BILLING } from "../../shared/billing";
import { HttpError } from "./store";

type PolarJson = Record<string, unknown>;

let cachedProductId: string | null = null;

export function polarAccessToken() {
  return process.env.POLAR_ACCESS_TOKEN?.trim() || "";
}

export function polarWebhookSecret() {
  return process.env.POLAR_WEBHOOK_SECRET?.trim() || "";
}

export function polarConfigured() {
  return Boolean(polarAccessToken());
}

export function polarApiBase() {
  return process.env.POLAR_SERVER?.trim() === "sandbox"
    ? "https://sandbox-api.polar.sh"
    : "https://api.polar.sh";
}

function polarErrorMessage(data: PolarJson, fallback: string) {
  const error = data.error;
  if (error && typeof error === "object" && "detail" in error) {
    return String((error as { detail?: unknown }).detail || fallback);
  }
  if (typeof data.detail === "string") return data.detail;
  if (Array.isArray(data.detail)) {
    return data.detail
      .map((item) => (item && typeof item === "object" && "msg" in item ? String(item.msg) : String(item)))
      .join("; ");
  }
  return fallback;
}

async function polarFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = polarAccessToken();
  if (!token) throw new HttpError(503, "Polar is not configured. Set POLAR_ACCESS_TOKEN.");
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const res = await fetch(`${polarApiBase()}/v1${path}`, { ...init, headers });
  const data = (await res.json().catch(() => ({}))) as PolarJson;
  if (!res.ok) {
    throw new HttpError(res.status === 401 ? 502 : 502, `Polar: ${polarErrorMessage(data, res.statusText)}`);
  }
  return data as T;
}

async function polarRequest(path: string, init: RequestInit = {}): Promise<{ status: number; data: PolarJson }> {
  const token = polarAccessToken();
  if (!token) throw new HttpError(503, "Polar is not configured. Set POLAR_ACCESS_TOKEN.");
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const res = await fetch(`${polarApiBase()}/v1${path}`, { ...init, headers });
  const data = (await res.json().catch(() => ({}))) as PolarJson;
  return { status: res.status, data };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function polarFileUrl(path: string): Promise<string | null> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { status, data } = await polarRequest(path);
    if (status === 202) {
      await sleep(1200);
      continue;
    }
    if (status < 200 || status >= 300) return null;
    const url = typeof data.url === "string" ? data.url : null;
    return url || null;
  }
  return null;
}

export async function fetchOrderReceiptUrl(orderId: string) {
  return polarFileUrl(`/orders/${encodeURIComponent(orderId)}/receipt`);
}

export async function fetchOrderInvoiceUrl(orderId: string) {
  await polarRequest(`/orders/${encodeURIComponent(orderId)}/invoice`, { method: "POST" }).catch(() => ({
    status: 0,
    data: {},
  }));
  return polarFileUrl(`/orders/${encodeURIComponent(orderId)}/invoice`);
}

type PolarProduct = {
  id?: string;
  name?: string;
  is_archived?: boolean;
};

type PolarList<T> = { items?: T[] };

export async function resolvePaidProductId(): Promise<string> {
  const fromEnv = process.env.POLAR_PRODUCT_ID?.trim();
  if (fromEnv) return fromEnv;
  if (cachedProductId) return cachedProductId;

  const listed = await polarFetch<PolarList<PolarProduct>>("/products/?is_archived=false&limit=100");
  const existing = (listed.items || []).find(
    (item) => item.id && !item.is_archived && item.name === BILLING.productName,
  );
  if (existing?.id) {
    cachedProductId = existing.id;
    return existing.id;
  }

  const created = await polarFetch<PolarProduct>("/products/", {
    method: "POST",
    body: JSON.stringify({
      name: BILLING.productName,
      description: BILLING.polarDescription,
      recurring_interval: "month",
      prices: [
        {
          amount_type: "fixed",
          price_amount: BILLING.paidPriceCents,
          price_currency: "usd",
        },
      ],
    }),
  });
  if (!created.id) throw new HttpError(502, "Polar did not return a product id. Set POLAR_PRODUCT_ID.");
  cachedProductId = created.id;
  return created.id;
}

export async function createCheckoutSession(input: {
  userId: string;
  successUrl: string;
  returnUrl: string;
  customerEmail?: string | null;
  customerName?: string | null;
  customerIp?: string | null;
}): Promise<{ url: string }> {
  const productId = await resolvePaidProductId();
  const body: Record<string, unknown> = {
    products: [productId],
    success_url: input.successUrl,
    return_url: input.returnUrl,
    metadata: { userId: input.userId },
    customer_metadata: { userId: input.userId },
  };
  if (input.customerEmail) {
    body.external_customer_id = input.userId;
    body.customer_email = input.customerEmail;
  }
  if (input.customerName) body.customer_name = input.customerName;
  if (input.customerIp) body.customer_ip_address = input.customerIp;

  const checkout = await polarFetch<{ url?: string }>("/checkouts/", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!checkout.url) throw new HttpError(502, "Polar did not return a checkout URL.");
  return { url: checkout.url };
}

export async function createCustomerPortalSession(input: {
  customerId?: string | null;
  userId: string;
}): Promise<{ url: string }> {
  const body = input.customerId
    ? { customer_id: input.customerId }
    : { external_customer_id: input.userId };
  const session = await polarFetch<{ customer_portal_url?: string }>("/customer-sessions/", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!session.customer_portal_url) {
    throw new HttpError(400, "No Polar customer yet. Upgrade to Paid first.");
  }
  return { url: session.customer_portal_url };
}

function hmacBase64(secret: string | Buffer, payload: string) {
  return createHmac("sha256", secret).update(payload).digest("base64");
}

function equalSignature(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function verifyPolarWebhook(rawBody: string, headers: {
  id?: string | null;
  timestamp?: string | null;
  signature?: string | null;
}) {
  const secret = polarWebhookSecret();
  if (!secret) throw new HttpError(503, "Polar webhook secret is not configured.");
  const id = headers.id?.trim() || "";
  const timestamp = headers.timestamp?.trim() || "";
  const signatureHeader = headers.signature?.trim() || "";
  if (!id || !timestamp || !signatureHeader) throw new HttpError(403, "Missing Polar webhook headers.");

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 60 * 5) throw new HttpError(403, "Stale Polar webhook.");

  const signed = `${id}.${timestamp}.${rawBody}`;
  const secrets: Array<string | Buffer> = [secret];
  if (secret.startsWith("whsec_")) {
    try {
      secrets.push(Buffer.from(secret.slice("whsec_".length), "base64"));
    } catch {
      // keep the original secret
    }
  }

  const offered = signatureHeader
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const comma = part.indexOf(",");
      return comma >= 0 ? part.slice(comma + 1) : part.replace(/^v1,/, "");
    });

  for (const key of secrets) {
    const expected = hmacBase64(key, signed);
    if (offered.some((sig) => equalSignature(expected, sig))) return;
  }
  throw new HttpError(403, "Invalid Polar webhook signature.");
}

export type PolarWebhookEvent = {
  type: string;
  data: PolarJson;
};
