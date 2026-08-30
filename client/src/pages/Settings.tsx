import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Bell, Mail, CalendarClock, Briefcase, FileText, Shield, Loader2, Send, CheckCircle2 } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export default function Settings() {
  const { user } = useAuth();
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [dealReminderDays, setDealReminderDays] = useState("3");
  const [actionReminderDays, setActionReminderDays] = useState("1");
  const [weeklyReportEnabled, setWeeklyReportEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const settings = trpc.notificationSettings.get.useQuery();
  const updateSettings = trpc.notificationSettings.update.useMutation({
    onSuccess: () => {
      setIsSaving(false);
      toast.success("通知設定を保存しました");
    },
    onError: () => {
      setIsSaving(false);
      toast.error("設定の保存に失敗しました");
    },
  });

  const checkAndNotify = trpc.notificationSettings.checkAndNotify.useMutation({
    onSuccess: (result) => {
      if (result.sent) {
        toast.success(result.message);
      } else {
        toast.info(result.message);
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  useEffect(() => {
    if (settings.data) {
      setEmailEnabled(settings.data.emailEnabled === 1);
      setDealReminderDays(String(settings.data.dealReminderDays));
      setActionReminderDays(String(settings.data.actionReminderDays));
      setWeeklyReportEnabled(settings.data.weeklyReportEnabled === 1);
    }
  }, [settings.data]);

  const handleSave = () => {
    setIsSaving(true);
    updateSettings.mutate({
      emailEnabled: emailEnabled ? 1 : 0,
      dealReminderDays: parseInt(dealReminderDays),
      actionReminderDays: parseInt(actionReminderDays),
      weeklyReportEnabled: weeklyReportEnabled ? 1 : 0,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">設定</h1>
        <p className="text-muted-foreground text-sm mt-1">通知設定やアカウント情報の管理</p>
      </div>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Bell className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-base">通知設定</CardTitle>
              <CardDescription className="text-xs">商談予定日やアクション期限の通知を管理</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Email notifications toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label className="text-sm font-medium">メール通知</Label>
                <p className="text-xs text-muted-foreground">期限通知をメールで受け取る</p>
              </div>
            </div>
            <Switch checked={emailEnabled} onCheckedChange={setEmailEnabled} />
          </div>

          <Separator />

          {/* Deal reminder days */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label className="text-sm font-medium">案件期限リマインダー</Label>
                <p className="text-xs text-muted-foreground">受注予定日の何日前に通知するか</p>
              </div>
            </div>
            <Select value={dealReminderDays} onValueChange={setDealReminderDays}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1日前</SelectItem>
                <SelectItem value="2">2日前</SelectItem>
                <SelectItem value="3">3日前</SelectItem>
                <SelectItem value="5">5日前</SelectItem>
                <SelectItem value="7">7日前</SelectItem>
                <SelectItem value="14">14日前</SelectItem>
                <SelectItem value="30">30日前</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Action reminder days */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label className="text-sm font-medium">アクション期限リマインダー</Label>
                <p className="text-xs text-muted-foreground">次回アクション日の何日前に通知するか</p>
              </div>
            </div>
            <Select value={actionReminderDays} onValueChange={setActionReminderDays}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1日前</SelectItem>
                <SelectItem value="2">2日前</SelectItem>
                <SelectItem value="3">3日前</SelectItem>
                <SelectItem value="5">5日前</SelectItem>
                <SelectItem value="7">7日前</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Weekly report toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label className="text-sm font-medium">週次レポート通知</Label>
                <p className="text-xs text-muted-foreground">週次レポート生成時に通知を受け取る</p>
              </div>
            </div>
            <Switch checked={weeklyReportEnabled} onCheckedChange={setWeeklyReportEnabled} />
          </div>

          <div className="flex gap-3 pt-2">
            <Button onClick={handleSave} disabled={isSaving} className="gap-2">
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              設定を保存
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Admin: Manual notification trigger */}
      {user?.role === "admin" && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                <Shield className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <CardTitle className="text-base">管理者機能</CardTitle>
                <CardDescription className="text-xs">通知の手動送信やシステム管理</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm font-medium mb-1">期限通知の手動送信</p>
              <p className="text-xs text-muted-foreground mb-3">
                期限が近い案件やアクションの通知を今すぐ確認・送信します
              </p>
              <Button
                variant="outline"
                onClick={() => checkAndNotify.mutate()}
                disabled={checkAndNotify.isPending}
                className="gap-2"
              >
                {checkAndNotify.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                通知を確認・送信
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Account info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">アカウント情報</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">名前</p>
              <p className="text-sm font-medium">{user?.name || "未設定"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">メールアドレス</p>
              <p className="text-sm font-medium">{user?.email || "未設定"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">権限</p>
              <p className="text-sm font-medium">{user?.role === "admin" ? "管理者" : "営業マン"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">最終ログイン</p>
              <p className="text-sm font-medium">
                {user?.lastSignedIn ? new Date(user.lastSignedIn).toLocaleString("ja-JP") : "不明"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
