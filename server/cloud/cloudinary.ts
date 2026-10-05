import { createHash } from "node:crypto";

type CloudinaryConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
};

export type CloudinaryUpload = {
  public_id: string;
  secure_url: string;
  url: string;
  bytes: number;
  resource_type: string;
};

function parseConfig(): CloudinaryConfig | null {
  const url = process.env.CLOUDINARY_URL?.trim();
  if (url) {
    try {
      const parsed = new URL(url);
      const cloudName = parsed.hostname;
      const apiKey = decodeURIComponent(parsed.username);
      const apiSecret = decodeURIComponent(parsed.password);
      if (cloudName && apiKey && apiSecret) return { cloudName, apiKey, apiSecret };
    } catch {
      return null;
    }
  }
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim() || "";
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim() || "";
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim() || "";
  if (cloudName && apiKey && apiSecret) return { cloudName, apiKey, apiSecret };
  return null;
}

export function cloudinaryConfigured() {
  return Boolean(parseConfig());
}


function requireConfig() {
  const config = parseConfig();
  if (!config) {
    throw new Error(
      "Cloudinary is not configured. Set CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.",
    );
  }
  return config;
}

function sign(params: Record<string, string>, secret: string) {
  const blob =
    Object.keys(params)
      .filter((key) => params[key] !== "")
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join("&") + secret;
  return createHash("sha1").update(blob).digest("hex");
}

export async function uploadToCloudinary(input: {
  bytes: Buffer;
  mime: string;
  name: string;
  folder: string;
  publicId: string;
}): Promise<CloudinaryUpload> {
  const { cloudName, apiKey, apiSecret } = requireConfig();
  const timestamp = String(Math.floor(Date.now() / 1000));
  const toSign = { folder: input.folder, public_id: input.publicId, timestamp };
  const body = new FormData();
  body.set("file", new Blob([new Uint8Array(input.bytes)], { type: input.mime }), input.name);
  body.set("api_key", apiKey);
  body.set("timestamp", timestamp);
  body.set("folder", input.folder);
  body.set("public_id", input.publicId);
  body.set("signature", sign(toSign, apiSecret));

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
    method: "POST",
    body,
  });
  const data = (await res.json().catch(() => ({}))) as CloudinaryUpload & { error?: { message?: string } };
  if (!res.ok || !data.public_id || !(data.secure_url || data.url)) {
    throw new Error(data.error?.message || "Cloudinary upload failed.");
  }
  return {
    public_id: data.public_id,
    secure_url: data.secure_url || data.url,
    url: data.url || data.secure_url,
    bytes: Number(data.bytes) || input.bytes.length,
    resource_type: data.resource_type || "raw",
  };
}

export async function destroyOnCloudinary(publicId: string, resourceType = "raw") {
  const { cloudName, apiKey, apiSecret } = requireConfig();
  const timestamp = String(Math.floor(Date.now() / 1000));
  const toSign = { public_id: publicId, timestamp };
  const body = new URLSearchParams({
    public_id: publicId,
    api_key: apiKey,
    timestamp,
    signature: sign(toSign, apiSecret),
  });
  await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  }).catch(() => undefined);
}
