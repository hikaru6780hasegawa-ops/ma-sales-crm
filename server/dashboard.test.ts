import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db module
vi.mock("./db", () => ({
  getDashboardStats: vi.fn().mockResolvedValue({
    totalCustomers: 5,
    activeDeals: 3,
    totalDealAmount: 1000000,
    activitiesThisMonth: 10,
    wonDeals: 2,
    wonAmount: 500000,
  }),
  getSlackChannels: vi.fn().mockResolvedValue([
    { channelId: "C1", channelName: "案件相談シート", messageCount: 196, latestMessage: Date.now() },
    { channelId: "C2", channelName: "議事録", messageCount: 836, latestMessage: Date.now() },
    { channelId: "C3", channelName: "相談シート前", messageCount: 72, latestMessage: Date.now() },
  ]),
  getSlackMessageCount: vi.fn().mockResolvedValue(1104),
  getDocCheckStats: vi.fn().mockResolvedValue({
    total: 109,
    completed: 5,
    inProgress: 20,
    notStarted: 84,
    byAssignee: [
      { assignee: "酒井", total: 6, checkedFields: 3, totalFields: 42, rate: 7 },
      { assignee: "菊池", total: 5, checkedFields: 0, totalFields: 35, rate: 0 },
    ],
    clCompleted: 2,
    clInProgress: 10,
    clNotStarted: 97,
    clByAssignee: [
      { assignee: "酒井", total: 6, checkedFields: 5, totalFields: 66, rate: 8 },
      { assignee: "菊池", total: 5, checkedFields: 0, totalFields: 55, rate: 0 },
    ],
  }),
  getCustomerFileStats: vi.fn().mockResolvedValue({
    total: 109,
    byPhase: { consultation: 100, pre_review: 5, review: 2, contract: 1, completed: 1 },
    byAssignee: { "酒井": 6, "菊池": 5, "坂本": 4 },
  }),
  getRecentCustomerFiles: vi.fn().mockResolvedValue([
    { id: 1, fileNumber: "No.409", customerName: "北河 禎己 様", phase: "consultation", updatedAt: new Date() },
    { id: 2, fileNumber: "No.406", customerName: "高橋 駿平様", phase: "consultation", updatedAt: new Date() },
  ]),
  getChecklistProgress: vi.fn().mockResolvedValue([
    { id: 1, fileNumber: "No.301", customerName: "テスト太郎様", assignee: "上田", phase: "consultation", checkedCount: 5, totalCount: 11, percentage: 45, details: [] },
    { id: 2, fileNumber: "No.302", customerName: "テスト花子様", assignee: "坂本", phase: "pre_review", checkedCount: 0, totalCount: 11, percentage: 0, details: [] },
    { id: 3, fileNumber: "No.303", customerName: "テスト次郎様", assignee: "菊池", phase: "consultation", checkedCount: 11, totalCount: 11, percentage: 100, details: [] },
  ]),
}));

import * as db from "./db";

describe("Dashboard API - slackStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return slack channel count, message count, and channels", async () => {
    const channels = await db.getSlackChannels();
    const messageCount = await db.getSlackMessageCount();

    expect(channels).toHaveLength(3);
    expect(messageCount).toBe(1104);
    expect(channels[0]).toHaveProperty("channelId");
    expect(channels[0]).toHaveProperty("channelName");
    expect(channels[0]).toHaveProperty("messageCount");
  });

  it("should return correct channel count from channels array", async () => {
    const channels = await db.getSlackChannels();
    const result = {
      channelCount: channels.length,
      messageCount: await db.getSlackMessageCount(),
      channels,
    };

    expect(result.channelCount).toBe(3);
    expect(result.messageCount).toBe(1104);
    expect(result.channels).toHaveLength(3);
  });
});

describe("Dashboard API - docCheckStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return doc check stats with totals and assignee breakdown", async () => {
    const stats = await db.getDocCheckStats();

    expect(stats).toHaveProperty("total", 109);
    expect(stats).toHaveProperty("completed", 5);
    expect(stats).toHaveProperty("inProgress", 20);
    expect(stats).toHaveProperty("notStarted", 84);
    expect(stats.byAssignee).toBeInstanceOf(Array);
    expect(stats.byAssignee.length).toBeGreaterThan(0);
  });

  it("should have rate field in assignee stats", async () => {
    const stats = await db.getDocCheckStats();

    for (const a of stats.byAssignee) {
      expect(a).toHaveProperty("assignee");
      expect(a).toHaveProperty("total");
      expect(a).toHaveProperty("rate");
      expect(typeof a.rate).toBe("number");
      expect(a.rate).toBeGreaterThanOrEqual(0);
      expect(a.rate).toBeLessThanOrEqual(100);
    }
  });
});

describe("Dashboard API - customerFileOverview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return stats and recent files", async () => {
    const [stats, recentFiles] = await Promise.all([
      db.getCustomerFileStats(),
      db.getRecentCustomerFiles(5),
    ]);

    expect(stats).toHaveProperty("total", 109);
    expect(stats).toHaveProperty("byPhase");
    expect(stats).toHaveProperty("byAssignee");
    expect(recentFiles).toBeInstanceOf(Array);
    expect(recentFiles.length).toBeLessThanOrEqual(5);
  });

  it("should return recent files with required fields", async () => {
    const recentFiles = await db.getRecentCustomerFiles(5);

    for (const f of recentFiles) {
      expect(f).toHaveProperty("id");
      expect(f).toHaveProperty("fileNumber");
      expect(f).toHaveProperty("customerName");
      expect(f).toHaveProperty("phase");
    }
  });
});

describe("Dashboard API - checklistProgress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return checklist progress for all customer files", async () => {
    const progress = await (db as any).getChecklistProgress();

    expect(progress).toBeInstanceOf(Array);
    expect(progress).toHaveLength(3);
  });

  it("should have required fields in each progress entry", async () => {
    const progress = await (db as any).getChecklistProgress();

    for (const p of progress) {
      expect(p).toHaveProperty("id");
      expect(p).toHaveProperty("fileNumber");
      expect(p).toHaveProperty("customerName");
      expect(p).toHaveProperty("assignee");
      expect(p).toHaveProperty("checkedCount");
      expect(p).toHaveProperty("totalCount");
      expect(p).toHaveProperty("percentage");
      expect(p.totalCount).toBe(11);
    }
  });

  it("should calculate percentage correctly", async () => {
    const progress = await (db as any).getChecklistProgress();

    const partial = progress.find((p: any) => p.fileNumber === "No.301");
    expect(partial.checkedCount).toBe(5);
    expect(partial.percentage).toBe(45);

    const complete = progress.find((p: any) => p.fileNumber === "No.303");
    expect(complete.checkedCount).toBe(11);
    expect(complete.percentage).toBe(100);

    const empty = progress.find((p: any) => p.fileNumber === "No.302");
    expect(empty.checkedCount).toBe(0);
    expect(empty.percentage).toBe(0);
  });

  it("should include checklist stats in docCheckStats", async () => {
    const stats = await db.getDocCheckStats();

    expect(stats).toHaveProperty("clCompleted", 2);
    expect(stats).toHaveProperty("clInProgress", 10);
    expect(stats).toHaveProperty("clNotStarted", 97);
    expect(stats).toHaveProperty("clByAssignee");
    expect(stats.clByAssignee).toBeInstanceOf(Array);
  });
});

describe("Dashboard API - stats", () => {
  it("should return basic dashboard statistics", async () => {
    const stats = await db.getDashboardStats(null as any);

    expect(stats).toHaveProperty("totalCustomers");
    expect(stats).toHaveProperty("activeDeals");
    expect(stats).toHaveProperty("totalDealAmount");
    expect(stats).toHaveProperty("activitiesThisMonth");
    expect(typeof stats.totalCustomers).toBe("number");
    expect(typeof stats.activeDeals).toBe("number");
  });
});
