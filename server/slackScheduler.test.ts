import { describe, it, expect, vi } from "vitest";
import { formatWeeklyReport } from "./slackScheduler";

describe("slackScheduler", () => {
  describe("formatWeeklyReport", () => {
    it("should format a weekly report with summary and details", () => {
      const mockReport = {
        summary: {
          total: 109,
          completed: 5,
          inProgress: 30,
          notStarted: 74,
          byAssignee: [
            { assignee: "長谷川", total: 16, checkedFields: 10, totalFields: 112, rate: 9 },
            { assignee: "坂本", total: 13, checkedFields: 0, totalFields: 91, rate: 0 },
          ],
        },
        details: {
          "長谷川": {
            name: "長谷川",
            uncheckedFiles: [
              { fileNumber: "No.001", customerName: "田中太郎様", missingDocs: ["契約手付金", "手数料"] },
              { fileNumber: "No.002", customerName: "鈴木花子様", missingDocs: ["同意書", "不動産ファイル", "名刺回収", "表札"] },
            ],
          },
          "坂本": {
            name: "坂本",
            uncheckedFiles: [
              { fileNumber: "No.010", customerName: "佐藤一郎様", missingDocs: ["契約手付金"] },
            ],
          },
        },
      };

      const message = formatWeeklyReport(mockReport);

      // 基本的なフォーマットの確認
      expect(message).toContain("週次書類チェック報告");
      expect(message).toContain("全体状況");
      expect(message).toContain("総カルテ数: 109件");
      expect(message).toContain("完了: 5件");
      expect(message).toContain("進行中: 30件");
      expect(message).toContain("未着手: 74件");
      
      // 担当者別詳細の確認
      expect(message).toContain("長谷川");
      expect(message).toContain("坂本");
      expect(message).toContain("No.001");
      expect(message).toContain("田中太郎様");
      expect(message).toContain("契約手付金");
      
      // アルリット投入率の確認
      expect(message).toContain("アルリット投入率");
      expect(message).toContain("毎週月曜日までにアルリットへの書類投入をお願いします");
    });

    it("should handle empty report", () => {
      const emptyReport = {
        summary: {
          total: 0,
          completed: 0,
          inProgress: 0,
          notStarted: 0,
          byAssignee: [],
        },
        details: {},
      };

      const message = formatWeeklyReport(emptyReport);
      expect(message).toContain("週次書類チェック報告");
      expect(message).toContain("総カルテ数: 0件");
    });

    it("should truncate long assignee details to 5 files max", () => {
      const manyFilesReport = {
        summary: {
          total: 10,
          completed: 0,
          inProgress: 0,
          notStarted: 10,
          byAssignee: [{ assignee: "テスト担当", total: 10, checkedFields: 0, totalFields: 70, rate: 0 }],
        },
        details: {
          "テスト担当": {
            name: "テスト担当",
            uncheckedFiles: Array.from({ length: 8 }, (_, i) => ({
              fileNumber: `No.${i + 1}`,
              customerName: `顧客${i + 1}様`,
              missingDocs: ["契約手付金"],
            })),
          },
        },
      };

      const message = formatWeeklyReport(manyFilesReport);
      expect(message).toContain("...他3件");
    });
  });
});
