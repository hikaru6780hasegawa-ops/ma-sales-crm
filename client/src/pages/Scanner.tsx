import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Camera, Upload, FileText, Trash2, Eye, UserPlus, Loader2, Image as ImageIcon, Hash } from "lucide-react";
import { useState, useRef, useCallback } from "react";

export default function Scanner() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [showParseDialog, setShowParseDialog] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [imageBase64, setImageBase64] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const { data: documents = [], isLoading } = trpc.scan.list.useQuery({});
  const { data: customers = [] } = trpc.customer.list.useQuery({});
  const { data: folders = [] } = trpc.folder.list.useQuery({});

  const uploadMutation = trpc.scan.upload.useMutation({
    onSuccess: (data) => {
      toast.success("スキャン完了", { description: "ドキュメントが保存されました" });
      utils.scan.list.invalidate();
      setShowUploadDialog(false);
      resetForm();
    },
    onError: (err) => toast.error("アップロードに失敗しました", { description: err.message }),
  });

  const deleteMutation = trpc.scan.delete.useMutation({
    onSuccess: () => {
      toast.success("削除しました");
      utils.scan.list.invalidate();
    },
  });

  const parseMutation = trpc.scan.parseToCustomer.useMutation({
    onSuccess: (data) => {
      setSelectedDoc((prev: any) => ({ ...prev, parsedData: data }));
    },
    onError: () => toast.error("テキスト解析に失敗しました"),
  });

  const createCustomerMutation = trpc.customer.create.useMutation({
    onSuccess: () => {
      toast.success("顧客を登録しました");
      utils.customer.list.invalidate();
      setShowParseDialog(false);
    },
    onError: (err) => toast.error("登録に失敗しました", { description: err.message }),
  });

  const resetForm = () => {
    setTitle("");
    setImageBase64("");
    setPreviewUrl("");
    stopCamera();
  };

  const startCamera = useCallback(async () => {
    try {
      setIsCapturing(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (e) {
      toast.error("カメラにアクセスできません", { description: "カメラの使用を許可してください" });
      setIsCapturing(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCapturing(false);
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    const base64 = dataUrl.split(",")[1];
    setImageBase64(base64);
    setPreviewUrl(dataUrl);
    stopCamera();
  }, [stopCamera]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 16 * 1024 * 1024) {
      toast.error("ファイルサイズが大きすぎます", { description: "16MB以下のファイルを選択してください" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      setImageBase64(base64);
      setPreviewUrl(result);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = () => {
    if (!title.trim() || !imageBase64) {
      toast.error("タイトルと画像を入力してください");
      return;
    }
    uploadMutation.mutate({ title, imageBase64, mimeType: "image/jpeg" });
  };

  const handleParseToCustomer = (doc: any) => {
    setSelectedDoc({ ...doc, parsedData: null });
    setShowParseDialog(true);
    if (doc.extractedText) {
      parseMutation.mutate({ extractedText: doc.extractedText });
    }
  };

  const handleCreateCustomer = (parsedData: any) => {
    createCustomerMutation.mutate({
      companyName: parsedData.companyName || "未設定",
      contactName: parsedData.contactName || undefined,
      contactEmail: parsedData.contactEmail || undefined,
      contactPhone: parsedData.contactPhone || undefined,
      address: parsedData.address || undefined,
      postalCode: parsedData.postalCode || undefined,
      industry: parsedData.industry || undefined,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">スキャン</h1>
          <p className="text-muted-foreground">写真を撮影してデータをスキャン・OCR読み取り</p>
        </div>
        <Button onClick={() => { resetForm(); setShowUploadDialog(true); }}>
          <Camera className="mr-2 h-4 w-4" />
          新規スキャン
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : documents.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Camera className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">スキャンしたドキュメントはありません</h3>
            <p className="text-muted-foreground text-sm mb-4">名刺や書類を撮影してデータを取り込みましょう</p>
            <Button onClick={() => { resetForm(); setShowUploadDialog(true); }}>
              <Camera className="mr-2 h-4 w-4" />
              スキャンを開始
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc) => (
            <Card key={doc.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <div className="aspect-video bg-muted relative overflow-hidden cursor-pointer" onClick={() => { setSelectedDoc(doc); setShowPreviewDialog(true); }}>
                <img src={doc.imageUrl} alt={doc.title} className="w-full h-full object-cover" />
                <div className="absolute top-2 left-2">
                  <Badge variant="secondary" className="text-xs font-mono">
                    <Hash className="h-3 w-3 mr-1" />
                    {doc.id}
                  </Badge>
                </div>
              </div>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold truncate">{doc.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(doc.createdAt).toLocaleDateString("ja-JP")}
                    </p>
                    {doc.extractedText && (
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                        {doc.extractedText.substring(0, 100)}...
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelectedDoc(doc); setShowPreviewDialog(true); }}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleParseToCustomer(doc)}>
                      <UserPlus className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate({ id: doc.id })}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={(open) => { if (!open) { stopCamera(); } setShowUploadDialog(open); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>新規スキャン</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>タイトル</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例: 名刺 - 田中太郎" />
            </div>

            {isCapturing ? (
              <div className="space-y-2">
                <video ref={videoRef} autoPlay playsInline className="w-full rounded-lg bg-black" />
                <canvas ref={canvasRef} className="hidden" />
                <div className="flex gap-2">
                  <Button onClick={capturePhoto} className="flex-1">
                    <Camera className="mr-2 h-4 w-4" />
                    撮影
                  </Button>
                  <Button variant="outline" onClick={stopCamera}>
                    キャンセル
                  </Button>
                </div>
              </div>
            ) : previewUrl ? (
              <div className="space-y-2">
                <img src={previewUrl} alt="Preview" className="w-full rounded-lg" />
                <Button variant="outline" onClick={() => { setImageBase64(""); setPreviewUrl(""); }} className="w-full">
                  画像を変更
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" onClick={startCamera} className="h-24 flex-col gap-2">
                  <Camera className="h-6 w-6" />
                  <span className="text-xs">カメラで撮影</span>
                </Button>
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="h-24 flex-col gap-2">
                  <Upload className="h-6 w-6" />
                  <span className="text-xs">ファイルを選択</span>
                </Button>
                <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { stopCamera(); setShowUploadDialog(false); }}>
              キャンセル
            </Button>
            <Button onClick={handleUpload} disabled={!title.trim() || !imageBase64 || uploadMutation.isPending}>
              {uploadMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  スキャン中...
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  スキャン＆保存
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-xs">ID: {selectedDoc?.id}</Badge>
              {selectedDoc?.title}
            </DialogTitle>
          </DialogHeader>
          {selectedDoc && (
            <div className="space-y-4">
              <img src={selectedDoc.imageUrl} alt={selectedDoc.title} className="w-full rounded-lg" />
              {selectedDoc.extractedText && (
                <div>
                  <Label className="text-sm font-semibold">OCR読み取り結果</Label>
                  <div className="mt-2 p-4 bg-muted rounded-lg text-sm whitespace-pre-wrap">
                    {selectedDoc.extractedText}
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={() => { setShowPreviewDialog(false); handleParseToCustomer(selectedDoc); }}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  顧客として登録
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Parse to Customer Dialog */}
      <Dialog open={showParseDialog} onOpenChange={setShowParseDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>スキャンデータから顧客登録</DialogTitle>
          </DialogHeader>
          {parseMutation.isPending ? (
            <div className="flex flex-col items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-sm text-muted-foreground">AIがテキストを解析中...</p>
            </div>
          ) : selectedDoc?.parsedData ? (
            <div className="space-y-3">
              {[
                { label: "会社名", value: selectedDoc.parsedData.companyName },
                { label: "担当者名", value: selectedDoc.parsedData.contactName },
                { label: "メール", value: selectedDoc.parsedData.contactEmail },
                { label: "電話番号", value: selectedDoc.parsedData.contactPhone },
                { label: "住所", value: selectedDoc.parsedData.address },
                { label: "郵便番号", value: selectedDoc.parsedData.postalCode },
                { label: "業種", value: selectedDoc.parsedData.industry },
              ].map(({ label, value }) => (
                <div key={label}>
                  <Label className="text-xs text-muted-foreground">{label}</Label>
                  <p className="text-sm font-medium">{value || "-"}</p>
                </div>
              ))}
              <DialogFooter className="pt-4">
                <Button variant="outline" onClick={() => setShowParseDialog(false)}>キャンセル</Button>
                <Button onClick={() => handleCreateCustomer(selectedDoc.parsedData)} disabled={createCustomerMutation.isPending}>
                  {createCustomerMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                  顧客として登録
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4">解析するテキストがありません</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
