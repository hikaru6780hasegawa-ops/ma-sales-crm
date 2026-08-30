import { useState, useMemo, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Home, Upload, CheckCircle2, XCircle, Clock, Eye,
  AlertCircle, Plus, ArrowRight, ChevronDown, ChevronUp,
  Loader2, Search, FileText, User, Calendar, X
} from "lucide-react";

const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "申請中", color: "bg-yellow-100 text-yellow-800 border-yellow-300", icon: <Clock className="w-3.5 h-3.5" /> },
  reviewing: { label: "確認中", color: "bg-blue-100 text-blue-800 border-blue-300", icon: <Eye className="w-3.5 h-3.5" /> },
  approved: { label: "買付OK", color: "bg-green-100 text-green-800 border-green-300", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  rejected: { label: "差し戻し", color: "bg-red-100 text-red-800 border-red-300", icon: <XCircle className="w-3.5 h-3.5" /> },
};

const STATUS_TABS = [
  { key: "all", label: "すべて", color: "text-foreground", bgActive: "bg-foreground text-background" },
  { key: "pending", label: "申請中", color: "text-yellow-600", bgActive: "bg-yellow-600 text-white" },
  { key: "reviewing", label: "確認中", color: "text-blue-600", bgActive: "bg-blue-600 text-white" },
  { key: "approved", label: "買付OK", color: "text-green-600", bgActive: "bg-green-600 text-white" },
  { key: "rejected", label: "差し戻し", color: "text-red-600", bgActive: "bg-red-600 text-white" },
];

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] || STATUS_MAP.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${s.color}`}>
      {s.icon} {s.label}
    </span>
  );
}

function ApprovalFlow({ status }: { status: string }) {
  const steps = [
    { key: "pending", label: "申請", icon: <FileText className="w-4 h-4" /> },
    { key: "reviewing", label: "確認中", icon: <Eye className="w-4 h-4" /> },
    { key: "approved", label: "買付OK", icon: <CheckCircle2 className="w-4 h-4" /> },
  ];
  const isRejected = status === "rejected";
  const currentIdx = isRejected ? 1 : steps.findIndex(s => s.key === status);

  return (
    <div className="flex items-center gap-1 text-xs">
      {steps.map((step, i) => {
        const isActive = i <= currentIdx && !isRejected;
        const isCurrent = i === currentIdx && !isRejected;
        const isRejectedStep = isRejected && i === 1;
        return (
          <div key={step.key} className="flex items-center gap-1">
            {i > 0 && <ArrowRight className={`w-3 h-3 ${isActive ? "text-emerald-500" : "text-muted-foreground/40"}`} />}
            <div className={`flex items-center gap-1 px-2 py-1 rounded-md transition-colors ${
              isRejectedStep ? "bg-red-100 text-red-700 font-medium" :
              isCurrent ? "bg-emerald-100 text-emerald-700 font-medium" :
              isActive ? "bg-emerald-50 text-emerald-600" : "bg-muted/50 text-muted-foreground/60"
            }`}>
              {isRejectedStep ? <XCircle className="w-4 h-4" /> : step.icon}
              <span>{isRejectedStep ? "差し戻し" : step.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SubmitForm({ onSuccess }: { onSuccess: () => void }) {
  const [customerName, setCustomerName] = useState("");
  const [propertyName, setPropertyName] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [deposit, setDeposit] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMut = trpc.purchaseOffer.upload.useMutation();
  const createMut = trpc.purchaseOffer.create.useMutation();

  const handleSubmit = async () => {
    if (!customerName.trim()) { toast.error("お客様名を入力してください"); return; }
    if (!file) { toast.error("ファイルを選択してください"); return; }
    setUploading(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { url } = await uploadMut.mutateAsync({
        fileName: file.name,
        fileBase64: base64,
        fileType: file.type,
      });

      await createMut.mutateAsync({
        customerName: customerName.trim(),
        propertyName: propertyName.trim() || undefined,
        propertyAddress: propertyAddress.trim() || undefined,
        purchasePrice: purchasePrice.trim() || undefined,
        deposit: deposit.trim() || undefined,
        fileUrl: url,
        fileName: file.name,
        fileType: file.type,
        note: note.trim() || undefined,
      });

      toast.success("買付証明書を投稿しました。管理者に通知が送信されました。");
      setCustomerName(""); setPropertyName(""); setPropertyAddress("");
      setPurchasePrice(""); setDeposit(""); setNote(""); setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      onSuccess();
    } catch (e: any) {
      toast.error(`投稿に失敗しました: ${e.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Plus className="w-4 h-4" /> 買付証明書を投稿
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">お客様名 *</label>
            <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="例: 青木 駿 様" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">物件名</label>
            <Input value={propertyName} onChange={e => setPropertyName(e.target.value)} placeholder="例: 石岡市南台" />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">物件住所</label>
          <Input value={propertyAddress} onChange={e => setPropertyAddress(e.target.value)} placeholder="例: 茨城県石岡市南台3丁目" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">買付価格</label>
            <Input value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} placeholder="例: 15,000,000円" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">手付金</label>
            <Input value={deposit} onChange={e => setDeposit(e.target.value)} placeholder="例: 500,000円" />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">ファイル（PDF/画像）*</label>
          <Input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
            onChange={e => setFile(e.target.files?.[0] || null)}
          />
          {file && <p className="text-xs text-muted-foreground mt-1">{file.name} ({(file.size / 1024).toFixed(1)} KB)</p>}
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">備考</label>
          <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="備考・メモ" rows={2} />
        </div>
        <Button onClick={handleSubmit} disabled={uploading || !customerName.trim() || !file} className="w-full">
          {uploading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> アップロード中...</> : <><Upload className="w-4 h-4 mr-2" /> 投稿する</>}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function PurchaseOffer() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const isAdmin = user?.role === "admin";
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewDialogId, setReviewDialogId] = useState<number | null>(null);
  const [reviewAction, setReviewAction] = useState<"approved" | "rejected">("approved");

  const utils = trpc.useUtils();
  const listQuery = trpc.purchaseOffer.list.useQuery(
    statusFilter === "all" ? undefined : { status: statusFilter }
  );
  const summaryQuery = trpc.purchaseOffer.summary.useQuery();
  const updateStatusMut = trpc.purchaseOffer.updateStatus.useMutation({
    onSuccess: () => {
      utils.purchaseOffer.list.invalidate();
      utils.purchaseOffer.summary.invalidate();
      toast.success("ステータスを更新しました");
      setReviewDialogId(null);
      setReviewComment("");
    },
    onError: (e) => toast.error(`更新に失敗: ${e.message}`),
  });

  const items = listQuery.data || [];
  const summary = summaryQuery.data;

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // テキスト検索
      if (search.trim()) {
        const s = search.toLowerCase();
        const matchText = item.customerName?.toLowerCase().includes(s) ||
          item.propertyName?.toLowerCase().includes(s) ||
          item.submittedByName?.toLowerCase().includes(s) ||
          item.propertyAddress?.toLowerCase().includes(s);
        if (!matchText) return false;
      }
      // 日付範囲フィルタ
      if (dateFrom) {
        const itemDate = new Date(item.createdAt).toISOString().split("T")[0];
        if (itemDate < dateFrom) return false;
      }
      if (dateTo) {
        const itemDate = new Date(item.createdAt).toISOString().split("T")[0];
        if (itemDate > dateTo) return false;
      }
      return true;
    });
  }, [items, search, dateFrom, dateTo]);

  const handleReview = (id: number, action: "approved" | "rejected") => {
    setReviewDialogId(id);
    setReviewAction(action);
    setReviewComment("");
  };

  const confirmReview = () => {
    if (reviewDialogId === null) return;
    updateStatusMut.mutate({
      id: reviewDialogId,
      status: reviewAction,
      reviewComment: reviewComment.trim() || undefined,
    });
  };

  const hasDateFilter = dateFrom || dateTo;

  return (
    <div className="space-y-4 p-4 md:p-6 max-w-5xl mx-auto">
      {/* ヘッダー */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Home className="w-5 h-5 text-emerald-600" /> 買付証明書
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">買付証明書のアップロード・承認管理</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/purchase-offer/new")}>
            <FileText className="w-4 h-4 mr-1" /> フォーム入力で作成
          </Button>
          <Button variant={showForm ? "secondary" : "default"} onClick={() => setShowForm(!showForm)} size="sm">
            {showForm ? "フォームを閉じる" : <><Plus className="w-4 h-4 mr-1" /> ファイル投稿</>}
          </Button>
        </div>
      </div>

      {/* ステータスタブ */}
      <div className="flex flex-wrap gap-1.5">
        {STATUS_TABS.map(tab => {
          const count = summary ? (tab.key === "all" ? summary.total : (summary as any)[tab.key] ?? 0) : 0;
          const isActive = statusFilter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                isActive
                  ? `${tab.bgActive} shadow-sm`
                  : `bg-muted/60 ${tab.color} hover:bg-muted`
              }`}
            >
              {tab.label}
              <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-bold ${
                isActive ? "bg-white/25" : "bg-background/80"
              } px-1`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 検索・日付フィルター */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-col md:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="お客様名・物件名・住所で検索..." className="pl-9" />
          </div>
        </div>
        <div className="flex flex-col md:flex-row gap-2 items-start md:items-center">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="w-3.5 h-3.5" />
            <span>期間:</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="w-[150px] h-8 text-xs"
            />
            <span className="text-xs text-muted-foreground">〜</span>
            <Input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="w-[150px] h-8 text-xs"
            />
            {hasDateFilter && (
              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => { setDateFrom(""); setDateTo(""); }}>
                <X className="w-3 h-3 mr-1" /> クリア
              </Button>
            )}
          </div>
          {(search || hasDateFilter) && (
            <span className="text-xs text-muted-foreground ml-auto">
              {filteredItems.length}件表示
            </span>
          )}
        </div>
      </div>

      {/* 投稿フォーム */}
      {showForm && (
        <SubmitForm onSuccess={() => {
          utils.purchaseOffer.list.invalidate();
          utils.purchaseOffer.summary.invalidate();
          setShowForm(false);
        }} />
      )}

      {/* 一覧 */}
      {listQuery.isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredItems.length === 0 ? (
        <Card className="py-12 text-center">
          <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            {search || hasDateFilter ? "条件に一致する買付証明書がありません" : "買付証明書がありません"}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredItems.map(item => (
            <Card key={item.id} className="overflow-hidden">
              <div
                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
              >
                <Home className="w-5 h-5 text-emerald-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{item.customerName}</span>
                    {item.propertyName && <span className="text-xs text-muted-foreground">/ {item.propertyName}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
                    <span>投稿: {item.submittedByName}</span>
                    {item.purchasePrice && <><span>·</span><span>価格: {item.purchasePrice}</span></>}
                    <span>·</span>
                    <span>{new Date(item.createdAt).toLocaleDateString("ja-JP")}</span>
                  </div>
                </div>
                <StatusBadge status={item.status} />
                {expandedId === item.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </div>

              {expandedId === item.id && (
                <div className="border-t px-4 py-3 space-y-3 bg-muted/10">
                  <ApprovalFlow status={item.status} />

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {item.propertyAddress && <div className="col-span-2"><span className="text-muted-foreground">物件住所:</span> {item.propertyAddress}</div>}
                    {item.purchasePrice && <div><span className="text-muted-foreground">買付価格:</span> {item.purchasePrice}</div>}
                    {item.deposit && <div><span className="text-muted-foreground">手付金:</span> {item.deposit}</div>}
                    {item.fileUrl && <div><span className="text-muted-foreground">ファイル:</span> <a href={item.fileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">{item.fileName}</a></div>}
                    {item.note && <div className="col-span-2"><span className="text-muted-foreground">備考:</span> {item.note}</div>}
                    {item.reviewedByName && (
                      <div><span className="text-muted-foreground">確認者:</span> {item.reviewedByName}</div>
                    )}
                    {item.reviewComment && (
                      <div className="col-span-2"><span className="text-muted-foreground">コメント:</span> {item.reviewComment}</div>
                    )}
                    {item.reviewedAt && (
                      <div><span className="text-muted-foreground">確認日:</span> {new Date(item.reviewedAt).toLocaleDateString("ja-JP")}</div>
                    )}
                  </div>

                  {/* 顧客カルテリンク */}
                  {(item as any).customerFileId && (
                    <div className="flex items-center gap-1 text-xs">
                      <User className="w-3.5 h-3.5 text-blue-500" />
                      <button
                        className="text-blue-600 hover:text-blue-800 underline"
                        onClick={(e) => { e.stopPropagation(); navigate(`/customer-files/${(item as any).customerFileId}`); }}
                      >
                        顧客カルテを表示
                      </button>
                    </div>
                  )}

                  {/* フォーム表示・編集ボタン */}
                  <div className="flex gap-2 pt-1 flex-wrap">
                    {(item as any).formData && (
                      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); navigate(`/purchase-offer/${item.id}/edit`); }}>
                        <FileText className="w-3.5 h-3.5 mr-1" /> フォーム表示・編集
                      </Button>
                    )}
                    {isAdmin && (item.status === "pending" || item.status === "reviewing") && (
                      <>
                        {item.status === "pending" && (
                          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); updateStatusMut.mutate({ id: item.id, status: "reviewing" }); }}>
                            <Eye className="w-3.5 h-3.5 mr-1" /> 確認開始
                          </Button>
                        )}
                        <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={(e) => { e.stopPropagation(); handleReview(item.id, "approved"); }}>
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> 買付OK
                        </Button>
                        <Button size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); handleReview(item.id, "rejected"); }}>
                          <XCircle className="w-3.5 h-3.5 mr-1" /> 差し戻し
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* 承認/差し戻しダイアログ */}
      <Dialog open={reviewDialogId !== null} onOpenChange={(open) => { if (!open) setReviewDialogId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewAction === "approved" ? "買付OK" : "差し戻し"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {reviewAction === "approved"
                ? "この買付証明書を承認します。買付を進めてOKです。"
                : "この買付証明書を差し戻します。修正が必要な点をコメントしてください。"}
            </p>
            <Textarea
              value={reviewComment}
              onChange={e => setReviewComment(e.target.value)}
              placeholder={reviewAction === "approved" ? "承認コメント（任意）" : "差し戻し理由を入力..."}
              rows={3}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">キャンセル</Button>
            </DialogClose>
            <Button
              onClick={confirmReview}
              disabled={updateStatusMut.isPending}
              className={reviewAction === "approved" ? "bg-green-600 hover:bg-green-700" : ""}
              variant={reviewAction === "rejected" ? "destructive" : "default"}
            >
              {updateStatusMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {reviewAction === "approved" ? "買付OKにする" : "差し戻す"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
