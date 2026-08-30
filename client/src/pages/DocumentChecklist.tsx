import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2, Clock, AlertTriangle, ArrowRight,
  ClipboardCheck, ArrowUpDown, ArrowUp, ArrowDown,
  Filter, X, Search, Download, Users, AlertCircle,
} from "lucide-react";
import { useMemo, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const CHECKLIST_LABELS: Record<string, string> = {
  docLicense: "免許証",
  docInsurance: "保険証",
  docGensen1: "源泉1期",
  docGensen2: "源泉2期",
  docGensen3: "源泉3期",
  docCic: "CIC",
  docPublicDoc: "公的書類",
  docPreReview: "事前審査用紙",
  docCompliance: "コンプラ",
  docHearing: "ヒアリング",
  docExistingLoan: "既存借入",
};

const DOC_FIELDS = Object.keys(CHECKLIST_LABELS);

// 7日以上更新がない未完了カルテを「未進捗」とみなす
const STALE_DAYS = 7;

function formatName(name: string): string {
  if (!name) return "";
  const trimmed = name.trim();
  if (/様\s*$/.test(trimmed)) return trimmed;
  return trimmed + "様";
}

function isStale(updatedAt: string | Date | null, percentage: number): boolean {
  if (percentage === 100) return false; // 完了済みは対象外
  if (!updatedAt) return true;
  const updated = new Date(updatedAt);
  const now = new Date();
  const diffMs = now.getTime() - updated.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= STALE_DAYS;
}

type TabType = "all" | "incomplete" | "complete" | "stale";

export default function DocumentChecklist() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { data: checklistProgress, isLoading } = trpc.dashboard.checklistProgress.useQuery();

  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<"default" | "asc" | "desc">("default");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [togglingCells, setTogglingCells] = useState<Set<string>>(new Set());

  const toggleDocCheck = trpc.customerFile.toggleDocCheck.useMutation({
    onMutate: async ({ id, field, checked }) => {
      const cellKey = `${id}-${field}`;
      setTogglingCells(prev => new Set(prev).add(cellKey));
    },
    onSuccess: (_, { id, field, checked }) => {
      utils.dashboard.checklistProgress.invalidate();
      const cellKey = `${id}-${field}`;
      setTogglingCells(prev => {
        const next = new Set(prev);
        next.delete(cellKey);
        return next;
      });
    },
    onError: (error, { id, field }) => {
      const cellKey = `${id}-${field}`;
      setTogglingCells(prev => {
        const next = new Set(prev);
        next.delete(cellKey);
        return next;
      });
      toast.error("チェックの更新に失敗しました");
    },
  });

  const handleToggleCheck = useCallback((e: React.MouseEvent, id: number, field: string, currentChecked: boolean) => {
    e.stopPropagation(); // 行クリック（ページ遷移）を防止
    toggleDocCheck.mutate({ id, field: field as any, checked: !currentChecked });
  }, [toggleDocCheck]);

  const items = checklistProgress || [];

  // 担当者一覧を抽出
  const assigneeList = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => { if (i.assignee) set.add(i.assignee); });
    return Array.from(set).sort();
  }, [items]);

  // フィルター適用（担当者 + 検索）
  const filteredItems = useMemo(() => {
    let result = items;
    if (assigneeFilter !== "all") {
      result = result.filter(i => i.assignee === assigneeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(i =>
        (i.customerName || "").toLowerCase().includes(q) ||
        (i.fileNumber || "").toLowerCase().includes(q) ||
        (i.assignee || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [items, assigneeFilter, searchQuery]);

  // 未進捗カウント
  const staleCount = useMemo(() =>
    filteredItems.filter(i => isStale(i.updatedAt, i.percentage)).length
  , [filteredItems]);

  // タブフィルター
  const tabFilteredItems = useMemo(() => {
    if (activeTab === "incomplete") return filteredItems.filter(i => i.percentage < 100);
    if (activeTab === "complete") return filteredItems.filter(i => i.percentage === 100);
    if (activeTab === "stale") return filteredItems.filter(i => isStale(i.updatedAt, i.percentage));
    return filteredItems;
  }, [filteredItems, activeTab]);

  // ソート適用
  const sortedItems = useMemo(() => {
    if (sortOrder === "default") return tabFilteredItems;
    return [...tabFilteredItems].sort((a, b) =>
      sortOrder === "asc"
        ? a.percentage - b.percentage
        : b.percentage - a.percentage
    );
  }, [tabFilteredItems, sortOrder]);

  // 統計
  const totalCount = filteredItems.length;
  const notStartedCount = filteredItems.filter(i => i.percentage === 0).length;
  const inProgressCount = filteredItems.filter(i => i.percentage > 0 && i.percentage < 100).length;
  const completeCount = filteredItems.filter(i => i.percentage === 100).length;

  // 担当者別統計
  const assigneeStats = useMemo(() => {
    const map = new Map<string, { total: number; completed: number; totalChecks: number; checkedChecks: number }>();
    filteredItems.forEach(item => {
      const a = item.assignee || "未割当";
      if (!map.has(a)) map.set(a, { total: 0, completed: 0, totalChecks: 0, checkedChecks: 0 });
      const s = map.get(a)!;
      s.total++;
      if (item.percentage === 100) s.completed++;
      s.totalChecks += item.totalCount;
      s.checkedChecks += item.checkedCount;
    });
    return Array.from(map.entries()).map(([name, stats]) => ({
      name,
      ...stats,
      rate: stats.totalChecks > 0 ? Math.round((stats.checkedChecks / stats.totalChecks) * 100) : 0,
    })).sort((a, b) => b.rate - a.rate);
  }, [filteredItems]);

  const cycleSortOrder = () => {
    setSortOrder(prev => {
      if (prev === "default") return "desc";
      if (prev === "desc") return "asc";
      return "default";
    });
  };

  // CSVエクスポート
  const handleExportCsv = () => {
    const headers = ["No.", "お客様名", "担当", "進捗", ...Object.values(CHECKLIST_LABELS)];
    const rows = sortedItems.map(item => [
      item.fileNumber,
      item.customerName || "",
      item.assignee || "",
      `${item.checkedCount}/${item.totalCount}`,
      ...item.details.map(d => d.checked ? "○" : ""),
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const bom = "\uFEFF";
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `書類チェックシート_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-emerald-600" />
            書類チェックシート
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            お客様預かり書類の取得状況を一覧で管理 — チェックマークをクリックして直接操作できます
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExportCsv}>
          <Download className="h-4 w-4" />
          CSV出力
        </Button>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className={`cursor-pointer hover:shadow-md transition-shadow ${activeTab === "all" ? "ring-2 ring-primary" : ""}`} onClick={() => setActiveTab("all")}>
          <CardContent className="p-4 text-center">
            <Users className="h-5 w-5 text-blue-600 mx-auto mb-1.5" />
            <p className="text-2xl font-bold text-blue-700">{totalCount}</p>
            <p className="text-xs text-muted-foreground">全カルテ</p>
          </CardContent>
        </Card>
        <Card className={`cursor-pointer hover:shadow-md transition-shadow ${activeTab === "incomplete" ? "ring-2 ring-primary" : ""}`} onClick={() => setActiveTab("incomplete")}>
          <CardContent className="p-4 text-center">
            <AlertTriangle className="h-5 w-5 text-red-600 mx-auto mb-1.5" />
            <p className="text-2xl font-bold text-red-700">{notStartedCount}</p>
            <p className="text-xs text-muted-foreground">未着手</p>
          </CardContent>
        </Card>
        <Card className={`cursor-pointer hover:shadow-md transition-shadow ${activeTab === "incomplete" ? "ring-2 ring-primary" : ""}`} onClick={() => setActiveTab("incomplete")}>
          <CardContent className="p-4 text-center">
            <Clock className="h-5 w-5 text-amber-600 mx-auto mb-1.5" />
            <p className="text-2xl font-bold text-amber-700">{inProgressCount}</p>
            <p className="text-xs text-muted-foreground">途中</p>
          </CardContent>
        </Card>
        <Card className={`cursor-pointer hover:shadow-md transition-shadow ${activeTab === "complete" ? "ring-2 ring-primary" : ""}`} onClick={() => setActiveTab("complete")}>
          <CardContent className="p-4 text-center">
            <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto mb-1.5" />
            <p className="text-2xl font-bold text-green-700">{completeCount}</p>
            <p className="text-xs text-muted-foreground">完了</p>
          </CardContent>
        </Card>
        <Card className={`cursor-pointer hover:shadow-md transition-shadow ${activeTab === "stale" ? "ring-2 ring-primary" : ""}`} onClick={() => setActiveTab("stale")}>
          <CardContent className="p-4 text-center">
            <AlertCircle className="h-5 w-5 text-orange-600 mx-auto mb-1.5" />
            <p className="text-2xl font-bold text-orange-700">{staleCount}</p>
            <p className="text-xs text-muted-foreground">未進捗 (7日+)</p>
          </CardContent>
        </Card>
      </div>

      {/* 担当者別投入率 */}
      {assigneeStats.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              担当者別 書類投入率
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {assigneeStats.map(s => (
                <div
                  key={s.name}
                  className="p-3 rounded-lg border bg-muted/30 cursor-pointer hover:bg-muted/60 transition-colors"
                  onClick={() => setAssigneeFilter(s.name === "未割当" ? "all" : s.name)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{s.name}</span>
                    <span className={`text-lg font-bold ${s.rate >= 80 ? "text-green-600" : s.rate >= 50 ? "text-amber-600" : "text-red-600"}`}>
                      {s.rate}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${s.rate >= 80 ? "bg-green-500" : s.rate >= 50 ? "bg-amber-500" : "bg-red-400"}`}
                      style={{ width: `${s.rate}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {s.completed}/{s.total}件完了 ({s.checkedChecks}/{s.totalChecks}項目)
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* フィルター・検索バー */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* 検索 */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="お客様名・No.・担当者で検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => setSearchQuery("")}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>

            {/* 担当者フィルター */}
            <div className="flex items-center gap-1.5">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                value={assigneeFilter}
                onChange={(e) => setAssigneeFilter(e.target.value)}
                className="text-sm border rounded-md px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring h-9"
              >
                <option value="all">全担当者</option>
                {assigneeList.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
              {assigneeFilter !== "all" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setAssigneeFilter("all")}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>

            {/* ソートボタン */}
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5"
              onClick={cycleSortOrder}
            >
              {sortOrder === "default" && <ArrowUpDown className="h-4 w-4" />}
              {sortOrder === "desc" && <ArrowDown className="h-4 w-4 text-amber-600" />}
              {sortOrder === "asc" && <ArrowUp className="h-4 w-4 text-blue-600" />}
              {sortOrder === "default" && "進捗順"}
              {sortOrder === "desc" && "進捗: 高い順"}
              {sortOrder === "asc" && "進捗: 低い順"}
            </Button>

            {/* タブ切り替え */}
            <div className="flex items-center border rounded-md overflow-hidden">
              {([
                { key: "all" as TabType, label: "すべて" },
                { key: "incomplete" as TabType, label: "未完了" },
                { key: "stale" as TabType, label: "未進捗" },
                { key: "complete" as TabType, label: "完了" },
              ]).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    activeTab === tab.key
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {tab.label}
                  {tab.key === "stale" && staleCount > 0 && (
                    <span className="ml-1 text-[10px] bg-orange-500 text-white rounded-full px-1.5 py-0.5">
                      {staleCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* メインテーブル */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">
              {activeTab === "all" ? "全カルテ" : activeTab === "incomplete" ? "未完了のカルテ" : activeTab === "stale" ? "未進捗カルテ (7日以上更新なし)" : "完了済みカルテ"}
              <Badge variant="secondary" className="ml-2 text-xs">{sortedItems.length}件</Badge>
            </CardTitle>
            <p className="text-[10px] text-muted-foreground">
              💡 チェックマーク / 空丸をクリックして直接チェックON/OFFできます
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {sortedItems.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              {searchQuery || assigneeFilter !== "all"
                ? "条件に一致するカルテがありません"
                : activeTab === "stale"
                ? "未進捗のカルテはありません 🎉"
                : "カルテがまだありません"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground">No.</th>
                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground">お客様名</th>
                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground">担当</th>
                    <th
                      className="text-center py-2.5 px-3 text-xs font-semibold text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"
                      onClick={cycleSortOrder}
                    >
                      <span className="inline-flex items-center gap-0.5">
                        進捗
                        {sortOrder === "default" && <ArrowUpDown className="h-3 w-3" />}
                        {sortOrder === "desc" && <ArrowDown className="h-3 w-3 text-amber-600" />}
                        {sortOrder === "asc" && <ArrowUp className="h-3 w-3 text-blue-600" />}
                      </span>
                    </th>
                    {DOC_FIELDS.map(k => (
                      <th key={k} className="text-center py-2.5 px-1.5 text-[10px] font-semibold text-muted-foreground whitespace-nowrap">
                        {CHECKLIST_LABELS[k]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedItems.map((item) => {
                    const stale = isStale(item.updatedAt, item.percentage);
                    return (
                      <tr
                        key={item.id}
                        className={`border-b last:border-0 transition-colors ${
                          stale
                            ? "bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/30"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        <td
                          className="py-2.5 px-3 text-xs font-mono text-muted-foreground cursor-pointer"
                          onClick={() => navigate(`/customer-files/${item.id}`)}
                        >
                          <div className="flex items-center gap-1">
                            {stale && <AlertCircle className="h-3 w-3 text-red-500 shrink-0" />}
                            {item.fileNumber}
                          </div>
                        </td>
                        <td
                          className="py-2.5 px-3 font-medium text-xs cursor-pointer hover:text-primary hover:underline"
                          onClick={() => navigate(`/customer-files/${item.id}`)}
                        >
                          {formatName(item.customerName || "")}
                        </td>
                        <td className="py-2.5 px-3 text-xs text-muted-foreground">{item.assignee || "-"}</td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center gap-1.5 justify-center">
                            <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  item.percentage === 100
                                    ? "bg-green-500"
                                    : item.percentage >= 50
                                    ? "bg-amber-500"
                                    : item.percentage > 0
                                    ? "bg-red-400"
                                    : "bg-gray-300"
                                }`}
                                style={{ width: `${item.percentage}%` }}
                              />
                            </div>
                            <span className="text-xs font-mono min-w-[3rem] text-right">
                              {item.checkedCount}/{item.totalCount}
                            </span>
                          </div>
                        </td>
                        {item.details.map((d) => {
                          const cellKey = `${item.id}-${d.key}`;
                          const isToggling = togglingCells.has(cellKey);
                          return (
                            <td key={d.key} className="py-2.5 px-1.5 text-center">
                              <button
                                onClick={(e) => handleToggleCheck(e, item.id, d.key, d.checked)}
                                disabled={isToggling}
                                className={`inline-flex items-center justify-center w-6 h-6 rounded-md transition-all ${
                                  isToggling
                                    ? "opacity-50 cursor-wait"
                                    : d.checked
                                    ? "hover:bg-green-100 dark:hover:bg-green-900/30 cursor-pointer"
                                    : "hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                                }`}
                                title={d.checked ? `${CHECKLIST_LABELS[d.key]}: ${d.date} — クリックで解除` : `${CHECKLIST_LABELS[d.key]}: 未取得 — クリックでチェック`}
                              >
                                {isToggling ? (
                                  <span className="inline-block w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                                ) : d.checked ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                ) : (
                                  <span className="inline-block w-4 h-4 rounded-full border-2 border-gray-300 hover:border-green-400 transition-colors" />
                                )}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 凡例 */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground px-1">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
          <span>取得済み（クリックで解除）</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-gray-300" />
          <span>未取得（クリックでチェック）</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-gray-400 border-t-transparent animate-spin" />
          <span>更新中</span>
        </div>
        <div className="flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 text-red-500" />
          <span className="text-red-600">7日以上未進捗（赤色ハイライト）</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span>📢</span>
          <span>全11項目完了時、管理者（長谷川光・上田歩）にSlack通知が自動送信されます</span>
        </div>
      </div>
    </div>
  );
}
