import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Building2, Phone, Mail, MapPin, Briefcase, CalendarCheck, Tag, Plus, X } from "lucide-react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import { useState } from "react";

const statusLabels: Record<string, string> = { active: "取引中", inactive: "休止", prospect: "見込み", lost: "失注" };
const typeLabels: Record<string, string> = { visit: "訪問", call: "電話", email: "メール", meeting: "会議", other: "その他" };
const phaseLabels: Record<string, string> = { lead: "リード", proposal: "提案中", negotiation: "交渉中", closing: "クロージング", won: "受注", lost: "失注" };
const progressLabels: Record<string, string> = { planned: "予定", completed: "完了", cancelled: "中止" };
const categoryLabels: Record<string, string> = { industry: "業種", size: "規模", priority: "優先度", status: "ステータス", custom: "カスタム" };

export default function CustomerDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const customerId = Number(params.id);
  const [selectedTagId, setSelectedTagId] = useState<string>("");

  const utils = trpc.useUtils();
  const { data: customer, isLoading } = trpc.customer.byId.useQuery({ id: customerId }, { enabled: !!customerId });
  const { data: activities } = trpc.activity.list.useQuery({ customerId });
  const { data: deals } = trpc.deal.list.useQuery({ customerId });
  const { data: customerTags } = trpc.tag.forCustomer.useQuery({ customerId }, { enabled: !!customerId });
  const { data: allTags } = trpc.tag.list.useQuery();

  const addTagMutation = trpc.tag.addToCustomer.useMutation({
    onSuccess: () => {
      utils.tag.forCustomer.invalidate({ customerId });
      setSelectedTagId("");
      toast.success("タグを追加しました");
    },
    onError: (e) => toast.error(e.message),
  });

  const removeTagMutation = trpc.tag.removeFromCustomer.useMutation({
    onSuccess: () => {
      utils.tag.forCustomer.invalidate({ customerId });
      toast.success("タグを解除しました");
    },
    onError: (e) => toast.error(e.message),
  });

  // 既に付いているタグを除外
  const availableTags = allTags?.filter(t => !customerTags?.some(ct => ct.tagId === t.id)) || [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">顧客が見つかりません</p>
        <Button variant="outline" className="mt-4" onClick={() => setLocation("/customers")}>戻る</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/customers")}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          戻る
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer Info */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">{customer.companyName}</CardTitle>
                <div className="flex items-center gap-1 mt-1">
                  <Badge variant="secondary" className="text-xs">
                    ID: {customer.id}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {statusLabels[customer.status] || customer.status}
                  </Badge>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {customer.contactName && (
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">担当者</p>
                <p className="text-sm font-medium">{customer.contactName}</p>
              </div>
            )}
            {customer.industry && (
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">業種</p>
                <p className="text-sm">{customer.industry}</p>
              </div>
            )}
            {customer.contactPhone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm">{customer.contactPhone}</p>
              </div>
            )}
            {customer.contactEmail && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm">{customer.contactEmail}</p>
              </div>
            )}
            {customer.address && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                <p className="text-sm">{customer.postalCode ? `〒${customer.postalCode} ` : ""}{customer.address}</p>
              </div>
            )}
            {customer.notes && (
              <div className="pt-3 border-t">
                <p className="text-xs text-muted-foreground mb-1">メモ</p>
                <p className="text-sm whitespace-pre-wrap">{customer.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tags Section */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  タグ・ラベル
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-3">
                {customerTags && customerTags.length > 0 ? (
                  customerTags.map((ct) => (
                    <Badge
                      key={ct.id}
                      variant="outline"
                      className="text-xs px-2.5 py-1 flex items-center gap-1.5"
                      style={{
                        borderColor: ct.tagColor || undefined,
                        backgroundColor: ct.tagColor ? `${ct.tagColor}15` : undefined,
                        color: ct.tagColor || undefined,
                      }}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ct.tagColor || "#6366f1" }} />
                      {ct.tagName}
                      <span className="text-[10px] text-muted-foreground">({categoryLabels[ct.tagCategory || "custom"]})</span>
                      <button
                        onClick={() => removeTagMutation.mutate({ customerId, tagId: ct.tagId })}
                        className="ml-0.5 hover:text-destructive transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">タグが設定されていません</p>
                )}
              </div>
              {availableTags.length > 0 && (
                <div className="flex items-center gap-2">
                  <Select value={selectedTagId} onValueChange={setSelectedTagId}>
                    <SelectTrigger className="w-[200px] h-8 text-xs">
                      <SelectValue placeholder="タグを選択..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTags.map((t) => (
                        <SelectItem key={t.id} value={String(t.id)}>
                          <span className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color || "#6366f1" }} />
                            {t.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    disabled={!selectedTagId || addTagMutation.isPending}
                    onClick={() => {
                      if (selectedTagId) addTagMutation.mutate({ customerId, tagId: Number(selectedTagId) });
                    }}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    追加
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activities */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarCheck className="h-4 w-4" />
                  営業活動履歴
                </CardTitle>
                <span className="text-xs text-muted-foreground">{activities?.length || 0}件</span>
              </div>
            </CardHeader>
            <CardContent>
              {!activities || activities.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">営業活動の記録がありません</p>
              ) : (
                <div className="space-y-2">
                  {activities.map((a) => (
                    <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{a.subject}</p>
                        <p className="text-xs text-muted-foreground">
                          {typeLabels[a.type]} ・ {new Date(a.activityDate).toLocaleDateString("ja-JP")}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {progressLabels[a.progressStatus]}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Deals */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  関連案件
                </CardTitle>
                <span className="text-xs text-muted-foreground">{deals?.length || 0}件</span>
              </div>
            </CardHeader>
            <CardContent>
              {!deals || deals.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">関連する案件がありません</p>
              ) : (
                <div className="space-y-2">
                  {deals.map((d) => (
                    <div key={d.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{d.dealName}</p>
                        <p className="text-xs text-muted-foreground">
                          ¥{(d.amount ?? 0).toLocaleString()} ・ 確度 {d.probability}%
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {phaseLabels[d.phase]}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
