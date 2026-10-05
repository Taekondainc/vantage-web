import type { ReactNode } from "react";
import type { ChartDef } from "../lib/metricDefinitions";

type Props = {
  chart: Pick<ChartDef, "title" | "description" | "source" | "unit">;
  emptyLabel?: string;
  isEmpty?: boolean;
  wide?: boolean;
  children?: ReactNode;
};

export function ChartCard({ chart, emptyLabel = "No data for this period", isEmpty, wide, children }: Props) {
  return (
    <figure className={`chart-card${wide ? " chart-card-wide" : ""}`}>
      <figcaption className="chart-caption">
        <h4 className="chart-title">{chart.title}</h4>
        <p className="chart-description">{chart.description}</p>
      </figcaption>
      {isEmpty ? <p className="chart-empty">{emptyLabel}</p> : children}
      <footer className="chart-meta">
        <span className="chart-unit">Unit: {chart.unit}</span>
        <span className="chart-source">Source: {chart.source}</span>
      </footer>
    </figure>
  );
}
