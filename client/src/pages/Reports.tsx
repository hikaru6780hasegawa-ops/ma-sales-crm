import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { FileBarChart, Sparkles, Calendar, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

export default function Reports() {
  const { user } = useAuth();
  const [reportType, setReportType] = useState<"weekly" | "monthly">("weekly");
  const { data: reports, isLoading } = trpc.aiReport.list.useQuery();
  const utils = trpc.useUtils();

  const generateMutation = trpc.aiReport.generate.useMutation({
    onSuccess: () => {
      utils.aiReport.list.invalidate();
      toast.success("レポートを生成しました");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.aiReport.delete.useMutation({
    onSuccess: () => {
      utils.aiReport.list.invalidate();
      toast.success("レポートを削除しました");
    },
    onError: (err) => toast.error(err.message),
  });

  const [expandedReport, setExpandedReport] = useState<number | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AIレポート</h1>
          <p className="text-muted-foreground text-sm mt-1">
            営業活動データをAIが分析し、改善提案を含むレポートを自動生成します
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={reportType} onValueChange={(v: any) => setReportType(v)}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">週次レポート</SelectItem>
              <SelectItem value="monthly">月次レポート</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={() => generateMutation.mutate({ reportType })}
            disabled={generateMutation.isPending}
            className="shrink-0"
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                レポート生成
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Reports List */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
        </div>
      ) : !reports || reports.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileBarChart className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-muted-foreground">レポートがまだありません</p>
            <p className="text-xs text-muted-foreground mt-1">上のボタンからAIレポートを生成してください</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => {
            const isExpanded = expandedReport === report.id;
            return (
              <Card key={report.id} className="overflow-hidden">
                <CardHeader
                  className="pb-2 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedReport(isExpanded ? null : report.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                        <Sparkles className="h-4 w-4 text-violet-600" />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-semibold">{report.title}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {new Date(report.createdAt).toLocaleDateString("ja-JP", {
                              year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
                            })}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            report.reportType === "weekly" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                          }`}>
                            {report.reportType === "weekly" ? "週次" : "月次"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-destructive hover:text-destructive shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm("このレポートを削除しますか？")) {
                          deleteMutation.mutate({ id: report.id });
                        }
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardHeader>
                {isExpanded && (
                  <CardContent className="pt-0 pb-4">
                    <div className="border-t pt-4 prose prose-sm max-w-none dark:prose-invert">
                      <Streamdown>{report.content}</Streamdown>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
