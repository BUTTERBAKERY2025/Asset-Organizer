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
import * as XLSX from "xlsx";

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

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    // Flatten data for export
    const exportData = currentBranch.inventory.map(item => ({
      "الفئة": item.category,
      "اسم الصنف": item.name,
      "الكمية": item.quantity,
      "الوحدة": item.unit,
      "ملاحظات": item.notes || ""
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    
    // Set column widths
    const wscols = [
      {wch: 20}, // Category
      {wch: 40}, // Name
      {wch: 10}, // Quantity
      {wch: 10}, // Unit
      {wch: 30}, // Notes
    ];
    ws['!cols'] = wscols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    
    // Generate filename with date
    const date = new Date().toISOString().split('T')[0];
    const fileName = `inventory_${currentBranch.id}_${date}.xlsx`;
    
    XLSX.writeFile(wb, fileName);
  };

  const InventoryList = () => (
    <>
      {currentBranch.inventory.length === 0 ? (
        <div className="text-center py-20 bg-muted/20 rounded-lg border border-dashed border-muted-foreground/20">
          <p className="text-muted-foreground text-lg">لا توجد بيانات متاحة لهذا الفرع حالياً</p>
        </div>
      ) : (
        filteredCategories.map((category) => (
          <Card key={category} className="overflow-hidden border-none shadow-sm ring-1 ring-border/50 break-inside-avoid mb-6">
            <CardHeader className="bg-primary/5 border-b border-primary/10 pb-4 print:bg-transparent print:border-b-2 print:border-black">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl text-primary font-bold print:text-black">{category}</CardTitle>
                <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm print:hidden">
                  {groupedInventory[category].length} عنصر
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/30 print:bg-transparent">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-right w-[80px] print:text-black font-bold">#</TableHead>
                    <TableHead className="text-right print:text-black font-bold">البيان / اسم الأصل</TableHead>
                    <TableHead className="text-right w-[150px] print:text-black font-bold">الكمية</TableHead>
                    <TableHead className="text-right w-[150px] print:text-black font-bold">الوحدة</TableHead>
                    <TableHead className="text-right print:text-black font-bold">ملاحظات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedInventory[category]
                    .filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()) || category.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((item, index) => (
                    <TableRow key={item.id} className="hover:bg-muted/20 transition-colors print:border-black">
                      <TableCell className="font-medium text-muted-foreground print:text-black">{index + 1}</TableCell>
                      <TableCell className="font-semibold text-foreground/90 print:text-black">{item.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-bold min-w-[3rem] justify-center print:border-black print:text-black">
                          {item.quantity}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground print:text-black">{item.unit}</TableCell>
                      <TableCell className="text-muted-foreground italic text-sm print:text-black">{item.notes || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      )}
    </>
  );

  return (
    <Layout>
      <div className="flex flex-col space-y-6 print:space-y-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">جرد الأصول والمعدات</h1>
            <p className="text-muted-foreground mt-1">إدارة ومتابعة أصول الفروع وتجهيزاتها</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2" onClick={handlePrint}>
              <Printer className="w-4 h-4" />
              <span>طباعة</span>
            </Button>
            <Button className="gap-2" onClick={handleExport}>
              <Download className="w-4 h-4" />
              <span>تصدير Excel</span>
            </Button>
          </div>
        </div>

        {/* Print Header */}
        <div className="hidden print:flex flex-col items-center mb-8 border-b-2 border-black pb-4">
          <h1 className="text-3xl font-bold mb-2">Butter Bakery</h1>
          <h2 className="text-xl">جرد الأصول والمعدات - {currentBranch.name}</h2>
          <p className="text-sm mt-2">تاريخ التقرير: {new Date().toLocaleDateString('ar-SA')}</p>
        </div>

        <Tabs defaultValue="medina" className="w-full" onValueChange={setActiveBranch} value={activeBranch}>
          <TabsList className="w-full md:w-auto grid grid-cols-2 md:inline-flex h-auto p-1 bg-muted/50 print:hidden">
            <TabsTrigger value="medina" className="py-2.5 px-6 text-base">فرع المدينة المنورة</TabsTrigger>
            <TabsTrigger value="tabuk" className="py-2.5 px-6 text-base">فرع تبوك</TabsTrigger>
          </TabsList>

          <div className="mt-6 flex items-center gap-4 bg-card p-4 rounded-lg border border-border shadow-sm print:hidden">
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

          <TabsContent value="medina" className="mt-6 space-y-8 print:mt-0 print:space-y-4">
            <InventoryList />
          </TabsContent>

          <TabsContent value="tabuk" className="mt-6 space-y-8 print:mt-0 print:space-y-4">
            <InventoryList />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
