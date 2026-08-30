import cron from "node-cron";
import * as db from "./db";
import { notifyOwner } from "./_core/notification";

// 長谷川光 Slack User ID: U09ESD7T79V (代表取締役) / U08GX92S43G (カリスマ)
// 上田 歩 Slack User ID: U08HTURQWBG
const REPORT_RECIPIENTS = [
  { name: "長谷川光", slackUserId: "U08GX92S43G" },
  { name: "上田 歩", slackUserId: "U08HTURQWBG" },
];

// 書類チェックフィールドの日本語ラベル
const DOC_FIELD_LABELS: Record<string, string> = {
  contractDeposit: "契約手付金",
  commission: "手数料",
  consent: "同意書",
  realEstateFile: "不動産ファイル",
  businessCardCollection: "名刺回収",
  nameplate: "表札",
  rentalManagement: "賃貸管理",
};

const DOC_FIELD_KEYS = Object.keys(DOC_FIELD_LABELS);

/**
 * 未チェックの顧客カルテを担当者別に集計する
 */
export async function getUncheckedReport() {
  const docStats = await db.getDocCheckStats();
  
  // 担当者別の未完了詳細を取得（全件取得）
  const result = await db.getCustomerFiles({ limit: 9999 });
  const allFiles = result.files;
  
  const assigneeDetails: Record<string, {
    name: string;
    uncheckedFiles: Array<{
      fileNumber: string;
      customerName: string;
      missingDocs: string[];
    }>;
  }> = {};

  for (const f of allFiles) {
    const missingDocs: string[] = [];
    for (const key of DOC_FIELD_KEYS) {
      const val = (f as any)[key];
      if (!val || (typeof val === "string" && val.trim() === "")) {
        missingDocs.push(DOC_FIELD_LABELS[key] || key);
      }
    }
    
    if (missingDocs.length > 0) {
      const assignee = f.assignee || "未割当";
      if (!assigneeDetails[assignee]) {
        assigneeDetails[assignee] = { name: assignee, uncheckedFiles: [] };
      }
      assigneeDetails[assignee].uncheckedFiles.push({
        fileNumber: f.fileNumber || "不明",
        customerName: f.customerName || "不明",
        missingDocs,
      });
    }
  }

  return {
    summary: docStats,
    details: assigneeDetails,
  };
}

/**
 * Slack DM用のレポートメッセージを生成する
 */
export function formatWeeklyReport(report: Awaited<ReturnType<typeof getUncheckedReport>>): string {
  const { summary, details } = report;
  const now = new Date();
  const dateStr = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`;
  
  let message = `📋 *週次書類チェック報告* (${dateStr})\n\n`;
  message += `*全体状況:*\n`;
  message += `• 総カルテ数: ${summary.total}件\n`;
  message += `• ✅ 完了: ${summary.completed}件\n`;
  message += `• 🔄 進行中: ${summary.inProgress}件\n`;
  message += `• ❌ 未着手: ${summary.notStarted}件\n`;
  message += `• アルリット投入率: ${summary.total > 0 ? Math.round(((summary.completed) / summary.total) * 100) : 0}%\n\n`;

  message += `*担当者別 未完了詳細:*\n`;
  
  const sortedAssignees = Object.values(details).sort(
    (a, b) => b.uncheckedFiles.length - a.uncheckedFiles.length
  );

  for (const assignee of sortedAssignees) {
    message += `\n👤 *${assignee.name}* (未完了: ${assignee.uncheckedFiles.length}件)\n`;
    // 最大5件まで表示
    const showFiles = assignee.uncheckedFiles.slice(0, 5);
    for (const file of showFiles) {
      const missingStr = file.missingDocs.slice(0, 3).join("、");
      const moreCount = file.missingDocs.length > 3 ? ` 他${file.missingDocs.length - 3}件` : "";
      message += `  • ${file.fileNumber} ${file.customerName}: _${missingStr}${moreCount}_\n`;
    }
    if (assignee.uncheckedFiles.length > 5) {
      message += `  • ...他${assignee.uncheckedFiles.length - 5}件\n`;
    }
  }

  message += `\n⏰ 毎週月曜日までにアルリットへの書類投入をお願いします。`;
  
  return message;
}

/**
 * Slack DMで報告を送信する（MCP経由ではなく、notifyOwner経由で通知）
 */
export async function sendWeeklyReportNotification() {
  try {
    const report = await getUncheckedReport();
    const message = formatWeeklyReport(report);
    
    // オーナー通知で報告を送信
    await notifyOwner({
      title: "📋 週次書類チェック報告",
      content: message,
    });

    console.log(`[SlackScheduler] 週次報告通知を送信しました`);
    return { success: true, message };
  } catch (error) {
    console.error("[SlackScheduler] 週次報告通知の送信に失敗:", error);
    return { success: false, error: String(error) };
  }
}

// ============ Slack自動同期 ============
const SLACK_CHANNELS = [
  { id: "C08GAE2QWLA", name: "04_案件相談シート" },
  { id: "C08J9JVHZJJ", name: "21_相談シート前の案件-提案物件-" },
  { id: "C08GLJY8LBT", name: "05_議事録" },
];

/**
 * Slackメッセージを同期する（インクリメンタル）
 * webhook API経由で外部からトリガーされるか、手動トリガーで同期する
 * サーバーサイドではSlack MCPが使えないため、同期状況の確認とログのみ行う
 */
export async function syncSlackMessages(): Promise<{ synced: number; errors: string[]; channels: Array<{ name: string; latestTs: string | null }> }> {
  let totalSynced = 0;
  const errors: string[] = [];
  const channels: Array<{ name: string; latestTs: string | null }> = [];

  for (const channel of SLACK_CHANNELS) {
    try {
      const latestTs = await db.getLatestMessageTs(channel.id);
      channels.push({ name: channel.name, latestTs });
      console.log(`[SlackSync] ${channel.name}: 最新TS=${latestTs || 'なし'}`);
    } catch (err) {
      errors.push(`${channel.name}: ${String(err)}`);
    }
  }

  // DBの現在のメッセージ数を取得
  try {
    const msgCount = await db.getSlackMessageCount();
    totalSynced = msgCount;
  } catch (err) {
    errors.push(`メッセージ数取得失敗: ${String(err)}`);
  }

  return { synced: totalSynced, errors, channels };
}

/**
 * 書類未提出のリマインド通知を生成する
 */
export async function generateDocReminder(): Promise<{ message: string; assigneeCount: number }> {
  const report = await getUncheckedReport();
  const details = report.details;
  const assignees = Object.values(details);
  
  if (assignees.length === 0) {
    return { message: "全ての書類が提出済みです。", assigneeCount: 0 };
  }

  let message = `📢 *書類提出リマインド*\n\n`;
  message += `以下の担当者に未提出書類があります。月曜日までにアルリットへの投入をお願いします。\n\n`;
  
  for (const assignee of assignees) {
    if (assignee.name === "未割当") continue;
    message += `👤 *${assignee.name}* — 未完了: ${assignee.uncheckedFiles.length}件\n`;
    const top3 = assignee.uncheckedFiles.slice(0, 3);
    for (const file of top3) {
      message += `  • ${file.fileNumber} ${file.customerName}: ${file.missingDocs.slice(0, 2).join("、")}\n`;
    }
    if (assignee.uncheckedFiles.length > 3) {
      message += `  • ...他${assignee.uncheckedFiles.length - 3}件\n`;
    }
  }
  
  return { message, assigneeCount: assignees.length };
}

/**
 * 書類未提出リマインドを送信する
 */
export async function sendDocReminder() {
  try {
    const { message, assigneeCount } = await generateDocReminder();
    if (assigneeCount === 0) {
      console.log("[SlackScheduler] 全書類提出済み、リマインド不要");
      return { success: true, message: "リマインド不要" };
    }
    
    await notifyOwner({
      title: "📢 書類提出リマインド",
      content: message,
    });
    
    console.log(`[SlackScheduler] 書類リマインドを送信しました (担当者${assigneeCount}名)`);
    return { success: true, message };
  } catch (error) {
    console.error("[SlackScheduler] リマインド送信失敗:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * cronジョブを開始する
 * - 毎週月曜日 AM 9:00 (JST): 未チェック報告を送信
 * - 毎週金曜日 PM 5:00 (JST): 書類提出リマインドを送信
 */
export function startScheduler() {
  // 毎週月曜日 9:00 JST - 未チェック報告
  cron.schedule("0 9 * * 1", async () => {
    console.log("[SlackScheduler] 週次報告ジョブを実行中 (JST 9:00)...");
    await sendWeeklyReportNotification();
  }, {
    timezone: "Asia/Tokyo",
  });

  // 毎週金曜日 17:00 JST - 書類提出リマインド
  cron.schedule("0 17 * * 5", async () => {
    console.log("[SlackScheduler] 書類リマインドジョブを実行中 (JST 17:00)...");
    await sendDocReminder();
  }, {
    timezone: "Asia/Tokyo",
  });

  // 1時間ごとにSlack同期状況をログ（実際の同期はwebhook API経由で外部からトリガー）
  cron.schedule("0 * * * *", async () => {
    console.log("[SlackScheduler] Slack同期チェック実行中...");
    const result = await syncSlackMessages();
    console.log(`[SlackScheduler] Slack同期チェック完了: DB内メッセージ${result.synced}件`);
  }, {
    timezone: "Asia/Tokyo",
  });

  console.log("[SlackScheduler] スケジューラを開始しました（毎週月曜 9:00 報告 / 毎週金曜 17:00 リマインド / 1時間ごと同期チェック）");
}
