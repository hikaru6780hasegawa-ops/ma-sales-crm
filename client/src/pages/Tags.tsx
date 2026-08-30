import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tag, Plus, Pencil, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const categoryLabels: Record<string, string> = {
  industry: "業種", size: "規模", priority: "優先度", status: "ステータス", custom: "カスタム"
};

const defaultColors = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
];

export default function Tags() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const { data: tags, isLoading } = trpc.tag.list.useQuery();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<any>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [category, setCategory] = useState<string>("custom");
  const [isShared, setIsShared] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const createMutation = trpc.tag.create.useMutation({
    onSuccess: () => {
      utils.tag.list.invalidate();
      setIsCreateOpen(false);
      resetForm();
      toast.success("タグを作成しました");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.tag.update.useMutation({
    onSuccess: () => {
      utils.tag.list.invalidate();
      setEditingTag(null);
      resetForm();
      toast.success("タグを更新しました");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.tag.delete.useMutation({
    onSuccess: () => {
      utils.tag.list.invalidate();
      toast.success("タグを削除しました");
    },
    onError: (e) => toast.error(e.message),
  });

  function resetForm() {
    setName("");
    setColor("#6366f1");
    setCategory("custom");
    setIsShared(false);
  }

  function openEdit(tag: any) {
    setEditingTag(tag);
    setName(tag.name);
    setColor(tag.color || "#6366f1");
    setCategory(tag.category || "custom");
    setIsShared(tag.isShared === 1);
  }

  const filteredTags = tags?.filter(t => filterCategory === "all" || t.category === filterCategory) || [];

  // カテゴリ別にグループ化
  const groupedTags = filteredTags.reduce((acc, tag) => {
    const cat = tag.category || "custom";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(tag);
    return acc;
  }, {} as Record<string, typeof filteredTags>);

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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Tag className="h-6 w-6 text-primary" />
            タグ・ラベル管理
          </h1>
          <p className="text-sm text-muted-foreground mt-1">顧客を業種・規模・優先度などで分類・整理</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              新規タグ
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>新しいタグを作成</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label>タグ名</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例: 大企業、高優先度" className="mt-1" />
              </div>
              <div>
                <Label>カテゴリ</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="industry">業種</SelectItem>
                    <SelectItem value="size">規模</SelectItem>
                    <SelectItem value="priority">優先度</SelectItem>
                    <SelectItem value="status">ステータス</SelectItem>
                    <SelectItem value="custom">カスタム</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>カラー</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {defaultColors.map((c) => (
                    <button
                      key={c}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${color === c ? "border-foreground scale-110" : "border-transparent"}`}
                      style={{ backgroundColor: c }}
                      onClick={() => setColor(c)}
                    />
                  ))}
                </div>
              </div>
              {isAdmin && (
                <div className="flex items-center gap-3">
                  <Switch checked={isShared} onCheckedChange={setIsShared} />
                  <Label>全営業マンに共有</Label>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setIsCreateOpen(false); resetForm(); }}>キャンセル</Button>
              <Button
                disabled={!name.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate({ name: name.trim(), color, category: category as any, isShared: isShared ? 1 : 0 })}
              >
                作成
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Badge
          variant={filterCategory === "all" ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => setFilterCategory("all")}
        >
          すべて ({tags?.length || 0})
        </Badge>
        {Object.entries(categoryLabels).map(([key, label]) => {
          const count = tags?.filter(t => t.category === key).length || 0;
          if (count === 0) return null;
          return (
            <Badge
              key={key}
              variant={filterCategory === key ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setFilterCategory(key)}
            >
              {label} ({count})
            </Badge>
          );
        })}
      </div>

      {/* Tag Groups */}
      {Object.keys(groupedTags).length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Tag className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">タグがまだ作成されていません</p>
            <p className="text-sm text-muted-foreground mt-1">「新規タグ」ボタンからタグを作成してください</p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(groupedTags).map(([cat, catTags]) => (
          <Card key={cat}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{categoryLabels[cat] || cat}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {catTags.map((tag) => (
                  <div
                    key={tag.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: tag.color || "#6366f1" }} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{tag.name}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          {tag.isShared === 1 && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              <Users className="h-2.5 w-2.5 mr-0.5" />
                              共有
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => openEdit(tag)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm(`タグ「${tag.name}」を削除しますか？`)) {
                            deleteMutation.mutate({ id: tag.id });
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingTag} onOpenChange={(open) => { if (!open) { setEditingTag(null); resetForm(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>タグを編集</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>タグ名</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>カテゴリ</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="industry">業種</SelectItem>
                  <SelectItem value="size">規模</SelectItem>
                  <SelectItem value="priority">優先度</SelectItem>
                  <SelectItem value="status">ステータス</SelectItem>
                  <SelectItem value="custom">カスタム</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>カラー</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {defaultColors.map((c) => (
                  <button
                    key={c}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${color === c ? "border-foreground scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>
            {isAdmin && (
              <div className="flex items-center gap-3">
                <Switch checked={isShared} onCheckedChange={setIsShared} />
                <Label>全営業マンに共有</Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditingTag(null); resetForm(); }}>キャンセル</Button>
            <Button
              disabled={!name.trim() || updateMutation.isPending}
              onClick={() => {
                if (editingTag) {
                  updateMutation.mutate({
                    id: editingTag.id,
                    name: name.trim(),
                    color,
                    category: category as any,
                    isShared: isShared ? 1 : 0,
                  });
                }
              }}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
