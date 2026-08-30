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
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Building2, Phone, Mail, MapPin, Pencil, Trash2, Hash, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { useLocation, useSearch } from "wouter";

const statusLabels: Record<string, string> = { active: "取引中", inactive: "休止", prospect: "見込み", lost: "失注" };
const statusColors: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  inactive: "bg-gray-100 text-gray-500",
  prospect: "bg-blue-100 text-blue-700",
  lost: "bg-red-100 text-red-600",
};

const industries = ["IT・通信", "製造業", "金融・保険", "不動産", "小売・卸売", "医療・福祉", "教育", "建設", "飲食・サービス", "その他"];

type CustomerForm = {
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  postalCode: string;
  industry: string;
  status: "active" | "inactive" | "prospect" | "lost";
  notes: string;
  folderId: number | null;
};

const emptyForm: CustomerForm = {
  companyName: "", contactName: "", contactEmail: "", contactPhone: "",
  address: "", postalCode: "", industry: "", status: "prospect", notes: "", folderId: null,
};

export default function Customers() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const searchParams = useSearch();
  const urlFolderId = new URLSearchParams(searchParams).get("folderId");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [folderFilter, setFolderFilter] = useState<string>(urlFolderId || "all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm);

  const { data: folders = [] } = trpc.folder.list.useQuery({});

  const queryInput = useMemo(() => ({
    search: search || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    folderId: folderFilter === "all" ? undefined : folderFilter === "none" ? null : parseInt(folderFilter),
  }), [search, statusFilter, folderFilter]);

  const { data: customers, isLoading } = trpc.customer.list.useQuery(queryInput);
  const utils = trpc.useUtils();

  const createMutation = trpc.customer.create.useMutation({
    onSuccess: () => {
      utils.customer.list.invalidate();
      utils.dashboard.stats.invalidate();
      setDialogOpen(false);
      setForm(emptyForm);
      toast.success("顧客を登録しました");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.customer.update.useMutation({
    onSuccess: () => {
      utils.customer.list.invalidate();
      setDialogOpen(false);
      setForm(emptyForm);
      setEditingId(null);
      toast.success("顧客情報を更新しました");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.customer.delete.useMutation({
    onSuccess: () => {
      utils.customer.list.invalidate();
      utils.dashboard.stats.invalidate();
      toast.success("顧客を削除しました");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = () => {
    if (!form.companyName.trim()) {
      toast.error("企業名は必須です");
      return;
    }
    const data = { ...form, folderId: form.folderId || undefined };
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (customer: any) => {
    setEditingId(customer.id);
    setForm({
      companyName: customer.companyName || "",
      contactName: customer.contactName || "",
      contactEmail: customer.contactEmail || "",
      contactPhone: customer.contactPhone || "",
      address: customer.address || "",
      postalCode: customer.postalCode || "",
      industry: customer.industry || "",
      status: customer.status || "prospect",
      notes: customer.notes || "",
      folderId: customer.folderId || null,
    });
    setDialogOpen(true);
  };

  const handleDelete = (id: number, name: string) => {
    if (confirm(`「${name}」を削除してよろしいですか？関連する営業活動と案件もすべて削除されます。`)) {
      deleteMutation.mutate({ id });
    }
  };

  const activeFolderName = folderFilter !== "all" && folderFilter !== "none"
    ? folders.find(f => f.id === parseInt(folderFilter))?.name
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            顧客管理
            {activeFolderName && (
              <Badge variant="secondary" className="ml-3 text-xs">
                <FolderOpen className="h-3 w-3 mr-1" />{activeFolderName}
              </Badge>
            )}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {user?.role === "admin" ? "全営業担当の顧客一覧" : "担当顧客の管理"}
            {customers && ` (${customers.length}件)`}
          </p>
        </div>
        <Button onClick={() => { setEditingId(null); setForm(emptyForm); setDialogOpen(true); }} className="shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          新規顧客登録
        </Button>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ID・企業名・担当者名・メール・電話で検索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder="ステータス" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべて</SelectItem>
            <SelectItem value="active">取引中</SelectItem>
            <SelectItem value="prospect">見込み</SelectItem>
            <SelectItem value="inactive">休止</SelectItem>
            <SelectItem value="lost">失注</SelectItem>
          </SelectContent>
        </Select>
        <Select value={folderFilter} onValueChange={setFolderFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="フォルダ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全フォルダ</SelectItem>
            <SelectItem value="none">未分類</SelectItem>
            {folders.map((f) => (
              <SelectItem key={f.id} value={String(f.id)}>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: f.color || "#4F46E5" }} />
                  {f.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Customer List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
        </div>
      ) : !customers || customers.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-muted-foreground">顧客データがありません</p>
            <Button variant="outline" className="mt-4" onClick={() => { setEditingId(null); setForm(emptyForm); setDialogOpen(true); }}>
              最初の顧客を登録する
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {customers.map((customer) => {
            const folder = folders.find(f => f.id === customer.folderId);
            return (
              <Card
                key={customer.id}
                className="hover:shadow-md transition-all cursor-pointer group"
                onClick={() => setLocation(`/customers/${customer.id}`)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs font-mono shrink-0 px-1.5 py-0">
                          <Hash className="h-3 w-3 mr-0.5" />{customer.id}
                        </Badge>
                        {folder && (
                          <Badge variant="secondary" className="text-xs px-1.5 py-0">
                            <span className="w-1.5 h-1.5 rounded-full mr-1 shrink-0" style={{ backgroundColor: folder.color || "#4F46E5" }} />
                            {folder.name}
                          </Badge>
                        )}
                      </div>
                      <h3 className="font-semibold text-sm truncate">{customer.companyName}</h3>
                      {customer.industry && (
                        <p className="text-xs text-muted-foreground mt-0.5">{customer.industry}</p>
                      )}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ml-2 ${statusColors[customer.status] || ""}`}>
                      {statusLabels[customer.status] || customer.status}
                    </span>
                  </div>
                  <div className="space-y-1.5 text-sm text-muted-foreground">
                    {customer.contactName && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground text-xs">{customer.contactName}</span>
                      </div>
                    )}
                    {customer.contactPhone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        <span className="text-xs truncate">{customer.contactPhone}</span>
                      </div>
                    )}
                    {customer.contactEmail && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5 shrink-0" />
                        <span className="text-xs truncate">{customer.contactEmail}</span>
                      </div>
                    )}
                    {customer.address && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="text-xs truncate">{customer.address}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={(e) => { e.stopPropagation(); handleEdit(customer); }}
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      編集
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-destructive hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); handleDelete(customer.id, customer.companyName); }}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      削除
                    </Button>
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
            <DialogTitle>{editingId ? "顧客情報の編集" : "新規顧客登録"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>企業名 <span className="text-destructive">*</span></Label>
              <Input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} placeholder="株式会社〇〇" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>担当者名</Label>
                <Input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} placeholder="山田太郎" />
              </div>
              <div>
                <Label>業種</Label>
                <Select value={form.industry || "none"} onValueChange={(v) => setForm({ ...form, industry: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">未選択</SelectItem>
                    {industries.map((ind) => <SelectItem key={ind} value={ind}>{ind}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>メールアドレス</Label>
                <Input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} placeholder="email@example.com" />
              </div>
              <div>
                <Label>電話番号</Label>
                <Input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} placeholder="03-1234-5678" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>郵便番号</Label>
                <Input value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} placeholder="100-0001" />
              </div>
              <div className="col-span-2">
                <Label>住所</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="東京都千代田区..." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>取引状況</Label>
                <Select value={form.status} onValueChange={(v: any) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prospect">見込み</SelectItem>
                    <SelectItem value="active">取引中</SelectItem>
                    <SelectItem value="inactive">休止</SelectItem>
                    <SelectItem value="lost">失注</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>フォルダ</Label>
                <Select value={form.folderId ? String(form.folderId) : "none"} onValueChange={(v) => setForm({ ...form, folderId: v === "none" ? null : parseInt(v) })}>
                  <SelectTrigger><SelectValue placeholder="未分類" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">未分類</SelectItem>
                    {folders.map((f) => (
                      <SelectItem key={f.id} value={String(f.id)}>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: f.color || "#4F46E5" }} />
                          {f.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>メモ</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="備考や特記事項..." rows={3} />
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
