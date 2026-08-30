import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileSpreadsheet,
  RefreshCw,
  Search,
  ExternalLink,
  Users,
  ClipboardList,
  ArrowUpDown,
  Filter,
} from "lucide-react";
import SectionNav from "@/components/SectionNav";

const SPREADSHEET_URL = "https://docs.google.com/spreadsheets/d/1wxesoezXlnqWDzm45sk6tg9Ol08BpWWyMd9nroZFHw8/edit";

// ステータスに応じたバッジカラー
function getStatusBadge(status: string) {
  if (!status) return null;
  const s = status.trim();
  if (s === "リフォーム") return <Badge className="bg-purple-100 text-purple-800 border-purple-200">{s}</Badge>;
  if (s.includes("契約") || s.includes("本申込")) return <Badge className="bg-blue-100 text-blue-800 border-blue-200">{s}</Badge>;
  if (s === "申込") return <Badge className="bg-green-100 text-green-800 border-green-200">{s}</Badge>;
  if (s === "金消") return <Badge className="bg-amber-100 text-amber-800 border-amber-200">{s}</Badge>;
  if (s === "飛び") return <Badge className="bg-red-100 text-red-800 border-red-200">{s}</Badge>;
  if (s === "キャンセル") return <Badge className="bg-gray-100 text-gray-800 border-gray-200">{s}</Badge>;
  if (s.includes("期限確認")) return <Badge className="bg-orange-100 text-orange-800 border-orange-200">{s}</Badge>;
  if (s === "緑") return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">{s}</Badge>;
  return <Badge variant="outline">{s}</Badge>;
}

// 担当者バッジ
function getAssigneeBadge(name: string) {
  if (!name) return <span className="text-muted-foreground text-xs">—</span>;
  const colors: Record<string, string> = {
    "酒井": "bg-sky-100 text-sky-800",
    "坂本": "bg-violet-100 text-violet-800",
    "犬塚": "bg-amber-100 text-amber-800",
    "太田": "bg-emerald-100 text-emerald-800",
    "藪": "bg-rose-100 text-rose-800",
    "嶺田": "bg-indigo-100 text-indigo-800",
    "上田": "bg-teal-100 text-teal-800",
    "柏尾": "bg-orange-100 text-orange-800",
    "三浦": "bg-cyan-100 text-cyan-800",
    "菊池": "bg-pink-100 text-pink-800",
    "武田": "bg-lime-100 text-lime-800",
  };
  const color = colors[name.trim()] || "bg-gray-100 text-gray-800";
  return <Badge className={`${color} text-xs`}>{name.trim()}</Badge>;
}

export default function MeetingSheet() {
  const [activeTab, setActiveTab] = useState("consultation");
  const [searchQuery, setSearchQuery] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [sortField, setSortField] = useState<string>("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const consultationQuery = trpc.meetingSheet.getConsultationSheet.useQuery(undefined, {
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const caseProgressQuery = trpc.meetingSheet.getCaseProgressSheet.useQuery(undefined, {
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const handleRefresh = () => {
    consultationQuery.refetch();
    caseProgressQuery.refetch();
  };

  // --- 相談シート受付後 ---
  const consultationData = useMemo(() => {
    let data = consultationQuery.data || [];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter((row) =>
        Object.values(row).some((v) => v.toLowerCase().includes(q))
      );
    }
    if (assigneeFilter) {
      data = data.filter((row) => (row["担当"] || "").trim() === assigneeFilter);
    }
    return data;
  }, [consultationQuery.data, searchQuery, assigneeFilter]);

  // --- 案件進行一覧 ---
  const caseProgressData = useMemo(() => {
    let data = caseProgressQuery.data || [];
    // ヘッダー行のクリーンアップ（初訪日に余計なテキストが含まれる場合がある）
    data = data.map((row) => {
      const cleaned: Record<string, string> = {};
      Object.entries(row).forEach(([key, val]) => {
        // ヘッダーに長いスペースが含まれる場合はクリーンアップ
        const cleanKey = key.replace(/\s{2,}/g, " ").trim();
        cleaned[cleanKey] = val;
      });
      return cleaned;
    });
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter((row) =>
        Object.values(row).some((v) => v.toLowerCase().includes(q))
      );
    }
    if (assigneeFilter) {
      data = data.filter((row) => {
        const assignee = (row["担当"] || row["担当 "] || "").trim();
        return assignee === assigneeFilter;
      });
    }
    return data;
  }, [caseProgressQuery.data, searchQuery, assigneeFilter]);

  // 担当者リスト（両シート統合）
  const allAssignees = useMemo(() => {
    const set = new Set<string>();
    (consultationQuery.data || []).forEach((row) => {
      const a = (row["担当"] || "").trim();
      if (a) set.add(a);
    });
    (caseProgressQuery.data || []).forEach((row) => {
      const a = (row["担当"] || row["担当 "] || "").trim();
      if (a && a !== "退職者") set.add(a);
    });
    return Array.from(set).sort();
  }, [consultationQuery.data, caseProgressQuery.data]);

  const isLoading = consultationQuery.isLoading || caseProgressQuery.isLoading;

  return (
    <div className="space-y-6">
      <SectionNav
        sections={[
          { id: "header", label: "概要" },
          { id: "summary", label: "サマリー" },
          { id: "filter", label: "フィルター" },
          { id: "data", label: "データ一覧" },
        ]}
      />

      {/* ヘッダー */}
      <div data-section="header" className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileSpreadsheet className="h-7 w-7 text-primary" />
            会議シート
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Googleスプレッドシートと連動 — リアルタイムで案件状況を確認
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />
            更新
          </Button>
          <a href={SPREADSHEET_URL} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm">
              <ExternalLink className="h-4 w-4 mr-1" />
              スプレッドシートを開く
            </Button>
          </a>
        </div>
      </div>

      {/* サマリーカード */}
      <div data-section="summary" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">相談シート</span>
            </div>
            <p className="text-2xl font-bold mt-1">{consultationData.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">案件進行</span>
            </div>
            <p className="text-2xl font-bold mt-1">{caseProgressData.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-orange-500" />
              <span className="text-xs text-muted-foreground">担当者数</span>
            </div>
            <p className="text-2xl font-bold mt-1">{allAssignees.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4 text-purple-500" />
              <span className="text-xs text-muted-foreground">合計件数</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {consultationData.length + caseProgressData.length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* フィルター */}
      <div data-section="filter" className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="お客様名、担当者、ステータスで検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">全担当者</option>
          {allAssignees.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      {/* タブ */}
      <div data-section="data">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="consultation" className="flex-1 sm:flex-initial">
            相談シート受付後
            <Badge variant="secondary" className="ml-2 text-xs">
              {consultationData.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="caseProgress" className="flex-1 sm:flex-initial">
            案件進行一覧
            <Badge variant="secondary" className="ml-2 text-xs">
              {caseProgressData.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* 相談シート受付後 */}
        <TabsContent value="consultation" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-blue-500" />
                相談シート受付後
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {consultationQuery.isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">読み込み中...</span>
                </div>
              ) : consultationData.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  データがありません
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left px-4 py-3 font-medium whitespace-nowrap">担当</th>
                        <th className="text-left px-4 py-3 font-medium whitespace-nowrap">ステータス</th>
                        <th className="text-left px-4 py-3 font-medium whitespace-nowrap">お客様名</th>
                        <th className="text-left px-4 py-3 font-medium whitespace-nowrap">年齢</th>
                        <th className="text-left px-4 py-3 font-medium whitespace-nowrap">年収</th>
                        <th className="text-left px-4 py-3 font-medium whitespace-nowrap">借入総額</th>
                        <th className="text-left px-4 py-3 font-medium whitespace-nowrap">借入先詳細</th>
                        <th className="text-left px-4 py-3 font-medium whitespace-nowrap">金融機関</th>
                        <th className="text-left px-4 py-3 font-medium whitespace-nowrap">購入物件</th>
                        <th className="text-left px-4 py-3 font-medium whitespace-nowrap">営業部タスク</th>
                        <th className="text-left px-4 py-3 font-medium whitespace-nowrap min-w-[200px]">業務部タスク</th>
                      </tr>
                    </thead>
                    <tbody>
                      {consultationData.map((row, i) => {
                        const name = row["お客様名【氏名/カナ】"] || "";
                        const status = row["*ステータス"] || "";
                        const assignee = row["担当"] || "";
                        return (
                          <tr key={i} className="border-b hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3">{getAssigneeBadge(assignee)}</td>
                            <td className="px-4 py-3">{getStatusBadge(status)}</td>
                            <td className="px-4 py-3 font-medium whitespace-nowrap">{name || "—"}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{row["年齢"] || "—"}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{row["年収"] || "—"}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{row["①借入総額"] || "—"}</td>
                            <td className="px-4 py-3 text-xs max-w-[150px] truncate" title={row["①借入先詳細"] || ""}>
                              {row["①借入先詳細"] || "—"}
                            </td>
                            <td className="px-4 py-3 text-xs max-w-[150px] truncate" title={row["金融機関"] || ""}>
                              {row["金融機関"] || "—"}
                            </td>
                            <td className="px-4 py-3 text-xs max-w-[150px] truncate" title={row["購入物件_住所"] || ""}>
                              {row["購入物件_住所"] || "—"}
                            </td>
                            <td className="px-4 py-3 text-xs max-w-[150px]">
                              <div className="whitespace-pre-line line-clamp-3" title={row["営業部タスク"] || ""}>
                                {row["営業部タスク"] || "—"}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs max-w-[200px]">
                              <div className="whitespace-pre-line line-clamp-3" title={row["業務部タスク"] || ""}>
                                {row["業務部タスク"] || "—"}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 案件進行一覧 */}
        <TabsContent value="caseProgress" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-5 w-5 text-green-500" />
                案件進行一覧（シート15）
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {caseProgressQuery.isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">読み込み中...</span>
                </div>
              ) : caseProgressData.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  データがありません
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left px-4 py-3 font-medium whitespace-nowrap">初訪日</th>
                        <th className="text-left px-4 py-3 font-medium whitespace-nowrap">ステータス</th>
                        <th className="text-left px-4 py-3 font-medium whitespace-nowrap">担当</th>
                        <th className="text-left px-4 py-3 font-medium whitespace-nowrap">お客様名</th>
                        <th className="text-left px-4 py-3 font-medium whitespace-nowrap">年齢</th>
                        <th className="text-left px-4 py-3 font-medium whitespace-nowrap">住所</th>
                        <th className="text-left px-4 py-3 font-medium whitespace-nowrap">年収</th>
                        <th className="text-left px-4 py-3 font-medium whitespace-nowrap">借入総額</th>
                        <th className="text-left px-4 py-3 font-medium whitespace-nowrap">次回</th>
                        <th className="text-left px-4 py-3 font-medium whitespace-nowrap min-w-[200px]">備考</th>
                      </tr>
                    </thead>
                    <tbody>
                      {caseProgressData.map((row, i) => {
                        // キー名のクリーンアップ（スプレッドシートのヘッダーに余分なスペースが含まれる）
                        const getVal = (keys: string[]) => {
                          for (const k of keys) {
                            const found = Object.entries(row).find(([key]) => key.includes(k));
                            if (found && found[1]) return found[1];
                          }
                          return "";
                        };
                        const firstVisit = getVal(["初訪日"]);
                        const status = getVal(["*ステータス", "ステータス"]);
                        const assignee = getVal(["担当"]);
                        const customerName = getVal(["お客様名"]);
                        const age = getVal(["年齢"]);
                        const address = getVal(["住所"]);
                        const income = getVal(["年収"]);
                        const debt = getVal(["借入総額"]);
                        const nextAction = getVal(["次回"]);
                        const notes = getVal(["備考"]);

                        // お客様名がない行はスキップ（区切り行）
                        if (!customerName && !assignee) return null;

                        return (
                          <tr key={i} className="border-b hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap">{firstVisit || "—"}</td>
                            <td className="px-4 py-3">{getStatusBadge(status)}</td>
                            <td className="px-4 py-3">{getAssigneeBadge(assignee)}</td>
                            <td className="px-4 py-3 font-medium whitespace-nowrap">{customerName || "—"}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{age || "—"}</td>
                            <td className="px-4 py-3 text-xs max-w-[150px] truncate" title={address}>
                              {address || "—"}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">{income || "—"}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{debt || "—"}</td>
                            <td className="px-4 py-3 text-xs max-w-[180px]">
                              <div className="whitespace-pre-line line-clamp-3" title={nextAction}>
                                {nextAction || "—"}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs max-w-[200px]">
                              <div className="whitespace-pre-line line-clamp-3" title={notes}>
                                {notes || "—"}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}
