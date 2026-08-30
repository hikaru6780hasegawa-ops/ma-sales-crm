import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Folder, FolderPlus, Trash2, Edit, Users, FileText, ChevronRight,
  Loader2, Hash, ArrowLeft, MoreHorizontal
} from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocation } from "wouter";

const FOLDER_COLORS = [
  "#4F46E5", "#7C3AED", "#DB2777", "#DC2626",
  "#EA580C", "#CA8A04", "#16A34A", "#0891B2",
];

export default function Folders() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingFolder, setEditingFolder] = useState<any>(null);
  const [folderName, setFolderName] = useState("");
  const [folderColor, setFolderColor] = useState(FOLDER_COLORS[0]);

  const { data: folders = [], isLoading } = trpc.folder.list.useQuery({});
  const { data: customers = [] } = trpc.customer.list.useQuery({});
  const { data: documents = [] } = trpc.scan.list.useQuery({});

  const createMutation = trpc.folder.create.useMutation({
    onSuccess: () => {
      toast.success("フォルダを作成しました");
      utils.folder.list.invalidate();
      setShowCreateDialog(false);
      setFolderName("");
    },
    onError: (err) => toast.error("作成に失敗しました", { description: err.message }),
  });

  const updateMutation = trpc.folder.update.useMutation({
    onSuccess: () => {
      toast.success("フォルダを更新しました");
      utils.folder.list.invalidate();
      setEditingFolder(null);
      setFolderName("");
    },
  });

  const deleteMutation = trpc.folder.delete.useMutation({
    onSuccess: () => {
      toast.success("フォルダを削除しました");
      utils.folder.list.invalidate();
    },
  });

  const getCustomerCount = (folderId: number) =>
    customers.filter(c => c.folderId === folderId).length;

  const getDocumentCount = (folderId: number) =>
    documents.filter(d => d.folderId === folderId).length;

  const unfiledCustomers = customers.filter(c => !c.folderId).length;
  const unfiledDocuments = documents.filter(d => !d.folderId).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">フォルダ管理</h1>
          <p className="text-muted-foreground">顧客やドキュメントをフォルダで整理</p>
        </div>
        <Button onClick={() => { setFolderName(""); setFolderColor(FOLDER_COLORS[0]); setShowCreateDialog(true); }}>
          <FolderPlus className="mr-2 h-4 w-4" />
          新規フォルダ
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* フォルダ一覧 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {folders.map((folder) => {
              const custCount = getCustomerCount(folder.id);
              const docCount = getDocumentCount(folder.id);
              return (
                <Card key={folder.id} className="hover:shadow-md transition-shadow cursor-pointer group">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 min-w-0 flex-1" onClick={() => setLocation(`/customers?folderId=${folder.id}`)}>
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: `${folder.color || "#4F46E5"}20` }}
                        >
                          <Folder className="h-5 w-5" style={{ color: folder.color || "#4F46E5" }} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold truncate">{folder.name}</h3>
                            <Badge variant="outline" className="text-xs font-mono shrink-0">
                              <Hash className="h-3 w-3 mr-0.5" />{folder.id}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Users className="h-3 w-3" />{custCount}件
                            </span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <FileText className="h-3 w-3" />{docCount}件
                            </span>
                          </div>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            setEditingFolder(folder);
                            setFolderName(folder.name);
                            setFolderColor(folder.color || FOLDER_COLORS[0]);
                          }}>
                            <Edit className="mr-2 h-4 w-4" />
                            編集
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => {
                              if (confirm("このフォルダを削除しますか？中のアイテムはフォルダ外に移動されます。")) {
                                deleteMutation.mutate({ id: folder.id });
                              }
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            削除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* 未分類 */}
          {(unfiledCustomers > 0 || unfiledDocuments > 0) && (
            <Card className="border-dashed">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                    <Folder className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-muted-foreground">未分類</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Users className="h-3 w-3" />{unfiledCustomers}件
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <FileText className="h-3 w-3" />{unfiledDocuments}件
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {folders.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <FolderPlus className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">フォルダがありません</h3>
                <p className="text-muted-foreground text-sm mb-4">フォルダを作成して顧客やドキュメントを整理しましょう</p>
                <Button onClick={() => { setFolderName(""); setFolderColor(FOLDER_COLORS[0]); setShowCreateDialog(true); }}>
                  <FolderPlus className="mr-2 h-4 w-4" />
                  フォルダを作成
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>新規フォルダ</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>フォルダ名</Label>
              <Input value={folderName} onChange={(e) => setFolderName(e.target.value)} placeholder="例: 重要顧客" />
            </div>
            <div>
              <Label>カラー</Label>
              <div className="flex gap-2 mt-2">
                {FOLDER_COLORS.map((color) => (
                  <button
                    key={color}
                    className={`w-8 h-8 rounded-full transition-all ${folderColor === color ? "ring-2 ring-offset-2 ring-primary scale-110" : "hover:scale-105"}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setFolderColor(color)}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>キャンセル</Button>
            <Button onClick={() => createMutation.mutate({ name: folderName, color: folderColor })} disabled={!folderName.trim() || createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FolderPlus className="mr-2 h-4 w-4" />}
              作成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingFolder} onOpenChange={(open) => { if (!open) setEditingFolder(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>フォルダを編集</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>フォルダ名</Label>
              <Input value={folderName} onChange={(e) => setFolderName(e.target.value)} />
            </div>
            <div>
              <Label>カラー</Label>
              <div className="flex gap-2 mt-2">
                {FOLDER_COLORS.map((color) => (
                  <button
                    key={color}
                    className={`w-8 h-8 rounded-full transition-all ${folderColor === color ? "ring-2 ring-offset-2 ring-primary scale-110" : "hover:scale-105"}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setFolderColor(color)}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingFolder(null)}>キャンセル</Button>
            <Button onClick={() => updateMutation.mutate({ id: editingFolder.id, name: folderName, color: folderColor })} disabled={!folderName.trim()}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
