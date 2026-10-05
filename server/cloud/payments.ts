import type { PaymentDocument, PaymentDocumentKind, PaymentRecord, PaymentStatus } from "../../shared/billing";
import { BILLING } from "../../shared/billing";
import { appOrigin } from "./githubIdentity";
import { sendPaymentReceiptEmail } from "./mail";
import { cloudinaryConfigured, uploadToCloudinary } from "./cloudinary";
import { fetchOrderInvoiceUrl, fetchOrderReceiptUrl } from "./polar";
import { HttpError, newId } from "./store";
import { getSupabase, supabaseConfigured } from "./supabase";
import { getUserBillingEmail, saveUserEmail } from "./users";

type PaymentRow = {
  id: string;
  user_id: string | null;
  polar_order_id: string;
  polar_customer_id: string | null;
  polar_subscription_id: string | null;
  status: string;
  billing_reason: string | null;
  amount_cents: number;
  currency: string;
  invoice_number: string | null;
  receipt_number: string | null;
  paid_at: string | null;
  refunded_at: string | null;
  created_at: string;
};

type DocumentRow = {
  id: string;
  payment_id: string;
  user_id: string | null;
  kind: string;
  name: string;
  mime: string;
  size_bytes: number | string;
  storage_path: string | null;
  url: string | null;
  polar_url: string | null;
  created_at: string;
};

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function stringField(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function intField(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function asStatus(value: string | null): PaymentStatus {
  if (value === "paid" || value === "refunded" || value === "canceled") return value;
  return "pending";
}

function mapDocument(row: DocumentRow): PaymentDocument {
  return {
    id: row.id,
    kind: row.kind === "invoice" ? "invoice" : "receipt",
    name: row.name,
    mime: row.mime,
    sizeBytes: Number(row.size_bytes) || 0,
    url: row.url || row.polar_url,
    createdAt: row.created_at,
  };
}

function mapPayment(row: PaymentRow, documents: PaymentDocument[]): PaymentRecord {
  return {
    id: row.id,
    status: asStatus(row.status),
    billingReason: row.billing_reason,
    amountCents: row.amount_cents,
    currency: row.currency || "usd",
    invoiceNumber: row.invoice_number,
    receiptNumber: row.receipt_number,
    paidAt: row.paid_at,
    createdAt: row.created_at,
    documents,
  };
}

export async function listPayments(userId: string): Promise<PaymentRecord[]> {
  if (!supabaseConfigured()) return [];
  const sb = getSupabase();
  const paymentsRes = await sb
    .from("vantage_payments")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (paymentsRes.error) throw new HttpError(502, `Supabase: ${paymentsRes.error.message}`);
  const rows = (paymentsRes.data || []) as PaymentRow[];
  if (!rows.length) return [];
  const docsRes = await sb
    .from("vantage_payment_documents")
    .select("*")
    .in(
      "payment_id",
      rows.map((row) => row.id),
    );
  if (docsRes.error) throw new HttpError(502, `Supabase: ${docsRes.error.message}`);
  const docs = (docsRes.data || []) as DocumentRow[];
  return rows.map((row) =>
    mapPayment(
      row,
      docs.filter((doc) => doc.payment_id === row.id).map(mapDocument),
    ),
  );
}

export async function paymentDocumentUrl(userId: string, documentId: string): Promise<{
  url: string;
  name: string;
  mime: string;
}> {
  if (!supabaseConfigured()) throw new HttpError(404, "Payment document not found.");
  const { data, error } = await getSupabase()
    .from("vantage_payment_documents")
    .select("*")
    .eq("id", documentId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new HttpError(502, `Supabase: ${error.message}`);
  const row = data as DocumentRow | null;
  const url = row?.url || row?.polar_url;
  if (!row || !url) throw new HttpError(404, "Payment document not found.");
  return { url, name: row.name, mime: row.mime };
}

async function copyPdf(kind: PaymentDocumentKind, orderId: string, sourceUrl: string) {
  const res = await fetch(sourceUrl);
  if (!res.ok) return { bytes: Buffer.alloc(0), mime: "application/pdf", name: `${kind}.pdf` };
  const bytes = Buffer.from(await res.arrayBuffer());
  return {
    bytes,
    mime: res.headers.get("content-type") || "application/pdf",
    name: `${kind}-${orderId.slice(0, 8)}.pdf`,
  };
}

async function upsertDocument(input: {
  paymentId: string;
  userId: string | null;
  kind: PaymentDocumentKind;
  polarUrl: string;
  orderId: string;
}) {
  if (!supabaseConfigured()) return;
  let url = input.polarUrl;
  let storagePath: string | null = null;
  let sizeBytes = 0;
  let mime = "application/pdf";
  let name = `${input.kind}.pdf`;
  if (cloudinaryConfigured()) {
    try {
      const file = await copyPdf(input.kind, input.orderId, input.polarUrl);
      if (file.bytes.length) {
        const uploaded = await uploadToCloudinary({
          bytes: file.bytes,
          mime: file.mime,
          name: file.name,
          folder: `vantage/billing/${input.userId || "unknown"}`,
          publicId: `${input.orderId}-${input.kind}`,
        });
        url = uploaded.secure_url;
        storagePath = uploaded.public_id;
        sizeBytes = uploaded.bytes;
        mime = file.mime;
        name = file.name;
      }
    } catch {
      // keep Polar URL if Cloudinary copy fails
    }
  }
  const { error } = await getSupabase().from("vantage_payment_documents").upsert(
    {
      payment_id: input.paymentId,
      user_id: input.userId,
      kind: input.kind,
      name,
      mime,
      size_bytes: sizeBytes,
      storage_path: storagePath,
      url,
      polar_url: input.polarUrl,
    },
    { onConflict: "payment_id,kind" },
  );
  if (error) throw new HttpError(502, `Supabase: ${error.message}`);
}

async function ingestDocuments(payment: PaymentRow) {
  const [receiptUrl, invoiceUrl] = await Promise.all([
    fetchOrderReceiptUrl(payment.polar_order_id).catch(() => null),
    fetchOrderInvoiceUrl(payment.polar_order_id).catch(() => null),
  ]);
  if (receiptUrl) {
    await upsertDocument({
      paymentId: payment.id,
      userId: payment.user_id,
      kind: "receipt",
      polarUrl: receiptUrl,
      orderId: payment.polar_order_id,
    }).catch(() => undefined);
  }
  if (invoiceUrl) {
    await upsertDocument({
      paymentId: payment.id,
      userId: payment.user_id,
      kind: "invoice",
      polarUrl: invoiceUrl,
      orderId: payment.polar_order_id,
    }).catch(() => undefined);
  }
  return { receiptUrl, invoiceUrl };
}

async function emailPayment(payment: PaymentRow, docs: { receiptUrl: string | null; invoiceUrl: string | null }) {
  if (!payment.user_id || payment.status !== "paid") return;
  const email = await getUserBillingEmail(payment.user_id);
  if (!email) return;
  await sendPaymentReceiptEmail({
    to: email,
    amountCents: payment.amount_cents,
    currency: payment.currency,
    invoiceNumber: payment.invoice_number,
    receiptNumber: payment.receipt_number,
    invoiceUrl: docs.invoiceUrl,
    receiptUrl: docs.receiptUrl,
    billingUrl: `${appOrigin()}/app/billing`,
  });
}

export async function upsertPaymentFromOrder(input: {
  userId?: string | null;
  order: Record<string, unknown>;
}) {
  if (!supabaseConfigured()) return;
  const orderId = stringField(input.order.id);
  if (!orderId) return;
  const customer = asObject(input.order.customer);
  const customerId = stringField(input.order.customer_id) || stringField(customer?.id);
  const customerEmail = stringField(input.order.customer_email) || stringField(customer?.email);
  let userId = input.userId || null;
  if (!userId && customerId) {
    const found = await getSupabase()
      .from("vantage_users")
      .select("id")
      .eq("polar_customer_id", customerId)
      .maybeSingle();
    userId = found.data?.id ?? null;
  }
  if (userId && customerEmail) await saveUserEmail(userId, customerEmail);

  const status = asStatus(stringField(input.order.status));
  const paidAt =
    stringField(input.order.paid_at) ||
    (status === "paid" ? new Date().toISOString() : null);
  const payload = {
    id: newId(),
    user_id: userId,
    polar_order_id: orderId,
    polar_customer_id: customerId,
    polar_subscription_id: stringField(input.order.subscription_id),
    status,
    billing_reason: stringField(input.order.billing_reason),
    amount_cents: intField(input.order.total_amount ?? input.order.net_amount ?? BILLING.paidPriceCents),
    currency: (stringField(input.order.currency) || "usd").toLowerCase(),
    invoice_number: stringField(input.order.invoice_number),
    receipt_number: stringField(input.order.receipt_number),
    paid_at: paidAt,
    refunded_at: stringField(input.order.refunded_at),
    polar_payload: input.order,
    updated_at: new Date().toISOString(),
  };

  const existing = await getSupabase()
    .from("vantage_payments")
    .select("id")
    .eq("polar_order_id", orderId)
    .maybeSingle();
  const id = (existing.data as { id?: string } | null)?.id || payload.id;
  const { error } = await getSupabase().from("vantage_payments").upsert({ ...payload, id }, { onConflict: "polar_order_id" });
  if (error) throw new HttpError(502, `Supabase: ${error.message}`);

  const saved: PaymentRow = {
    id,
    user_id: userId,
    polar_order_id: orderId,
    polar_customer_id: customerId,
    polar_subscription_id: payload.polar_subscription_id,
    status,
    billing_reason: payload.billing_reason,
    amount_cents: payload.amount_cents,
    currency: payload.currency,
    invoice_number: payload.invoice_number,
    receipt_number: payload.receipt_number,
    paid_at: paidAt,
    refunded_at: payload.refunded_at,
    created_at: new Date().toISOString(),
  };

  void ingestDocuments(saved)
    .then((docs) => emailPayment(saved, docs))
    .catch(() => undefined);
}
