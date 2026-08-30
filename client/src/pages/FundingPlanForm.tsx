import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, Printer, Save, Loader2, Search, Link2, X, Download, BookmarkPlus, BookOpen, Trash2, Users, User } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useLocation, useRoute } from "wouter";

// 資金計画書のフォームデータ型
interface FundingPlanFormData {
  // ヘッダー
  createdDate: string;
  propertyType: string;
  // 顧客情報
  customerName: string;
  birthEra: string;
  birthYear: string;
  birthMonth: string;
  birthDay: string;
  age: string;
  annualIncome: string;
  maxLoanPeriod: string;
  // 必要資金
  purchasePrice: string;
  landPrice: string;
  // 税金・登記費用
  stampDuty: string;
  displayRegistration: string;
  registrationFee: string;
  fixedAssetTax: string;
  taxExtra1: string;
  taxExtra2: string;
  // ローン関連
  loanDocFee: string;
  loanStampDuty: string;
  loanFee1: string;
  loanFee2: string;
  loanFee3: string;
  loanExtra: string;
  financingFee: string;
  guaranteeFee: string;
  fireInsurance: string;
  flatInsurance: string;
  flatCertFee: string;
  loanExtra2: string;
  // その他
  brokerageFeeCalc: string;
  brokerageFee: string;
  managementFee: string;
  additionalWork: string;
  otherExtra: string;
  // オプション
  optionWork: string;
  consolidationLoan: string;
  // 資金計画パターン1
  p1Label: string;
  p1Bank1: string;
  p1Amount1: string;
  p1RateType1: string;
  p1Period1: string;
  p1InitialRate1: string;
  p1LaterRate1: string;
  p1InitialPayment1: string;
  p1LaterPayment1: string;
  p1Bank2: string;
  p1Amount2: string;
  p1RateType2: string;
  p1Period2: string;
  p1InitialRate2: string;
  p1LaterRate2: string;
  p1InitialPayment2: string;
  p1LaterPayment2: string;
  p1Bank3: string;
  p1Amount3: string;
  p1RateType3: string;
  p1Period3: string;
  p1InitialRate3: string;
  p1LaterRate3: string;
  p1InitialPayment3: string;
  p1LaterPayment3: string;
  p1TotalLoan: string;
  p1OwnFunds: string;
  p1MonthlyInitial: string;
  p1MonthlyLater: string;
  // パターン2
  p2Bank1: string;
  p2Amount1: string;
  p2RateType1: string;
  p2Period1: string;
  p2InitialRate1: string;
  p2LaterRate1: string;
  p2InitialPayment1: string;
  p2LaterPayment1: string;
  p2TotalLoan: string;
  p2OwnFunds: string;
  p2MonthlyInitial: string;
  p2MonthlyLater: string;
  // パターン3
  p3Bank1: string;
  p3Amount1: string;
  p3RateType1: string;
  p3Period1: string;
  p3InitialRate1: string;
  p3LaterRate1: string;
  p3InitialPayment1: string;
  p3LaterPayment1: string;
  p3TotalLoan: string;
  p3OwnFunds: string;
  p3MonthlyInitial: string;
  p3MonthlyLater: string;
}

const defaultFormData: FundingPlanFormData = {
  createdDate: new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" }),
  propertyType: "中古戸建",
  customerName: "",
  birthEra: "昭和",
  birthYear: "",
  birthMonth: "",
  birthDay: "",
  age: "",
  annualIncome: "",
  maxLoanPeriod: "",
  purchasePrice: "",
  landPrice: "",
  stampDuty: "1",
  displayRegistration: "",
  registrationFee: "45",
  fixedAssetTax: "12",
  taxExtra1: "0",
  taxExtra2: "0",
  loanDocFee: "0",
  loanStampDuty: "0",
  loanFee1: "10",
  loanFee2: "0",
  loanFee3: "0",
  loanExtra: "0",
  financingFee: "0",
  guaranteeFee: "100",
  fireInsurance: "35",
  flatInsurance: "0",
  flatCertFee: "0",
  loanExtra2: "0",
  brokerageFeeCalc: "",
  brokerageFee: "",
  managementFee: "",
  additionalWork: "0",
  otherExtra: "0",
  optionWork: "0",
  consolidationLoan: "0",
  p1Label: "ペアローン",
  p1Bank1: "", p1Amount1: "", p1RateType1: "変動金利", p1Period1: "35", p1InitialRate1: "", p1LaterRate1: "", p1InitialPayment1: "", p1LaterPayment1: "",
  p1Bank2: "", p1Amount2: "", p1RateType2: "", p1Period2: "", p1InitialRate2: "", p1LaterRate2: "", p1InitialPayment2: "", p1LaterPayment2: "",
  p1Bank3: "", p1Amount3: "", p1RateType3: "", p1Period3: "", p1InitialRate3: "", p1LaterRate3: "", p1InitialPayment3: "", p1LaterPayment3: "",
  p1TotalLoan: "", p1OwnFunds: "", p1MonthlyInitial: "", p1MonthlyLater: "",
  p2Bank1: "", p2Amount1: "", p2RateType1: "全期間固定", p2Period1: "", p2InitialRate1: "", p2LaterRate1: "", p2InitialPayment1: "", p2LaterPayment1: "",
  p2TotalLoan: "", p2OwnFunds: "", p2MonthlyInitial: "", p2MonthlyLater: "",
  p3Bank1: "", p3Amount1: "", p3RateType1: "変動金利", p3Period1: "", p3InitialRate1: "", p3LaterRate1: "", p3InitialPayment1: "", p3LaterPayment1: "",
  p3TotalLoan: "", p3OwnFunds: "", p3MonthlyInitial: "", p3MonthlyLater: "",
};

// 入力フィールド
function FI({ value, onChange, className = "", placeholder = "", w = "w-16" }: {
  value: string; onChange: (v: string) => void; className?: string; placeholder?: string; w?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`border-b border-gray-300 bg-transparent outline-none text-right print:border-b-0 ${w} ${className}`}
    />
  );
}

// 万円セル
function ManCell({ value, onChange, w = "w-14" }: { value: string; onChange: (v: string) => void; w?: string }) {
  return (
    <td className="border border-gray-400 px-1 py-0.5 text-right">
      <FI value={value} onChange={onChange} w={w} />
    </td>
  );
}

export default function FundingPlanForm() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [, params] = useRoute("/funding-plan/:id/edit");
  const editId = params?.id ? parseInt(params.id) : null;
  const isEditMode = editId !== null;

  const [f, setF] = useState<FundingPlanFormData>(defaultFormData);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(!isEditMode);
  const printRef = useRef<HTMLDivElement>(null);

  // 顧客カルテ紐付け
  const [customerFileId, setCustomerFileId] = useState<number | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(customerSearch), 300);
    return () => clearTimeout(t);
  }, [customerSearch]);

  const stableSearch = useMemo(() => debouncedSearch, [debouncedSearch]);
  const customerResults = trpc.customerFile.searchByName.useQuery(
    { search: stableSearch },
    { enabled: stableSearch.length >= 1 }
  );

  // URLパラメータから顧客情報を自動入力（顧客カルテからの直接作成）
  useEffect(() => {
    if (isEditMode) return;
    const sp = new URLSearchParams(window.location.search);
    const cfId = sp.get("customerFileId");
    const cfName = sp.get("customerName");
    const cfPrice = sp.get("propertyPrice");
    if (cfId) setCustomerFileId(parseInt(cfId));
    if (cfName || cfPrice) {
      setF(prev => ({
        ...prev,
        ...(cfName ? { customerName: cfName } : {}),
        ...(cfPrice ? { purchasePrice: cfPrice.replace(/[^0-9]/g, "") } : {}),
      }));
    }
  }, [isEditMode]);

  // 編集モード: 既存データ読み込み
  const existingData = trpc.fundingPlan.getById.useQuery(
    { id: editId! },
    { enabled: isEditMode }
  );

  useEffect(() => {
    if (isEditMode && existingData.data) {
      const d = existingData.data;
      if (d.formData && typeof d.formData === "object") {
        setF(d.formData as FundingPlanFormData);
      }
      if (d.customerFileId) {
        setCustomerFileId(d.customerFileId);
      }
      setLoaded(true);
    }
  }, [isEditMode, existingData.data]);

  const createMut = trpc.fundingPlan.create.useMutation();
  const updateMut = trpc.fundingPlan.update.useMutation();

  const u = useCallback((field: keyof FundingPlanFormData, value: string) => {
    setF(prev => ({ ...prev, [field]: value }));
  }, []);

  const handlePrint = useCallback(() => { window.print(); }, []);

  const [pdfGenerating, setPdfGenerating] = useState(false);

  // テンプレート機能
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateIsShared, setTemplateIsShared] = useState(false);
  const [templateTab, setTemplateTab] = useState<"personal" | "shared">("personal");
  const templateList = trpc.formTemplate.list.useQuery({ type: "fundingPlan" });
  const createTemplate = trpc.formTemplate.create.useMutation({
    onSuccess: () => { templateList.refetch(); setShowSaveTemplateDialog(false); setTemplateName(""); setTemplateIsShared(false); toast.success("テンプレートを保存しました"); },
  });
  const deleteTemplate = trpc.formTemplate.delete.useMutation({
    onSuccess: () => { templateList.refetch(); toast.success("テンプレートを削除しました"); },
  });

  const personalTemplates = useMemo(() => (templateList.data || []).filter((t: any) => !t.isShared), [templateList.data]);
  const sharedTemplates = useMemo(() => (templateList.data || []).filter((t: any) => t.isShared), [templateList.data]);

  const handleSaveTemplate = () => {
    if (!templateName.trim()) { toast.error("テンプレート名を入力してください"); return; }
    createTemplate.mutate({ name: templateName.trim(), type: "fundingPlan", formData: f, isShared: templateIsShared ? 1 : 0 });
  };
  const handleLoadTemplate = (tpl: any) => {
    if (tpl.formData && typeof tpl.formData === "object") {
      setF(tpl.formData as FundingPlanFormData);
      toast.success(`テンプレート「${tpl.name}」を読み込みました`);
    }
    setShowTemplateDialog(false);
  };
  const handleDownloadPdf = useCallback(async () => {
    if (!printRef.current) return;
    setPdfGenerating(true);
    try {
      const html2canvas = (await import("html2canvas-pro")).default;
      const { jsPDF } = await import("jspdf");
      const el = printRef.current;
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();
      const imgW = canvas.width;
      const imgH = canvas.height;
      const ratio = Math.min(pdfW / imgW, pdfH / imgH);
      const w = imgW * ratio;
      const h = imgH * ratio;
      const x = (pdfW - w) / 2;
      const y = 0;
      pdf.addImage(imgData, "PNG", x, y, w, h);
      pdf.save(`資金計画書_${f.customerName || "未設定"}.pdf`);
      toast.success("PDFをダウンロードしました");
    } catch (e: any) {
      toast.error(`PDF生成に失敗しました: ${e.message}`);
    } finally {
      setPdfGenerating(false);
    }
  }, [f]);

  // 諸費用小計の計算
  const calcExpenses = () => {
    const vals = [f.stampDuty, f.displayRegistration, f.registrationFee, f.fixedAssetTax, f.taxExtra1, f.taxExtra2,
      f.loanDocFee, f.loanStampDuty, f.loanFee1, f.loanFee2, f.loanFee3, f.loanExtra,
      f.financingFee, f.guaranteeFee, f.fireInsurance, f.flatInsurance, f.flatCertFee, f.loanExtra2,
      f.brokerageFee, f.managementFee, f.additionalWork, f.otherExtra];
    return vals.reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
  };

  const expenses = calcExpenses();
  const purchaseNum = parseFloat(f.purchasePrice) || 0;
  const landNum = parseFloat(f.landPrice) || 0;
  const subtotalProperty = purchaseNum + landNum;
  const totalBeforeOption = subtotalProperty + expenses;
  const optionTotal = (parseFloat(f.optionWork) || 0) + (parseFloat(f.consolidationLoan) || 0);
  const grandTotal = totalBeforeOption + optionTotal;

  const selectCustomerFile = (file: { id: number; customerName: string; fileNumber: string; propertyAddress: string | null; propertyPrice: string | null }) => {
    setCustomerFileId(file.id);
    setShowCustomerSearch(false);
    setCustomerSearch("");
    if (file.customerName) {
      setF(prev => ({ ...prev, customerName: prev.customerName || file.customerName }));
    }
    toast.success(`顧客カルテ「${file.customerName}」(${file.fileNumber})を紐付けました`);
  };

  const handleSave = async () => {
    if (!f.customerName.trim()) { toast.error("お客様名を入力してください"); return; }
    setSaving(true);
    try {
      if (isEditMode) {
        await updateMut.mutateAsync({
          id: editId!,
          customerName: f.customerName.trim(),
          propertyName: f.propertyType || undefined,
          formData: f,
          note: `購入価格: ${f.purchasePrice}万円 / 合計: ${grandTotal}万円`,
          customerFileId: customerFileId,
        });
        toast.success("資金計画書を更新しました");
      } else {
        await createMut.mutateAsync({
          customerName: f.customerName.trim(),
          propertyName: f.propertyType || undefined,
          fileUrl: "form-generated",
          fileName: `資金計画書_${f.customerName.trim()}.pdf`,
          fileType: "application/pdf",
          note: `購入価格: ${f.purchasePrice}万円 / 合計: ${grandTotal}万円`,
          formData: f,
          customerFileId: customerFileId,
        });
        toast.success("資金計画書を保存・投稿しました。管理者に通知が送信されました。");
      }
      navigate("/funding-plan");
    } catch (e: any) {
      toast.error(`保存に失敗しました: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const cellStyle = "border border-gray-400 px-1 py-0.5";
  const headerCell = "border border-gray-400 px-1 py-0.5 bg-gray-50 font-normal text-left whitespace-nowrap";

  if (!loaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500">読み込み中...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* ツールバー */}
      <div className="print:hidden sticky top-0 z-50 bg-white border-b shadow-sm">
        <div className="max-w-[1000px] mx-auto px-4 py-2 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/funding-plan")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> 一覧に戻る
          </Button>
          <div className="flex items-center gap-2">
            {/* 顧客カルテ紐付け */}
            <div className="relative">
              {customerFileId ? (
                <Button variant="outline" size="sm" className="text-green-600 border-green-300" onClick={() => setShowCustomerSearch(!showCustomerSearch)}>
                  <Link2 className="w-4 h-4 mr-1" /> カルテ紐付済
                  <button className="ml-1 hover:text-red-500" onClick={(e) => { e.stopPropagation(); setCustomerFileId(null); toast.info("紐付けを解除しました"); }}>
                    <X className="w-3 h-3" />
                  </button>
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setShowCustomerSearch(!showCustomerSearch)}>
                  <Search className="w-4 h-4 mr-1" /> 顧客カルテ紐付け
                </Button>
              )}
              {showCustomerSearch && (
                <div className="absolute right-0 top-full mt-1 w-80 bg-white border rounded-lg shadow-lg z-50 p-3">
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={e => setCustomerSearch(e.target.value)}
                    placeholder="お客様名で検索..."
                    className="w-full border rounded px-3 py-2 text-sm outline-none focus:border-blue-400"
                    autoFocus
                  />
                  {customerResults.data && customerResults.data.length > 0 && (
                    <div className="mt-2 max-h-48 overflow-y-auto">
                      {customerResults.data.map((cf: any) => (
                        <button
                          key={cf.id}
                          onClick={() => selectCustomerFile(cf)}
                          className="w-full text-left px-3 py-2 hover:bg-blue-50 rounded text-sm"
                        >
                          <div className="font-medium">{cf.customerName}</div>
                          <div className="text-xs text-gray-500">No.{cf.fileNumber} / {cf.assignee || "担当未設定"}{cf.propertyAddress ? ` / ${cf.propertyAddress}` : ""}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  {customerResults.data && customerResults.data.length === 0 && debouncedSearch && (
                    <p className="mt-2 text-sm text-gray-400 text-center">該当なし</p>
                  )}
                </div>
              )}
            </div>
            {/* テンプレート */}
            <Button variant="outline" size="sm" onClick={() => setShowTemplateDialog(true)}>
              <BookOpen className="w-4 h-4 mr-1" /> テンプレート
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowSaveTemplateDialog(true)}>
              <BookmarkPlus className="w-4 h-4 mr-1" /> 保存
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-1" /> 印刷
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={pdfGenerating}>
              {pdfGenerating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Download className="w-4 h-4 mr-1" />}
              PDF
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
              {isEditMode ? "更新" : "保存・投稿"}
            </Button>
          </div>
        </div>
      </div>

      {/* 資金計画書本体 */}
      <div className="max-w-[1000px] mx-auto py-4 px-2 print:py-0 print:px-0 print:max-w-none">
        <div
          ref={printRef}
          className="bg-white shadow-lg print:shadow-none mx-auto overflow-x-auto"
          style={{
            width: "297mm",
            minHeight: "210mm",
            padding: "8mm 10mm",
            fontFamily: "'Noto Sans JP', 'Hiragino Kaku Gothic ProN', sans-serif",
            fontSize: "8.5pt",
            lineHeight: "1.4",
            color: "#1a1a1a",
          }}
        >
          {/* ヘッダー */}
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-baseline gap-4">
              <span className="text-lg font-bold">資金計画書</span>
              <span className="text-base font-bold border-b-2 border-black">資金計画概算書</span>
            </div>
            <div className="text-right text-xs">
              <span>作成日：</span>
              <FI value={f.createdDate} onChange={v => u("createdDate", v)} w="w-32" className="text-left" />
              <br />
              <FI value={f.propertyType} onChange={v => u("propertyType", v)} w="w-20" className="text-left" />
            </div>
          </div>

          {/* 顧客情報 */}
          <div className="flex items-center gap-4 mb-2 flex-wrap" style={{ fontSize: "9pt" }}>
            <div className="flex items-center gap-1">
              <FI value={f.customerName} onChange={v => u("customerName", v)} w="w-32" className="text-left font-bold" placeholder="お客様名" />
              <span>様</span>
            </div>
            <div className="flex items-center gap-1">
              <span>誕生日</span>
              <FI value={f.birthEra} onChange={v => u("birthEra", v)} w="w-10" />
              <FI value={f.birthYear} onChange={v => u("birthYear", v)} w="w-8" />
              <span>年</span>
              <FI value={f.birthMonth} onChange={v => u("birthMonth", v)} w="w-6" />
              <span>月</span>
              <FI value={f.birthDay} onChange={v => u("birthDay", v)} w="w-6" />
              <span>日</span>
            </div>
            <div className="flex items-center gap-1">
              <FI value={f.age} onChange={v => u("age", v)} w="w-8" />
              <span>歳</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="whitespace-nowrap">年収</span>
              <FI value={f.annualIncome} onChange={v => u("annualIncome", v)} w="w-14" />
              <span>万円</span>
            </div>
          </div>

          <div className="flex items-center gap-1 mb-3" style={{ fontSize: "8pt" }}>
            <span>ローンが組める最長期間</span>
            <FI value={f.maxLoanPeriod} onChange={v => u("maxLoanPeriod", v)} w="w-8" className="border border-gray-400 text-center" />
            <span>年</span>
            <span className="ml-2 text-gray-500">(35年を上限にフラット35は+1年、ろうきんは-4年)</span>
          </div>

          {/* 必要資金 */}
          <div className="mb-2">
            <div className="inline-block bg-yellow-200 border border-yellow-500 px-2 py-0.5 font-bold text-sm mb-1">必要資金</div>
            <div className="flex items-center gap-2 mb-2">
              <span className="font-bold">購入価格</span>
              <div className="border border-gray-400 px-2 py-0.5">
                <FI value={f.purchasePrice} onChange={v => u("purchasePrice", v)} w="w-20" placeholder="1,899" />
              </div>
              <span>万円</span>
              <span>＋（土地</span>
              <div className="border border-gray-400 px-2 py-0.5">
                <FI value={f.landPrice} onChange={v => u("landPrice", v)} w="w-16" />
              </div>
              <span>万円）</span>
              <span>＝</span>
              <span className="font-bold ml-2">小計</span>
              <div className="border-2 border-gray-600 px-3 py-0.5 font-bold text-base">
                {subtotalProperty || ""}
              </div>
              <span className="font-bold">万円</span>
            </div>
          </div>

          {/* 税金・登記費用 + ローン関連 2列テーブル */}
          <div className="flex gap-4 mb-2">
            {/* 左列: 税金・登記費用 + ローン関連 */}
            <div className="flex-1">
              <div className="text-xs font-bold mb-1">《税金・登記費用など》</div>
              <table className="w-full border-collapse" style={{ fontSize: "8pt" }}>
                <tbody>
                  <tr>
                    <td className={headerCell}>契約時印紙代</td>
                    <ManCell value={f.stampDuty} onChange={v => u("stampDuty", v)} />
                    <td className={cellStyle}>万円</td>
                  </tr>
                  <tr>
                    <td className={headerCell}>表示登記料</td>
                    <ManCell value={f.displayRegistration} onChange={v => u("displayRegistration", v)} />
                    <td className={cellStyle}>万円</td>
                  </tr>
                  <tr>
                    <td className={headerCell}>登記費用(保存,設定など)+10万前後</td>
                    <ManCell value={f.registrationFee} onChange={v => u("registrationFee", v)} />
                    <td className={cellStyle}>万円</td>
                  </tr>
                </tbody>
              </table>

              <table className="w-full border-collapse mt-1" style={{ fontSize: "8pt" }}>
                <tbody>
                  <tr>
                    <td className={headerCell}>ローン事務書類作成費用(10万リービス)</td>
                    <ManCell value={f.loanDocFee} onChange={v => u("loanDocFee", v)} />
                    <td className={cellStyle}>万円</td>
                  </tr>
                  <tr>
                    <td className={headerCell}>ローン契約印紙代</td>
                    <ManCell value={f.loanStampDuty} onChange={v => u("loanStampDuty", v)} />
                    <td className={cellStyle}>万円</td>
                  </tr>
                  <tr>
                    <td className={headerCell}>住宅ローン融資事務手数料①</td>
                    <ManCell value={f.loanFee1} onChange={v => u("loanFee1", v)} />
                    <td className={cellStyle}>万円</td>
                  </tr>
                  <tr>
                    <td className={headerCell}>住宅ローン融資事務手数料②</td>
                    <ManCell value={f.loanFee2} onChange={v => u("loanFee2", v)} />
                    <td className={cellStyle}>万円</td>
                  </tr>
                  <tr>
                    <td className={headerCell}>住宅ローン融資事務手数料③</td>
                    <ManCell value={f.loanFee3} onChange={v => u("loanFee3", v)} />
                    <td className={cellStyle}>万円</td>
                  </tr>
                  <tr>
                    <td className={headerCell}></td>
                    <ManCell value={f.loanExtra} onChange={v => u("loanExtra", v)} />
                    <td className={cellStyle}>万円</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 右列 */}
            <div className="flex-1">
              <div className="text-xs font-bold mb-1">&nbsp;</div>
              <table className="w-full border-collapse" style={{ fontSize: "8pt" }}>
                <tbody>
                  <tr>
                    <td className={headerCell}>固定資産税等日割</td>
                    <ManCell value={f.fixedAssetTax} onChange={v => u("fixedAssetTax", v)} />
                    <td className={cellStyle}>万円</td>
                  </tr>
                  <tr>
                    <td className={headerCell}></td>
                    <ManCell value={f.taxExtra1} onChange={v => u("taxExtra1", v)} />
                    <td className={cellStyle}>万円</td>
                  </tr>
                  <tr>
                    <td className={headerCell}></td>
                    <ManCell value={f.taxExtra2} onChange={v => u("taxExtra2", v)} />
                    <td className={cellStyle}>万円</td>
                  </tr>
                </tbody>
              </table>

              <table className="w-full border-collapse mt-1" style={{ fontSize: "8pt" }}>
                <tbody>
                  <tr>
                    <td className={headerCell}>融資手数料</td>
                    <ManCell value={f.financingFee} onChange={v => u("financingFee", v)} />
                    <td className={cellStyle}>万円</td>
                  </tr>
                  <tr>
                    <td className={headerCell}>保証料②（諸費用分）</td>
                    <ManCell value={f.guaranteeFee} onChange={v => u("guaranteeFee", v)} />
                    <td className={cellStyle}>万円</td>
                  </tr>
                  <tr>
                    <td className={headerCell}>火災保険（任意）</td>
                    <ManCell value={f.fireInsurance} onChange={v => u("fireInsurance", v)} />
                    <td className={cellStyle}>万円</td>
                  </tr>
                  <tr>
                    <td className={headerCell}>フラット団体信用生命保険料</td>
                    <ManCell value={f.flatInsurance} onChange={v => u("flatInsurance", v)} />
                    <td className={cellStyle}>万円</td>
                  </tr>
                  <tr>
                    <td className={headerCell}>フラット適合証明書代</td>
                    <ManCell value={f.flatCertFee} onChange={v => u("flatCertFee", v)} />
                    <td className={cellStyle}>万円</td>
                  </tr>
                  <tr>
                    <td className={headerCell}></td>
                    <ManCell value={f.loanExtra2} onChange={v => u("loanExtra2", v)} />
                    <td className={cellStyle}>万円</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* その他 */}
          <div className="mb-2">
            <div className="text-xs font-bold mb-1">《その他》</div>
            <div className="flex gap-4">
              <table className="border-collapse" style={{ fontSize: "8pt" }}>
                <tbody>
                  <tr>
                    <td className={headerCell}>仲介手数料(3%+6万)×税</td>
                    <td className={cellStyle + " text-right"}>
                      <FI value={f.brokerageFeeCalc} onChange={v => u("brokerageFeeCalc", v)} w="w-12" placeholder="69万" />
                    </td>
                    <ManCell value={f.brokerageFee} onChange={v => u("brokerageFee", v)} />
                    <td className={cellStyle}>万円</td>
                  </tr>
                  <tr>
                    <td className={headerCell}>管理費・修繕積立金日割</td>
                    <td className={cellStyle}></td>
                    <ManCell value={f.managementFee} onChange={v => u("managementFee", v)} />
                    <td className={cellStyle}>万円</td>
                  </tr>
                </tbody>
              </table>
              <table className="border-collapse" style={{ fontSize: "8pt" }}>
                <tbody>
                  <tr>
                    <td className={headerCell}>追加工事</td>
                    <ManCell value={f.additionalWork} onChange={v => u("additionalWork", v)} />
                    <td className={cellStyle}>万円</td>
                  </tr>
                  <tr>
                    <td className={headerCell}></td>
                    <ManCell value={f.otherExtra} onChange={v => u("otherExtra", v)} />
                    <td className={cellStyle}>万円</td>
                  </tr>
                </tbody>
              </table>
              <div className="flex items-end gap-2 ml-auto">
                <span className="text-xs">小計</span>
                <div className="border-2 border-gray-600 px-3 py-0.5 font-bold">{expenses || ""}</div>
                <span>万円</span>
              </div>
            </div>
          </div>

          {/* 合計 */}
          <div className="flex items-center gap-2 mb-3 py-1 border-t border-b border-gray-400" style={{ fontSize: "10pt" }}>
            <span className="font-bold">物件価格</span>
            <span>＋</span>
            <span className="font-bold">諸費用</span>
            <span>＝</span>
            <span className="font-bold text-lg ml-2">合計</span>
            <div className="border-2 border-gray-800 px-4 py-0.5 font-bold text-lg ml-2">
              {totalBeforeOption ? totalBeforeOption.toLocaleString() : ""}
            </div>
            <span className="font-bold">万円</span>
          </div>

          {/* オプション */}
          <div className="mb-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-xs">○オプション工事、リフォーム、家具家電（任）</span>
              <span className="text-gray-500" style={{ fontSize: "7pt" }}>※数値は概算になります。※千の位を切り上げ</span>
            </div>
            <div className="flex gap-4 items-center">
              <table className="border-collapse" style={{ fontSize: "8pt" }}>
                <tbody>
                  <tr>
                    <td className={headerCell}>オプション工事/リフォーム/家電/家具</td>
                    <ManCell value={f.optionWork} onChange={v => u("optionWork", v)} />
                    <td className={cellStyle}>万円</td>
                  </tr>
                </tbody>
              </table>
              <table className="border-collapse" style={{ fontSize: "8pt" }}>
                <tbody>
                  <tr>
                    <td className={headerCell}>おまとめローン</td>
                    <ManCell value={f.consolidationLoan} onChange={v => u("consolidationLoan", v)} />
                    <td className={cellStyle}>万円</td>
                  </tr>
                </tbody>
              </table>
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-xs">小計</span>
                <div className="border border-gray-600 px-2 py-0.5 font-bold">{optionTotal || "0"}</div>
                <span>万円</span>
              </div>
            </div>
          </div>

          {/* 最終合計 */}
          <div className="flex items-center gap-2 mb-4 py-1 border-t-2 border-b-2 border-gray-600" style={{ fontSize: "11pt" }}>
            <span className="font-bold">物件価格</span>
            <span>＋</span>
            <span className="font-bold">諸費用</span>
            <span>＋</span>
            <span className="font-bold">オプション工事他</span>
            <span>＝</span>
            <span className="font-bold text-xl ml-2">合計</span>
            <div className="border-2 border-gray-800 px-4 py-1 font-bold text-xl ml-2">
              {grandTotal ? grandTotal.toLocaleString() : ""}
            </div>
            <span className="font-bold text-lg">万円</span>
          </div>

          {/* 資金計画 */}
          <div className="mb-2">
            <div className="inline-block bg-yellow-200 border border-yellow-500 px-2 py-0.5 font-bold text-sm mb-2">資金計画</div>

            {/* パターン1 */}
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-xs">＜パターン１＞</span>
                <FI value={f.p1Label} onChange={v => u("p1Label", v)} w="w-24" className="text-left" />
              </div>
              <table className="w-full border-collapse" style={{ fontSize: "7.5pt" }}>
                <thead>
                  <tr className="bg-gray-100">
                    <th className={cellStyle + " w-8"}>No</th>
                    <th className={cellStyle}>金融機関名</th>
                    <th className={cellStyle}>借入額</th>
                    <th className={cellStyle}>金利種類</th>
                    <th className={cellStyle + " w-8"}>期間</th>
                    <th className={cellStyle}>当初1年</th>
                    <th className={cellStyle}>2年以降</th>
                    <th className={cellStyle}>月々当初1年</th>
                    <th className={cellStyle}>2年目以降</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className={cellStyle + " text-center"}>①</td>
                    <td className={cellStyle}><FI value={f.p1Bank1} onChange={v => u("p1Bank1", v)} w="w-20" className="text-left" placeholder="東邦銀行" /></td>
                    <td className={cellStyle}><FI value={f.p1Amount1} onChange={v => u("p1Amount1", v)} w="w-16" />万円</td>
                    <td className={cellStyle}><FI value={f.p1RateType1} onChange={v => u("p1RateType1", v)} w="w-16" className="text-left" /></td>
                    <td className={cellStyle}><FI value={f.p1Period1} onChange={v => u("p1Period1", v)} w="w-6" />年</td>
                    <td className={cellStyle}><FI value={f.p1InitialRate1} onChange={v => u("p1InitialRate1", v)} w="w-12" />%</td>
                    <td className={cellStyle}><FI value={f.p1LaterRate1} onChange={v => u("p1LaterRate1", v)} w="w-12" />%</td>
                    <td className={cellStyle}><FI value={f.p1InitialPayment1} onChange={v => u("p1InitialPayment1", v)} w="w-16" />円</td>
                    <td className={cellStyle}><FI value={f.p1LaterPayment1} onChange={v => u("p1LaterPayment1", v)} w="w-16" />円</td>
                  </tr>
                  <tr>
                    <td className={cellStyle + " text-center"}>②</td>
                    <td className={cellStyle}><FI value={f.p1Bank2} onChange={v => u("p1Bank2", v)} w="w-20" className="text-left" /></td>
                    <td className={cellStyle}><FI value={f.p1Amount2} onChange={v => u("p1Amount2", v)} w="w-16" />万円</td>
                    <td className={cellStyle}><FI value={f.p1RateType2} onChange={v => u("p1RateType2", v)} w="w-16" className="text-left" /></td>
                    <td className={cellStyle}><FI value={f.p1Period2} onChange={v => u("p1Period2", v)} w="w-6" />年</td>
                    <td className={cellStyle}><FI value={f.p1InitialRate2} onChange={v => u("p1InitialRate2", v)} w="w-12" />%</td>
                    <td className={cellStyle}><FI value={f.p1LaterRate2} onChange={v => u("p1LaterRate2", v)} w="w-12" />%</td>
                    <td className={cellStyle}><FI value={f.p1InitialPayment2} onChange={v => u("p1InitialPayment2", v)} w="w-16" />円</td>
                    <td className={cellStyle}><FI value={f.p1LaterPayment2} onChange={v => u("p1LaterPayment2", v)} w="w-16" />円</td>
                  </tr>
                  <tr>
                    <td className={cellStyle + " text-center"}>③</td>
                    <td className={cellStyle}><FI value={f.p1Bank3} onChange={v => u("p1Bank3", v)} w="w-20" className="text-left" /></td>
                    <td className={cellStyle}><FI value={f.p1Amount3} onChange={v => u("p1Amount3", v)} w="w-16" />万円</td>
                    <td className={cellStyle}><FI value={f.p1RateType3} onChange={v => u("p1RateType3", v)} w="w-16" className="text-left" /></td>
                    <td className={cellStyle}><FI value={f.p1Period3} onChange={v => u("p1Period3", v)} w="w-6" />年</td>
                    <td className={cellStyle}><FI value={f.p1InitialRate3} onChange={v => u("p1InitialRate3", v)} w="w-12" />%</td>
                    <td className={cellStyle}><FI value={f.p1LaterRate3} onChange={v => u("p1LaterRate3", v)} w="w-12" />%</td>
                    <td className={cellStyle}><FI value={f.p1InitialPayment3} onChange={v => u("p1InitialPayment3", v)} w="w-16" />円</td>
                    <td className={cellStyle}><FI value={f.p1LaterPayment3} onChange={v => u("p1LaterPayment3", v)} w="w-16" />円</td>
                  </tr>
                </tbody>
              </table>
              <div className="flex items-center gap-4 mt-1" style={{ fontSize: "8pt" }}>
                <span>借入総額</span>
                <div className="border border-gray-400 px-2 py-0.5"><FI value={f.p1TotalLoan} onChange={v => u("p1TotalLoan", v)} w="w-16" />万円</div>
                <span>自己資金</span>
                <div className="border border-gray-400 px-2 py-0.5"><FI value={f.p1OwnFunds} onChange={v => u("p1OwnFunds", v)} w="w-12" />万円</div>
                <div className="ml-auto flex items-center gap-2 bg-yellow-100 border border-yellow-400 px-2 py-0.5 font-bold">
                  <span>毎月返済額</span>
                  <FI value={f.p1MonthlyInitial} onChange={v => u("p1MonthlyInitial", v)} w="w-16" />
                  <span>円</span>
                  <FI value={f.p1MonthlyLater} onChange={v => u("p1MonthlyLater", v)} w="w-16" />
                  <span>円</span>
                </div>
              </div>
            </div>

            {/* パターン2 */}
            <div className="mb-3">
              <div className="font-bold text-xs mb-1">＜パターン２＞</div>
              <table className="w-full border-collapse" style={{ fontSize: "7.5pt" }}>
                <thead>
                  <tr className="bg-gray-100">
                    <th className={cellStyle + " w-8"}>No</th>
                    <th className={cellStyle}>金融機関名</th>
                    <th className={cellStyle}>借入額</th>
                    <th className={cellStyle}>金利種類</th>
                    <th className={cellStyle + " w-8"}>期間</th>
                    <th className={cellStyle}>当初1年</th>
                    <th className={cellStyle}>2年以降</th>
                    <th className={cellStyle}>月々当初1年</th>
                    <th className={cellStyle}>2年目以降</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className={cellStyle + " text-center"}>①</td>
                    <td className={cellStyle}><FI value={f.p2Bank1} onChange={v => u("p2Bank1", v)} w="w-20" className="text-left" /></td>
                    <td className={cellStyle}><FI value={f.p2Amount1} onChange={v => u("p2Amount1", v)} w="w-16" />万円</td>
                    <td className={cellStyle}><FI value={f.p2RateType1} onChange={v => u("p2RateType1", v)} w="w-16" className="text-left" /></td>
                    <td className={cellStyle}><FI value={f.p2Period1} onChange={v => u("p2Period1", v)} w="w-6" />年</td>
                    <td className={cellStyle}><FI value={f.p2InitialRate1} onChange={v => u("p2InitialRate1", v)} w="w-12" />%</td>
                    <td className={cellStyle}><FI value={f.p2LaterRate1} onChange={v => u("p2LaterRate1", v)} w="w-12" />%</td>
                    <td className={cellStyle}><FI value={f.p2InitialPayment1} onChange={v => u("p2InitialPayment1", v)} w="w-16" />円</td>
                    <td className={cellStyle}><FI value={f.p2LaterPayment1} onChange={v => u("p2LaterPayment1", v)} w="w-16" />円</td>
                  </tr>
                </tbody>
              </table>
              <div className="flex items-center gap-4 mt-1" style={{ fontSize: "8pt" }}>
                <span>借入総額</span>
                <div className="border border-gray-400 px-2 py-0.5"><FI value={f.p2TotalLoan} onChange={v => u("p2TotalLoan", v)} w="w-16" />万円</div>
                <span>自己資金</span>
                <div className="border border-gray-400 px-2 py-0.5"><FI value={f.p2OwnFunds} onChange={v => u("p2OwnFunds", v)} w="w-12" />万円</div>
                <div className="ml-auto flex items-center gap-2 bg-yellow-100 border border-yellow-400 px-2 py-0.5 font-bold">
                  <span>毎月返済額</span>
                  <FI value={f.p2MonthlyInitial} onChange={v => u("p2MonthlyInitial", v)} w="w-16" />
                  <span>円</span>
                  <FI value={f.p2MonthlyLater} onChange={v => u("p2MonthlyLater", v)} w="w-16" />
                  <span>円</span>
                </div>
              </div>
            </div>

            {/* パターン3 */}
            <div className="mb-2">
              <div className="font-bold text-xs mb-1">＜パターン３＞</div>
              <table className="w-full border-collapse" style={{ fontSize: "7.5pt" }}>
                <thead>
                  <tr className="bg-gray-100">
                    <th className={cellStyle + " w-8"}>No</th>
                    <th className={cellStyle}>金融機関名</th>
                    <th className={cellStyle}>借入額</th>
                    <th className={cellStyle}>金利種類</th>
                    <th className={cellStyle + " w-8"}>期間</th>
                    <th className={cellStyle}>当初1年</th>
                    <th className={cellStyle}>2年以降</th>
                    <th className={cellStyle}>月々当初1年</th>
                    <th className={cellStyle}>2年目以降</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className={cellStyle + " text-center"}>①</td>
                    <td className={cellStyle}><FI value={f.p3Bank1} onChange={v => u("p3Bank1", v)} w="w-20" className="text-left" /></td>
                    <td className={cellStyle}><FI value={f.p3Amount1} onChange={v => u("p3Amount1", v)} w="w-16" />万円</td>
                    <td className={cellStyle}><FI value={f.p3RateType1} onChange={v => u("p3RateType1", v)} w="w-16" className="text-left" /></td>
                    <td className={cellStyle}><FI value={f.p3Period1} onChange={v => u("p3Period1", v)} w="w-6" />年</td>
                    <td className={cellStyle}><FI value={f.p3InitialRate1} onChange={v => u("p3InitialRate1", v)} w="w-12" />%</td>
                    <td className={cellStyle}><FI value={f.p3LaterRate1} onChange={v => u("p3LaterRate1", v)} w="w-12" />%</td>
                    <td className={cellStyle}><FI value={f.p3InitialPayment1} onChange={v => u("p3InitialPayment1", v)} w="w-16" />円</td>
                    <td className={cellStyle}><FI value={f.p3LaterPayment1} onChange={v => u("p3LaterPayment1", v)} w="w-16" />円</td>
                  </tr>
                </tbody>
              </table>
              <div className="flex items-center gap-4 mt-1" style={{ fontSize: "8pt" }}>
                <span>借入総額</span>
                <div className="border border-gray-400 px-2 py-0.5"><FI value={f.p3TotalLoan} onChange={v => u("p3TotalLoan", v)} w="w-16" />万円</div>
                <span>自己資金</span>
                <div className="border border-gray-400 px-2 py-0.5"><FI value={f.p3OwnFunds} onChange={v => u("p3OwnFunds", v)} w="w-12" />万円</div>
                <div className="ml-auto flex items-center gap-2 bg-yellow-100 border border-yellow-400 px-2 py-0.5 font-bold">
                  <span>毎月返済額</span>
                  <FI value={f.p3MonthlyInitial} onChange={v => u("p3MonthlyInitial", v)} w="w-16" />
                  <span>円</span>
                  <FI value={f.p3MonthlyLater} onChange={v => u("p3MonthlyLater", v)} w="w-16" />
                  <span>円</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 印刷用スタイル */}
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 0;
          }
          body { margin: 0; padding: 0; }
          .print\\:hidden { display: none !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:py-0 { padding-top: 0 !important; padding-bottom: 0 !important; }
          .print\\:px-0 { padding-left: 0 !important; padding-right: 0 !important; }
          .print\\:max-w-none { max-width: none !important; }
          .print\\:border-b-0 { border-bottom: none !important; }
          input[type="text"] { border-bottom: none !important; }
        }
      `}</style>

      {/* テンプレート読み込みダイアログ */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>テンプレートを選択</DialogTitle>
          </DialogHeader>
          {/* タブ切り替え */}
          <div className="flex gap-1 border-b mb-2">
            <button
              onClick={() => setTemplateTab("personal")}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                templateTab === "personal" ? "border-blue-600 text-blue-600" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <User className="w-3.5 h-3.5" /> 個人 ({personalTemplates.length})
            </button>
            <button
              onClick={() => setTemplateTab("shared")}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                templateTab === "shared" ? "border-green-600 text-green-600" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Users className="w-3.5 h-3.5" /> チーム共有 ({sharedTemplates.length})
            </button>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {(() => {
              const list = templateTab === "personal" ? personalTemplates : sharedTemplates;
              if (list.length === 0) return <p className="text-sm text-gray-400 text-center py-4">{templateTab === "personal" ? "個人テンプレートはありません" : "共有テンプレートはありません"}</p>;
              return list.map((tpl: any) => (
                <div key={tpl.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30">
                  <button className="flex-1 text-left" onClick={() => handleLoadTemplate(tpl)}>
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-sm">{tpl.name}</span>
                      {tpl.isShared ? <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">共有</span> : null}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {tpl.ownerName && <span>{tpl.ownerName} · </span>}
                      {new Date(tpl.updatedAt).toLocaleDateString("ja-JP")}
                    </div>
                  </button>
                  {tpl.ownerId === user?.id && (
                    <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-600" onClick={() => deleteTemplate.mutate({ id: tpl.id })}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ));
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* テンプレート保存ダイアログ */}
      <Dialog open={showSaveTemplateDialog} onOpenChange={setShowSaveTemplateDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>現在の入力内容をテンプレートとして保存</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={templateName}
              onChange={e => setTemplateName(e.target.value)}
              placeholder="テンプレート名（例: 東邦銀行35年パターン）"
              autoFocus
            />
            <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/20">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-green-600" />
                <div>
                  <div className="text-sm font-medium">チーム全体で共有</div>
                  <div className="text-xs text-muted-foreground">全メンバーが使用可能になります</div>
                </div>
              </div>
              <Switch checked={templateIsShared} onCheckedChange={setTemplateIsShared} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveTemplateDialog(false)}>キャンセル</Button>
            <Button onClick={handleSaveTemplate} disabled={createTemplate.isPending}>
              {createTemplate.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <BookmarkPlus className="w-4 h-4 mr-1" />}
              {templateIsShared ? "共有テンプレートとして保存" : "個人テンプレートとして保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
