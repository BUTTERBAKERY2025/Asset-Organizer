/** Real 320px browsing context, without source markup or layout changes. */
export function Narrow() {
  return <iframe title="Exact transfer source · synthetic fixtures · 320px" src={"/__mockup/preview/transfer-requests-source/Current" + window.location.search} style={{ display: "block", width: 320, height: 1400, border: 0 }} />;
}