import { Router, Request, Response, NextFunction } from "express";
import { createHash } from "crypto";
import * as db from "./db";

const webhookRouter = Router();

// API Key認証ミドルウェア
async function authenticateApiKey(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "APIキーが必要です。Authorization: Bearer <API_KEY> を設定してください。" });
    return;
  }

  const rawKey = authHeader.substring(7);
  const keyHash = createHash("sha256").update(rawKey).digest("hex");

  try {
    const apiKey = await db.getApiKeyByHash(keyHash);
    if (!apiKey) {
      res.status(401).json({ error: "無効なAPIキーです。" });
      return;
    }
    // 最終使用日時を更新
    await db.updateApiKeyLastUsed(apiKey.id);
    // ownerIdをリクエストに付与
    (req as any).apiKeyOwnerId = apiKey.ownerId;
    next();
  } catch (error) {
    res.status(500).json({ error: "認証処理でエラーが発生しました。" });
  }
}

// 全ルートにAPI Key認証を適用
webhookRouter.use(authenticateApiKey);

// ============ 顧客API ============

// GET /api/webhook/customers - 顧客一覧取得
webhookRouter.get("/customers", async (req: Request, res: Response) => {
  try {
    const { search, status } = req.query;
    const customers = await db.getCustomers(
      null, // admin権限（全データ取得）
      search as string | undefined,
      status as string | undefined
    );
    res.json({ success: true, data: customers, count: customers.length });
  } catch (error) {
    res.status(500).json({ error: "顧客データの取得に失敗しました。" });
  }
});

// GET /api/webhook/customers/:id - 顧客詳細取得
webhookRouter.get("/customers/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "無効なIDです。" });
      return;
    }
    const customer = await db.getCustomerById(id);
    if (!customer) {
      res.status(404).json({ error: "顧客が見つかりません。" });
      return;
    }
    res.json({ success: true, data: customer });
  } catch (error) {
    res.status(500).json({ error: "顧客データの取得に失敗しました。" });
  }
});

// POST /api/webhook/customers - 顧客作成
webhookRouter.post("/customers", async (req: Request, res: Response) => {
  try {
    const { companyName, contactName, contactEmail, contactPhone, address, postalCode, industry, status, notes } = req.body;
    if (!companyName) {
      res.status(400).json({ error: "companyName は必須です。" });
      return;
    }
    const ownerId = (req as any).apiKeyOwnerId;
    const result = await db.createCustomer({
      companyName, contactName, contactEmail, contactPhone, address, postalCode, industry,
      status: status || "prospect", notes, ownerId,
    });
    res.status(201).json({ success: true, data: { id: result.id } });
  } catch (error) {
    res.status(500).json({ error: "顧客の作成に失敗しました。" });
  }
});

// PUT /api/webhook/customers/:id - 顧客更新
webhookRouter.put("/customers/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "無効なIDです。" });
      return;
    }
    const existing = await db.getCustomerById(id);
    if (!existing) {
      res.status(404).json({ error: "顧客が見つかりません。" });
      return;
    }
    const { companyName, contactName, contactEmail, contactPhone, address, postalCode, industry, status, notes } = req.body;
    await db.updateCustomer(id, { companyName, contactName, contactEmail, contactPhone, address, postalCode, industry, status, notes });
    res.json({ success: true, message: "顧客を更新しました。" });
  } catch (error) {
    res.status(500).json({ error: "顧客の更新に失敗しました。" });
  }
});

// DELETE /api/webhook/customers/:id - 顧客削除
webhookRouter.delete("/customers/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "無効なIDです。" });
      return;
    }
    const existing = await db.getCustomerById(id);
    if (!existing) {
      res.status(404).json({ error: "顧客が見つかりません。" });
      return;
    }
    await db.deleteCustomer(id);
    res.json({ success: true, message: "顧客を削除しました。" });
  } catch (error) {
    res.status(500).json({ error: "顧客の削除に失敗しました。" });
  }
});

// ============ 営業活動API ============

// GET /api/webhook/activities - 営業活動一覧取得
webhookRouter.get("/activities", async (req: Request, res: Response) => {
  try {
    const { customerId, status } = req.query;
    const activities = await db.getActivities(
      null,
      customerId ? parseInt(customerId as string) : undefined,
      status as string | undefined
    );
    res.json({ success: true, data: activities, count: activities.length });
  } catch (error) {
    res.status(500).json({ error: "営業活動データの取得に失敗しました。" });
  }
});

// POST /api/webhook/activities - 営業活動作成
webhookRouter.post("/activities", async (req: Request, res: Response) => {
  try {
    const { customerId, type, subject, description, activityDate, nextAction, nextActionDate, progressStatus } = req.body;
    if (!customerId || !subject) {
      res.status(400).json({ error: "customerId と subject は必須です。" });
      return;
    }
    const ownerId = (req as any).apiKeyOwnerId;
    const result = await db.createActivity({
      customerId, type: type || "other", subject, description,
      activityDate: activityDate || Date.now(), nextAction, nextActionDate,
      progressStatus: progressStatus || "planned", ownerId,
    });
    res.status(201).json({ success: true, data: { id: result.id } });
  } catch (error) {
    res.status(500).json({ error: "営業活動の作成に失敗しました。" });
  }
});

// ============ 案件API ============

// GET /api/webhook/deals - 案件一覧取得
webhookRouter.get("/deals", async (req: Request, res: Response) => {
  try {
    const { phase, customerId } = req.query;
    const deals = await db.getDeals(
      null,
      phase as string | undefined,
      customerId ? parseInt(customerId as string) : undefined
    );
    res.json({ success: true, data: deals, count: deals.length });
  } catch (error) {
    res.status(500).json({ error: "案件データの取得に失敗しました。" });
  }
});

// POST /api/webhook/deals - 案件作成
webhookRouter.post("/deals", async (req: Request, res: Response) => {
  try {
    const { customerId, dealName, amount, probability, phase, expectedCloseDate, description } = req.body;
    if (!customerId || !dealName) {
      res.status(400).json({ error: "customerId と dealName は必須です。" });
      return;
    }
    const ownerId = (req as any).apiKeyOwnerId;
    const result = await db.createDeal({
      customerId, dealName, amount, probability,
      phase: phase || "lead", expectedCloseDate, description, ownerId,
    });
    res.status(201).json({ success: true, data: { id: result.id } });
  } catch (error) {
    res.status(500).json({ error: "案件の作成に失敗しました。" });
  }
});

// ============ ダッシュボードAPI ============

// GET /api/webhook/dashboard - ダッシュボード統計取得
webhookRouter.get("/dashboard", async (req: Request, res: Response) => {
  try {
    const stats = await db.getDashboardStats(null);
    const dealsByPhase = await db.getDealsByPhase(null);
    res.json({ success: true, data: { stats, dealsByPhase } });
  } catch (error) {
    res.status(500).json({ error: "ダッシュボードデータの取得に失敗しました。" });
  }
});

// ============ Slackメッセージ同期API ============
// POST /api/webhook/slack-sync - Slackメッセージをバッチ保存
webhookRouter.post("/slack-sync", async (req: Request, res: Response) => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "messages配列が必要です" });
      return;
    }
    
    let synced = 0;
    const errors: string[] = [];
    
    for (const msg of messages) {
      try {
        await db.upsertSlackMessage({
          channelId: msg.channelId,
          channelName: msg.channelName,
          messageTs: msg.messageTs,
          userId: msg.userId || null,
          userName: msg.userName || null,
          messageText: msg.messageText || null,
          threadTs: msg.threadTs || null,
          threadReplyCount: msg.threadReplyCount || 0,
          reactions: msg.reactions ? JSON.stringify(msg.reactions) : undefined,
          files: msg.files ? JSON.stringify(msg.files) : undefined,
          postedAt: msg.postedAt || Date.now(),
        });
        synced++;
      } catch (err) {
        errors.push(`${msg.messageTs}: ${String(err)}`);
      }
    }
    
    res.json({ success: true, data: { synced, errors: errors.length, errorDetails: errors.slice(0, 5) } });
  } catch (error) {
    res.status(500).json({ error: "Slackメッセージの同期に失敗しました" });
  }
});

export { webhookRouter };
