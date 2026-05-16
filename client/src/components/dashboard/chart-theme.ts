export const CHART_PALETTE = [
  "#d4a017",
  "#8b5cf6",
  "#10b981",
  "#06b6d4",
  "#f59e0b",
  "#ec4899",
  "#3b82f6",
  "#ef4444",
  "#14b8a6",
  "#a855f7",
];

export const CHART_SEMANTIC = {
  primary:    "#d4a017",
  violet:     "#8b5cf6",
  success:    "#10b981",
  info:       "#06b6d4",
  warning:    "#f59e0b",
  danger:     "#ef4444",
  pink:       "#ec4899",
  blue:       "#3b82f6",
  teal:       "#14b8a6",
};

export const chartColor = (i: number) => CHART_PALETTE[i % CHART_PALETTE.length];

export const chartTooltipStyle = {
  contentStyle: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: "10px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
    fontSize: "12px",
    padding: "8px 12px",
  },
  labelStyle: { color: "#6b7280", fontWeight: 500, marginBottom: 4 },
  itemStyle: { color: "#111827", fontWeight: 600 },
} as const;

export const chartAxisStyle = {
  tick: { fill: "#9ca3af", fontSize: 11 },
  axisLine: { stroke: "#e5e7eb" },
  tickLine: { stroke: "#e5e7eb" },
} as const;

export const chartGridStyle = {
  stroke: "#f3f4f6",
  strokeDasharray: "3 3",
  vertical: false,
} as const;
