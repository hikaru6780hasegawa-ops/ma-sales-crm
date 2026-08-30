import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { notifyOwner } from "./_core/notification";
import { createHash, randomBytes } from "crypto";
import { sendWeeklyReportNotification, getUncheckedReport, formatWeeklyReport, sendDocReminder, generateDocReminder, syncSlackMessages } from "./slackScheduler";

// Helper: check ownership or admin
function assertOwnership(userRole: string, userId: number, resourceOwnerId: number) {
  if (userRole !== "admin" && userId !== resourceOwnerId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "このデータへのアクセス権がありません" });
  }
}

function getEffectiveOwnerId(user: { id: number; role: string }, filterOwnerId?: number | null): number | null {
  if (user.role === "admin") return filterOwnerId ?? null;
  return user.id;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  users: router({
    list: adminProcedure.query(async () => {
      return db.getAllUsers();
    }),
  }),

  // ============ Folders ============
  folder: router({
    list: protectedProcedure.input(z.object({
      parentId: z.number().nullable().optional(),
    }).optional()).query(async ({ ctx, input }) => {
      const effectiveOwnerId = getEffectiveOwnerId(ctx.user);
      return db.getFolders(effectiveOwnerId, input?.parentId);
    }),

    create: protectedProcedure.input(z.object({
      name: z.string().min(1),
      color: z.string().optional(),
      parentId: z.number().nullable().optional(),
    })).mutation(async ({ ctx, input }) => {
      return db.createFolder({ ...input, ownerId: ctx.user.id });
    }),

    update: protectedProcedure.input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      color: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const existing = await db.getFolderById(input.id);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      assertOwnership(ctx.user.role, ctx.user.id, existing.ownerId);
      const { id, ...data } = input;
      await db.updateFolder(id, data);
      return { success: true };
    }),

    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const existing = await db.getFolderById(input.id);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      assertOwnership(ctx.user.role, ctx.user.id, existing.ownerId);
      await db.deleteFolder(input.id);
      return { success: true };
    }),
  }),

  // ============ Customers ============
  customer: router({
    list: protectedProcedure.input(z.object({
      search: z.string().optional(),
      status: z.string().optional(),
      ownerId: z.number().optional(),
      folderId: z.number().nullable().optional(),
    }).optional()).query(async ({ ctx, input }) => {
      const effectiveOwnerId = getEffectiveOwnerId(ctx.user, input?.ownerId);
      return db.getCustomers(effectiveOwnerId, input?.search, input?.status, input?.folderId);
    }),

    forMap: protectedProcedure.query(async ({ ctx }) => {
      const effectiveOwnerId = getEffectiveOwnerId(ctx.user);
      return db.getCustomersForMap(effectiveOwnerId);
    }),
    byId: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
      const customer = await db.getCustomerById(input.id);
      if (!customer) throw new TRPCError({ code: "NOT_FOUND", message: "顧客が見つかりません" });
      assertOwnership(ctx.user.role, ctx.user.id, customer.ownerId);
      return customer;
    }),

    create: protectedProcedure.input(z.object({
      companyName: z.string().min(1),
      contactName: z.string().optional(),
      contactEmail: z.string().optional(),
      contactPhone: z.string().optional(),
      address: z.string().optional(),
      postalCode: z.string().optional(),
      industry: z.string().optional(),
      status: z.enum(["active", "inactive", "prospect", "lost"]).optional(),
      notes: z.string().optional(),
      latitude: z.string().optional(),
      longitude: z.string().optional(),
      folderId: z.number().nullable().optional(),
    })).mutation(async ({ ctx, input }) => {
      return db.createCustomer({ ...input, ownerId: ctx.user.id });
    }),

    update: protectedProcedure.input(z.object({
      id: z.number(),
      companyName: z.string().min(1).optional(),
      contactName: z.string().optional(),
      contactEmail: z.string().optional(),
      contactPhone: z.string().optional(),
      address: z.string().optional(),
      postalCode: z.string().optional(),
      industry: z.string().optional(),
      status: z.enum(["active", "inactive", "prospect", "lost"]).optional(),
      notes: z.string().optional(),
      latitude: z.string().optional(),
      longitude: z.string().optional(),
      folderId: z.number().nullable().optional(),
    })).mutation(async ({ ctx, input }) => {
      const existing = await db.getCustomerById(input.id);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      assertOwnership(ctx.user.role, ctx.user.id, existing.ownerId);
      const { id, ...data } = input;
      await db.updateCustomer(id, data);
      return { success: true };
    }),

    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const existing = await db.getCustomerById(input.id);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      assertOwnership(ctx.user.role, ctx.user.id, existing.ownerId);
      await db.deleteCustomer(input.id);
      return { success: true };
    }),

    withCoords: protectedProcedure.query(async ({ ctx }) => {
      const effectiveOwnerId = getEffectiveOwnerId(ctx.user);
      return db.getCustomersWithCoords(effectiveOwnerId);
    }),

    moveToFolder: protectedProcedure.input(z.object({
      id: z.number(),
      folderId: z.number().nullable(),
    })).mutation(async ({ ctx, input }) => {
      const existing = await db.getCustomerById(input.id);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      assertOwnership(ctx.user.role, ctx.user.id, existing.ownerId);
      await db.updateCustomer(input.id, { folderId: input.folderId });
      return { success: true };
    }),
  }),

  // ============ Activities ============
  activity: router({
    list: protectedProcedure.input(z.object({
      customerId: z.number().optional(),
      status: z.string().optional(),
      ownerId: z.number().optional(),
    }).optional()).query(async ({ ctx, input }) => {
      const effectiveOwnerId = getEffectiveOwnerId(ctx.user, input?.ownerId);
      return db.getActivities(effectiveOwnerId, input?.customerId, input?.status);
    }),

    byId: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
      const activity = await db.getActivityById(input.id);
      if (!activity) throw new TRPCError({ code: "NOT_FOUND" });
      assertOwnership(ctx.user.role, ctx.user.id, activity.ownerId);
      return activity;
    }),

    create: protectedProcedure.input(z.object({
      customerId: z.number(),
      type: z.enum(["visit", "call", "email", "meeting", "other"]),
      subject: z.string().min(1),
      description: z.string().optional(),
      activityDate: z.number(),
      nextAction: z.string().optional(),
      nextActionDate: z.number().optional(),
      progressStatus: z.enum(["planned", "completed", "cancelled"]).optional(),
    })).mutation(async ({ ctx, input }) => {
      const customer = await db.getCustomerById(input.customerId);
      if (!customer) throw new TRPCError({ code: "NOT_FOUND", message: "顧客が見つかりません" });
      assertOwnership(ctx.user.role, ctx.user.id, customer.ownerId);
      return db.createActivity({ ...input, ownerId: ctx.user.id });
    }),

    update: protectedProcedure.input(z.object({
      id: z.number(),
      type: z.enum(["visit", "call", "email", "meeting", "other"]).optional(),
      subject: z.string().min(1).optional(),
      description: z.string().optional(),
      activityDate: z.number().optional(),
      nextAction: z.string().optional(),
      nextActionDate: z.number().optional(),
      progressStatus: z.enum(["planned", "completed", "cancelled"]).optional(),
    })).mutation(async ({ ctx, input }) => {
      const existing = await db.getActivityById(input.id);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      assertOwnership(ctx.user.role, ctx.user.id, existing.ownerId);
      const { id, ...data } = input;
      await db.updateActivity(id, data);
      return { success: true };
    }),

    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const existing = await db.getActivityById(input.id);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      assertOwnership(ctx.user.role, ctx.user.id, existing.ownerId);
      await db.deleteActivity(input.id);
      return { success: true };
    }),

    upcoming: protectedProcedure.input(z.object({ limit: z.number().optional() }).optional()).query(async ({ ctx, input }) => {
      const effectiveOwnerId = getEffectiveOwnerId(ctx.user);
      return db.getUpcomingActions(effectiveOwnerId, input?.limit ?? 10);
    }),
  }),

  // ============ Deals ============
  deal: router({
    list: protectedProcedure.input(z.object({
      phase: z.string().optional(),
      customerId: z.number().optional(),
      ownerId: z.number().optional(),
    }).optional()).query(async ({ ctx, input }) => {
      const effectiveOwnerId = getEffectiveOwnerId(ctx.user, input?.ownerId);
      return db.getDeals(effectiveOwnerId, input?.phase, input?.customerId);
    }),

    byId: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
      const deal = await db.getDealById(input.id);
      if (!deal) throw new TRPCError({ code: "NOT_FOUND" });
      assertOwnership(ctx.user.role, ctx.user.id, deal.ownerId);
      return deal;
    }),

    create: protectedProcedure.input(z.object({
      customerId: z.number(),
      dealName: z.string().min(1),
      amount: z.number().optional(),
      probability: z.number().min(0).max(100).optional(),
      phase: z.enum(["lead", "proposal", "negotiation", "closing", "won", "lost"]).optional(),
      expectedCloseDate: z.number().optional(),
      description: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const customer = await db.getCustomerById(input.customerId);
      if (!customer) throw new TRPCError({ code: "NOT_FOUND", message: "顧客が見つかりません" });
      assertOwnership(ctx.user.role, ctx.user.id, customer.ownerId);
      return db.createDeal({ ...input, ownerId: ctx.user.id });
    }),

    update: protectedProcedure.input(z.object({
      id: z.number(),
      dealName: z.string().min(1).optional(),
      amount: z.number().optional(),
      probability: z.number().min(0).max(100).optional(),
      phase: z.enum(["lead", "proposal", "negotiation", "closing", "won", "lost"]).optional(),
      expectedCloseDate: z.number().optional(),
      description: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const existing = await db.getDealById(input.id);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      assertOwnership(ctx.user.role, ctx.user.id, existing.ownerId);
      const { id, ...data } = input;
      await db.updateDeal(id, data);
      return { success: true };
    }),

    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const existing = await db.getDealById(input.id);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      assertOwnership(ctx.user.role, ctx.user.id, existing.ownerId);
      await db.deleteDeal(input.id);
      return { success: true };
    }),

    byPhase: protectedProcedure.input(z.object({ ownerId: z.number().optional() }).optional()).query(async ({ ctx, input }) => {
      const effectiveOwnerId = getEffectiveOwnerId(ctx.user, input?.ownerId);
      return db.getDealsByPhase(effectiveOwnerId);
    }),
  }),

  // ============ Dashboard ============
  dashboard: router({
    stats: protectedProcedure.input(z.object({ ownerId: z.number().optional() }).optional()).query(async ({ ctx, input }) => {
      const effectiveOwnerId = getEffectiveOwnerId(ctx.user, input?.ownerId);
      return db.getDashboardStats(effectiveOwnerId);
    }),

    // Slack連動ステータス（ダッシュボード用）
    slackStatus: protectedProcedure.query(async () => {
      const [channels, messageCount, recentMessages] = await Promise.all([
        db.getSlackChannels(),
        db.getSlackMessageCount(),
        db.getRecentSlackMessagesByChannel(3),
      ]);
      return {
        channelCount: channels.length,
        messageCount,
        channels,
        recentMessages,
      };
    }),

    // 書類チェック状況（ダッシュボード用）
    docCheckStatus: protectedProcedure.query(async () => {
      return db.getDocCheckStats();
    }),

    // 顧客カルテ概要（ダッシュボード用）
    customerFileOverview: protectedProcedure.query(async () => {
      const [stats, recentFiles] = await Promise.all([
        db.getCustomerFileStats(),
        db.getRecentCustomerFiles(5),
      ]);
      return { stats, recentFiles };
    }),

    // 預かり書類チェックシート進捗一覧（ダッシュボード用）
    checklistProgress: protectedProcedure.query(async () => {
      return db.getChecklistProgress();
    }),
  }),

  // ============ Scanned Documents ============
  scan: router({
    list: protectedProcedure.input(z.object({
      customerId: z.number().optional(),
      folderId: z.number().nullable().optional(),
    }).optional()).query(async ({ ctx, input }) => {
      const effectiveOwnerId = getEffectiveOwnerId(ctx.user);
      return db.getScannedDocuments(effectiveOwnerId, input?.customerId, input?.folderId);
    }),

    byId: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
      const doc = await db.getScannedDocumentById(input.id);
      if (!doc) throw new TRPCError({ code: "NOT_FOUND" });
      assertOwnership(ctx.user.role, ctx.user.id, doc.ownerId);
      return doc;
    }),

    upload: protectedProcedure.input(z.object({
      title: z.string().min(1),
      imageBase64: z.string(), // base64 encoded image
      mimeType: z.string().default("image/jpeg"),
      customerId: z.number().optional(),
      folderId: z.number().nullable().optional(),
    })).mutation(async ({ ctx, input }) => {
      // Decode base64 and upload to S3
      const buffer = Buffer.from(input.imageBase64, "base64");
      const ext = input.mimeType === "image/png" ? "png" : "jpg";
      const fileKey = `scans/${ctx.user.id}/${nanoid()}.${ext}`;
      const { url } = await storagePut(fileKey, buffer, input.mimeType);

      // OCR: use LLM vision to extract text from image
      let extractedText = "";
      try {
        const ocrResponse = await invokeLLM({
          messages: [
            {
              role: "system",
              content: "あなたはOCR（光学文字認識）の専門家です。画像から全てのテキストを正確に読み取り、そのまま出力してください。テキストが見つからない場合は「テキストなし」と回答してください。名刺や書類の場合は、会社名、氏名、電話番号、メールアドレス、住所などの情報を構造化して出力してください。"
            },
            {
              role: "user",
              content: [
                { type: "text", text: "この画像からすべてのテキストを読み取ってください。" },
                { type: "image_url", image_url: { url, detail: "high" } }
              ]
            }
          ],
        });
        const rawContent = ocrResponse.choices[0]?.message?.content;
        extractedText = typeof rawContent === "string" ? rawContent : "";
      } catch (e) {
        console.error("[OCR] Failed:", e);
        extractedText = "OCR処理に失敗しました";
      }

      const result = await db.createScannedDocument({
        ownerId: ctx.user.id,
        customerId: input.customerId ?? null,
        folderId: input.folderId ?? null,
        title: input.title,
        imageUrl: url,
        extractedText,
        fileKey,
        mimeType: input.mimeType,
      });

      return { id: result.id, imageUrl: url, extractedText };
    }),

    update: protectedProcedure.input(z.object({
      id: z.number(),
      title: z.string().optional(),
      customerId: z.number().nullable().optional(),
      folderId: z.number().nullable().optional(),
      extractedText: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const existing = await db.getScannedDocumentById(input.id);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      assertOwnership(ctx.user.role, ctx.user.id, existing.ownerId);
      const { id, ...data } = input;
      await db.updateScannedDocument(id, data);
      return { success: true };
    }),

    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const existing = await db.getScannedDocumentById(input.id);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      assertOwnership(ctx.user.role, ctx.user.id, existing.ownerId);
      await db.deleteScannedDocument(input.id);
      return { success: true };
    }),

    // Parse scanned text into customer data using AI
    parseToCustomer: protectedProcedure.input(z.object({
      extractedText: z.string(),
    })).mutation(async ({ ctx, input }) => {
      try {
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: "あなたは名刺や書類のテキストから顧客情報を抽出する専門家です。"
            },
            {
              role: "user",
              content: `以下のテキストから顧客情報を抽出してJSON形式で返してください。\n\n${input.extractedText}`
            }
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "customer_info",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  companyName: { type: "string", description: "会社名" },
                  contactName: { type: "string", description: "担当者名" },
                  contactEmail: { type: "string", description: "メールアドレス" },
                  contactPhone: { type: "string", description: "電話番号" },
                  address: { type: "string", description: "住所" },
                  postalCode: { type: "string", description: "郵便番号" },
                  industry: { type: "string", description: "業種" },
                },
                required: ["companyName", "contactName", "contactEmail", "contactPhone", "address", "postalCode", "industry"],
                additionalProperties: false,
              },
            },
          },
        });
        const rawContent = response.choices[0]?.message?.content;
        const parsed = typeof rawContent === "string" ? JSON.parse(rawContent) : {};
        return parsed as {
          companyName: string;
          contactName: string;
          contactEmail: string;
          contactPhone: string;
          address: string;
          postalCode: string;
          industry: string;
        };
      } catch (e) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "テキスト解析に失敗しました" });
      }
    }),
  }),

  // ============ Global Search ============
  search: router({
    global: protectedProcedure.input(z.object({
      query: z.string().min(1),
    })).query(async ({ ctx, input }) => {
      const effectiveOwnerId = getEffectiveOwnerId(ctx.user);
      return db.globalSearch(effectiveOwnerId, input.query);
    }),
  }),

  // ============ CSV Export ============
  csv: router({
    exportCustomers: protectedProcedure.query(async ({ ctx }) => {
      const effectiveOwnerId = getEffectiveOwnerId(ctx.user);
      const data = await db.getAllCustomersForExport(effectiveOwnerId);
      const headers = ["ID", "会社名", "担当者名", "メール", "電話番号", "住所", "郵便番号", "業種", "ステータス", "メモ", "作成日"];
      const rows = data.map(c => [
        c.id, c.companyName, c.contactName || "", c.contactEmail || "",
        c.contactPhone || "", c.address || "", c.postalCode || "",
        c.industry || "", c.status, c.notes || "",
        new Date(c.createdAt).toLocaleDateString("ja-JP")
      ]);
      return { headers, rows };
    }),

    exportActivities: protectedProcedure.query(async ({ ctx }) => {
      const effectiveOwnerId = getEffectiveOwnerId(ctx.user);
      const data = await db.getAllActivitiesForExport(effectiveOwnerId);
      const headers = ["ID", "顧客ID", "種別", "件名", "説明", "活動日", "次回アクション", "次回アクション日", "ステータス"];
      const rows = data.map(a => [
        a.id, a.customerId, a.type, a.subject, a.description || "",
        new Date(a.activityDate).toLocaleDateString("ja-JP"),
        a.nextAction || "",
        a.nextActionDate ? new Date(a.nextActionDate).toLocaleDateString("ja-JP") : "",
        a.progressStatus
      ]);
      return { headers, rows };
    }),

    exportDeals: protectedProcedure.query(async ({ ctx }) => {
      const effectiveOwnerId = getEffectiveOwnerId(ctx.user);
      const data = await db.getAllDealsForExport(effectiveOwnerId);
      const headers = ["ID", "顧客ID", "案件名", "金額", "確度(%)", "フェーズ", "受注予定日", "説明", "作成日"];
      const rows = data.map(d => [
        d.id, d.customerId, d.dealName, d.amount || 0, d.probability || 0,
        d.phase,
        d.expectedCloseDate ? new Date(d.expectedCloseDate).toLocaleDateString("ja-JP") : "",
        d.description || "",
        new Date(d.createdAt).toLocaleDateString("ja-JP")
      ]);
      return { headers, rows };
    }),

    importCustomers: protectedProcedure.input(z.object({
      rows: z.array(z.object({
        companyName: z.string().min(1),
        contactName: z.string().optional(),
        contactEmail: z.string().optional(),
        contactPhone: z.string().optional(),
        address: z.string().optional(),
        postalCode: z.string().optional(),
        industry: z.string().optional(),
        status: z.enum(["active", "inactive", "prospect", "lost"]).optional(),
        notes: z.string().optional(),
      }))
    })).mutation(async ({ ctx, input }) => {
      let imported = 0;
      let errors = 0;
      for (const row of input.rows) {
        try {
          await db.createCustomer({ ...row, ownerId: ctx.user.id });
          imported++;
        } catch (e) {
          errors++;
        }
      }
      return { imported, errors, total: input.rows.length };
    }),
  }),

  // ============ Notification Settings ============
  notificationSettings: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const settings = await db.getNotificationSettings(ctx.user.id);
      return settings || {
        emailEnabled: 1,
        dealReminderDays: 3,
        actionReminderDays: 1,
        weeklyReportEnabled: 1,
      };
    }),

    update: protectedProcedure.input(z.object({
      emailEnabled: z.number().min(0).max(1).optional(),
      dealReminderDays: z.number().min(1).max(30).optional(),
      actionReminderDays: z.number().min(1).max(30).optional(),
      weeklyReportEnabled: z.number().min(0).max(1).optional(),
    })).mutation(async ({ ctx, input }) => {
      return db.upsertNotificationSettings(ctx.user.id, input);
    }),

    // Manual trigger: check and send notifications
    checkAndNotify: protectedProcedure.mutation(async ({ ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "管理者のみ実行可能です" });
      }
      const notifications: string[] = [];

      // Check upcoming deal deadlines
      const upcomingDeals = await db.getUpcomingDealDeadlines(7);
      if (upcomingDeals.length > 0) {
        const dealList = upcomingDeals.map(d =>
          `・ ${d.dealName} (¥${(d.amount ?? 0).toLocaleString()}) - ${d.expectedCloseDate ? new Date(d.expectedCloseDate).toLocaleDateString("ja-JP") : "未設定"}`
        ).join("\n");
        notifications.push(`【案件期限通知】 ${upcomingDeals.length}件の案件が7日以内に期限を迎えます:\n${dealList}`);
      }

      // Check upcoming action deadlines
      const upcomingActions = await db.getUpcomingActionDeadlines(3);
      if (upcomingActions.length > 0) {
        const actionList = upcomingActions.map(a =>
          `・ ${a.subject} - ${a.nextAction || "未設定"} (${a.nextActionDate ? new Date(a.nextActionDate).toLocaleDateString("ja-JP") : ""})`
        ).join("\n");
        notifications.push(`【アクション期限通知】 ${upcomingActions.length}件のアクションが3日以内に期限を迎えます:\n${actionList}`);
      }

      if (notifications.length > 0) {
        const content = notifications.join("\n\n");
        await notifyOwner({
          title: `営業通知: ${upcomingDeals.length}件の案件・${upcomingActions.length}件のアクションが期限間近`,
          content,
        });
      }

      return {
        sent: notifications.length > 0,
        dealCount: upcomingDeals.length,
        actionCount: upcomingActions.length,
        message: notifications.length > 0
          ? `${upcomingDeals.length}件の案件と${upcomingActions.length}件のアクションの通知を送信しました`
          : "期限間近の案件・アクションはありません"
      };
    }),
  }),

  // ============ Dashboard Settings ============
  dashboardSettings: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const settings = await db.getDashboardSettings(ctx.user.id);
      return settings || {
        widgetOrder: JSON.stringify(["stats", "dealPhaseChart", "dealAmountChart", "upcomingActions", "recentActivities"]),
        hiddenWidgets: JSON.stringify([]),
      };
    }),

    update: protectedProcedure.input(z.object({
      widgetOrder: z.string().optional(),
      hiddenWidgets: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      return db.upsertDashboardSettings(ctx.user.id, input);
    }),
  }),


  // ============ Tags ============
  tag: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const effectiveOwnerId = getEffectiveOwnerId(ctx.user);
      return db.getTags(effectiveOwnerId);
    }),

    create: protectedProcedure.input(z.object({
      name: z.string().min(1),
      color: z.string().optional(),
      category: z.enum(["industry", "size", "priority", "status", "custom"]).optional(),
      isShared: z.number().min(0).max(1).optional(),
    })).mutation(async ({ ctx, input }) => {
      // 共有タグは管理者のみ作成可能
      if (input.isShared === 1 && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "共有タグは管理者のみ作成できます" });
      }
      return db.createTag({ ...input, ownerId: ctx.user.id });
    }),

    update: protectedProcedure.input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      color: z.string().optional(),
      category: z.enum(["industry", "size", "priority", "status", "custom"]).optional(),
      isShared: z.number().min(0).max(1).optional(),
    })).mutation(async ({ ctx, input }) => {
      const existing = await db.getTagById(input.id);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if (ctx.user.role !== "admin" && existing.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const { id, ...data } = input;
      await db.updateTag(id, data);
      return { success: true };
    }),

    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const existing = await db.getTagById(input.id);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if (ctx.user.role !== "admin" && existing.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await db.deleteTag(input.id);
      return { success: true };
    }),

    // 顧客のタグ一覧
    forCustomer: protectedProcedure.input(z.object({ customerId: z.number() })).query(async ({ ctx, input }) => {
      return db.getCustomerTags(input.customerId);
    }),

    // タグで絞り込んだ顧客一覧
    customersByTag: protectedProcedure.input(z.object({ tagId: z.number() })).query(async ({ ctx, input }) => {
      const effectiveOwnerId = getEffectiveOwnerId(ctx.user);
      return db.getCustomersByTagId(input.tagId, effectiveOwnerId);
    }),

    // 顧客にタグ付け
    addToCustomer: protectedProcedure.input(z.object({
      customerId: z.number(),
      tagId: z.number(),
    })).mutation(async ({ ctx, input }) => {
      const customer = await db.getCustomerById(input.customerId);
      if (!customer) throw new TRPCError({ code: "NOT_FOUND" });
      assertOwnership(ctx.user.role, ctx.user.id, customer.ownerId);
      return db.addTagToCustomer(input.customerId, input.tagId);
    }),

    // 顧客からタグ解除
    removeFromCustomer: protectedProcedure.input(z.object({
      customerId: z.number(),
      tagId: z.number(),
    })).mutation(async ({ ctx, input }) => {
      const customer = await db.getCustomerById(input.customerId);
      if (!customer) throw new TRPCError({ code: "NOT_FOUND" });
      assertOwnership(ctx.user.role, ctx.user.id, customer.ownerId);
      await db.removeTagFromCustomer(input.customerId, input.tagId);
      return { success: true };
    }),
  }),

  // ============ API Keys (n8n) ============
  apiKey: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "APIキーの管理は管理者のみ可能です" });
      }
      return db.getApiKeys(ctx.user.id);
    }),

    create: protectedProcedure.input(z.object({
      name: z.string().min(1),
    })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "APIキーの作成は管理者のみ可能です" });
      }
      const rawKey = `scrm_${randomBytes(32).toString("hex")}`;
      const keyHash = createHash("sha256").update(rawKey).digest("hex");
      const keyPrefix = rawKey.substring(0, 12) + "...";
      await db.createApiKey({
        ownerId: ctx.user.id,
        name: input.name,
        keyHash,
        keyPrefix,
      });
      // 生のAPIキーは作成時のみ表示
      return { key: rawKey, prefix: keyPrefix };
    }),

    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await db.deleteApiKey(input.id);
      return { success: true };
    }),

    deactivate: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await db.deactivateApiKey(input.id);
      return { success: true };
    }),
  }),

  // ============ Slack Messages ============
  slack: router({
    channels: protectedProcedure.query(async () => {
      return db.getSlackChannels();
    }),

    messages: protectedProcedure.input(z.object({
      channelId: z.string().optional(),
      search: z.string().optional(),
      limit: z.number().min(1).max(100).optional(),
      offset: z.number().min(0).optional(),
    }).optional()).query(async ({ input }) => {
      return db.getSlackMessages({
        channelId: input?.channelId,
        search: input?.search,
        limit: input?.limit || 50,
        offset: input?.offset || 0,
      });
    }),

    // 議事録チャンネルのメッセージ取得（リアルタイムポーリング用）
    minutesMessages: protectedProcedure.input(z.object({
      search: z.string().optional(),
      userName: z.string().optional(),
      limit: z.number().min(1).max(100).optional(),
      offset: z.number().min(0).optional(),
      sinceTs: z.number().optional(),
    }).optional()).query(async ({ input }) => {
      return db.getSlackMessages({
        channelId: "C08GLJY8LBT",
        search: input?.search,
        userName: input?.userName,
        limit: input?.limit || 50,
        offset: input?.offset || 0,
      });
    }),

    // 議事録チャンネルの投稿者一覧を取得
    minutesPosters: protectedProcedure.query(async () => {
      return db.getSlackMessagePosters("C08GLJY8LBT");
    }),

    // 議事録チャンネルの最新メッセージ数を取得（ポーリング用）
    minutesCount: protectedProcedure.query(async () => {
      const result = await db.getSlackMessages({
        channelId: "C08GLJY8LBT",
        limit: 1,
        offset: 0,
      });
      return { total: result.total };
    }),

    // ============ 案件相談シートチャンネル ============
    // 案件相談シートメッセージ取得（リアルタイムポーリング用）
    consultationMessages: protectedProcedure.input(z.object({
      search: z.string().optional(),
      userName: z.string().optional(),
      limit: z.number().min(1).max(100).optional(),
      offset: z.number().min(0).optional(),
    }).optional()).query(async ({ input }) => {
      return db.getSlackMessages({
        channelId: "C08GAE2QWLA",
        search: input?.search,
        userName: input?.userName,
        limit: input?.limit || 50,
        offset: input?.offset || 0,
      });
    }),

    // 案件相談シートチャンネルの投稿者一覧を取得
    consultationPosters: protectedProcedure.query(async () => {
      return db.getSlackMessagePosters("C08GAE2QWLA");
    }),

    // 案件相談シートチャンネルの最新メッセージ数を取得（ポーリング用）
    consultationCount: protectedProcedure.query(async () => {
      const result = await db.getSlackMessages({
        channelId: "C08GAE2QWLA",
        limit: 1,
        offset: 0,
      });
      return { total: result.total };
    }),

    // 案件相談シートチャンネルの同期
    syncConsultation: protectedProcedure.mutation(async () => {
      try {
        const result = await syncSlackMessages();
        return { success: true, message: "案件相談シートチャンネルを同期しました", ...result };
      } catch (err) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `同期エラー: ${String(err)}` });
      }
    }),

    // 案件相談シートのステータス更新（対応済み/未対応）
    updateConsultationStatus: protectedProcedure.input(z.object({
      messageId: z.number(),
      status: z.enum(["pending", "done"]),
    })).mutation(async ({ input }) => {
      return db.updateConsultationStatus(input.messageId, input.status);
    }),

    // 案件相談シートサマリー（ダッシュボード用）
    consultationSummary: protectedProcedure.query(async () => {
      return db.getConsultationSummary();
    }),

    // 案件相談シートの住所データ取得（マップ用）
    consultationAddresses: protectedProcedure.query(async () => {
      return db.getConsultationAddresses();
    }),

    // 案件相談シートの投稿者一覧（件数付き）
    consultationPostersWithCount: protectedProcedure.query(async () => {
      return db.getSlackMessagePostersWithCount("C08GAE2QWLA");
    }),
  }),

  // ============ 議事録No.管理 ============
  minutesNumber: router({
    // 全No.一覧取得
    list: protectedProcedure.query(async () => {
      return db.getAllMinutesNumbers();
    }),

    // 名前でNo.を検索
    findByName: protectedProcedure.input(z.object({
      name: z.string(),
    })).query(async ({ input }) => {
      return db.findMinutesNumberByName(input.name);
    }),

    // 次のNo.を取得
    getNext: protectedProcedure.query(async () => {
      const next = await db.getNextMinutesNumber();
      return { nextNumber: next };
    }),

    // 新しいNo.を登録
    create: protectedProcedure.input(z.object({
      customerName: z.string(),
      note: z.string().optional(),
      slackMessageTs: z.string().optional(),
      customerFileId: z.number().optional(),
    })).mutation(async ({ input }) => {
      const nextNumber = await db.getNextMinutesNumber();
      return db.createMinutesNumber({
        number: nextNumber,
        customerName: input.customerName,
        note: input.note,
        slackMessageTs: input.slackMessageTs,
        customerFileId: input.customerFileId,
      });
    }),
  }),

  // ============ 顧客カルテ ============
  customerFile: router({
    list: protectedProcedure.input(z.object({
      search: z.string().optional(),
      phase: z.string().optional(),
      assignee: z.string().optional(),
      limit: z.number().min(1).max(100).optional(),
      offset: z.number().min(0).optional(),
    }).optional()).query(async ({ input }) => {
      return db.getCustomerFiles({
        search: input?.search,
        phase: input?.phase,
        assignee: input?.assignee,
        limit: input?.limit || 50,
        offset: input?.offset || 0,
      });
    }),

    getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      const file = await db.getCustomerFileById(input.id);
      if (!file) throw new TRPCError({ code: "NOT_FOUND", message: "顧客カルテが見つかりません" });
      return file;
    }),

    searchByName: protectedProcedure.input(z.object({
      search: z.string().min(1),
    })).query(async ({ input }) => {
      return db.searchCustomerFilesByName(input.search);
    }),

    create: protectedProcedure.input(z.object({
      fileNumber: z.string().min(1),
      customerName: z.string().min(1),
      consultationDate: z.string().optional(),
      assignee: z.string().optional(),
      companion: z.string().optional(),
      source: z.string().optional(),
      phase: z.enum(["consultation", "pre_review", "review", "contract", "final_settlement", "completed", "cancelled"]).optional(),
      notes: z.string().optional(),
    })).mutation(async ({ input }) => {
      return db.createCustomerFile(input);
    }),

    update: protectedProcedure.input(z.object({
      id: z.number(),
      fileNumber: z.string().optional(),
      customerName: z.string().optional(),
      consultationDate: z.string().optional(),
      assignee: z.string().optional(),
      companion: z.string().optional(),
      source: z.string().optional(),
      contractDeposit: z.string().optional(),
      commission: z.string().optional(),
      consent: z.string().optional(),
      realEstateFile: z.string().optional(),
      businessCardCollection: z.string().optional(),
      nameplate: z.string().optional(),
      rentalManagement: z.string().optional(),
      docLicense: z.string().optional(),
      docInsurance: z.string().optional(),
      docGensen1: z.string().optional(),
      docGensen2: z.string().optional(),
      docGensen3: z.string().optional(),
      docCic: z.string().optional(),
      docPublicDoc: z.string().optional(),
      docPreReview: z.string().optional(),
      docCompliance: z.string().optional(),
      docHearing: z.string().optional(),
      docExistingLoan: z.string().optional(),
      customerId: z.number().nullable().optional(),
      propertyAddress: z.string().optional(),
      propertyPrice: z.string().optional(),
      miscCosts: z.string().optional(),
      totalFinancing: z.string().optional(),
      buildingArea: z.string().optional(),
      landArea: z.string().optional(),
      buildYear: z.string().optional(),
      structure: z.string().optional(),
      layout: z.string().optional(),
      phase: z.enum(["consultation", "pre_review", "review", "contract", "final_settlement", "completed", "cancelled"]).optional(),
      financialInstitution: z.string().optional(),
      broker: z.string().optional(),
      notes: z.string().optional(),
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      await db.updateCustomerFile(id, data);
      return { success: true };
    }),

    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await db.deleteCustomerFile(input.id);
      return { success: true };
    }),

    stats: protectedProcedure.query(async () => {
      return db.getCustomerFileStats();
    }),

    assignees: protectedProcedure.query(async () => {
      return db.getCustomerFileAssignees();
    }),

    // 書類チェック欄の個別トグル（ワンクリックでチェック/アンチェック）
    toggleDocCheck: protectedProcedure.input(z.object({
      id: z.number(),
      field: z.enum(["contractDeposit", "commission", "consent", "realEstateFile", "businessCardCollection", "nameplate", "rentalManagement", "docLicense", "docInsurance", "docGensen1", "docGensen2", "docGensen3", "docCic", "docPublicDoc", "docPreReview", "docCompliance", "docHearing", "docExistingLoan"]),
      checked: z.boolean(),
    })).mutation(async ({ input }) => {
      const value = input.checked ? new Date().toLocaleDateString("ja-JP") : "";
      await db.updateCustomerFile(input.id, { [input.field]: value });

      // 預かり書類11項目が全て完了したかチェック
      const DOC_FIELDS = ["docLicense", "docInsurance", "docGensen1", "docGensen2", "docGensen3", "docCic", "docPublicDoc", "docPreReview", "docCompliance", "docHearing", "docExistingLoan"] as const;
      if (input.checked && DOC_FIELDS.includes(input.field as any)) {
        try {
          const file = await db.getCustomerFileById(input.id);
          if (file) {
            const allComplete = DOC_FIELDS.every(f => !!file[f] || f === input.field);
            if (allComplete) {
              const customerName = file.customerName || "不明";
              const fileNumber = file.fileNumber || "";
              const assignee = file.assignee || "未割当";
              await notifyOwner({
                title: `\u2705 書類チェック完了: ${fileNumber} ${customerName}`,
                content: `${fileNumber} ${customerName}様の預かり書類チェックシートが全11項目完了しました。\n\n担当: ${assignee}\n完了日時: ${new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}\n\n※ この通知は管理者（長谷川光・上田歩）に送信されています。`,
              });
              console.log(`[DocCheck] 全11項目完了通知送信: ${fileNumber} ${customerName}`);
            }
          }
        } catch (err) {
          console.error("[DocCheck] 完了通知送信エラー:", err);
        }
      }

      return { success: true, field: input.field, checked: input.checked };
    }),
  }),

  // ============ AI Reports ============
  aiReport: router({
    list: protectedProcedure.input(z.object({
      reportType: z.string().optional(),
    }).optional()).query(async ({ ctx, input }) => {
      const effectiveOwnerId = getEffectiveOwnerId(ctx.user);
      return db.getAiReports(effectiveOwnerId, input?.reportType);
    }),

    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      await db.deleteAiReport(input.id);
      return { success: true };
    }),

    generate: protectedProcedure.input(z.object({
      reportType: z.enum(["weekly", "monthly"]),
    })).mutation(async ({ ctx, input }) => {
      const effectiveOwnerId = getEffectiveOwnerId(ctx.user);
      const now = Date.now();
      const periodDays = input.reportType === "weekly" ? 7 : 30;
      const periodStart = now - periodDays * 24 * 60 * 60 * 1000;

      const [customerList, activityList, dealList, stats] = await Promise.all([
        db.getCustomers(effectiveOwnerId),
        db.getActivities(effectiveOwnerId),
        db.getDeals(effectiveOwnerId),
        db.getDashboardStats(effectiveOwnerId),
      ]);

      const recentActivities = activityList.filter(a => a.activityDate >= periodStart);
      const recentDeals = dealList.filter(d => d.createdAt.getTime() >= periodStart || d.updatedAt.getTime() >= periodStart);

      const prompt = `あなたは営業マネージャーのAIアシスタントです。以下の営業データを分析し、${input.reportType === "weekly" ? "週次" : "月次"}レポートを日本語で作成してください。

## 期間データ
- 総顧客数: ${stats.totalCustomers}
- アクティブ案件数: ${stats.activeDeals}
- アクティブ案件総額: ¥${stats.totalDealAmount.toLocaleString()}
- 受注案件数: ${stats.wonDeals}
- 受注総額: ¥${stats.wonAmount.toLocaleString()}
- 今月の営業活動数: ${stats.activitiesThisMonth}

## 期間中の営業活動 (${recentActivities.length}件)
${recentActivities.slice(0, 20).map(a => `- ${a.subject} (${a.type}, ${a.progressStatus})`).join("\n")}

## 案件状況 (${recentDeals.length}件更新)
${recentDeals.slice(0, 20).map(d => `- ${d.dealName}: ${d.phase} (¥${(d.amount ?? 0).toLocaleString()}, 確度${d.probability}%)`).join("\n")}

以下の構成でレポートを作成してください：
1. **サマリー**: 期間の概要
2. **営業活動分析**: 活動量と質の評価
3. **案件パイプライン分析**: フェーズ別の状況
4. **改善提案**: 具体的なアクションプラン（3-5項目）
5. **注目ポイント**: 特に注意すべき案件や顧客`;

      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "あなたは営業分析の専門家です。データに基づいた具体的で実用的なレポートを作成してください。" },
            { role: "user", content: prompt },
          ],
        });

        const rawContent = response.choices[0]?.message?.content;
        const content = typeof rawContent === "string" ? rawContent : "レポートの生成に失敗しました。";
        const title = `${input.reportType === "weekly" ? "週次" : "月次"}営業レポート - ${new Date().toLocaleDateString("ja-JP")}`;

        const report = await db.createAiReport({
          ownerId: effectiveOwnerId,
          reportType: input.reportType,
          title,
          content,
          periodStart,
          periodEnd: now,
        });

        return { id: report.id, title, content };
      } catch (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AIレポートの生成に失敗しました" });
      }
    }),
  }),
  // ============ Slack通知・手動トリガー ============
  slackNotify: router({
    // 手動で週次報告をトリガー
    triggerWeeklyReport: adminProcedure.mutation(async () => {
      const result = await sendWeeklyReportNotification();
      return result;
    }),

    // 未チェックレポートのプレビュー取得
    previewReport: adminProcedure.query(async () => {
      const report = await getUncheckedReport();
      const message = formatWeeklyReport(report);
      return { report, message };
    }),

    // 手動で書類リマインドをトリガー
    triggerDocReminder: adminProcedure.mutation(async () => {
      const result = await sendDocReminder();
      return result;
    }),

    // 書類リマインドのプレビュー取得
    previewDocReminder: adminProcedure.query(async () => {
      const { message, assigneeCount } = await generateDocReminder();
      return { message, assigneeCount };
    }),

    // 手動でSlack同期をトリガー
    triggerSlackSync: adminProcedure.mutation(async () => {
      const result = await syncSlackMessages();
      return result;
    }),
  }),

  // 会議シート（Googleスプレッドシート連動）
  meetingSheet: router({
    getConsultationSheet: protectedProcedure.query(async () => {
      const SPREADSHEET_ID = "1wxesoezXlnqWDzm45sk6tg9Ol08BpWWyMd9nroZFHw8";
      const GID = "1647255290";
      const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=${GID}`;
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
        const csv = await res.text();
        return parseCSV(csv);
      } catch (e: any) {
        console.error("Failed to fetch consultation sheet:", e.message);
        return [];
      }
    }),
    getCaseProgressSheet: protectedProcedure.query(async () => {
      const SPREADSHEET_ID = "1wxesoezXlnqWDzm45sk6tg9Ol08BpWWyMd9nroZFHw8";
      const GID = "365311762";
      const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=${GID}`;
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
        const csv = await res.text();
        return parseCSV(csv);
      } catch (e: any) {
        console.error("Failed to fetch case progress sheet:", e.message);
        return [];
      }
    }),
  }),

  // ============ 資金計画書 ============
  fundingPlan: router({
    list: protectedProcedure.input(z.object({
      status: z.string().optional(),
      limit: z.number().optional(),
      offset: z.number().optional(),
    }).optional()).query(async ({ input }) => {
      return db.getFundingPlans(input);
    }),

    getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return db.getFundingPlanById(input.id);
    }),

    create: protectedProcedure.input(z.object({
      customerName: z.string().min(1),
      propertyName: z.string().optional(),
      fileUrl: z.string().optional(),
      fileName: z.string().optional(),
      fileType: z.string().optional(),
      note: z.string().optional(),
      formData: z.any().optional(),
      customerFileId: z.number().nullable().optional(),
    })).mutation(async ({ ctx, input }) => {
      const result = await db.createFundingPlan({
        ...input,
        submittedBy: ctx.user.id,
        submittedByName: ctx.user.name || '不明',
        status: 'pending',
      });
      // 管理者に通知
      try {
        await notifyOwner({
          title: '📊 資金計画書が投稿されました',
          content: `投稿者: ${ctx.user.name || '不明'}\nお客様: ${input.customerName}\n物件: ${input.propertyName || '未設定'}\nファイル: ${input.fileName}\n\nダッシュボードから確認してください。`,
        });
      } catch (e) { console.error('Notification failed:', e); }
      // Slack通知キューに追加（新規投稿）
      try {
        await db.addSlackNotification({
          channelId: 'C08JCFA8XLY',
          channelName: '業務-案件会議-',
          message: `📊 *資金計画書が投稿されました*\n投稿者: ${ctx.user.name || '不明'}\nお客様: ${input.customerName}\n物件: ${input.propertyName || '未設定'}`,
          type: 'funding_plan_created',
          referenceId: null,
        });
      } catch (e) { console.error('Slack notification queue failed:', e); }
      return result;
    }),

    updateStatus: adminProcedure.input(z.object({
      id: z.number(),
      status: z.enum(['pending', 'reviewing', 'approved', 'rejected']),
      reviewComment: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const existing = await db.getFundingPlanById(input.id);
      await db.updateFundingPlanStatus(input.id, {
        status: input.status,
        reviewedBy: ctx.user.id,
        reviewedByName: ctx.user.name || '不明',
        reviewComment: input.reviewComment,
      });
      // 投稿者へ通知
      if (existing) {
        const statusLabel = input.status === 'approved' ? '承認（OK）' : input.status === 'rejected' ? '差し戻し' : input.status === 'reviewing' ? '確認中' : input.status;
        try {
          await notifyOwner({
            title: `📊 資金計画書が${statusLabel}になりました`,
            content: `お客様: ${existing.customerName}\n物件: ${existing.propertyName || '未設定'}\nステータス: ${statusLabel}\n確認者: ${ctx.user.name || '不明'}${input.reviewComment ? `\nコメント: ${input.reviewComment}` : ''}\n投稿者: ${existing.submittedByName || '不明'}`,
          });
        } catch (e) { console.error('Notification failed:', e); }
        // Slack通知キューに追加
        try {
          const emoji = input.status === 'approved' ? '✅' : input.status === 'rejected' ? '❌' : '🔍';
          await db.addSlackNotification({
            channelId: 'C08JCFA8XLY',
            channelName: '業務-案件会議-',
            message: `${emoji} *資金計画書 - ${statusLabel}*\nお客様: ${existing.customerName}\n物件: ${existing.propertyName || '未設定'}\n確認者: ${ctx.user.name || '不明'}${input.reviewComment ? `\nコメント: ${input.reviewComment}` : ''}\n投稿者: ${existing.submittedByName || '不明'}`,
            type: 'funding_plan_status',
            referenceId: input.id,
          });
        } catch (e) { console.error('Slack notification queue failed:', e); }
      }
      return { success: true };
    }),

    summary: protectedProcedure.query(async () => {
      return db.getFundingPlanSummary();
    }),

    update: protectedProcedure.input(z.object({
      id: z.number(),
      customerName: z.string().optional(),
      propertyName: z.string().optional(),
      formData: z.any().optional(),
      note: z.string().optional(),
      customerFileId: z.number().nullable().optional(),
    })).mutation(async ({ ctx, input }) => {
      const existing = await db.getFundingPlanById(input.id);
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });
      if (ctx.user.role !== 'admin' && ctx.user.id !== existing.submittedBy) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
      const { id, ...data } = input;
      await db.updateFundingPlanFormData(id, data);
      return { success: true };
    }),

    upload: protectedProcedure.input(z.object({
      fileName: z.string(),
      fileBase64: z.string(),
      fileType: z.string(),
    })).mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.fileBase64, 'base64');
      const ext = input.fileName.split('.').pop() || 'pdf';
      const key = `funding-plans/${ctx.user.id}/${nanoid()}.${ext}`;
      const { url } = await storagePut(key, buffer, input.fileType);
      return { url, key };
    }),
  }),

  // ============ 買付証明書 ============
  purchaseOffer: router({
    list: protectedProcedure.input(z.object({
      status: z.string().optional(),
      limit: z.number().optional(),
      offset: z.number().optional(),
    }).optional()).query(async ({ input }) => {
      return db.getPurchaseOffers(input);
    }),

    getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return db.getPurchaseOfferById(input.id);
    }),

    create: protectedProcedure.input(z.object({
      customerName: z.string().min(1),
      propertyName: z.string().optional(),
      propertyAddress: z.string().optional(),
      purchasePrice: z.string().optional(),
      deposit: z.string().optional(),
      fileUrl: z.string().optional(),
      fileName: z.string().optional(),
      fileType: z.string().optional(),
      note: z.string().optional(),
      formData: z.any().optional(),
      customerFileId: z.number().nullable().optional(),
    })).mutation(async ({ ctx, input }) => {
      const result = await db.createPurchaseOffer({
        ...input,
        submittedBy: ctx.user.id,
        submittedByName: ctx.user.name || '不明',
        status: 'pending',
      });
      // 管理者に通知
      try {
        await notifyOwner({
          title: '🏠 買付証明書が投稿されました',
          content: `投稿者: ${ctx.user.name || '不明'}\nお客様: ${input.customerName}\n物件: ${input.propertyName || '未設定'}\n価格: ${input.purchasePrice || '未設定'}\n手付金: ${input.deposit || '未設定'}\nファイル: ${input.fileName}\n\nダッシュボードから確認してください。`,
        });
      } catch (e) { console.error('Notification failed:', e); }
      // Slack通知キューに追加（新規投稿）
      try {
        await db.addSlackNotification({
          channelId: 'C08JCFA8XLY',
          channelName: '業務-案件会議-',
          message: `🏠 *買付証明書が投稿されました*\n投稿者: ${ctx.user.name || '不明'}\nお客様: ${input.customerName}\n物件: ${input.propertyName || '未設定'}\n価格: ${input.purchasePrice || '未設定'}`,
          type: 'purchase_offer_created',
          referenceId: null,
        });
      } catch (e) { console.error('Slack notification queue failed:', e); }
      return result;
    }),

    updateStatus: adminProcedure.input(z.object({
      id: z.number(),
      status: z.enum(['pending', 'reviewing', 'approved', 'rejected']),
      reviewComment: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const existing = await db.getPurchaseOfferById(input.id);
      await db.updatePurchaseOfferStatus(input.id, {
        status: input.status,
        reviewedBy: ctx.user.id,
        reviewedByName: ctx.user.name || '不明',
        reviewComment: input.reviewComment,
      });
      // 投稿者へ通知
      if (existing) {
        const statusLabel = input.status === 'approved' ? '買付OK' : input.status === 'rejected' ? '差し戻し' : input.status === 'reviewing' ? '確認中' : input.status;
        try {
          await notifyOwner({
            title: `🏠 買付証明書が${statusLabel}になりました`,
            content: `お客様: ${existing.customerName}\n物件: ${existing.propertyName || '未設定'}\n価格: ${existing.purchasePrice || '未設定'}\nステータス: ${statusLabel}\n確認者: ${ctx.user.name || '不明'}${input.reviewComment ? `\nコメント: ${input.reviewComment}` : ''}\n投稿者: ${existing.submittedByName || '不明'}`,
          });
        } catch (e) { console.error('Notification failed:', e); }
        // Slack通知キューに追加
        try {
          const emoji = input.status === 'approved' ? '✅' : input.status === 'rejected' ? '❌' : '🔍';
          await db.addSlackNotification({
            channelId: 'C08JCFA8XLY',
            channelName: '業務-案件会議-',
            message: `${emoji} *買付証明書 - ${statusLabel}*\nお客様: ${existing.customerName}\n物件: ${existing.propertyName || '未設定'}\n価格: ${existing.purchasePrice || '未設定'}\n確認者: ${ctx.user.name || '不明'}${input.reviewComment ? `\nコメント: ${input.reviewComment}` : ''}\n投稿者: ${existing.submittedByName || '不明'}`,
            type: 'purchase_offer_status',
            referenceId: input.id,
          });
        } catch (e) { console.error('Slack notification queue failed:', e); }
      }
      return { success: true };
    }),

    summary: protectedProcedure.query(async () => {
      return db.getPurchaseOfferSummary();
    }),

    update: protectedProcedure.input(z.object({
      id: z.number(),
      customerName: z.string().optional(),
      propertyName: z.string().optional(),
      propertyAddress: z.string().optional(),
      purchasePrice: z.string().optional(),
      deposit: z.string().optional(),
      formData: z.any().optional(),
      note: z.string().optional(),
      customerFileId: z.number().nullable().optional(),
    })).mutation(async ({ ctx, input }) => {
      const existing = await db.getPurchaseOfferById(input.id);
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });
      if (ctx.user.role !== 'admin' && ctx.user.id !== existing.submittedBy) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
      const { id, ...data } = input;
      await db.updatePurchaseOfferFormData(id, data);
      return { success: true };
    }),

    upload: protectedProcedure.input(z.object({
      fileName: z.string(),
      fileBase64: z.string(),
      fileType: z.string(),
    })).mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.fileBase64, 'base64');
      const ext = input.fileName.split('.').pop() || 'pdf';
      const key = `purchase-offers/${ctx.user.id}/${nanoid()}.${ext}`;
      const { url } = await storagePut(key, buffer, input.fileType);
      return { url, key };
    }),
  }),

  formTemplate: router({
    list: protectedProcedure.input(z.object({
      type: z.enum(["purchaseOffer", "fundingPlan"]),
    })).query(async ({ ctx, input }) => {
      return db.getFormTemplates(ctx.user.id, input.type);
    }),

    create: protectedProcedure.input(z.object({
      name: z.string().min(1, "テンプレート名を入力してください"),
      type: z.enum(["purchaseOffer", "fundingPlan"]),
      formData: z.any(),
      isShared: z.number().min(0).max(1).optional().default(0),
    })).mutation(async ({ ctx, input }) => {
      const id = await db.createFormTemplate({
        ownerId: ctx.user.id,
        ownerName: ctx.user.name || "不明",
        name: input.name,
        type: input.type,
        formData: input.formData,
        isShared: input.isShared,
      });
      return { id };
    }),

    update: protectedProcedure.input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      formData: z.any().optional(),
      isShared: z.number().min(0).max(1).optional(),
    })).mutation(async ({ ctx, input }) => {
      const updateData: any = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.formData !== undefined) updateData.formData = input.formData;
      if (input.isShared !== undefined) updateData.isShared = input.isShared;
      await db.updateFormTemplate(input.id, ctx.user.id, updateData);
      return { success: true };
    }),

    delete: protectedProcedure.input(z.object({
      id: z.number(),
    })).mutation(async ({ ctx, input }) => {
      await db.deleteFormTemplate(input.id, ctx.user.id);
      return { success: true };
    }),
  }),

  slackNotification: router({
    pending: adminProcedure.query(async () => {
      return db.getPendingSlackNotifications();
    }),

    markSent: adminProcedure.input(z.object({
      id: z.number(),
    })).mutation(async ({ input }) => {
      await db.markSlackNotificationSent(input.id);
      return { success: true };
    }),

    markFailed: adminProcedure.input(z.object({
      id: z.number(),
      errorMessage: z.string(),
    })).mutation(async ({ input }) => {
      await db.markSlackNotificationFailed(input.id, input.errorMessage);
      return { success: true };
    }),

    history: adminProcedure.query(async () => {
      return db.getSlackNotificationHistory();
    }),
  }),
});

// CSVパーサー（Google Sheets CSV形式対応）
function parseCSV(csv: string): Record<string, string>[] {
  const lines: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (ch === '"') {
      if (inQuotes && csv[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === '\n' && !inQuotes) {
      lines.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) lines.push(current);

  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    let hasData = false;
    headers.forEach((h, idx) => {
      const key = h.trim();
      const val = (values[idx] || "").trim();
      if (key) {
        row[key] = val;
        if (val) hasData = true;
      }
    });
    if (hasData) rows.push(row);
  }
  return rows;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

export type AppRouter = typeof appRouter;
