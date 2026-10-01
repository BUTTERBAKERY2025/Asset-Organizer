/** A genuine 390px browsing context so CSS/media queries remain unmodified. */
export function Narrow() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has("from")) params.set("from", "branch-supply");
  if (!params.has("branchId")) params.set("branchId", "medina");
  return <iframe
    title="Exact kitchen daily source · synthetic branch manager · 390px"
    src={`/__mockup/preview/kitchen-daily-source/Current?${params}`}
    style={{ display: "block", width: 390, height: 1600, border: 0 }}
  />;
}