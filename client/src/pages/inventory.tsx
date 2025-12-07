import { useState } from "react";
import { Layout } from "@/components/layout";
import { INVENTORY_DATA, type InventoryItem } from "@/lib/data";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Download, Printer, Filter, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function InventoryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeBranch, setActiveBranch] = useState("medina");

  // Get current branch data
  const currentBranch = INVENTORY_DATA.find(b => b.id === activeBranch) || INVENTORY_DATA[0];
  
  // Group items by category
  const groupedInventory = currentBranch.inventory.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, InventoryItem[]>);

  // Filter logic
  const filteredCategories = Object.keys(groupedInventory).filter(category => {
    const items = groupedInventory[category];
    const hasMatchingItems = items.some(item => 
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return hasMatchingItems || category.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <Layout>
      <div className="flex flex-col space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">جرد الأصول والمعدات</h1>
            <p className="text-muted-foreground mt-1">إدارة ومتابعة أصول الفروع وتجهيزاتها</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2">
              <Printer className="w-4 h-4" />
              <span>طباعة</span>
            </Button>
            <Button className="gap-2">
              <Download className="w-4 h-4" />
              <span>تصدير Excel</span>
            </Button>
          </div>
        </div>

        <Tabs defaultValue="medina" className="w-full" onValueChange={setActiveBranch}>
          <TabsList className="w-full md:w-auto grid grid-cols-2 md:inline-flex h-auto p-1 bg-muted/50">
            <TabsTrigger value="medina" className="py-2.5 px-6 text-base">فرع المدينة المنورة</TabsTrigger>
            <TabsTrigger value="tabuk" className="py-2.5 px-6 text-base">فرع تبوك</TabsTrigger>
          </TabsList>

          <div className="mt-6 flex items-center gap-4 bg-card p-4 rounded-lg border border-border shadow-sm">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="بحث عن أصل أو معدة..." 
                className="pr-10 bg-background/50 border-muted"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button variant="ghost" size="icon">
              <Filter className="w-4 h-4 text-muted-foreground" />
            </Button>
          </div>

          <TabsContent value="medina" className="mt-6 space-y-8">
            {currentBranch.inventory.length === 0 ? (
              <div className="text-center py-20 bg-muted/20 rounded-lg border border-dashed border-muted-foreground/20">
                <p className="text-muted-foreground text-lg">لا توجد بيانات متاحة لهذا الفرع حالياً</p>
              </div>
            ) : (
              filteredCategories.map((category) => (
                <Card key={category} className="overflow-hidden border-none shadow-sm ring-1 ring-border/50">
                  <CardHeader className="bg-primary/5 border-b border-primary/10 pb-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xl text-primary font-bold">{category}</CardTitle>
                      <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
                        {groupedInventory[category].length} عنصر
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-right w-[80px]">#</TableHead>
                          <TableHead className="text-right">البيان / اسم الأصل</TableHead>
                          <TableHead className="text-right w-[150px]">الكمية</TableHead>
                          <TableHead className="text-right w-[150px]">الوحدة</TableHead>
                          <TableHead className="text-right">ملاحظات</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {groupedInventory[category]
                          .filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()) || category.toLowerCase().includes(searchQuery.toLowerCase()))
                          .map((item, index) => (
                          <TableRow key={item.id} className="hover:bg-muted/20 transition-colors">
                            <TableCell className="font-medium text-muted-foreground">{index + 1}</TableCell>
                            <TableCell className="font-semibold text-foreground/90">{item.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-bold min-w-[3rem] justify-center">
                                {item.quantity}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{item.unit}</TableCell>
                            <TableCell className="text-muted-foreground italic text-sm">{item.notes || "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="tabuk" className="mt-6">
             <div className="flex flex-col items-center justify-center py-24 bg-card rounded-lg border border-dashed border-muted">
                <div className="bg-muted/50 p-6 rounded-full mb-6">
                  <FileText className="w-12 h-12 text-muted-foreground/50" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">بيانات فرع تبوك غير متوفرة</h3>
                <p className="text-muted-foreground max-w-md text-center mb-8">
                  لم نتمكن من قراءة ملف بيانات فرع تبوك. يرجى تزويدنا بالبيانات بتنسيق نصي لإضافتها للنظام.
                </p>
                <Button>
                  رفع ملف البيانات
                </Button>
             </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
