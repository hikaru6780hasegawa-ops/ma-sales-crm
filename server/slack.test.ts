import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
vi.mock("./db", () => ({
  getSlackChannels: vi.fn(),
  getSlackMessages: vi.fn(),
}));

import * as db from "./db";

describe("Slack Messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getSlackChannels", () => {
    it("should return channel list with counts", async () => {
      const mockChannels = [
        { channelId: "C08GAE2QWLA", channelName: "04_案件相談シート", count: 197, latestMessage: 1770956298958 },
        { channelId: "C09DW7D4E1L", channelName: "21_相談シート前の案件-提案物件-", count: 72, latestMessage: 1770000000000 },
      ];
      (db.getSlackChannels as any).mockResolvedValue(mockChannels);

      const result = await db.getSlackChannels();
      expect(result).toHaveLength(2);
      expect(result[0].channelName).toBe("04_案件相談シート");
      expect(result[0].count).toBe(197);
      expect(result[1].channelId).toBe("C09DW7D4E1L");
    });
  });

  describe("getSlackMessages", () => {
    it("should return messages with pagination", async () => {
      const mockResult = {
        messages: [
          {
            id: 1,
            channelId: "C08GAE2QWLA",
            channelName: "04_案件相談シート",
            messageTs: "1770956298.958719",
            userId: "U08S8TQ3ZS5",
            userName: "太田 一美",
            messageText: "お疲れ様です！案件相談シート上げさせて頂きます！",
            threadReplyCount: 0,
            reactions: "bow (1)",
            files: "",
            postedAt: 1770956298958,
          },
        ],
        total: 197,
      };
      (db.getSlackMessages as any).mockResolvedValue(mockResult);

      const result = await db.getSlackMessages({ limit: 50, offset: 0 });
      expect(result.messages).toHaveLength(1);
      expect(result.total).toBe(197);
      expect(result.messages[0].userName).toBe("太田 一美");
    });

    it("should filter by channel", async () => {
      (db.getSlackMessages as any).mockResolvedValue({ messages: [], total: 0 });

      await db.getSlackMessages({ channelId: "C08GAE2QWLA" });
      expect(db.getSlackMessages).toHaveBeenCalledWith({ channelId: "C08GAE2QWLA" });
    });

    it("should filter by search query", async () => {
      (db.getSlackMessages as any).mockResolvedValue({ messages: [], total: 0 });

      await db.getSlackMessages({ search: "案件相談" });
      expect(db.getSlackMessages).toHaveBeenCalledWith({ search: "案件相談" });
    });

    it("should handle empty results", async () => {
      (db.getSlackMessages as any).mockResolvedValue({ messages: [], total: 0 });

      const result = await db.getSlackMessages({});
      expect(result.messages).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });
});
