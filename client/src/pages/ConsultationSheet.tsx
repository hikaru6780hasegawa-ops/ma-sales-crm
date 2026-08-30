import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation } from "wouter";
import {
  Search, User, Clock, RefreshCw, FileText, ChevronLeft, ChevronRight,
  Bell, ArrowUp, ExternalLink, Filter, MessageSquare, Hash,
  MapPin, Briefcase, Phone, Calendar, Home, Users, CreditCard,
  Building2, ChevronDown, ChevronUp, CheckCircle2, Circle, AlertCircle, Plus,
} from "lucide-react";
import { toast } from "sonner";

const PAGE_SIZE = 30;
const POLL_INTERVAL = 30000;

// ============ 案件相談シートパーサー ============
interface ConsultationData {
  規定内支給希望: string;
  氏名: string;
  フリガナ: string;
  生年月日: string;
  年齢: string;
  携帯番号: string;
  住所: string;
  勤務先名称: string;
  勤務先HP: string;
  勤務先住所: string;
  出向先名称: string;
  派遣先HP: string;
  派遣先住所: string;
  勤続年数: string;
  令和7年分年: string;
  令和6年分年: string;
  令和5年分年: string;
  借り入れ件数: string;
  借入残高: string;
  残価設定: string;
  現在の家賃: string;
  投資不動産の収支: string;
  戸建かマンション: string;
  家族構成: string;
  社会保険の有無: string;
  次回内見予定日: string;
  希望収支: string;
  備考: string;
  CIC: string;
  headerCustomerName: string;
  headerTanto: string;
  headerDouko: string;
}

function parseConsultationSheet(text: string | null): ConsultationData | null {
  if (!text) return null;
  if (!text.includes("案件相談シート") && !text.includes("《案件相談シート》")) return null;

  const extract = (label: string): string => {
    const bracketRegex = new RegExp(`[・]?${label}[【\\[]([^】\\]]*?)[】\\]]`, "s");
    const bracketMatch = text.match(bracketRegex);
    if (bracketMatch) return bracketMatch[1].trim();
    const inBracketRegex = new RegExp(`【${label}[\\s　]+(.+?)】`);
    const inBracketMatch = text.match(inBracketRegex);
    if (inBracketMatch) return inBracketMatch[1].trim();
    const altRegex = new RegExp(`${label}[：:]\\s*(.+?)(?:\\n|$)`);
    const altMatch = text.match(altRegex);
    if (altMatch) return altMatch[1].trim();
    return "";
  };

  const headerNameMatch = text.match(/(?:お客様名|顧客名)[：:]\s*(.+?)(?:\n|$)/);
  const headerTantoMatch = text.match(/担当[→：:]\s*(.+?)(?:\n|$)/);
  const headerDoukoMatch = text.match(/同行[→：:]\s*(.+?)(?:\n|$)/);
  const bikoMatch = text.match(/[～〜]備考[～〜]\s*\n?([\s\S]*?)(?=\n\s*CIC|\n\s*$)/);
  const cicMatch = text.match(/CIC[\s\S]*?(?:→|[：:])\s*(.+?)(?:\n|$)/);

  return {
    規定内支給希望: extract("規定内支給希望"),
    氏名: extract("氏名"),
    フリガナ: extract("フリガナ"),
    生年月日: extract("生年月日"),
    年齢: extract("年齢"),
    携帯番号: extract("携帯番号"),
    住所: extract("住所"),
    勤務先名称: extract("勤務先名称"),
    勤務先HP: extract("勤務先HP"),
    勤務先住所: extract("勤務先住所"),
    出向先名称: extract("出向先名称"),
    派遣先HP: extract("派遣先HP"),
    派遣先住所: extract("派遣先住所"),
    勤続年数: extract("勤続年数"),
    令和7年分年: extract("令和7年分年"),
    令和6年分年: extract("令和6年分年"),
    令和5年分年: extract("令和5年分年"),
    借り入れ件数: extract("借り入れ件数") || extract("借入件数"),
    借入残高: extract("借入残高"),
    残価設定: extract("残価設定の場合設定年月") || extract("残価設定"),
    現在の家賃: extract("現在の家賃\\(賃貸の場合\\)") || extract("現在の家賃"),
    投資不動産の収支: extract("現在の投資不動産の収支") || extract("投資不動産の収支"),
    戸建かマンション: extract("戸建かマンションかどちら") || extract("戸建かマンション"),
    家族構成: extract("家族構成"),
    社会保険の有無: extract("社会保険の有無"),
    次回内見予定日: extract("次回内見予定日"),
    希望収支: extract("希望収支"),
    備考: bikoMatch?.[1]?.trim() || "",
    CIC: cicMatch?.[1]?.trim() || "",
    headerCustomerName: headerNameMatch?.[1]?.trim() || "",
    headerTanto: headerTantoMatch?.[1]?.trim() || "",
    headerDouko: headerDoukoMatch?.[1]?.trim() || "",
  };
}

// ============ サブコンポーネント ============

function StatusBadge({ status, onToggle, isPending }: {
  status: string | null; onToggle: () => void; isPending: boolean;
}) {
  const isDone = status === "done";
  return (
    <Button
      variant="ghost" size="sm"
      className={`gap-1 text-xs h-7 px-2 ${isDone
        ? "text-green-600 hover:text-green-700 hover:bg-green-50"
        : "text-amber-600 hover:text-amber-700 hover:bg-amber-50"
      }`}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      disabled={isPending}
    >
      {isDone ? (<><CheckCircle2 className="h-3.5 w-3.5" />対応済み</>) : (<><Circle className="h-3.5 w-3.5" />未対応</>)}
    </Button>
  );
}

function NumberBadge({ minutesNo, customerName, onAssign, isAssigning }: {
  minutesNo: { number: number; customerName: string } | null;
  customerName: string;
  onAssign: (name: string) => void;
  isAssigning: boolean;
}) {
  if (minutesNo) {
    return (
      <Badge variant="outline" className="text-xs gap-0.5 border-indigo-300 text-indigo-700 bg-indigo-50">
        <Hash className="h-2.5 w-2.5" />
        No.{minutesNo.number}
      </Badge>
    );
  }
  if (!customerName) return null;
  return (
    <Button
      variant="ghost" size="sm"
      className="gap-0.5 text-xs h-6 px-1.5 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50"
      onClick={(e) => { e.stopPropagation(); onAssign(customerName); }}
      disabled={isAssigning}
    >
      <Plus className="h-3 w-3" />
      No.付与
    </Button>
  );
}

function InfoItem({ icon, label, value, colSpan }: {
  icon: React.ReactNode; label: string; value: string; colSpan?: boolean;
}) {
  if (!value) return null;
  return (
    <div className={`flex items-start gap-1.5 ${colSpan ? "col-span-2" : ""}`}>
      <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-medium truncate">{value}</p>
      </div>
    </div>
  );
}

function DetailRow({ label, value, isLink }: { label: string; value: string; isLink?: boolean; }) {
  if (!value) return null;
  const urlMatch = isLink ? value.match(/https?:\/\/[^\s|>】\]]+/) : null;
  const displayUrl = urlMatch ? urlMatch[0] : value;
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-xs text-muted-foreground shrink-0 w-24">{label}</span>
      {isLink && urlMatch ? (
        <a href={displayUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline truncate text-xs">{displayUrl}</a>
      ) : (
        <span className="truncate">{value}</span>
      )}
    </div>
  );
}

// ============ 構造化カード ============
function ConsultationCard({ data, msg, matchedFile, minutesNo, navigate, onStatusToggle, isStatusPending, onAssignNo, isAssigning }: {
  data: ConsultationData; msg: any; matchedFile: any;
  minutesNo: { number: number; customerName: string } | null;
  navigate: (path: string) => void;
  onStatusToggle: (messageId: number, newStatus: "pending" | "done") => void;
  isStatusPending: boolean;
  onAssignNo: (name: string) => void;
  isAssigning: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const displayName = data.氏名 || data.headerCustomerName || "不明";
  const dateStr = msg.postedAt
    ? new Date(msg.postedAt).toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "";

  const incomeLines: string[] = [];
  if (data.令和7年分年) incomeLines.push(`R7: ${data.令和7年分年}`);
  if (data.令和6年分年) incomeLines.push(`R6: ${data.令和6年分年}`);
  if (data.令和5年分年) incomeLines.push(`R5: ${data.令和5年分年}`);

  const currentStatus = msg.consultationStatus || "pending";

  return (
    <Card className={`overflow-hidden hover:shadow-md transition-shadow ${currentStatus === "done" ? "border-green-200 bg-green-50/30 dark:bg-green-950/10" : ""}`}>
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 px-4 py-3 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full ${currentStatus === "done" ? "bg-green-500" : "bg-blue-500"} text-white flex items-center justify-center font-bold text-sm shrink-0`}>
              {displayName.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-base">{displayName}</h3>
                <NumberBadge minutesNo={minutesNo} customerName={displayName} onAssign={onAssignNo} isAssigning={isAssigning} />
                {matchedFile && (
                  <Badge variant="default" className="text-xs bg-blue-500 hover:bg-blue-600 cursor-pointer gap-0.5"
                    onClick={() => navigate(`/customer-files/${matchedFile.id}`)}>
                    カルテ<ExternalLink className="h-2.5 w-2.5" />
                  </Badge>
                )}
                {data.規定内支給希望 && (
                  <Badge variant={data.規定内支給希望.includes("有") ? "default" : "secondary"} className="text-xs">
                    規定内支給: {data.規定内支給希望}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                {msg.userName && (<span className="flex items-center gap-1"><User className="h-3 w-3" />{msg.userName}</span>)}
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{dateStr}</span>
              </div>
            </div>
          </div>
          <StatusBadge status={currentStatus} onToggle={() => onStatusToggle(msg.id, currentStatus === "done" ? "pending" : "done")} isPending={isStatusPending} />
        </div>
      </div>

      <CardContent className="pt-3 pb-2">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <InfoItem icon={<Calendar className="h-3.5 w-3.5" />} label="生年月日" value={data.生年月日} />
          <InfoItem icon={<User className="h-3.5 w-3.5" />} label="年齢" value={data.年齢} />
          <InfoItem icon={<Phone className="h-3.5 w-3.5" />} label="携帯番号" value={data.携帯番号} />
          <InfoItem icon={<Users className="h-3.5 w-3.5" />} label="家族構成" value={data.家族構成} />
          <InfoItem icon={<MapPin className="h-3.5 w-3.5" />} label="住所" value={data.住所} colSpan />
          <InfoItem icon={<Building2 className="h-3.5 w-3.5" />} label="勤務先" value={data.勤務先名称} />
          <InfoItem icon={<Briefcase className="h-3.5 w-3.5" />} label="勤続年数" value={data.勤続年数} />
        </div>

        <Button variant="ghost" size="sm" className="w-full mt-2 text-xs text-muted-foreground hover:text-foreground gap-1" onClick={() => setExpanded(!expanded)}>
          {expanded ? (<><ChevronUp className="h-3.5 w-3.5" />閉じる</>) : (<><ChevronDown className="h-3.5 w-3.5" />詳細を表示</>)}
        </Button>

        {expanded && (
          <div className="mt-2 pt-3 border-t space-y-3 text-sm">
            {incomeLines.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1"><CreditCard className="h-3 w-3" />年収情報</p>
                <div className="flex flex-wrap gap-2">
                  {incomeLines.map((line) => (<Badge key={line} variant="outline" className="text-xs">{line}</Badge>))}
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <DetailRow label="借り入れ件数" value={data.借り入れ件数} />
              <DetailRow label="借入残高" value={data.借入残高} />
              <DetailRow label="残価設定" value={data.残価設定} />
              <DetailRow label="現在の家賃" value={data.現在の家賃} />
              <DetailRow label="投資不動産" value={data.投資不動産の収支} />
              <DetailRow label="戸建/マンション" value={data.戸建かマンション} />
              <DetailRow label="社会保険" value={data.社会保険の有無} />
              <DetailRow label="内見予定日" value={data.次回内見予定日} />
              <DetailRow label="希望収支" value={data.希望収支} />
            </div>
            {(data.勤務先HP || data.勤務先住所 || data.出向先名称) && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground">勤務先詳細</p>
                <DetailRow label="勤務先HP" value={data.勤務先HP} isLink />
                <DetailRow label="勤務先住所" value={data.勤務先住所} />
                {data.出向先名称 && <DetailRow label="出向先" value={data.出向先名称} />}
                {data.派遣先HP && <DetailRow label="派遣先HP" value={data.派遣先HP} isLink />}
                {data.派遣先住所 && <DetailRow label="派遣先住所" value={data.派遣先住所} />}
              </div>
            )}
            {data.備考 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">備考</p>
                <p className="text-sm bg-muted/50 rounded-lg p-2.5 whitespace-pre-wrap leading-relaxed">{data.備考}</p>
              </div>
            )}
            {data.CIC && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">CIC</p>
                <p className="text-sm bg-muted/50 rounded-lg p-2.5">{data.CIC}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============ 通常メッセージカード ============
function NormalMessageCard({ msg, matchedFile, minutesNo, navigate, onStatusToggle, isStatusPending, onAssignNo, isAssigning }: {
  msg: any; matchedFile: any;
  minutesNo: { number: number; customerName: string } | null;
  navigate: (path: string) => void;
  onStatusToggle: (messageId: number, newStatus: "pending" | "done") => void;
  isStatusPending: boolean;
  onAssignNo: (name: string) => void;
  isAssigning: boolean;
}) {
  const text = msg.messageText || "";
  const nameMatch = text.match(/(?:お客様名|顧客名|お客様)[：:]\s*(.+?)(?:\n|$)/);
  const tantoMatch = text.match(/(?:担当)[：→:]\s*(.+?)(?:\n|$)/);
  const customerName = nameMatch?.[1]?.trim() || "";
  const tantoName = tantoMatch?.[1]?.trim() || "";
  const preview = text.substring(0, 300).replace(/\n/g, " ");
  const dateStr = msg.postedAt
    ? new Date(msg.postedAt).toLocaleDateString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "";
  const currentStatus = msg.consultationStatus || "pending";

  return (
    <div className={`border rounded-lg p-4 hover:bg-muted/30 transition-colors ${currentStatus === "done" ? "border-green-200 bg-green-50/30 dark:bg-green-950/10" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
            {customerName && (
              <Badge variant="default"
                className={`text-xs ${matchedFile ? "bg-blue-500 hover:bg-blue-600 cursor-pointer" : "bg-blue-500"}`}
                onClick={() => matchedFile && navigate(`/customer-files/${matchedFile.id}`)}>
                {customerName}{matchedFile && <ExternalLink className="h-2.5 w-2.5 ml-1" />}
              </Badge>
            )}
            <NumberBadge minutesNo={minutesNo} customerName={customerName} onAssign={onAssignNo} isAssigning={isAssigning} />
            {tantoName && (<Badge variant="outline" className="text-xs gap-0.5"><User className="h-2.5 w-2.5" />{tantoName}</Badge>)}
            {msg.files && msg.files.trim() && (<Badge variant="secondary" className="text-xs gap-0.5"><FileText className="h-2.5 w-2.5" />添付あり</Badge>)}
          </div>
          <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">{preview}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <StatusBadge status={currentStatus} onToggle={() => onStatusToggle(msg.id, currentStatus === "done" ? "pending" : "done")} isPending={isStatusPending} />
          <div className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" />{dateStr}</div>
        </div>
      </div>
      {msg.userName && (
        <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          <User className="h-3 w-3" />投稿: {msg.userName}
          {msg.reactions && msg.reactions.trim() && (<span className="ml-2 text-xs">{msg.reactions}</span>)}
        </div>
      )}
    </div>
  );
}

// ============ メインコンポーネント ============
export default function ConsultationSheet() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const [lastTotal, setLastTotal] = useState(0);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [posterFilter, setPosterFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(0);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => setDebouncedSearch(value), 300);
  };

  // データ取得
  const messagesQuery = trpc.slack.consultationMessages.useQuery({
    search: debouncedSearch || undefined,
    userName: posterFilter !== "all" ? posterFilter : undefined,
    limit: PAGE_SIZE,
    offset: currentPage * PAGE_SIZE,
  }, { refetchInterval: POLL_INTERVAL });

  const postersQuery = trpc.slack.consultationPosters.useQuery();
  const customerFilesQuery = trpc.customerFile.list.useQuery();
  const summaryQuery = trpc.slack.consultationSummary.useQuery(undefined, { refetchInterval: POLL_INTERVAL });
  const countQuery = trpc.slack.consultationCount.useQuery(undefined, { refetchInterval: POLL_INTERVAL });

  // No.管理データ取得
  const minutesNumbersQuery = trpc.minutesNumber.list.useQuery();

  const syncMutation = trpc.slack.syncConsultation.useMutation({
    onSuccess: () => {
      toast.success("案件相談シートを同期しました");
      messagesQuery.refetch();
      countQuery.refetch();
      summaryQuery.refetch();
    },
    onError: () => toast.error("同期に失敗しました"),
  });

  // ステータス更新
  const updateStatusMutation = trpc.slack.updateConsultationStatus.useMutation({
    onMutate: async ({ messageId, status }) => {
      await utils.slack.consultationMessages.cancel();
      const prevData = utils.slack.consultationMessages.getData({
        search: debouncedSearch || undefined,
        userName: posterFilter !== "all" ? posterFilter : undefined,
        limit: PAGE_SIZE, offset: currentPage * PAGE_SIZE,
      });
      if (prevData) {
        utils.slack.consultationMessages.setData(
          { search: debouncedSearch || undefined, userName: posterFilter !== "all" ? posterFilter : undefined, limit: PAGE_SIZE, offset: currentPage * PAGE_SIZE },
          { ...prevData, messages: prevData.messages.map((m: any) => m.id === messageId ? { ...m, consultationStatus: status } : m) }
        );
      }
      return { prevData };
    },
    onError: (_err, _vars, context) => {
      if (context?.prevData) {
        utils.slack.consultationMessages.setData(
          { search: debouncedSearch || undefined, userName: posterFilter !== "all" ? posterFilter : undefined, limit: PAGE_SIZE, offset: currentPage * PAGE_SIZE },
          context.prevData
        );
      }
      toast.error("ステータス更新に失敗しました");
    },
    onSettled: () => {
      utils.slack.consultationMessages.invalidate();
      utils.slack.consultationSummary.invalidate();
    },
  });

  // No.自動付与
  const createNoMutation = trpc.minutesNumber.create.useMutation({
    onSuccess: (data) => {
      toast.success(`No.${data?.number} を ${data?.customerName} に付与しました`);
      utils.minutesNumber.list.invalidate();
    },
    onError: () => toast.error("No.付与に失敗しました"),
  });

  const handleStatusToggle = useCallback((messageId: number, newStatus: "pending" | "done") => {
    updateStatusMutation.mutate({ messageId, status: newStatus });
  }, [updateStatusMutation]);

  const handleAssignNo = useCallback((customerName: string) => {
    const cleanName = customerName.replace(/\s*様\s*$/, "").replace(/\(.*?\)/, "").trim();
    createNoMutation.mutate({ customerName: cleanName });
  }, [createNoMutation]);

  useEffect(() => {
    if (countQuery.data && lastTotal > 0 && countQuery.data.total > lastTotal) {
      setHasNewMessages(true);
    }
    if (countQuery.data) setLastTotal(countQuery.data.total);
  }, [countQuery.data, lastTotal]);

  const messages = messagesQuery.data?.messages || [];
  const totalMessages = messagesQuery.data?.total || 0;
  const totalPages = Math.ceil(totalMessages / PAGE_SIZE);
  const posters = postersQuery.data || [];
  const minutesNumbers = minutesNumbersQuery.data || [];

  // ステータスフィルター
  const filteredMessages = useMemo(() => {
    if (statusFilter === "all") return messages;
    return messages.filter((m: any) => (m.consultationStatus || "pending") === statusFilter);
  }, [messages, statusFilter]);

  const customerFiles = customerFilesQuery.data?.files || [];

  // 名前正規化ヘルパー
  const normalizeName = (s: string) => s.replace(/[\s　]+/g, "").replace(/様$/g, "").replace(/\(.*?\)/, "");

  // 顧客カルテマッチング
  const findMatchingCustomerFile = useCallback((text: string) => {
    if (!text) return null;
    for (const cf of customerFiles) {
      const name = cf.customerName?.replace(/\s*様\s*$/, "").trim();
      if (name && name.length >= 2 && text.includes(name)) return cf;
    }
    return null;
  }, [customerFiles]);

  // No.マッチング（名前ベース）
  const findMinutesNumber = useCallback((customerName: string) => {
    if (!customerName || minutesNumbers.length === 0) return null;
    const normalized = normalizeName(customerName);
    // 完全一致
    const exact = minutesNumbers.find((mn: any) => normalizeName(mn.customerName) === normalized);
    if (exact) return exact;
    // 姓マッチ（2文字以上）
    const surname = normalized.length >= 2 ? normalized.slice(0, 2) : normalized;
    const partial = minutesNumbers.filter((mn: any) => normalizeName(mn.customerName).startsWith(surname));
    if (partial.length === 1) return partial[0];
    return null;
  }, [minutesNumbers]);

  // メッセージからお客様名を抽出
  const getCustomerNameFromMsg = (msg: any): string => {
    const text = msg.messageText || "";
    const parsed = parseConsultationSheet(text);
    if (parsed?.氏名) return parsed.氏名;
    const nameMatch = text.match(/(?:お客様名|顧客名|お客様)[：:]\s*(.+?)(?:\n|$)/);
    return nameMatch?.[1]?.trim() || "";
  };

  const summary = summaryQuery.data;

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-500" />案件相談シート
          </h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            Slackの #04_案件相談シート チャンネルと連動（30秒自動更新）
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasNewMessages && (
            <Button variant="outline" size="sm" className="gap-1 text-blue-600 border-blue-200 hover:bg-blue-50"
              onClick={() => { setCurrentPage(0); setHasNewMessages(false); messagesQuery.refetch(); }}>
              <Bell className="h-3.5 w-3.5" />新着あり
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1"
            onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
            <RefreshCw className={`h-3.5 w-3.5 ${syncMutation.isPending ? "animate-spin" : ""}`} />
            {syncMutation.isPending ? "同期中..." : "同期"}
          </Button>
        </div>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center"><MessageSquare className="h-4 w-4 text-blue-500" /></div>
            <div><p className="text-xs text-muted-foreground">総件数</p><p className="text-lg font-bold">{summary?.total ?? countQuery.data?.total ?? 0}</p></div>
          </div>
        </Card>
        <Card className={`p-3 cursor-pointer transition-all ${statusFilter === "pending" ? "ring-2 ring-amber-400" : "hover:bg-muted/50"}`}
          onClick={() => setStatusFilter(statusFilter === "pending" ? "all" : "pending")}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center"><AlertCircle className="h-4 w-4 text-amber-500" /></div>
            <div><p className="text-xs text-muted-foreground">未対応</p><p className="text-lg font-bold text-amber-600">{summary?.pending ?? 0}</p></div>
          </div>
        </Card>
        <Card className={`p-3 cursor-pointer transition-all ${statusFilter === "done" ? "ring-2 ring-green-400" : "hover:bg-muted/50"}`}
          onClick={() => setStatusFilter(statusFilter === "done" ? "all" : "done")}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center"><CheckCircle2 className="h-4 w-4 text-green-500" /></div>
            <div><p className="text-xs text-muted-foreground">対応済み</p><p className="text-lg font-bold text-green-600">{summary?.done ?? 0}</p></div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center"><User className="h-4 w-4 text-purple-500" /></div>
            <div><p className="text-xs text-muted-foreground">投稿者数</p><p className="text-lg font-bold">{posters.length}</p></div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center"><Hash className="h-4 w-4 text-indigo-500" /></div>
            <div><p className="text-xs text-muted-foreground">No.登録数</p><p className="text-lg font-bold">{minutesNumbers.length}</p></div>
          </div>
        </Card>
      </div>

      {/* 検索・フィルター */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="お客様名・担当者・キーワードで検索..." value={searchQuery} onChange={(e) => handleSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
              <Select value={posterFilter} onValueChange={(v) => { setPosterFilter(v); setCurrentPage(0); }}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="投稿者で絞り込み" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全投稿者</SelectItem>
                  {posters.map((p: any) => (<SelectItem key={p.userName} value={p.userName}>{p.userName} ({p.count}件)</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* メッセージ一覧 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold flex items-center gap-2">
            案件一覧
            {totalMessages > 0 && (<Badge variant="secondary" className="text-xs">{totalMessages}件</Badge>)}
          </h3>
          {totalPages > 1 && (
            <p className="text-xs text-muted-foreground">
              {currentPage * PAGE_SIZE + 1}-{Math.min((currentPage + 1) * PAGE_SIZE, totalMessages)} / {totalMessages}件
            </p>
          )}
        </div>

        {messagesQuery.isLoading ? (
          <div className="space-y-3">{[...Array(5)].map((_, i) => (<Skeleton key={i} className="h-32 w-full" />))}</div>
        ) : filteredMessages.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  {debouncedSearch || posterFilter !== "all" || statusFilter !== "all"
                    ? "条件に一致する案件相談シートが見つかりません"
                    : "案件相談シートがまだありません"}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredMessages.map((msg: any) => {
              const parsed = parseConsultationSheet(msg.messageText);
              const matchedFile = findMatchingCustomerFile(msg.messageText || "");
              const customerName = getCustomerNameFromMsg(msg);
              const minutesNo = findMinutesNumber(customerName);

              if (parsed && parsed.氏名) {
                return (
                  <ConsultationCard key={msg.id} data={parsed} msg={msg} matchedFile={matchedFile}
                    minutesNo={minutesNo} navigate={navigate}
                    onStatusToggle={handleStatusToggle} isStatusPending={updateStatusMutation.isPending}
                    onAssignNo={handleAssignNo} isAssigning={createNoMutation.isPending} />
                );
              }

              return (
                <NormalMessageCard key={msg.id} msg={msg} matchedFile={matchedFile}
                  minutesNo={minutesNo} navigate={navigate}
                  onStatusToggle={handleStatusToggle} isStatusPending={updateStatusMutation.isPending}
                  onAssignNo={handleAssignNo} isAssigning={createNoMutation.isPending} />
              );
            })}
          </div>
        )}

        {/* ページネーション */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <Button variant="outline" size="sm" className="gap-1"
              onClick={() => setCurrentPage(Math.max(0, currentPage - 1))} disabled={currentPage === 0}>
              <ChevronLeft className="h-4 w-4" />前へ
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 7) pageNum = i;
                else if (currentPage < 3) pageNum = i;
                else if (currentPage > totalPages - 4) pageNum = totalPages - 7 + i;
                else pageNum = currentPage - 3 + i;
                return (
                  <Button key={pageNum} variant={currentPage === pageNum ? "default" : "ghost"}
                    size="sm" className="h-8 w-8 p-0 text-xs" onClick={() => setCurrentPage(pageNum)}>
                    {pageNum + 1}
                  </Button>
                );
              })}
            </div>
            <Button variant="outline" size="sm" className="gap-1"
              onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))} disabled={currentPage >= totalPages - 1}>
              次へ<ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <Button variant="outline" size="icon" className="fixed bottom-6 right-6 h-10 w-10 rounded-full shadow-lg z-50"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
        <ArrowUp className="h-4 w-4" />
      </Button>
    </div>
  );
}
