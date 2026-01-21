import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Vote,
  ChevronLeft,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Clock,
  CheckCircle,
  XCircle,
  Users,
  Calendar,
  AlertTriangle,
} from "lucide-react";
import type { BoardResolution, ResolutionVote } from "@shared/schema";

const voteOptions = [
  { value: "for", label: "موافق", icon: ThumbsUp, color: "text-green-600 bg-green-100" },
  { value: "against", label: "رافض", icon: ThumbsDown, color: "text-red-600 bg-red-100" },
  { value: "abstain", label: "ممتنع", icon: Minus, color: "text-gray-600 bg-gray-100" },
];

export default function VotingPage() {
  const [selectedResolution, setSelectedResolution] = useState<BoardResolution | null>(null);
  const [selectedVote, setSelectedVote] = useState<string>("");
  const [voteComment, setVoteComment] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: resolutions = [], isLoading } = useQuery<BoardResolution[]>({
    queryKey: ["/api/governance/resolutions"],
  });

  const votingResolutions = resolutions.filter(r => r.status === 'voting');
  const completedVotes = resolutions.filter(r => r.status === 'approved' || r.status === 'rejected');

  const voteMutation = useMutation({
    mutationFn: async (data: { resolutionId: number; vote: string; comments?: string }) => {
      const res = await fetch("/api/governance/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resolutionId: data.resolutionId,
          voterType: "board_member",
          voterName: "المستخدم الحالي",
          vote: data.vote,
          comments: data.comments,
        }),
      });
      if (!res.ok) throw new Error("Failed to submit vote");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/resolutions"] });
      setSelectedResolution(null);
      setSelectedVote("");
      setVoteComment("");
      toast({ title: "تم تسجيل تصويتك بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في تسجيل التصويت", variant: "destructive" });
    },
  });

  const handleSubmitVote = () => {
    if (!selectedResolution || !selectedVote) return;
    voteMutation.mutate({
      resolutionId: selectedResolution.id,
      vote: selectedVote,
      comments: voteComment,
    });
  };

  const getVotePercentage = (res: BoardResolution) => {
    if (!res.totalVotes || res.totalVotes === 0) return 0;
    return ((res.forVotes || 0) / res.totalVotes) * 100;
  };

  const getRemainingTime = (deadline: Date | string | null) => {
    if (!deadline) return null;
    const deadlineDate = typeof deadline === 'string' ? new Date(deadline) : deadline;
    const diff = deadlineDate.getTime() - new Date().getTime();
    if (diff <= 0) return "انتهى";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days} يوم`;
    return `${hours} ساعة`;
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-4 md:p-8 lg:p-10 space-y-4" dir="rtl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/governance">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="p-3 bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl">
              <Vote className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-pink-800" data-testid="page-title">
                التصويت الإلكتروني
              </h1>
              <p className="text-gray-600">إدارة عمليات التصويت وحساب النتائج</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-pink-50 to-rose-50 border-pink-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-pink-600">قيد التصويت</p>
                  <p className="text-2xl font-bold text-pink-800">{votingResolutions.length}</p>
                </div>
                <Vote className="h-8 w-8 text-pink-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600">معتمدة</p>
                  <p className="text-2xl font-bold text-green-800">
                    {resolutions.filter(r => r.status === 'approved').length}
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-50 to-rose-50 border-red-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-600">مرفوضة</p>
                  <p className="text-2xl font-bold text-red-800">
                    {resolutions.filter(r => r.status === 'rejected').length}
                  </p>
                </div>
                <XCircle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600">إجمالي الأصوات</p>
                  <p className="text-2xl font-bold text-blue-800">
                    {resolutions.reduce((sum, r) => sum + (r.totalVotes || 0), 0)}
                  </p>
                </div>
                <Users className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {votingResolutions.length > 0 && (
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Vote className="h-5 w-5 text-pink-600" />
              قرارات تنتظر تصويتك
            </h2>
            <div className="grid gap-4">
              {votingResolutions.map((resolution) => {
                const remaining = getRemainingTime(resolution.votingDeadline);
                return (
                  <Card key={resolution.id} className="border-2 border-pink-200 hover:shadow-lg transition-shadow" data-testid={`voting-card-${resolution.id}`}>
                    <CardContent className="p-4">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <Badge variant="outline" className="font-mono text-xs">
                              {resolution.resolutionNumber}
                            </Badge>
                            <Badge className="bg-yellow-100 text-yellow-800">قيد التصويت</Badge>
                            {remaining && (
                              <Badge className="bg-orange-100 text-orange-800 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {remaining}
                              </Badge>
                            )}
                          </div>
                          <h3 className="font-semibold text-lg mb-2">{resolution.title}</h3>
                          <p className="text-sm text-gray-600 line-clamp-2 mb-4">{resolution.description}</p>
                          
                          <div className="bg-gray-50 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium">نتائج التصويت الحالية</span>
                              <span className="text-sm text-gray-500">{resolution.totalVotes || 0} صوت</span>
                            </div>
                            <Progress value={getVotePercentage(resolution)} className="h-3 mb-3" />
                            <div className="flex justify-between text-sm">
                              <div className="flex items-center gap-2 text-green-600">
                                <ThumbsUp className="h-4 w-4" />
                                <span>{resolution.forVotes || 0} موافق</span>
                              </div>
                              <div className="flex items-center gap-2 text-red-600">
                                <ThumbsDown className="h-4 w-4" />
                                <span>{resolution.againstVotes || 0} رافض</span>
                              </div>
                              <div className="flex items-center gap-2 text-gray-600">
                                <Minus className="h-4 w-4" />
                                <span>{resolution.abstainVotes || 0} ممتنع</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div>
                          <Button 
                            className="bg-pink-600 hover:bg-pink-700"
                            onClick={() => setSelectedResolution(resolution)}
                            data-testid={`vote-btn-${resolution.id}`}
                          >
                            <Vote className="h-4 w-4 ml-2" />
                            صوّت الآن
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {completedVotes.length > 0 && (
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              تصويتات مكتملة
            </h2>
            <div className="grid gap-4">
              {completedVotes.slice(0, 5).map((resolution) => (
                <Card key={resolution.id} className="hover:shadow-md transition-shadow" data-testid={`completed-vote-${resolution.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${resolution.status === 'approved' ? 'bg-green-100' : 'bg-red-100'}`}>
                          {resolution.status === 'approved' ? (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-600" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono text-xs">
                              {resolution.resolutionNumber}
                            </Badge>
                            <Badge className={resolution.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                              {resolution.status === 'approved' ? 'معتمد' : 'مرفوض'}
                            </Badge>
                          </div>
                          <p className="font-medium mt-1">{resolution.title}</p>
                        </div>
                      </div>
                      <div className="text-left">
                        <div className="text-2xl font-bold text-green-600">{resolution.forVotes || 0}</div>
                        <div className="text-sm text-gray-500">موافق من {resolution.totalVotes || 0}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {isLoading && (
          <Card>
            <CardContent className="py-8 text-center text-gray-500">
              جاري التحميل...
            </CardContent>
          </Card>
        )}

        {!isLoading && votingResolutions.length === 0 && completedVotes.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-gray-500">
              لا يوجد قرارات للتصويت
            </CardContent>
          </Card>
        )}

        <Dialog open={!!selectedResolution} onOpenChange={() => setSelectedResolution(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>التصويت على القرار</DialogTitle>
            </DialogHeader>
            {selectedResolution && (
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <Badge variant="outline" className="font-mono text-xs mb-2">
                    {selectedResolution.resolutionNumber}
                  </Badge>
                  <h3 className="font-semibold">{selectedResolution.title}</h3>
                  <p className="text-sm text-gray-600 mt-2">{selectedResolution.description}</p>
                </div>

                <div className="space-y-3">
                  <Label className="text-base font-medium">اختر تصويتك</Label>
                  <RadioGroup value={selectedVote} onValueChange={setSelectedVote} className="space-y-3">
                    {voteOptions.map((option) => (
                      <div
                        key={option.value}
                        className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          selectedVote === option.value ? 'border-pink-500 bg-pink-50' : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => setSelectedVote(option.value)}
                      >
                        <RadioGroupItem value={option.value} id={option.value} />
                        <div className={`p-2 rounded-full ${option.color}`}>
                          <option.icon className="h-5 w-5" />
                        </div>
                        <Label htmlFor={option.value} className="text-base cursor-pointer flex-1">
                          {option.label}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="comment">ملاحظات (اختياري)</Label>
                  <Textarea
                    id="comment"
                    value={voteComment}
                    onChange={(e) => setVoteComment(e.target.value)}
                    placeholder="أضف ملاحظاتك هنا..."
                  />
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-yellow-800">
                    تصويتك نهائي ولا يمكن تغييره بعد الإرسال.
                  </p>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedResolution(null)}>إلغاء</Button>
              <Button 
                className="bg-pink-600 hover:bg-pink-700"
                onClick={handleSubmitVote}
                disabled={!selectedVote || voteMutation.isPending}
              >
                تأكيد التصويت
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
