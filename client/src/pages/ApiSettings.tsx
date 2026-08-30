import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Key, Plus, Trash2, Copy, AlertTriangle, Zap, ExternalLink, Shield } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function ApiSettings() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();

  const { data: apiKeys, isLoading } = trpc.apiKey.list.useQuery(undefined, { enabled: isAdmin });
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);

  const createMutation = trpc.apiKey.create.useMutation({
    onSuccess: (data) => {
      utils.apiKey.list.invalidate();
      setNewKey(data.key);
      setKeyName("");
      toast.success("APIキーを作成しました");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.apiKey.delete.useMutation({
    onSuccess: () => {
      utils.apiKey.list.invalidate();
      toast.success("APIキーを削除しました");
    },
    onError: (e) => toast.error(e.message),
  });

  if (!isAdmin) {
    return (
      <div className="text-center py-16">
        <Shield className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
        <p className="text-muted-foreground">API設定は管理者のみアクセスできます</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Zap className="h-6 w-6 text-primary" />
          API連携・n8n設定
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          n8nやZapierなどの外部ツールと連携するためのAPIキーを管理します
        </p>
      </div>

      {/* API Documentation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ExternalLink className="h-4 w-4" />
            API エンドポイント
          </CardTitle>
          <CardDescription>以下のREST APIエンドポイントをn8nのHTTP Requestノードで使用できます</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="bg-muted/50 rounded-lg p-4 font-mono text-sm space-y-2">
              <p className="text-muted-foreground text-xs mb-2">■ 認証ヘッダー</p>
              <p>Authorization: Bearer {"<YOUR_API_KEY>"}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { method: "GET", path: "/api/webhook/customers", desc: "顧客一覧取得" },
                { method: "POST", path: "/api/webhook/customers", desc: "顧客作成" },
                { method: "PUT", path: "/api/webhook/customers/:id", desc: "顧客更新" },
                { method: "DELETE", path: "/api/webhook/customers/:id", desc: "顧客削除" },
                { method: "GET", path: "/api/webhook/activities", desc: "営業活動一覧" },
                { method: "POST", path: "/api/webhook/activities", desc: "営業活動作成" },
                { method: "GET", path: "/api/webhook/deals", desc: "案件一覧取得" },
                { method: "POST", path: "/api/webhook/deals", desc: "案件作成" },
                { method: "GET", path: "/api/webhook/dashboard", desc: "統計データ取得" },
              ].map((ep) => (
                <div key={ep.path + ep.method} className="flex items-center gap-2 p-2 rounded border bg-card">
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-mono shrink-0 ${
                      ep.method === "GET" ? "text-green-600 border-green-300" :
                      ep.method === "POST" ? "text-blue-600 border-blue-300" :
                      ep.method === "PUT" ? "text-orange-600 border-orange-300" :
                      "text-red-600 border-red-300"
                    }`}
                  >
                    {ep.method}
                  </Badge>
                  <code className="text-xs truncate flex-1">{ep.path}</code>
                  <span className="text-xs text-muted-foreground shrink-0">{ep.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Keys */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Key className="h-4 w-4" />
                APIキー管理
              </CardTitle>
              <CardDescription className="mt-1">APIキーは作成時のみ表示されます。安全に保管してください。</CardDescription>
            </div>
            <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) { setKeyName(""); setNewKey(null); } }}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  新規キー
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{newKey ? "APIキーが作成されました" : "新しいAPIキーを作成"}</DialogTitle>
                </DialogHeader>
                {newKey ? (
                  <div className="space-y-4 py-2">
                    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-sm text-amber-800 dark:text-amber-200">
                          このキーは今回のみ表示されます。安全な場所に保存してください。
                        </p>
                      </div>
                    </div>
                    <div className="bg-muted rounded-lg p-3">
                      <code className="text-xs break-all select-all">{newKey}</code>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        navigator.clipboard.writeText(newKey);
                        toast.success("コピーしました");
                      }}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      クリップボードにコピー
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4 py-2">
                    <div>
                      <Label>キー名</Label>
                      <Input
                        value={keyName}
                        onChange={(e) => setKeyName(e.target.value)}
                        placeholder="例: n8n連携用、Zapier用"
                        className="mt-1"
                      />
                    </div>
                  </div>
                )}
                <DialogFooter>
                  {newKey ? (
                    <Button onClick={() => { setIsCreateOpen(false); setNewKey(null); }}>閉じる</Button>
                  ) : (
                    <>
                      <Button variant="outline" onClick={() => { setIsCreateOpen(false); setKeyName(""); }}>キャンセル</Button>
                      <Button
                        disabled={!keyName.trim() || createMutation.isPending}
                        onClick={() => createMutation.mutate({ name: keyName.trim() })}
                      >
                        作成
                      </Button>
                    </>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {!apiKeys || apiKeys.length === 0 ? (
            <div className="text-center py-8">
              <Key className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">APIキーがまだ作成されていません</p>
            </div>
          ) : (
            <div className="space-y-2">
              {apiKeys.map((key) => (
                <div key={key.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{key.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <code className="text-xs text-muted-foreground">{key.keyPrefix}</code>
                      <Badge variant={key.isActive === 1 ? "default" : "secondary"} className="text-[10px]">
                        {key.isActive === 1 ? "有効" : "無効"}
                      </Badge>
                      {key.lastUsedAt && (
                        <span className="text-[10px] text-muted-foreground">
                          最終使用: {new Date(key.lastUsedAt).toLocaleDateString("ja-JP")}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive h-8 w-8 p-0"
                    onClick={() => {
                      if (confirm(`APIキー「${key.name}」を削除しますか？`)) {
                        deleteMutation.mutate({ id: key.id });
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* n8n Setup Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">n8n セットアップガイド</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">1</span>
              <span>上の「新規キー」ボタンからAPIキーを作成し、安全に保存します</span>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">2</span>
              <span>n8nで「HTTP Request」ノードを追加し、URLにAPIエンドポイントを設定します</span>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">3</span>
              <span>認証タイプを「Header Auth」に設定し、ヘッダー名を <code className="bg-muted px-1 rounded">Authorization</code>、値を <code className="bg-muted px-1 rounded">Bearer YOUR_API_KEY</code> に設定します</span>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">4</span>
              <span>トリガーノード（Webhook、Scheduleなど）を接続して自動化ワークフローを構築します</span>
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
