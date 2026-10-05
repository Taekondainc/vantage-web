import type { ReactNode } from "react";

export type TabItem = {
  id: string;
  label: string;
  badge?: string | number;
};

export function Tabs({
  tabs,
  active,
  onChange,
  children,
}: {
  tabs: TabItem[];
  active: string;
  onChange: (id: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="tabs">
      <div className="tab-bar" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            className={active === tab.id ? "tab active" : "tab"}
            aria-selected={active === tab.id}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
            {tab.badge !== undefined ? <span className="tab-badge">{tab.badge}</span> : null}
          </button>
        ))}
      </div>
      <div className="tab-panels">{children}</div>
    </div>
  );
}

export function TabPanel({ id, active, children }: { id: string; active: string; children: ReactNode }) {
  if (active !== id) return null;
  return <div className="tab-panel">{children}</div>;
}
