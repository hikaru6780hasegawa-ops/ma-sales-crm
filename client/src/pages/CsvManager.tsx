import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Upload, FileSpreadsheet, Users, CalendarCheck, Briefcase, CheckCircle2, AlertCircle, Loader2, FileDown, Info } from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";

function downloadCSV(headers: string[], rows: (string | number)[][], filename: string) {
  const BOM = "\uFEFF";
  const csvContent = [
    headers.join(","),
    ...rows.map(row =>
      row.map(cell => {
        const str = String(cell);
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(",")
    )
  ].join("\n");

  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function parseCSV(text: string): string[][] {
  const lines = text.split("\n").filter(l => l.trim());
  return lines.map(line => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  });
}

export default function CsvManager() {
  const [activeTab, setActiveTab] = useState("export");
  const [importResult, setImportResult] = useState<{ imported: number; errors: number; total: number } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();

  const exportCustomers = trpc.csv.exportCustomers.useQuery(undefined, { enabled: false });
  const exportActivities = trpc.csv.exportActivities.useQuery(undefined, { enabled: false });
  const exportDeals = trpc.csv.exportDeals.useQuery(undefined, { enabled: false });
  const importCustomers = trpc.csv.importCustomers.useMutation({
    onSuccess: (result) => {
      setImportResult(result);
      setIsImporting(false);
      utils.customer.list.invalidate();
      if (result.errors === 0) {
        toast.success(`${result.imported}件の顧客データをインポートしました`);
      } else {
        toast.warning(`${result.imported}件成功、${result.errors}件失敗`);
      }
    },
    onError: (error) => {
      setIsImporting(false);
      toast.error(`インポートに失敗しました: ${error.message}`);
    },
  });

  const handleExport = async (type: "customers" | "activities" | "deals") => {
    try {
      const labels = { customers: "顧客", activities: "営業活動", deals: "案件" };
      toast.info(`${labels[type]}データをエクスポート中...`);

      let data;
      if (type === "customers") {
        data = await exportCustomers.refetch();
      } else if (type === "activities") {
        data = await exportActivities.refetch();
      } else {
        data = await exportDeals.refetch();
      }

      if (data.data) {
        const now = new Date().toISOString().slice(0, 10);
        downloadCSV(data.data.headers, data.data.rows, `${type}_${now}.csv`);
        toast.success(`${labels[type]}データをエクスポートしました`);
      }
    } catch (e) {
      toast.error("エクスポートに失敗しました");
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseCSV(text);

        if (parsed.length < 2) {
          toast.error("CSVファイルにデータが含まれていません");
          setIsImporting(false);
          return;
        }

        const headers = parsed[0].map(h => h.toLowerCase().trim());
        const dataRows = parsed.slice(1);

        const rows = dataRows.map(row => {
          const obj: Record<string, string> = {};
          headers.forEach((h, i) => {
            obj[h] = row[i] || "";
          });

          const statusMap: Record<string, string> = {
            "アクティブ": "active", "active": "active",
            "非アクティブ": "inactive", "inactive": "inactive",
            "見込み": "prospect", "prospect": "prospect",
            "失注": "lost", "lost": "lost",
          };

          return {
            companyName: obj["会社名"] || obj["companyname"] || obj["company"] || "",
            contactName: obj["担当者名"] || obj["contactname"] || obj["contact"] || undefined,
            contactEmail: obj["メール"] || obj["email"] || obj["contactemail"] || undefined,
            contactPhone: obj["電話番号"] || obj["phone"] || obj["contactphone"] || undefined,
            address: obj["住所"] || obj["address"] || undefined,
            postalCode: obj["郵便番号"] || obj["postalcode"] || obj["zip"] || undefined,
            industry: obj["業種"] || obj["industry"] || undefined,
            status: (statusMap[obj["ステータス"]?.toLowerCase()] || statusMap[obj["status"]?.toLowerCase()] || "prospect") as "active" | "inactive" | "prospect" | "lost",
            notes: obj["メモ"] || obj["notes"] || undefined,
          };
        }).filter(r => r.companyName);

        if (rows.length === 0) {
          toast.error("有効なデータが見つかりませんでした。「会社名」列が必要です。");
          setIsImporting(false);
          return;
        }

        importCustomers.mutate({ rows });
      } catch (err) {
        toast.error("CSVの解析に失敗しました");
        setIsImporting(false);
      }
    };
    reader.readAsText(file);

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDownloadTemplate = () => {
    const headers = ["会社名", "担当者名", "メール", "電話番号", "住所", "郵便番号", "業種", "ステータス", "メモ"];
    const sampleRows = [
      ["株式会社サンプル", "山田太郎", "yamada@sample.co.jp", "03-1234-5678", "東京都千代田区丸の内1-1-1", "100-0005", "IT・通信", "アクティブ", "主要取引先"],
      ["有限会社テスト", "鈴木花子", "suzuki@test.co.jp", "06-9876-5432", "大阪府大阪市北区梅田2-2-2", "530-0001", "製造業", "見込み", "新規開拓中"],
      ["合同会社デモ", "佐藤次郎", "sato@demo.co.jp", "052-111-2222", "愛知県名古屋市中区栄3-3-3", "460-0008", "小売業", "アクティブ", ""],
    ];
    downloadCSV(headers, sampleRows, "顧客インポートテンプレート.csv");
    toast.success("テンプレートCSVをダウンロードしました");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">CSVインポート・エクスポート</h1>
        <p className="text-muted-foreground text-sm mt-1">顧客データの一括インポートや営業データのCSVダウンロード</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="export" className="gap-2">
            <Download className="h-4 w-4" />
            エクスポート
          </TabsTrigger>
          <TabsTrigger value="import" className="gap-2">
            <Upload className="h-4 w-4" />
            インポート
          </TabsTrigger>
        </TabsList>

        <TabsContent value="export" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center mb-2">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <CardTitle className="text-base">顧客データ</CardTitle>
                <CardDescription className="text-xs">全顧客情報をCSVでダウンロード</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => handleExport("customers")} className="w-full gap-2" variant="outline">
                  <FileSpreadsheet className="h-4 w-4" />
                  ダウンロード
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center mb-2">
                  <CalendarCheck className="h-5 w-5 text-emerald-600" />
                </div>
                <CardTitle className="text-base">営業活動データ</CardTitle>
                <CardDescription className="text-xs">全営業活動をCSVでダウンロード</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => handleExport("activities")} className="w-full gap-2" variant="outline">
                  <FileSpreadsheet className="h-4 w-4" />
                  ダウンロード
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center mb-2">
                  <Briefcase className="h-5 w-5 text-violet-600" />
                </div>
                <CardTitle className="text-base">案件データ</CardTitle>
                <CardDescription className="text-xs">全案件情報をCSVでダウンロード</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => handleExport("deals")} className="w-full gap-2" variant="outline">
                  <FileSpreadsheet className="h-4 w-4" />
                  ダウンロード
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="import" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">顧客データのインポート</CardTitle>
              <CardDescription>
                CSVファイルから顧客データを一括登録します。ヘッダー行に「会社名」列が必須です。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* テンプレートダウンロードセクション */}
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FileDown className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">まずテンプレートをダウンロード</p>
                    <p className="text-xs text-muted-foreground mt-1">サンプルデータ入りのテンプレートCSVをダウンロードして、フォーマットを確認してからインポートすると入力ミスを防げます。</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadTemplate}
                      className="mt-2 gap-2 bg-background"
                    >
                      <FileDown className="h-4 w-4" />
                      テンプレートをダウンロード
                    </Button>
                  </div>
                </div>
              </div>

              <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-3">CSVファイルをアップロード</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleImportFile}
                  className="hidden"
                  id="csv-upload"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isImporting}
                  className="gap-2"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      インポート中...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      ファイルを選択
                    </>
                  )}
                </Button>
              </div>

              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium">CSVフォーマット</p>
                </div>
                <p className="text-xs text-muted-foreground mb-2">以下のヘッダーに対応しています（日本語・英語どちらも可）：</p>
                <code className="text-xs bg-background px-2 py-1 rounded block">
                  会社名, 担当者名, メール, 電話番号, 住所, 郵便番号, 業種, ステータス, メモ
                </code>
                <div className="mt-3 text-xs text-muted-foreground">
                  <p className="font-medium mb-1">ステータスの入力値：</p>
                  <div className="flex flex-wrap gap-2">
                    <span className="bg-background px-2 py-0.5 rounded">アクティブ / active</span>
                    <span className="bg-background px-2 py-0.5 rounded">見込み / prospect</span>
                    <span className="bg-background px-2 py-0.5 rounded">非アクティブ / inactive</span>
                    <span className="bg-background px-2 py-0.5 rounded">失注 / lost</span>
                  </div>
                </div>
              </div>

              {importResult && (
                <div className={`rounded-lg p-4 ${importResult.errors === 0 ? "bg-emerald-50 border border-emerald-200" : "bg-amber-50 border border-amber-200"}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {importResult.errors === 0 ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-amber-600" />
                    )}
                    <p className="text-sm font-medium">インポート結果</p>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold">{importResult.total}</p>
                      <p className="text-xs text-muted-foreground">総件数</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-emerald-600">{importResult.imported}</p>
                      <p className="text-xs text-muted-foreground">成功</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-red-600">{importResult.errors}</p>
                      <p className="text-xs text-muted-foreground">失敗</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
