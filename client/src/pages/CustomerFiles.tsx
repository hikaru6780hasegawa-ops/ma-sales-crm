import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  FolderOpen,
  Search,
  User,
  Users,
  FileText,
  ChevronLeft,
  ChevronRight,
  Plus,
  Eye,
  Edit,
  Trash2,
  Building2,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  XCircle,
} from "lucide-react";
import { useLocation } from "wouter";

const PAGE_SIZE = 30;

const PHASE_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  consultation: { label: "相談", color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300", icon: <Clock className="h-3 w-3" /> },
  pre_review: { label: "事前審査", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300", icon: <AlertCircle className="h-3 w-3" /> },
  review: { label: "本審査", color: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300", icon: <Circle className="h-3 w-3" /> },
  contract: { label: "契約", color: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300", icon: <FileText className="h-3 w-3" /> },
  final_settlement: { label: "決済", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300", icon: <Building2 className="h-3 w-3" /> },
  completed: { label: "完了", color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300", icon: <CheckCircle2 className="h-3 w-3" /> },
  cancelled: { label: "キャンセル", color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300", icon: <XCircle className="h-3 w-3" /> },
};

const DOC_FIELDS = [
  { key: "contractDeposit", label: "契約手付金" },
  { key: "commission", label: "手数料" },
  { key: "consent", label: "同意書" },
  { key: "realEstateFile", label: "不動産ファイル" },
  { key: "businessCardCollection", label: "名刺回収" },
  { key: "nameplate", label: "表札" },
  { key: "rentalManagement", label: "賃貸管理形態" },
] as const;

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

function formatName(name: string): string {
  if (!name) return "";
  const trimmed = name.trim();
  if (/様\s*$/.test(trimmed)) return trimmed;
  return trimmed + "様";
}

export default function CustomerFiles() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedPhase, setSelectedPhase] = useState<string>("all");
  const [selectedAssignee, setSelectedAssignee] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(0);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newFile, setNewFile] = useState({ fileNumber: "", customerName: "", assignee: "", companion: "", consultationDate: "" });

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(0);
    setTimeout(() => setDebouncedSearch(value), 300);
  };

  const filesQuery = trpc.customerFile.list.useQuery({
    search: debouncedSearch || undefined,
    phase: selectedPhase === "all" ? undefined : selectedPhase,
    assignee: selectedAssignee === "all" ? undefined : selectedAssignee,
    limit: PAGE_SIZE,
    offset: currentPage * PAGE_SIZE,
  });

  const statsQuery = trpc.customerFile.stats.useQuery();
  const assigneesQuery = trpc.customerFile.assignees.useQuery();
  const createMutation = trpc.customerFile.create.useMutation({
    onSuccess: () => {
      filesQuery.refetch();
      statsQuery.refetch();
      setShowCreateDialog(false);
      setNewFile({ fileNumber: "", customerName: "", assignee: "", companion: "", consultationDate: "" });
    },
  });

  const files = filesQuery.data?.files || [];
  const totalFiles = filesQuery.data?.total || 0;
  const totalPages = Math.ceil(totalFiles / PAGE_SIZE);
  const stats = statsQuery.data;
  const assignees = assigneesQuery.data || [];

  const getDocStatus = (file: any) => {
    let filled = 0;
    let total = DOC_FIELDS.length;
    for (const f of DOC_FIELDS) {
      if (file[f.key] && file[f.key].trim() !== "") filled++;
    }
    return { filled, total, percentage: Math.round((filled / total) * 100) };
  };

  const getChecklistStatus = (file: any) => {
    let filled = 0;
    let total = DOC_CHECKLIST_FIELDS.length;
    for (const f of DOC_CHECKLIST_FIELDS) {
      if (file[f.key] && file[f.key].trim() !== "") filled++;
    }
    return { filled, total, percentage: Math.round((filled / total) * 100) };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FolderOpen className="h-7 w-7 text-amber-600" />
            顧客管理
          </h1>
          <p className="text-muted-foreground mt-1">
            お客様ごとにID・名前で管理。担当・同行・書類取得状況を一目で確認
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              新規カルテ
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>新規顧客登録</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>案件No.</Label>
                  <Input placeholder="No.301" value={newFile.fileNumber} onChange={(e) => setNewFile(p => ({ ...p, fileNumber: e.target.value }))} />
                </div>
                <div>
                  <Label>お客様名</Label>
                  <Input placeholder="山田 太郎" value={newFile.customerName} onChange={(e) => setNewFile(p => ({ ...p, customerName: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>担当者</Label>
                  <Input placeholder="担当者名" value={newFile.assignee} onChange={(e) => setNewFile(p => ({ ...p, assignee: e.target.value }))} />
                </div>
                <div>
                  <Label>同行者</Label>
                  <Input placeholder="同行者名" value={newFile.companion} onChange={(e) => setNewFile(p => ({ ...p, companion: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>相談日</Label>
                <Input placeholder="4/15(火)" value={newFile.consultationDate} onChange={(e) => setNewFile(p => ({ ...p, consultationDate: e.target.value }))} />
              </div>
              <Button
                className="w-full"
                disabled={!newFile.fileNumber || !newFile.customerName || createMutation.isPending}
                onClick={() => createMutation.mutate(newFile)}
              >
                {createMutation.isPending ? "作成中..." : "カルテを作成"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statsQuery.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)
        ) : (
          <>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">総カルテ数</p>
                <p className="text-3xl font-bold text-amber-600">{stats?.total || 0}</p>
              </CardContent>
            </Card>
            {(stats?.byPhase || []).filter(p => ["consultation", "pre_review", "review", "contract"].includes(p.phase)).slice(0, 3).map((p) => (
              <Card key={p.phase}>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">{PHASE_LABELS[p.phase]?.label || p.phase}</p>
                  <p className="text-3xl font-bold">{p.count}</p>
                </CardContent>
              </Card>
            ))}
          </>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="No.・お客様名・担当者で検索..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedPhase} onValueChange={(v) => { setSelectedPhase(v); setCurrentPage(0); }}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="フェーズ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全フェーズ</SelectItem>
                {Object.entries(PHASE_LABELS).map(([key, val]) => (
                  <SelectItem key={key} value={key}>{val.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedAssignee} onValueChange={(v) => { setSelectedAssignee(v); setCurrentPage(0); }}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="担当者" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全担当者</SelectItem>
                {assignees.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* File List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              カルテ一覧
              {totalFiles > 0 && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({totalFiles}件中 {currentPage * PAGE_SIZE + 1}-{Math.min((currentPage + 1) * PAGE_SIZE, totalFiles)}件)
                </span>
              )}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {filesQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>顧客データが見つかりません</p>
            </div>
          ) : (
            <div className="space-y-2">
              {files.map((file) => {
                const docStatus = getDocStatus(file);
                const clStatus = getChecklistStatus(file);
                const phaseInfo = PHASE_LABELS[file.phase] || PHASE_LABELS.consultation;
                return (
                  <div
                    key={file.id}
                    className="group rounded-lg border p-4 hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/customer-files/${file.id}`)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="font-mono text-xs shrink-0">
                            {file.fileNumber}
                          </Badge>
                          <span className="font-bold text-base">
                            {formatName(file.customerName)}
                          </span>
                          <Badge className={`text-xs ${phaseInfo.color} gap-1`}>
                            {phaseInfo.icon}
                            {phaseInfo.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
                          {file.assignee && (
                            <span className="flex items-center gap-1">
                              <User className="h-3.5 w-3.5" />
                              担当: {file.assignee}
                            </span>
                          )}
                          {file.companion && (
                            <span className="flex items-center gap-1">
                              <Users className="h-3.5 w-3.5" />
                              同行: {file.companion}
                            </span>
                          )}
                          {file.consultationDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              相談日: {file.consultationDate}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Document progress */}
                      <div className="shrink-0 text-right space-y-1">
                        <div>
                          <div className="text-xs text-muted-foreground mb-0.5">預かり書類</div>
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  clStatus.percentage === 100 ? "bg-green-500" :
                                  clStatus.percentage >= 50 ? "bg-amber-500" : "bg-red-400"
                                }`}
                                style={{ width: `${clStatus.percentage}%` }}
                              />
                            </div>
                            <span className="text-xs font-mono">{clStatus.filled}/{clStatus.total}</span>
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-0.5">書類取得</div>
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  docStatus.percentage === 100 ? "bg-green-500" :
                                  docStatus.percentage >= 50 ? "bg-amber-500" : "bg-red-400"
                                }`}
                                style={{ width: `${docStatus.percentage}%` }}
                              />
                            </div>
                            <span className="text-xs font-mono">{docStatus.filled}/{docStatus.total}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                disabled={currentPage === 0}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                前へ
              </Button>
              <span className="text-sm text-muted-foreground">
                {currentPage + 1} / {totalPages} ページ
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={currentPage >= totalPages - 1}
              >
                次へ
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
