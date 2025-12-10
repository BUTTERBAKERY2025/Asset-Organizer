import { useState } from "react";
import { Layout } from "@/components/layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search, Loader2, HardHat, Phone, Mail, Star } from "lucide-react";
import type { Contractor } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";

const contractorFormSchema = z.object({
  name: z.string().min(1, "اسم المقاول مطلوب"),
  phone: z.string().optional().nullable(),
  email: z.string().email("البريد الإلكتروني غير صالح").optional().nullable().or(z.literal("")),
  specialization: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  rating: z.coerce.number().min(1).max(5).optional().nullable(),
});

type ContractorFormData = z.infer<typeof contractorFormSchema>;

export default function ContractorsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedContractor, setSelectedContractor] = useState<Contractor | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin, isEmployee } = useAuth();
  const canEdit = isAdmin || isEmployee;

  const { data: contractors = [], isLoading } = useQuery<Contractor[]>({
    queryKey: ["/api/construction/contractors"],
    queryFn: async () => {
      const res = await fetch("/api/construction/contractors");
      if (!res.ok) throw new Error("Failed to fetch contractors");
      return res.json();
    },
  });

  const form = useForm<ContractorFormData>({
    resolver: zodResolver(contractorFormSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      specialization: "",
      notes: "",
      rating: null,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ContractorFormData) => {
      const cleanData = {
        ...data,
        email: data.email || null,
      };
      const res = await fetch("/api/construction/contractors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanData),
      });
      if (!res.ok) throw new Error("Failed to create contractor");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/construction/contractors"] });
      setIsAddDialogOpen(false);
      form.reset();
      toast({ title: "تم إضافة المقاول بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ", description: "فشل في إضافة المقاول", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: ContractorFormData & { id: number }) => {
      const { id, ...contractorData } = data;
      const cleanData = {
        ...contractorData,
        email: contractorData.email || null,
      };
      const res = await fetch(`/api/construction/contractors/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanData),
      });
      if (!res.ok) throw new Error("Failed to update contractor");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/construction/contractors"] });
      setIsEditDialogOpen(false);
      setSelectedContractor(null);
      toast({ title: "تم تحديث المقاول بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ", description: "فشل في تحديث المقاول", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/construction/contractors/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete contractor");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/construction/contractors"] });
      setIsDeleteDialogOpen(false);
      setSelectedContractor(null);
      toast({ title: "تم حذف المقاول بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ", description: "فشل في حذف المقاول", variant: "destructive" });
    },
  });

  const filteredContractors = contractors.filter((contractor) =>
    contractor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contractor.specialization?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openEditDialog = (contractor: Contractor) => {
    setSelectedContractor(contractor);
    form.reset({
      name: contractor.name,
      phone: contractor.phone || "",
      email: contractor.email || "",
      specialization: contractor.specialization || "",
      notes: contractor.notes || "",
      rating: contractor.rating,
    });
    setIsEditDialogOpen(true);
  };

  const onSubmit = (data: ContractorFormData) => {
    if (selectedContractor) {
      updateMutation.mutate({ ...data, id: selectedContractor.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const renderRating = (rating: number | null) => {
    if (!rating) return "-";
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${star <= rating ? "text-yellow-500 fill-yellow-500" : "text-gray-300"}`}
          />
        ))}
      </div>
    );
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">المقاولون</h1>
            <p className="text-muted-foreground">إدارة بيانات المقاولين والموردين</p>
          </div>
          {canEdit && (
            <Button onClick={() => { form.reset(); setIsAddDialogOpen(true); }} data-testid="button-add-contractor">
              <Plus className="w-4 h-4 ml-2" />
              إضافة مقاول
            </Button>
          )}
        </div>

        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="البحث في المقاولين..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10"
              data-testid="input-search-contractors"
            />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>قائمة المقاولين</CardTitle>
            <CardDescription>جميع المقاولين المسجلين في النظام</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredContractors.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <HardHat className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">لا يوجد مقاولون</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الاسم</TableHead>
                    <TableHead>التخصص</TableHead>
                    <TableHead>الهاتف</TableHead>
                    <TableHead>البريد الإلكتروني</TableHead>
                    <TableHead>التقييم</TableHead>
                    {canEdit && <TableHead>إجراءات</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContractors.map((contractor) => (
                    <TableRow key={contractor.id} data-testid={`row-contractor-${contractor.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <HardHat className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{contractor.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{contractor.specialization || "-"}</TableCell>
                      <TableCell>
                        {contractor.phone ? (
                          <div className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-muted-foreground" />
                            <span dir="ltr">{contractor.phone}</span>
                          </div>
                        ) : "-"}
                      </TableCell>
                      <TableCell>
                        {contractor.email ? (
                          <div className="flex items-center gap-1">
                            <Mail className="w-3 h-3 text-muted-foreground" />
                            <span>{contractor.email}</span>
                          </div>
                        ) : "-"}
                      </TableCell>
                      <TableCell>{renderRating(contractor.rating)}</TableCell>
                      {canEdit && (
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openEditDialog(contractor)} data-testid={`button-edit-contractor-${contractor.id}`}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            {isAdmin && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => { setSelectedContractor(contractor); setIsDeleteDialogOpen(true); }}
                                data-testid={`button-delete-contractor-${contractor.id}`}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={isAddDialogOpen || isEditDialogOpen} onOpenChange={(open) => {
          if (!open) {
            setIsAddDialogOpen(false);
            setIsEditDialogOpen(false);
            setSelectedContractor(null);
            form.reset();
          }
        }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{selectedContractor ? "تعديل المقاول" : "إضافة مقاول جديد"}</DialogTitle>
              <DialogDescription>
                {selectedContractor ? "قم بتعديل بيانات المقاول" : "أدخل بيانات المقاول الجديد"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label>اسم المقاول</Label>
                <Input {...form.register("name")} placeholder="مثال: شركة الإنشاءات المتحدة" data-testid="input-contractor-name" />
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>التخصص</Label>
                <Input {...form.register("specialization")} placeholder="مثال: أعمال كهربائية" data-testid="input-contractor-specialization" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>رقم الهاتف</Label>
                  <Input {...form.register("phone")} placeholder="05xxxxxxxx" dir="ltr" data-testid="input-contractor-phone" />
                </div>
                <div className="space-y-2">
                  <Label>البريد الإلكتروني</Label>
                  <Input type="email" {...form.register("email")} placeholder="email@example.com" dir="ltr" data-testid="input-contractor-email" />
                  {form.formState.errors.email && (
                    <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>التقييم (1-5)</Label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => form.setValue("rating", star)}
                      className="focus:outline-none"
                      data-testid={`button-rating-${star}`}
                    >
                      <Star
                        className={`w-6 h-6 cursor-pointer transition-colors ${
                          star <= (form.watch("rating") || 0) ? "text-yellow-500 fill-yellow-500" : "text-gray-300 hover:text-yellow-400"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>ملاحظات</Label>
                <Textarea {...form.register("notes")} placeholder="ملاحظات إضافية عن المقاول..." data-testid="input-contractor-notes" />
              </div>

              <DialogFooter>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-contractor">
                  {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                  {selectedContractor ? "حفظ التغييرات" : "إضافة المقاول"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>حذف المقاول</AlertDialogTitle>
              <AlertDialogDescription>
                هل أنت متأكد من حذف المقاول "{selectedContractor?.name}"؟
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => selectedContractor && deleteMutation.mutate(selectedContractor.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="button-confirm-delete-contractor"
              >
                {deleteMutation.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                حذف
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
