-- Store an encrypted GitHub access token per user so the web app can fetch
-- private/org repo activity for the signed-in user, not just public events.
-- Encrypted with AES-256-GCM using TOKEN_ENCRYPTION_KEY (server-side only).

alter table public.vantage_users
  add column if not exists github_token_enc text;
