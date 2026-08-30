import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, bigint, decimal, json } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * フォルダテーブル - 顧客やドキュメントを整理するフォルダ
 */
export const folders = mysqlTable("folders", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  color: varchar("color", { length: 20 }).default("#4F46E5"),
  parentId: int("parentId"), // null = ルートフォルダ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Folder = typeof folders.$inferSelect;
export type InsertFolder = typeof folders.$inferInsert;

/**
 * 顧客テーブル
 */
export const customers = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  folderId: int("folderId"), // フォルダ分け用
  companyName: varchar("companyName", { length: 255 }).notNull(),
  contactName: varchar("contactName", { length: 255 }),
  contactEmail: varchar("contactEmail", { length: 320 }),
  contactPhone: varchar("contactPhone", { length: 50 }),
  address: text("address"),
  postalCode: varchar("postalCode", { length: 20 }),
  industry: varchar("industry", { length: 100 }),
  status: mysqlEnum("status", ["active", "inactive", "prospect", "lost"]).default("prospect").notNull(),
  notes: text("notes"),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;

/**
 * 営業活動テーブル
 */
export const activities = mysqlTable("activities", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(),
  ownerId: int("ownerId").notNull(),
  type: mysqlEnum("type", ["visit", "call", "email", "meeting", "other"]).default("visit").notNull(),
  subject: varchar("subject", { length: 255 }).notNull(),
  description: text("description"),
  activityDate: bigint("activityDate", { mode: "number" }).notNull(),
  nextAction: text("nextAction"),
  nextActionDate: bigint("nextActionDate", { mode: "number" }),
  progressStatus: mysqlEnum("progressStatus", ["planned", "completed", "cancelled"]).default("planned").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Activity = typeof activities.$inferSelect;
export type InsertActivity = typeof activities.$inferInsert;

/**
 * 案件テーブル
 */
export const deals = mysqlTable("deals", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(),
  ownerId: int("ownerId").notNull(),
  dealName: varchar("dealName", { length: 255 }).notNull(),
  amount: bigint("amount", { mode: "number" }).default(0),
  probability: int("probability").default(0),
  phase: mysqlEnum("phase", ["lead", "proposal", "negotiation", "closing", "won", "lost"]).default("lead").notNull(),
  expectedCloseDate: bigint("expectedCloseDate", { mode: "number" }),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Deal = typeof deals.$inferSelect;
export type InsertDeal = typeof deals.$inferInsert;

/**
 * スキャンドキュメントテーブル - 写真スキャンしたドキュメント
 */
export const scannedDocuments = mysqlTable("scanned_documents", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  customerId: int("customerId"), // 関連顧客（任意）
  folderId: int("folderId"), // フォルダ分け用
  title: varchar("title", { length: 255 }).notNull(),
  imageUrl: text("imageUrl").notNull(), // S3に保存された画像URL
  extractedText: text("extractedText"), // OCR抽出テキスト
  fileKey: varchar("fileKey", { length: 512 }).notNull(), // S3キー
  mimeType: varchar("mimeType", { length: 100 }).default("image/jpeg"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ScannedDocument = typeof scannedDocuments.$inferSelect;
export type InsertScannedDocument = typeof scannedDocuments.$inferInsert;

/**
 * AIレポートテーブル
 */
export const aiReports = mysqlTable("ai_reports", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId"),
  reportType: mysqlEnum("reportType", ["weekly", "monthly"]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  periodStart: bigint("periodStart", { mode: "number" }).notNull(),
  periodEnd: bigint("periodEnd", { mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AiReport = typeof aiReports.$inferSelect;
export type InsertAiReport = typeof aiReports.$inferInsert;

/**
 * ダッシュボード設定テーブル - ユーザーごとのダッシュボードカスタマイズ
 */
export const dashboardSettings = mysqlTable("dashboard_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  widgetOrder: text("widgetOrder"), // JSON: ウィジェットの順番
  hiddenWidgets: text("hiddenWidgets"), // JSON: 非表示ウィジェットリスト
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DashboardSetting = typeof dashboardSettings.$inferSelect;
export type InsertDashboardSetting = typeof dashboardSettings.$inferInsert;

/**
 * 通知設定テーブル - ユーザーごとの通知設定
 */
export const notificationSettings = mysqlTable("notification_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  emailEnabled: int("emailEnabled").default(1).notNull(), // 1=ON, 0=OFF
  dealReminderDays: int("dealReminderDays").default(3).notNull(), // 案件期限の何日前に通知
  actionReminderDays: int("actionReminderDays").default(1).notNull(), // アクション期限の何日前に通知
  weeklyReportEnabled: int("weeklyReportEnabled").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type NotificationSetting = typeof notificationSettings.$inferSelect;
export type InsertNotificationSetting = typeof notificationSettings.$inferInsert;

/**
 * 営業日報テーブル
 */
export const dailyReports = mysqlTable("daily_reports", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  reportDate: bigint("reportDate", { mode: "number" }).notNull(), // その日の日付（UTCミリ秒）
  visitCount: int("visitCount").default(0),
  callCount: int("callCount").default(0),
  meetingCount: int("meetingCount").default(0),
  todaySummary: text("todaySummary").notNull(), // 今日の活動まとめ
  achievements: text("achievements"), // 成果・進捗
  challenges: text("challenges"), // 課題・困りごと
  tomorrowPlan: text("tomorrowPlan"), // 明日の予定
  mood: mysqlEnum("mood", ["great", "good", "normal", "tough", "bad"]).default("normal"),
  adminComment: text("adminComment"), // 管理者コメント
  adminCommentAt: bigint("adminCommentAt", { mode: "number" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DailyReport = typeof dailyReports.$inferSelect;
export type InsertDailyReport = typeof dailyReports.$inferInsert;

/**
 * タグテーブル - 顧客に付けるカスタムタグ
 */
export const tags = mysqlTable("tags", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(), // 作成者（adminなら全員共有）
  name: varchar("name", { length: 100 }).notNull(),
  color: varchar("color", { length: 20 }).default("#4F46E5").notNull(),
  category: mysqlEnum("category", ["industry", "size", "priority", "status", "custom"]).default("custom").notNull(),
  isShared: int("isShared").default(0).notNull(), // 1=全員共有, 0=個人のみ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Tag = typeof tags.$inferSelect;
export type InsertTag = typeof tags.$inferInsert;

/**
 * 顧客タグ中間テーブル - 顧客とタグの多対多関係
 */
export const customerTags = mysqlTable("customer_tags", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(),
  tagId: int("tagId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CustomerTag = typeof customerTags.$inferSelect;
export type InsertCustomerTag = typeof customerTags.$inferInsert;

/**
 * n8n APIキーテーブル - Webhook認証用
 */
export const apiKeys = mysqlTable("api_keys", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  name: varchar("name", { length: 255 }).notNull(), // キーの名前（例: "n8n連携用"）
  keyHash: varchar("keyHash", { length: 255 }).notNull(), // ハッシュ化されたAPIキー
  keyPrefix: varchar("keyPrefix", { length: 20 }).notNull(), // 表示用のプレフィックス
  lastUsedAt: bigint("lastUsedAt", { mode: "number" }),
  isActive: int("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = typeof apiKeys.$inferInsert;

/**
 * Slackメッセージテーブル - Slackチャンネルから取得したメッセージ
 */
export const slackMessages = mysqlTable("slack_messages", {
  id: int("id").autoincrement().primaryKey(),
  channelId: varchar("channelId", { length: 50 }).notNull(),
  channelName: varchar("channelName", { length: 255 }).notNull(),
  messageTs: varchar("messageTs", { length: 50 }).notNull(), // Slackのタイムスタンプ（ユニークID）
  userId: varchar("userId", { length: 50 }), // SlackユーザーID
  userName: varchar("userName", { length: 255 }), // 送信者名
  messageText: text("messageText"), // メッセージ本文
  threadTs: varchar("threadTs", { length: 50 }), // スレッドの親メッセージTS
  threadReplyCount: int("threadReplyCount").default(0),
  reactions: text("reactions"), // JSON: リアクション情報
  files: text("files"), // JSON: 添付ファイル情報
  postedAt: bigint("postedAt", { mode: "number" }).notNull(), // メッセージ投稿日時（UTCミリ秒）
  consultationStatus: mysqlEnum("consultationStatus", ["pending", "done"]).default("pending"), // 案件相談シートの対応ステータス
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SlackMessage = typeof slackMessages.$inferSelect;
export type InsertSlackMessage = typeof slackMessages.$inferInsert;

/**
 * 顧客カルテテーブル - Slackメッセージから自動生成される顧客ファイル
 * お客様ごとにID・名前で管理し、担当・同行・書類取得状況を追跡
 */
export const customerFiles = mysqlTable("customer_files", {
  id: int("id").autoincrement().primaryKey(),
  fileNumber: varchar("fileNumber", { length: 20 }).notNull(), // 案件No（例: No.301）
  customerName: varchar("customerName", { length: 255 }).notNull(), // お客様名
  consultationDate: varchar("consultationDate", { length: 100 }), // 相談日
  assignee: varchar("assignee", { length: 255 }), // 担当者
  companion: varchar("companion", { length: 255 }), // 同行者
  source: varchar("source", { length: 255 }), // 相談元（仲介会社など）
  // 書類取得状況
  contractDeposit: varchar("contractDeposit", { length: 255 }).default(""), // 契約手付金
  commission: varchar("commission", { length: 255 }).default(""), // 手数料
  consent: varchar("consent", { length: 255 }).default(""), // 同意書
  realEstateFile: varchar("realEstateFile", { length: 255 }).default(""), // 不動産ファイル
  businessCardCollection: varchar("businessCardCollection", { length: 255 }).default(""), // 名刺回収
  nameplate: varchar("nameplate", { length: 255 }).default(""), // 表札
  rentalManagement: varchar("rentalManagement", { length: 255 }).default(""), // 賃貸管理形態
  // 物件情報
  propertyAddress: text("propertyAddress"), // 物件住所
  propertyPrice: varchar("propertyPrice", { length: 100 }), // 物件価格
  miscCosts: varchar("miscCosts", { length: 100 }), // 諸費用
  totalFinancing: varchar("totalFinancing", { length: 100 }), // 総融資額
  buildingArea: varchar("buildingArea", { length: 100 }), // 建物面積
  landArea: varchar("landArea", { length: 100 }), // 土地面積
  buildYear: varchar("buildYear", { length: 100 }), // 築年数
  structure: varchar("structure", { length: 100 }), // 構造
  layout: varchar("layout", { length: 100 }), // 間取り
  // ステータス
  phase: mysqlEnum("phase", ["consultation", "pre_review", "review", "contract", "final_settlement", "completed", "cancelled"]).default("consultation").notNull(),
  financialInstitution: varchar("financialInstitution", { length: 255 }), // 金融機関
  broker: varchar("broker", { length: 255 }), // 仲介会社
  notes: text("notes"), // 備考・進捗メモ
  slackMessageTs: varchar("slackMessageTs", { length: 50 }), // 元のSlackメッセージTS
  customerId: int("customerId"), // 顧客管理テーブルとの紐づけ
  // お客様預かり書類チェックシート（日付文字列を格納、空文字列=未取得）
  docLicense: varchar("docLicense", { length: 255 }).default(""), // 免許証
  docInsurance: varchar("docInsurance", { length: 255 }).default(""), // 保険証
  docGensen1: varchar("docGensen1", { length: 255 }).default(""), // 源泉1期
  docGensen2: varchar("docGensen2", { length: 255 }).default(""), // 源泉2期
  docGensen3: varchar("docGensen3", { length: 255 }).default(""), // 源泉3期
  docCic: varchar("docCic", { length: 255 }).default(""), // CIC
  docPublicDoc: varchar("docPublicDoc", { length: 255 }).default(""), // 公的書類
  docPreReview: varchar("docPreReview", { length: 255 }).default(""), // 事前審査用紙
  docCompliance: varchar("docCompliance", { length: 255 }).default(""), // コンプライアンス書類
  docHearing: varchar("docHearing", { length: 255 }).default(""), // ヒアリングシート
  docExistingLoan: varchar("docExistingLoan", { length: 255 }).default(""), // 既存借入資料
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CustomerFile = typeof customerFiles.$inferSelect;
export type InsertCustomerFile = typeof customerFiles.$inferInsert;

/**
 * 議事録No.管理テーブル - 案件相談シートのお客様にNo.を付与して管理
 */
export const minutesNumbers = mysqlTable("minutes_numbers", {
  id: int("id").autoincrement().primaryKey(),
  number: int("number").notNull().unique(), // No.番号（1, 2, 3, ...）
  customerName: varchar("customerName", { length: 255 }).notNull(), // お客様名（例: 鈴木　岳仁）
  note: text("note"), // 備考（買増し、現金案件等）
  slackMessageTs: varchar("slackMessageTs", { length: 50 }), // 案件相談シートのメッセージTS
  customerFileId: int("customerFileId"), // 顧客カルテとの紐づけ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type MinutesNumber = typeof minutesNumbers.$inferSelect;
export type InsertMinutesNumber = typeof minutesNumbers.$inferInsert;

/**
 * 資金計画書テーブル - 資金計画書のアップロード・承認フロー管理
 * フロー: 投稿(pending) → 管理者確認中(reviewing) → 承認(approved) / 差し戻し(rejected)
 */
export const fundingPlans = mysqlTable("funding_plans", {
  id: int("id").autoincrement().primaryKey(),
  customerName: varchar("customerName", { length: 255 }).notNull(), // お客様名
  propertyName: varchar("propertyName", { length: 500 }), // 物件名
  submittedBy: int("submittedBy").notNull(), // 投稿者（ユーザーID）
  submittedByName: varchar("submittedByName", { length: 255 }), // 投稿者名
  fileUrl: text("fileUrl"), // アップロードファイルURL（S3）
  fileName: varchar("fileName", { length: 500 }), // ファイル名
  fileType: varchar("fileType", { length: 100 }), // MIMEタイプ
  note: text("note"), // 備考・メモ
  formData: json("formData"), // フォーム入力データ（JSON）
  customerFileId: int("customerFileId"), // 顧客カルテとの紐づけ
  status: mysqlEnum("status", ["pending", "reviewing", "approved", "rejected"]).default("pending").notNull(),
  reviewedBy: int("reviewedBy"), // 確認者（管理者ユーザーID）
  reviewedByName: varchar("reviewedByName", { length: 255 }), // 確認者名
  reviewComment: text("reviewComment"), // 確認コメント
  reviewedAt: timestamp("reviewedAt"), // 確認日時
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type FundingPlan = typeof fundingPlans.$inferSelect;
export type InsertFundingPlan = typeof fundingPlans.$inferInsert;

/**
 * 買付証明書テーブル - 買付証明書のアップロード・承認フロー管理
 * フロー: 投稿(pending) → 管理者確認中(reviewing) → 買付OK(approved) / 差し戻し(rejected)
 */
export const purchaseOffers = mysqlTable("purchase_offers", {
  id: int("id").autoincrement().primaryKey(),
  customerName: varchar("customerName", { length: 255 }).notNull(), // お客様名（買主）
  propertyName: varchar("propertyName", { length: 500 }), // 物件名・所在地
  propertyAddress: varchar("propertyAddress", { length: 500 }), // 物件住所
  purchasePrice: varchar("purchasePrice", { length: 100 }), // 購入希望価格
  deposit: varchar("deposit", { length: 100 }), // 手付金
  submittedBy: int("submittedBy").notNull(), // 投稿者（ユーザーID）
  submittedByName: varchar("submittedByName", { length: 255 }), // 投稿者名
  fileUrl: text("fileUrl"), // アップロードファイルURL（S3）
  fileName: varchar("fileName", { length: 500 }), // ファイル名
  fileType: varchar("fileType", { length: 100 }), // MIMEタイプ
  note: text("note"), // 備考・メモ
  formData: json("formData"), // フォーム入力データ（JSON）
  customerFileId: int("customerFileId"), // 顧客カルテとの紐づけ
  status: mysqlEnum("status", ["pending", "reviewing", "approved", "rejected"]).default("pending").notNull(),
  reviewedBy: int("reviewedBy"), // 確認者（管理者ユーザーID）
  reviewedByName: varchar("reviewedByName", { length: 255 }), // 確認者名
  reviewComment: text("reviewComment"), // 確認コメント
  reviewedAt: timestamp("reviewedAt"), // 確認日時
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type PurchaseOffer = typeof purchaseOffers.$inferSelect;
export type InsertPurchaseOffer = typeof purchaseOffers.$inferInsert;

/**
 * フォームテンプレートテーブル - 買付証明書・資金計画書のプリセットテンプレート
 * よく使う宛先や条件をテンプレートとして保存し、次回入力時にワンクリックで呼び出し
 */
export const formTemplates = mysqlTable("form_templates", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(), // 作成者
  ownerName: varchar("ownerName", { length: 255 }), // 作成者名
  name: varchar("name", { length: 255 }).notNull(), // テンプレート名
  type: mysqlEnum("type", ["purchaseOffer", "fundingPlan"]).notNull(), // 種別
  formData: json("formData").notNull(), // テンプレートデータ（JSON）
  isShared: int("isShared").default(0).notNull(), // 0=個人, 1=チーム共有
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type FormTemplate = typeof formTemplates.$inferSelect;
export type InsertFormTemplate = typeof formTemplates.$inferInsert;

/**
 * Slack通知キューテーブル - 承認フローのステータス変更時にSlack通知を送信するためのキュー
 * サーバーサイドでキューに追加 → 外部プロセス（Manus定期タスク等）がSlack MCPで送信
 */
export const slackNotificationQueue = mysqlTable("slack_notification_queue", {
  id: int("id").autoincrement().primaryKey(),
  channelId: varchar("channelId", { length: 50 }).notNull(), // Slackチャンネル ID
  channelName: varchar("channelName", { length: 255 }), // チャンネル名（表示用）
  message: text("message").notNull(), // 送信するメッセージ（Markdown）
  type: varchar("type", { length: 50 }).notNull(), // 通知種別: funding_plan_status, purchase_offer_status, etc.
  referenceId: int("referenceId"), // 関連レコードID（fundingPlanId or purchaseOfferId）
  status: mysqlEnum("status", ["pending", "sent", "failed"]).default("pending").notNull(),
  sentAt: timestamp("sentAt"), // 送信日時
  errorMessage: text("errorMessage"), // エラーメッセージ（失敗時）
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type SlackNotificationQueue = typeof slackNotificationQueue.$inferSelect;
export type InsertSlackNotificationQueue = typeof slackNotificationQueue.$inferInsert;
