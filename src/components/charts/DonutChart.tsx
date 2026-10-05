import type { ChartDef } from "../../lib/metricDefinitions";
import type { ChartDatum } from "../../lib/reportChartData";
import { ChartCard } from "../ChartCard";

type Props = {
  data: ChartDatum[];
  chart: Pick<ChartDef, "title" | "description" | "source" | "unit">;
  emptyLabel?: string;
};

function openDatum(item: ChartDatum) {
  if (item.href) window.open(item.href, "_blank", "noopener,noreferrer");
}

export function DonutChart({ data, chart, emptyLabel = "No data for this period" }: Props) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return <ChartCard chart={chart} emptyLabel={emptyLabel} isEmpty />;
  }

  const size = 140;
  const stroke = 22;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  const segments = data.map((item, index) => {
    const fraction = item.value / total;
    const length = fraction * circumference;
    const segment = {
      ...item,
      dasharray: `${length} ${circumference - length}`,
      dashoffset: -offset,
      key: `${item.label}-${index}`,
    };
    offset += length;
    return segment;
  });

  const ariaLabel = data
    .map((item) => `${item.fullLabel ?? item.label}: ${item.value} (${Math.round((item.value / total) * 100)}%)`)
    .join("; ");

  return (
    <ChartCard chart={chart}>
      <div className="donut-layout">
        <svg
          className="chart-svg donut-chart"
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={`${chart.title}. ${ariaLabel}`}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--line)"
            strokeWidth={stroke}
          />
          {segments.map((seg) => (
            <circle
              key={seg.key}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={seg.color ?? "var(--brand)"}
              strokeWidth={stroke}
              strokeDasharray={seg.dasharray}
              strokeDashoffset={seg.dashoffset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            >
              <title>
                {(seg.fullLabel ?? seg.label) + `: ${seg.value} ${chart.unit}`}
              </title>
            </circle>
          ))}
          <text x={size / 2} y={size / 2 - 4} textAnchor="middle" className="donut-total" fontSize="20">
            {total}
          </text>
          <text x={size / 2} y={size / 2 + 16} textAnchor="middle" className="donut-center-label">
            total
          </text>
        </svg>
        <ul className="donut-legend" aria-label={`${chart.title} legend`}>
          {data.map((item, index) => (
            <li key={`${item.label}-${index}`}>
              {item.href ? (
                <button type="button" className="donut-legend-button" onClick={() => openDatum(item)}>
                  <span className="donut-swatch" style={{ background: item.color ?? "var(--brand)" }} />
                  <span title={item.fullLabel ?? item.label}>{item.label}</span>
                  <strong>{item.value}</strong>
                </button>
              ) : (
                <>
                  <span className="donut-swatch" style={{ background: item.color ?? "var(--brand)" }} />
                  <span title={item.fullLabel ?? item.label}>{item.label}</span>
                  <strong>{item.value}</strong>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
    </ChartCard>
  );
}
