import { useState, useMemo } from "react";
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
  MessageSquare,
  Search,
  Hash,
  User,
  Paperclip,
  ThumbsUp,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
} from "lucide-react";

const PAGE_SIZE = 30;

export default function SlackMessages() {
  const [selectedChannel, setSelectedChannel] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(0);

  // Debounce search
  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(0);
    // Simple debounce
    setTimeout(() => setDebouncedSearch(value), 300);
  };

  const channelsQuery = trpc.slack.channels.useQuery();

  const messagesQuery = trpc.slack.messages.useQuery({
    channelId: selectedChannel === "all" ? undefined : selectedChannel,
    search: debouncedSearch || undefined,
    limit: PAGE_SIZE,
    offset: currentPage * PAGE_SIZE,
  });

  const channels = channelsQuery.data || [];
  const messages = messagesQuery.data?.messages || [];
  const totalMessages = messagesQuery.data?.total || 0;
  const totalPages = Math.ceil(totalMessages / PAGE_SIZE);

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
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "今日";
    if (days === 1) return "昨日";
    if (days < 7) return `${days}日前`;
    if (days < 30) return `${Math.floor(days / 7)}週間前`;
    return `${Math.floor(days / 30)}ヶ月前`;
  };

  const highlightText = (text: string, query: string) => {
    if (!query || !text) return text;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">{part}</mark>
      ) : part
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <MessageSquare className="h-7 w-7 text-indigo-600" />
          Slack連携
        </h1>
        <p className="text-muted-foreground mt-1">
          案件相談チャンネルのメッセージ履歴を閲覧・検索できます
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {channelsQuery.isLoading ? (
          <>
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </>
        ) : (
          <>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">総メッセージ数</p>
                    <p className="text-3xl font-bold text-indigo-600">
                      {channels.reduce((sum, ch) => sum + (ch.count || 0), 0)}
                    </p>
                  </div>
                  <MessageSquare className="h-10 w-10 text-indigo-200" />
                </div>
              </CardContent>
            </Card>
            {channels.map((ch) => (
              <Card key={ch.channelId}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Hash className="h-3 w-3" />
                        {ch.channelName}
                      </p>
                      <p className="text-3xl font-bold">{ch.count}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        最新: {ch.latestMessage ? formatRelativeDate(ch.latestMessage) : "-"}
                      </p>
                    </div>
                    <MessageCircle className="h-10 w-10 text-gray-200" />
                  </div>
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
                placeholder="メッセージを検索..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedChannel} onValueChange={(v) => { setSelectedChannel(v); setCurrentPage(0); }}>
              <SelectTrigger className="w-full sm:w-[280px]">
                <SelectValue placeholder="チャンネルを選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべてのチャンネル</SelectItem>
                {channels.map((ch) => (
                  <SelectItem key={ch.channelId} value={ch.channelId}>
                    # {ch.channelName} ({ch.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Messages List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              メッセージ一覧
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
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>メッセージが見つかりません</p>
            </div>
          ) : (
            <div className="space-y-1">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className="group rounded-lg border p-4 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex gap-3">
                    {/* Avatar */}
                    <div className="shrink-0 h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                      {msg.userName ? msg.userName.charAt(0) : <User className="h-5 w-5" />}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">
                          {msg.userName || "不明"}
                        </span>
                        <Badge variant="outline" className="text-xs px-1.5 py-0">
                          <Hash className="h-2.5 w-2.5 mr-0.5" />
                          {msg.channelName}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(msg.postedAt)}
                        </span>
                      </div>

                      {/* Message text */}
                      {msg.messageText && (
                        <div className="mt-2 text-sm whitespace-pre-wrap break-words leading-relaxed">
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
              ))}
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
