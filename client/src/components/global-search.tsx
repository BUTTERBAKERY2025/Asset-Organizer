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
import { Search, Package, Building2, Users, ArrowLeftRight, Loader2, X } from "lucide-react";
import type { InventoryItem, ConstructionProject, Contractor, AssetTransfer, User } from "@shared/schema";

interface SearchResults {
  inventory: InventoryItem[];
  projects: ConstructionProject[];
  contractors: Contractor[];
  transfers: AssetTransfer[];
  users: User[];
}

export function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [, navigate] = useLocation();

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
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const { data: results, isLoading } = useQuery<SearchResults>({
    queryKey: ["/api/search", debouncedQuery],
    queryFn: async () => {
      if (debouncedQuery.length < 2) return { inventory: [], projects: [], contractors: [], transfers: [], users: [] };
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
    }
  };

  const totalResults = results
    ? results.inventory.length +
      results.projects.length +
      results.contractors.length +
      results.transfers.length +
      results.users.length
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
        <span className="hidden xl:inline-flex">البحث الشامل...</span>
        <kbd className="pointer-events-none absolute left-1.5 top-2 hidden h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 xl:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl p-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="sr-only">البحث الشامل</DialogTitle>
            <div className="flex items-center border rounded-lg px-3">
              <Search className="h-4 w-4 text-muted-foreground ml-2" />
              <Input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ابحث في الأصول، المشاريع، المقاولين..."
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

          <ScrollArea className="max-h-[400px] p-4 pt-2">
            {isLoading && debouncedQuery.length >= 2 ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : debouncedQuery.length < 2 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>اكتب حرفين على الأقل للبحث</p>
              </div>
            ) : totalResults === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>لا توجد نتائج للبحث "{debouncedQuery}"</p>
              </div>
            ) : (
              <div className="space-y-4">
                {results?.inventory && results.inventory.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                      <Package className="h-4 w-4" />
                      المخزون ({results.inventory.length})
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
                      <Building2 className="h-4 w-4" />
                      المشاريع ({results.projects.length})
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
                      <Users className="h-4 w-4" />
                      المقاولين ({results.contractors.length})
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
                      <ArrowLeftRight className="h-4 w-4" />
                      التحويلات ({results.transfers.length})
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
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
