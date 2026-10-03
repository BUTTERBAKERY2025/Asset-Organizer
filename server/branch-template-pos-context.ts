import { storage } from "./storage";

export async function branchTemplatePosContext(req: any) {
  const { path, method } = req;
  const sale = path.match(/^\/api\/pos\/sale\/([1-9]\d*)$/)
    ?? path.match(/^\/api\/pos\/sales\/([1-9]\d*)\/(?:void|refund|refunds|partial-refund)$/);
  const shift = path.match(/^\/api\/pos\/shifts\/([1-9]\d*)\/(?:stats|close)$/);
  const event = path.match(/^\/api\/pos\/events\/([1-9]\d*)(?:\/(?:report|shifts))?$/);
  const product = method !== "GET" && path.match(/^\/api\/pos\/branch-products\/([1-9]\d*)$/);
  const held = method === "DELETE" && path.match(/^\/api\/pos\/held-orders\/([1-9]\d*)$/);
  if (sale || shift || event || product || held) {
    const row = sale ? await storage.getPosSaleById(Number(sale[1]))
      : shift ? await storage.getPosShiftById(Number(shift[1]))
      : event ? await storage.getPosEventById(Number(event[1]))
      : product ? await storage.getBranchProductById(Number(product[1]))
      : await storage.getHeldOrderById(Number((held as RegExpMatchArray)[1]));
    return row ? { kind: "resource" as const, branchId: row.branchId } : null;
  }
  if (method === "GET") {
    const branch = path.match(/^\/api\/pos\/(?:branch-products|invoice-settings|sales|held-orders|report)\/([^/]+)(?:\/product-details)?$/)
      ?? path.match(/^\/api\/pos\/summary\/([^/]+)\/[^/]+$/);
    if (branch) return { kind: "resource" as const, branchId: req.params.branchId };
    if (["/api/pos/events", "/api/pos/shifts/current"].includes(path) && typeof req.query.branchId === "string")
      return { kind: "resource" as const, branchId: req.query.branchId };
  }
  if (method === "POST" && ["/api/pos/branch-products", "/api/pos/invoice-settings",
    "/api/pos/sales", "/api/pos/held-orders", "/api/pos/events", "/api/pos/shifts/open"].includes(path)
    && typeof req.body?.branchId === "string")
    return { kind: "resource" as const, branchId: req.body.branchId };
  return undefined;
}