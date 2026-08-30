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
import { Progress } from "@/components/ui/progress";
import { Plus, Search, Briefcase, Pencil, Trash2, TrendingUp, Calendar, Hash } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const phaseLabels: Record<string, string> = { lead: "リード", proposal: "提案中", negotiation: "交渉中", closing: "クロージング", won: "受注", lost: "失注" };
const phaseColors: Record<string, string> = {
  lead: "bg-indigo-100 text-indigo-700",
  proposal: "bg-cyan-100 text-cyan-700",
  negotiation: "bg-amber-100 text-amber-700",
  closing: "bg-purple-100 text-purple-700",
  won: "bg-emerald-100 text-emerald-700",
  lost: "bg-red-100 text-red-600",
};
const phaseProgress: Record<string, number> = { lead: 10, proposal: 30, negotiation: 55, closing: 80, won: 100, lost: 0 };

type DealForm = {
  customerId: number | null;
  dealName: string;
  amount: string;
  probability: string;
  phase: "lead" | "proposal" | "negotiation" | "closing" | "won" | "lost";
  expectedCloseDate: string;
  description: string;
};

const emptyForm: DealForm = {
  customerId: null, dealName: "", amount: "", probability: "50",
  phase: "lead", expectedCloseDate: "", description: "",
};

export default function Deals() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [phaseFilter, setPhaseFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<DealForm>(emptyForm);

  const queryInput = useMemo(() => ({
    phase: phaseFilter !== "all" ? phaseFilter : undefined,
  }), [phaseFilter]);

  const { data: deals, isLoading } = trpc.deal.list.useQuery(queryInput);
  const { data: customers } = trpc.customer.list.useQuery({});
  const utils = trpc.useUtils();

  const createMutation = trpc.deal.create.useMutation({
    onSuccess: () => {
      utils.deal.list.invalidate();
      utils.deal.byPhase.invalidate();
      utils.dashboard.stats.invalidate();
      setDialogOpen(false);
      setForm(emptyForm);
      toast.success("案件を登録しました");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.deal.update.useMutation({
    onSuccess: () => {
      utils.deal.list.invalidate();
      utils.deal.byPhase.invalidate();
      utils.dashboard.stats.invalidate();
      setDialogOpen(false);
      setForm(emptyForm);
      setEditingId(null);
      toast.success("案件を更新しました");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.deal.delete.useMutation({
    onSuccess: () => {
      utils.deal.list.invalidate();
      utils.deal.byPhase.invalidate();
      utils.dashboard.stats.invalidate();
      toast.success("案件を削除しました");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = () => {
    if (!form.dealName.trim()) { toast.error("案件名は必須です"); return; }
    if (!form.customerId) { toast.error("顧客を選択してください"); return; }
    const payload = {
      ...form,
      customerId: form.customerId!,
      amount: form.amount ? Number(form.amount) : 0,
      probability: Number(form.probability),
      expectedCloseDate: form.expectedCloseDate ? new Date(form.expectedCloseDate).getTime() : undefined,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleEdit = (deal: any) => {
    setEditingId(deal.id);
    setForm({
      customerId: deal.customerId,
      dealName: deal.dealName || "",
      amount: deal.amount ? String(deal.amount) : "",
      probability: String(deal.probability ?? 50),
      phase: deal.phase || "lead",
      expectedCloseDate: deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toISOString().split("T")[0] : "",
      description: deal.description || "",
    });
    setDialogOpen(true);
  };

  const filteredDeals = useMemo(() => {
    if (!deals) return [];
    if (!search) return deals;
    const q = search.toLowerCase();
    return deals.filter((d) =>
      d.dealName?.toLowerCase().includes(q) ||
      d.description?.toLowerCase().includes(q)
    );
  }, [deals, search]);

  const formatCurrency = (value: number) => `¥${value.toLocaleString()}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">案件管理</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {user?.role === "admin" ? "全営業担当の案件一覧" : "担当案件の管理"}
          </p>
        </div>
        <Button onClick={() => { setEditingId(null); setForm(emptyForm); setDialogOpen(true); }} className="shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          新規案件登録
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="案件名で検索..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={phaseFilter} onValueChange={setPhaseFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="フェーズ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべて</SelectItem>
            <SelectItem value="lead">リード</SelectItem>
            <SelectItem value="proposal">提案中</SelectItem>
            <SelectItem value="negotiation">交渉中</SelectItem>
            <SelectItem value="closing">クロージング</SelectItem>
            <SelectItem value="won">受注</SelectItem>
            <SelectItem value="lost">失注</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Deal List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : filteredDeals.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Briefcase className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-muted-foreground">案件データがありません</p>
            <Button variant="outline" className="mt-4" onClick={() => { setEditingId(null); setForm(emptyForm); setDialogOpen(true); }}>
              最初の案件を登録する
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredDeals.map((deal) => (
            <Card key={deal.id} className="hover:shadow-sm transition-all">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Briefcase className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <Badge variant="outline" className="text-xs font-mono px-1.5 py-0">
                            <Hash className="h-3 w-3 mr-0.5" />{deal.id}
                          </Badge>
                          <h3 className="text-sm font-semibold">{deal.dealName}</h3>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            {formatCurrency(deal.amount ?? 0)}
                          </span>
                          <span>確度 {deal.probability}%</span>
                          {deal.expectedCloseDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(deal.expectedCloseDate).toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" })}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${phaseColors[deal.phase] || ""}`}>
                        {phaseLabels[deal.phase]}
                      </span>
                    </div>
                    <div className="mt-3">
                      <Progress value={phaseProgress[deal.phase] ?? 0} className="h-1.5" />
                    </div>
                    {deal.description && (
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-1">{deal.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleEdit(deal)}>
                        <Pencil className="h-3 w-3 mr-1" />
                        編集
                      </Button>
                      <Button
                        variant="ghost" size="sm"
                        className="h-7 text-xs text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm(`「${deal.dealName}」を削除しますか？`)) deleteMutation.mutate({ id: deal.id });
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
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "案件の編集" : "新規案件登録"}</DialogTitle>
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
              <Label>案件名 <span className="text-destructive">*</span></Label>
              <Input value={form.dealName} onChange={(e) => setForm({ ...form, dealName: e.target.value })} placeholder="案件名を入力" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>金額（円）</Label>
                <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="1000000" />
              </div>
              <div>
                <Label>確度（%）</Label>
                <Input type="number" min="0" max="100" value={form.probability} onChange={(e) => setForm({ ...form, probability: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>フェーズ</Label>
                <Select value={form.phase} onValueChange={(v: any) => setForm({ ...form, phase: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead">リード</SelectItem>
                    <SelectItem value="proposal">提案中</SelectItem>
                    <SelectItem value="negotiation">交渉中</SelectItem>
                    <SelectItem value="closing">クロージング</SelectItem>
                    <SelectItem value="won">受注</SelectItem>
                    <SelectItem value="lost">失注</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>受注予定日</Label>
                <Input type="date" value={form.expectedCloseDate} onChange={(e) => setForm({ ...form, expectedCloseDate: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>説明</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="案件の詳細..." rows={3} />
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
