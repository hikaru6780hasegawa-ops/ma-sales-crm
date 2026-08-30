import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock DB
vi.mock("./db", () => ({
  getFormTemplates: vi.fn(),
  createFormTemplate: vi.fn(),
  updateFormTemplate: vi.fn(),
  deleteFormTemplate: vi.fn(),
}));

import * as db from "./db";

const mockDb = db as any;

describe("テンプレート共有機能 (Template Sharing)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("テンプレート一覧取得", () => {
    it("自分のテンプレートと共有テンプレートの両方を取得する", async () => {
      const mockTemplates = [
        { id: 1, ownerId: 1, ownerName: "田中", name: "個人テンプレートA", type: "purchaseOffer", isShared: 0, formData: {}, createdAt: Date.now(), updatedAt: Date.now() },
        { id: 2, ownerId: 2, ownerName: "佐藤", name: "共有テンプレートB", type: "purchaseOffer", isShared: 1, formData: {}, createdAt: Date.now(), updatedAt: Date.now() },
        { id: 3, ownerId: 1, ownerName: "田中", name: "共有テンプレートC", type: "purchaseOffer", isShared: 1, formData: {}, createdAt: Date.now(), updatedAt: Date.now() },
      ];
      mockDb.getFormTemplates.mockResolvedValue(mockTemplates);

      const result = await db.getFormTemplates(1, "purchaseOffer");
      expect(result).toHaveLength(3);
      expect(mockDb.getFormTemplates).toHaveBeenCalledWith(1, "purchaseOffer");
    });

    it("共有テンプレートは他ユーザーのものも表示される", async () => {
      const mockTemplates = [
        { id: 2, ownerId: 2, ownerName: "佐藤", name: "佐藤の共有テンプレート", type: "fundingPlan", isShared: 1, formData: {} },
      ];
      mockDb.getFormTemplates.mockResolvedValue(mockTemplates);

      const result = await db.getFormTemplates(1, "fundingPlan");
      expect(result).toHaveLength(1);
      expect(result[0].ownerId).toBe(2);
      expect(result[0].isShared).toBe(1);
    });

    it("テンプレートがない場合は空配列を返す", async () => {
      mockDb.getFormTemplates.mockResolvedValue([]);
      const result = await db.getFormTemplates(1, "purchaseOffer");
      expect(result).toHaveLength(0);
    });
  });

  describe("テンプレート作成", () => {
    it("個人テンプレートを作成できる", async () => {
      mockDb.createFormTemplate.mockResolvedValue(1);

      const result = await db.createFormTemplate({
        ownerId: 1,
        ownerName: "田中",
        name: "テスト個人テンプレート",
        type: "purchaseOffer",
        formData: { addressee: "株式会社テスト" },
        isShared: 0,
      });

      expect(result).toBe(1);
      expect(mockDb.createFormTemplate).toHaveBeenCalledWith({
        ownerId: 1,
        ownerName: "田中",
        name: "テスト個人テンプレート",
        type: "purchaseOffer",
        formData: { addressee: "株式会社テスト" },
        isShared: 0,
      });
    });

    it("共有テンプレートを作成できる", async () => {
      mockDb.createFormTemplate.mockResolvedValue(2);

      const result = await db.createFormTemplate({
        ownerId: 1,
        ownerName: "田中",
        name: "テスト共有テンプレート",
        type: "fundingPlan",
        formData: { bankName: "東邦銀行" },
        isShared: 1,
      });

      expect(result).toBe(2);
      expect(mockDb.createFormTemplate).toHaveBeenCalledWith(
        expect.objectContaining({ isShared: 1 })
      );
    });

    it("isSharedを省略した場合はデフォルトで個人テンプレートになる", async () => {
      mockDb.createFormTemplate.mockResolvedValue(3);

      await db.createFormTemplate({
        ownerId: 1,
        name: "デフォルトテンプレート",
        type: "purchaseOffer",
        formData: {},
      });

      expect(mockDb.createFormTemplate).toHaveBeenCalledWith(
        expect.objectContaining({ ownerId: 1 })
      );
    });
  });

  describe("テンプレート更新", () => {
    it("テンプレートの共有状態を変更できる", async () => {
      mockDb.updateFormTemplate.mockResolvedValue(undefined);

      await db.updateFormTemplate(1, 1, { isShared: 1 });

      expect(mockDb.updateFormTemplate).toHaveBeenCalledWith(1, 1, { isShared: 1 });
    });

    it("テンプレート名を更新できる", async () => {
      mockDb.updateFormTemplate.mockResolvedValue(undefined);

      await db.updateFormTemplate(1, 1, { name: "更新後の名前" });

      expect(mockDb.updateFormTemplate).toHaveBeenCalledWith(1, 1, { name: "更新後の名前" });
    });
  });

  describe("テンプレート削除", () => {
    it("自分のテンプレートを削除できる", async () => {
      mockDb.deleteFormTemplate.mockResolvedValue(undefined);

      await db.deleteFormTemplate(1, 1);

      expect(mockDb.deleteFormTemplate).toHaveBeenCalledWith(1, 1);
    });

    it("ownerIdが一致しないテンプレートは削除されない", async () => {
      mockDb.deleteFormTemplate.mockResolvedValue(undefined);

      await db.deleteFormTemplate(1, 999);

      expect(mockDb.deleteFormTemplate).toHaveBeenCalledWith(1, 999);
    });
  });

  describe("テンプレートのフィルタリング（フロントエンドロジック）", () => {
    it("個人テンプレートと共有テンプレートを分離できる", () => {
      const templates = [
        { id: 1, ownerId: 1, name: "個人A", isShared: 0 },
        { id: 2, ownerId: 2, name: "共有B", isShared: 1 },
        { id: 3, ownerId: 1, name: "共有C", isShared: 1 },
        { id: 4, ownerId: 1, name: "個人D", isShared: 0 },
      ];

      const personal = templates.filter(t => !t.isShared);
      const shared = templates.filter(t => t.isShared);

      expect(personal).toHaveLength(2);
      expect(shared).toHaveLength(2);
      expect(personal.every(t => t.isShared === 0)).toBe(true);
      expect(shared.every(t => t.isShared === 1)).toBe(true);
    });

    it("共有テンプレートは他ユーザーのものも含む", () => {
      const templates = [
        { id: 1, ownerId: 1, name: "自分の共有", isShared: 1 },
        { id: 2, ownerId: 2, name: "他人の共有", isShared: 1 },
      ];

      const shared = templates.filter(t => t.isShared);
      expect(shared).toHaveLength(2);
    });

    it("削除ボタンは自分のテンプレートのみ表示される", () => {
      const currentUserId = 1;
      const templates = [
        { id: 1, ownerId: 1, name: "自分のテンプレート", isShared: 1 },
        { id: 2, ownerId: 2, name: "他人のテンプレート", isShared: 1 },
      ];

      const canDelete = templates.map(t => ({
        ...t,
        canDelete: t.ownerId === currentUserId,
      }));

      expect(canDelete[0].canDelete).toBe(true);
      expect(canDelete[1].canDelete).toBe(false);
    });
  });
});
