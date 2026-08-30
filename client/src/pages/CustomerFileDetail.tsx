import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  User,
  Users,
  Calendar,
  FileText,
  Building2,
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  XCircle,
  Edit,
  Save,
  Trash2,
  MapPin,
  Banknote,
  Ruler,
  Home,
  Landmark,
  ClipboardCheck,
  Plus,
} from "lucide-react";
import { useLocation, useParams } from "wouter";

const PHASE_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  consultation: { label: "相談", color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300", icon: <Clock className="h-3 w-3" /> },
  pre_review: { label: "事前審査", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300", icon: <AlertCircle className="h-3 w-3" /> },
  review: { label: "本審査", color: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300", icon: <Circle className="h-3 w-3" /> },
  contract: { label: "契約", color: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300", icon: <FileText className="h-3 w-3" /> },
  final_settlement: { label: "決済", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300", icon: <Building2 className="h-3 w-3" /> },
  completed: { label: "完了", color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300", icon: <CheckCircle2 className="h-3 w-3" /> },
  cancelled: { label: "キャンセル", color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300", icon: <XCircle className="h-3 w-3" /> },
};

// お客様預かり書類チェックシート
const DOC_CHECKLIST_FIELDS = [
  { key: "docLicense", label: "免許証" },
  { key: "docInsurance", label: "保険証" },
  { key: "docGensen1", label: "源泉1期" },
  { key: "docGensen2", label: "源泉2期" },
  { key: "docGensen3", label: "源泉3期" },
  { key: "docCic", label: "CIC" },
  { key: "docPublicDoc", label: "公的書類" },
  { key: "docPreReview", label: "事前審査用紙" },
  { key: "docCompliance", label: "コンプライアンス書類" },
  { key: "docHearing", label: "ヒアリングシート" },
  { key: "docExistingLoan", label: "既存借入資料" },
] as const;

// 既存の書類取得状況フィールド
const DOC_FIELDS = [
  { key: "contractDeposit", label: "契約手付金", icon: <Banknote className="h-4 w-4" /> },
  { key: "commission", label: "手数料", icon: <Banknote className="h-4 w-4" /> },
  { key: "consent", label: "同意書", icon: <FileText className="h-4 w-4" /> },
  { key: "realEstateFile", label: "不動産ファイル", icon: <FileText className="h-4 w-4" /> },
  { key: "businessCardCollection", label: "名刺回収", icon: <User className="h-4 w-4" /> },
  { key: "nameplate", label: "表札", icon: <Home className="h-4 w-4" /> },
  { key: "rentalManagement", label: "賃貸管理形態", icon: <Building2 className="h-4 w-4" /> },
] as const;

// 名前を整形するヘルパー（「様」がなければ付ける、「様様」にならないように）
function formatName(name: string): string {
  if (!name) return "";
  const trimmed = name.trim();
  // 末尾に「様」があればそのまま返す
  if (/様\s*$/.test(trimmed)) return trimmed;
  // 「様」がなければ付ける
  return trimmed + "様";
}

const PROPERTY_FIELDS = [
  { key: "propertyAddress", label: "物件住所", icon: <MapPin className="h-4 w-4" /> },
  { key: "propertyPrice", label: "物件価格", icon: <Banknote className="h-4 w-4" /> },
  { key: "miscCosts", label: "諸費用", icon: <Banknote className="h-4 w-4" /> },
  { key: "totalFinancing", label: "融資総額", icon: <Landmark className="h-4 w-4" /> },
  { key: "buildingArea", label: "建物面積", icon: <Ruler className="h-4 w-4" /> },
  { key: "landArea", label: "土地面積", icon: <Ruler className="h-4 w-4" /> },
  { key: "buildYear", label: "築年", icon: <Calendar className="h-4 w-4" /> },
  { key: "structure", label: "構造", icon: <Building2 className="h-4 w-4" /> },
  { key: "layout", label: "間取り", icon: <Home className="h-4 w-4" /> },
] as const;

export default function CustomerFileDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Record<string, string>>({});
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const fileId = parseInt(params.id || "0");
  const fileQuery = trpc.customerFile.getById.useQuery({ id: fileId }, { enabled: fileId > 0 });
  const utils = trpc.useUtils();

  const updateMutation = trpc.customerFile.update.useMutation({
    onSuccess: () => {
      fileQuery.refetch();
      setIsEditing(false);
      setEditData({});
    },
  });

  // 書類チェック欄のワンクリックトグル
  const toggleDocCheck = trpc.customerFile.toggleDocCheck.useMutation({
    onMutate: async (input) => {
      // オプティミスティック更新
      await utils.customerFile.getById.cancel({ id: fileId });
      const prev = utils.customerFile.getById.getData({ id: fileId });
      if (prev) {
        utils.customerFile.getById.setData({ id: fileId }, {
          ...prev,
          [input.field]: input.checked ? new Date().toLocaleDateString("ja-JP") : "",
        });
      }
      return { prev };
    },
    onError: (_err, _input, context) => {
      if (context?.prev) {
        utils.customerFile.getById.setData({ id: fileId }, context.prev);
      }
      toast.error("チェックの更新に失敗しました");
    },
    onSuccess: (data) => {
      toast.success(data.checked ? "✅ チェックしました" : "チェックを解除しました");
      // ダッシュボードのアルリット投入率もリアルタイム更新
      utils.dashboard.docCheckStatus.invalidate();
      utils.customerFile.stats.invalidate();
    },
    onSettled: () => {
      utils.customerFile.getById.invalidate({ id: fileId });
    },
  });

  const deleteMutation = trpc.customerFile.delete.useMutation({
    onSuccess: () => {
      navigate("/customer-files");
    },
  });

  const file = fileQuery.data;

  if (fileQuery.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (!file) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">顧客データが見つかりません</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/customer-files")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          一覧に戻る
        </Button>
      </div>
    );
  }

  const phaseInfo = PHASE_LABELS[file.phase] || PHASE_LABELS.consultation;

  const startEditing = () => {
    setEditData({
      fileNumber: file.fileNumber || "",
      customerName: file.customerName || "",
      consultationDate: file.consultationDate || "",
      assignee: file.assignee || "",
      companion: file.companion || "",
      source: file.source || "",
      phase: file.phase || "consultation",
      financialInstitution: file.financialInstitution || "",
      broker: file.broker || "",
      notes: file.notes || "",
      ...Object.fromEntries(DOC_FIELDS.map(f => [f.key, (file as any)[f.key] || ""])),
      ...Object.fromEntries(DOC_CHECKLIST_FIELDS.map(f => [f.key, (file as any)[f.key] || ""])),
      ...Object.fromEntries(PROPERTY_FIELDS.map(f => [f.key, (file as any)[f.key] || ""])),
    });
    setIsEditing(true);
  };

  const saveEdit = () => {
    const updates: Record<string, any> = { id: fileId };
    for (const [key, value] of Object.entries(editData)) {
      updates[key] = value || undefined;
    }
    updateMutation.mutate(updates as any);
  };

  const getDocStatus = () => {
    let filled = 0;
    for (const f of DOC_FIELDS) {
      const val = (file as any)[f.key];
      if (val && val.trim() !== "") filled++;
    }
    return { filled, total: DOC_FIELDS.length, percentage: Math.round((filled / DOC_FIELDS.length) * 100) };
  };

  const getChecklistStatus = () => {
    let filled = 0;
    for (const f of DOC_CHECKLIST_FIELDS) {
      const val = (file as any)[f.key];
      if (val && val.trim() !== "") filled++;
    }
    return { filled, total: DOC_CHECKLIST_FIELDS.length, percentage: Math.round((filled / DOC_CHECKLIST_FIELDS.length) * 100) };
  };

  const docStatus = getDocStatus();
  const checklistStatus = getChecklistStatus();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/customer-files")}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            一覧
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono">{file.fileNumber}</Badge>
              <h1 className="text-2xl font-bold">{formatName(file.customerName)}</h1>
              <Badge className={`${phaseInfo.color} gap-1`}>
                {phaseInfo.icon}
                {phaseInfo.label}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={() => { setIsEditing(false); setEditData({}); }}>キャンセル</Button>
              <Button onClick={saveEdit} disabled={updateMutation.isPending} className="gap-1">
                <Save className="h-4 w-4" />
                {updateMutation.isPending ? "保存中..." : "保存"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={startEditing} className="gap-1">
                <Edit className="h-4 w-4" />
                編集
              </Button>
              <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogTrigger asChild>
                  <Button variant="destructive" size="icon"><Trash2 className="h-4 w-4" /></Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>カルテを削除しますか？</DialogTitle>
                  </DialogHeader>
                  <p className="text-sm text-muted-foreground">
                    {file.fileNumber} {formatName(file.customerName)}のカルテを完全に削除します。この操作は取り消せません。
                  </p>
                  <div className="flex justify-end gap-2 mt-4">
                    <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>キャンセル</Button>
                    <Button variant="destructive" onClick={() => deleteMutation.mutate({ id: fileId })} disabled={deleteMutation.isPending}>
                      {deleteMutation.isPending ? "削除中..." : "削除する"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Basic Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5" />
                基本情報
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {isEditing ? (
                  <>
                    <div>
                      <Label>案件No.</Label>
                      <Input value={editData.fileNumber} onChange={(e) => setEditData(p => ({ ...p, fileNumber: e.target.value }))} />
                    </div>
                    <div>
                      <Label>お客様名</Label>
                      <Input value={editData.customerName} onChange={(e) => setEditData(p => ({ ...p, customerName: e.target.value }))} />
                    </div>
                    <div>
                      <Label>担当者</Label>
                      <Input value={editData.assignee} onChange={(e) => setEditData(p => ({ ...p, assignee: e.target.value }))} />
                    </div>
                    <div>
                      <Label>同行者</Label>
                      <Input value={editData.companion} onChange={(e) => setEditData(p => ({ ...p, companion: e.target.value }))} />
                    </div>
                    <div>
                      <Label>相談日</Label>
                      <Input value={editData.consultationDate} onChange={(e) => setEditData(p => ({ ...p, consultationDate: e.target.value }))} />
                    </div>
                    <div>
                      <Label>紹介元</Label>
                      <Input value={editData.source} onChange={(e) => setEditData(p => ({ ...p, source: e.target.value }))} />
                    </div>
                    <div>
                      <Label>フェーズ</Label>
                      <Select value={editData.phase} onValueChange={(v) => setEditData(p => ({ ...p, phase: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(PHASE_LABELS).map(([key, val]) => (
                            <SelectItem key={key} value={key}>{val.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>金融機関</Label>
                      <Input value={editData.financialInstitution} onChange={(e) => setEditData(p => ({ ...p, financialInstitution: e.target.value }))} />
                    </div>
                    <div className="col-span-2">
                      <Label>仲介業者</Label>
                      <Input value={editData.broker} onChange={(e) => setEditData(p => ({ ...p, broker: e.target.value }))} />
                    </div>
                  </>
                ) : (
                  <>
                    <InfoRow label="案件No." value={file.fileNumber} />
                    <InfoRow label="お客様名" value={formatName(file.customerName)} />
                    <InfoRow label="担当者" value={file.assignee} icon={<User className="h-4 w-4" />} />
                    <InfoRow label="同行者" value={file.companion} icon={<Users className="h-4 w-4" />} />
                    <InfoRow label="相談日" value={file.consultationDate} icon={<Calendar className="h-4 w-4" />} />
                    <InfoRow label="紹介元" value={file.source} />
                    <InfoRow label="金融機関" value={file.financialInstitution} icon={<Landmark className="h-4 w-4" />} />
                    <InfoRow label="仲介業者" value={file.broker} />
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Property Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                物件情報
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {isEditing ? (
                  PROPERTY_FIELDS.map((f) => (
                    <div key={f.key} className={f.key === "propertyAddress" ? "col-span-2" : ""}>
                      <Label>{f.label}</Label>
                      <Input
                        value={editData[f.key] || ""}
                        onChange={(e) => setEditData(p => ({ ...p, [f.key]: e.target.value }))}
                      />
                    </div>
                  ))
                ) : (
                  PROPERTY_FIELDS.map((f) => (
                    <InfoRow key={f.key} label={f.label} value={(file as any)[f.key]} icon={f.icon} />
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                備考
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <Textarea
                  value={editData.notes || ""}
                  onChange={(e) => setEditData(p => ({ ...p, notes: e.target.value }))}
                  rows={5}
                  placeholder="メモや特記事項を入力..."
                />
              ) : (
                <p className="text-sm whitespace-pre-wrap">
                  {file.notes || <span className="text-muted-foreground">備考なし</span>}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Document Status */}
        <div className="space-y-6">
          {/* お客様預かり書類チェックシート */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                お客様預かり書類
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Progress bar */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">取得進捗</span>
                  <span className="text-sm font-bold">{checklistStatus.filled}/{checklistStatus.total} ({checklistStatus.percentage}%)</span>
                </div>
                <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      checklistStatus.percentage === 100 ? "bg-green-500" :
                      checklistStatus.percentage >= 50 ? "bg-amber-500" : "bg-red-400"
                    }`}
                    style={{ width: `${checklistStatus.percentage}%` }}
                  />
                </div>
              </div>

              {/* Checklist items */}
              <div className="space-y-2">
                {DOC_CHECKLIST_FIELDS.map((f) => {
                  const value = (file as any)[f.key];
                  const hasValue = value && value.trim() !== "";
                  return (
                    <div key={f.key} className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                      hasValue
                        ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
                        : "bg-background border-border hover:bg-accent/50"
                    }`}
                    onClick={() => {
                      if (!isEditing) {
                        toggleDocCheck.mutate({
                          id: fileId,
                          field: f.key as any,
                          checked: !hasValue,
                        });
                      }
                    }}>
                      {isEditing ? (
                        <div className="flex-1">
                          <Label className="flex items-center gap-2 mb-1">
                            <FileText className="h-4 w-4" />
                            {f.label}
                          </Label>
                          <Input
                            value={editData[f.key] || ""}
                            onChange={(e) => setEditData(p => ({ ...p, [f.key]: e.target.value }))}
                            placeholder="未取得"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      ) : (
                        <>
                          <Checkbox
                            checked={hasValue}
                            onCheckedChange={(checked) => {
                              toggleDocCheck.mutate({
                                id: fileId,
                                field: f.key as any,
                                checked: !!checked,
                              });
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className={`h-5 w-5 ${hasValue ? "border-green-500 data-[state=checked]:bg-green-500" : ""}`}
                          />
                          <div className="flex-1">
                            <span className={`text-sm font-medium ${hasValue ? "text-green-700 dark:text-green-300" : ""}`}>{f.label}</span>
                            {hasValue ? (
                              <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">✅ {value} に取得済み</p>
                            ) : (
                              <p className="text-xs text-muted-foreground/50 mt-0.5">クリックでチェック</p>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* 書類取得状況（既存） */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                書類取得状況
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Progress bar */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">取得進捗</span>
                  <span className="text-sm font-bold">{docStatus.filled}/{docStatus.total} ({docStatus.percentage}%)</span>
                </div>
                <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      docStatus.percentage === 100 ? "bg-green-500" :
                      docStatus.percentage >= 50 ? "bg-amber-500" : "bg-red-400"
                    }`}
                    style={{ width: `${docStatus.percentage}%` }}
                  />
                </div>
              </div>

              {/* Document items - ワンクリックチェックボックス */}
              <div className="space-y-2">
                {DOC_FIELDS.map((f) => {
                  const value = (file as any)[f.key];
                  const hasValue = value && value.trim() !== "";
                  return (
                    <div key={f.key} className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                      hasValue
                        ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
                        : "bg-background border-border hover:bg-accent/50"
                    }`}
                    onClick={() => {
                      if (!isEditing) {
                        toggleDocCheck.mutate({
                          id: fileId,
                          field: f.key as any,
                          checked: !hasValue,
                        });
                      }
                    }}>
                      {isEditing ? (
                        <div className="flex-1">
                          <Label className="flex items-center gap-2 mb-1">
                            {f.icon}
                            {f.label}
                          </Label>
                          <Input
                            value={editData[f.key] || ""}
                            onChange={(e) => setEditData(p => ({ ...p, [f.key]: e.target.value }))}
                            placeholder="未取得"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      ) : (
                        <>
                          <Checkbox
                            checked={hasValue}
                            onCheckedChange={(checked) => {
                              toggleDocCheck.mutate({
                                id: fileId,
                                field: f.key as any,
                                checked: !!checked,
                              });
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className={`h-5 w-5 ${hasValue ? "border-green-500 data-[state=checked]:bg-green-500" : ""}`}
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              {f.icon}
                              <span className={`text-sm font-medium ${hasValue ? "text-green-700 dark:text-green-300" : ""}`}>{f.label}</span>
                            </div>
                            {hasValue ? (
                              <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">✅ {value} に取得済み</p>
                            ) : (
                              <p className="text-xs text-muted-foreground/50 mt-0.5">クリックでチェック</p>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 資金計画書・買付証明書 クイックアクション */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-600" />
            資金計画書・買付証明書を作成
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            この顧客の情報が自動入力されたフォームを作成できます。
          </p>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 gap-2"
              onClick={() => navigate(`/funding-plan/new?customerFileId=${fileId}&customerName=${encodeURIComponent(file.customerName)}&propertyPrice=${encodeURIComponent(file.propertyPrice || "")}&propertyAddress=${encodeURIComponent(file.propertyAddress || "")}`)}
            >
              <Plus className="h-4 w-4" />
              <FileText className="h-4 w-4 text-emerald-600" />
              資金計画書を作成
            </Button>
            <Button
              variant="outline"
              className="flex-1 gap-2"
              onClick={() => navigate(`/purchase-offer/new?customerFileId=${fileId}&customerName=${encodeURIComponent(file.customerName)}&propertyAddress=${encodeURIComponent(file.propertyAddress || "")}`)}
            >
              <Plus className="h-4 w-4" />
              <ClipboardCheck className="h-4 w-4 text-indigo-600" />
              買付証明書を作成
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({ label, value, icon }: { label: string; value?: string | null; icon?: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <div className="flex items-center gap-1.5">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <p className="text-sm font-medium">{value || <span className="text-muted-foreground/50">未設定</span>}</p>
      </div>
    </div>
  );
}
