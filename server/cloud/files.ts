import type { CloudFileView, CloudUser } from "../../shared/types";
import { HttpError, newId, normalizeLogin, readStore } from "./store";
import { cloudinaryConfigured, destroyOnCloudinary, uploadToCloudinary } from "./cloudinary";
import { getSupabase, supabaseConfigured } from "./supabase";

const MAX_BYTES = 40 * 1024 * 1024;

type FileRow = {
  id: string;
  project_id: string;
  author_user_id: string;
  report_id: string | null;
  year: number | null;
  month: number | null;
  name: string;
  storage_path: string;
  resource_type?: string | null;
  url?: string | null;
  mime: string;
  size_bytes: number | string;
  created_at: string;
};

function requireSupabaseStore() {
  if (!supabaseConfigured()) {
    throw new HttpError(503, "Supabase is not configured on this server.");
  }
  return getSupabase();
}

function unwrap<T>(data: T | null, error: { message: string } | null, fallback: T): T {
  if (error) throw new HttpError(502, `Supabase: ${error.message}`);
  return data ?? fallback;
}

function safeFileName(name: string) {
  const cleaned = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").replace(/^\.+/, "").trim();
  return (cleaned.slice(0, 160) || "file").replace(/\s+/g, "-");
}

function projectAccess(projectId: string, user: CloudUser) {
  return readStore().then((data) => {
    const project = data.projects.find((item) => item.id === projectId);
    if (!project) throw new HttpError(404, "Project not found.");
    const login = normalizeLogin(user.login);
    const membership = data.memberships.find(
      (item) =>
        item.projectId === projectId &&
        (item.userId === user.id || normalizeLogin(item.githubLogin) === login),
    );
    if (!membership || membership.status !== "active") {
      throw new HttpError(403, "You are not a member of this project.");
    }
    const isLead = membership.role === "lead" || project.leadUserId === user.id;
    return { project, membership, isLead, data };
  });
}

function mapFile(row: FileRow, extras: { projectName: string; authorLogin: string }): CloudFileView {
  return {
    id: row.id,
    projectId: row.project_id,
    projectName: extras.projectName,
    authorUserId: row.author_user_id,
    authorLogin: extras.authorLogin,
    reportId: row.report_id,
    year: row.year,
    month: row.month,
    name: row.name,
    mime: row.mime,
    sizeBytes: Number(row.size_bytes) || 0,
    createdAt: row.created_at,
  };
}

async function fileViews(rows: FileRow[]): Promise<CloudFileView[]> {
  if (!rows.length) return [];
  const data = await readStore();
  return rows.map((row) => {
    const project = data.projects.find((item) => item.id === row.project_id);
    const author = data.users.find((item) => item.id === row.author_user_id);
    return mapFile(row, {
      projectName: project?.name || "Project",
      authorLogin: author?.login || "unknown",
    });
  });
}

function deliveryUrl(row: FileRow) {
  if (row.url?.startsWith("http")) return row.url;
  return "";
}

export async function listProjectFiles(projectId: string, user: CloudUser): Promise<CloudFileView[]> {
  const { isLead } = await projectAccess(projectId, user);
  const sb = requireSupabaseStore();
  let query = sb.from("vantage_files").select("*").eq("project_id", projectId).order("created_at", { ascending: false });
  if (!isLead) query = query.eq("author_user_id", user.id);
  const { data, error } = await query;
  return fileViews(unwrap(data, error, []) as FileRow[]);
}

export async function listMyFiles(user: CloudUser): Promise<CloudFileView[]> {
  const sb = requireSupabaseStore();
  const { data, error } = await sb
    .from("vantage_files")
    .select("*")
    .eq("author_user_id", user.id)
    .order("created_at", { ascending: false });
  return fileViews(unwrap(data, error, []) as FileRow[]);
}

export async function uploadProjectFile(
  projectId: string,
  user: CloudUser,
  input: {
    name: string;
    mime?: string;
    contentBase64: string;
    year?: number | null;
    month?: number | null;
    reportId?: string | null;
  },
): Promise<CloudFileView> {
  await projectAccess(projectId, user);
  if (!cloudinaryConfigured()) {
    throw new HttpError(
      503,
      "Cloudinary is not configured. Add CLOUDINARY_URL or the cloud name, API key, and API secret.",
    );
  }
  const sb = requireSupabaseStore();

  const name = safeFileName(input.name);
  const mime = String(input.mime || "application/octet-stream").slice(0, 120);
  let bytes: Buffer;
  try {
    bytes = Buffer.from(String(input.contentBase64 || ""), "base64");
  } catch {
    throw new HttpError(400, "File content is not valid base64.");
  }
  if (!bytes.length) throw new HttpError(400, "File is empty.");
  if (bytes.length > MAX_BYTES) throw new HttpError(400, "File is larger than 40 MB.");

  const id = newId();
  const folder = `vantage/${projectId}/${user.id}`;
  let uploaded;
  try {
    uploaded = await uploadToCloudinary({
      bytes,
      mime,
      name,
      folder,
      publicId: id,
    });
  } catch (err) {
    throw new HttpError(502, err instanceof Error ? err.message : "Cloudinary upload failed.");
  }

  const { data, error } = await sb
    .from("vantage_files")
    .insert({
      id,
      project_id: projectId,
      author_user_id: user.id,
      report_id: input.reportId || null,
      year: input.year ?? null,
      month: input.month ?? null,
      name,
      storage_path: uploaded.public_id,
      resource_type: uploaded.resource_type || "raw",
      url: uploaded.secure_url || uploaded.url || "",
      mime,
      size_bytes: uploaded.bytes || bytes.length,
    })
    .select("*")
    .single();
  if (error || !data) {
    await destroyOnCloudinary(uploaded.public_id, uploaded.resource_type || "raw");
    throw new HttpError(502, `Supabase: ${error?.message || "Could not save file metadata."}`);
  }

  const [view] = await fileViews([data as FileRow]);
  return view;
}

export async function signedFileUrl(fileId: string, user: CloudUser): Promise<{ url: string; name: string; mime: string }> {
  const sb = requireSupabaseStore();
  const { data, error } = await sb.from("vantage_files").select("*").eq("id", fileId).maybeSingle();
  const row = unwrap(data, error, null) as FileRow | null;
  if (!row) throw new HttpError(404, "File not found.");
  const { isLead } = await projectAccess(row.project_id, user);
  if (!isLead && row.author_user_id !== user.id) {
    throw new HttpError(403, "You cannot download that file.");
  }
  if (!row.url?.startsWith("http")) throw new HttpError(502, "That file has no Cloudinary URL.");
  return { url: deliveryUrl(row), name: row.name, mime: row.mime };
}

export async function deleteProjectFile(fileId: string, user: CloudUser) {
  const sb = requireSupabaseStore();
  const { data, error } = await sb.from("vantage_files").select("*").eq("id", fileId).maybeSingle();
  const row = unwrap(data, error, null) as FileRow | null;
  if (!row) throw new HttpError(404, "File not found.");
  const { isLead } = await projectAccess(row.project_id, user);
  if (!isLead && row.author_user_id !== user.id) {
    throw new HttpError(403, "You cannot delete that file.");
  }
  await destroyOnCloudinary(row.storage_path, row.resource_type || "raw");
  const { error: delError } = await sb.from("vantage_files").delete().eq("id", fileId);
  if (delError) throw new HttpError(502, `Supabase: ${delError.message}`);
  return { ok: true as const };
}
