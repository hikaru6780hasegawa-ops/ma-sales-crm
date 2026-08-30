import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Settings2, GripVertical, Eye, EyeOff,
  MessageSquare, Hash, FileText, FolderOpen,
  CheckCircle2, Clock, AlertTriangle, ArrowRight,
  ClipboardCheck, UserCheck, Building2, ExternalLink,
  Bell, Send, RefreshCw, Megaphone,
  ArrowUpDown, ArrowUp, ArrowDown, Filter, X,
  FileQuestion, Users, CalendarDays,
} from "lucide-react";
import { useMemo, useState, useEffect, useCallback } from "react";
import SectionNav from "@/components/SectionNav";
import { toast } from "sonner";
import { useLocation } from "wouter";


// 名前を整形するヘルパー（「様」がなければ付ける、「様様」にならないように）
function formatName(name: string): string {
  if (!name) return "";
  const trimmed = name.trim();
  if (/様\s*$/.test(trimmed)) return trimmed;
  return trimmed + "様";
}

const filePhaseLabels: Record<string, string> = {
  consultation: "相談", pre_review: "事前審査", review: "本審査",
  contract: "契約", final_settlement: "決済", completed: "完了", cancelled: "キャンセル",
};
const filePhaseColors: Record<string, string> = {
  consultation: "bg-blue-100 text-blue-700", pre_review: "bg-yellow-100 text-yellow-700",
  review: "bg-orange-100 text-orange-700", contract: "bg-purple-100 text-purple-700",
  final_settlement: "bg-indigo-100 text-indigo-700", completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const WIDGET_LABELS: Record<string, string> = {
  stats: "KPIカード",
  checklistProgress: "預かり書類チェックシート進捗",
  consultationSummary: "案件相談シートサマリー",
  slackStatus: "Slack連動ステータス",
  docCheckStatus: "書類チェック状況",
  customerFileOverview: "顧客管理概要",
  fundingPurchaseSummary: "資金計画書・買付証明書",
};
const DEFAULT_WIDGET_ORDER = [
  "checklistProgress", "stats", "fundingPurchaseSummary", "consultationSummary", "docCheckStatus", "customerFileOverview",
  "slackStatus",
];

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

export default function Home() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { data: stats, isLoading: statsLoading } = trpc.dashboard.stats.useQuery();
  const { data: slackStatus, isLoading: slackLoading } = trpc.dashboard.slackStatus.useQuery();
  const { data: docCheck, isLoading: docCheckLoading } = trpc.dashboard.docCheckStatus.useQuery();
  const { data: fileOverview, isLoading: fileOverviewLoading } = trpc.dashboard.customerFileOverview.useQuery();
  const { data: checklistProgress, isLoading: checklistLoading } = trpc.dashboard.checklistProgress.useQuery();
  const { data: consultationSummary, isLoading: consultationSummaryLoading } = trpc.slack.consultationSummary.useQuery();
  const { data: fundingPlanSummary, isLoading: fundingPlanLoading } = trpc.fundingPlan.summary.useQuery();
  const { data: purchaseOfferSummary, isLoading: purchaseOfferLoading } = trpc.purchaseOffer.summary.useQuery();
  const { data: dashSettings } = trpc.dashboardSettings.get.useQuery();
  const updateDashSettings = trpc.dashboardSettings.update.useMutation({
    onSuccess: () => toast.success("ダッシュボード設定を保存しました"),
  });

  // 手動週次報告トリガー
  const triggerReport = trpc.slackNotify.triggerWeeklyReport.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("週次報告を送信しました");
      } else {
        toast.error("報告の送信に失敗しました");
      }
    },
    onError: () => toast.error("報告の送信に失敗しました"),
  });
  const { data: reportPreview } = trpc.slackNotify.previewReport.useQuery(undefined, {
    enabled: user?.role === "admin",
  });
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);

  // 手動Slack同期トリガー
  const triggerSlackSync = trpc.slackNotify.triggerSlackSync.useMutation({
    onSuccess: (data) => {
      toast.success(`Slack同期チェック完了: DB内${data.synced}件`);
      trpc.useUtils().dashboard.slackStatus.invalidate();
    },
    onError: () => toast.error("Slack同期に失敗しました"),
  });

  // 手動書類リマインドトリガー
  const triggerDocReminder = trpc.slackNotify.triggerDocReminder.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("書類リマインドを送信しました");
      } else {
        toast.error("リマインドの送信に失敗しました");
      }
    },
    onError: () => toast.error("リマインドの送信に失敗しました"),
  });
  const { data: reminderPreview } = trpc.slackNotify.previewDocReminder.useQuery(undefined, {
    enabled: user?.role === "admin",
  });

  const [widgetOrder, setWidgetOrder] = useState<string[]>(DEFAULT_WIDGET_ORDER);
  const [hiddenWidgets, setHiddenWidgets] = useState<string[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null);

  // チェックシート進捗テーブル: 担当者フィルター & ソート
  const [checklistAssigneeFilter, setChecklistAssigneeFilter] = useState<string>("all");
  const [checklistSortOrder, setChecklistSortOrder] = useState<"default" | "asc" | "desc">("default");

  useEffect(() => {
    if (dashSettings) {
      try {
        const savedOrder = dashSettings.widgetOrder ? JSON.parse(dashSettings.widgetOrder) : null;
        const hidden = dashSettings.hiddenWidgets ? JSON.parse(dashSettings.hiddenWidgets) : [];
        // Merge saved order with any new widgets
        if (savedOrder) {
          const merged = [...savedOrder];
          for (const w of DEFAULT_WIDGET_ORDER) {
            if (!merged.includes(w)) merged.push(w);
          }
          setWidgetOrder(merged);
        }
        setHiddenWidgets(hidden);
      } catch {
        setWidgetOrder(DEFAULT_WIDGET_ORDER);
        setHiddenWidgets([]);
      }
    }
  }, [dashSettings]);

  const handleSaveSettings = useCallback(() => {
    updateDashSettings.mutate({
      widgetOrder: JSON.stringify(widgetOrder),
      hiddenWidgets: JSON.stringify(hiddenWidgets),
    });
    setSettingsOpen(false);
  }, [widgetOrder, hiddenWidgets, updateDashSettings]);

  const toggleWidget = (widgetId: string) => {
    setHiddenWidgets(prev =>
      prev.includes(widgetId) ? prev.filter(w => w !== widgetId) : [...prev, widgetId]
    );
  };

  const moveWidget = (widgetId: string, direction: "up" | "down") => {
    setWidgetOrder(prev => {
      const idx = prev.indexOf(widgetId);
      if (idx === -1) return prev;
      const newOrder = [...prev];
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= newOrder.length) return prev;
      [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];
      return newOrder;
    });
  };


  const isVisible = (widgetId: string) => !hiddenWidgets.includes(widgetId);

  // ============ Widget Renderers ============

  const renderStats = () => {
    const statCards = [
      { label: "Slackメッセージ", value: slackStatus?.messageCount ?? 0, icon: MessageSquare, color: "text-pink-600", bgColor: "bg-pink-50", link: "/slack" },
      { label: "顧客管理", value: fileOverview?.stats?.total ?? 0, icon: FolderOpen, color: "text-teal-600", bgColor: "bg-teal-50", link: "/customer-files" },
    ];
    return (
      <div key="stats" data-section="stats" className="grid grid-cols-2 gap-4">
        {statCards.map((stat) => (
          <Card
            key={stat.label}
            className="stat-card cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate(stat.link)}
          >
            <CardContent className="p-4">
              {statsLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <div className="space-y-2">
                  <div className={`w-9 h-9 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                    <stat.icon className={`h-4.5 w-4.5 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
                    <p className="text-xl font-bold tracking-tight mt-0.5">
                      {typeof stat.value === "number" ? stat.value.toLocaleString() : stat.value}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderSlackStatus = () => (
    <Card key="slackStatus" data-section="slackStatus">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-pink-600" />
            Slack連動ステータス
          </CardTitle>
          <div className="flex items-center gap-1">
              {user?.role === "admin" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-xs text-pink-600 hover:text-pink-700"
                  onClick={() => triggerSlackSync.mutate()}
                  disabled={triggerSlackSync.isPending}
                >
                  <RefreshCw className={`h-3 w-3 ${triggerSlackSync.isPending ? 'animate-spin' : ''}`} />
                  {triggerSlackSync.isPending ? '同期中...' : '同期'}
                </Button>
              )}
              <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => navigate("/slack")}>
                詳細 <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
        </div>
      </CardHeader>
      <CardContent>
        {slackLoading ? (
          <Skeleton className="h-[120px] w-full" />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 rounded-lg bg-pink-50">
                <Hash className="h-5 w-5 text-pink-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-pink-700">{slackStatus?.channelCount ?? 0}</p>
                <p className="text-xs text-muted-foreground">連携チャンネル</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-blue-50">
                <MessageSquare className="h-5 w-5 text-blue-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-blue-700">{(slackStatus?.messageCount ?? 0).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">取得メッセージ</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-teal-50">
                <FileText className="h-5 w-5 text-teal-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-teal-700">{fileOverview?.stats?.total ?? 0}</p>
                <p className="text-xs text-muted-foreground">顧客管理</p>
              </div>
            </div>
            {slackStatus?.channels && slackStatus.channels.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">チャンネル別メッセージ数</p>
                {slackStatus.channels.map((ch) => (
                  <div key={ch.channelId} className="flex items-center justify-between text-sm py-1.5 px-2 rounded bg-muted/50">
                    <span className="flex items-center gap-2">
                      <Hash className="h-3 w-3 text-muted-foreground" />
                      <span className="truncate max-w-[180px]">{ch.channelName}</span>
                    </span>
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className="text-xs">{ch.count}件</Badge>
                      {ch.latestMessage && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(ch.latestMessage).toLocaleDateString("ja-JP", { month: "short", day: "numeric" })}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {/* 最新メッセージプレビュー */}
            {slackStatus?.recentMessages && slackStatus.recentMessages.length > 0 && (
              <div className="space-y-3 border-t pt-3">
                <p className="text-xs font-medium text-muted-foreground">最新メッセージ</p>
                {slackStatus.recentMessages.map((ch) => (
                  <div key={ch.channelId} className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <Hash className="h-3 w-3 text-pink-500" />
                      <span className="text-xs font-semibold text-pink-700">{ch.channelName}</span>
                    </div>
                    {ch.messages.map((msg) => (
                      <div key={msg.id} className="ml-4 pl-2 border-l-2 border-pink-200 py-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-medium text-foreground">{msg.userName}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(msg.postedAt).toLocaleDateString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{msg.messageText || "（添付ファイル）"}</p>
                        {msg.files && msg.files !== "[]" && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-blue-600 mt-0.5">
                            <FileText className="h-2.5 w-2.5" /> 添付あり
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderChecklistProgress = () => {
    const items = checklistProgress || [];

    // 担当者一覧を抽出（フィルター用）
    const assigneeList = useMemo(() => {
      const set = new Set<string>();
      items.forEach(i => { if (i.assignee) set.add(i.assignee); });
      return Array.from(set).sort();
    }, [items]);

    // フィルター適用
    const filteredItems = useMemo(() => {
      if (checklistAssigneeFilter === "all") return items;
      return items.filter(i => i.assignee === checklistAssigneeFilter);
    }, [items, checklistAssigneeFilter]);

    const incomplete = filteredItems.filter(i => i.percentage < 100);
    const complete = filteredItems.filter(i => i.percentage === 100);

    // ソート適用
    const sortedIncomplete = useMemo(() => {
      if (checklistSortOrder === "default") return incomplete;
      return [...incomplete].sort((a, b) =>
        checklistSortOrder === "asc"
          ? a.percentage - b.percentage
          : b.percentage - a.percentage
      );
    }, [incomplete, checklistSortOrder]);

    const cycleSortOrder = () => {
      setChecklistSortOrder(prev => {
        if (prev === "default") return "desc";
        if (prev === "desc") return "asc";
        return "default";
      });
    };

    return (
      <Card key="checklistProgress" data-section="checklistProgress" className="col-span-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-emerald-600" />
              お客様預かり書類 チェックシート進捗
              <Badge variant="secondary" className="text-xs">{filteredItems.length}件</Badge>
            </CardTitle>
            <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => navigate("/customer-files")}>
              カルテ一覧 <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {checklistLoading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              カルテがまだありません
            </div>
          ) : (
            <div className="space-y-4">
              {/* 全体サマリ */}
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-2.5 rounded-lg bg-red-50">
                  <AlertTriangle className="h-4 w-4 text-red-600 mx-auto mb-1" />
                  <p className="text-lg font-bold text-red-700">{filteredItems.filter(i => i.percentage === 0).length}</p>
                  <p className="text-xs text-muted-foreground">未着手</p>
                </div>
                <div className="text-center p-2.5 rounded-lg bg-amber-50">
                  <Clock className="h-4 w-4 text-amber-600 mx-auto mb-1" />
                  <p className="text-lg font-bold text-amber-700">{incomplete.filter(i => i.percentage > 0).length}</p>
                  <p className="text-xs text-muted-foreground">途中</p>
                </div>
                <div className="text-center p-2.5 rounded-lg bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto mb-1" />
                  <p className="text-lg font-bold text-green-700">{complete.length}</p>
                  <p className="text-xs text-muted-foreground">完了</p>
                </div>
              </div>

              {/* フィルター・ソートコントロール */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* 担当者フィルター */}
                <div className="flex items-center gap-1.5">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                  <select
                    value={checklistAssigneeFilter}
                    onChange={(e) => setChecklistAssigneeFilter(e.target.value)}
                    className="text-xs border rounded-md px-2 py-1.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="all">全担当者</option>
                    {assigneeList.map(a => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                  {checklistAssigneeFilter !== "all" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => setChecklistAssigneeFilter("all")}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>

                {/* ソートボタン */}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={cycleSortOrder}
                >
                  {checklistSortOrder === "default" && <ArrowUpDown className="h-3 w-3" />}
                  {checklistSortOrder === "desc" && <ArrowDown className="h-3 w-3 text-amber-600" />}
                  {checklistSortOrder === "asc" && <ArrowUp className="h-3 w-3 text-blue-600" />}
                  {checklistSortOrder === "default" && "進捗順"}
                  {checklistSortOrder === "desc" && "進捗: 高い順"}
                  {checklistSortOrder === "asc" && "進捗: 低い順"}
                </Button>
              </div>

              {/* 未完了カルテ一覧 */}
              {sortedIncomplete.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">未完了のカルテ ({sortedIncomplete.length}件)</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">No.</th>
                          <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">お客様名</th>
                          <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">担当</th>
                          <th className="text-center py-2 px-2 text-xs font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors" onClick={cycleSortOrder}>
                            <span className="inline-flex items-center gap-0.5">
                              進捗
                              {checklistSortOrder === "default" && <ArrowUpDown className="h-3 w-3" />}
                              {checklistSortOrder === "desc" && <ArrowDown className="h-3 w-3 text-amber-600" />}
                              {checklistSortOrder === "asc" && <ArrowUp className="h-3 w-3 text-blue-600" />}
                            </span>
                          </th>
                          {Object.keys(CHECKLIST_LABELS).map(k => (
                            <th key={k} className="text-center py-2 px-1 text-[10px] font-medium text-muted-foreground whitespace-nowrap">
                              {CHECKLIST_LABELS[k]}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sortedIncomplete.slice(0, 20).map((item) => (
                          <tr
                            key={item.id}
                            className="border-b last:border-0 hover:bg-muted/50 cursor-pointer transition-colors"
                            onClick={() => navigate(`/customer-files/${item.id}`)}
                          >
                            <td className="py-2 px-2 text-xs font-mono text-muted-foreground">{item.fileNumber}</td>
                            <td className="py-2 px-2 font-medium text-xs">{formatName(item.customerName || "")}</td>
                            <td className="py-2 px-2 text-xs text-muted-foreground">{item.assignee || "-"}</td>
                            <td className="py-2 px-2 text-center">
                              <div className="flex items-center gap-1 justify-center">
                                <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      item.percentage >= 50 ? "bg-amber-500" : "bg-red-400"
                                    }`}
                                    style={{ width: `${item.percentage}%` }}
                                  />
                                </div>
                                <span className="text-[10px] font-mono">{item.checkedCount}/{item.totalCount}</span>
                              </div>
                            </td>
                            {item.details.map((d) => (
                              <td key={d.key} className="py-2 px-1 text-center">
                                {d.checked ? (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mx-auto" />
                                ) : (
                                  <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-gray-300 mx-auto" />
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 完了済みカルテ */}
              {complete.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    完了済み ({complete.length}件)
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {complete.slice(0, 10).map(item => (
                      <Badge
                        key={item.id}
                        variant="outline"
                        className="text-xs cursor-pointer hover:bg-green-50 border-green-200 text-green-700"
                        onClick={() => navigate(`/customer-files/${item.id}`)}
                      >
                        {item.fileNumber} {formatName(item.customerName || "")}
                      </Badge>
                    ))}
                    {complete.length > 10 && (
                      <Badge variant="secondary" className="text-xs">他{complete.length - 10}件</Badge>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderDocCheckStatus = () => {
    const total = docCheck?.total ?? 0;
    const completed = docCheck?.completed ?? 0;
    const inProgress = docCheck?.inProgress ?? 0;
    const notStarted = docCheck?.notStarted ?? 0;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return (
      <Card key="docCheckStatus" data-section="docCheckStatus">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-amber-600" />
              書類チェック状況
            </CardTitle>
            <div className="flex items-center gap-1">
              {user?.role === "admin" && (
                <>
                <Dialog open={reminderDialogOpen} onOpenChange={setReminderDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-1 text-xs text-orange-600 hover:text-orange-700">
                      <Megaphone className="h-3 w-3" /> リマインド
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Megaphone className="h-5 w-5 text-orange-600" />
                        書類提出リマインド
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="bg-muted/50 rounded-lg p-4">
                        <p className="text-xs text-muted-foreground mb-2">リマインドプレビュー</p>
                        <pre className="text-xs whitespace-pre-wrap font-sans leading-relaxed">
                          {reminderPreview?.message || "読み込み中..."}
                        </pre>
                      </div>
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                        <p className="text-xs text-orange-800">
                          ※ このリマインドは毎週金曜日 17:00 (JST) に自動送信されます。
                          下のボタンで今すぐ手動送信することもできます。
                        </p>
                      </div>
                      <Button
                        onClick={() => {
                          triggerDocReminder.mutate();
                          setReminderDialogOpen(false);
                        }}
                        disabled={triggerDocReminder.isPending}
                        className="w-full gap-2 bg-orange-600 hover:bg-orange-700"
                      >
                        <Megaphone className="h-4 w-4" />
                        {triggerDocReminder.isPending ? "送信中..." : "今すぐリマインドを送信"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-1 text-xs text-amber-600 hover:text-amber-700">
                      <Bell className="h-3 w-3" /> 報告
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Bell className="h-5 w-5 text-amber-600" />
                        週次書類チェック報告
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="bg-muted/50 rounded-lg p-4">
                        <p className="text-xs text-muted-foreground mb-2">報告プレビュー</p>
                        <pre className="text-xs whitespace-pre-wrap font-sans leading-relaxed">
                          {reportPreview?.message || "読み込み中..."}
                        </pre>
                      </div>
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <p className="text-xs text-amber-800">
                          ※ この報告は毎週月曜日 9:00 (JST) に自動送信されます。
                          下のボタンで今すぐ手動送信することもできます。
                        </p>
                      </div>
                      <Button
                        onClick={() => {
                          triggerReport.mutate();
                          setReportDialogOpen(false);
                        }}
                        disabled={triggerReport.isPending}
                        className="w-full gap-2 bg-amber-600 hover:bg-amber-700"
                      >
                        <Send className="h-4 w-4" />
                        {triggerReport.isPending ? "送信中..." : "今すぐ報告を送信"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                </>
              )}
              <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => navigate("/customer-files")}>
                詳細 <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
        {docCheckLoading ? (
          <Skeleton className="h-[120px] w-full" />
        ) : (
          <div className="space-y-4">
            {/* 全体の投入率 */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">アルリット投入率</span>
                <span className="text-2xl font-bold text-amber-600">{rate}%</span>
              </div>
              <Progress value={rate} className="h-2" />

              {/* 完了・途中・未着手 */}
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-2.5 rounded-lg bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto mb-1" />
                  <p className="text-lg font-bold text-green-700">{completed}</p>
                  <p className="text-xs text-muted-foreground">完了</p>
                </div>
                <div className="text-center p-2.5 rounded-lg bg-yellow-50">
                  <Clock className="h-4 w-4 text-yellow-600 mx-auto mb-1" />
                  <p className="text-lg font-bold text-yellow-700">{inProgress}</p>
                  <p className="text-xs text-muted-foreground">途中</p>
                </div>
                <div className="text-center p-2.5 rounded-lg bg-red-50">
                  <AlertTriangle className="h-4 w-4 text-red-600 mx-auto mb-1" />
                  <p className="text-lg font-bold text-red-700">{notStarted}</p>
                  <p className="text-xs text-muted-foreground">未着手</p>
                </div>
              </div>

              {/* 担当者別進捗 */}
              {docCheck?.byAssignee && docCheck.byAssignee.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">担当者別 書類投入率</p>
                  {docCheck.byAssignee.slice(0, 5).map((a) => (
                    <div key={a.assignee} className="flex items-center gap-3 text-sm">
                      <UserCheck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="w-20 truncate font-medium">{a.assignee}</span>
                      <div className="flex-1">
                        <Progress value={a.rate} className="h-1.5" />
                      </div>
                      <span className="text-xs text-muted-foreground w-14 text-right">{a.rate}% ({a.total}件)</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderCustomerFileOverview = () => {
    const fileStats = fileOverview?.stats;
    const recentFiles = fileOverview?.recentFiles || [];

    return (
      <Card key="customerFileOverview" data-section="customerFileOverview">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-teal-600" />
              顧客管理概要
            </CardTitle>
            <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => navigate("/customer-files")}>
              一覧 <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {fileOverviewLoading ? (
            <Skeleton className="h-[120px] w-full" />
          ) : (
            <div className="space-y-4">
              {/* フェーズ別件数 */}
              {fileStats?.byPhase && fileStats.byPhase.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {fileStats.byPhase.map((p) => (
                    <Badge
                      key={p.phase}
                      variant="secondary"
                      className={`${filePhaseColors[p.phase] || "bg-gray-100 text-gray-700"} cursor-pointer`}
                      onClick={() => navigate(`/customer-files?phase=${p.phase}`)}
                    >
                      {filePhaseLabels[p.phase] || p.phase}: {p.count}件
                    </Badge>
                  ))}
                </div>
              )}

              {/* 担当者別件数 */}
              {fileStats?.byAssignee && fileStats.byAssignee.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">担当者別カルテ数</p>
                  <div className="flex flex-wrap gap-2">
                    {fileStats.byAssignee.slice(0, 6).map((a) => (
                      <Badge
                        key={a.assignee}
                        variant="outline"
                        className="cursor-pointer hover:bg-muted"
                        onClick={() => navigate(`/customer-files?assignee=${encodeURIComponent(a.assignee!)}`)}
                      >
                        {a.assignee}: {a.count}件
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* 最近更新されたカルテ */}
              {recentFiles.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">最近更新されたカルテ</p>
                  {recentFiles.slice(0, 4).map((f: any) => (
                    <div
                      key={f.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                      onClick={() => navigate(`/customer-files/${f.id}`)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-mono text-muted-foreground shrink-0">{f.fileNumber}</span>
                        <span className="text-sm font-medium truncate">{f.customerName}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="secondary" className={`text-xs ${filePhaseColors[f.phase] || ""}`}>
                          {filePhaseLabels[f.phase] || f.phase}
                        </Badge>
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };


  const renderConsultationSummary = () => {
    const summary = consultationSummary;
    return (
      <Card key="consultationSummary" data-section="consultationSummary">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FileQuestion className="h-4 w-4 text-violet-600" />
              案件相談シートサマリー
            </CardTitle>
            <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => navigate("/consultation-sheet")}>
              詳細 <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {consultationSummaryLoading ? (
            <Skeleton className="h-[120px] w-full" />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 rounded-lg bg-violet-50">
                  <FileText className="h-5 w-5 text-violet-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-violet-700">{summary?.total ?? 0}</p>
                  <p className="text-xs text-muted-foreground">総件数</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-red-50">
                  <AlertTriangle className="h-5 w-5 text-red-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-red-700">{summary?.pending ?? 0}</p>
                  <p className="text-xs text-muted-foreground">未対応</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-green-50">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-green-700">{summary?.done ?? 0}</p>
                  <p className="text-xs text-muted-foreground">対応済み</p>
                </div>
              </div>

              {/* 最新の相談シートプレビュー */}
              {summary?.recentMessages && summary.recentMessages.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">最新の相談シート</p>
                  {summary.recentMessages.map((msg: any) => (
                    <div key={msg.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2 min-w-0">
                        <Users className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                        <span className="text-sm font-medium truncate">{msg.userName || '不明'}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={msg.consultationStatus === 'done' ? 'default' : 'destructive'} className={`text-xs ${msg.consultationStatus === 'done' ? 'bg-green-100 text-green-700 hover:bg-green-100' : 'bg-red-100 text-red-700 hover:bg-red-100'}`}>
                          {msg.consultationStatus === 'done' ? '対応済' : '未対応'}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {msg.postedAt ? new Date(msg.postedAt).toLocaleDateString("ja-JP", { month: "short", day: "numeric" }) : ''}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderFundingPurchaseSummary = () => {
    const fpLoading = fundingPlanLoading || purchaseOfferLoading;
    const fpTotal = fundingPlanSummary?.total ?? 0;
    const fpPending = fundingPlanSummary?.pending ?? 0;
    const fpReviewing = fundingPlanSummary?.reviewing ?? 0;
    const fpApproved = fundingPlanSummary?.approved ?? 0;
    const fpRejected = fundingPlanSummary?.rejected ?? 0;
    const poTotal = purchaseOfferSummary?.total ?? 0;
    const poPending = purchaseOfferSummary?.pending ?? 0;
    const poReviewing = purchaseOfferSummary?.reviewing ?? 0;
    const poApproved = purchaseOfferSummary?.approved ?? 0;
    const poRejected = purchaseOfferSummary?.rejected ?? 0;
    const needsAction = fpPending + fpReviewing + poPending + poReviewing;
    return (
      <Card key="fundingPurchaseSummary" data-section="fundingPurchaseSummary">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600" />
              資金計画書・買付証明書
            </CardTitle>
            {needsAction > 0 && (
              <Badge variant="destructive" className="gap-1">
                <Bell className="h-3 w-3" />
                要確認 {needsAction}件
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {fpLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <div className="space-y-4">
              {/* 資金計画書 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-emerald-600" />
                    資金計画書
                  </h4>
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => navigate("/funding-plan")}>
                    一覧 <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div className="text-center p-2 rounded-lg bg-amber-50 border border-amber-100">
                    <p className="text-lg font-bold text-amber-600">{fpPending}</p>
                    <p className="text-[10px] text-muted-foreground">申請中</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-blue-50 border border-blue-100">
                    <p className="text-lg font-bold text-blue-600">{fpReviewing}</p>
                    <p className="text-[10px] text-muted-foreground">確認中</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-green-50 border border-green-100">
                    <p className="text-lg font-bold text-green-600">{fpApproved}</p>
                    <p className="text-[10px] text-muted-foreground">承認済</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-red-50 border border-red-100">
                    <p className="text-lg font-bold text-red-600">{fpRejected}</p>
                    <p className="text-[10px] text-muted-foreground">差し戻し</p>
                  </div>
                </div>
              </div>
              <div className="border-t" />
              {/* 買付証明書 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium flex items-center gap-1.5">
                    <ClipboardCheck className="h-3.5 w-3.5 text-indigo-600" />
                    買付証明書
                  </h4>
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => navigate("/purchase-offer")}>
                    一覧 <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div className="text-center p-2 rounded-lg bg-amber-50 border border-amber-100">
                    <p className="text-lg font-bold text-amber-600">{poPending}</p>
                    <p className="text-[10px] text-muted-foreground">申請中</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-blue-50 border border-blue-100">
                    <p className="text-lg font-bold text-blue-600">{poReviewing}</p>
                    <p className="text-[10px] text-muted-foreground">確認中</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-green-50 border border-green-100">
                    <p className="text-lg font-bold text-green-600">{poApproved}</p>
                    <p className="text-[10px] text-muted-foreground">買付OK</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-red-50 border border-red-100">
                    <p className="text-lg font-bold text-red-600">{poRejected}</p>
                    <p className="text-[10px] text-muted-foreground">差し戻し</p>
                  </div>
                </div>
              </div>
              {/* クイックアクション */}
              <div className="border-t pt-3 flex gap-2">
                <Button size="sm" variant="outline" className="flex-1 text-xs gap-1" onClick={() => navigate("/funding-plan/new")}>
                  <FileText className="h-3 w-3" />
                  資金計画書作成
                </Button>
                <Button size="sm" variant="outline" className="flex-1 text-xs gap-1" onClick={() => navigate("/purchase-offer/new")}>
                  <ClipboardCheck className="h-3 w-3" />
                  買付証明書作成
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderWidget = (widgetId: string) => {
    if (!isVisible(widgetId)) return null;
    switch (widgetId) {
      case "stats": return renderStats();
      case "checklistProgress": return renderChecklistProgress();
      case "slackStatus": return renderSlackStatus();
      case "docCheckStatus": return renderDocCheckStatus();
      case "customerFileOverview": return renderCustomerFileOverview();
       case "consultationSummary": return renderConsultationSummary();
      case "fundingPurchaseSummary": return renderFundingPurchaseSummary();
      default: return null;
    }
  };

  // Group chart widgets into pairs for 2-column layout
  const renderWidgets = () => {
    const visibleOrder = widgetOrder.filter(w => isVisible(w));
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < visibleOrder.length) {
      const widgetId = visibleOrder[i];

      if (widgetId === "stats") {
        elements.push(renderWidget(widgetId));
        i++;
        continue;
      }

      // Pair widgets in 2-column grid
      const pairableWidgets = ["slackStatus", "docCheckStatus", "customerFileOverview", "consultationSummary", "fundingPurchaseSummary"];
      // checklistProgress is full-width, render alone
      if (widgetId === "checklistProgress") {
        elements.push(renderWidget(widgetId));
        i++;
        continue;
      }
      if (pairableWidgets.includes(widgetId)) {
        const nextId = visibleOrder[i + 1];
        if (nextId && pairableWidgets.includes(nextId)) {
          elements.push(
            <div key={`grid-${widgetId}-${nextId}`} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {renderWidget(widgetId)}
              {renderWidget(nextId)}
            </div>
          );
          i += 2;
          continue;
        }
      }

      elements.push(renderWidget(widgetId));
      i++;
    }

    return elements;
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "おはようございます";
    if (hour >= 12 && hour < 17) return "こんにちは";
    return "お疲れさまです";
  };

  const getMotivation = () => {
    const messages = [
      "今日も素晴らしい一日にしましょう。",
      "一歩一歩、着実に前進しましょう。",
      "今日の努力が明日の成果につながります。",
      "お客様との信頼を築く一日に。",
      "小さな行動の積み重ねが大きな成果を生みます。",
    ];
    const dayIndex = new Date().getDate() % messages.length;
    return messages[dayIndex];
  };

  return (
    <div className="space-y-6">
      {/* Welcome message */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0a1628] via-[#1a2a4a] to-[#1e3a5f] p-6 text-white shadow-lg">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#c9a84c]/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#c9a84c]/5 rounded-full blur-[60px] translate-y-1/2 -translate-x-1/4" />
        <div className="relative flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[#c9a84c] text-sm font-medium tracking-wide">{getGreeting()}</p>
            <h1 className="text-2xl font-bold tracking-tight">
              {user?.name || "ユーザー"}さん
            </h1>
            <p className="text-white/50 text-sm mt-2">
              {getMotivation()}
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-white/40">{new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}</p>
              <p className="text-lg font-semibold text-[#c9a84c] mt-0.5">{new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}</p>
            </div>
            <div className="w-14 h-14 rounded-xl overflow-hidden ring-2 ring-[#c9a84c]/20 shadow-lg">
              <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663202284124/IjKHglVhNOqQVZHb.png" alt="UH" className="w-full h-full object-contain" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">ダッシュボード</h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            {user?.role === "admin" ? "全体の営業状況を確認できます" : `${user?.name || ""}さんの営業状況`}
          </p>
        </div>
        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Settings2 className="h-4 w-4" />
              カスタマイズ
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>ダッシュボードのカスタマイズ</DialogTitle>
            </DialogHeader>
            <div className="space-y-1 py-4 max-h-[60vh] overflow-y-auto">
              <p className="text-xs text-muted-foreground mb-3">ウィジェットの表示/非表示と順序を設定できます</p>
              {widgetOrder.map((widgetId, idx) => (
                <div
                  key={widgetId}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  draggable
                  onDragStart={() => setDraggedWidget(widgetId)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (draggedWidget && draggedWidget !== widgetId) {
                      setWidgetOrder(prev => {
                        const newOrder = [...prev];
                        const fromIdx = newOrder.indexOf(draggedWidget);
                        const toIdx = newOrder.indexOf(widgetId);
                        newOrder.splice(fromIdx, 1);
                        newOrder.splice(toIdx, 0, draggedWidget);
                        return newOrder;
                      });
                    }
                    setDraggedWidget(null);
                  }}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{WIDGET_LABELS[widgetId] || widgetId}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveWidget(widgetId, "up")} disabled={idx === 0}>
                      <span className="text-xs">↑</span>
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveWidget(widgetId, "down")} disabled={idx === widgetOrder.length - 1}>
                      <span className="text-xs">↓</span>
                    </Button>
                    <button onClick={() => toggleWidget(widgetId)} className="flex items-center">
                      {isVisible(widgetId) ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSettingsOpen(false)}>キャンセル</Button>
              <Button onClick={handleSaveSettings}>保存</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <SectionNav
        sections={widgetOrder.filter(w => isVisible(w)).map(id => ({
          id,
          label: WIDGET_LABELS[id] || id,
        }))}
      />

      {renderWidgets()}
    </div>
  );
}
