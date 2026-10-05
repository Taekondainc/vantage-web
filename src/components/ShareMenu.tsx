import { useState } from "react";
import { copyText, downloadText, openGmail, shareBody } from "../share";

function slugify(title: string) {
  return (
    title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "report"
  );
}

export function ShareMenu({ title, markdown, disabled }: { title: string; markdown: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const body = shareBody(markdown);

  return (
    <div className="share-panel">
      <button type="button" className="ghost" disabled={disabled} onClick={() => setOpen((v) => !v)}>
        {open ? "Close share" : "Share"}
      </button>
      {open ? (
        <div className="share-panel-menu">
          <button
            type="button"
            className="ghost"
            disabled={disabled}
            onClick={() => {
              void copyText(body).then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1600);
              });
            }}
          >
            {copied ? "Copied" : "Copy"}
          </button>
          <button type="button" className="ghost" disabled={disabled} onClick={() => openGmail(title, body)}>
            Gmail
          </button>
          <button
            type="button"
            className="ghost"
            disabled={disabled}
            onClick={() => downloadText(`${slugify(title)}.md`, markdown)}
          >
            Download
          </button>
        </div>
      ) : null}
    </div>
  );
}
