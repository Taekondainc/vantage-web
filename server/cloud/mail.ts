import { BILLING } from "../../shared/billing";

function mailFrom() {
  return process.env.MAIL_FROM?.trim() || "hello@taekonda.com";
}

function resendKey() {
  return process.env.RESEND_API_KEY?.trim() || "";
}

export function mailConfigured() {
  return Boolean(resendKey());
}

export async function sendMail(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  const key = resendKey();
  if (!key) return false;
  const to = input.to.trim();
  if (!to || !to.includes("@")) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: mailFrom(),
      to: [to],
      subject: input.subject,
      text: input.text,
      html: input.html || undefined,
    }),
  });
  return res.ok;
}

export async function sendPaymentReceiptEmail(input: {
  to: string;
  amountCents: number;
  currency: string;
  invoiceNumber?: string | null;
  receiptNumber?: string | null;
  invoiceUrl?: string | null;
  receiptUrl?: string | null;
  billingUrl: string;
}) {
  const amount = `${input.currency.toUpperCase()} ${(input.amountCents / 100).toFixed(2)}`;
  const number = input.invoiceNumber || input.receiptNumber || "Paid";
  const links = [
    input.invoiceUrl ? `Invoice: ${input.invoiceUrl}` : "",
    input.receiptUrl ? `Receipt: ${input.receiptUrl}` : "",
    `Billing: ${input.billingUrl}`,
  ]
    .filter(Boolean)
    .join("\n");
  const text = [
    `Thanks for paying ${BILLING.productName}.`,
    "",
    `Amount: ${amount}`,
    `Reference: ${number}`,
    "",
    links,
    "",
    "� Taekonda",
  ].join("\n");
  const html = `<p>Thanks for paying <strong>${BILLING.productName}</strong>.</p>
<p>Amount: <strong>${amount}</strong><br/>Reference: ${number}</p>
<p>${input.invoiceUrl ? `<a href="${input.invoiceUrl}">Download invoice</a><br/>` : ""}${
    input.receiptUrl ? `<a href="${input.receiptUrl}">Download receipt</a><br/>` : ""
  }<a href="${input.billingUrl}">Open billing</a></p>
<p>� Taekonda</p>`;
  return sendMail({
    to: input.to,
    subject: `${BILLING.productName} receipt � ${amount}`,
    text,
    html,
  });
}
