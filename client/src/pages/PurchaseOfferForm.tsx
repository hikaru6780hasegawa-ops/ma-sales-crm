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

// 買付証明書のフォームデータ型
interface PurchaseOfferFormData {
  year: string;
  month: string;
  day: string;
  addressee: string;
  buyerAddress1: string;
  buyerAddress2: string;
  buyerName1: string;
  buyerName2: string;
  brokerCompany: string;
  brokerName: string;
  brokerAddress: string;
  brokerPhone: string;
  propertyName: string;
  propertyLocation: string;
  landArea: string;
  landTsubo: string;
  buildingArea: string;
  buildingTsubo: string;
  purchasePrice: string;
  depositAmount: string;
  paymentMethod: string;
  validYear: string;
  validMonth: string;
  validDay: string;
  otherConditions: string;
}

const defaultFormData: PurchaseOfferFormData = {
  year: new Date().getFullYear().toString(),
  month: (new Date().getMonth() + 1).toString(),
  day: new Date().getDate().toString(),
  addressee: "",
  buyerAddress1: "東京都中央区日本橋人形町1-5-8",
  buyerAddress2: "アトリウム日本橋人形町4F",
  buyerName1: "株式会社Martial Arts",
  buyerName2: "長谷川　光",
  brokerCompany: "",
  brokerName: "",
  brokerAddress: "",
  brokerPhone: "",
  propertyName: "",
  propertyLocation: "",
  landArea: "",
  landTsubo: "",
  buildingArea: "",
  buildingTsubo: "",
  purchasePrice: "",
  depositAmount: "",
  paymentMethod: "現金",
  validYear: new Date().getFullYear().toString(),
  validMonth: (new Date().getMonth() + 1).toString(),
  validDay: "",
  otherConditions: "・引き渡しの期日を契約締結日から2ヶ月間とする\n・当社指定の司法書士に委託する\n・決済形態について、同日での連件決済登記とする（※中間省略ではない）\n・手付金解除期日に付きましては売主様と弊社間にて要相談とする\n・買付受理後、各ネット広告、及びレインズ掲載の削除とする",
};

function sqmToTsubo(sqm: string): string {
  const val = parseFloat(sqm);
  if (isNaN(val)) return "";
  return (val * 0.3025).toFixed(2);
}

export default function PurchaseOfferForm() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [, params] = useRoute("/purchase-offer/:id/edit");
  const editId = params?.id ? parseInt(params.id) : null;
  const isEditMode = editId !== null;

  const [formData, setFormData] = useState<PurchaseOfferFormData>(defaultFormData);
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
    const cfAddr = sp.get("propertyAddress");
    if (cfId) setCustomerFileId(parseInt(cfId));
    if (cfName || cfAddr) {
      setFormData(prev => ({
        ...prev,
        ...(cfName ? { buyerName1: cfName } : {}),
        ...(cfAddr ? { propertyLocation: cfAddr, propertyName: cfAddr } : {}),
      }));
    }
  }, [isEditMode]);

  // 編集モード: 既存データ読み込み
  const existingData = trpc.purchaseOffer.getById.useQuery(
    { id: editId! },
    { enabled: isEditMode }
  );

  useEffect(() => {
    if (isEditMode && existingData.data) {
      const d = existingData.data;
      if (d.formData && typeof d.formData === "object") {
        setFormData(d.formData as PurchaseOfferFormData);
      }
      if (d.customerFileId) {
        setCustomerFileId(d.customerFileId);
      }
      setLoaded(true);
    }
  }, [isEditMode, existingData.data]);

  const createMut = trpc.purchaseOffer.create.useMutation();
  const updateMut = trpc.purchaseOffer.update.useMutation();

  const updateField = useCallback((field: keyof PurchaseOfferFormData, value: string) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value };
      if (field === "landArea") next.landTsubo = sqmToTsubo(value);
      if (field === "buildingArea") next.buildingTsubo = sqmToTsubo(value);
      return next;
    });
  }, []);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const [pdfGenerating, setPdfGenerating] = useState(false);

  // テンプレート機能
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateIsShared, setTemplateIsShared] = useState(false);
  const [templateTab, setTemplateTab] = useState<"personal" | "shared">("personal");
  const templateList = trpc.formTemplate.list.useQuery({ type: "purchaseOffer" });
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
    createTemplate.mutate({ name: templateName.trim(), type: "purchaseOffer", formData, isShared: templateIsShared ? 1 : 0 });
  };

  const handleLoadTemplate = (tpl: any) => {
    if (tpl.formData && typeof tpl.formData === "object") {
      setFormData(tpl.formData as PurchaseOfferFormData);
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
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
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
      const name = formData.buyerName1 || formData.addressee || "買付証明書";
      pdf.save(`買付証明書_${name}.pdf`);
      toast.success("PDFをダウンロードしました");
    } catch (e: any) {
      toast.error(`PDF生成に失敗しました: ${e.message}`);
    } finally {
      setPdfGenerating(false);
    }
  }, [formData]);

  const handleSave = async () => {
    if (!formData.addressee.trim() && !formData.propertyName.trim()) {
      toast.error("宛先または物件名を入力してください");
      return;
    }
    setSaving(true);
    try {
      if (isEditMode) {
        await updateMut.mutateAsync({
          id: editId!,
          customerName: formData.addressee || formData.buyerName1,
          propertyName: formData.propertyName || undefined,
          propertyAddress: formData.propertyLocation || undefined,
          purchasePrice: formData.purchasePrice ? `${formData.purchasePrice}万円` : undefined,
          deposit: formData.depositAmount ? `${formData.depositAmount}万円` : undefined,
          formData: formData,
          note: formData.otherConditions || undefined,
          customerFileId: customerFileId,
        });
        toast.success("買付証明書を更新しました");
      } else {
        await createMut.mutateAsync({
          customerName: formData.addressee || formData.buyerName1,
          propertyName: formData.propertyName || undefined,
          propertyAddress: formData.propertyLocation || undefined,
          purchasePrice: formData.purchasePrice ? `${formData.purchasePrice}万円` : undefined,
          deposit: formData.depositAmount ? `${formData.depositAmount}万円` : undefined,
          fileUrl: "form-generated",
          fileName: `買付証明書_${formData.addressee || formData.propertyName}.pdf`,
          fileType: "application/pdf",
          note: formData.otherConditions || undefined,
          formData: formData,
          customerFileId: customerFileId,
        });
        toast.success("買付証明書を保存・投稿しました。管理者に通知が送信されました。");
      }
      navigate("/purchase-offer");
    } catch (e: any) {
      toast.error(`保存に失敗しました: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const selectCustomerFile = (file: { id: number; customerName: string; fileNumber: string; propertyAddress: string | null; propertyPrice: string | null }) => {
    setCustomerFileId(file.id);
    setShowCustomerSearch(false);
    setCustomerSearch("");
    // 顧客カルテの情報をフォームに自動入力
    if (file.customerName) {
      setFormData(prev => ({
        ...prev,
        addressee: prev.addressee || file.customerName,
      }));
    }
    if (file.propertyAddress) {
      setFormData(prev => ({
        ...prev,
        propertyLocation: prev.propertyLocation || file.propertyAddress || "",
      }));
    }
    toast.success(`顧客カルテ「${file.customerName}」(${file.fileNumber})を紐付けました`);
  };

  const FormInput = ({ value, onChange, className = "", placeholder = "", style = {} }: {
    value: string;
    onChange: (v: string) => void;
    className?: string;
    placeholder?: string;
    style?: React.CSSProperties;
  }) => (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`border-b border-gray-300 bg-transparent outline-none text-center print:border-b-0 ${className}`}
      style={style}
    />
  );

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
      {/* ツールバー（印刷時非表示） */}
      <div className="print:hidden sticky top-0 z-50 bg-white border-b shadow-sm">
        <div className="max-w-[900px] mx-auto px-4 py-2 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/purchase-offer")}>
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
                      {customerResults.data.map((f: any) => (
                        <button
                          key={f.id}
                          onClick={() => selectCustomerFile(f)}
                          className="w-full text-left px-3 py-2 hover:bg-blue-50 rounded text-sm"
                        >
                          <div className="font-medium">{f.customerName}</div>
                          <div className="text-xs text-gray-500">No.{f.fileNumber} / {f.assignee || "担当未設定"}{f.propertyAddress ? ` / ${f.propertyAddress}` : ""}</div>
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

      {/* 買付証明書本体 */}
      <div className="max-w-[900px] mx-auto py-6 px-4 print:py-0 print:px-0 print:max-w-none">
        <div
          ref={printRef}
          className="bg-white shadow-lg print:shadow-none mx-auto"
          style={{
            width: "210mm",
            minHeight: "297mm",
            padding: "15mm 20mm",
            fontFamily: "'Noto Serif JP', 'Yu Mincho', '游明朝', serif",
            fontSize: "11pt",
            lineHeight: "1.8",
            color: "#1a1a1a",
          }}
        >
          {/* タイトル */}
          <h1 className="text-center text-3xl font-bold tracking-[0.3em] mb-8" style={{ fontFamily: "'Noto Serif JP', serif" }}>
            買付証明書
          </h1>

          {/* 日付 */}
          <div className="text-right mb-6 flex items-center justify-end gap-1" style={{ fontSize: "11pt" }}>
            <FormInput value={formData.year} onChange={v => updateField("year", v)} className="w-16 text-right" />
            <span>年</span>
            <FormInput value={formData.month} onChange={v => updateField("month", v)} className="w-10 text-right" />
            <span>月</span>
            <FormInput value={formData.day} onChange={v => updateField("day", v)} className="w-10 text-right" />
            <span>日</span>
          </div>

          {/* 宛先と買主情報 */}
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <div className="flex items-end gap-2 mb-2">
                <FormInput value={formData.addressee} onChange={v => updateField("addressee", v)} className="flex-1 text-left text-base" placeholder="㈱○○○○" />
                <span className="whitespace-nowrap ml-4" style={{ fontSize: "11pt" }}>御中</span>
              </div>
              <div className="border-b-2 border-black" />
            </div>
            <div className="ml-8 text-right" style={{ fontSize: "10pt" }}>
              <table className="ml-auto">
                <tbody>
                  <tr>
                    <td className="pr-2 align-top whitespace-nowrap">買主</td>
                    <td className="pr-2 align-top whitespace-nowrap">住所</td>
                    <td className="text-left">
                      <FormInput value={formData.buyerAddress1} onChange={v => updateField("buyerAddress1", v)} className="w-64 text-left" style={{ fontSize: "10pt" }} />
                      <br />
                      <FormInput value={formData.buyerAddress2} onChange={v => updateField("buyerAddress2", v)} className="w-64 text-left" style={{ fontSize: "10pt" }} />
                    </td>
                  </tr>
                  <tr>
                    <td></td>
                    <td className="pr-2 whitespace-nowrap">氏名</td>
                    <td className="text-left">
                      <FormInput value={formData.buyerName1} onChange={v => updateField("buyerName1", v)} className="w-64 text-left" style={{ fontSize: "10pt" }} />
                      <br />
                      <FormInput value={formData.buyerName2} onChange={v => updateField("buyerName2", v)} className="w-64 text-left" style={{ fontSize: "10pt" }} />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 仲介業者 */}
          <div className="flex justify-center mb-4" style={{ fontSize: "10pt" }}>
            <table className="border-collapse">
              <tbody>
                <tr>
                  <td className="pr-4 text-right align-top" rowSpan={2}>
                    <FormInput value={formData.brokerCompany} onChange={v => updateField("brokerCompany", v)} className="w-40 text-center" placeholder="仲介業者名" style={{ fontSize: "10pt" }} />
                    <br />
                    <FormInput value={formData.brokerName} onChange={v => updateField("brokerName", v)} className="w-40 text-center" placeholder="担当者名" style={{ fontSize: "10pt" }} />
                  </td>
                  <td className="text-left">
                    <FormInput value={formData.brokerAddress} onChange={v => updateField("brokerAddress", v)} className="w-48 text-left" placeholder="住所" style={{ fontSize: "10pt" }} />
                  </td>
                </tr>
                <tr>
                  <td className="text-left">
                    <FormInput value={formData.brokerPhone} onChange={v => updateField("brokerPhone", v)} className="w-48 text-left" placeholder="電話番号" style={{ fontSize: "10pt" }} />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 本文 */}
          <p className="mb-4 text-center" style={{ fontSize: "11pt" }}>
            私は、下記不動産を、下記の条件にて購入したく、買い付けることを証明いたします。
          </p>

          {/* 記 */}
          <p className="text-center font-bold mb-6" style={{ fontSize: "13pt" }}>記</p>

          {/* 1. 物件 */}
          <div className="mb-6">
            <div className="flex items-start gap-4 mb-2">
              <span className="whitespace-nowrap font-bold" style={{ minWidth: "80px" }}>１．物件</span>
              <table className="flex-1 border-collapse" style={{ fontSize: "11pt" }}>
                <tbody>
                  <tr className="border-b border-gray-300">
                    <td className="py-1 pr-4 whitespace-nowrap w-20">物件名</td>
                    <td className="py-1">
                      <FormInput value={formData.propertyName} onChange={v => updateField("propertyName", v)} className="w-full text-left" placeholder="例: ひたちなか市津田東1丁目中古戸建" />
                    </td>
                  </tr>
                  <tr className="border-b border-gray-300">
                    <td className="py-1 pr-4 whitespace-nowrap">所　在</td>
                    <td className="py-1">
                      <FormInput value={formData.propertyLocation} onChange={v => updateField("propertyLocation", v)} className="w-full text-left" placeholder="例: ひたちなか市津田東1丁目12-5" />
                    </td>
                  </tr>
                  <tr className="border-b border-gray-300">
                    <td className="py-1 pr-4 whitespace-nowrap">土　地</td>
                    <td className="py-1 flex items-center gap-2">
                      <FormInput value={formData.landArea} onChange={v => updateField("landArea", v)} className="w-24 text-right" placeholder="200.01" />
                      <span>m²（</span>
                      <FormInput value={formData.landTsubo} onChange={v => updateField("landTsubo", v)} className="w-20 text-right" />
                      <span>坪）</span>
                    </td>
                  </tr>
                  <tr className="border-b border-gray-300">
                    <td className="py-1 pr-4 whitespace-nowrap">建　物</td>
                    <td className="py-1 flex items-center gap-2">
                      <FormInput value={formData.buildingArea} onChange={v => updateField("buildingArea", v)} className="w-24 text-right" placeholder="101.02" />
                      <span>m²（</span>
                      <FormInput value={formData.buildingTsubo} onChange={v => updateField("buildingTsubo", v)} className="w-20 text-right" />
                      <span>坪）</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 2. 条件 */}
          <div className="mb-6">
            <div className="flex items-start gap-4">
              <span className="whitespace-nowrap font-bold" style={{ minWidth: "80px" }}>２．条件</span>
              <table className="flex-1 border-collapse" style={{ fontSize: "11pt" }}>
                <tbody>
                  <tr className="border-b border-gray-300">
                    <td className="py-1 pr-2 whitespace-nowrap">購入希望価格　金</td>
                    <td className="py-1 flex items-center gap-2">
                      <FormInput value={formData.purchasePrice} onChange={v => updateField("purchasePrice", v)} className="w-28 text-right" placeholder="1,630" />
                      <span>万円也</span>
                    </td>
                  </tr>
                  <tr className="border-b border-gray-300">
                    <td className="py-1 pr-2 whitespace-nowrap">手付金　　　　金</td>
                    <td className="py-1 flex items-center gap-2">
                      <FormInput value={formData.depositAmount} onChange={v => updateField("depositAmount", v)} className="w-28 text-right" placeholder="50" />
                      <span>万円也</span>
                      <span className="ml-4 text-sm">※購入価格に充当</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 3. 支払方法 */}
          <div className="mb-6">
            <div className="flex items-center gap-4">
              <span className="whitespace-nowrap font-bold" style={{ minWidth: "80px" }}>３．支払方法</span>
              <span className="mr-2">・</span>
              <FormInput value={formData.paymentMethod} onChange={v => updateField("paymentMethod", v)} className="w-40 text-left" />
            </div>
          </div>

          {/* 4. 有効期間 */}
          <div className="mb-6">
            <div className="flex items-center gap-4">
              <span className="whitespace-nowrap font-bold" style={{ minWidth: "80px" }}>４．有効期間</span>
              <span>本書面の有効期間は</span>
              <FormInput value={formData.validYear} onChange={v => updateField("validYear", v)} className="w-16 text-right" />
              <span>年</span>
              <FormInput value={formData.validMonth} onChange={v => updateField("validMonth", v)} className="w-10 text-right" />
              <span>月</span>
              <FormInput value={formData.validDay} onChange={v => updateField("validDay", v)} className="w-10 text-right" />
              <span>日まで</span>
            </div>
          </div>

          {/* 5. その他条件 */}
          <div className="mb-4">
            <div className="flex items-start gap-4">
              <span className="whitespace-nowrap font-bold" style={{ minWidth: "80px" }}>５．その他条件</span>
            </div>
            <div className="mt-2 ml-4">
              <textarea
                value={formData.otherConditions}
                onChange={e => updateField("otherConditions", e.target.value)}
                className="w-full border border-gray-200 rounded p-2 outline-none resize-none print:border-0 print:p-0"
                rows={8}
                style={{ fontFamily: "'Noto Serif JP', serif", fontSize: "10.5pt", lineHeight: "2" }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 印刷用スタイル */}
      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
          body { margin: 0; padding: 0; }
          .print\\:hidden { display: none !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:py-0 { padding-top: 0 !important; padding-bottom: 0 !important; }
          .print\\:px-0 { padding-left: 0 !important; padding-right: 0 !important; }
          .print\\:max-w-none { max-width: none !important; }
          .print\\:border-0 { border: none !important; }
          .print\\:p-0 { padding: 0 !important; }
          .print\\:border-b-0 { border-bottom: none !important; }
          input[type="text"] { border-bottom: none !important; }
          textarea { border: none !important; padding: 0 !important; overflow: hidden !important; }
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
              placeholder="テンプレート名（例: 株式K-LINK宛）"
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
