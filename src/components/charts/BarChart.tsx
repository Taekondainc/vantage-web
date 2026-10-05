import type { ChartDef } from "../../lib/metricDefinitions";
import type { ChartDatum } from "../../lib/reportChartData";
import { ChartCard } from "../ChartCard";

type Props = {
  data: ChartDatum[];
  chart: Pick<ChartDef, "title" | "description" | "source" | "unit">;
  height?: number;
  emptyLabel?: string;
};

function openDatum(item: ChartDatum) {
  if (item.href) window.open(item.href, "_blank", "noopener,noreferrer");
}

function shortLabel(label: string, max = 10) {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

export function BarChart({ data, chart, height = 200, emptyLabel = "No data for this period" }: Props) {
  if (data.length === 0) {
    return <ChartCard chart={chart} emptyLabel={emptyLabel} isEmpty />;
  }

  const max = Math.max(...data.map((d) => d.value), 1);
  const left = 40;
  const bottom = 48;
  const top = 20;
  const right = 12;
  const plotHeight = height - top - bottom;
  const plotWidth = Math.max(data.length * 56, 220);
  const slot = plotWidth / data.length;
  const barWidth = Math.min(36, slot - 12);
  const svgWidth = left + plotWidth + right;
  const ariaLabel = data.map((item) => `${item.fullLabel ?? item.label}: ${item.value}`).join("; ");

  const ticks = [0, 0.5, 1].map((t) => Math.round(max * t));

  return (
    <ChartCard chart={chart}>
      <svg
        className="chart-svg bar-chart"
        viewBox={`0 0 ${svgWidth} ${height}`}
        role="img"
        aria-label={`${chart.title}. ${ariaLabel}`}
      >
        {ticks.map((tick) => {
          const y = top + plotHeight - (tick / max) * plotHeight;
          return (
            <g key={`tick-${tick}`}>
              <line
                x1={left}
                x2={left + plotWidth}
                y1={y}
                y2={y}
                className="chart-gridline"
              />
              <text x={left - 8} y={y + 4} textAnchor="end" className="chart-axis-label">
                {tick}
              </text>
            </g>
          );
        })}

        <line
          x1={left}
          x2={left + plotWidth}
          y1={top + plotHeight}
          y2={top + plotHeight}
          className="chart-axis-line"
        />

        {data.map((item, index) => {
          const barHeight = Math.max(4, (item.value / max) * plotHeight);
          const x = left + index * slot + (slot - barWidth) / 2;
          const y = top + plotHeight - barHeight;
          const clickable = Boolean(item.href);
          return (
            <g
              key={`${item.label}-${index}`}
              className={clickable ? "chart-bar-clickable" : undefined}
              onClick={clickable ? () => openDatum(item) : undefined}
              style={clickable ? { cursor: "pointer" } : undefined}
            >
              <title>
                {(item.fullLabel ?? item.label) + `: ${item.value} ${chart.unit}`}
                {item.href ? " — click to open on GitHub" : ""}
              </title>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={4}
                fill={item.color ?? "var(--brand)"}
                opacity={0.92}
              />
              <text x={x + barWidth / 2} y={y - 6} textAnchor="middle" className="chart-value-label">
                {item.value}
              </text>
              <text
                x={x + barWidth / 2}
                y={top + plotHeight + 18}
                textAnchor="middle"
                className="chart-axis-label chart-bar-xlabel"
              >
                {shortLabel(item.label)}
              </text>
              {item.fullLabel && item.fullLabel !== item.label ? (
                <text
                  x={x + barWidth / 2}
                  y={top + plotHeight + 34}
                  textAnchor="middle"
                  className="chart-axis-sublabel"
                >
                  {shortLabel(item.fullLabel.split("/")[0] ?? "", 8)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </ChartCard>
  );
}
