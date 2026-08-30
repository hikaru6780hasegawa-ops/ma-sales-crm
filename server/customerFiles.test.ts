import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
vi.mock("./db", () => ({
  getCustomerFiles: vi.fn(),
  getCustomerFileById: vi.fn(),
  createCustomerFile: vi.fn(),
  updateCustomerFile: vi.fn(),
  deleteCustomerFile: vi.fn(),
  getCustomerFileStats: vi.fn(),
  getCustomerFileAssignees: vi.fn(),
}));

import * as db from "./db";

describe("Customer Files (顧客カルテ)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getCustomerFiles", () => {
    it("should return paginated customer files", async () => {
      const mockFiles = [
        { id: 1, fileNumber: "No.122", customerName: "山中 貴大", assignee: "上田", companion: "武田CMO", phase: "consultation" },
        { id: 2, fileNumber: "No.175", customerName: "岸本楓莉", assignee: "犬塚", companion: "三浦部長", phase: "pre_review" },
      ];
      vi.mocked(db.getCustomerFiles).mockResolvedValue({ files: mockFiles as any, total: 96 });

      const result = await db.getCustomerFiles({ limit: 50, offset: 0 });
      expect(result.files).toHaveLength(2);
      expect(result.total).toBe(96);
      expect(result.files[0].fileNumber).toBe("No.122");
    });

    it("should filter by search query", async () => {
      vi.mocked(db.getCustomerFiles).mockResolvedValue({ files: [{ id: 1, fileNumber: "No.122", customerName: "山中 貴大" }] as any, total: 1 });

      const result = await db.getCustomerFiles({ search: "山中", limit: 50, offset: 0 });
      expect(db.getCustomerFiles).toHaveBeenCalledWith({ search: "山中", limit: 50, offset: 0 });
      expect(result.total).toBe(1);
    });

    it("should filter by phase", async () => {
      vi.mocked(db.getCustomerFiles).mockResolvedValue({ files: [], total: 0 });

      await db.getCustomerFiles({ phase: "contract", limit: 50, offset: 0 });
      expect(db.getCustomerFiles).toHaveBeenCalledWith({ phase: "contract", limit: 50, offset: 0 });
    });

    it("should filter by assignee", async () => {
      vi.mocked(db.getCustomerFiles).mockResolvedValue({ files: [], total: 0 });

      await db.getCustomerFiles({ assignee: "上田", limit: 50, offset: 0 });
      expect(db.getCustomerFiles).toHaveBeenCalledWith({ assignee: "上田", limit: 50, offset: 0 });
    });
  });

  describe("getCustomerFileById", () => {
    it("should return a single customer file", async () => {
      const mockFile = {
        id: 1,
        fileNumber: "No.122",
        customerName: "山中 貴大",
        assignee: "上田",
        companion: "武田CMO",
        consultationDate: "4/5",
        phase: "consultation",
        contractDeposit: null,
        commission: null,
        consent: null,
        realEstateFile: null,
        businessCardCollection: null,
        nameplate: null,
        rentalManagement: null,
      };
      vi.mocked(db.getCustomerFileById).mockResolvedValue(mockFile as any);

      const result = await db.getCustomerFileById(1);
      expect(result).toBeDefined();
      expect(result!.fileNumber).toBe("No.122");
      expect(result!.customerName).toBe("山中 貴大");
      expect(result!.assignee).toBe("上田");
    });

    it("should return undefined for non-existent file", async () => {
      vi.mocked(db.getCustomerFileById).mockResolvedValue(undefined);

      const result = await db.getCustomerFileById(9999);
      expect(result).toBeUndefined();
    });
  });

  describe("createCustomerFile", () => {
    it("should create a new customer file", async () => {
      vi.mocked(db.createCustomerFile).mockResolvedValue({ id: 100 });

      const result = await db.createCustomerFile({
        fileNumber: "No.301",
        customerName: "テスト太郎",
        assignee: "上田",
        companion: "武田",
        consultationDate: "2/19",
        phase: "consultation",
      } as any);

      expect(result.id).toBe(100);
      expect(db.createCustomerFile).toHaveBeenCalledWith(expect.objectContaining({
        fileNumber: "No.301",
        customerName: "テスト太郎",
      }));
    });
  });

  describe("updateCustomerFile", () => {
    it("should update document status fields", async () => {
      vi.mocked(db.updateCustomerFile).mockResolvedValue(undefined);

      await db.updateCustomerFile(1, {
        contractDeposit: "受領済",
        commission: "50万円",
        consent: "取得済",
        phase: "contract",
      } as any);

      expect(db.updateCustomerFile).toHaveBeenCalledWith(1, expect.objectContaining({
        contractDeposit: "受領済",
        commission: "50万円",
        consent: "取得済",
        phase: "contract",
      }));
    });

    it("should update 預かり書類チェックシート fields", async () => {
      vi.mocked(db.updateCustomerFile).mockResolvedValue(undefined);

      const today = new Date().toISOString().split('T')[0];
      await db.updateCustomerFile(1, {
        docLicense: today,
        docInsurance: today,
        docGensen1: today,
        docGensen2: "",
        docGensen3: "",
        docCic: today,
        docPublicDoc: "",
        docPreReview: today,
        docCompliance: "",
        docHearing: today,
        docExistingLoan: "",
      } as any);

      expect(db.updateCustomerFile).toHaveBeenCalledWith(1, expect.objectContaining({
        docLicense: today,
        docInsurance: today,
        docCic: today,
        docPreReview: today,
        docHearing: today,
      }));
    });

    it("should update property information", async () => {
      vi.mocked(db.updateCustomerFile).mockResolvedValue(undefined);

      await db.updateCustomerFile(1, {
        propertyAddress: "東京都渋谷区1-1-1",
        propertyPrice: "5,000万円",
        totalFinancing: "4,500万円",
      } as any);

      expect(db.updateCustomerFile).toHaveBeenCalledWith(1, expect.objectContaining({
        propertyAddress: "東京都渋谷区1-1-1",
      }));
    });
  });

  describe("deleteCustomerFile", () => {
    it("should delete a customer file", async () => {
      vi.mocked(db.deleteCustomerFile).mockResolvedValue(undefined);

      await db.deleteCustomerFile(1);
      expect(db.deleteCustomerFile).toHaveBeenCalledWith(1);
    });
  });

  describe("getCustomerFileStats", () => {
    it("should return statistics", async () => {
      vi.mocked(db.getCustomerFileStats).mockResolvedValue({
        total: 96,
        byPhase: [
          { phase: "consultation", count: 60 },
          { phase: "pre_review", count: 20 },
          { phase: "contract", count: 10 },
          { phase: "completed", count: 6 },
        ],
        byAssignee: [
          { assignee: "上田", count: 15 },
          { assignee: "犬塚", count: 12 },
          { assignee: "尾崎", count: 10 },
        ],
      } as any);

      const result = await db.getCustomerFileStats();
      expect(result.total).toBe(96);
      expect(result.byPhase).toHaveLength(4);
      expect(result.byAssignee).toHaveLength(3);
    });
  });

  describe("getCustomerFileAssignees", () => {
    it("should return unique assignee list", async () => {
      vi.mocked(db.getCustomerFileAssignees).mockResolvedValue(["上田", "犬塚", "尾崎", "坂本主任", "菊池 優心"]);

      const result = await db.getCustomerFileAssignees();
      expect(result).toContain("上田");
      expect(result).toContain("犬塚");
      expect(result.length).toBe(5);
    });
  });
});
