import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient as qc } from "@/lib/queryClient";
import { Calendar, Users, Plus, Edit, Trash2, Mail, Phone, MapPin, Video, Loader2 } from "lucide-react";
import type { IrEvent, IrContact } from "@shared/schema";

const EVENT_TYPES: Record<string, string> = {
  earnings_call: "مكالمة نتائج", agm: "جمعية عمومية", egm: "جمعية غير عادية",
  roadshow: "جولة تعريفية", investor_day: "يوم المستثمر", conference: "مؤتمر", dividend_payment: "صرف توزيعات",
};
const EVENT_STATUS: Record<string, { label: string; color: string }> = {
  scheduled: { label: "مجدول", color: "bg-blue-100 text-blue-800" },
  completed: { label: "منتهي", color: "bg-green-100 text-green-800" },
  cancelled: { label: "ملغى", color: "bg-red-100 text-red-800" },
  postponed: { label: "مؤجل", color: "bg-amber-100 text-amber-800" },
};
const INSTITUTION_TYPES: Record<string, string> = {
  analyst: "محلل", fund: "صندوق", bank: "بنك", individual: "فرد", media: "إعلام", regulator: "جهة تنظيمية",
};

export default function InvestorRelationsPage() {
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState("events");
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<IrEvent | null>(null);
  const [showContactForm, setShowContactForm] = useState(false);
  const [editingContact, setEditingContact] = useState<IrContact | null>(null);
  const [deleteEventId, setDeleteEventId] = useState<number | null>(null);
  const [deleteContactId, setDeleteContactId] = useState<number | null>(null);

  const { data: events = [] } = useQuery<IrEvent[]>({ queryKey: ["/api/governance/ir-events"] });
  const { data: contacts = [] } = useQuery<IrContact[]>({ queryKey: ["/api/governance/ir-contacts"] });

  const eventMutation = useMutation({
    mutationFn: async ({ id, data }: { id?: number; data: any }) => {
      const method = id ? "PATCH" : "POST";
      const url = id ? `/api/governance/ir-events/${id}` : "/api/governance/ir-events";
      return (await apiRequest(method, url, data)).json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/governance/ir-events"] }); setShowEventForm(false); setEditingEvent(null); toast({ title: "تم الحفظ" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message, variant: "destructive" }),
  });
  const contactMutation = useMutation({
    mutationFn: async ({ id, data }: { id?: number; data: any }) => {
      const method = id ? "PATCH" : "POST";
      const url = id ? `/api/governance/ir-contacts/${id}` : "/api/governance/ir-contacts";
      return (await apiRequest(method, url, data)).json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/governance/ir-contacts"] }); setShowContactForm(false); setEditingContact(null); toast({ title: "تم الحفظ" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message, variant: "destructive" }),
  });
  const deleteEvent = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/governance/ir-events/${id}`, undefined)).json(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/governance/ir-events"] }); setDeleteEventId(null); toast({ title: "تم الحذف" }); },
  });
  const deleteContact = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/governance/ir-contacts/${id}`, undefined)).json(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/governance/ir-contacts"] }); setDeleteContactId(null); toast({ title: "تم الحذف" }); },
  });

  const handleEventSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    eventMutation.mutate({
      id: editingEvent?.id,
      data: {
        eventType: fd.get("eventType"),
        title: fd.get("title"),
        description: fd.get("description"),
        eventDate: fd.get("eventDate"),
        eventTime: fd.get("eventTime"),
        endDate: fd.get("endDate") || null,
        location: fd.get("location"),
        isVirtual: fd.get("isVirtual") === "on",
        meetingLink: fd.get("meetingLink"),
        registrationLink: fd.get("registrationLink"),
        fiscalYear: fd.get("fiscalYear"),
        fiscalQuarter: fd.get("fiscalQuarter"),
        status: fd.get("status") || "scheduled",
      },
    });
  };
  const handleContactSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const channels: string[] = [];
    ["email", "whatsapp", "sms"].forEach(c => { if (fd.get(`channel_${c}`) === "on") channels.push(c); });
    contactMutation.mutate({
      id: editingContact?.id,
      data: {
        fullName: fd.get("fullName"),
        institution: fd.get("institution"),
        institutionType: fd.get("institutionType"),
        position: fd.get("position"),
        email: fd.get("email"),
        phone: fd.get("phone"),
        country: fd.get("country"),
        city: fd.get("city"),
        languagePreference: fd.get("languagePreference") || "ar",
        subscribedChannels: channels,
        notes: fd.get("notes"),
        status: fd.get("status") || "active",
      },
    });
  };

  const upcoming = events.filter(e => e.status === "scheduled" && new Date(e.eventDate) >= new Date()).length;

  return (
    <Layout>
      <div className="space-y-6 p-6" dir="rtl">
        <PageHeader title="العلاقات مع المساهمين" subtitle="تقويم أحداث المستثمرين وقاعدة بيانات جهات الاتصال" />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card><CardContent className="p-4"><div className="text-sm text-gray-500">أحداث قادمة</div><div className="text-2xl font-bold mt-1 text-blue-700" data-testid="kpi-upcoming-events">{upcoming}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-sm text-gray-500">إجمالي الأحداث</div><div className="text-2xl font-bold mt-1">{events.length}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-sm text-gray-500">جهات الاتصال النشطة</div><div className="text-2xl font-bold mt-1 text-emerald-700">{contacts.filter(c => c.status === "active").length}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-sm text-gray-500">المحللون</div><div className="text-2xl font-bold mt-1">{contacts.filter(c => c.institutionType === "analyst").length}</div></CardContent></Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="events" data-testid="tab-events"><Calendar className="h-4 w-4 ml-1" /> تقويم الأحداث</TabsTrigger>
            <TabsTrigger value="contacts" data-testid="tab-contacts"><Users className="h-4 w-4 ml-1" /> جهات الاتصال</TabsTrigger>
          </TabsList>

          <TabsContent value="events">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between"><CardTitle>تقويم أحداث المستثمرين</CardTitle>
                {isAdmin && <Button onClick={() => { setEditingEvent(null); setShowEventForm(true); }} data-testid="button-new-event"><Plus className="h-4 w-4 ml-1" /> حدث جديد</Button>}
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>التاريخ</TableHead><TableHead>العنوان</TableHead><TableHead>النوع</TableHead><TableHead>المكان</TableHead><TableHead>الحالة</TableHead><TableHead>إجراءات</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {events.map(e => {
                      const s = EVENT_STATUS[e.status] || EVENT_STATUS.scheduled;
                      return (
                        <TableRow key={e.id} data-testid={`row-event-${e.id}`}>
                          <TableCell>{e.eventDate} {e.eventTime}</TableCell>
                          <TableCell className="font-medium">{e.title}</TableCell>
                          <TableCell><Badge variant="outline">{EVENT_TYPES[e.eventType] || e.eventType}</Badge></TableCell>
                          <TableCell>{e.isVirtual ? <span className="flex items-center gap-1"><Video className="h-4 w-4 text-blue-600" />افتراضي</span> : <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{e.location || "—"}</span>}</TableCell>
                          <TableCell><Badge className={s.color}>{s.label}</Badge></TableCell>
                          <TableCell className="space-x-1 space-x-reverse">
                            {isAdmin && <Button variant="ghost" size="sm" onClick={() => { setEditingEvent(e); setShowEventForm(true); }}><Edit className="h-4 w-4" /></Button>}
                            {isAdmin && <Button variant="ghost" size="sm" onClick={() => setDeleteEventId(e.id)}><Trash2 className="h-4 w-4 text-red-600" /></Button>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {events.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-gray-500 py-6">لا توجد أحداث</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contacts">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between"><CardTitle>جهات اتصال المستثمرين</CardTitle>
                {isAdmin && <Button onClick={() => { setEditingContact(null); setShowContactForm(true); }} data-testid="button-new-contact"><Plus className="h-4 w-4 ml-1" /> جهة اتصال جديدة</Button>}
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>الاسم</TableHead><TableHead>الجهة</TableHead><TableHead>النوع</TableHead><TableHead>البريد</TableHead><TableHead>الجوال</TableHead><TableHead>الدولة</TableHead><TableHead>إجراءات</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {contacts.map(c => (
                      <TableRow key={c.id} data-testid={`row-contact-${c.id}`}>
                        <TableCell className="font-medium">{c.fullName}</TableCell>
                        <TableCell>{c.institution || "—"}</TableCell>
                        <TableCell>{c.institutionType ? <Badge variant="outline">{INSTITUTION_TYPES[c.institutionType] || c.institutionType}</Badge> : "—"}</TableCell>
                        <TableCell>{c.email ? <a className="text-blue-600 flex items-center gap-1" href={`mailto:${c.email}`}><Mail className="h-3 w-3" />{c.email}</a> : "—"}</TableCell>
                        <TableCell>{c.phone ? <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span> : "—"}</TableCell>
                        <TableCell>{c.country || "—"}</TableCell>
                        <TableCell className="space-x-1 space-x-reverse">
                          {isAdmin && <Button variant="ghost" size="sm" onClick={() => { setEditingContact(c); setShowContactForm(true); }}><Edit className="h-4 w-4" /></Button>}
                          {isAdmin && <Button variant="ghost" size="sm" onClick={() => setDeleteContactId(c.id)}><Trash2 className="h-4 w-4 text-red-600" /></Button>}
                        </TableCell>
                      </TableRow>
                    ))}
                    {contacts.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-gray-500 py-6">لا توجد جهات اتصال</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={showEventForm} onOpenChange={setShowEventForm}>
          <DialogContent dir="rtl" className="max-w-2xl"><DialogHeader><DialogTitle>{editingEvent ? "تعديل حدث" : "حدث جديد"}</DialogTitle></DialogHeader>
            <form onSubmit={handleEventSubmit} className="space-y-3">
              <div><Label>العنوان</Label><Input name="title" required defaultValue={editingEvent?.title} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>نوع الحدث</Label>
                  <Select name="eventType" defaultValue={editingEvent?.eventType || "earnings_call"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(EVENT_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
                </div>
                <div><Label>الحالة</Label>
                  <Select name="status" defaultValue={editingEvent?.status || "scheduled"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(EVENT_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent></Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>التاريخ</Label><Input type="date" name="eventDate" required defaultValue={editingEvent?.eventDate?.toString()} /></div>
                <div><Label>الوقت</Label><Input type="time" name="eventTime" defaultValue={editingEvent?.eventTime || ""} /></div>
                <div><Label>تاريخ الانتهاء</Label><Input type="date" name="endDate" defaultValue={editingEvent?.endDate?.toString() || ""} /></div>
              </div>
              <div><Label>الوصف</Label><Textarea name="description" rows={2} defaultValue={editingEvent?.description || ""} /></div>
              <div className="flex items-center gap-2"><Checkbox id="isVirtual" name="isVirtual" defaultChecked={editingEvent?.isVirtual} /><Label htmlFor="isVirtual" className="cursor-pointer">حدث افتراضي (عن بُعد)</Label></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>المكان</Label><Input name="location" defaultValue={editingEvent?.location || ""} /></div>
                <div><Label>رابط الاجتماع</Label><Input name="meetingLink" defaultValue={editingEvent?.meetingLink || ""} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>رابط التسجيل</Label><Input name="registrationLink" defaultValue={editingEvent?.registrationLink || ""} /></div>
                <div><Label>السنة المالية</Label><Input name="fiscalYear" defaultValue={editingEvent?.fiscalYear || ""} /></div>
                <div><Label>الربع</Label><Input name="fiscalQuarter" defaultValue={editingEvent?.fiscalQuarter || ""} placeholder="Q1" /></div>
              </div>
              <DialogFooter><Button type="submit" disabled={eventMutation.isPending}>{eventMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-1" />}حفظ</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={showContactForm} onOpenChange={setShowContactForm}>
          <DialogContent dir="rtl" className="max-w-2xl"><DialogHeader><DialogTitle>{editingContact ? "تعديل جهة اتصال" : "جهة اتصال جديدة"}</DialogTitle></DialogHeader>
            <form onSubmit={handleContactSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>الاسم</Label><Input name="fullName" required defaultValue={editingContact?.fullName} /></div>
                <div><Label>الجهة/المؤسسة</Label><Input name="institution" defaultValue={editingContact?.institution || ""} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>نوع الجهة</Label>
                  <Select name="institutionType" defaultValue={editingContact?.institutionType || "analyst"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(INSTITUTION_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
                </div>
                <div><Label>المنصب</Label><Input name="position" defaultValue={editingContact?.position || ""} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>البريد الإلكتروني</Label><Input type="email" name="email" defaultValue={editingContact?.email || ""} /></div>
                <div><Label>الجوال</Label><Input name="phone" defaultValue={editingContact?.phone || ""} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>الدولة</Label><Input name="country" defaultValue={editingContact?.country || ""} /></div>
                <div><Label>المدينة</Label><Input name="city" defaultValue={editingContact?.city || ""} /></div>
                <div><Label>اللغة المفضلة</Label>
                  <Select name="languagePreference" defaultValue={editingContact?.languagePreference || "ar"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ar">عربي</SelectItem><SelectItem value="en">إنجليزي</SelectItem></SelectContent></Select>
                </div>
              </div>
              <div><Label>قنوات الاتصال المفضلة</Label>
                <div className="flex gap-4 mt-2">
                  {["email", "whatsapp", "sms"].map(c => {
                    const arr = (editingContact?.subscribedChannels as string[] | undefined) || [];
                    return <div key={c} className="flex items-center gap-1"><Checkbox id={`channel_${c}`} name={`channel_${c}`} defaultChecked={arr.includes(c)} /><Label htmlFor={`channel_${c}`} className="cursor-pointer">{c === "email" ? "بريد" : c === "whatsapp" ? "واتساب" : "رسائل"}</Label></div>;
                  })}
                </div>
              </div>
              <div><Label>ملاحظات</Label><Textarea name="notes" rows={2} defaultValue={editingContact?.notes || ""} /></div>
              <DialogFooter><Button type="submit" disabled={contactMutation.isPending}>{contactMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-1" />}حفظ</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteEventId} onOpenChange={() => setDeleteEventId(null)}>
          <AlertDialogContent dir="rtl"><AlertDialogHeader><AlertDialogTitle>حذف الحدث</AlertDialogTitle></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>إلغاء</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteEventId && deleteEvent.mutate(deleteEventId)}>حذف</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog open={!!deleteContactId} onOpenChange={() => setDeleteContactId(null)}>
          <AlertDialogContent dir="rtl"><AlertDialogHeader><AlertDialogTitle>حذف جهة الاتصال</AlertDialogTitle></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>إلغاء</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteContactId && deleteContact.mutate(deleteContactId)}>حذف</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
