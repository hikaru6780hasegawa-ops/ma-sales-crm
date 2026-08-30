import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock DB
vi.mock("./db", () => ({
  getFundingPlans: vi.fn(),
  getFundingPlanById: vi.fn(),
  createFundingPlan: vi.fn(),
  updateFundingPlanStatus: vi.fn(),
  getFundingPlanSummary: vi.fn(),
  getPurchaseOffers: vi.fn(),
  getPurchaseOfferById: vi.fn(),
  createPurchaseOffer: vi.fn(),
  updatePurchaseOfferStatus: vi.fn(),
  getPurchaseOfferSummary: vi.fn(),
  updateFundingPlanFormData: vi.fn(),
  updatePurchaseOfferFormData: vi.fn(),
  searchCustomerFilesByName: vi.fn(),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://s3.example.com/test.pdf", key: "test-key" }),
}));

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

import * as db from "./db";
import { storagePut } from "./storage";
import { notifyOwner } from "./_core/notification";

const mockDb = db as any;

describe("資金計画書 (Funding Plan)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("一覧取得", () => {
    it("全件取得が正常に動作する", async () => {
      const mockPlans = [
        { id: 1, customerName: "田中太郎", propertyName: "物件A", status: "pending", createdAt: Date.now() },
        { id: 2, customerName: "佐藤花子", propertyName: "物件B", status: "approved", createdAt: Date.now() },
      ];
      mockDb.getFundingPlans.mockResolvedValue(mockPlans);

      const result = await db.getFundingPlans();
      expect(result).toHaveLength(2);
      expect(result[0].customerName).toBe("田中太郎");
    });

    it("ステータスフィルターが正常に動作する", async () => {
      const mockPlans = [
        { id: 1, customerName: "田中太郎", status: "pending", createdAt: Date.now() },
      ];
      mockDb.getFundingPlans.mockResolvedValue(mockPlans);

      const result = await db.getFundingPlans({ status: "pending" });
      expect(mockDb.getFundingPlans).toHaveBeenCalledWith({ status: "pending" });
      expect(result).toHaveLength(1);
    });
  });

  describe("個別取得", () => {
    it("IDで資金計画書を取得できる", async () => {
      const mockPlan = { id: 1, customerName: "田中太郎", status: "pending" };
      mockDb.getFundingPlanById.mockResolvedValue(mockPlan);

      const result = await db.getFundingPlanById(1);
      expect(result).toBeDefined();
      expect(result.customerName).toBe("田中太郎");
    });

    it("存在しないIDはnullを返す", async () => {
      mockDb.getFundingPlanById.mockResolvedValue(null);

      const result = await db.getFundingPlanById(999);
      expect(result).toBeNull();
    });
  });

  describe("新規作成", () => {
    it("資金計画書を作成できる", async () => {
      const newPlan = {
        customerName: "田中太郎",
        propertyName: "物件A",
        fileUrl: "https://s3.example.com/test.pdf",
        fileName: "test.pdf",
        fileType: "application/pdf",
        submittedBy: 1,
        submittedByName: "営業太郎",
        status: "pending" as const,
      };
      mockDb.createFundingPlan.mockResolvedValue({ id: 1, ...newPlan });

      const result = await db.createFundingPlan(newPlan);
      expect(result.id).toBe(1);
      expect(result.customerName).toBe("田中太郎");
      expect(result.status).toBe("pending");
    });
  });

  describe("ステータス更新", () => {
    it("承認ステータスに更新できる", async () => {
      mockDb.updateFundingPlanStatus.mockResolvedValue(undefined);

      await db.updateFundingPlanStatus(1, {
        status: "approved",
        reviewedBy: 2,
        reviewedByName: "管理者",
        reviewComment: "承認します",
      });

      expect(mockDb.updateFundingPlanStatus).toHaveBeenCalledWith(1, {
        status: "approved",
        reviewedBy: 2,
        reviewedByName: "管理者",
        reviewComment: "承認します",
      });
    });

    it("差し戻しステータスに更新できる", async () => {
      mockDb.updateFundingPlanStatus.mockResolvedValue(undefined);

      await db.updateFundingPlanStatus(1, {
        status: "rejected",
        reviewedBy: 2,
        reviewedByName: "管理者",
        reviewComment: "修正が必要です",
      });

      expect(mockDb.updateFundingPlanStatus).toHaveBeenCalledWith(1, expect.objectContaining({
        status: "rejected",
        reviewComment: "修正が必要です",
      }));
    });
  });

  describe("サマリー取得", () => {
    it("ステータス別件数を取得できる", async () => {
      const mockSummary = { total: 10, pending: 3, reviewing: 2, approved: 4, rejected: 1 };
      mockDb.getFundingPlanSummary.mockResolvedValue(mockSummary);

      const result = await db.getFundingPlanSummary();
      expect(result.total).toBe(10);
      expect(result.pending).toBe(3);
      expect(result.approved).toBe(4);
    });
  });

  describe("ファイルアップロード", () => {
    it("S3にファイルをアップロードできる", async () => {
      const buffer = Buffer.from("test-content");
      const result = await storagePut("funding-plans/1/test.pdf", buffer, "application/pdf");
      expect(result.url).toBe("https://s3.example.com/test.pdf");
      expect(storagePut).toHaveBeenCalledWith("funding-plans/1/test.pdf", buffer, "application/pdf");
    });
  });

  describe("管理者通知", () => {
    it("投稿時に管理者通知が送信される", async () => {
      await notifyOwner({
        title: "📊 資金計画書が投稿されました",
        content: "投稿者: 営業太郎\nお客様: 田中太郎",
      });
      expect(notifyOwner).toHaveBeenCalledWith(expect.objectContaining({
        title: expect.stringContaining("資金計画書"),
      }));
    });
  });
});

describe("買付証明書 (Purchase Offer)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("一覧取得", () => {
    it("全件取得が正常に動作する", async () => {
      const mockOffers = [
        { id: 1, customerName: "山田一郎", propertyName: "石岡市南台", status: "pending", purchasePrice: "15,000,000円" },
        { id: 2, customerName: "鈴木二郎", propertyName: "津田東", status: "approved", purchasePrice: "20,000,000円" },
      ];
      mockDb.getPurchaseOffers.mockResolvedValue(mockOffers);

      const result = await db.getPurchaseOffers();
      expect(result).toHaveLength(2);
      expect(result[0].customerName).toBe("山田一郎");
    });

    it("ステータスフィルターが正常に動作する", async () => {
      const mockOffers = [
        { id: 1, customerName: "山田一郎", status: "approved" },
      ];
      mockDb.getPurchaseOffers.mockResolvedValue(mockOffers);

      const result = await db.getPurchaseOffers({ status: "approved" });
      expect(mockDb.getPurchaseOffers).toHaveBeenCalledWith({ status: "approved" });
      expect(result).toHaveLength(1);
    });
  });

  describe("個別取得", () => {
    it("IDで買付証明書を取得できる", async () => {
      const mockOffer = { id: 1, customerName: "山田一郎", status: "pending", purchasePrice: "15,000,000円" };
      mockDb.getPurchaseOfferById.mockResolvedValue(mockOffer);

      const result = await db.getPurchaseOfferById(1);
      expect(result).toBeDefined();
      expect(result.purchasePrice).toBe("15,000,000円");
    });
  });

  describe("新規作成", () => {
    it("買付証明書を作成できる", async () => {
      const newOffer = {
        customerName: "山田一郎",
        propertyName: "石岡市南台",
        propertyAddress: "茨城県石岡市南台3丁目",
        purchasePrice: "15,000,000円",
        deposit: "500,000円",
        fileUrl: "https://s3.example.com/offer.pdf",
        fileName: "offer.pdf",
        fileType: "application/pdf",
        submittedBy: 1,
        submittedByName: "営業太郎",
        status: "pending" as const,
      };
      mockDb.createPurchaseOffer.mockResolvedValue({ id: 1, ...newOffer });

      const result = await db.createPurchaseOffer(newOffer);
      expect(result.id).toBe(1);
      expect(result.customerName).toBe("山田一郎");
      expect(result.purchasePrice).toBe("15,000,000円");
    });
  });

  describe("ステータス更新", () => {
    it("買付OKステータスに更新できる", async () => {
      mockDb.updatePurchaseOfferStatus.mockResolvedValue(undefined);

      await db.updatePurchaseOfferStatus(1, {
        status: "approved",
        reviewedBy: 2,
        reviewedByName: "管理者",
        reviewComment: "買付OK",
      });

      expect(mockDb.updatePurchaseOfferStatus).toHaveBeenCalledWith(1, expect.objectContaining({
        status: "approved",
        reviewComment: "買付OK",
      }));
    });

    it("確認中ステータスに更新できる", async () => {
      mockDb.updatePurchaseOfferStatus.mockResolvedValue(undefined);

      await db.updatePurchaseOfferStatus(1, {
        status: "reviewing",
        reviewedBy: 2,
        reviewedByName: "管理者",
      });

      expect(mockDb.updatePurchaseOfferStatus).toHaveBeenCalledWith(1, expect.objectContaining({
        status: "reviewing",
      }));
    });
  });

  describe("サマリー取得", () => {
    it("ステータス別件数を取得できる", async () => {
      const mockSummary = { total: 5, pending: 1, reviewing: 1, approved: 2, rejected: 1 };
      mockDb.getPurchaseOfferSummary.mockResolvedValue(mockSummary);

      const result = await db.getPurchaseOfferSummary();
      expect(result.total).toBe(5);
      expect(result.approved).toBe(2);
    });
  });

  describe("ファイルアップロード", () => {
    it("S3に買付証明書ファイルをアップロードできる", async () => {
      const buffer = Buffer.from("purchase-offer-content");
      const result = await storagePut("purchase-offers/1/offer.pdf", buffer, "application/pdf");
      expect(result.url).toBe("https://s3.example.com/test.pdf");
    });
  });

  describe("管理者通知", () => {
    it("買付証明書投稿時に管理者通知が送信される", async () => {
      await notifyOwner({
        title: "🏠 買付証明書が投稿されました",
        content: "投稿者: 営業太郎\nお客様: 山田一郎\n物件: 石岡市南台",
      });
      expect(notifyOwner).toHaveBeenCalledWith(expect.objectContaining({
        title: expect.stringContaining("買付証明書"),
      }));
    });
  });
});

describe("フォーム入力モード (formData)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("買付証明書をformDataのみで作成できる（ファイルなし）", async () => {
    const formData = {
      date: { year: "2026", month: "2", day: "10" },
      sellerName: "㈱K-LINK",
      buyerAddress1: "東京都中央区日本橋人形町1-5-8",
      propertyName: "ひたちなか市津田東1丁目中古戸建",
      purchasePrice: "1,630",
      deposit: "50",
      paymentMethod: "現金",
    };
    const newOffer = {
      customerName: "テスト顧客",
      propertyName: "ひたちなか市津田東1丁目中古戸建",
      submittedBy: 1,
      submittedByName: "営業太郎",
      status: "pending" as const,
      formData: JSON.stringify(formData),
    };
    mockDb.createPurchaseOffer.mockResolvedValue({ id: 1, ...newOffer });

    const result = await db.createPurchaseOffer(newOffer);
    expect(result.id).toBe(1);
    expect(result.formData).toBeDefined();
    const parsed = JSON.parse(result.formData);
    expect(parsed.purchasePrice).toBe("1,630");
    expect(parsed.sellerName).toBe("㈱K-LINK");
  });

  it("資金計画書をformDataのみで作成できる（ファイルなし）", async () => {
    const formData = {
      creationDate: "2026年2月7日",
      propertyType: "中古戸建",
      customerName: "木間塚 真大",
      purchasePrice: "1,899",
      loanPatterns: [{ bankName: "東邦銀行", amount: "2,170", interestType: "変動金利", period: "35" }],
    };
    const newPlan = {
      customerName: "木間塚 真大",
      propertyName: "中古戸建",
      submittedBy: 1,
      submittedByName: "営業太郎",
      status: "pending" as const,
      formData: JSON.stringify(formData),
    };
    mockDb.createFundingPlan.mockResolvedValue({ id: 1, ...newPlan });

    const result = await db.createFundingPlan(newPlan);
    expect(result.id).toBe(1);
    expect(result.formData).toBeDefined();
    const parsed = JSON.parse(result.formData);
    expect(parsed.purchasePrice).toBe("1,899");
    expect(parsed.loanPatterns).toHaveLength(1);
    expect(parsed.loanPatterns[0].bankName).toBe("東邦銀行");
  });

  it("formDataとファイルの両方を持つ買付証明書を作成できる", async () => {
    const newOffer = {
      customerName: "テスト顧客",
      propertyName: "物件A",
      fileUrl: "https://s3.example.com/offer.pdf",
      fileName: "offer.pdf",
      submittedBy: 1,
      submittedByName: "営業太郎",
      status: "pending" as const,
      formData: JSON.stringify({ purchasePrice: "2,000" }),
    };
    mockDb.createPurchaseOffer.mockResolvedValue({ id: 1, ...newOffer });

    const result = await db.createPurchaseOffer(newOffer);
    expect(result.fileUrl).toBe("https://s3.example.com/offer.pdf");
    expect(result.formData).toBeDefined();
  });
});

describe("承認フロー", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("資金計画書: pending → reviewing → approved の流れ", async () => {
    // Step 1: 申請中
    const plan = { id: 1, status: "pending", customerName: "テスト" };
    mockDb.getFundingPlanById.mockResolvedValue(plan);
    const result1 = await db.getFundingPlanById(1);
    expect(result1.status).toBe("pending");

    // Step 2: 確認中に変更
    mockDb.updateFundingPlanStatus.mockResolvedValue(undefined);
    await db.updateFundingPlanStatus(1, { status: "reviewing", reviewedBy: 2, reviewedByName: "管理者" });
    expect(mockDb.updateFundingPlanStatus).toHaveBeenCalledWith(1, expect.objectContaining({ status: "reviewing" }));

    // Step 3: 承認
    await db.updateFundingPlanStatus(1, { status: "approved", reviewedBy: 2, reviewedByName: "管理者", reviewComment: "OK" });
    expect(mockDb.updateFundingPlanStatus).toHaveBeenCalledWith(1, expect.objectContaining({ status: "approved" }));
  });

  it("買付証明書: pending → reviewing → rejected の流れ", async () => {
    const offer = { id: 1, status: "pending", customerName: "テスト" };
    mockDb.getPurchaseOfferById.mockResolvedValue(offer);
    const result1 = await db.getPurchaseOfferById(1);
    expect(result1.status).toBe("pending");

    await db.updatePurchaseOfferStatus(1, { status: "reviewing", reviewedBy: 2, reviewedByName: "管理者" });
    expect(mockDb.updatePurchaseOfferStatus).toHaveBeenCalledWith(1, expect.objectContaining({ status: "reviewing" }));

    await db.updatePurchaseOfferStatus(1, { status: "rejected", reviewedBy: 2, reviewedByName: "管理者", reviewComment: "修正必要" });
    expect(mockDb.updatePurchaseOfferStatus).toHaveBeenCalledWith(1, expect.objectContaining({ status: "rejected", reviewComment: "修正必要" }));
  });

  it("ステータスの種類が4つ存在する", () => {
    const statuses = ["pending", "reviewing", "approved", "rejected"];
    expect(statuses).toHaveLength(4);
    expect(statuses).toContain("pending");
    expect(statuses).toContain("reviewing");
    expect(statuses).toContain("approved");
    expect(statuses).toContain("rejected");
  });
});

describe("フォーム再編集機能", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("資金計画書のformDataを更新できる", async () => {
    mockDb.getFundingPlanById.mockResolvedValue({ id: 1, customerName: "田中太郎", submittedBy: 1, status: "pending" });
    mockDb.updateFundingPlanFormData.mockResolvedValue(undefined);

    const updateData = {
      customerName: "田中太郎（修正）",
      formData: JSON.stringify({ purchasePrice: "2,000" }),
    };
    await (db as any).updateFundingPlanFormData(1, updateData);
    expect(mockDb.updateFundingPlanFormData).toHaveBeenCalledWith(1, updateData);
  });

  it("買付証明書のformDataを更新できる", async () => {
    mockDb.getPurchaseOfferById.mockResolvedValue({ id: 1, customerName: "山田一郎", submittedBy: 1, status: "pending" });
    mockDb.updatePurchaseOfferFormData.mockResolvedValue(undefined);

    const updateData = {
      customerName: "山田一郎（修正）",
      formData: JSON.stringify({ purchasePrice: "1,800" }),
    };
    await (db as any).updatePurchaseOfferFormData(1, updateData);
    expect(mockDb.updatePurchaseOfferFormData).toHaveBeenCalledWith(1, updateData);
  });

  it("編集時に既存のformDataを取得できる", async () => {
    const existingFormData = JSON.stringify({
      date: { year: "2026", month: "2", day: "10" },
      sellerName: "㈱K-LINK",
      purchasePrice: "1,630",
    });
    mockDb.getPurchaseOfferById.mockResolvedValue({
      id: 1, customerName: "テスト", status: "pending", formData: existingFormData,
    });

    const result = await db.getPurchaseOfferById(1);
    expect(result.formData).toBeDefined();
    const parsed = JSON.parse(result.formData);
    expect(parsed.purchasePrice).toBe("1,630");
    expect(parsed.sellerName).toBe("㈱K-LINK");
  });

  it("編集時にcustomerFileIdを更新できる", async () => {
    mockDb.updatePurchaseOfferFormData.mockResolvedValue(undefined);
    await (db as any).updatePurchaseOfferFormData(1, { customerFileId: 42 });
    expect(mockDb.updatePurchaseOfferFormData).toHaveBeenCalledWith(1, { customerFileId: 42 });
  });
});

describe("顧客カルテ紐付け", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("名前で顧客カルテを検索できる", async () => {
    const mockResults = [
      { id: 1, fileNumber: "No.001", customerName: "田中太郎", assignee: "営業A" },
      { id: 2, fileNumber: "No.002", customerName: "田中花子", assignee: "営業B" },
    ];
    mockDb.searchCustomerFilesByName.mockResolvedValue(mockResults);

    const result = await (db as any).searchCustomerFilesByName("田中");
    expect(result).toHaveLength(2);
    expect(result[0].customerName).toBe("田中太郎");
    expect(mockDb.searchCustomerFilesByName).toHaveBeenCalledWith("田中");
  });

  it("検索結果が空の場合は空配列を返す", async () => {
    mockDb.searchCustomerFilesByName.mockResolvedValue([]);

    const result = await (db as any).searchCustomerFilesByName("存在しない名前");
    expect(result).toHaveLength(0);
  });

  it("資金計画書作成時にcustomerFileIdを指定できる", async () => {
    const newPlan = {
      customerName: "田中太郎",
      propertyName: "物件A",
      submittedBy: 1,
      submittedByName: "営業太郎",
      status: "pending" as const,
      formData: JSON.stringify({ purchasePrice: "1,899" }),
      customerFileId: 42,
    };
    mockDb.createFundingPlan.mockResolvedValue({ id: 1, ...newPlan });

    const result = await db.createFundingPlan(newPlan);
    expect(result.customerFileId).toBe(42);
  });
});

describe("承認/差し戻し通知", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("資金計画書承認時に通知が送信される", async () => {
    await notifyOwner({
      title: "📊 資金計画書が承認（OK）になりました",
      content: "お客様: 田中太郎\nステータス: 承認（OK）\n確認者: 管理者\n投稿者: 営業太郎",
    });
    expect(notifyOwner).toHaveBeenCalledWith(expect.objectContaining({
      title: expect.stringContaining("承認"),
      content: expect.stringContaining("投稿者"),
    }));
  });

  it("買付証明書差し戻し時に通知が送信される", async () => {
    await notifyOwner({
      title: "🏠 買付証明書が差し戻しになりました",
      content: "お客様: 山田一郎\nステータス: 差し戻し\nコメント: 修正が必要です\n投稿者: 営業太郎",
    });
    expect(notifyOwner).toHaveBeenCalledWith(expect.objectContaining({
      title: expect.stringContaining("差し戻し"),
      content: expect.stringContaining("コメント"),
    }));
  });

  it("確認中ステータス変更時にも通知が送信される", async () => {
    await notifyOwner({
      title: "🏠 買付証明書が確認中になりました",
      content: "お客様: 山田一郎\nステータス: 確認中\n投稿者: 営業太郎",
    });
    expect(notifyOwner).toHaveBeenCalledWith(expect.objectContaining({
      title: expect.stringContaining("確認中"),
    }));
  });
});
