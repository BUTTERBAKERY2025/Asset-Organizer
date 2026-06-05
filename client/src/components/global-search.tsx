import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Search, Package, Building2, Users, ArrowLeftRight, Loader2, X,
  UserCheck, ShoppingBag, Warehouse, MapPin, Megaphone,
  Receipt, Store, ClipboardList, Factory, UsersRound, Hammer, Briefcase, Settings, LayoutDashboard
} from "lucide-react";
import type { 
  InventoryItem, ConstructionProject, Contractor, AssetTransfer, User,
  BranchEmployee, Product, WarehouseItem, Branch, MarketingCampaign, SystemModule
} from "@shared/schema";
import { useTranslation } from "react-i18next";
import { usePermissions } from "@/hooks/usePermissions";

interface SearchResults {
  inventory: InventoryItem[];
  projects: ConstructionProject[];
  contractors: Contractor[];
  transfers: AssetTransfer[];
  users: User[];
  employees: BranchEmployee[];
  products: Product[];
  warehouseItems: WarehouseItem[];
  branches: Branch[];
  campaigns: MarketingCampaign[];
}

interface ModuleNav {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  module?: SystemModule;
  color: string;
}

export function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [, navigate] = useLocation();
  const { t } = useTranslation("platformHome");
  const { canView } = usePermissions();

  const modules: ModuleNav[] = [
    { title: t("modules.sales.title"),      icon: Receipt,       href: "/cashier-journals",      color: "text-emerald-500", module: "cashier_journal" },
    { title: t("eventPosTitle"),            icon: Store,         href: "/event-pos",             color: "text-emerald-500", module: "event_pos" as SystemModule },
    { title: t("modules.production.title"), icon: ClipboardList, href: "/production-dashboard",  color: "text-blue-500",    module: "production" },
    { title: t("modules.operations.title"), icon: Factory,       href: "/operations",            color: "text-blue-500",    module: "operations" },
    { title: t("modules.hr.title"),         icon: UsersRound,    href: "/attendance-dashboard",  color: "text-teal-500",    module: "branch_employees" },
    { title: t("modules.assets.title"),     icon: Package,       href: "/inventory",             color: "text-amber-500",   module: "inventory" },
    { title: t("modules.warehouse.title"),  icon: Warehouse,     href: "/warehouse-dashboard",   color: "text-amber-500",   module: "warehouse" },
    { title: t("modules.projects.title"),   icon: Hammer,        href: "/construction-projects", color: "text-orange-500",  module: "construction_projects" },
    { title: t("modules.marketing.title"),  icon: Megaphone,     href: "/marketing",             color: "text-pink-500",    module: "marketing" },
    { title: t("modules.executive.title"),  icon: Briefcase,     href: "/executive",             color: "text-violet-500",  module: "executive_dashboard" },
    { title: t("modules.settings.title"),   icon: Settings,      href: "/settings",              color: "text-slate-500",   module: "settings" },
  ];

  const accessibleModules = modules.filter((m) => !m.module || canView(m.module));
  const moduleMatches = debouncedQuery.length === 0
    ? accessibleModules
    : accessibleModules.filter((m) => m.title.toLowerCase().includes(debouncedQuery.toLowerCase()));

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
      }
    };
    const handleOpen = () => setIsOpen(true);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("open-global-search", handleOpen as EventListener);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("open-global-search", handleOpen as EventListener);
    };
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const emptyResults: SearchResults = { 
    inventory: [], projects: [], contractors: [], transfers: [], users: [],
    employees: [], products: [], warehouseItems: [], 
    branches: [], campaigns: []
  };

  const { data: results, isLoading } = useQuery<SearchResults>({
    queryKey: ["/api/search", debouncedQuery],
    queryFn: async () => {
      if (debouncedQuery.length < 2) return emptyResults;
      const res = await fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`);
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    enabled: debouncedQuery.length >= 2,
  });

  const handleSelect = (type: string, id: string | number) => {
    setIsOpen(false);
    setQuery("");
    switch (type) {
      case "inventory":
        navigate("/manage");
        break;
      case "projects":
        navigate(`/construction-projects/${id}`);
        break;
      case "contractors":
        navigate("/contractors");
        break;
      case "transfers":
        navigate("/asset-transfers");
        break;
      case "users":
        navigate("/users");
        break;
      case "employees":
        navigate("/branch-employees");
        break;
      case "products":
        navigate("/operations");
        break;
      case "warehouseItems":
        navigate("/warehouse-inventory");
        break;
      case "branches":
        navigate("/branches");
        break;
      case "campaigns":
        navigate("/marketing-campaigns");
        break;
    }
  };

  const totalResults = results
    ? (results.inventory?.length || 0) +
      (results.projects?.length || 0) +
      (results.contractors?.length || 0) +
      (results.transfers?.length || 0) +
      (results.users?.length || 0) +
      (results.employees?.length || 0) +
      (results.products?.length || 0) +
      (results.warehouseItems?.length || 0) +
      (results.branches?.length || 0) +
      (results.campaigns?.length || 0)
    : 0;

  return (
    <>
      <Button
        variant="outline"
        className="relative h-9 w-9 p-0 xl:h-10 xl:w-60 xl:justify-start xl:px-3 xl:py-2"
        onClick={() => setIsOpen(true)}
        data-testid="button-global-search"
      >
        <Search className="h-4 w-4 xl:ml-2" />
        <span className="hidden xl:inline-flex">{t("palette.searchTrigger")}</span>
        <kbd className="pointer-events-none absolute left-1.5 top-2 hidden h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 xl:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl p-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="sr-only">{t("palette.searchTitle")}</DialogTitle>
            <div className="flex items-center border rounded-lg px-3">
              <Search className="h-4 w-4 text-muted-foreground ml-2" />
              <Input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("palette.searchPlaceholder")}
                className="border-0 focus-visible:ring-0 h-12"
                data-testid="input-global-search"
              />
              {query && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setQuery("")}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </DialogHeader>

          <ScrollArea className="max-h-[500px] p-4 pt-2">
            <div className="space-y-3">
              {moduleMatches.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                    <LayoutDashboard className="h-4 w-4 text-primary" />
                    {t("palette.modulesSection")} ({moduleMatches.length})
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                    {moduleMatches.slice(0, 12).map((m) => {
                      const Icon = m.icon;
                      return (
                        <button
                          key={m.href}
                          onClick={() => { setIsOpen(false); setQuery(""); navigate(m.href); }}
                          className="text-right p-2 rounded hover:bg-accent flex items-center gap-2"
                          data-testid={`palette-module-${m.href.replace(/\//g, "")}`}
                        >
                          <Icon className={`h-4 w-4 ${m.color}`} />
                          <span className="font-medium text-sm">{m.title}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            {isLoading && debouncedQuery.length >= 2 ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : debouncedQuery.length < 2 ? (
              moduleMatches.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{t("palette.startTyping")}</p>
                  <p className="text-xs mt-2">{t("palette.searchHint")}</p>
                </div>
              ) : null
            ) : totalResults === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>{t("palette.noResults", { query: debouncedQuery })}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {results?.employees && results.employees.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                      <UserCheck className="h-4 w-4 text-blue-500" />
                      {t("palette.categories.employees")} ({results.employees.length})
                    </div>
                    {results.employees.map((emp) => (
                      <button
                        key={emp.id}
                        onClick={() => handleSelect("employees", emp.id)}
                        className="w-full text-right p-2 rounded hover:bg-accent flex items-center justify-between"
                        data-testid={`search-result-employee-${emp.id}`}
                      >
                        <span className="font-medium">{emp.employeeName}</span>
                        <Badge variant="outline">{emp.jobTitle || emp.employeeNumber}</Badge>
                      </button>
                    ))}
                  </div>
                )}

                {results?.products && results.products.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                      <ShoppingBag className="h-4 w-4 text-amber-500" />
                      {t("palette.categories.products")} ({results.products.length})
                    </div>
                    {results.products.map((prod) => (
                      <button
                        key={prod.id}
                        onClick={() => handleSelect("products", prod.id)}
                        className="w-full text-right p-2 rounded hover:bg-accent flex items-center justify-between"
                        data-testid={`search-result-product-${prod.id}`}
                      >
                        <span className="font-medium">{prod.name}</span>
                        <Badge variant="outline">{prod.category}</Badge>
                      </button>
                    ))}
                  </div>
                )}

                {results?.branches && results.branches.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                      <MapPin className="h-4 w-4 text-green-500" />
                      {t("palette.categories.branches")} ({results.branches.length})
                    </div>
                    {results.branches.map((branch) => (
                      <button
                        key={branch.id}
                        onClick={() => handleSelect("branches", branch.id)}
                        className="w-full text-right p-2 rounded hover:bg-accent flex items-center justify-between"
                        data-testid={`search-result-branch-${branch.id}`}
                      >
                        <span className="font-medium">{branch.name}</span>
                        <Badge variant="outline">{branch.id}</Badge>
                      </button>
                    ))}
                  </div>
                )}

                {results?.warehouseItems && results.warehouseItems.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                      <Warehouse className="h-4 w-4 text-teal-500" />
                      {t("palette.categories.warehouseItems")} ({results.warehouseItems.length})
                    </div>
                    {results.warehouseItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleSelect("warehouseItems", item.id)}
                        className="w-full text-right p-2 rounded hover:bg-accent flex items-center justify-between"
                        data-testid={`search-result-warehouse-${item.id}`}
                      >
                        <span className="font-medium">{item.name}</span>
                        <Badge variant="outline">{item.category}</Badge>
                      </button>
                    ))}
                  </div>
                )}


                {results?.campaigns && results.campaigns.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                      <Megaphone className="h-4 w-4 text-pink-500" />
                      {t("palette.categories.campaigns")} ({results.campaigns.length})
                    </div>
                    {results.campaigns.map((camp) => (
                      <button
                        key={camp.id}
                        onClick={() => handleSelect("campaigns", camp.id)}
                        className="w-full text-right p-2 rounded hover:bg-accent flex items-center justify-between"
                        data-testid={`search-result-campaign-${camp.id}`}
                      >
                        <span className="font-medium">{camp.name}</span>
                        <Badge variant="outline">{camp.status}</Badge>
                      </button>
                    ))}
                  </div>
                )}

                {results?.inventory && results.inventory.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                      <Package className="h-4 w-4 text-orange-500" />
                      {t("palette.categories.inventory")} ({results.inventory.length})
                    </div>
                    {results.inventory.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleSelect("inventory", item.id)}
                        className="w-full text-right p-2 rounded hover:bg-accent flex items-center justify-between"
                        data-testid={`search-result-inventory-${item.id}`}
                      >
                        <span className="font-medium">{item.name}</span>
                        <Badge variant="outline">{item.category}</Badge>
                      </button>
                    ))}
                  </div>
                )}

                {results?.projects && results.projects.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                      <Building2 className="h-4 w-4 text-purple-500" />
                      {t("palette.categories.projects")} ({results.projects.length})
                    </div>
                    {results.projects.map((project) => (
                      <button
                        key={project.id}
                        onClick={() => handleSelect("projects", project.id)}
                        className="w-full text-right p-2 rounded hover:bg-accent flex items-center justify-between"
                        data-testid={`search-result-project-${project.id}`}
                      >
                        <span className="font-medium">{project.title}</span>
                        <Badge variant="outline">{project.status}</Badge>
                      </button>
                    ))}
                  </div>
                )}

                {results?.contractors && results.contractors.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                      <Users className="h-4 w-4 text-cyan-500" />
                      {t("palette.categories.contractors")} ({results.contractors.length})
                    </div>
                    {results.contractors.map((contractor) => (
                      <button
                        key={contractor.id}
                        onClick={() => handleSelect("contractors", contractor.id)}
                        className="w-full text-right p-2 rounded hover:bg-accent flex items-center justify-between"
                        data-testid={`search-result-contractor-${contractor.id}`}
                      >
                        <span className="font-medium">{contractor.name}</span>
                        <Badge variant="outline">{contractor.specialization}</Badge>
                      </button>
                    ))}
                  </div>
                )}

                {results?.transfers && results.transfers.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                      <ArrowLeftRight className="h-4 w-4 text-red-500" />
                      {t("palette.categories.transfers")} ({results.transfers.length})
                    </div>
                    {results.transfers.map((transfer) => (
                      <button
                        key={transfer.id}
                        onClick={() => handleSelect("transfers", transfer.id)}
                        className="w-full text-right p-2 rounded hover:bg-accent flex items-center justify-between"
                        data-testid={`search-result-transfer-${transfer.id}`}
                      >
                        <span className="font-medium">{transfer.transferNumber}</span>
                        <Badge variant="outline">{transfer.status}</Badge>
                      </button>
                    ))}
                  </div>
                )}

                {results?.users && results.users.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                      <Users className="h-4 w-4 text-gray-500" />
                      {t("palette.categories.users")} ({results.users.length})
                    </div>
                    {results.users.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => handleSelect("users", user.id)}
                        className="w-full text-right p-2 rounded hover:bg-accent flex items-center justify-between"
                        data-testid={`search-result-user-${user.id}`}
                      >
                        <span className="font-medium">{user.firstName} {user.lastName}</span>
                        <Badge variant="outline">{user.role}</Badge>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
