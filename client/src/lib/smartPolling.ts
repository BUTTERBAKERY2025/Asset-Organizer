export function smartInterval(ms: number): () => number | false {
  return () => (typeof document !== "undefined" && document.hidden ? false : ms);
}
