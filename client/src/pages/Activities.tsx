import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, CalendarCheck, Pencil, Trash2, Phone, Mail, Users as UsersIcon, MessageSquare, Hash } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const typeLabels: Record<string, string> = { visit: "訪問", call: "電話", email: "メール", meeting: "会議", other: "その他" };
const typeIcons: Record<string, any> = { visit: UsersIcon, call: Phone, email: Mail, meeting: MessageSquare, other: CalendarCheck };
const statusLabels: Record<string, string> = { planned: "予定", completed: "完了", cancelled: "中止" };
const statusColors: Record<string, string> = {
  planned: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-gray-100 text-gray-500",
};

type ActivityForm = {
  customerId: number | null;
  type: "visit" | "call" | "email" | "meeting" | "other";
  subject: string;
  description: string;
  activityDate: string;
  nextAction: string;
  nextActionDate: string;
  progressStatus: "planned" | "completed" | "cancelled";
};

const emptyForm: ActivityForm = {
  customerId: null, type: "visit", subject: "", description: "",
  activityDate: new Date().toISOString().split("T")[0],
  nextAction: "", nextActionDate: "", progressStatus: "planned",
};

export default function Activities() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ActivityForm>(emptyForm);

  const queryInput = useMemo(() => ({
    status: statusFilter !== "all" ? statusFilter : undefined,
    type: typeFilter !== "all" ? typeFilter : undefined,
  }), [statusFilter, typeFilter]);

  const { data: activities, isLoading } = trpc.activity.list.useQuery(queryInput);
  const { data: customers } = trpc.customer.list.useQuery({});
  const utils = trpc.useUtils();

  const createMutation = trpc.activity.create.useMutation({
    onSuccess: () => {
      utils.activity.list.invalidate();
      utils.activity.upcoming.invalidate();
      utils.dashboard.stats.invalidate();
      setDialogOpen(false);
      setForm(emptyForm);
      toast.success("営業活動を登録しました");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.activity.update.useMutation({
    onSuccess: () => {
      utils.activity.list.invalidate();
      utils.activity.upcoming.invalidate();
      setDialogOpen(false);
      setForm(emptyForm);
      setEditingId(null);
      toast.success("営業活動を更新しました");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.activity.delete.useMutation({
    onSuccess: () => {
      utils.activity.list.invalidate();
      utils.dashboard.stats.invalidate();
      toast.success("営業活動を削除しました");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = () => {
    if (!form.subject.trim()) { toast.error("件名は必須です"); return; }
    if (!form.customerId) { toast.error("顧客を選択してください"); return; }
    const payload = {
      ...form,
      customerId: form.customerId!,
      activityDate: new Date(form.activityDate).getTime(),
      nextActionDate: form.nextActionDate ? new Date(form.nextActionDate).getTime() : undefined,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleEdit = (activity: any) => {
    setEditingId(activity.id);
    setForm({
      customerId: activity.customerId,
      type: activity.type,
      subject: activity.subject || "",
      description: activity.description || "",
      activityDate: activity.activityDate ? new Date(activity.activityDate).toISOString().split("T")[0] : "",
      nextAction: activity.nextAction || "",
      nextActionDate: activity.nextActionDate ? new Date(activity.nextActionDate).toISOString().split("T")[0] : "",
      progressStatus: activity.progressStatus || "planned",
    });
    setDialogOpen(true);
  };

  const filteredActivities = useMemo(() => {
    if (!activities) return [];
    if (!search) return activities;
    const q = search.toLowerCase();
    return activities.filter((a) =>
      a.subject?.toLowerCase().includes(q) ||
      a.description?.toLowerCase().includes(q) ||
      a.nextAction?.toLowerCase().includes(q)
    );
  }, [activities, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">営業活動</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {user?.role === "admin" ? "全営業担当の活動記録" : "営業活動の記録・管理"}
          </p>
        </div>
        <Button onClick={() => { setEditingId(null); setForm(emptyForm); setDialogOpen(true); }} className="shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          新規活動登録
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="件名・内容で検索..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder="種別" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべて</SelectItem>
            <SelectItem value="visit">訪問</SelectItem>
            <SelectItem value="call">電話</SelectItem>
            <SelectItem value="email">メール</SelectItem>
            <SelectItem value="meeting">会議</SelectItem>
            <SelectItem value="other">その他</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder="ステータス" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべて</SelectItem>
            <SelectItem value="planned">予定</SelectItem>
            <SelectItem value="completed">完了</SelectItem>
            <SelectItem value="cancelled">中止</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Activity List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : filteredActivities.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <CalendarCheck className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-muted-foreground">営業活動の記録がありません</p>
            <Button variant="outline" className="mt-4" onClick={() => { setEditingId(null); setForm(emptyForm); setDialogOpen(true); }}>
              最初の活動を登録する
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredActivities.map((activity) => {
            const Icon = typeIcons[activity.type] || CalendarCheck;
            return (
              <Card key={activity.id} className="hover:shadow-sm transition-all">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <Badge variant="outline" className="text-xs font-mono px-1.5 py-0">
                              <Hash className="h-3 w-3 mr-0.5" />{activity.id}
                            </Badge>
                            <h3 className="text-sm font-semibold truncate">{activity.subject}</h3>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {typeLabels[activity.type]} ・ {new Date(activity.activityDate).toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric", weekday: "short" })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[activity.progressStatus] || ""}`}>
                            {statusLabels[activity.progressStatus]}
                          </span>
                        </div>
                      </div>
                      {activity.description && (
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{activity.description}</p>
                      )}
                      {activity.nextAction && (
                        <div className="mt-2 p-2 rounded-md bg-amber-50 border border-amber-100">
                          <p className="text-xs font-medium text-amber-800">
                            次回: {activity.nextAction}
                            {activity.nextActionDate && (
                              <span className="ml-2 text-amber-600">
                                ({new Date(activity.nextActionDate).toLocaleDateString("ja-JP", { month: "short", day: "numeric" })})
                              </span>
                            )}
                          </p>
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleEdit(activity)}>
                          <Pencil className="h-3 w-3 mr-1" />
                          編集
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          className="h-7 text-xs text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm("この営業活動を削除しますか？")) deleteMutation.mutate({ id: activity.id });
                          }}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          削除
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "営業活動の編集" : "新規営業活動登録"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>顧客 <span className="text-destructive">*</span></Label>
              <Select
                value={form.customerId ? String(form.customerId) : "none"}
                onValueChange={(v) => setForm({ ...form, customerId: v === "none" ? null : Number(v) })}
              >
                <SelectTrigger><SelectValue placeholder="顧客を選択" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">選択してください</SelectItem>
                  {customers?.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.companyName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>件名 <span className="text-destructive">*</span></Label>
              <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="商談の件名" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>活動種別</Label>
                <Select value={form.type} onValueChange={(v: any) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="visit">訪問</SelectItem>
                    <SelectItem value="call">電話</SelectItem>
                    <SelectItem value="email">メール</SelectItem>
                    <SelectItem value="meeting">会議</SelectItem>
                    <SelectItem value="other">その他</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>活動日</Label>
                <Input type="date" value={form.activityDate} onChange={(e) => setForm({ ...form, activityDate: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>進捗ステータス</Label>
              <Select value={form.progressStatus} onValueChange={(v: any) => setForm({ ...form, progressStatus: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">予定</SelectItem>
                  <SelectItem value="completed">完了</SelectItem>
                  <SelectItem value="cancelled">中止</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>商談内容</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="商談の詳細内容..." rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>次回アクション</Label>
                <Input value={form.nextAction} onChange={(e) => setForm({ ...form, nextAction: e.target.value })} placeholder="次回の対応内容" />
              </div>
              <div>
                <Label>次回予定日</Label>
                <Input type="date" value={form.nextActionDate} onChange={(e) => setForm({ ...form, nextActionDate: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>キャンセル</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? "保存中..." : editingId ? "更新" : "登録"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
