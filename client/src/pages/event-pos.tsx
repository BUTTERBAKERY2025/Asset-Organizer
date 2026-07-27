import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Link } from "wouter";
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
  SplitSquareHorizontal, Calendar, Gift, PartyPopper,
  DoorOpen, LogOut, Undo2, MapPin
} from "lucide-react";
import { useReactToPrint } from "react-to-print";
import { isPrinterConnected, printElement, reconnectSavedPrinter, getSavedPrinter, ensurePrinterConnection, installAutoReconnectOnVisibility } from "@/lib/thermal-printer";
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
  const [btPrinting, setBtPrinting] = useState(false);

  // إعادة ربط طابعة الكاشير بصمت عند فتح نقطة البيع أو الرجوع لها
  useEffect(() => {
    installAutoReconnectOnVisibility();
    if (getSavedPrinter() && !isPrinterConnected()) {
      void ensurePrinterConnection();
    }
  }, []);

  const handleBtPrint = async (): Promise<boolean> => {
    if (!receiptRef.current) return false;
    setBtPrinting(true);
    try {
      if (!isPrinterConnected()) {
        const p = await reconnectSavedPrinter();
        if (!p) throw new Error("الطابعة غير متصلة. افتح إعدادات ربط طابعة الكاشير واضغط إعادة الاتصال أو بحث عن طابعات.");
      }
      await printElement(receiptRef.current);
      toast({ title: "تمت طباعة الفاتورة على طابعة الكاشير" });
      return true;
    } catch (e: any) {
      toast({ title: "تعذرت الطباعة عبر البلوتوث", description: (e?.message || "") + " — سيتم فتح الطباعة العادية.", variant: "destructive" });
      return false;
    } finally {
      setBtPrinting(false);
    }
  };

  // زر طباعة ذكي: إذا فيه طابعة كاشير مرتبطة يطبع عليها مباشرة، وإلا يفتح الطباعة العادية
  const handleSmartPrint = async () => {
    if (getSavedPrinter()) {
      const ok = await handleBtPrint();
      if (ok) return;
    }
    handlePrint();
  };
  const isManager = canEdit("event_pos");
  const canVoid = canDelete("event_pos");
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [cardType, setCardType] = useState<string>("mada");
  const [amountPaid, setAmountPaid] = useState<string>("");
  const [showCheckout, setShowCheckout] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const [discountType, setDiscountType] = useState<string | null>(null);
  const [discountValue, setDiscountValue] = useState<string>("");
  const [showDiscount, setShowDiscount] = useState(false);

  const [loyaltyCode, setLoyaltyCode] = useState<string>("");
  const [loyaltyMember, setLoyaltyMember] = useState<any>(null);
  const [loyaltyChecking, setLoyaltyChecking] = useState(false);
  const [loyaltyError, setLoyaltyError] = useState<string | null>(null);

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
  const [showMobileCart, setShowMobileCart] = useState(false);

  const [selectedEventId, setSelectedEventId] = useState<number | null>(() => {
    const v = localStorage.getItem("pos_selected_event");
    const n = v ? parseInt(v, 10) : NaN;
    return Number.isFinite(n) ? n : null;
  });
  const [showShiftOpen, setShowShiftOpen] = useState(false);
  const [openingCash, setOpeningCash] = useState("");
  const [showShiftClose, setShowShiftClose] = useState(false);
  const [actualCashInput, setActualCashInput] = useState("");
  const [actualNetworkInput, setActualNetworkInput] = useState("");
  const [shiftCloseNotes, setShiftCloseNotes] = useState("");
  const [closedShiftResult, setClosedShiftResult] = useState<any>(null);

  const [showPartialRefund, setShowPartialRefund] = useState(false);
  const [refundSaleData, setRefundSaleData] = useState<any>(null);
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundQtys, setRefundQtys] = useState<Record<number, number>>({});
  const [refundMethod, setRefundMethod] = useState<string>("cash");
  const [refundReason, setRefundReason] = useState("");

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

  useEffect(() => {
    if (selectedEventId != null) localStorage.setItem("pos_selected_event", String(selectedEventId));
    else localStorage.removeItem("pos_selected_event");
  }, [selectedEventId]);

  const { data: posEvents = [] } = useQuery({
    queryKey: ["/api/pos/events", EVENT_BRANCH_ID],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/pos/events?branchId=${EVENT_BRANCH_ID}`);
      return res.json();
    },
  });

  const activeEvents = useMemo(() => (posEvents as any[]).filter((e: any) => e.status === "active"), [posEvents]);
  const selectedEvent = useMemo(() => (posEvents as any[]).find((e: any) => e.id === selectedEventId) || null, [posEvents, selectedEventId]);

  useEffect(() => {
    // اختيار تلقائي إذا كان هناك إيفنت نشط واحد فقط، وإلغاء الاختيار إذا لم يعد نشطاً
    if (selectedEventId != null && posEvents.length > 0) {
      const ev = (posEvents as any[]).find((e: any) => e.id === selectedEventId);
      if (!ev || ev.status !== "active") setSelectedEventId(null);
    } else if (selectedEventId == null && activeEvents.length === 1) {
      setSelectedEventId(activeEvents[0].id);
    }
  }, [posEvents, activeEvents, selectedEventId]);

  const { data: currentShift, refetch: refetchShift } = useQuery({
    queryKey: ["/api/pos/shifts/current", selectedEventId],
    enabled: selectedEventId != null,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/pos/shifts/current?eventId=${selectedEventId}`);
      return res.json();
    },
  });

  const { data: shiftStats } = useQuery({
    queryKey: ["/api/pos/shifts/stats", currentShift?.id, showShiftClose],
    enabled: showShiftClose && !!currentShift?.id,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/pos/shifts/${currentShift.id}/stats`);
      return res.json();
    },
  });

  const openShiftMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/pos/shifts/open", {
        eventId: selectedEventId,
        openingCash: parseFloat(openingCash) || 0,
      });
      return res.json();
    },
    onSuccess: () => {
      setShowShiftOpen(false);
      setOpeningCash("");
      refetchShift();
      toast({ title: "تم فتح الوردية بنجاح" });
    },
    onError: (err: any) => {
      toast({ title: "خطأ في فتح الوردية", description: err?.message, variant: "destructive" });
    },
  });

  const closeShiftMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/pos/shifts/${currentShift.id}/close`, {
        actualCash: parseFloat(actualCashInput),
        actualNetwork: parseFloat(actualNetworkInput) || 0,
        notes: shiftCloseNotes || undefined,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      setClosedShiftResult(data);
      setActualCashInput("");
      setActualNetworkInput("");
      setShiftCloseNotes("");
      queryClient.setQueryData(["/api/pos/shifts/current", selectedEventId], null);
      queryClient.invalidateQueries({ queryKey: ["/api/pos/shifts/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pos/shifts/stats"] });
      refetchShift();
      toast({ title: "تم إغلاق الوردية" });
    },
    onError: (err: any) => {
      toast({ title: "خطأ في إغلاق الوردية", description: err?.message, variant: "destructive" });
    },
  });

  const openPartialRefund = async (saleId: number) => {
    setRefundLoading(true);
    setShowPartialRefund(true);
    setRefundQtys({});
    setRefundMethod("cash");
    setRefundReason("");
    setRefundSaleData(null);
    try {
      const res = await apiRequest("GET", `/api/pos/sales/${saleId}/refunds`);
      setRefundSaleData(await res.json());
    } catch {
      toast({ title: "خطأ", description: "فشل في تحميل بيانات الفاتورة", variant: "destructive" });
      setShowPartialRefund(false);
    } finally {
      setRefundLoading(false);
    }
  };

  const partialRefundMutation = useMutation({
    mutationFn: async () => {
      const items = Object.entries(refundQtys)
        .filter(([, q]) => q > 0)
        .map(([saleItemId, quantity]) => ({ saleItemId: parseInt(saleItemId, 10), quantity }));
      const res = await apiRequest("POST", `/api/pos/sales/${refundSaleData.sale.id}/partial-refund`, {
        items,
        refundMethod,
        reason: refundReason,
      });
      return res.json();
    },
    onSuccess: () => {
      setShowPartialRefund(false);
      setRefundSaleData(null);
      queryClient.invalidateQueries({ queryKey: ["/api/pos/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pos/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pos/shifts/stats"] });
      toast({ title: "تم تسجيل الاسترجاع الجزئي بنجاح" });
    },
    onError: (err: any) => {
      let msg = err?.message || "";
      const m = msg.match(/^\d+:\s*(.*)$/s);
      if (m) { try { msg = JSON.parse(m[1]).error || m[1]; } catch { msg = m[1]; } }
      toast({ title: "خطأ في الاسترجاع", description: msg, variant: "destructive" });
    },
  });

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
    refetchInterval: () => (typeof document !== "undefined" && document.hidden ? false : 30000),
  });

  const { data: todaySummary } = useQuery({
    queryKey: ["/api/pos/summary", EVENT_BRANCH_ID],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const res = await apiRequest("GET", `/api/pos/summary/${EVENT_BRANCH_ID}/${today}`);
      return res.json();
    },
    refetchInterval: () => (typeof document !== "undefined" && document.hidden ? false : 30000),
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
    setLoyaltyCode("");
    setLoyaltyMember(null);
    setLoyaltyError(null);
  }, []);

  const validateLoyaltyCode = useCallback(async () => {
    const code = loyaltyCode.trim();
    if (!code) return;
    setLoyaltyChecking(true);
    setLoyaltyError(null);
    try {
      const res = await apiRequest("POST", "/api/loyalty/validate", { code, branchId: EVENT_BRANCH_ID });
      const data = await res.json();
      const member = data.member ?? data;
      setLoyaltyMember(member);
      if (member.discountType === "gift") {
        // Gift cards carry no monetary discount; the reward is handled separately
        setDiscountType(null);
        setDiscountValue("");
      } else {
        setDiscountType(member.discountType === "fixed_amount" ? "fixed" : "percentage");
        setDiscountValue(String(member.discountValue));
      }
      toast({ title: "تم تطبيق بطاقة الولاء", description: `${member.customerName} — متبقٍ ${member.remainingUses}` });
    } catch (err: any) {
      setLoyaltyMember(null);
      let msg = err?.message || "رمز غير صالح";
      const m = msg.match(/^\d+:\s*(.*)$/s);
      if (m) {
        try {
          const parsed = JSON.parse(m[1]);
          msg = parsed.error || m[1];
        } catch {
          msg = m[1];
        }
      }
      setLoyaltyError(msg);
    } finally {
      setLoyaltyChecking(false);
    }
  }, [loyaltyCode, toast]);

  const removeLoyalty = useCallback(() => {
    setLoyaltyMember(null);
    setLoyaltyCode("");
    setLoyaltyError(null);
    setDiscountType(null);
    setDiscountValue("");
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
        eventId: selectedEventId || undefined,
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
        loyaltyMemberId: loyaltyMember?.memberId || undefined,
        paymentMethod: finalPaymentMethod,
        cardType: (finalPaymentMethod === "network" || finalPaymentMethod === "split") ? cardType : null,
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
        cardType: (splitMode || paymentMethod === "network") ? cardType : null,
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
      queryClient.invalidateQueries({ queryKey: ["/api/pos/shifts/stats"] });
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
        label: holdLabel || `طلب ${new Date().toLocaleTimeString("ar-SA-u-nu-latn", { hour: "2-digit", minute: "2-digit" })}`,
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
        * { box-sizing: border-box !important; margin: 0 !important; padding: 0 !important; }
        html, body { width: 80mm !important; height: auto !important; margin: 0 !important; padding: 0 !important; background: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; font-family: 'Cairo', sans-serif !important; overflow: hidden !important; direction: rtl !important; }
        body * { visibility: hidden !important; }
        .receipt-print, .receipt-print * { visibility: visible !important; box-sizing: border-box !important; }
        .receipt-print { position: absolute !important; top: 0 !important; right: 0 !important; left: 0 !important; width: 100% !important; max-width: 80mm !important; margin: 0 !important; padding: 2mm 3mm !important; font-size: 9px !important; line-height: 1.3 !important; font-family: 'Cairo', sans-serif !important; color: #000 !important; background: white !important; box-shadow: none !important; border: none !important; border-radius: 0 !important; page-break-inside: avoid !important; overflow: hidden !important; word-wrap: break-word !important; overflow-wrap: break-word !important; direction: rtl !important; }
        .receipt-print div { display: block !important; page-break-inside: avoid !important; overflow: hidden !important; word-wrap: break-word !important; }
        .receipt-print table { width: 100% !important; border-collapse: collapse !important; border: none !important; box-shadow: none !important; page-break-inside: avoid !important; table-layout: fixed !important; direction: rtl !important; }
        .receipt-print th, .receipt-print td { border: none !important; padding: 2px 2px !important; font-size: 9px !important; background: transparent !important; color: #000 !important; box-shadow: none !important; overflow: hidden !important; word-wrap: break-word !important; text-overflow: ellipsis !important; }
        .receipt-print .receipt-separator { visibility: visible !important; border: none !important; border-top: 1px dashed #000 !important; margin: 3px 0 !important; height: 0 !important; padding: 0 !important; }
        .receipt-print img { max-height: 35px !important; max-width: 40mm !important; }
        .receipt-print svg { visibility: visible !important; display: block !important; margin: 0 auto !important; max-width: 22mm !important; max-height: 22mm !important; }
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
    if (activeEvents.length > 0 && selectedEventId == null) {
      toast({ title: "اختر الإيفنت أولاً", description: "حدد الإيفنت من أعلى الشاشة قبل البيع", variant: "destructive" });
      return;
    }
    if (selectedEventId != null && !currentShift) {
      toast({ title: "يجب فتح وردية أولاً", description: "افتح ورديتك قبل تسجيل المبيعات", variant: "destructive" });
      setShowShiftOpen(true);
      return;
    }
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
    // الفواتير المسترجعة جزئيًا تبقى ضمن المبيعات ويُخصم منها مبلغ الاسترجاع
    const completedSales = todaySales.filter((s: any) => s.status === "completed" || s.status === "partially_refunded");
    const voidedSales = todaySales.filter((s: any) => s.status === "voided");
    const refundedSales = todaySales.filter((s: any) => s.status === "refunded");
    const partialRefundsTotal = completedSales.reduce((sum: number, s: any) => sum + (s.refundedAmount || 0), 0);
    const partialRefundsCash = completedSales.reduce((sum: number, s: any) => sum + (s.refundedCash || 0), 0);
    const partialRefundsNetwork = completedSales.reduce((sum: number, s: any) => sum + (s.refundedNetwork || 0), 0);
    const totalSales = completedSales.reduce((sum: number, s: any) => sum + (s.totalAmount || 0), 0) - partialRefundsTotal;
    const cashTotal = completedSales.filter((s: any) => s.paymentMethod === "cash").reduce((sum: number, s: any) => sum + (s.totalAmount || 0), 0);
    const networkTotal = completedSales.filter((s: any) => s.paymentMethod === "network").reduce((sum: number, s: any) => sum + (s.totalAmount || 0), 0);
    const splitTotal = completedSales.filter((s: any) => s.paymentMethod === "split").reduce((sum: number, s: any) => sum + (s.totalAmount || 0), 0);
    const splitCash = completedSales.filter((s: any) => s.paymentMethod === "split").reduce((sum: number, s: any) => sum + (s.cashAmount || 0), 0);
    const splitNetwork = completedSales.filter((s: any) => s.paymentMethod === "split").reduce((sum: number, s: any) => sum + (s.networkAmount || 0), 0);
    const totalDiscount = completedSales.reduce((sum: number, s: any) => sum + (s.discountAmount || 0), 0);
    const totalVat = completedSales.reduce((sum: number, s: any) => sum + (s.vatAmount || 0), 0);
    return { completedSales, voidedSales, refundedSales, totalSales, cashTotal, networkTotal, splitTotal, splitCash, splitNetwork, totalDiscount, totalVat, partialRefundsTotal, partialRefundsCash, partialRefundsNetwork, totalCashInDrawer: cashTotal + splitCash - partialRefundsCash };
  }, [todaySales]);

  const timeStr = currentTime.toLocaleTimeString("ar-SA-u-nu-latn", { hour: "2-digit", minute: "2-digit" });
  const dateStr = currentTime.toLocaleDateString("ar-SA-u-nu-latn", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="h-[100dvh] flex flex-col bg-[#FAF8F5] overflow-hidden select-none" dir="rtl">
      {/* Top Navigation Bar */}
      <header className="bg-[#1C1411] border-b border-[#362720] px-5 py-3 flex items-center justify-between shrink-0 shadow-md">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-gradient-to-br from-[#D4A373] to-[#B38250] rounded-xl flex items-center justify-center shadow-inner">
              <Zap className="w-6 h-6 text-[#1C1411]" />
            </div>
            <div>
              <h1 className="text-base font-black text-[#F4EBE1] leading-tight" data-testid="text-pos-title">إيفنت موسمي</h1>
              <p className="text-[11px] text-[#A69587] leading-tight">{(user as any)?.fullName || user?.username}</p>
            </div>
          </div>
          {activeEvents.length > 0 && (
            <>
              <div className="h-8 w-px bg-[#362720]" />
              <div className="flex items-center gap-1.5">
                <Store className="w-4 h-4 text-[#D4A373] shrink-0" />
                <select
                  value={selectedEventId ?? ""}
                  onChange={e => setSelectedEventId(e.target.value ? parseInt(e.target.value, 10) : null)}
                  className="text-[12px] font-bold text-[#1C1411] bg-[#F4EBE1] border border-[#D4A373] rounded-xl px-3 py-1.5 outline-none max-w-[180px] shadow-sm"
                  data-testid="select-event"
                >
                  <option value="">اختر الإيفنت...</option>
                  {activeEvents.map((ev: any) => (
                    <option key={ev.id} value={ev.id}>{ev.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}
          <div className="h-8 w-px bg-[#362720] hidden md:block" />
          <div className="text-[11px] text-[#A69587] hidden md:block">
            <span>{dateStr}</span>
            <span className="mx-1.5">|</span>
            <span className="font-mono font-bold text-[#D4A373]">{timeStr}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedEventId != null && (
            currentShift ? (
              <button
                onClick={() => { setClosedShiftResult(null); setShowShiftClose(true); }}
                className="flex items-center gap-1.5 bg-[#2E3C2B] text-[#86C275] rounded-xl px-4 py-2 border border-[#455A41] hover:bg-[#394B35] transition-all active:scale-95 touch-manipulation shadow-sm"
                data-testid="button-shift-status"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-[#86C275] animate-pulse shadow-[0_0_8px_#86C275]" />
                <span className="text-xs font-bold">وردية مفتوحة</span>
                <LogOut className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={() => setShowShiftOpen(true)}
                className="flex items-center gap-2 bg-gradient-to-r from-[#D4A373] to-[#B38250] text-[#1C1411] rounded-xl px-5 py-2 hover:from-[#E1B68A] hover:to-[#C29263] transition-all active:scale-95 touch-manipulation shadow-md"
                data-testid="button-open-shift"
              >
                <DoorOpen className="w-3.5 h-3.5" />
                <span className="text-xs font-bold">فتح وردية</span>
              </button>
            )
          )}
          {heldOrders.length > 0 && (
            <button
              onClick={() => setShowHeld(true)}
              className="relative flex items-center gap-1.5 bg-[#4A3320] text-[#E8C49C] rounded-xl px-4 py-2 border border-[#6B4B31] hover:bg-[#5C3F28] transition-all active:scale-95 touch-manipulation shadow-sm"
              data-testid="button-held-orders"
            >
              <Pause className="w-3.5 h-3.5" />
              <span className="text-xs font-bold">{heldOrders.length} معلق</span>
            </button>
          )}
          {isManager && todaySummary && (
            <>
              <div className="flex items-center gap-2 bg-[#212E27] text-[#93C986] rounded-xl px-4 py-2 border border-[#3A5043]">
                <TrendingUp className="w-3.5 h-3.5" />
                <span className="text-xs font-bold">{(todaySummary.totalSales || 0).toFixed(0)}</span>
                <span className="text-[10px] text-[#699E5C]">ر.س</span>
              </div>
              <div className="flex items-center gap-2 bg-[#1E2B38] text-[#86A8D2] rounded-xl px-4 py-2 border border-[#314457]">
                <Receipt className="w-3.5 h-3.5" />
                <span className="text-xs font-bold">{todaySummary.totalTransactions || 0}</span>
                <span className="text-[10px] text-[#5E83A8]">فاتورة</span>
              </div>
            </>
          )}
          {isManager && (
            <>
              <div className="h-8 w-px bg-[#362720] mx-2" />
              <button
                onClick={() => setShowZReport(true)}
                className="w-10 h-10 rounded-xl bg-[#2D2235] flex items-center justify-center hover:bg-[#3D2F47] transition-all active:scale-90 touch-manipulation border border-[#4C3A5A]"
                title="تقرير الوردية (F4)"
                data-testid="button-zreport"
              >
                <FileText className="w-5 h-5 text-[#B898D9]" />
              </button>
              <button
                onClick={() => setShowHistory(true)}
                className="w-10 h-10 rounded-xl bg-[#2C201A] flex items-center justify-center hover:bg-[#3D2D25] transition-all active:scale-90 touch-manipulation border border-[#4A372D]"
                title="سجل المبيعات"
                data-testid="button-history"
              >
                <ListOrdered className="w-5 h-5 text-[#D4A373]" />
              </button>
              <Link
                href="/event-reports"
                className="w-10 h-10 rounded-xl bg-[#2C201A] flex items-center justify-center hover:bg-[#3D2D25] transition-all active:scale-90 touch-manipulation border border-[#4A372D]"
                title="تقارير الإيفنتات"
                data-testid="button-event-reports"
              >
                <FileText className="w-5 h-5 text-[#D4A373]" />
              </Link>
              <Link
                href="/event-pos-settings"
                className="w-10 h-10 rounded-xl bg-[#2C201A] flex items-center justify-center hover:bg-[#3D2D25] transition-all active:scale-90 touch-manipulation border border-[#4A372D]"
                title="الإعدادات"
                data-testid="button-settings"
              >
                <Settings className="w-5 h-5 text-[#D4A373]" />
              </Link>
            </>
          )}
        </div>
      </header>

      {/* No event selected prompt */}
      {!selectedEvent && activeEvents.length > 0 && (
        <div className="shrink-0 px-3 pt-2 md:px-4">
          <div className="rounded-[20px] border-2 border-dashed border-[#D4A373]/40 bg-[#D4A373]/5 px-5 py-3.5 flex items-center gap-4">
            <div className="w-12 h-12 bg-[#D4A373]/10 rounded-2xl flex items-center justify-center shrink-0">
              <PartyPopper className="w-6 h-6 text-[#D4A373]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-black text-[#5C422E]">اختر الإيفنت للبدء</div>
              <div className="text-[12px] text-[#8C6C50]">حدّد الإيفنت من القائمة في الأعلى ثم افتح وردية لبدء البيع</div>
            </div>
          </div>
        </div>
      )}

      {/* Event Banner */}
      {selectedEvent && (
        <div className="shrink-0 px-3 pt-2 md:px-4">
          <div className="relative overflow-hidden rounded-[20px] bg-gradient-to-r from-[#B38250] to-[#D4A373] px-5 py-3.5 flex items-center justify-between gap-4 shadow-lg shadow-[#D4A373]/20">
            <div className="absolute -top-16 -left-16 w-48 h-48 rounded-full bg-white/20 pointer-events-none blur-xl" />
            <div className="absolute -bottom-16 right-1/4 w-40 h-40 rounded-full bg-[#1C1411]/5 pointer-events-none blur-xl" />
            <div className="relative flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 bg-[#1C1411]/10 backdrop-blur-md rounded-[16px] flex items-center justify-center shrink-0 shadow-inner">
                <PartyPopper className="w-6 h-6 text-[#1C1411]" />
              </div>
              <div className="min-w-0">
                <div className="text-[#1C1411] font-black text-[16px] truncate leading-tight" data-testid="text-event-banner-name">{selectedEvent.name}</div>
                <div className="text-[#4A3219] text-[11px] font-bold flex items-center gap-3 flex-wrap mt-1">
                  {selectedEvent.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{selectedEvent.location}</span>}
                  {(selectedEvent.startDate || selectedEvent.endDate) && (
                    <span className="hidden sm:flex items-center gap-1"><CalendarDays className="w-3 h-3" />{selectedEvent.startDate || "؟"} ← {selectedEvent.endDate || "؟"}</span>
                  )}
                  {selectedEvent.invoicePrefix && <span className="hidden md:flex items-center gap-1"><Hash className="w-3 h-3" />{selectedEvent.invoicePrefix}</span>}
                </div>
              </div>
            </div>
            <div className="relative shrink-0">
              {currentShift ? (
                <div className="flex items-center gap-3 bg-[#1C1411]/10 backdrop-blur-md rounded-[16px] px-4 py-2 shadow-inner">
                  <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse shrink-0" />
                  <div className="text-[#1C1411] text-[11px] leading-tight">
                    <div className="font-bold">وردية مفتوحة · {currentShift.cashierName}</div>
                    <div className="text-[#4A3219] hidden sm:block font-semibold mt-0.5">
                      افتتاح {(currentShift.openingCash || 0).toFixed(0)} ر.س · منذ {currentShift.openedAt ? new Date(currentShift.openedAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" }) : "—"}
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowShiftOpen(true)}
                  className="flex items-center gap-2 bg-[#1C1411] text-[#D4A373] rounded-[14px] px-5 py-2.5 text-[12px] font-black shadow-lg hover:bg-[#2C201A] transition-all active:scale-95 touch-manipulation"
                  data-testid="button-banner-open-shift"
                >
                  <DoorOpen className="w-4 h-4" />
                  افتح وردية للبدء
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden px-3 pt-2 pb-16 md:px-4 md:py-3">
      <div className="page-container h-full flex gap-3 overflow-hidden">
        {/* RIGHT: Products Section */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#FFFFFF] rounded-[24px] shadow-sm border border-[#EBE3D8]">
          <div className="px-3 pt-3 pb-1.5 shrink-0">
            <div className="relative">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[#A69587]" />
              <Input
                placeholder="ابحث عن منتج بالاسم أو الفئة..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pr-10 pl-9 bg-[#FAF8F5] border-[#EBE3D8] h-11 text-[13px] rounded-[16px] focus:bg-white focus:border-[#D4A373] focus:ring-2 focus:ring-[#D4A373]/20 transition-all placeholder:text-[#A69587] text-[#5C422E] font-bold"
                data-testid="input-search-product"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute left-3 top-1/2 -translate-y-1/2 w-7 h-7 bg-[#EBE3D8] hover:bg-[#D4A373] hover:text-[#1C1411] rounded-full flex items-center justify-center transition-colors" data-testid="button-clear-search">
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
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-bold whitespace-nowrap transition-all active:scale-95 touch-manipulation border ${
                    selectedCategory === "all"
                      ? "bg-[#1C1411] text-[#D4A373] border-[#1C1411] shadow-md"
                      : "bg-[#FFFFFF] text-[#8C6C50] border-[#EBE3D8] hover:border-[#D4A373]/50 hover:bg-[#FAF8F5]"
                  }`}
                  data-testid="category-all"
                >
                  <Sparkles className="w-3 h-3" />
                  الكل
                  <span className={`text-[11px] font-bold px-1.5 rounded-full ${selectedCategory === "all" ? "bg-[#362720] text-[#D4A373]" : "bg-[#FAF8F5] text-[#A69587]"}`}>
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
                      className={`flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-bold whitespace-nowrap transition-all active:scale-95 touch-manipulation border ${
                        selectedCategory === cat
                          ? "bg-gradient-to-r from-[#B38250] to-[#D4A373] text-[#1C1411] border-transparent shadow-md"
                          : "bg-[#FFFFFF] text-[#8C6C50] border-[#EBE3D8] hover:border-[#D4A373]/50 hover:bg-[#FAF8F5]"
                      }`}
                      data-testid={`category-${cat}`}
                    >
                      <IconComp className="w-3 h-3" />
                      {cat}
                      <span className={`text-[11px] font-bold px-1.5 rounded-full ${selectedCategory === cat ? "bg-[#1C1411]/20 text-[#1C1411]" : "bg-[#FAF8F5] text-[#A69587]"}`}>
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
                    <Loader2 className="w-10 h-10 text-[#D4A373] animate-spin" />
                  </div>
                  <p className="text-base text-gray-400 font-medium">جاري تحميل المنتجات...</p>
                </div>
              </div>
            ) : displayProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full">
                <div className="w-32 h-32 bg-[#FAF8F5] rounded-[32px] flex items-center justify-center mb-6 shadow-inner border border-[#EBE3D8]">
                  <Package className="w-16 h-16 text-[#C2B4A7]" />
                </div>
                <p className="text-[22px] font-black text-[#A69587] mb-2">لا توجد أصناف</p>
                <p className="text-[14px] font-bold text-[#C2B4A7] mb-6">{isManager ? "أضف منتجات من صفحة الإعدادات" : "تواصل مع المدير لإضافة المنتجات"}</p>
                {isManager && (
                  <Link href="/event-pos-settings" className="inline-flex items-center gap-2 px-6 py-3.5 bg-[#1C1411] text-[#D4A373] rounded-[16px] font-black text-[14px] hover:bg-[#2C201A] transition-all shadow-lg active:scale-95 touch-manipulation" data-testid="link-add-products">
                    <Settings className="w-4 h-4" />
                    إعدادات نقطة البيع
                  </Link>
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
                      className={`group relative bg-[#FFFFFF] rounded-[20px] p-3 text-center transition-all duration-150 active:scale-[0.96] select-none touch-manipulation ${
                        inCart 
                          ? "ring-2 ring-[#D4A373] shadow-lg shadow-[#D4A373]/20 border-transparent bg-[#FAF8F5]" 
                          : "shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_16px_rgba(0,0,0,0.04)] border border-[#EBE3D8] hover:border-[#D4A373]/40"
                      }`}
                      data-testid={`product-card-${bp.productId}`}
                    >
                      {inCart && (
                        <div className="absolute -top-2 -left-2 min-w-[28px] h-7 bg-[#1C1411] text-[#D4A373] rounded-xl text-[13px] px-2 flex items-center justify-center font-black shadow-lg shadow-[#1C1411]/20 z-10 ring-2 ring-[#FFFFFF]">
                          {inCart.quantity}
                        </div>
                      )}
                      <div className={`w-12 h-12 rounded-[14px] flex items-center justify-center mx-auto mb-2.5 transition-all ${
                        inCart 
                          ? "bg-gradient-to-br from-[#B38250] to-[#D4A373] shadow-md scale-110" 
                          : "bg-[#FAF8F5] group-hover:bg-[#F4EBE1] border border-[#EBE3D8]"
                      }`}>
                        <Package className={`w-6 h-6 ${inCart ? "text-[#1C1411]" : "text-[#D4A373]"}`} />
                      </div>
                      <div className="text-[13px] font-black text-[#2C201A] mb-1 line-clamp-2 leading-tight min-h-[36px] flex items-center justify-center">
                        {bp.product?.name}
                      </div>
                      <div className="text-[11px] text-[#A69587] mb-2 font-bold">{bp.product?.category}</div>
                      <div className={`rounded-[12px] py-2 px-2 transition-colors ${
                        inCart ? "bg-[#1C1411] text-[#D4A373]" : "bg-[#FAF8F5] text-[#5C422E] group-hover:bg-[#F4EBE1]"
                      }`}>
                        <span className="font-black text-[16px] tracking-tight">{price.toFixed(2)}</span>
                        <span className="text-[11px] mr-1 font-bold opacity-80">ر.س</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* LEFT: Cart Panel */}
        <div className={`${showMobileCart ? "fixed inset-x-2 bottom-2 top-16 z-50 flex shadow-[0_30px_60px_rgba(0,0,0,0.15)]" : "hidden"} md:static md:flex md:inset-auto md:z-auto md:shadow-[0_8px_24px_rgba(28,20,17,0.04)] w-auto md:w-[340px] bg-[#FFFFFF] flex-col rounded-[24px] border border-[#EBE3D8] shrink-0 overflow-hidden`}>
          <div className="px-4 py-4 border-b border-[#EBE3D8] flex items-center justify-between shrink-0 bg-[#FAF8F5]/50">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-[#F4EBE1] rounded-[12px] flex items-center justify-center border border-[#EBE3D8]">
                <ShoppingCart className="w-5 h-5 text-[#D4A373]" />
              </div>
              <div>
                <h2 className="font-black text-[15px] text-[#2C201A] leading-tight">الطلب الحالي</h2>
                <p className="text-[11px] text-[#A69587] mt-0.5 font-bold">
                  {cartItemsCount > 0 ? `${cartItemsCount} صنف` : "لا توجد أصناف"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowMobileCart(false)}
                className="md:hidden w-10 h-10 rounded-[12px] flex items-center justify-center text-[#A69587] hover:text-[#5C422E] hover:bg-[#FAF8F5] transition-colors touch-manipulation border border-transparent hover:border-[#EBE3D8]"
                data-testid="button-close-mobile-cart"
              >
                <X className="w-5 h-5" />
              </button>
              {cart.length > 0 && (
                <>
                  <button
                    onClick={() => setShowHoldDialog(true)}
                    className="flex items-center gap-1.5 text-[12px] font-bold text-[#B38250] hover:text-[#8C6C50] px-3 py-2 rounded-xl hover:bg-[#F4EBE1] transition-colors active:scale-95 touch-manipulation border border-transparent hover:border-[#EBE3D8]"
                    title="تعليق الطلب (F2)"
                    data-testid="button-hold-order"
                  >
                    <Pause className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={clearCart} 
                    className="flex items-center gap-1.5 text-[12px] font-bold text-[#E07A5F] hover:text-[#C85A3F] px-3 py-2 rounded-xl hover:bg-[#FDF5F3] transition-colors active:scale-95 touch-manipulation border border-transparent hover:border-[#F9E8E4]" 
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
                <div className="w-16 h-16 bg-[#FAF8F5] rounded-2xl flex items-center justify-center mb-4 border border-[#EBE3D8]">
                  <ShoppingCart className="w-8 h-8 text-[#D4A373]/50" />
                </div>
                <p className="text-[15px] font-black text-[#A69587] mb-1">السلة فارغة</p>
                <p className="text-[12px] text-[#C2B4A7] text-center">اضغط على أي منتج لإضافته للطلب</p>
                <div className="mt-4 flex gap-2 text-[10px] text-[#A69587] font-bold">
                  <span className="bg-[#FAF8F5] border border-[#EBE3D8] px-2 py-1 rounded-md">F1 إتمام</span>
                  <span className="bg-[#FAF8F5] border border-[#EBE3D8] px-2 py-1 rounded-md">F2 تعليق</span>
                  <span className="bg-[#FAF8F5] border border-[#EBE3D8] px-2 py-1 rounded-md">F3 معلق</span>
                </div>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {cart.map((item) => (
                  <div 
                    key={item.productId} 
                    className="bg-[#FAF8F5] rounded-[16px] p-3 transition-all border border-transparent hover:border-[#EBE3D8]" 
                    data-testid={`cart-item-${item.productId}`}
                  >
                    <div className="flex items-start justify-between mb-1.5">
                      <div className="flex-1 min-w-0 ml-1.5">
                        <div className="text-[14px] font-black text-[#2C201A] truncate leading-tight">{item.productName}</div>
                        <div className="text-[11px] text-[#A69587] mt-0.5 font-bold">{item.unitPrice.toFixed(2)} ر.س</div>
                      </div>
                      <button 
                        onClick={() => removeFromCart(item.productId)} 
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-[#C2B4A7] hover:text-[#E07A5F] hover:bg-[#FDF5F3] transition-all active:scale-90 touch-manipulation shrink-0" 
                        data-testid={`button-remove-${item.productId}`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center bg-[#FFFFFF] rounded-[14px] border border-[#EBE3D8] overflow-hidden shadow-sm">
                        <button 
                          onClick={() => updateQuantity(item.productId, -1)} 
                          className="w-11 h-10 flex items-center justify-center hover:bg-[#FAF8F5] transition-colors active:scale-90 touch-manipulation border-l border-[#EBE3D8]" 
                          data-testid={`button-decrease-${item.productId}`}
                        >
                          <Minus className="w-4 h-4 text-[#8C6C50]" />
                        </button>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={e => setQuantityDirect(item.productId, parseInt(e.target.value) || 0)}
                          className="w-12 text-center text-[15px] font-black text-[#1C1411] bg-transparent border-none outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          data-testid={`input-qty-${item.productId}`}
                        />
                        <button 
                          onClick={() => updateQuantity(item.productId, 1)} 
                          className="w-11 h-10 flex items-center justify-center hover:bg-[#FAF8F5] transition-colors active:scale-90 touch-manipulation border-r border-[#EBE3D8]" 
                          data-testid={`button-increase-${item.productId}`}
                        >
                          <Plus className="w-4 h-4 text-[#8C6C50]" />
                        </button>
                      </div>
                      <div className="text-[16px] font-black text-[#1C1411]">
                        {(item.unitPrice * item.quantity).toFixed(2)} <span className="text-[11px] font-bold text-[#A69587]">ر.س</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cart Footer */}
          <div className="border-t border-gray-100 shrink-0">
            <div className="px-4 py-3 space-y-1.5 bg-[#FAF8F5]">
              <div className="flex justify-between text-[11px]">
                <span className="text-[#8C6C50] font-bold">المجموع بدون ضريبة</span>
                <span className="text-[#5C422E] font-black">{cartTotal.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-[#8C6C50] font-bold">ضريبة القيمة المضافة 15%</span>
                <span className="text-[#5C422E] font-black">{cartTotal.vat.toFixed(2)}</span>
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
              <div className="flex justify-between items-center pt-2.5 mt-1 border-t border-[#EBE3D8]">
                <span className="text-[16px] font-black text-[#1C1411]">الإجمالي</span>
                <span className="text-[24px] font-black text-[#1C1411] tracking-tight" data-testid="text-cart-total">
                  {cartTotal.total.toFixed(2)} <span className="text-[11px]">ر.س</span>
                </span>
              </div>
            </div>

            <div className="p-3 space-y-2">
              {/* Discount + Split buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDiscount(true)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-bold transition-all active:scale-95 touch-manipulation border ${
                    discountType
                      ? "bg-[#FDF5F3] text-[#E07A5F] border-[#F9E8E4]"
                      : "bg-[#FFFFFF] text-[#8C6C50] border-[#EBE3D8] hover:bg-[#FAF8F5]"
                  }`}
                  data-testid="button-discount"
                >
                  <Percent className="w-3 h-3" />
                  {discountType ? `خصم ${cartTotal.discount.toFixed(0)} ر.س` : "خصم"}
                </button>
                <button
                  onClick={() => { setSplitMode(!splitMode); if (!splitMode) setPaymentMethod("split"); else setPaymentMethod("cash"); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-bold transition-all active:scale-95 touch-manipulation border ${
                    splitMode
                      ? "bg-[#FDF7F2] text-[#B38250] border-[#EBE3D8]"
                      : "bg-[#FFFFFF] text-[#8C6C50] border-[#EBE3D8] hover:bg-[#FAF8F5]"
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
                    className={`flex items-center justify-center gap-2 py-3 rounded-[16px] text-[13px] font-black transition-all active:scale-95 touch-manipulation ${
                      paymentMethod === "cash"
                        ? "bg-[#86C275] text-[#1C1411] shadow-lg shadow-[#86C275]/20"
                        : "bg-[#FAF8F5] text-[#8C6C50] hover:bg-[#F4EBE1] border border-[#EBE3D8]"
                    }`}
                    data-testid="button-payment-cash"
                  >
                    <Banknote className="w-4 h-4" />
                    نقد
                  </button>
                  <button
                    onClick={() => setPaymentMethod("network")}
                    className={`flex items-center justify-center gap-2 py-3 rounded-[16px] text-[13px] font-black transition-all active:scale-95 touch-manipulation ${
                      paymentMethod === "network"
                        ? "bg-[#86A8D2] text-[#1C1411] shadow-lg shadow-[#86A8D2]/20"
                        : "bg-[#FAF8F5] text-[#8C6C50] hover:bg-[#F4EBE1] border border-[#EBE3D8]"
                    }`}
                    data-testid="button-payment-network"
                  >
                    <CreditCard className="w-4 h-4" />
                    شبكة
                  </button>
                </div>
              )}

              <button
                className="w-full bg-gradient-to-r from-[#D4A373] to-[#B38250] hover:from-[#E1B68A] hover:to-[#C29263] disabled:from-[#EBE3D8] disabled:to-[#EBE3D8] disabled:text-[#A69587] text-[#1C1411] font-black text-[16px] py-3.5 rounded-[16px] flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#D4A373]/30 disabled:shadow-none active:scale-[0.97] touch-manipulation"
                disabled={cart.length === 0 || createSaleMutation.isPending}
                onClick={handleCheckout}
                data-testid="button-checkout"
              >
                {createSaleMutation.isPending ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> جاري المعالجة...</>
                ) : (
                  <><Receipt className="w-5 h-5" /> إتمام الطلب (F1) {cartTotal.total > 0 && <span className="bg-[#1C1411]/10 px-3 py-1 rounded-[10px] text-[14px]">{cartTotal.total.toFixed(2)} ر.س</span>}</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* Mobile bottom bar */}
      {!showMobileCart && (
        <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#FFFFFF] border-t border-[#EBE3D8] px-4 py-3 flex items-center gap-3 shadow-[0_-10px_40px_rgba(28,20,17,0.08)]">
          <button
            onClick={() => setShowMobileCart(true)}
            className="flex items-center gap-2 bg-[#FAF8F5] border border-[#EBE3D8] rounded-[16px] px-5 py-3.5 font-black text-[14px] text-[#5C422E] active:scale-95 touch-manipulation relative"
            data-testid="button-open-mobile-cart"
          >
            <ShoppingCart className="w-5 h-5" />
            السلة
            {cartItemsCount > 0 && (
              <span className="absolute -top-2 -left-2 min-w-[24px] h-[24px] bg-[#1C1411] text-[#D4A373] rounded-full text-[12px] px-1 flex items-center justify-center font-black ring-2 ring-[#FFFFFF]">{cartItemsCount}</span>
            )}
          </button>
          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || createSaleMutation.isPending}
            className="flex-1 bg-gradient-to-r from-[#D4A373] to-[#B38250] disabled:from-[#EBE3D8] disabled:to-[#EBE3D8] disabled:text-[#A69587] text-[#1C1411] font-black text-[15px] py-3.5 rounded-[16px] flex items-center justify-center gap-2 active:scale-[0.97] touch-manipulation shadow-lg shadow-[#D4A373]/20"
            data-testid="button-mobile-checkout"
          >
            <Receipt className="w-5 h-5" />
            إتمام الطلب {cartTotal.total > 0 && <span className="bg-[#1C1411]/10 px-2.5 py-1 rounded-[10px] text-[14px]">{cartTotal.total.toFixed(2)} ر.س</span>}
          </button>
        </div>
      )}

      {/* Discount Dialog */}
      <Dialog open={showDiscount} onOpenChange={setShowDiscount}>
        <DialogContent className="max-w-[400px] rounded-[32px] p-0 overflow-hidden border border-[#EBE3D8] shadow-2xl" dir="rtl">
          <div className="bg-gradient-to-r from-[#D4A373] to-[#B38250] p-6">
            <DialogTitle className="flex items-center gap-3 text-[#1C1411] text-[20px] font-black">
              <div className="w-12 h-12 bg-[#1C1411]/10 backdrop-blur-md rounded-[16px] flex items-center justify-center shadow-inner">
                <Percent className="w-6 h-6 text-[#1C1411]" />
              </div>
              إضافة خصم
            </DialogTitle>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setDiscountType("percentage")}
                className={`py-3.5 rounded-[16px] text-[14px] font-black transition-all ${discountType === "percentage" ? "bg-[#1C1411] text-[#D4A373] shadow-lg shadow-[#1C1411]/20" : "bg-[#FFFFFF] text-[#8C6C50] border border-[#EBE3D8]"}`}
                data-testid="button-discount-percentage"
              >
                نسبة مئوية %
              </button>
              <button
                onClick={() => setDiscountType("fixed")}
                className={`py-3.5 rounded-[16px] text-[14px] font-black transition-all ${discountType === "fixed" ? "bg-[#1C1411] text-[#D4A373] shadow-lg shadow-[#1C1411]/20" : "bg-[#FFFFFF] text-[#8C6C50] border border-[#EBE3D8]"}`}
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
                      <button key={v} onClick={() => setDiscountValue(String(v))} className="flex-1 py-2.5 rounded-[12px] text-[13px] font-black bg-[#FFFFFF] border border-[#EBE3D8] text-[#8C6C50] hover:bg-[#F4EBE1] hover:text-[#5C422E] transition-all" data-testid={`button-discount-quick-${v}`}>{v}%</button>
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
        <DialogContent className="max-w-[440px] rounded-[32px] p-0 overflow-hidden border border-[#EBE3D8] shadow-2xl" dir="rtl">
          <div className="bg-gradient-to-l from-green-600 to-emerald-500 p-6">
            <DialogTitle className="flex items-center gap-3 text-[#1C1411] text-[20px] font-black">
              <div className="w-11 h-11 bg-white/20 rounded-2xl flex items-center justify-center">
                <Receipt className="w-6 h-6 text-white" />
              </div>
              إتمام البيع
            </DialogTitle>
          </div>
          <div className="p-6 space-y-5">
            <div className="bg-gradient-to-l from-orange-50 to-amber-50 rounded-2xl p-6 text-center border border-orange-100">
              <div className="text-sm text-gray-500 mb-2">الإجمالي المطلوب</div>
              <div className="text-[48px] font-black text-[#1C1411] tracking-tight leading-tight">{cartTotal.total.toFixed(2)} <span className="text-lg">ر.س</span></div>
              {cartTotal.discount > 0 && <div className="text-xs text-red-500 mt-1">شامل خصم {cartTotal.discount.toFixed(2)} ر.س</div>}
            </div>

            {/* Loyalty card code */}
            <div className="bg-yellow-50 rounded-2xl p-4 border border-yellow-200">
              <label className="text-sm font-bold text-yellow-700 mb-2 flex items-center gap-1">
                <Gift className="w-4 h-4" /> بطاقة الولاء (اختياري)
              </label>
              {loyaltyMember ? (
                <div className="flex items-center justify-between bg-white rounded-xl p-3 border border-yellow-200">
                  <div className="text-right">
                    <div className="text-sm font-bold text-gray-800" data-testid="text-loyalty-customer">{loyaltyMember.customerName}</div>
                    <div className="text-xs text-emerald-600">متبقٍ {loyaltyMember.remainingUses} — {loyaltyMember.code}</div>
                  </div>
                  <Button size="sm" variant="ghost" className="text-red-500" onClick={removeLoyalty} data-testid="button-remove-loyalty">إزالة</Button>
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <Input
                      value={loyaltyCode}
                      onChange={e => { setLoyaltyCode(e.target.value.toUpperCase()); setLoyaltyError(null); }}
                      onKeyDown={e => { if (e.key === "Enter") validateLoyaltyCode(); }}
                      placeholder="أدخل رمز البطاقة"
                      className="h-11 rounded-xl border-2 border-yellow-200 focus:border-yellow-400 text-center font-bold"
                      dir="ltr"
                      data-testid="input-loyalty-code"
                    />
                    <Button
                      onClick={validateLoyaltyCode}
                      disabled={loyaltyChecking || !loyaltyCode.trim()}
                      className="h-11 rounded-xl bg-yellow-500 hover:bg-yellow-600 text-white px-4 shrink-0"
                      data-testid="button-apply-loyalty"
                    >
                      {loyaltyChecking ? "..." : "تطبيق"}
                    </Button>
                  </div>
                  {loyaltyError && <div className="text-xs text-red-500 mt-1" data-testid="text-loyalty-error">{loyaltyError}</div>}
                </>
              )}
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
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-600 block">نوع البطاقة</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setCardType("mada")}
                      className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 touch-manipulation border-2 ${
                        cardType === "mada" ? "bg-green-50 border-green-500 text-green-700" : "bg-white border-gray-200 text-gray-600"
                      }`}
                      data-testid="button-split-card-mada"
                    >
                      <CreditCard className="w-4 h-4" /> مدى
                    </button>
                    <button
                      onClick={() => setCardType("visa_mastercard")}
                      className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 touch-manipulation border-2 ${
                        cardType === "visa_mastercard" ? "bg-blue-50 border-blue-500 text-blue-700" : "bg-white border-gray-200 text-gray-600"
                      }`}
                      data-testid="button-split-card-visa"
                    >
                      <CreditCard className="w-4 h-4" /> فيزا / ماستركارد
                    </button>
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
                      paymentMethod === "cash" ? "bg-[#86C275] text-[#1C1411] shadow-lg shadow-[#86C275]/20" : "bg-[#FFFFFF] text-[#8C6C50] border border-[#EBE3D8]"
                    }`}
                    data-testid="button-checkout-cash"
                  >
                    <Banknote className="w-6 h-6" /> نقد
                  </button>
                  <button
                    onClick={() => setPaymentMethod("network")}
                    className={`flex items-center justify-center gap-2 py-4 rounded-2xl text-base font-bold transition-all active:scale-95 touch-manipulation ${
                      paymentMethod === "network" ? "bg-[#86A8D2] text-[#1C1411] shadow-lg shadow-[#86A8D2]/20" : "bg-[#FFFFFF] text-[#8C6C50] border border-[#EBE3D8]"
                    }`}
                    data-testid="button-checkout-network"
                  >
                    <CreditCard className="w-6 h-6" /> شبكة
                  </button>
                </div>
                {paymentMethod === "network" && (
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-600 block">نوع البطاقة</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setCardType("mada")}
                        className={`flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold transition-all active:scale-95 touch-manipulation border-2 ${
                          cardType === "mada" ? "bg-green-50 border-green-500 text-green-700 shadow-md" : "bg-white border-gray-200 text-gray-600 hover:border-green-300"
                        }`}
                        data-testid="button-card-mada"
                      >
                        <CreditCard className="w-5 h-5" />
                        مدى
                      </button>
                      <button
                        onClick={() => setCardType("visa_mastercard")}
                        className={`flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold transition-all active:scale-95 touch-manipulation border-2 ${
                          cardType === "visa_mastercard" ? "bg-blue-50 border-blue-500 text-blue-700 shadow-md" : "bg-white border-gray-200 text-gray-600 hover:border-blue-300"
                        }`}
                        data-testid="button-card-visa"
                      >
                        <CreditCard className="w-5 h-5" />
                        فيزا / ماستركارد
                      </button>
                    </div>
                  </div>
                )}
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
                        <button key={v} onClick={() => setAmountPaid(String(v))} className="py-4 rounded-[16px] text-[16px] font-black bg-[#FFFFFF] border border-[#EBE3D8] text-[#5C422E] hover:bg-[#F4EBE1] hover:border-[#D4A373]/50 transition-all active:scale-95 touch-manipulation" data-testid={`button-quick-amount-${v}`}>{v}</button>
                      ))}
                      <button onClick={() => setAmountPaid(String(cartTotal.total))} className="py-4 rounded-[16px] text-[14px] font-black bg-[#EBE3D8] text-[#5C422E] hover:bg-[#D4A373] hover:text-[#1C1411] transition-all active:scale-95 touch-manipulation" data-testid="button-quick-amount-exact">مطابق</button>
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
                <Receipt className="w-6 h-6 text-[#D4A373]" />
              </div>
              الفاتورة الضريبية المبسطة
            </DialogTitle>
          </DialogHeader>
          {lastSale && (
            <div ref={receiptRef} className="receipt-print bg-white text-black" dir="rtl" style={{ fontFamily: "Cairo, sans-serif", width: "100%", maxWidth: "80mm", padding: "2mm 3mm", fontSize: "9px", lineHeight: 1.3, boxSizing: "border-box", overflow: "hidden", wordWrap: "break-word", direction: "rtl" }}>
              <div style={{ textAlign: "center", paddingBottom: "2px", overflow: "hidden" }}>
                {invoiceSettings?.logoUrl && (
                  <img src={invoiceSettings.logoUrl} alt="شعار" style={{ maxHeight: "35px", maxWidth: "40mm", margin: "0 auto 2px", display: "block", objectFit: "contain" }} data-testid="img-receipt-logo" />
                )}
                <div style={{ fontWeight: "bold", fontSize: "12px", marginBottom: "1px" }}>{invoiceSettings?.businessName || "باتر بيكري"}</div>
                {invoiceSettings?.businessNameEn && <div style={{ fontSize: "8px", color: "#555", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{invoiceSettings.businessNameEn}</div>}
                {invoiceSettings?.address && <div style={{ fontSize: "8px", color: "#555", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{invoiceSettings.address}</div>}
                {invoiceSettings?.city && <div style={{ fontSize: "8px", color: "#555", margin: 0 }}>{invoiceSettings.city}</div>}
                {invoiceSettings?.phone && <div style={{ fontSize: "8px", color: "#555", margin: 0 }}>هاتف: {invoiceSettings.phone}</div>}
                {invoiceSettings?.vatNumber && <div style={{ fontSize: "8px", fontWeight: "600", margin: 0 }}>الرقم الضريبي: {invoiceSettings.vatNumber}</div>}
                {invoiceSettings?.crNumber && <div style={{ fontSize: "8px", margin: 0 }}>السجل التجاري: {invoiceSettings.crNumber}</div>}
              </div>
              <hr className="receipt-separator" style={{ border: "none", borderTop: "1px dashed #000", margin: "3px 0" }} />
              <div style={{ textAlign: "center", padding: "2px 0" }}>
                <div style={{ fontWeight: "bold", fontSize: "11px" }}>فاتورة ضريبية مبسطة</div>
                {(() => {
                  const ev = (posEvents as any[]).find((e: any) => e.id === lastSale.eventId) || selectedEvent;
                  return ev ? <div style={{ fontSize: "9px", fontWeight: "600", color: "#333" }}>الإيفنت: {ev.name}{ev.location ? ` — ${ev.location}` : ""}</div> : null;
                })()}
                <div style={{ fontSize: "9px", color: "#333" }}>رقم الفاتورة: {lastSale.invoiceNumber}</div>
                <div style={{ fontSize: "9px", color: "#333" }}>{lastSale.saleDate} - {lastSale.saleTime}</div>
              </div>
              <hr className="receipt-separator" style={{ border: "none", borderTop: "1px dashed #000", margin: "3px 0" }} />
              <table dir="rtl" style={{ width: "100%", borderCollapse: "collapse", fontSize: "9px", tableLayout: "fixed", direction: "rtl" }}>
                <colgroup>
                  <col style={{ width: "40%" }} />
                  <col style={{ width: "15%" }} />
                  <col style={{ width: "22%" }} />
                  <col style={{ width: "23%" }} />
                </colgroup>
                <thead>
                  <tr style={{ borderBottom: "1px solid #000" }}>
                    <th style={{ textAlign: "right", padding: "2px 2px", fontWeight: "bold", fontSize: "9px" }}>الصنف</th>
                    <th style={{ textAlign: "center", padding: "2px 2px", fontWeight: "bold", fontSize: "9px" }}>الكمية</th>
                    <th style={{ textAlign: "center", padding: "2px 2px", fontWeight: "bold", fontSize: "9px" }}>السعر</th>
                    <th style={{ textAlign: "left", padding: "2px 2px", fontWeight: "bold", fontSize: "9px" }}>المبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  {lastSale.items?.map((item: any, i: number) => (
                    <tr key={i} style={{ borderBottom: "1px dotted #ccc" }}>
                      <td style={{ padding: "2px 2px", fontSize: "9px", wordBreak: "break-word", overflow: "hidden", textAlign: "right" }}>{item.productName}</td>
                      <td style={{ textAlign: "center", padding: "2px 2px", fontSize: "9px" }}>{item.quantity}</td>
                      <td style={{ textAlign: "center", padding: "2px 2px", fontSize: "9px" }}>{item.unitPrice?.toFixed(2)}</td>
                      <td style={{ textAlign: "left", padding: "2px 2px", fontSize: "9px" }}>{item.totalPrice?.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <hr className="receipt-separator" style={{ border: "none", borderTop: "1px dashed #000", margin: "3px 0" }} />
              <table dir="rtl" style={{ width: "100%", borderCollapse: "collapse", fontSize: "9px", tableLayout: "fixed", direction: "rtl" }}>
                <colgroup>
                  <col style={{ width: "60%" }} />
                  <col style={{ width: "40%" }} />
                </colgroup>
                <tbody>
                  <tr>
                    <td style={{ textAlign: "right", padding: "2px 2px", color: "#333" }}>المجموع بدون ضريبة</td>
                    <td style={{ textAlign: "left", padding: "2px 2px", color: "#333", whiteSpace: "nowrap" }}>{lastSale.subtotal?.toFixed(2)} ر.س</td>
                  </tr>
                  <tr>
                    <td style={{ textAlign: "right", padding: "2px 2px", color: "#333" }}>ضريبة القيمة المضافة 15%</td>
                    <td style={{ textAlign: "left", padding: "2px 2px", color: "#333", whiteSpace: "nowrap" }}>{lastSale.vatAmount?.toFixed(2)} ر.س</td>
                  </tr>
                  {(lastSale.discountAmount || 0) > 0 && (
                    <tr>
                      <td style={{ textAlign: "right", padding: "2px 2px", color: "#c00" }}>خصم {lastSale.discountType === "percentage" ? `${lastSale.discountValue}%` : "ثابت"}</td>
                      <td style={{ textAlign: "left", padding: "2px 2px", color: "#c00", whiteSpace: "nowrap" }}>-{lastSale.discountAmount?.toFixed(2)} ر.س</td>
                    </tr>
                  )}
                </tbody>
              </table>
              <hr className="receipt-separator" style={{ border: "none", borderTop: "1px dashed #000", margin: "3px 0" }} />
              <table dir="rtl" style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", direction: "rtl" }}>
                <colgroup>
                  <col style={{ width: "50%" }} />
                  <col style={{ width: "50%" }} />
                </colgroup>
                <tbody>
                  <tr>
                    <td style={{ textAlign: "right", padding: "3px 2px", fontWeight: "bold", fontSize: "12px" }}>الإجمالي</td>
                    <td style={{ textAlign: "left", padding: "3px 2px", fontWeight: "bold", fontSize: "12px", whiteSpace: "nowrap" }}>{lastSale.totalAmount?.toFixed(2)} ر.س</td>
                  </tr>
                </tbody>
              </table>
              <hr className="receipt-separator" style={{ border: "none", borderTop: "1px dashed #000", margin: "3px 0" }} />
              <table dir="rtl" style={{ width: "100%", borderCollapse: "collapse", fontSize: "9px", tableLayout: "fixed", direction: "rtl" }}>
                <colgroup>
                  <col style={{ width: "50%" }} />
                  <col style={{ width: "50%" }} />
                </colgroup>
                <tbody>
                  <tr>
                    <td style={{ textAlign: "right", padding: "2px 2px" }}>طريقة الدفع</td>
                    <td style={{ textAlign: "left", padding: "2px 2px", fontWeight: "600", whiteSpace: "nowrap" }}>{lastSale.paymentMethod === "cash" ? "نقد" : lastSale.paymentMethod === "network" ? "شبكة" : "نقد + شبكة"}</td>
                  </tr>
                  {lastSale.cardType && (lastSale.paymentMethod === "network" || lastSale.paymentMethod === "split") && (
                    <tr>
                      <td style={{ textAlign: "right", padding: "2px 2px" }}>نوع البطاقة</td>
                      <td style={{ textAlign: "left", padding: "2px 2px", fontWeight: "600", whiteSpace: "nowrap" }}>{lastSale.cardType === "mada" ? "مدى" : "فيزا / ماستركارد"}</td>
                    </tr>
                  )}
                  {lastSale.paymentMethod === "split" && (
                    <>
                      <tr>
                        <td style={{ textAlign: "right", padding: "2px 2px" }}>نقد</td>
                        <td style={{ textAlign: "left", padding: "2px 2px", whiteSpace: "nowrap" }}>{(lastSale.cashAmount || 0).toFixed(2)} ر.س</td>
                      </tr>
                      <tr>
                        <td style={{ textAlign: "right", padding: "2px 2px" }}>شبكة</td>
                        <td style={{ textAlign: "left", padding: "2px 2px", whiteSpace: "nowrap" }}>{(lastSale.networkAmount || 0).toFixed(2)} ر.س</td>
                      </tr>
                    </>
                  )}
                  {lastSale.paymentMethod === "cash" && (
                    <>
                      <tr>
                        <td style={{ textAlign: "right", padding: "2px 2px" }}>المبلغ المدفوع</td>
                        <td style={{ textAlign: "left", padding: "2px 2px", whiteSpace: "nowrap" }}>{lastSale.amountPaid?.toFixed(2)} ر.س</td>
                      </tr>
                      {lastSale.changeAmount > 0 && (
                        <tr>
                          <td style={{ textAlign: "right", padding: "2px 2px" }}>الباقي</td>
                          <td style={{ textAlign: "left", padding: "2px 2px", whiteSpace: "nowrap" }}>{lastSale.changeAmount?.toFixed(2)} ر.س</td>
                        </tr>
                      )}
                    </>
                  )}
                </tbody>
              </table>
              <div style={{ fontSize: "8px", color: "#555", textAlign: "center", padding: "2px 0" }}>
                الكاشير: {lastSale.cashierName}
              </div>
              <hr className="receipt-separator" style={{ border: "none", borderTop: "1px dashed #000", margin: "3px 0" }} />
              {invoiceSettings?.showQrCode !== false && invoiceSettings?.vatNumber && (
                <div style={{ textAlign: "center", padding: "2px 0" }}>
                  <QRCodeSVG
                    value={generateZatcaQrBase64(invoiceSettings?.businessName || "باتر بيكري", invoiceSettings?.vatNumber || "", new Date(`${lastSale.saleDate}T${lastSale.saleTime}`).toISOString(), lastSale.totalAmount?.toFixed(2) || "0.00", lastSale.vatAmount?.toFixed(2) || "0.00")}
                    size={65} level="L" style={{ margin: "0 auto", width: "20mm", height: "20mm" }} data-testid="img-zatca-qr"
                  />
                  <div style={{ fontSize: "7px", color: "#666", marginTop: "1px" }}>فاتورة ضريبية مبسطة - ZATCA</div>
                </div>
              )}
              <div style={{ textAlign: "center", padding: "2px 0" }}>
                <div style={{ fontSize: "9px", color: "#333" }}>{invoiceSettings?.footerText || "شكراً لزيارتكم"}</div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowReceipt(false)} className="rounded-xl h-12 text-[15px] font-bold">إغلاق</Button>
            <Button
              onClick={handleSmartPrint}
              disabled={btPrinting}
              className="gap-2 rounded-xl bg-orange-500 hover:bg-orange-600 h-12 text-[15px] font-bold active:scale-95 touch-manipulation"
              data-testid="button-print-receipt"
            >
              {btPrinting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Printer className="w-5 h-5" />}
              {getSavedPrinter() ? "طباعة مباشرة" : "طباعة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hold Order Dialog */}
      <Dialog open={showHoldDialog} onOpenChange={setShowHoldDialog}>
        <DialogContent className="max-w-[400px] rounded-[32px] p-0 overflow-hidden border border-[#EBE3D8] shadow-2xl" dir="rtl">
          <div className="bg-gradient-to-l from-amber-500 to-yellow-500 p-5">
            <DialogTitle className="flex items-center gap-3 text-[#1C1411] text-[20px] font-black">
              <div className="w-12 h-12 bg-[#1C1411]/10 backdrop-blur-md rounded-[16px] flex items-center justify-center shadow-inner">
                <Pause className="w-6 h-6 text-[#1C1411]" />
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
            <DialogTitle className="flex items-center gap-3 text-[#1C1411] text-[20px] font-black">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                <Pause className="w-6 h-6 text-[#1C1411]" />
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
                        {new Date(order.createdAt).toLocaleTimeString("ar-SA-u-nu-latn", { hour: "2-digit", minute: "2-digit" })}
                        <span className="mx-1">•</span>
                        {order.cashierName}
                      </div>
                    </div>
                    <span className="font-black text-[#1C1411] text-[18px]">{(order.totalAmount || 0).toFixed(2)} <span className="text-[11px] text-[#A69587] font-bold">ر.س</span></span>
                  </div>
                  <div className="text-[11px] text-gray-400 mb-3">{items.map(i => `${i.productName} ×${i.quantity}`).join(" • ")}</div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => recallHeldOrder(order)}
                      className="flex-1 rounded-[12px] h-10 bg-[#86C275] hover:bg-[#6A9A5C] text-[#1C1411] font-black text-[13px] gap-1.5 shadow-sm"
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
            <DialogTitle className="flex items-center gap-3 text-[#1C1411] text-[20px] font-black">
              <div className="w-12 h-12 bg-[#1C1411]/10 backdrop-blur-md rounded-[16px] flex items-center justify-center shadow-inner">
                {voidAction === "void" ? <Ban className="w-6 h-6 text-[#1C1411]" /> : <RotateCcw className="w-6 h-6 text-[#1C1411]" />}
              </div>
              {voidAction === "void" ? "إلغاء الفاتورة" : "استرجاع الفاتورة"}
            </DialogTitle>
          </div>
          <div className="p-5 space-y-4">
            <div className="bg-amber-50 dark:bg-amber-950/40 rounded-xl p-3 flex items-start gap-2 border border-amber-200 dark:border-amber-900">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-300 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-300">{voidAction === "void" ? "سيتم إلغاء هذه الفاتورة نهائياً ولن تحسب في المبيعات" : "سيتم تسجيل استرجاع لهذه الفاتورة"}</p>
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
            <DialogTitle className="flex items-center gap-3 text-[#1C1411] text-[20px] font-black">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                <CalendarDays className="w-6 h-6 text-[#1C1411]" />
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
            <button onClick={() => { const today = new Date().toISOString().slice(0,10); setHistoryDateFrom(today); setHistoryDateTo(today); }} className="text-[11px] font-bold text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 px-3 py-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-950/60 transition-colors" data-testid="button-today-filter">اليوم</button>
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
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${sale.status === "voided" ? "bg-rose-100 dark:bg-rose-950/40" : sale.status === "refunded" ? "bg-amber-100 dark:bg-amber-950/40" : "bg-muted"}`}>
                    {sale.status === "voided" ? <Ban className="w-5 h-5 text-rose-500 dark:text-rose-300" /> : sale.status === "refunded" ? <RotateCcw className="w-5 h-5 text-amber-500 dark:text-amber-300" /> : <Receipt className="w-5 h-5 text-muted-foreground" />}
                  </div>
                  <div>
                    <div className="font-bold text-[13px] text-foreground flex items-center gap-2">
                      {sale.invoiceNumber}
                      {sale.status === "voided" && <span className="text-[10px] bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 px-1.5 py-0.5 rounded-full font-bold">ملغاة</span>}
                      {sale.status === "refunded" && <span className="text-[10px] bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-300 px-1.5 py-0.5 rounded-full font-bold">مسترجعة</span>}
                      {sale.status === "partially_refunded" && <span className="text-[11px] bg-[#FAF8F5] text-[#D4A373] border border-[#EBE3D8] px-2 py-0.5 rounded-md font-black">استرجاع جزئي</span>}
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
                        title="استرجاع كامل"
                        data-testid={`button-refund-${sale.id}`}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => openPartialRefund(sale.id)}
                        className="w-10 h-10 rounded-[12px] flex items-center justify-center text-[#D4A373] hover:text-[#B38250] hover:bg-[#FAF8F5] border border-transparent hover:border-[#EBE3D8] transition-colors"
                        title="استرجاع جزئي"
                        data-testid={`button-partial-refund-${sale.id}`}
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  {sale.status === "partially_refunded" && canVoid && (
                    <button
                      onClick={() => openPartialRefund(sale.id)}
                      className="w-10 h-10 rounded-[12px] flex items-center justify-center text-[#D4A373] hover:text-[#B38250] hover:bg-[#FAF8F5] border border-transparent hover:border-[#EBE3D8] transition-colors"
                      title="استرجاع جزئي"
                      data-testid={`button-partial-refund-${sale.id}`}
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-10 w-10 p-0 rounded-[12px] hover:bg-[#FAF8F5] border border-transparent hover:border-[#EBE3D8] text-[#D4A373] hover:text-[#B38250] touch-manipulation"
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
                    sale.paymentMethod === "cash" ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300" : sale.paymentMethod === "network" ? "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300" : "bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300"
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
            <DialogTitle className="flex items-center gap-3 text-[#1C1411] text-[20px] font-black">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-[#1C1411]" />
              </div>
              تقرير إقفال الوردية (Z-Report)
            </DialogTitle>
            <p className="text-purple-200 text-xs mt-1">{new Date().toLocaleDateString("ar-SA-u-nu-latn", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
          </div>
          
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Printable Content */}
            <div ref={zReportRef} className="zreport-print bg-white" style={{ fontFamily: "Cairo, sans-serif" }}>
              <div style={{ textAlign: "center", marginBottom: "8px" }}>
                <div style={{ fontWeight: "bold", fontSize: "14px" }}>{invoiceSettings?.businessName || "باتر بيكري"}</div>
                <div style={{ fontSize: "12px", fontWeight: "bold", margin: "4px 0" }}>تقرير إقفال الوردية</div>
                <div style={{ fontSize: "10px", color: "#555" }}>{new Date().toLocaleDateString("ar-SA-u-nu-latn")} - {new Date().toLocaleTimeString("ar-SA-u-nu-latn", { hour: "2-digit", minute: "2-digit" })}</div>
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
                {zReportData.partialRefundsTotal > 0 && (
                  <>
                    <div className="receipt-row" style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                      <span>استرجاع جزئي (نقد)</span>
                      <span style={{ fontWeight: "bold" }}>-{zReportData.partialRefundsCash.toFixed(2)} ر.س</span>
                    </div>
                    <div className="receipt-row" style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                      <span>استرجاع جزئي (شبكة)</span>
                      <span style={{ fontWeight: "bold" }}>-{zReportData.partialRefundsNetwork.toFixed(2)} ر.س</span>
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

      {/* Open Shift Dialog */}
      <Dialog open={showShiftOpen} onOpenChange={setShowShiftOpen}>
        <DialogContent className="max-w-[400px] rounded-[32px] p-0 overflow-hidden border border-[#EBE3D8] shadow-2xl" dir="rtl">
          <div className="bg-gradient-to-l from-orange-600 to-amber-500 p-5">
            <DialogTitle className="flex items-center gap-3 text-[#1C1411] text-[20px] font-black">
              <div className="w-12 h-12 bg-[#1C1411]/10 backdrop-blur-md rounded-[16px] flex items-center justify-center shadow-inner">
                <DoorOpen className="w-6 h-6 text-[#1C1411]" />
              </div>
              فتح وردية جديدة
            </DialogTitle>
            {selectedEvent && <p className="text-[#4A3219] text-[13px] font-bold mt-2 flex items-center gap-1.5"><PartyPopper className="w-3 h-3" /> {selectedEvent.name}</p>}
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="text-sm font-bold text-gray-600 mb-2 block">النقد الافتتاحي في الصندوق (ر.س)</label>
              <Input
                type="number"
                inputMode="decimal"
                value={openingCash}
                onChange={e => setOpeningCash(e.target.value)}
                placeholder="0.00"
                className="text-2xl text-center font-black h-14 rounded-xl"
                autoFocus
                data-testid="input-opening-cash"
              />
              <div className="flex gap-2 mt-3">
                {[0, 100, 200, 500].map(v => (
                  <button key={v} onClick={() => setOpeningCash(String(v))} className="flex-1 py-3 rounded-[12px] text-[14px] font-black bg-[#FFFFFF] border border-[#EBE3D8] hover:bg-[#FAF8F5] text-[#5C422E] hover:text-[#2C201A] transition-all touch-manipulation" data-testid={`button-opening-quick-${v}`}>{v}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="px-5 pb-5 flex gap-2">
            <Button variant="outline" onClick={() => setShowShiftOpen(false)} className="rounded-xl h-12 font-bold">إلغاء</Button>
            <Button
              onClick={() => openShiftMutation.mutate()}
              disabled={openShiftMutation.isPending || selectedEventId == null}
              className="flex-1 rounded-xl h-12 bg-orange-500 hover:bg-orange-600 font-bold text-[15px]"
              data-testid="button-confirm-open-shift"
            >
              {openShiftMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <DoorOpen className="w-4 h-4 ml-1" />}
              فتح الوردية
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Close Shift Dialog */}
      <Dialog open={showShiftClose} onOpenChange={v => { setShowShiftClose(v); if (!v) setClosedShiftResult(null); }}>
        <DialogContent className="max-w-md rounded-3xl p-0 overflow-hidden max-h-[90vh] flex flex-col" dir="rtl">
          <div className="bg-gradient-to-l from-purple-700 to-purple-600 p-5 shrink-0">
            <DialogTitle className="flex items-center gap-3 text-[#1C1411] text-[20px] font-black">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                <LogOut className="w-6 h-6 text-[#1C1411]" />
              </div>
              {closedShiftResult ? "نتيجة إغلاق الوردية" : "إغلاق الوردية وتسوية الصندوق"}
            </DialogTitle>
            {selectedEvent && <p className="text-purple-200 text-xs mt-1">{selectedEvent.name}</p>}
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {closedShiftResult ? (
              <div className="space-y-3">
                <div className={`rounded-2xl p-5 text-center border-2 ${Math.abs(closedShiftResult.cashDiscrepancy || 0) < 0.01 ? "bg-green-50 border-green-200" : (closedShiftResult.cashDiscrepancy || 0) > 0 ? "bg-blue-50 border-blue-200" : "bg-red-50 border-red-200"}`}>
                  <div className="text-xs font-bold text-gray-500 mb-1">فرق النقد</div>
                  <div className={`text-3xl font-black ${Math.abs(closedShiftResult.cashDiscrepancy || 0) < 0.01 ? "text-green-600" : (closedShiftResult.cashDiscrepancy || 0) > 0 ? "text-blue-600" : "text-red-600"}`} data-testid="text-cash-discrepancy">
                    {(closedShiftResult.cashDiscrepancy || 0) > 0 ? "+" : ""}{(closedShiftResult.cashDiscrepancy || 0).toFixed(2)} ر.س
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {Math.abs(closedShiftResult.cashDiscrepancy || 0) < 0.01 ? "الصندوق مطابق تماماً" : (closedShiftResult.cashDiscrepancy || 0) > 0 ? "زيادة في الصندوق" : "عجز في الصندوق"}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="bg-gray-50 rounded-xl p-3">
                    <div className="text-[11px] text-gray-400 font-bold">النقد المتوقع</div>
                    <div className="text-base font-black text-gray-800">{(closedShiftResult.expectedCash || 0).toFixed(2)}</div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <div className="text-[11px] text-gray-400 font-bold">النقد الفعلي</div>
                    <div className="text-base font-black text-gray-800">{(closedShiftResult.actualCash || 0).toFixed(2)}</div>
                  </div>
                </div>
                <Button onClick={() => { setShowShiftClose(false); setClosedShiftResult(null); }} className="w-full rounded-xl h-12 font-bold bg-purple-600 hover:bg-purple-700" data-testid="button-close-shift-done">تم</Button>
              </div>
            ) : (
              <>
                {shiftStats ? (
                  <div className="bg-gray-50 rounded-2xl p-4 space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-gray-500">عدد الفواتير</span><span className="font-bold">{shiftStats.salesCount}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">إجمالي المبيعات</span><span className="font-bold">{(shiftStats.salesTotal || 0).toFixed(2)} ر.س</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">النقد الافتتاحي</span><span className="font-bold">{(shiftStats.shift?.openingCash || 0).toFixed(2)} ر.س</span></div>
                    <div className="flex justify-between border-t pt-2"><span className="text-gray-600 font-bold">النقد المتوقع في الصندوق</span><span className="font-black text-green-600" data-testid="text-expected-cash">{(shiftStats.expectedCash || 0).toFixed(2)} ر.س</span></div>
                    <div className="flex justify-between"><span className="text-gray-600 font-bold">الشبكة المتوقعة</span><span className="font-black text-blue-600">{(shiftStats.expectedNetwork || 0).toFixed(2)} ر.س</span></div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-[#A69587]" /></div>
                )}
                <div>
                  <label className="text-sm font-bold text-gray-600 mb-2 block">النقد الفعلي المعدود في الصندوق *</label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={actualCashInput}
                    onChange={e => setActualCashInput(e.target.value)}
                    placeholder="0.00"
                    className="text-2xl text-center font-black h-14 rounded-xl border-2 border-green-200 focus:border-green-400"
                    data-testid="input-actual-cash"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-gray-600 mb-2 block">إجمالي الشبكة الفعلي (من جهاز الشبكة)</label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={actualNetworkInput}
                    onChange={e => setActualNetworkInput(e.target.value)}
                    placeholder="0.00"
                    className="text-xl text-center font-black h-12 rounded-xl border-2 border-blue-200 focus:border-blue-400"
                    data-testid="input-actual-network"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-gray-600 mb-2 block">ملاحظات (اختياري)</label>
                  <Input value={shiftCloseNotes} onChange={e => setShiftCloseNotes(e.target.value)} className="rounded-xl h-11" data-testid="input-shift-close-notes" />
                </div>
              </>
            )}
          </div>
          {!closedShiftResult && (
            <div className="p-4 border-t flex gap-2 shrink-0">
              <Button variant="outline" onClick={() => setShowShiftClose(false)} className="rounded-xl h-12 font-bold">إلغاء</Button>
              <Button
                onClick={() => {
                  const v = parseFloat(actualCashInput);
                  if (!Number.isFinite(v) || v < 0) { toast({ title: "أدخل النقد الفعلي المعدود", variant: "destructive" }); return; }
                  closeShiftMutation.mutate();
                }}
                disabled={closeShiftMutation.isPending}
                className="flex-1 rounded-xl h-12 bg-purple-600 hover:bg-purple-700 font-bold text-[15px]"
                data-testid="button-confirm-close-shift"
              >
                {closeShiftMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <LogOut className="w-4 h-4 ml-1" />}
                إغلاق الوردية
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Partial Refund Dialog */}
      <Dialog open={showPartialRefund} onOpenChange={setShowPartialRefund}>
        <DialogContent className="max-w-md rounded-3xl p-0 overflow-hidden max-h-[90vh] flex flex-col" dir="rtl">
          <div className="bg-gradient-to-l from-orange-600 to-amber-500 p-5 shrink-0">
            <DialogTitle className="flex items-center gap-3 text-[#1C1411] text-[20px] font-black">
              <div className="w-12 h-12 bg-[#1C1411]/10 backdrop-blur-md rounded-[16px] flex items-center justify-center shadow-inner">
                <Undo2 className="w-6 h-6 text-[#1C1411]" />
              </div>
              استرجاع جزئي
            </DialogTitle>
            {refundSaleData?.sale && <p className="text-[#1C1411]/70 text-[13px] font-bold mt-2">فاتورة {refundSaleData.sale.invoiceNumber}</p>}
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {refundLoading || !refundSaleData ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[#A69587]" /></div>
            ) : (
              <>
                <div className="space-y-2">
                  {refundSaleData.items.map((item: any) => {
                    const remaining = item.quantity - (item.refundedQuantity || 0);
                    const qty = refundQtys[item.id] || 0;
                    return (
                      <div key={item.id} className={`rounded-xl border p-3 ${remaining <= 0 ? "opacity-40 bg-gray-50" : "bg-white"}`} data-testid={`refund-item-${item.id}`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="text-sm font-bold text-gray-800">{item.productName}</div>
                          <div className="text-xs text-gray-400">{item.unitPrice?.toFixed(2)} ر.س × {item.quantity}{(item.refundedQuantity || 0) > 0 ? ` (مسترجع ${item.refundedQuantity})` : ""}</div>
                        </div>
                        {remaining > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500">كمية الاسترجاع (متاح {remaining})</span>
                            <div className="flex items-center bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                              <button onClick={() => setRefundQtys(p => ({ ...p, [item.id]: Math.max(0, (p[item.id] || 0) - 1) }))} className="w-10 h-9 flex items-center justify-center hover:bg-gray-100 touch-manipulation" data-testid={`button-refund-dec-${item.id}`}><Minus className="w-4 h-4 text-[#8C6C50]" /></button>
                              <span className="w-10 text-center font-black text-gray-800" data-testid={`text-refund-qty-${item.id}`}>{qty}</span>
                              <button onClick={() => setRefundQtys(p => ({ ...p, [item.id]: Math.min(remaining, (p[item.id] || 0) + 1) }))} className="w-10 h-9 flex items-center justify-center hover:bg-orange-50 touch-manipulation" data-testid={`button-refund-inc-${item.id}`}><Plus className="w-4 h-4 text-[#8C6C50]" /></button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setRefundMethod("cash")} className={`flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-bold border-2 transition-all touch-manipulation ${refundMethod === "cash" ? "bg-green-50 border-green-500 text-green-700" : "bg-white border-gray-200 text-gray-600"}`} data-testid="button-refund-cash">
                    <Banknote className="w-4 h-4" /> استرجاع نقدي
                  </button>
                  <button onClick={() => setRefundMethod("network")} className={`flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-bold border-2 transition-all touch-manipulation ${refundMethod === "network" ? "bg-blue-50 border-blue-500 text-blue-700" : "bg-white border-gray-200 text-gray-600"}`} data-testid="button-refund-network">
                    <CreditCard className="w-4 h-4" /> على الشبكة
                  </button>
                </div>
                <div>
                  <label className="text-sm font-bold text-gray-600 mb-2 block">سبب الاسترجاع *</label>
                  <Input value={refundReason} onChange={e => setRefundReason(e.target.value)} placeholder="اكتب السبب..." className="rounded-xl h-11" data-testid="input-refund-reason" />
                </div>
                {refundSaleData.refunds?.length > 0 && (
                  <div className="bg-amber-50 rounded-xl p-3 border border-amber-200 text-xs text-amber-700">
                    <div className="font-bold mb-1">استرجاعات سابقة:</div>
                    {refundSaleData.refunds.map((r: any) => (
                      <div key={r.id} className="flex justify-between py-0.5">
                        <span>{r.createdAt ? new Date(r.createdAt).toLocaleString("ar-SA", { dateStyle: "short", timeStyle: "short" }) : ""}</span>
                        <span className="font-bold">{(r.totalAmount || 0).toFixed(2)} ر.س</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          {refundSaleData && (
            <div className="p-4 border-t flex gap-2 shrink-0">
              <Button variant="outline" onClick={() => setShowPartialRefund(false)} className="rounded-xl h-12 font-bold">إلغاء</Button>
              <Button
                onClick={() => {
                  const anyQty = Object.values(refundQtys).some(q => q > 0);
                  if (!anyQty) { toast({ title: "حدد كمية الاسترجاع لصنف واحد على الأقل", variant: "destructive" }); return; }
                  if (!refundReason.trim()) { toast({ title: "يجب كتابة سبب الاسترجاع", variant: "destructive" }); return; }
                  partialRefundMutation.mutate();
                }}
                disabled={partialRefundMutation.isPending}
                className="flex-1 rounded-xl h-12 bg-orange-500 hover:bg-orange-600 font-bold text-[15px]"
                data-testid="button-confirm-partial-refund"
              >
                {partialRefundMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Undo2 className="w-4 h-4 ml-1" />}
                تأكيد الاسترجاع
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
