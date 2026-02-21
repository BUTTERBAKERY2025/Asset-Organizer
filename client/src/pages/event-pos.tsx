import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  ShoppingCart, Plus, Minus, Trash2, CreditCard, Banknote,
  Receipt, Search, Settings, Package, Printer,
  X, Check, Store, CalendarDays, Percent,
  Sparkles, TrendingUp, Hash, Clock, Loader2,
  ListOrdered, Zap, Coffee, Pause, Play, Ban,
  RotateCcw, FileText, Download, Filter, AlertTriangle,
  SplitSquareHorizontal, Calendar
} from "lucide-react";
import { useReactToPrint } from "react-to-print";
import { QRCodeSVG } from "qrcode.react";

const EVENT_BRANCH_ID = "EVENT-BB";

interface CartItem {
  productId: number;
  productName: string;
  unitPrice: number;
  vatRate: number;
  quantity: number;
}

interface BranchProductWithDetails {
  id: number;
  branchId: string;
  productId: number;
  isActive: boolean;
  priceOverride: number | null;
  sortOrder: number | null;
  product?: {
    id: number;
    name: string;
    category: string;
    basePrice: number | null;
    vatRate: number | null;
    unit: string | null;
  };
}

function generateZatcaQrBase64(sellerName: string, vatNumber: string, timestamp: string, totalWithVat: string, vatAmount: string): string {
  const encoder = new TextEncoder();
  const tlvParts: Uint8Array[] = [];
  const fields = [
    { tag: 1, value: sellerName },
    { tag: 2, value: vatNumber },
    { tag: 3, value: timestamp },
    { tag: 4, value: totalWithVat },
    { tag: 5, value: vatAmount },
  ];
  for (const field of fields) {
    const encoded = encoder.encode(field.value);
    const tlv = new Uint8Array(2 + encoded.length);
    tlv[0] = field.tag;
    tlv[1] = encoded.length;
    tlv.set(encoded, 2);
    tlvParts.push(tlv);
  }
  const totalLength = tlvParts.reduce((sum, p) => sum + p.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of tlvParts) {
    combined.set(part, offset);
    offset += part.length;
  }
  let binary = "";
  for (let i = 0; i < combined.length; i++) {
    binary += String.fromCharCode(combined[i]);
  }
  return btoa(binary);
}

const categoryIcons: Record<string, any> = {
  "حلويات": Coffee,
  "مشروبات": Coffee,
  "معجنات": Package,
  "كيك": Coffee,
};

export default function EventPosPage() {
  const { user } = useAuth();
  const { canEdit, canDelete } = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const receiptRef = useRef<HTMLDivElement>(null);
  const zReportRef = useRef<HTMLDivElement>(null);
  const isManager = canEdit("event_pos");
  const canVoid = canDelete("event_pos");
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [amountPaid, setAmountPaid] = useState<string>("");
  const [showCheckout, setShowCheckout] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const [discountType, setDiscountType] = useState<string | null>(null);
  const [discountValue, setDiscountValue] = useState<string>("");
  const [showDiscount, setShowDiscount] = useState(false);

  const [splitMode, setSplitMode] = useState(false);
  const [cashSplitAmount, setCashSplitAmount] = useState<string>("");

  const [showHeld, setShowHeld] = useState(false);
  const [holdLabel, setHoldLabel] = useState("");
  const [showHoldDialog, setShowHoldDialog] = useState(false);

  const [showVoid, setShowVoid] = useState(false);
  const [voidSaleId, setVoidSaleId] = useState<number | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidAction, setVoidAction] = useState<"void" | "refund">("void");

  const [showZReport, setShowZReport] = useState(false);

  const [historyDateFrom, setHistoryDateFrom] = useState<string>(new Date().toISOString().slice(0, 10));
  const [historyDateTo, setHistoryDateTo] = useState<string>(new Date().toISOString().slice(0, 10));

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("pos_cart_backup");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) setCart(parsed);
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (cart.length > 0) {
      localStorage.setItem("pos_cart_backup", JSON.stringify(cart));
    } else {
      localStorage.removeItem("pos_cart_backup");
    }
  }, [cart]);

  const { data: branchProducts = [], isLoading: productsLoading } = useQuery({
    queryKey: ["/api/pos/branch-products", EVENT_BRANCH_ID],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/pos/branch-products/${EVENT_BRANCH_ID}`);
      return res.json();
    },
  });

  const { data: invoiceSettings } = useQuery({
    queryKey: ["/api/pos/invoice-settings", EVENT_BRANCH_ID],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/pos/invoice-settings/${EVENT_BRANCH_ID}`);
      return res.json();
    },
  });

  const { data: todaySales = [] } = useQuery({
    queryKey: ["/api/pos/sales", EVENT_BRANCH_ID, historyDateFrom, historyDateTo],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/pos/sales/${EVENT_BRANCH_ID}?dateFrom=${historyDateFrom}&dateTo=${historyDateTo}`);
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: todaySummary } = useQuery({
    queryKey: ["/api/pos/summary", EVENT_BRANCH_ID],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const res = await apiRequest("GET", `/api/pos/summary/${EVENT_BRANCH_ID}/${today}`);
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: heldOrders = [], refetch: refetchHeld } = useQuery({
    queryKey: ["/api/pos/held-orders", EVENT_BRANCH_ID],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/pos/held-orders/${EVENT_BRANCH_ID}`);
      return res.json();
    },
  });

  const filteredProducts = useMemo(() => {
    const activeProducts = (branchProducts as BranchProductWithDetails[]).filter((bp: BranchProductWithDetails) => bp.isActive && bp.product);
    if (!searchQuery.trim()) return activeProducts;
    const q = searchQuery.toLowerCase();
    return activeProducts.filter((bp: BranchProductWithDetails) => 
      bp.product?.name?.toLowerCase().includes(q) || 
      bp.product?.category?.toLowerCase().includes(q)
    );
  }, [branchProducts, searchQuery]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    (branchProducts as BranchProductWithDetails[]).forEach((bp: BranchProductWithDetails) => {
      if (bp.product?.category) cats.add(bp.product.category);
    });
    return Array.from(cats);
  }, [branchProducts]);

  const displayProducts = useMemo(() => {
    if (selectedCategory === "all") return filteredProducts;
    return filteredProducts.filter((bp: BranchProductWithDetails) => bp.product?.category === selectedCategory);
  }, [filteredProducts, selectedCategory]);

  const cartTotal = useMemo(() => {
    let rawSubtotal = 0;
    let rawVat = 0;
    cart.forEach(item => {
      const priceExclVat = item.unitPrice / (1 + item.vatRate);
      rawSubtotal += priceExclVat * item.quantity;
      rawVat += (item.unitPrice - priceExclVat) * item.quantity;
    });
    const rawTotal = rawSubtotal + rawVat;
    let discountAmt = 0;
    if (discountType === "percentage") {
      discountAmt = rawTotal * (parseFloat(discountValue) || 0) / 100;
    } else if (discountType === "fixed") {
      discountAmt = parseFloat(discountValue) || 0;
    }
    discountAmt = Math.min(discountAmt, rawTotal);
    const discountRatio = rawTotal > 0 ? discountAmt / rawTotal : 0;
    const adjSubtotal = rawSubtotal * (1 - discountRatio);
    const adjVat = rawVat * (1 - discountRatio);
    const finalTotal = adjSubtotal + adjVat;
    return {
      subtotal: Math.round(adjSubtotal * 100) / 100,
      vat: Math.round(adjVat * 100) / 100,
      rawTotal: Math.round(rawTotal * 100) / 100,
      discount: Math.round(discountAmt * 100) / 100,
      total: Math.round(finalTotal * 100) / 100,
    };
  }, [cart, discountType, discountValue]);

  const cartItemsCount = useMemo(() => cart.reduce((acc, item) => acc + item.quantity, 0), [cart]);

  const changeAmount = useMemo(() => {
    if (splitMode) return 0;
    const paid = parseFloat(amountPaid) || 0;
    return Math.max(0, Math.round((paid - cartTotal.total) * 100) / 100);
  }, [amountPaid, cartTotal.total, splitMode]);

  const networkSplitAmount = useMemo(() => {
    if (!splitMode) return 0;
    const cashPart = parseFloat(cashSplitAmount) || 0;
    return Math.max(0, Math.round((cartTotal.total - cashPart) * 100) / 100);
  }, [splitMode, cashSplitAmount, cartTotal.total]);

  const addToCart = useCallback((bp: BranchProductWithDetails) => {
    if (!bp.product) return;
    const price = bp.priceOverride ?? bp.product.basePrice ?? 0;
    const vatRate = bp.product.vatRate ?? 0.15;
    setCart(prev => {
      const existing = prev.find(c => c.productId === bp.productId);
      if (existing) {
        return prev.map(c => c.productId === bp.productId ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { productId: bp.productId, productName: bp.product!.name, unitPrice: price, vatRate, quantity: 1 }];
    });
  }, []);

  const updateQuantity = useCallback((productId: number, delta: number) => {
    setCart(prev => {
      const updated = prev.map(c => {
        if (c.productId === productId) {
          const newQty = c.quantity + delta;
          return newQty <= 0 ? null : { ...c, quantity: newQty };
        }
        return c;
      }).filter(Boolean) as CartItem[];
      return updated;
    });
  }, []);

  const setQuantityDirect = useCallback((productId: number, qty: number) => {
    if (qty <= 0) {
      setCart(prev => prev.filter(c => c.productId !== productId));
    } else {
      setCart(prev => prev.map(c => c.productId === productId ? { ...c, quantity: qty } : c));
    }
  }, []);

  const removeFromCart = useCallback((productId: number) => {
    setCart(prev => prev.filter(c => c.productId !== productId));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setAmountPaid("");
    setPaymentMethod("cash");
    setDiscountType(null);
    setDiscountValue("");
    setSplitMode(false);
    setCashSplitAmount("");
  }, []);

  const createSaleMutation = useMutation({
    mutationFn: async () => {
      const now = new Date();
      let finalPaymentMethod = paymentMethod;
      let cashAmt = 0;
      let networkAmt = 0;
      if (splitMode) {
        finalPaymentMethod = "split";
        cashAmt = parseFloat(cashSplitAmount) || 0;
        networkAmt = networkSplitAmount;
      } else if (paymentMethod === "cash") {
        cashAmt = cartTotal.total;
      } else {
        networkAmt = cartTotal.total;
      }
      const saleData = {
        branchId: EVENT_BRANCH_ID,
        cashierId: user?.id || "",
        cashierName: (user as any)?.fullName || user?.username || "",
        saleDate: now.toISOString().slice(0, 10),
        saleTime: now.toTimeString().slice(0, 8),
        subtotal: cartTotal.subtotal,
        vatAmount: cartTotal.vat,
        totalAmount: cartTotal.total,
        discountType: discountType || undefined,
        discountValue: discountType ? (parseFloat(discountValue) || 0) : 0,
        discountAmount: cartTotal.discount,
        paymentMethod: finalPaymentMethod,
        cashAmount: cashAmt,
        networkAmount: networkAmt,
        amountPaid: splitMode ? cartTotal.total : (paymentMethod === "cash" ? parseFloat(amountPaid) || cartTotal.total : cartTotal.total),
        changeAmount: splitMode ? 0 : (paymentMethod === "cash" ? changeAmount : 0),
        status: "completed",
        items: cart.map(item => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          vatRate: item.vatRate,
          vatAmount: Math.round((item.unitPrice - item.unitPrice / (1 + item.vatRate)) * item.quantity * 100) / 100,
          totalPrice: Math.round(item.unitPrice * item.quantity * 100) / 100,
        })),
      };
      const res = await apiRequest("POST", "/api/pos/sales", saleData);
      return res.json();
    },
    onSuccess: (data: any) => {
      setLastSale({ ...data, items: cart.map(item => ({
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        vatRate: item.vatRate,
        totalPrice: Math.round(item.unitPrice * item.quantity * 100) / 100,
      })), paymentMethod: splitMode ? "split" : paymentMethod, 
        amountPaid: splitMode ? cartTotal.total : (parseFloat(amountPaid) || cartTotal.total), 
        changeAmount: splitMode ? 0 : changeAmount,
        cashAmount: splitMode ? (parseFloat(cashSplitAmount) || 0) : (paymentMethod === "cash" ? cartTotal.total : 0),
        networkAmount: splitMode ? networkSplitAmount : (paymentMethod === "network" ? cartTotal.total : 0),
        discountType, discountValue: parseFloat(discountValue) || 0, discountAmount: cartTotal.discount,
      });
      setShowCheckout(false);
      setShowReceipt(true);
      clearCart();
      queryClient.invalidateQueries({ queryKey: ["/api/pos/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pos/summary"] });
      toast({ title: "تم إتمام البيع بنجاح" });
    },
    onError: (err: any) => {
      toast({ title: "خطأ في إتمام البيع", description: err?.message, variant: "destructive" });
    },
  });

  const voidMutation = useMutation({
    mutationFn: async ({ saleId, reason, action }: { saleId: number; reason: string; action: string }) => {
      const res = await apiRequest("POST", `/api/pos/sales/${saleId}/${action}`, { reason });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pos/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pos/summary"] });
      setShowVoid(false);
      setVoidReason("");
      setVoidSaleId(null);
      toast({ title: voidAction === "void" ? "تم إلغاء الفاتورة" : "تم استرجاع الفاتورة" });
    },
    onError: (err: any) => {
      toast({ title: "خطأ", description: err?.message, variant: "destructive" });
    },
  });

  const holdOrderMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/pos/held-orders", {
        branchId: EVENT_BRANCH_ID,
        cashierId: user?.id || "",
        cashierName: (user as any)?.fullName || user?.username || "",
        label: holdLabel || `طلب ${new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}`,
        cartData: JSON.stringify(cart),
        paymentMethod,
        discountType,
        discountValue: parseFloat(discountValue) || 0,
        totalAmount: cartTotal.total,
      });
      return res.json();
    },
    onSuccess: () => {
      clearCart();
      setShowHoldDialog(false);
      setHoldLabel("");
      refetchHeld();
      toast({ title: "تم تعليق الطلب" });
    },
  });

  const deleteHeldMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/pos/held-orders/${id}`);
    },
    onSuccess: () => {
      refetchHeld();
      toast({ title: "تم حذف الطلب المعلق" });
    },
  });

  const handlePrint = useReactToPrint({
    contentRef: receiptRef,
    pageStyle: `
      @page { size: 80mm auto !important; margin: 0 !important; padding: 0 !important; }
      @media print {
        * { box-sizing: border-box !important; }
        html, body { width: 80mm !important; height: auto !important; margin: 0 !important; padding: 0 !important; background: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; font-family: 'Cairo', sans-serif !important; overflow: visible !important; }
        body * { visibility: hidden !important; }
        .receipt-print, .receipt-print * { visibility: visible !important; }
        .receipt-print { position: absolute !important; top: 0 !important; left: 0 !important; width: 76mm !important; max-width: 76mm !important; margin: 0 !important; padding: 2mm !important; font-size: 11px !important; line-height: 1.3 !important; font-family: 'Cairo', sans-serif !important; color: #000 !important; background: white !important; box-shadow: none !important; border: none !important; border-radius: 0 !important; page-break-inside: avoid !important; overflow: visible !important; }
        .receipt-print div { display: block !important; page-break-inside: avoid !important; }
        .receipt-print .receipt-row { display: flex !important; justify-content: space-between !important; }
        .receipt-print table { width: 100% !important; border-collapse: collapse !important; border: none !important; box-shadow: none !important; page-break-inside: avoid !important; }
        .receipt-print th, .receipt-print td { border: none !important; padding: 1px 0 !important; font-size: 10px !important; background: transparent !important; color: #000 !important; box-shadow: none !important; }
        .receipt-print .receipt-separator { visibility: visible !important; border: none !important; border-top: 1px dashed #000 !important; margin: 2px 0 !important; height: 0 !important; padding: 0 !important; }
        .receipt-print img { max-height: 35px !important; max-width: 45mm !important; }
        .receipt-print svg { visibility: visible !important; display: block !important; margin: 0 auto !important; max-width: 25mm !important; max-height: 25mm !important; }
        .receipt-print canvas { visibility: visible !important; display: block !important; }
      }
    `,
  });

  const handleZReportPrint = useReactToPrint({
    contentRef: zReportRef,
    pageStyle: `
      @page { size: 80mm auto; margin: 0mm; }
      @media print {
        html, body { width: 80mm !important; margin: 0 !important; padding: 0 !important; background: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; font-family: 'Cairo', sans-serif !important; }
        body * { visibility: hidden !important; }
        .zreport-print, .zreport-print * { visibility: visible !important; }
        .zreport-print { position: absolute !important; top: 0 !important; left: 0 !important; width: 72mm !important; max-width: 72mm !important; margin: 0 !important; padding: 3mm !important; font-size: 11px !important; line-height: 1.4 !important; font-family: 'Cairo', sans-serif !important; color: #000 !important; background: white !important; }
        .zreport-print .receipt-row { display: flex !important; justify-content: space-between !important; }
        .zreport-print .receipt-separator { border: none !important; border-top: 1px dashed #000 !important; margin: 4px 0 !important; }
      }
    `,
  });

  const handleCheckout = () => {
    if (cart.length === 0) return;
    if (!splitMode && paymentMethod === "cash") {
      setAmountPaid(String(cartTotal.total));
    }
    setShowCheckout(true);
  };

  const handleCompleteSale = () => {
    if (splitMode) {
      const cashPart = parseFloat(cashSplitAmount) || 0;
      if (cashPart < 0 || cashPart > cartTotal.total) {
        toast({ title: "مبلغ النقد غير صحيح", variant: "destructive" });
        return;
      }
    } else if (paymentMethod === "cash" && (parseFloat(amountPaid) || 0) < cartTotal.total) {
      toast({ title: "المبلغ المدفوع أقل من الإجمالي", variant: "destructive" });
      return;
    }
    createSaleMutation.mutate();
  };

  const recallHeldOrder = (order: any) => {
    try {
      const items = JSON.parse(order.cartData);
      setCart(items);
      if (order.paymentMethod) setPaymentMethod(order.paymentMethod);
      if (order.discountType) {
        setDiscountType(order.discountType);
        setDiscountValue(String(order.discountValue || ""));
      }
      deleteHeldMutation.mutate(order.id);
      setShowHeld(false);
      toast({ title: "تم استرجاع الطلب" });
    } catch {
      toast({ title: "خطأ في استرجاع الطلب", variant: "destructive" });
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "F1") { e.preventDefault(); handleCheckout(); }
      if (e.key === "F2") { e.preventDefault(); if (cart.length > 0) setShowHoldDialog(true); }
      if (e.key === "F3") { e.preventDefault(); setShowHeld(true); }
      if (e.key === "Escape") { setShowCheckout(false); setShowReceipt(false); setShowHistory(false); setShowHeld(false); setShowVoid(false); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cart, cartTotal]);

  const zReportData = useMemo(() => {
    const completedSales = todaySales.filter((s: any) => s.status === "completed");
    const voidedSales = todaySales.filter((s: any) => s.status === "voided");
    const refundedSales = todaySales.filter((s: any) => s.status === "refunded");
    const totalSales = completedSales.reduce((sum: number, s: any) => sum + (s.totalAmount || 0), 0);
    const cashTotal = completedSales.filter((s: any) => s.paymentMethod === "cash").reduce((sum: number, s: any) => sum + (s.totalAmount || 0), 0);
    const networkTotal = completedSales.filter((s: any) => s.paymentMethod === "network").reduce((sum: number, s: any) => sum + (s.totalAmount || 0), 0);
    const splitTotal = completedSales.filter((s: any) => s.paymentMethod === "split").reduce((sum: number, s: any) => sum + (s.totalAmount || 0), 0);
    const splitCash = completedSales.filter((s: any) => s.paymentMethod === "split").reduce((sum: number, s: any) => sum + (s.cashAmount || 0), 0);
    const splitNetwork = completedSales.filter((s: any) => s.paymentMethod === "split").reduce((sum: number, s: any) => sum + (s.networkAmount || 0), 0);
    const totalDiscount = completedSales.reduce((sum: number, s: any) => sum + (s.discountAmount || 0), 0);
    const totalVat = completedSales.reduce((sum: number, s: any) => sum + (s.vatAmount || 0), 0);
    return { completedSales, voidedSales, refundedSales, totalSales, cashTotal, networkTotal, splitTotal, splitCash, splitNetwork, totalDiscount, totalVat, totalCashInDrawer: cashTotal + splitCash };
  }, [todaySales]);

  const timeStr = currentTime.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
  const dateStr = currentTime.toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="h-[100dvh] flex flex-col bg-[#f0f2f5] overflow-hidden select-none" dir="rtl">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-gray-200 px-5 py-2 flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-orange-500 to-amber-400 rounded-xl flex items-center justify-center shadow-sm">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-black text-gray-900 leading-tight" data-testid="text-pos-title">إيفنت موسمي</h1>
              <p className="text-[10px] text-gray-400 leading-tight">{(user as any)?.fullName || user?.username}</p>
            </div>
          </div>
          <div className="h-8 w-px bg-gray-200" />
          <div className="text-[11px] text-gray-400">
            <span>{dateStr}</span>
            <span className="mx-1.5">|</span>
            <span className="font-mono font-bold text-gray-600">{timeStr}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {heldOrders.length > 0 && (
            <button
              onClick={() => setShowHeld(true)}
              className="relative flex items-center gap-1.5 bg-amber-50 text-amber-700 rounded-lg px-3 py-1.5 border border-amber-200 hover:bg-amber-100 transition-all active:scale-95 touch-manipulation"
              data-testid="button-held-orders"
            >
              <Pause className="w-3.5 h-3.5" />
              <span className="text-xs font-bold">{heldOrders.length} معلق</span>
            </button>
          )}
          {isManager && todaySummary && (
            <>
              <div className="flex items-center gap-1.5 bg-green-50 text-green-700 rounded-lg px-3 py-1.5 border border-green-200">
                <TrendingUp className="w-3.5 h-3.5" />
                <span className="text-xs font-bold">{(todaySummary.totalSales || 0).toFixed(0)}</span>
                <span className="text-[10px] text-green-500">ر.س</span>
              </div>
              <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 rounded-lg px-3 py-1.5 border border-blue-200">
                <Receipt className="w-3.5 h-3.5" />
                <span className="text-xs font-bold">{todaySummary.totalTransactions || 0}</span>
                <span className="text-[10px] text-blue-500">فاتورة</span>
              </div>
            </>
          )}
          {isManager && (
            <>
              <div className="h-8 w-px bg-gray-200 mx-1" />
              <button
                onClick={() => setShowZReport(true)}
                className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center hover:bg-purple-100 transition-all active:scale-90 touch-manipulation border border-purple-200"
                title="تقرير الوردية (F4)"
                data-testid="button-zreport"
              >
                <FileText className="w-4.5 h-4.5 text-purple-600" />
              </button>
              <button
                onClick={() => setShowHistory(true)}
                className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-all active:scale-90 touch-manipulation"
                title="سجل المبيعات"
                data-testid="button-history"
              >
                <ListOrdered className="w-4.5 h-4.5 text-gray-600" />
              </button>
              <a
                href="/event-pos-settings"
                className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-all active:scale-90 touch-manipulation"
                title="الإعدادات"
                data-testid="button-settings"
              >
                <Settings className="w-4.5 h-4.5 text-gray-600" />
              </a>
            </>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden px-3 py-2 md:px-4 md:py-3">
      <div className="max-w-[1400px] mx-auto h-full flex gap-3 overflow-hidden">
        {/* RIGHT: Products Section */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white rounded-2xl shadow-sm border border-gray-200">
          <div className="px-3 pt-3 pb-1.5 shrink-0">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="ابحث عن منتج بالاسم أو الفئة..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pr-10 pl-9 bg-white border-gray-200 h-10 text-[13px] rounded-xl shadow-sm focus:shadow-md transition-shadow"
                data-testid="input-search-product"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors" data-testid="button-clear-search">
                  <X className="w-3.5 h-3.5 text-gray-500" />
                </button>
              )}
            </div>
          </div>

          {categories.length > 0 && (
            <div className="px-5 pb-3 shrink-0">
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                <button
                  onClick={() => setSelectedCategory("all")}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-bold whitespace-nowrap transition-all active:scale-95 touch-manipulation border ${
                    selectedCategory === "all"
                      ? "bg-gray-900 text-white border-gray-900 shadow-md"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                  }`}
                  data-testid="category-all"
                >
                  <Sparkles className="w-3 h-3" />
                  الكل
                  <span className={`text-[10px] font-bold ${selectedCategory === "all" ? "text-gray-400" : "text-gray-400"}`}>
                    {filteredProducts.length}
                  </span>
                </button>
                {categories.map(cat => {
                  const count = filteredProducts.filter((bp: BranchProductWithDetails) => bp.product?.category === cat).length;
                  const IconComp = categoryIcons[cat] || Package;
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-bold whitespace-nowrap transition-all active:scale-95 touch-manipulation border ${
                        selectedCategory === cat
                          ? "bg-orange-500 text-white border-orange-500 shadow-md"
                          : "bg-white text-gray-600 border-gray-200 hover:border-orange-300"
                      }`}
                      data-testid={`category-${cat}`}
                    >
                      <IconComp className="w-3 h-3" />
                      {cat}
                      <span className={`text-[11px] font-bold ${selectedCategory === cat ? "text-orange-200" : "text-gray-400"}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Products Grid */}
          <div className="flex-1 overflow-y-auto px-5 pb-5">
            {productsLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="w-16 h-16 bg-orange-100 rounded-3xl flex items-center justify-center mx-auto mb-4 animate-pulse">
                    <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
                  </div>
                  <p className="text-base text-gray-400 font-medium">جاري تحميل المنتجات...</p>
                </div>
              </div>
            ) : displayProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full">
                <div className="w-28 h-28 bg-gray-100 rounded-[2rem] flex items-center justify-center mb-5">
                  <Package className="w-14 h-14 text-gray-300" />
                </div>
                <p className="text-xl font-bold text-gray-400 mb-2">لا توجد أصناف</p>
                <p className="text-sm text-gray-300 mb-4">{isManager ? "أضف منتجات من صفحة الإعدادات" : "تواصل مع المدير لإضافة المنتجات"}</p>
                {isManager && (
                  <a href="/event-pos-settings" className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-xl font-bold text-sm hover:bg-orange-600 transition-colors active:scale-95 touch-manipulation" data-testid="link-add-products">
                    <Settings className="w-4 h-4" />
                    إعدادات نقطة البيع
                  </a>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
                {displayProducts.map((bp: BranchProductWithDetails) => {
                  const price = bp.priceOverride ?? bp.product?.basePrice ?? 0;
                  const inCart = cart.find(c => c.productId === bp.productId);
                  return (
                    <button
                      key={bp.id}
                      onClick={() => addToCart(bp)}
                      className={`group relative bg-white rounded-xl p-2.5 text-center transition-all duration-150 active:scale-[0.96] select-none touch-manipulation ${
                        inCart 
                          ? "ring-2 ring-orange-400 shadow-lg shadow-orange-100/60" 
                          : "shadow-sm hover:shadow-md border border-gray-100 hover:border-orange-200"
                      }`}
                      data-testid={`product-card-${bp.productId}`}
                    >
                      {inCart && (
                        <div className="absolute -top-1.5 -left-1.5 min-w-[24px] h-6 bg-orange-500 text-white rounded-lg text-[11px] px-1.5 flex items-center justify-center font-black shadow-md shadow-orange-300/50 z-10">
                          {inCart.quantity}
                        </div>
                      )}
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-1.5 transition-colors ${
                        inCart 
                          ? "bg-orange-500 shadow-sm" 
                          : "bg-gradient-to-br from-orange-50 to-amber-50 group-hover:from-orange-100 group-hover:to-amber-100"
                      }`}>
                        <Package className={`w-5 h-5 ${inCart ? "text-white" : "text-orange-400"}`} />
                      </div>
                      <div className="text-[12px] font-bold text-gray-800 mb-0.5 line-clamp-2 leading-tight min-h-[32px] flex items-center justify-center">
                        {bp.product?.name}
                      </div>
                      <div className="text-[10px] text-gray-400 mb-1.5 font-medium">{bp.product?.category}</div>
                      <div className={`rounded-lg py-1.5 px-2 transition-colors ${
                        inCart ? "bg-orange-50 border border-orange-200" : "bg-gray-50"
                      }`}>
                        <span className="text-orange-600 font-black text-[15px]">{price.toFixed(2)}</span>
                        <span className="text-[10px] text-orange-400 mr-0.5 font-bold">ر.س</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* LEFT: Cart Panel */}
        <div className="w-[300px] bg-white flex flex-col rounded-2xl shadow-sm border border-gray-200 shrink-0 overflow-hidden">
          <div className="px-3 py-2.5 border-b border-gray-100 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                <ShoppingCart className="w-4 h-4 text-orange-600" />
              </div>
              <div>
                <h2 className="font-black text-[13px] text-gray-800 leading-tight">الطلب الحالي</h2>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {cartItemsCount > 0 ? `${cartItemsCount} صنف` : "لا توجد أصناف"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {cart.length > 0 && (
                <>
                  <button
                    onClick={() => setShowHoldDialog(true)}
                    className="flex items-center gap-1 text-[11px] font-bold text-amber-500 hover:text-amber-700 px-2 py-1.5 rounded-lg hover:bg-amber-50 transition-colors active:scale-95 touch-manipulation"
                    title="تعليق الطلب (F2)"
                    data-testid="button-hold-order"
                  >
                    <Pause className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={clearCart} 
                    className="flex items-center gap-1 text-[12px] font-bold text-red-400 hover:text-red-600 px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors active:scale-95 touch-manipulation" 
                    data-testid="button-clear-cart"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full px-4">
                <div className="w-14 h-14 bg-gray-50 rounded-xl flex items-center justify-center mb-3">
                  <ShoppingCart className="w-7 h-7 text-gray-200" />
                </div>
                <p className="text-[13px] font-bold text-gray-300 mb-1">السلة فارغة</p>
                <p className="text-[11px] text-gray-300 text-center">اضغط على أي منتج لإضافته للطلب</p>
                <div className="mt-3 flex gap-1.5 text-[9px] text-gray-300">
                  <span className="bg-gray-100 px-1.5 py-0.5 rounded">F1 إتمام</span>
                  <span className="bg-gray-100 px-1.5 py-0.5 rounded">F2 تعليق</span>
                  <span className="bg-gray-100 px-1.5 py-0.5 rounded">F3 معلق</span>
                </div>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {cart.map((item) => (
                  <div 
                    key={item.productId} 
                    className="bg-gray-50/80 rounded-xl p-2.5 transition-all" 
                    data-testid={`cart-item-${item.productId}`}
                  >
                    <div className="flex items-start justify-between mb-1.5">
                      <div className="flex-1 min-w-0 ml-1.5">
                        <div className="text-[12px] font-bold text-gray-800 truncate leading-tight">{item.productName}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">{item.unitPrice.toFixed(2)} ر.س</div>
                      </div>
                      <button 
                        onClick={() => removeFromCart(item.productId)} 
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all active:scale-90 touch-manipulation shrink-0" 
                        data-testid={`button-remove-${item.productId}`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center bg-white rounded-xl border border-gray-200 overflow-hidden">
                        <button 
                          onClick={() => updateQuantity(item.productId, -1)} 
                          className="w-10 h-9 flex items-center justify-center hover:bg-red-50 transition-colors active:scale-90 touch-manipulation border-l border-gray-200" 
                          data-testid={`button-decrease-${item.productId}`}
                        >
                          <Minus className="w-4 h-4 text-gray-500" />
                        </button>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={e => setQuantityDirect(item.productId, parseInt(e.target.value) || 0)}
                          className="w-12 text-center text-[14px] font-black text-gray-800 bg-transparent border-none outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          data-testid={`input-qty-${item.productId}`}
                        />
                        <button 
                          onClick={() => updateQuantity(item.productId, 1)} 
                          className="w-10 h-9 flex items-center justify-center hover:bg-green-50 transition-colors active:scale-90 touch-manipulation border-r border-gray-200" 
                          data-testid={`button-increase-${item.productId}`}
                        >
                          <Plus className="w-4 h-4 text-gray-500" />
                        </button>
                      </div>
                      <div className="text-[15px] font-black text-gray-800">
                        {(item.unitPrice * item.quantity).toFixed(2)} <span className="text-[11px] font-bold text-gray-400">ر.س</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cart Footer */}
          <div className="border-t border-gray-100 shrink-0">
            <div className="px-3 py-2 space-y-1 bg-gray-50/50">
              <div className="flex justify-between text-[11px]">
                <span className="text-gray-400">المجموع بدون ضريبة</span>
                <span className="text-gray-500 font-bold">{cartTotal.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-gray-400">ضريبة القيمة المضافة 15%</span>
                <span className="text-gray-500 font-bold">{cartTotal.vat.toFixed(2)}</span>
              </div>
              {cartTotal.discount > 0 && (
                <div className="flex justify-between text-[11px]">
                  <span className="text-red-400 flex items-center gap-1">
                    <Percent className="w-3 h-3" />
                    خصم {discountType === "percentage" ? `${discountValue}%` : "ثابت"}
                  </span>
                  <span className="text-red-500 font-bold">-{cartTotal.discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-1.5 border-t border-gray-200">
                <span className="text-[13px] font-black text-gray-800">الإجمالي</span>
                <span className="text-[18px] font-black text-orange-600" data-testid="text-cart-total">
                  {cartTotal.total.toFixed(2)} <span className="text-[11px]">ر.س</span>
                </span>
              </div>
            </div>

            <div className="p-3 space-y-2">
              {/* Discount + Split buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDiscount(true)}
                  className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[11px] font-bold transition-all active:scale-95 touch-manipulation border ${
                    discountType
                      ? "bg-red-50 text-red-600 border-red-200"
                      : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
                  }`}
                  data-testid="button-discount"
                >
                  <Percent className="w-3 h-3" />
                  {discountType ? `خصم ${cartTotal.discount.toFixed(0)} ر.س` : "خصم"}
                </button>
                <button
                  onClick={() => { setSplitMode(!splitMode); if (!splitMode) setPaymentMethod("split"); else setPaymentMethod("cash"); }}
                  className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[11px] font-bold transition-all active:scale-95 touch-manipulation border ${
                    splitMode
                      ? "bg-purple-50 text-purple-600 border-purple-200"
                      : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
                  }`}
                  data-testid="button-split-payment"
                >
                  <SplitSquareHorizontal className="w-3 h-3" />
                  {splitMode ? "دفع مقسم" : "تقسيم"}
                </button>
              </div>

              {/* Payment Method Selection */}
              {!splitMode && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPaymentMethod("cash")}
                    className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-bold transition-all active:scale-95 touch-manipulation ${
                      paymentMethod === "cash"
                        ? "bg-green-500 text-white shadow-md shadow-green-500/25"
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                    data-testid="button-payment-cash"
                  >
                    <Banknote className="w-4 h-4" />
                    نقد
                  </button>
                  <button
                    onClick={() => setPaymentMethod("network")}
                    className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-bold transition-all active:scale-95 touch-manipulation ${
                      paymentMethod === "network"
                        ? "bg-blue-500 text-white shadow-md shadow-blue-500/25"
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                    data-testid="button-payment-network"
                  >
                    <CreditCard className="w-4 h-4" />
                    شبكة
                  </button>
                </div>
              )}

              <button
                className="w-full bg-gradient-to-l from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:from-gray-200 disabled:to-gray-300 disabled:text-gray-400 text-white font-black text-[14px] py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-orange-500/20 disabled:shadow-none active:scale-[0.97] touch-manipulation"
                disabled={cart.length === 0 || createSaleMutation.isPending}
                onClick={handleCheckout}
                data-testid="button-checkout"
              >
                {createSaleMutation.isPending ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> جاري المعالجة...</>
                ) : (
                  <><Receipt className="w-5 h-5" /> إتمام الطلب (F1) {cartTotal.total > 0 && <span className="bg-white/20 px-3 py-0.5 rounded-lg text-[13px]">{cartTotal.total.toFixed(2)} ر.س</span>}</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* Discount Dialog */}
      <Dialog open={showDiscount} onOpenChange={setShowDiscount}>
        <DialogContent className="max-w-[380px] rounded-3xl p-0 overflow-hidden" dir="rtl">
          <div className="bg-gradient-to-l from-red-500 to-pink-500 p-5">
            <DialogTitle className="flex items-center gap-3 text-white text-lg font-black">
              <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                <Percent className="w-5 h-5 text-white" />
              </div>
              إضافة خصم
            </DialogTitle>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setDiscountType("percentage")}
                className={`py-3 rounded-xl text-sm font-bold transition-all ${discountType === "percentage" ? "bg-red-500 text-white" : "bg-gray-100 text-gray-600"}`}
                data-testid="button-discount-percentage"
              >
                نسبة مئوية %
              </button>
              <button
                onClick={() => setDiscountType("fixed")}
                className={`py-3 rounded-xl text-sm font-bold transition-all ${discountType === "fixed" ? "bg-red-500 text-white" : "bg-gray-100 text-gray-600"}`}
                data-testid="button-discount-fixed"
              >
                مبلغ ثابت
              </button>
            </div>
            {discountType && (
              <div>
                <label className="text-sm font-bold text-gray-600 mb-2 block">
                  {discountType === "percentage" ? "نسبة الخصم (%)" : "مبلغ الخصم (ر.س)"}
                </label>
                <Input
                  type="number"
                  value={discountValue}
                  onChange={e => setDiscountValue(e.target.value)}
                  placeholder={discountType === "percentage" ? "10" : "5.00"}
                  className="text-2xl text-center font-black h-14 rounded-xl"
                  max={discountType === "percentage" ? 100 : undefined}
                  autoFocus
                  data-testid="input-discount-value"
                />
                {discountType === "percentage" && (
                  <div className="flex gap-2 mt-3">
                    {[5, 10, 15, 20, 25, 50].map(v => (
                      <button key={v} onClick={() => setDiscountValue(String(v))} className="flex-1 py-2 rounded-lg text-xs font-bold bg-gray-100 hover:bg-red-50 hover:text-red-600 transition-colors" data-testid={`button-discount-quick-${v}`}>{v}%</button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="px-5 pb-5 flex gap-2">
            {discountType && (
              <Button variant="outline" onClick={() => { setDiscountType(null); setDiscountValue(""); }} className="rounded-xl h-11 text-sm font-bold text-red-500">
                إزالة الخصم
              </Button>
            )}
            <Button onClick={() => setShowDiscount(false)} className="flex-1 rounded-xl h-11 bg-red-500 hover:bg-red-600 font-bold" data-testid="button-apply-discount">
              تطبيق
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Checkout Dialog */}
      <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
        <DialogContent className="max-w-[420px] rounded-3xl p-0 overflow-hidden" dir="rtl">
          <div className="bg-gradient-to-l from-green-600 to-emerald-500 p-6">
            <DialogTitle className="flex items-center gap-3 text-white text-lg font-black">
              <div className="w-11 h-11 bg-white/20 rounded-2xl flex items-center justify-center">
                <Receipt className="w-6 h-6 text-white" />
              </div>
              إتمام البيع
            </DialogTitle>
          </div>
          <div className="p-6 space-y-5">
            <div className="bg-gradient-to-l from-orange-50 to-amber-50 rounded-2xl p-6 text-center border border-orange-100">
              <div className="text-sm text-gray-500 mb-2">الإجمالي المطلوب</div>
              <div className="text-[42px] font-black text-orange-600 leading-tight">{cartTotal.total.toFixed(2)} <span className="text-lg">ر.س</span></div>
              {cartTotal.discount > 0 && <div className="text-xs text-red-500 mt-1">شامل خصم {cartTotal.discount.toFixed(2)} ر.س</div>}
            </div>

            {splitMode ? (
              <div className="space-y-4">
                <div className="text-center text-sm font-bold text-purple-600 flex items-center justify-center gap-2">
                  <SplitSquareHorizontal className="w-4 h-4" />
                  دفع مقسم (نقد + شبكة)
                </div>
                <div>
                  <label className="text-sm font-bold text-gray-600 mb-2 block flex items-center gap-1">
                    <Banknote className="w-4 h-4 text-green-500" />
                    المبلغ النقدي
                  </label>
                  <Input
                    type="number"
                    value={cashSplitAmount}
                    onChange={e => setCashSplitAmount(e.target.value)}
                    className="text-2xl text-center font-black h-14 rounded-xl border-2 border-green-200 focus:border-green-400"
                    autoFocus
                    data-testid="input-cash-split"
                  />
                </div>
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-blue-600 flex items-center gap-1"><CreditCard className="w-4 h-4" /> المبلغ بالشبكة</span>
                    <span className="text-xl font-black text-blue-700">{networkSplitAmount.toFixed(2)} ر.س</span>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[10, 20, 50, 100].map(v => (
                    <button key={v} onClick={() => setCashSplitAmount(String(v))} className="py-3 rounded-xl text-[14px] font-bold bg-gray-100 hover:bg-green-100 hover:text-green-700 transition-colors active:scale-95 touch-manipulation" data-testid={`button-split-quick-${v}`}>{v}</button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setPaymentMethod("cash")}
                    className={`flex items-center justify-center gap-2 py-4 rounded-2xl text-base font-bold transition-all active:scale-95 touch-manipulation ${
                      paymentMethod === "cash" ? "bg-green-500 text-white shadow-lg shadow-green-500/30" : "bg-gray-100 text-gray-600"
                    }`}
                    data-testid="button-checkout-cash"
                  >
                    <Banknote className="w-6 h-6" /> نقد
                  </button>
                  <button
                    onClick={() => setPaymentMethod("network")}
                    className={`flex items-center justify-center gap-2 py-4 rounded-2xl text-base font-bold transition-all active:scale-95 touch-manipulation ${
                      paymentMethod === "network" ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30" : "bg-gray-100 text-gray-600"
                    }`}
                    data-testid="button-checkout-network"
                  >
                    <CreditCard className="w-6 h-6" /> شبكة
                  </button>
                </div>
                {paymentMethod === "cash" && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-bold text-gray-600 mb-2 block">المبلغ المدفوع</label>
                      <Input
                        type="number"
                        value={amountPaid}
                        onChange={e => setAmountPaid(e.target.value)}
                        className="text-3xl text-center font-black h-[64px] rounded-2xl border-2 border-gray-200 focus:border-green-400"
                        autoFocus
                        data-testid="input-amount-paid"
                      />
                    </div>
                    {changeAmount > 0 && (
                      <div className="bg-green-50 rounded-2xl p-4 text-center border-2 border-green-200">
                        <div className="text-xs text-green-600 mb-1 font-bold">الباقي</div>
                        <div className="text-3xl font-black text-green-700">{changeAmount.toFixed(2)} ر.س</div>
                      </div>
                    )}
                    <div className="grid grid-cols-4 gap-2">
                      {[5, 10, 20, 50, 100, 200, 500].map(v => (
                        <button key={v} onClick={() => setAmountPaid(String(v))} className="py-3.5 rounded-xl text-[15px] font-bold bg-gray-100 hover:bg-orange-100 hover:text-orange-700 transition-colors active:scale-95 touch-manipulation" data-testid={`button-quick-amount-${v}`}>{v}</button>
                      ))}
                      <button onClick={() => setAmountPaid(String(cartTotal.total))} className="py-3.5 rounded-xl text-[13px] font-bold bg-orange-100 text-orange-700 hover:bg-orange-200 transition-colors active:scale-95 touch-manipulation" data-testid="button-quick-amount-exact">مطابق</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          <div className="px-6 pb-6 flex gap-3">
            <Button variant="outline" onClick={() => setShowCheckout(false)} className="rounded-2xl h-14 text-[15px] px-6 font-bold">إلغاء</Button>
            <Button
              className="bg-green-600 hover:bg-green-700 flex-1 rounded-2xl h-14 text-lg font-black active:scale-[0.97] touch-manipulation shadow-lg shadow-green-600/20"
              onClick={handleCompleteSale}
              disabled={createSaleMutation.isPending}
              data-testid="button-complete-sale"
            >
              {createSaleMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin ml-2" /> : <Check className="w-5 h-5 ml-2" />}
              {createSaleMutation.isPending ? "جاري..." : "تأكيد البيع"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="max-w-sm rounded-3xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-black">
              <div className="w-9 h-9 bg-orange-100 rounded-xl flex items-center justify-center">
                <Receipt className="w-5 h-5 text-orange-600" />
              </div>
              الفاتورة الضريبية المبسطة
            </DialogTitle>
          </DialogHeader>
          {lastSale && (
            <div ref={receiptRef} className="receipt-print bg-white text-black" style={{ fontFamily: "Cairo, sans-serif", width: "76mm", maxWidth: "76mm", padding: "2mm", fontSize: "10px", lineHeight: 1.2, boxSizing: "border-box" }}>
              <div style={{ textAlign: "center", paddingBottom: "2px" }}>
                {invoiceSettings?.logoUrl && (
                  <img src={invoiceSettings.logoUrl} alt="شعار" style={{ maxHeight: "30px", maxWidth: "40mm", margin: "0 auto 2px", display: "block", objectFit: "contain" }} data-testid="img-receipt-logo" />
                )}
                <div style={{ fontWeight: "bold", fontSize: "12px", marginBottom: "0" }}>{invoiceSettings?.businessName || "باتر بيكري"}</div>
                {invoiceSettings?.businessNameEn && <div style={{ fontSize: "8px", color: "#555", margin: 0 }}>{invoiceSettings.businessNameEn}</div>}
                {invoiceSettings?.address && <div style={{ fontSize: "8px", color: "#555", margin: 0 }}>{invoiceSettings.address}</div>}
                {invoiceSettings?.city && <div style={{ fontSize: "8px", color: "#555", margin: 0 }}>{invoiceSettings.city}</div>}
                {invoiceSettings?.phone && <div style={{ fontSize: "8px", color: "#555", margin: 0 }}>هاتف: {invoiceSettings.phone}</div>}
                {invoiceSettings?.vatNumber && <div style={{ fontSize: "8px", fontWeight: "600", margin: 0 }}>الرقم الضريبي: {invoiceSettings.vatNumber}</div>}
                {invoiceSettings?.crNumber && <div style={{ fontSize: "8px", margin: 0 }}>السجل التجاري: {invoiceSettings.crNumber}</div>}
              </div>
              <hr className="receipt-separator" style={{ border: "none", borderTop: "1px dashed #000", margin: "2px 0" }} />
              <div style={{ textAlign: "center", padding: "1px 0" }}>
                <div style={{ fontWeight: "bold", fontSize: "11px" }}>فاتورة ضريبية مبسطة</div>
                <div style={{ fontSize: "8px", color: "#333" }}>رقم الفاتورة: {lastSale.invoiceNumber}</div>
                <div style={{ fontSize: "8px", color: "#333" }}>{lastSale.saleDate} - {lastSale.saleTime}</div>
              </div>
              <hr className="receipt-separator" style={{ border: "none", borderTop: "1px dashed #000", margin: "2px 0" }} />
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #000" }}>
                    <th style={{ textAlign: "right", padding: "2px 0", fontWeight: "bold", fontSize: "8px" }}>الصنف</th>
                    <th style={{ textAlign: "center", padding: "2px 0", fontWeight: "bold", fontSize: "8px", width: "25px" }}>الكمية</th>
                    <th style={{ textAlign: "center", padding: "2px 0", fontWeight: "bold", fontSize: "8px", width: "40px" }}>السعر</th>
                    <th style={{ textAlign: "left", padding: "2px 0", fontWeight: "bold", fontSize: "8px", width: "45px" }}>المبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  {lastSale.items?.map((item: any, i: number) => (
                    <tr key={i} style={{ borderBottom: "1px dotted #ccc" }}>
                      <td style={{ padding: "1px 0", fontSize: "9px", wordBreak: "break-word", maxWidth: "35mm" }}>{item.productName}</td>
                      <td style={{ textAlign: "center", padding: "1px 0", fontSize: "9px" }}>{item.quantity}</td>
                      <td style={{ textAlign: "center", padding: "1px 0", fontSize: "9px" }}>{item.unitPrice?.toFixed(2)}</td>
                      <td style={{ textAlign: "left", padding: "1px 0", fontSize: "9px" }}>{item.totalPrice?.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <hr className="receipt-separator" style={{ border: "none", borderTop: "1px dashed #000", margin: "2px 0" }} />
              <div style={{ fontSize: "9px" }}>
                <div className="receipt-row" style={{ display: "flex", justifyContent: "space-between", padding: "1px 0", color: "#333" }}>
                  <span>المجموع بدون ضريبة</span>
                  <span>{lastSale.subtotal?.toFixed(2)} ر.س</span>
                </div>
                <div className="receipt-row" style={{ display: "flex", justifyContent: "space-between", padding: "1px 0", color: "#333" }}>
                  <span>ضريبة القيمة المضافة (15%)</span>
                  <span>{lastSale.vatAmount?.toFixed(2)} ر.س</span>
                </div>
                {(lastSale.discountAmount || 0) > 0 && (
                  <div className="receipt-row" style={{ display: "flex", justifyContent: "space-between", padding: "1px 0", color: "#c00" }}>
                    <span>خصم {lastSale.discountType === "percentage" ? `${lastSale.discountValue}%` : "ثابت"}</span>
                    <span>-{lastSale.discountAmount?.toFixed(2)} ر.س</span>
                  </div>
                )}
              </div>
              <hr className="receipt-separator" style={{ border: "none", borderTop: "1px dashed #000", margin: "2px 0" }} />
              <div className="receipt-row" style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "12px", padding: "2px 0" }}>
                <span>الإجمالي</span>
                <span>{lastSale.totalAmount?.toFixed(2)} ر.س</span>
              </div>
              <hr className="receipt-separator" style={{ border: "none", borderTop: "1px dashed #000", margin: "2px 0" }} />
              <div style={{ fontSize: "9px" }}>
                <div className="receipt-row" style={{ display: "flex", justifyContent: "space-between", padding: "1px 0" }}>
                  <span>طريقة الدفع</span>
                  <span style={{ fontWeight: "600" }}>{lastSale.paymentMethod === "cash" ? "نقد" : lastSale.paymentMethod === "network" ? "شبكة" : "نقد + شبكة"}</span>
                </div>
                {lastSale.paymentMethod === "split" && (
                  <>
                    <div className="receipt-row" style={{ display: "flex", justifyContent: "space-between", padding: "1px 0" }}>
                      <span>نقد</span>
                      <span>{(lastSale.cashAmount || 0).toFixed(2)} ر.س</span>
                    </div>
                    <div className="receipt-row" style={{ display: "flex", justifyContent: "space-between", padding: "1px 0" }}>
                      <span>شبكة</span>
                      <span>{(lastSale.networkAmount || 0).toFixed(2)} ر.س</span>
                    </div>
                  </>
                )}
                {lastSale.paymentMethod === "cash" && (
                  <>
                    <div className="receipt-row" style={{ display: "flex", justifyContent: "space-between", padding: "1px 0" }}>
                      <span>المبلغ المدفوع</span>
                      <span>{lastSale.amountPaid?.toFixed(2)} ر.س</span>
                    </div>
                    {lastSale.changeAmount > 0 && (
                      <div className="receipt-row" style={{ display: "flex", justifyContent: "space-between", padding: "1px 0" }}>
                        <span>الباقي</span>
                        <span>{lastSale.changeAmount?.toFixed(2)} ر.س</span>
                      </div>
                    )}
                  </>
                )}
              </div>
              <div style={{ fontSize: "8px", color: "#555", textAlign: "center", padding: "1px 0" }}>
                الكاشير: {lastSale.cashierName}
              </div>
              <hr className="receipt-separator" style={{ border: "none", borderTop: "1px dashed #000", margin: "2px 0" }} />
              {invoiceSettings?.showQrCode !== false && invoiceSettings?.vatNumber && (
                <div style={{ textAlign: "center", padding: "2px 0" }}>
                  <QRCodeSVG
                    value={generateZatcaQrBase64(invoiceSettings?.businessName || "باتر بيكري", invoiceSettings?.vatNumber || "", new Date(`${lastSale.saleDate}T${lastSale.saleTime}`).toISOString(), lastSale.totalAmount?.toFixed(2) || "0.00", lastSale.vatAmount?.toFixed(2) || "0.00")}
                    size={70} level="L" style={{ margin: "0 auto", width: "20mm", height: "20mm" }} data-testid="img-zatca-qr"
                  />
                  <div style={{ fontSize: "7px", color: "#666", marginTop: "1px" }}>فاتورة ضريبية مبسطة - ZATCA</div>
                </div>
              )}
              <div style={{ textAlign: "center", padding: "2px 0 1px" }}>
                <div style={{ fontSize: "9px", color: "#333" }}>{invoiceSettings?.footerText || "شكراً لزيارتكم"}</div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowReceipt(false)} className="rounded-xl h-12 text-[15px] font-bold">إغلاق</Button>
            <Button onClick={() => handlePrint()} className="gap-2 rounded-xl bg-orange-500 hover:bg-orange-600 h-12 text-[15px] font-bold active:scale-95 touch-manipulation" data-testid="button-print-receipt">
              <Printer className="w-5 h-5" />
              طباعة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hold Order Dialog */}
      <Dialog open={showHoldDialog} onOpenChange={setShowHoldDialog}>
        <DialogContent className="max-w-[380px] rounded-3xl p-0 overflow-hidden" dir="rtl">
          <div className="bg-gradient-to-l from-amber-500 to-yellow-500 p-5">
            <DialogTitle className="flex items-center gap-3 text-white text-lg font-black">
              <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                <Pause className="w-5 h-5 text-white" />
              </div>
              تعليق الطلب
            </DialogTitle>
          </div>
          <div className="p-5 space-y-4">
            <p className="text-sm text-gray-500">سيتم حفظ الطلب الحالي ({cartItemsCount} صنف - {cartTotal.total.toFixed(2)} ر.س) ويمكنك استرجاعه لاحقاً</p>
            <div>
              <label className="text-sm font-bold text-gray-600 mb-2 block">اسم الطلب (اختياري)</label>
              <Input
                value={holdLabel}
                onChange={e => setHoldLabel(e.target.value)}
                placeholder="مثال: طلب أحمد"
                className="rounded-xl h-11"
                autoFocus
                data-testid="input-hold-label"
              />
            </div>
          </div>
          <div className="px-5 pb-5 flex gap-2">
            <Button variant="outline" onClick={() => setShowHoldDialog(false)} className="rounded-xl h-11">إلغاء</Button>
            <Button
              onClick={() => holdOrderMutation.mutate()}
              disabled={holdOrderMutation.isPending}
              className="flex-1 rounded-xl h-11 bg-amber-500 hover:bg-amber-600 font-bold"
              data-testid="button-confirm-hold"
            >
              {holdOrderMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Pause className="w-4 h-4 ml-1" />}
              تعليق
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Held Orders Dialog */}
      <Dialog open={showHeld} onOpenChange={setShowHeld}>
        <DialogContent className="max-w-md rounded-3xl max-h-[80vh] overflow-hidden flex flex-col p-0" dir="rtl">
          <div className="bg-gradient-to-l from-amber-600 to-yellow-500 p-5 shrink-0">
            <DialogTitle className="flex items-center gap-3 text-white text-lg font-black">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                <Pause className="w-5 h-5 text-white" />
              </div>
              الطلبات المعلقة ({heldOrders.length})
            </DialogTitle>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {heldOrders.length === 0 ? (
              <div className="p-12 text-center">
                <Play className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                <p className="text-sm font-bold text-gray-400">لا توجد طلبات معلقة</p>
              </div>
            ) : heldOrders.map((order: any) => {
              let items: CartItem[] = [];
              try { items = JSON.parse(order.cartData); } catch {}
              return (
                <div key={order.id} className="px-5 py-4 hover:bg-gray-50 transition-colors" data-testid={`held-order-${order.id}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="font-bold text-sm text-gray-800">{order.label || "طلب بدون اسم"}</div>
                      <div className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {new Date(order.createdAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                        <span className="mx-1">•</span>
                        {order.cashierName}
                      </div>
                    </div>
                    <span className="font-black text-orange-600 text-base">{(order.totalAmount || 0).toFixed(2)} <span className="text-[10px] text-gray-400">ر.س</span></span>
                  </div>
                  <div className="text-[11px] text-gray-400 mb-3">{items.map(i => `${i.productName} ×${i.quantity}`).join(" • ")}</div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => recallHeldOrder(order)}
                      className="flex-1 rounded-lg h-9 bg-green-500 hover:bg-green-600 text-white font-bold text-xs gap-1"
                      data-testid={`button-recall-${order.id}`}
                    >
                      <Play className="w-3.5 h-3.5" />
                      استرجاع
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deleteHeldMutation.mutate(order.id)}
                      className="rounded-lg h-9 text-red-500 border-red-200 hover:bg-red-50 text-xs gap-1"
                      data-testid={`button-delete-held-${order.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Void/Refund Dialog */}
      <Dialog open={showVoid} onOpenChange={setShowVoid}>
        <DialogContent className="max-w-[400px] rounded-3xl p-0 overflow-hidden" dir="rtl">
          <div className={`p-5 ${voidAction === "void" ? "bg-gradient-to-l from-red-600 to-red-500" : "bg-gradient-to-l from-amber-600 to-amber-500"}`}>
            <DialogTitle className="flex items-center gap-3 text-white text-lg font-black">
              <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                {voidAction === "void" ? <Ban className="w-5 h-5 text-white" /> : <RotateCcw className="w-5 h-5 text-white" />}
              </div>
              {voidAction === "void" ? "إلغاء الفاتورة" : "استرجاع الفاتورة"}
            </DialogTitle>
          </div>
          <div className="p-5 space-y-4">
            <div className="bg-yellow-50 rounded-xl p-3 flex items-start gap-2 border border-yellow-200">
              <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
              <p className="text-xs text-yellow-700">{voidAction === "void" ? "سيتم إلغاء هذه الفاتورة نهائياً ولن تحسب في المبيعات" : "سيتم تسجيل استرجاع لهذه الفاتورة"}</p>
            </div>
            <div>
              <label className="text-sm font-bold text-gray-600 mb-2 block">سبب {voidAction === "void" ? "الإلغاء" : "الاسترجاع"} *</label>
              <Input
                value={voidReason}
                onChange={e => setVoidReason(e.target.value)}
                placeholder="اكتب السبب..."
                className="rounded-xl h-11"
                autoFocus
                data-testid="input-void-reason"
              />
            </div>
          </div>
          <div className="px-5 pb-5 flex gap-2">
            <Button variant="outline" onClick={() => setShowVoid(false)} className="rounded-xl h-11">إلغاء</Button>
            <Button
              onClick={() => {
                if (!voidReason.trim()) { toast({ title: "يجب كتابة السبب", variant: "destructive" }); return; }
                if (voidSaleId) voidMutation.mutate({ saleId: voidSaleId, reason: voidReason, action: voidAction });
              }}
              disabled={voidMutation.isPending}
              className={`flex-1 rounded-xl h-11 font-bold ${voidAction === "void" ? "bg-red-500 hover:bg-red-600" : "bg-amber-500 hover:bg-amber-600"}`}
              data-testid="button-confirm-void"
            >
              {voidMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : null}
              تأكيد {voidAction === "void" ? "الإلغاء" : "الاسترجاع"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sales History Dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-2xl rounded-3xl max-h-[85vh] overflow-hidden flex flex-col p-0" dir="rtl">
          <div className="bg-gradient-to-l from-gray-900 to-gray-800 p-5 shrink-0">
            <DialogTitle className="flex items-center gap-3 text-white text-lg font-black">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                <CalendarDays className="w-5 h-5 text-white" />
              </div>
              سجل المبيعات
            </DialogTitle>
          </div>
          
          {/* Date Filter */}
          <div className="px-5 py-3 bg-gray-50 border-b flex items-center gap-3 shrink-0 flex-wrap">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-xs font-bold text-gray-500">من:</span>
              <input type="date" value={historyDateFrom} onChange={e => setHistoryDateFrom(e.target.value)} className="text-xs bg-white border border-gray-200 rounded-lg px-2 py-1.5" data-testid="input-date-from" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500">إلى:</span>
              <input type="date" value={historyDateTo} onChange={e => setHistoryDateTo(e.target.value)} className="text-xs bg-white border border-gray-200 rounded-lg px-2 py-1.5" data-testid="input-date-to" />
            </div>
            <button onClick={() => { const today = new Date().toISOString().slice(0,10); setHistoryDateFrom(today); setHistoryDateTo(today); }} className="text-[11px] font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors" data-testid="button-today-filter">اليوم</button>
          </div>

          {todaySummary && historyDateFrom === new Date().toISOString().slice(0,10) && historyDateTo === new Date().toISOString().slice(0,10) && (
            <div className="grid grid-cols-4 gap-2 p-4 shrink-0 bg-gray-50 border-b">
              <div className="bg-white rounded-xl p-3 text-center border border-gray-100">
                <TrendingUp className="w-4 h-4 text-green-500 mx-auto mb-1" />
                <div className="text-base font-black text-gray-800">{(todaySummary.totalSales || 0).toFixed(0)}</div>
                <div className="text-[10px] text-gray-400 font-medium">المبيعات</div>
              </div>
              <div className="bg-white rounded-xl p-3 text-center border border-gray-100">
                <Hash className="w-4 h-4 text-blue-500 mx-auto mb-1" />
                <div className="text-base font-black text-gray-800">{todaySummary.totalTransactions || 0}</div>
                <div className="text-[10px] text-gray-400 font-medium">الفواتير</div>
              </div>
              <div className="bg-white rounded-xl p-3 text-center border border-gray-100">
                <Banknote className="w-4 h-4 text-green-500 mx-auto mb-1" />
                <div className="text-base font-black text-gray-800">{(todaySummary.cashTotal || 0).toFixed(0)}</div>
                <div className="text-[10px] text-gray-400 font-medium">نقد</div>
              </div>
              <div className="bg-white rounded-xl p-3 text-center border border-gray-100">
                <CreditCard className="w-4 h-4 text-blue-500 mx-auto mb-1" />
                <div className="text-base font-black text-gray-800">{(todaySummary.networkTotal || 0).toFixed(0)}</div>
                <div className="text-[10px] text-gray-400 font-medium">شبكة</div>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {todaySales.length === 0 ? (
              <div className="p-16 text-center">
                <Receipt className="w-14 h-14 mx-auto mb-4 text-gray-200" />
                <p className="text-base font-bold text-gray-400">لا توجد مبيعات</p>
              </div>
            ) : todaySales.map((sale: any) => (
              <div key={sale.id} className={`px-5 py-3.5 hover:bg-gray-50 flex items-center justify-between transition-colors ${sale.status === "voided" || sale.status === "refunded" ? "opacity-50" : ""}`} data-testid={`sale-row-${sale.id}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${sale.status === "voided" ? "bg-red-100" : sale.status === "refunded" ? "bg-amber-100" : "bg-gray-100"}`}>
                    {sale.status === "voided" ? <Ban className="w-5 h-5 text-red-500" /> : sale.status === "refunded" ? <RotateCcw className="w-5 h-5 text-amber-500" /> : <Receipt className="w-5 h-5 text-gray-500" />}
                  </div>
                  <div>
                    <div className="font-bold text-[13px] text-gray-800 flex items-center gap-2">
                      {sale.invoiceNumber}
                      {sale.status === "voided" && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold">ملغاة</span>}
                      {sale.status === "refunded" && <span className="text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full font-bold">مسترجعة</span>}
                    </div>
                    <div className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {sale.saleTime}
                      {sale.cashierName && <span className="mx-1">• {sale.cashierName}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {sale.status === "completed" && canVoid && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => { setVoidSaleId(sale.id); setVoidAction("void"); setVoidReason(""); setShowVoid(true); }}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="إلغاء الفاتورة"
                        data-testid={`button-void-${sale.id}`}
                      >
                        <Ban className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => { setVoidSaleId(sale.id); setVoidAction("refund"); setVoidReason(""); setShowVoid(true); }}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-amber-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                        title="استرجاع"
                        data-testid={`button-refund-${sale.id}`}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 rounded-lg hover:bg-orange-100 text-orange-500 hover:text-orange-700 touch-manipulation"
                    onClick={async () => {
                      try {
                        const res = await apiRequest("GET", `/api/pos/sale/${sale.id}`);
                        const saleDetails = await res.json();
                        setLastSale(saleDetails);
                        setShowHistory(false);
                        setShowReceipt(true);
                      } catch {
                        toast({ title: "خطأ", description: "فشل في تحميل بيانات الفاتورة", variant: "destructive" });
                      }
                    }}
                    data-testid={`button-reprint-${sale.id}`}
                  >
                    <Printer className="w-4 h-4" />
                  </Button>
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                    sale.paymentMethod === "cash" ? "bg-green-100 text-green-700" : sale.paymentMethod === "network" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                  }`}>
                    {sale.paymentMethod === "cash" ? "نقد" : sale.paymentMethod === "network" ? "شبكة" : "مقسم"}
                  </span>
                  <span className={`font-black text-[15px] ${sale.status !== "completed" ? "line-through text-gray-400" : "text-gray-800"}`}>
                    {(sale.totalAmount || 0).toFixed(2)} <span className="text-[11px] text-gray-400">ر.س</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Z-Report (Shift Closing Report) Dialog */}
      <Dialog open={showZReport} onOpenChange={setShowZReport}>
        <DialogContent className="max-w-lg rounded-3xl max-h-[90vh] overflow-hidden flex flex-col p-0" dir="rtl">
          <div className="bg-gradient-to-l from-purple-700 to-purple-600 p-5 shrink-0">
            <DialogTitle className="flex items-center gap-3 text-white text-lg font-black">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              تقرير إقفال الوردية (Z-Report)
            </DialogTitle>
            <p className="text-purple-200 text-xs mt-1">{new Date().toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
          </div>
          
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Printable Content */}
            <div ref={zReportRef} className="zreport-print bg-white" style={{ fontFamily: "Cairo, sans-serif" }}>
              <div style={{ textAlign: "center", marginBottom: "8px" }}>
                <div style={{ fontWeight: "bold", fontSize: "14px" }}>{invoiceSettings?.businessName || "باتر بيكري"}</div>
                <div style={{ fontSize: "12px", fontWeight: "bold", margin: "4px 0" }}>تقرير إقفال الوردية</div>
                <div style={{ fontSize: "10px", color: "#555" }}>{new Date().toLocaleDateString("ar-SA")} - {new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}</div>
                <div style={{ fontSize: "10px", color: "#555" }}>الكاشير: {(user as any)?.fullName || user?.username}</div>
              </div>
              <hr className="receipt-separator" style={{ border: "none", borderTop: "1px dashed #000", margin: "6px 0" }} />
              
              {/* Sales Summary */}
              <div style={{ fontSize: "11px" }}>
                <div style={{ fontWeight: "bold", fontSize: "12px", marginBottom: "4px" }}>ملخص المبيعات</div>
                <div className="receipt-row" style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                  <span>عدد الفواتير المكتملة</span>
                  <span style={{ fontWeight: "bold" }}>{zReportData.completedSales.length}</span>
                </div>
                <div className="receipt-row" style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                  <span>إجمالي المبيعات</span>
                  <span style={{ fontWeight: "bold" }}>{zReportData.totalSales.toFixed(2)} ر.س</span>
                </div>
                <div className="receipt-row" style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                  <span>إجمالي الضريبة</span>
                  <span style={{ fontWeight: "bold" }}>{zReportData.totalVat.toFixed(2)} ر.س</span>
                </div>
                {zReportData.totalDiscount > 0 && (
                  <div className="receipt-row" style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: "#c00" }}>
                    <span>إجمالي الخصومات</span>
                    <span style={{ fontWeight: "bold" }}>-{zReportData.totalDiscount.toFixed(2)} ر.س</span>
                  </div>
                )}
              </div>
              <hr className="receipt-separator" style={{ border: "none", borderTop: "1px dashed #000", margin: "6px 0" }} />
              
              {/* Payment Breakdown */}
              <div style={{ fontSize: "11px" }}>
                <div style={{ fontWeight: "bold", fontSize: "12px", marginBottom: "4px" }}>تفصيل طرق الدفع</div>
                <div className="receipt-row" style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                  <span>نقد</span>
                  <span style={{ fontWeight: "bold" }}>{zReportData.cashTotal.toFixed(2)} ر.س</span>
                </div>
                <div className="receipt-row" style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                  <span>شبكة</span>
                  <span style={{ fontWeight: "bold" }}>{zReportData.networkTotal.toFixed(2)} ر.س</span>
                </div>
                {zReportData.splitTotal > 0 && (
                  <>
                    <div className="receipt-row" style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                      <span>دفع مقسم (نقد)</span>
                      <span style={{ fontWeight: "bold" }}>{zReportData.splitCash.toFixed(2)} ر.س</span>
                    </div>
                    <div className="receipt-row" style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                      <span>دفع مقسم (شبكة)</span>
                      <span style={{ fontWeight: "bold" }}>{zReportData.splitNetwork.toFixed(2)} ر.س</span>
                    </div>
                  </>
                )}
              </div>
              <hr className="receipt-separator" style={{ border: "none", borderTop: "1px dashed #000", margin: "6px 0" }} />
              
              {/* Cash in Drawer */}
              <div style={{ fontSize: "12px", fontWeight: "bold" }}>
                <div className="receipt-row" style={{ display: "flex", justifyContent: "space-between", background: "#f5f5f5", borderRadius: "4px", padding: "6px 8px" }}>
                  <span>إجمالي النقد في الصندوق</span>
                  <span>{zReportData.totalCashInDrawer.toFixed(2)} ر.س</span>
                </div>
              </div>
              
              {/* Void/Refund Summary */}
              {(zReportData.voidedSales.length > 0 || zReportData.refundedSales.length > 0) && (
                <>
                  <hr className="receipt-separator" style={{ border: "none", borderTop: "1px dashed #000", margin: "6px 0" }} />
                  <div style={{ fontSize: "11px" }}>
                    <div style={{ fontWeight: "bold", fontSize: "12px", marginBottom: "4px", color: "#c00" }}>الإلغاءات والاسترجاعات</div>
                    {zReportData.voidedSales.length > 0 && (
                      <div className="receipt-row" style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                        <span>فواتير ملغاة</span>
                        <span style={{ fontWeight: "bold" }}>{zReportData.voidedSales.length} ({zReportData.voidedSales.reduce((s: number, v: any) => s + v.totalAmount, 0).toFixed(2)} ر.س)</span>
                      </div>
                    )}
                    {zReportData.refundedSales.length > 0 && (
                      <div className="receipt-row" style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                        <span>فواتير مسترجعة</span>
                        <span style={{ fontWeight: "bold" }}>{zReportData.refundedSales.length} ({zReportData.refundedSales.reduce((s: number, v: any) => s + v.totalAmount, 0).toFixed(2)} ر.س)</span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="p-4 border-t flex gap-3 shrink-0">
            <Button variant="outline" onClick={() => setShowZReport(false)} className="rounded-xl h-12 font-bold">إغلاق</Button>
            <Button onClick={() => handleZReportPrint()} className="flex-1 rounded-xl h-12 bg-purple-600 hover:bg-purple-700 font-bold text-[15px] gap-2" data-testid="button-print-zreport">
              <Printer className="w-5 h-5" />
              طباعة التقرير
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
