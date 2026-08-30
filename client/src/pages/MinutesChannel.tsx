import { useState, useEffect, useRef, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation } from "wouter";
import {
  Search,
  Hash,
  User,
  Paperclip,
  ThumbsUp,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  RefreshCw,
  FileText,
  Bell,
  ArrowUp,
  ExternalLink,
  Filter,
} from "lucide-react";

const PAGE_SIZE = 30;
const POLL_INTERVAL = 30000;

export default function MinutesChannel() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const [lastTotal, setLastTotal] = useState(0);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [posterFilter, setPosterFilter] = useState<string>("all");
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, navigate] = useLocation();

  // Debounce search
  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(0);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => setDebouncedSearch(value), 300);
  };

  // 議事録メッセージ取得（投稿者フィルター付き）
  const messagesQuery = trpc.slack.minutesMessages.useQuery({
    search: debouncedSearch || undefined,
    userName: posterFilter !== "all" ? posterFilter : undefined,
    limit: PAGE_SIZE,
    offset: currentPage * PAGE_SIZE,
  }, {
    refetchInterval: POLL_INTERVAL,
  });

  // 投稿者一覧取得
  const postersQuery = trpc.slack.minutesPosters.useQuery();

  // 顧客カルテ一覧取得（名前マッチング用）
  const customerFilesQuery = trpc.customerFile.list.useQuery();

  // ポーリングで新着メッセージ検知
  const countQuery = trpc.slack.minutesCount.useQuery(undefined, {
    refetchInterval: POLL_INTERVAL,
  });

  useEffect(() => {
    if (countQuery.data && lastTotal > 0 && countQuery.data.total > lastTotal) {
      setHasNewMessages(true);
    }
    if (countQuery.data) {
      setLastTotal(countQuery.data.total);
    }
  }, [countQuery.data, lastTotal]);

  const messages = messagesQuery.data?.messages || [];
  const totalMessages = messagesQuery.data?.total || 0;
  const totalPages = Math.ceil(totalMessages / PAGE_SIZE);
  const posters = postersQuery.data || [];
  const customerFiles = (customerFilesQuery.data && 'files' in customerFilesQuery.data ? customerFilesQuery.data.files : customerFilesQuery.data) || [];

  // 顧客名→カルテIDのマッピングを構築
  const customerNameToId = useMemo(() => {
    const map = new Map<string, number>();
    for (const cf of (customerFiles as any[])) {
      if (cf.customerName) {
        // 「様」なしの名前でもマッチするように
        const name = cf.customerName.replace(/様$/, "");
        map.set(name, cf.id);
        map.set(cf.customerName, cf.id);
      }
    }
    return map;
  }, [customerFiles]);

  const handleRefresh = () => {
    setHasNewMessages(false);
    setCurrentPage(0);
    messagesQuery.refetch();
    countQuery.refetch();
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatRelativeDate = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    if (minutes < 1) return "たった今";
    if (minutes < 60) return `${minutes}分前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}時間前`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "昨日";
    if (days < 7) return `${days}日前`;
    if (days < 30) return `${Math.floor(days / 7)}週間前`;
    return `${Math.floor(days / 30)}ヶ月前`;
  };

  const highlightText = (text: string, query: string) => {
    if (!query || !text) return text;
    try {
      const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
      return parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">{part}</mark>
        ) : part
      );
    } catch {
      return text;
    }
  };

  // メッセージからお客様名を抽出
  const extractCustomerName = (text: string | null) => {
    if (!text) return null;
    const match = text.match(/(?:No\.\d+[（(][^）)]+[）)])\s*(.+?)(?:様|$)/m);
    if (match) return match[1].replace(/様$/, "");
    const match2 = text.match(/(.+?)様/);
    if (match2 && match2[1].length < 10) return match2[1];
    return null;
  };

  // メッセージから件名を抽出
  const extractSubject = (text: string | null) => {
    if (!text) return null;
    const match = text.match(/件名[：:](.+?)(?:\n|$)/);
    return match ? match[1].trim() : null;
  };

  // 顧客名をクリックしてカルテに遷移
  const handleCustomerClick = (name: string) => {
    // 「様」付きと無しの両方で検索
    const id = customerNameToId.get(name) || customerNameToId.get(name + "様") || customerNameToId.get(name.replace(/様$/, ""));
    if (id) {
      navigate(`/customer-files/${id}`);
    }
  };

  // 顧客名がカルテに存在するかチェック
  const hasCustomerFile = (name: string | null) => {
    if (!name) return false;
    return customerNameToId.has(name) || customerNameToId.has(name + "様") || customerNameToId.has(name.replace(/様$/, ""));
  };

  // ユニーク投稿者数
  const uniquePosters = useMemo(() => {
    const names = new Set(messages.map(m => m.userName).filter(Boolean));
    return names.size;
  }, [messages]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-7 w-7 text-emerald-600" />
            議事録チャンネル
          </h1>
          <p className="text-muted-foreground mt-1 flex items-center gap-2">
            <Hash className="h-3.5 w-3.5" />
            05_議事録 — Slackからリアルタイム同期
            <Badge variant="outline" className="text-xs gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              自動更新中
            </Badge>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasNewMessages && (
            <Button
              variant="default"
              size="sm"
              onClick={handleRefresh}
              className="bg-emerald-600 hover:bg-emerald-700 gap-1 animate-bounce"
            >
              <Bell className="h-4 w-4" />
              新着あり
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={messagesQuery.isFetching}
            className="gap-1"
          >
            <RefreshCw className={`h-4 w-4 ${messagesQuery.isFetching ? "animate-spin" : ""}`} />
            更新
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">総メッセージ数</p>
                <p className="text-3xl font-bold text-emerald-600">{totalMessages}</p>
              </div>
              <FileText className="h-10 w-10 text-emerald-200" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">表示中の投稿者</p>
                <p className="text-3xl font-bold">{uniquePosters}名</p>
              </div>
              <User className="h-10 w-10 text-gray-200" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">最新投稿</p>
                <p className="text-lg font-semibold">
                  {messages[0] ? formatRelativeDate(messages[0].postedAt) : "-"}
                </p>
              </div>
              <Clock className="h-10 w-10 text-gray-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="議事録を検索（顧客名、件名、内容...）"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
              <Select value={posterFilter} onValueChange={(v) => { setPosterFilter(v); setCurrentPage(0); }}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="投稿者で絞り込み" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全ての投稿者</SelectItem>
                  {posters.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {posterFilter !== "all" && (
                <Button variant="ghost" size="sm" onClick={() => setPosterFilter("all")} className="text-xs">
                  クリア
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Messages */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              議事録一覧
              {totalMessages > 0 && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({totalMessages}件中 {currentPage * PAGE_SIZE + 1}-{Math.min((currentPage + 1) * PAGE_SIZE, totalMessages)}件)
                </span>
              )}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {messagesQuery.isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>議事録メッセージが見つかりません</p>
              <p className="text-xs mt-1">Slack同期が完了すると表示されます</p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => {
                const customerName = extractCustomerName(msg.messageText);
                const subject = extractSubject(msg.messageText);
                const isLinked = hasCustomerFile(customerName);
                return (
                  <div
                    key={msg.id}
                    className="group rounded-lg border p-4 hover:bg-accent/50 transition-colors hover:shadow-sm"
                  >
                    <div className="flex gap-3">
                      {/* Avatar */}
                      <div className="shrink-0 h-10 w-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-sm">
                        {msg.userName ? msg.userName.charAt(0) : <User className="h-5 w-5" />}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">
                            {msg.userName || "不明"}
                          </span>
                          {customerName && (
                            isLinked ? (
                              <Badge
                                variant="secondary"
                                className="text-xs px-1.5 py-0 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors gap-1"
                                onClick={() => handleCustomerClick(customerName)}
                              >
                                {customerName}様
                                <ExternalLink className="h-2.5 w-2.5" />
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                {customerName}様
                              </Badge>
                            )
                          )}
                          {subject && (
                            <Badge variant="outline" className="text-xs px-1.5 py-0">
                              {subject}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(msg.postedAt)}
                            <span className="hidden sm:inline">
                              ({formatRelativeDate(msg.postedAt)})
                            </span>
                          </span>
                        </div>

                        {/* Message text */}
                        {msg.messageText && (
                          <div className="mt-2 text-sm whitespace-pre-wrap break-words leading-relaxed max-h-[300px] overflow-y-auto">
                            {debouncedSearch
                              ? highlightText(msg.messageText, debouncedSearch)
                              : msg.messageText}
                          </div>
                        )}

                        {/* Metadata row */}
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          {msg.files && msg.files.length > 0 && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Paperclip className="h-3 w-3" />
                              {msg.files}
                            </span>
                          )}
                          {msg.reactions && msg.reactions.length > 0 && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <ThumbsUp className="h-3 w-3" />
                              {msg.reactions}
                            </span>
                          )}
                          {(msg.threadReplyCount ?? 0) > 0 && (
                            <span className="text-xs text-blue-600 flex items-center gap-1">
                              <MessageCircle className="h-3 w-3" />
                              {msg.threadReplyCount}件の返信
                            </span>
                          )}
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

      {/* Scroll to top */}
      {currentPage > 0 && (
        <div className="fixed bottom-6 right-6 z-50">
          <Button
            variant="outline"
            size="icon"
            className="rounded-full shadow-lg bg-background"
            onClick={() => {
              setCurrentPage(0);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
