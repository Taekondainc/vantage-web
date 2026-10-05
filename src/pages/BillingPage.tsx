import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  listPayments,
  loadMe,
  openBillingPortal,
  paymentDocumentUrl,
  saveBillingEmail,
  startBillingCheckout,
} from "../api";
import { colorFor } from "../lib/colors";
import { getSession } from "../lib/session";
import { BILLING } from "../../shared/billing";
import type { BillingState, PaymentRecord } from "../../shared/billing";

function meterLine(used: number, limit: number | null) {
  if (limit === null) return `${used} used � unlimited`;
  return `${used} of ${limit} used`;
}

function money(amountCents: number, currency: string) {
  return `${currency.toUpperCase()} ${(amountCents / 100).toFixed(2)}`;
}

export function BillingPage() {
  const session = getSession();
  const [params] = useSearchParams();
  const [billing, setBilling] = useState<BillingState | null>(null);
  const [email, setEmail] = useState("");
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checkoutOk = params.get("checkout") === "success";

  async function refresh() {
    const [me, nextPayments] = await Promise.all([loadMe(), listPayments().catch(() => [])]);
    setBilling(me.billing);
    setEmail(me.email || "");
    setPayments(nextPayments);
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void refresh()
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load billing.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const paid = billing?.plan === "paid";
  const meters = useMemo(() => {
    if (!billing) return [];
    return [
      { label: "Monthly reports", used: billing.usage.reports, limit: billing.limits.reports },
      { label: "AI actions", used: billing.usage.aiActions, limit: billing.limits.aiActions },
      { label: "Evidence packs", used: billing.usage.evidencePacks, limit: billing.limits.evidencePacks },
      {
        label: "GitHub accounts",
        used: 1,
        limit: billing.limits.githubAccounts,
        hideUsed: true,
      },
    ];
  }, [billing]);

  async function onCheckout() {
    setBusy(true);
    setError(null);
    try {
      if (email.trim()) await saveBillingEmail(email.trim()).catch(() => undefined);
      const next = await startBillingCheckout();
      window.location.href = next.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start checkout.");
      setBusy(false);
    }
  }

  async function onPortal() {
    setBusy(true);
    setError(null);
    try {
      const next = await openBillingPortal();
      window.location.href = next.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open the billing portal.");
      setBusy(false);
    }
  }

  async function onSaveEmail(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const next = await saveBillingEmail(email.trim());
      setEmail(next.email);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save billing email.");
    } finally {
      setBusy(false);
    }
  }

  async function onOpenDocument(id: string) {
    try {
      const doc = await paymentDocumentUrl(id);
      window.open(doc.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open that document.");
    }
  }

  return (
    <>
      <header className="workspace-top">
        <div>
          <p className="eyebrow">
            <span className="account-dot" style={{ background: colorFor(session?.login || "guest") }} aria-hidden="true" />
            @{session?.login || "guest"}
          </p>
          <h1>Billing</h1>
          <p className="lede">
            Free meters stay on until you upgrade. Paid is ${BILLING.paidPriceUsd}/mo USD. Receipts are emailed and stored
            here.
          </p>
        </div>
      </header>

      {checkoutOk ? <p className="hint">Checkout complete. If Paid is not showing yet, wait a few seconds and refresh.</p> : null}
      {error ? <p className="error inline-error">{error}</p> : null}

      <section className="card-panel tasks-card">
        {loading ? <p className="hint">Loading plan�</p> : null}
        {billing ? (
          <>
            <p className="eyebrow">{paid ? "Paid" : "Free"}</p>
            <h2>{paid ? "Meters removed" : "Usage this month"}</h2>
            <p className="hint">
              Period {billing.usage.period}
              {billing.periodEnd ? ` � renews ${new Date(billing.periodEnd).toLocaleDateString()}` : ""}
            </p>
            <ul className="invite-list">
              {meters.map((meter) => (
                <li key={meter.label}>
                  <div>
                    <strong>{meter.label}</strong>
                    <small>
                      {"hideUsed" in meter && meter.hideUsed && meter.limit === null
                        ? "Unlimited"
                        : "hideUsed" in meter && meter.hideUsed
                          ? `Up to ${meter.limit}`
                          : meterLine(meter.used, meter.limit)}
                    </small>
                  </div>
                </li>
              ))}
            </ul>
            <div className="setup-actions" style={{ marginTop: "1rem", display: "flex", gap: "0.75rem" }}>
              {paid ? (
                <button type="button" className="btn-primary" disabled={busy || !billing.polarConfigured} onClick={() => void onPortal()}>
                  {busy ? "Opening�" : "Manage billing"}
                </button>
              ) : (
                <button type="button" className="btn-primary" disabled={busy || !billing.polarConfigured} onClick={() => void onCheckout()}>
                  {busy ? "Redirecting�" : `Upgrade � $${BILLING.paidPriceUsd}/mo`}
                </button>
              )}
            </div>
            {!billing.polarConfigured ? (
              <p className="hint">Checkout is not live yet. Polar still needs an organization token on the server.</p>
            ) : null}
          </>
        ) : null}
      </section>

      <section className="card-panel tasks-card">
        <h2>Billing email</h2>
        <p className="hint">Invoices and receipts are sent here. Polar also emails the address used at checkout.</p>
        <form className="project-create" onSubmit={(event) => void onSaveEmail(event)}>
          <label className="pill-field">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              disabled={busy}
            />
          </label>
          <button type="submit" className="btn-primary" disabled={busy || !email.includes("@")}>
            Save
          </button>
        </form>
      </section>

      <section className="card-panel tasks-card">
        <h2>Payments</h2>
        {payments.length === 0 ? (
          <p className="hint">No stored payments yet. Paid orders show up here with invoice and receipt files.</p>
        ) : (
          <ul className="invite-list">
            {payments.map((payment) => (
              <li key={payment.id}>
                <div>
                  <strong>
                    {money(payment.amountCents, payment.currency)} � {payment.status}
                  </strong>
                  <small>
                    {payment.invoiceNumber || payment.receiptNumber || payment.billingReason || "Order"}
                    {payment.paidAt ? ` � ${new Date(payment.paidAt).toLocaleString()}` : ""}
                  </small>
                </div>
                <span style={{ display: "flex", gap: "0.5rem" }}>
                  {payment.documents.map((doc) => (
                    <button key={doc.id} type="button" className="ghost" onClick={() => void onOpenDocument(doc.id)}>
                      {doc.kind}
                    </button>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
