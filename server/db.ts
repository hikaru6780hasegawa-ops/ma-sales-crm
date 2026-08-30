import { eq, and, like, or, desc, asc, sql, gte, lte, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  customers, InsertCustomer, Customer,
  activities, InsertActivity, Activity,
  deals, InsertDeal, Deal,
  aiReports, InsertAiReport,
  folders, InsertFolder,
  scannedDocuments, InsertScannedDocument,
  dashboardSettings, InsertDashboardSetting,
  notificationSettings, InsertNotificationSetting,
  tags, InsertTag,
  customerTags, InsertCustomerTag,
  apiKeys, InsertApiKey,
  customerFiles, InsertCustomerFile, CustomerFile,
  slackMessages,
  minutesNumbers, InsertMinutesNumber,
  fundingPlans, InsertFundingPlan,
  purchaseOffers, InsertPurchaseOffer,
  formTemplates, InsertFormTemplate,
  slackNotificationQueue, InsertSlackNotificationQueue,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============ Users ============
export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: users.id, name: users.name, email: users.email, role: users.role }).from(users).orderBy(asc(users.name));
}

// ============ Folders ============
export async function getFolders(ownerId: number | null, parentId?: number | null) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (ownerId !== null) conditions.push(eq(folders.ownerId, ownerId));
  if (parentId !== undefined) {
    if (parentId === null) {
      conditions.push(sql`${folders.parentId} IS NULL`);
    } else {
      conditions.push(eq(folders.parentId, parentId));
    }
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  return db.select().from(folders).where(where).orderBy(asc(folders.name));
}

export async function getFolderById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(folders).where(eq(folders.id, id)).limit(1);
  return result[0];
}

export async function createFolder(data: InsertFolder) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(folders).values(data);
  return { id: result[0].insertId };
}

export async function updateFolder(id: number, data: Partial<InsertFolder>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(folders).set(data).where(eq(folders.id, id));
}

export async function deleteFolder(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // フォルダ内の顧客のfolderIdをnullに
  await db.update(customers).set({ folderId: null }).where(eq(customers.folderId, id));
  // フォルダ内のドキュメントのfolderIdをnullに
  await db.update(scannedDocuments).set({ folderId: null }).where(eq(scannedDocuments.folderId, id));
  // 子フォルダのparentIdをnullに
  await db.update(folders).set({ parentId: null }).where(eq(folders.parentId, id));
  await db.delete(folders).where(eq(folders.id, id));
}

// ============ Customers ============
export async function getCustomers(ownerId: number | null, search?: string, status?: string, folderId?: number | null) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (ownerId !== null) conditions.push(eq(customers.ownerId, ownerId));
  if (search) {
    conditions.push(
      or(
        like(customers.companyName, `%${search}%`),
        like(customers.contactName, `%${search}%`),
        like(customers.contactEmail, `%${search}%`),
        like(customers.contactPhone, `%${search}%`),
        like(customers.address, `%${search}%`),
        like(customers.industry, `%${search}%`),
        sql`${customers.id} = ${parseInt(search) || 0}`
      )!
    );
  }
  if (status) conditions.push(eq(customers.status, status as any));
  if (folderId !== undefined) {
    if (folderId === null) {
      conditions.push(sql`${customers.folderId} IS NULL`);
    } else {
      conditions.push(eq(customers.folderId, folderId!));
    }
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  return db.select().from(customers).where(where).orderBy(desc(customers.updatedAt));
}

export async function getCustomerById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  return result[0];
}

export async function createCustomer(data: InsertCustomer) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(customers).values(data);
  return { id: result[0].insertId };
}

export async function updateCustomer(id: number, data: Partial<InsertCustomer>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(customers).set(data).where(eq(customers.id, id));
}

export async function deleteCustomer(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(activities).where(eq(activities.customerId, id));
  await db.delete(deals).where(eq(deals.customerId, id));
  await db.delete(scannedDocuments).where(eq(scannedDocuments.customerId, id));
  await db.delete(customers).where(eq(customers.id, id));
}

// ============ Activities ============
export async function getActivities(ownerId: number | null, customerId?: number, status?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (ownerId !== null) conditions.push(eq(activities.ownerId, ownerId));
  if (customerId) conditions.push(eq(activities.customerId, customerId));
  if (status) conditions.push(eq(activities.progressStatus, status as any));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  return db.select().from(activities).where(where).orderBy(desc(activities.activityDate));
}

export async function getActivityById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(activities).where(eq(activities.id, id)).limit(1);
  return result[0];
}

export async function createActivity(data: InsertActivity) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(activities).values(data);
  return { id: result[0].insertId };
}

export async function updateActivity(id: number, data: Partial<InsertActivity>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(activities).set(data).where(eq(activities.id, id));
}

export async function deleteActivity(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(activities).where(eq(activities.id, id));
}

// ============ Deals ============
export async function getDeals(ownerId: number | null, phase?: string, customerId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (ownerId !== null) conditions.push(eq(deals.ownerId, ownerId));
  if (phase) conditions.push(eq(deals.phase, phase as any));
  if (customerId) conditions.push(eq(deals.customerId, customerId));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  return db.select().from(deals).where(where).orderBy(desc(deals.updatedAt));
}

export async function getDealById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(deals).where(eq(deals.id, id)).limit(1);
  return result[0];
}

export async function createDeal(data: InsertDeal) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(deals).values(data);
  return { id: result[0].insertId };
}

export async function updateDeal(id: number, data: Partial<InsertDeal>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(deals).set(data).where(eq(deals.id, id));
}

export async function deleteDeal(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(deals).where(eq(deals.id, id));
}

// ============ Scanned Documents ============
export async function getScannedDocuments(ownerId: number | null, customerId?: number, folderId?: number | null) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (ownerId !== null) conditions.push(eq(scannedDocuments.ownerId, ownerId));
  if (customerId) conditions.push(eq(scannedDocuments.customerId, customerId));
  if (folderId !== undefined) {
    if (folderId === null) {
      conditions.push(sql`${scannedDocuments.folderId} IS NULL`);
    } else {
      conditions.push(eq(scannedDocuments.folderId, folderId!));
    }
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  return db.select().from(scannedDocuments).where(where).orderBy(desc(scannedDocuments.createdAt));
}

export async function getScannedDocumentById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(scannedDocuments).where(eq(scannedDocuments.id, id)).limit(1);
  return result[0];
}

export async function createScannedDocument(data: InsertScannedDocument) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(scannedDocuments).values(data);
  return { id: result[0].insertId };
}

export async function updateScannedDocument(id: number, data: Partial<InsertScannedDocument>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(scannedDocuments).set(data).where(eq(scannedDocuments.id, id));
}

export async function deleteScannedDocument(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(scannedDocuments).where(eq(scannedDocuments.id, id));
}

// ============ Dashboard Stats ============
export async function getDashboardStats(ownerId: number | null) {
  const db = await getDb();
  if (!db) return { totalCustomers: 0, activeDeals: 0, totalDealAmount: 0, activitiesThisMonth: 0, wonDeals: 0, wonAmount: 0 };

  const ownerFilter = ownerId !== null;

  const customerCount = await db.select({ count: sql<number>`count(*)` }).from(customers)
    .where(ownerFilter ? eq(customers.ownerId, ownerId) : undefined);

  const activeDealStats = await db.select({
    count: sql<number>`count(*)`,
    totalAmount: sql<number>`COALESCE(SUM(amount), 0)`
  }).from(deals)
    .where(ownerFilter
      ? and(eq(deals.ownerId, ownerId), inArray(deals.phase, ["lead", "proposal", "negotiation", "closing"]))
      : inArray(deals.phase, ["lead", "proposal", "negotiation", "closing"])
    );

  const wonDealStats = await db.select({
    count: sql<number>`count(*)`,
    totalAmount: sql<number>`COALESCE(SUM(amount), 0)`
  }).from(deals)
    .where(ownerFilter
      ? and(eq(deals.ownerId, ownerId), eq(deals.phase, "won"))
      : eq(deals.phase, "won")
    );

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const activityCount = await db.select({ count: sql<number>`count(*)` }).from(activities)
    .where(ownerFilter
      ? and(eq(activities.ownerId, ownerId), gte(activities.activityDate, monthStart))
      : gte(activities.activityDate, monthStart)
    );

  return {
    totalCustomers: Number(customerCount[0]?.count ?? 0),
    activeDeals: Number(activeDealStats[0]?.count ?? 0),
    totalDealAmount: Number(activeDealStats[0]?.totalAmount ?? 0),
    activitiesThisMonth: Number(activityCount[0]?.count ?? 0),
    wonDeals: Number(wonDealStats[0]?.count ?? 0),
    wonAmount: Number(wonDealStats[0]?.totalAmount ?? 0),
  };
}

export async function getDealsByPhase(ownerId: number | null) {
  const db = await getDb();
  if (!db) return [];
  const conditions = ownerId !== null ? eq(deals.ownerId, ownerId) : undefined;
  return db.select({
    phase: deals.phase,
    count: sql<number>`count(*)`,
    totalAmount: sql<number>`COALESCE(SUM(amount), 0)`
  }).from(deals).where(conditions).groupBy(deals.phase);
}

export async function getUpcomingActions(ownerId: number | null, limit = 10) {
  const db = await getDb();
  if (!db) return [];
  const now = Date.now();
  const conditions = [gte(activities.nextActionDate, now), eq(activities.progressStatus, "planned")];
  if (ownerId !== null) conditions.push(eq(activities.ownerId, ownerId));
  return db.select().from(activities).where(and(...conditions)).orderBy(asc(activities.nextActionDate)).limit(limit);
}

// ============ AI Reports ============
export async function getAiReports(ownerId: number | null, reportType?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (ownerId !== null) conditions.push(eq(aiReports.ownerId, ownerId));
  if (reportType) conditions.push(eq(aiReports.reportType, reportType as any));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  return db.select().from(aiReports).where(where).orderBy(desc(aiReports.createdAt)).limit(20);
}

export async function createAiReport(data: InsertAiReport) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(aiReports).values(data);
  return { id: result[0].insertId };
}

export async function deleteAiReport(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(aiReports).where(eq(aiReports.id, id));
}

// ============ Map data ============
export async function getCustomersWithCoords(ownerId: number | null) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [sql`latitude IS NOT NULL`, sql`longitude IS NOT NULL`];
  if (ownerId !== null) conditions.push(eq(customers.ownerId, ownerId));
  return db.select().from(customers).where(and(...conditions));
}

// ============ Dashboard Settings ============
export async function getDashboardSettings(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(dashboardSettings).where(eq(dashboardSettings.userId, userId)).limit(1);
  return result[0];
}

export async function upsertDashboardSettings(userId: number, data: { widgetOrder?: string; hiddenWidgets?: string }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const existing = await getDashboardSettings(userId);
  if (existing) {
    await db.update(dashboardSettings).set(data).where(eq(dashboardSettings.userId, userId));
  } else {
    await db.insert(dashboardSettings).values({ userId, ...data });
  }
  return { success: true };
}

// ============ Notification Settings ============
export async function getNotificationSettings(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(notificationSettings).where(eq(notificationSettings.userId, userId)).limit(1);
  return result[0];
}

export async function upsertNotificationSettings(userId: number, data: {
  emailEnabled?: number;
  dealReminderDays?: number;
  actionReminderDays?: number;
  weeklyReportEnabled?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const existing = await getNotificationSettings(userId);
  if (existing) {
    await db.update(notificationSettings).set(data).where(eq(notificationSettings.userId, userId));
  } else {
    await db.insert(notificationSettings).values({ userId, ...data });
  }
  return { success: true };
}

// ============ CSV Export helpers ============
export async function getAllCustomersForExport(ownerId: number | null) {
  const db = await getDb();
  if (!db) return [];
  const conditions = ownerId !== null ? eq(customers.ownerId, ownerId) : undefined;
  return db.select().from(customers).where(conditions).orderBy(desc(customers.updatedAt));
}

export async function getAllActivitiesForExport(ownerId: number | null) {
  const db = await getDb();
  if (!db) return [];
  const conditions = ownerId !== null ? eq(activities.ownerId, ownerId) : undefined;
  return db.select().from(activities).where(conditions).orderBy(desc(activities.activityDate));
}

export async function getAllDealsForExport(ownerId: number | null) {
  const db = await getDb();
  if (!db) return [];
  const conditions = ownerId !== null ? eq(deals.ownerId, ownerId) : undefined;
  return db.select().from(deals).where(conditions).orderBy(desc(deals.updatedAt));
}

// ============ Notification check helpers ============
export async function getUpcomingDealDeadlines(daysAhead: number) {
  const db = await getDb();
  if (!db) return [];
  const now = Date.now();
  const deadline = now + daysAhead * 24 * 60 * 60 * 1000;
  return db.select().from(deals)
    .where(and(
      gte(deals.expectedCloseDate, now),
      lte(deals.expectedCloseDate, deadline),
      inArray(deals.phase, ["lead", "proposal", "negotiation", "closing"])
    ))
    .orderBy(asc(deals.expectedCloseDate));
}

export async function getUpcomingActionDeadlines(daysAhead: number) {
  const db = await getDb();
  if (!db) return [];
  const now = Date.now();
  const deadline = now + daysAhead * 24 * 60 * 60 * 1000;
  return db.select().from(activities)
    .where(and(
      gte(activities.nextActionDate, now),
      lte(activities.nextActionDate, deadline),
      eq(activities.progressStatus, "planned")
    ))
    .orderBy(asc(activities.nextActionDate));
}

export async function getAllNotificationSettings() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notificationSettings);
}


// ============ Tags ============
export async function getTags(ownerId: number | null) {
  const db = await getDb();
  if (!db) return [];
  // 共有タグ + 自分のタグ
  if (ownerId !== null) {
    return db.select().from(tags)
      .where(or(eq(tags.ownerId, ownerId), eq(tags.isShared, 1)))
      .orderBy(asc(tags.category), asc(tags.name));
  }
  return db.select().from(tags).orderBy(asc(tags.category), asc(tags.name));
}

export async function getTagById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(tags).where(eq(tags.id, id)).limit(1);
  return result[0];
}

export async function createTag(data: InsertTag) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(tags).values(data);
  return { id: result[0].insertId };
}

export async function updateTag(id: number, data: Partial<InsertTag>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(tags).set(data).where(eq(tags.id, id));
}

export async function deleteTag(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(customerTags).where(eq(customerTags.tagId, id));
  await db.delete(tags).where(eq(tags.id, id));
}

// ============ Customer Tags ============
export async function getCustomerTags(customerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: customerTags.id,
    customerId: customerTags.customerId,
    tagId: customerTags.tagId,
    tagName: tags.name,
    tagColor: tags.color,
    tagCategory: tags.category,
  }).from(customerTags)
    .innerJoin(tags, eq(customerTags.tagId, tags.id))
    .where(eq(customerTags.customerId, customerId));
}

export async function getCustomersByTagId(tagId: number, ownerId: number | null) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(customerTags.tagId, tagId)];
  if (ownerId !== null) conditions.push(eq(customers.ownerId, ownerId));
  return db.select({
    id: customers.id,
    companyName: customers.companyName,
    contactName: customers.contactName,
    status: customers.status,
    industry: customers.industry,
  }).from(customerTags)
    .innerJoin(customers, eq(customerTags.customerId, customers.id))
    .where(and(...conditions));
}

export async function addTagToCustomer(customerId: number, tagId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // 重複チェック
  const existing = await db.select().from(customerTags)
    .where(and(eq(customerTags.customerId, customerId), eq(customerTags.tagId, tagId)))
    .limit(1);
  if (existing.length > 0) return { id: existing[0].id };
  const result = await db.insert(customerTags).values({ customerId, tagId });
  return { id: result[0].insertId };
}

export async function removeTagFromCustomer(customerId: number, tagId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(customerTags)
    .where(and(eq(customerTags.customerId, customerId), eq(customerTags.tagId, tagId)));
}

// ============ API Keys (n8n) ============
export async function getApiKeys(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: apiKeys.id,
    name: apiKeys.name,
    keyPrefix: apiKeys.keyPrefix,
    isActive: apiKeys.isActive,
    lastUsedAt: apiKeys.lastUsedAt,
    createdAt: apiKeys.createdAt,
  }).from(apiKeys)
    .where(eq(apiKeys.ownerId, ownerId))
    .orderBy(desc(apiKeys.createdAt));
}

export async function createApiKey(data: InsertApiKey) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(apiKeys).values(data);
  return { id: result[0].insertId };
}

export async function getApiKeyByHash(keyHash: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(apiKeys)
    .where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.isActive, 1)))
    .limit(1);
  return result[0];
}

export async function updateApiKeyLastUsed(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(apiKeys).set({ lastUsedAt: Date.now() }).where(eq(apiKeys.id, id));
}

export async function deleteApiKey(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(apiKeys).where(eq(apiKeys.id, id));
}

export async function deactivateApiKey(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(apiKeys).set({ isActive: 0 }).where(eq(apiKeys.id, id));
}

// ============ Global Search ============
export async function globalSearch(ownerId: number | null, query: string) {
  const db = await getDb();
  if (!db) return { customers: [], activities: [], deals: [], documents: [] };

  const searchTerm = `%${query}%`;
  const ownerConditions = (table: any) => ownerId !== null ? eq(table.ownerId, ownerId) : undefined;

  // 顧客検索（ID検索も含む）
  const parsedId = parseInt(query);
  const customerConditions = [
    ownerConditions(customers),
    or(
      like(customers.companyName, searchTerm),
      like(customers.contactName, searchTerm),
      like(customers.contactEmail, searchTerm),
      like(customers.contactPhone, searchTerm),
      like(customers.address, searchTerm),
      like(customers.industry, searchTerm),
      ...(parsedId ? [eq(customers.id, parsedId)] : [])
    )
  ].filter(Boolean);
  const customerResults = await db.select().from(customers)
    .where(and(...customerConditions as any)).orderBy(desc(customers.updatedAt)).limit(10);

  // 営業活動検索
  const activityConditions = [
    ownerConditions(activities),
    or(
      like(activities.subject, searchTerm),
      like(activities.description, searchTerm),
      like(activities.nextAction, searchTerm),
      ...(parsedId ? [eq(activities.id, parsedId)] : [])
    )
  ].filter(Boolean);
  const activityResults = await db.select().from(activities)
    .where(and(...activityConditions as any)).orderBy(desc(activities.activityDate)).limit(10);

  // 案件検索
  const dealConditions = [
    ownerConditions(deals),
    or(
      like(deals.dealName, searchTerm),
      like(deals.description, searchTerm),
      ...(parsedId ? [eq(deals.id, parsedId)] : [])
    )
  ].filter(Boolean);
  const dealResults = await db.select().from(deals)
    .where(and(...dealConditions as any)).orderBy(desc(deals.updatedAt)).limit(10);

  // スキャンドキュメント検索
  const docConditions = [
    ownerConditions(scannedDocuments),
    or(
      like(scannedDocuments.title, searchTerm),
      like(scannedDocuments.extractedText, searchTerm),
      ...(parsedId ? [eq(scannedDocuments.id, parsedId)] : [])
    )
  ].filter(Boolean);
  const docResults = await db.select().from(scannedDocuments)
    .where(and(...docConditions as any)).orderBy(desc(scannedDocuments.createdAt)).limit(10);

  return {
    customers: customerResults,
    activities: activityResults,
    deals: dealResults,
    documents: docResults,
  };
}

// ============ Slack Messages ============

export async function getSlackMessages(options: {
  channelId?: string;
  search?: string;
  userName?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return { messages: [], total: 0 };
  
  const conditions = [];
  if (options.channelId) conditions.push(eq(slackMessages.channelId, options.channelId));
  if (options.userName) conditions.push(eq(slackMessages.userName, options.userName));
  if (options.search) {
    conditions.push(
      or(
        like(slackMessages.messageText, `%${options.search}%`),
        like(slackMessages.userName, `%${options.search}%`),
        like(slackMessages.files, `%${options.search}%`)
      )!
    );
  }
  
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const limit = options.limit || 50;
  const offset = options.offset || 0;
  
  const [msgs, countResult] = await Promise.all([
    db.select().from(slackMessages).where(where).orderBy(desc(slackMessages.postedAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`COUNT(*)` }).from(slackMessages).where(where),
  ]);
  
  return {
    messages: msgs,
    total: countResult[0]?.count || 0,
  };
}

export async function getSlackMessagePosters(channelId: string) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.selectDistinct({ userName: slackMessages.userName })
    .from(slackMessages)
    .where(and(eq(slackMessages.channelId, channelId), sql`${slackMessages.userName} IS NOT NULL`))
    .orderBy(slackMessages.userName);
  return result.map(r => r.userName).filter(Boolean) as string[];
}

// ============ Customer Files (顧客カルテ) ============
export async function getCustomerFiles(options: {
  search?: string;
  phase?: string;
  assignee?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return { files: [], total: 0 };
  
  const conditions = [];
  if (options.search) {
    conditions.push(
      or(
        like(customerFiles.customerName, `%${options.search}%`),
        like(customerFiles.fileNumber, `%${options.search}%`),
        like(customerFiles.assignee, `%${options.search}%`),
        like(customerFiles.companion, `%${options.search}%`),
        like(customerFiles.broker, `%${options.search}%`),
        like(customerFiles.notes, `%${options.search}%`)
      )!
    );
  }
  if (options.phase) conditions.push(eq(customerFiles.phase, options.phase as any));
  if (options.assignee) conditions.push(like(customerFiles.assignee, `%${options.assignee}%`));
  
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const limit = options.limit || 50;
  const offset = options.offset || 0;
  
  const [files, countResult] = await Promise.all([
    db.select().from(customerFiles).where(where).orderBy(desc(customerFiles.id)).limit(limit).offset(offset),
    db.select({ count: sql<number>`COUNT(*)` }).from(customerFiles).where(where),
  ]);
  
  return {
    files,
    total: countResult[0]?.count || 0,
  };
}

export async function getCustomerFileById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(customerFiles).where(eq(customerFiles.id, id)).limit(1);
  return result[0];
}

export async function createCustomerFile(data: InsertCustomerFile) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(customerFiles).values(data);
  return { id: result[0].insertId };
}

export async function updateCustomerFile(id: number, data: Partial<InsertCustomerFile>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(customerFiles).set(data).where(eq(customerFiles.id, id));
}

export async function deleteCustomerFile(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(customerFiles).where(eq(customerFiles.id, id));
}

export async function getCustomerFileAssignees() {
  const db = await getDb();
  if (!db) return [];
  const result = await db.selectDistinct({ assignee: customerFiles.assignee })
    .from(customerFiles)
    .where(sql`${customerFiles.assignee} IS NOT NULL AND ${customerFiles.assignee} != ''`);
  return result.map(r => r.assignee).filter(Boolean) as string[];
}

export async function getCustomerFileStats() {
  const db = await getDb();
  if (!db) return { total: 0, byPhase: [], byAssignee: [] };
  
  const [totalResult, phaseResult, assigneeResult] = await Promise.all([
    db.select({ count: sql<number>`COUNT(*)` }).from(customerFiles),
    db.select({
      phase: customerFiles.phase,
      count: sql<number>`COUNT(*)`
    }).from(customerFiles).groupBy(customerFiles.phase),
    db.select({
      assignee: customerFiles.assignee,
      count: sql<number>`COUNT(*)`
    }).from(customerFiles)
      .where(sql`${customerFiles.assignee} IS NOT NULL AND ${customerFiles.assignee} != ''`)
      .groupBy(customerFiles.assignee)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(20),
  ]);
  
  return {
    total: totalResult[0]?.count || 0,
    byPhase: phaseResult,
    byAssignee: assigneeResult,
  };
}

export async function getSlackChannels() {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select({
    channelId: slackMessages.channelId,
    channelName: slackMessages.channelName,
    count: sql<number>`COUNT(*)`,
    latestMessage: sql<number>`MAX(${slackMessages.postedAt})`,
  }).from(slackMessages).groupBy(slackMessages.channelId, slackMessages.channelName);
  return result;
}


// Slackメッセージ総数を取得
export async function getSlackMessageCount() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`COUNT(*)` }).from(slackMessages);
  return result[0]?.count || 0;
}

// 書類チェック統計（ダッシュボード用）
// 既存の書類取得状況フィールド
const DOC_FIELD_KEYS = ['contractDeposit', 'commission', 'consent', 'realEstateFile', 'businessCardCollection', 'nameplate', 'rentalManagement'] as const;

// お客様預かり書類チェックシートフィールド
const DOC_CHECKLIST_KEYS = ['docLicense', 'docInsurance', 'docGensen1', 'docGensen2', 'docGensen3', 'docCic', 'docPublicDoc', 'docPreReview', 'docCompliance', 'docHearing', 'docExistingLoan'] as const;

// 全書類フィールド（既存 + 預かり書類）
const ALL_DOC_KEYS = [...DOC_FIELD_KEYS, ...DOC_CHECKLIST_KEYS] as const;

export async function getDocCheckStats() {
  const db = await getDb();
  if (!db) return { total: 0, completed: 0, inProgress: 0, notStarted: 0, byAssignee: [], checklistStats: { total: 0, completed: 0, inProgress: 0, notStarted: 0 } };

  const allFiles = await db.select().from(customerFiles);
  
  let completed = 0;
  let inProgress = 0;
  let notStarted = 0;
  // 預かり書類チェックシートの統計
  let clCompleted = 0;
  let clInProgress = 0;
  let clNotStarted = 0;
  const assigneeStats: Record<string, { total: number; checkedFields: number; totalFields: number; clChecked: number; clTotal: number }> = {};

  for (const f of allFiles) {
    // 既存書類取得状況
    const checkedCount = DOC_FIELD_KEYS.filter(k => {
      const val = (f as any)[k];
      return val && val.trim() !== '';
    }).length;
    const totalFields = DOC_FIELD_KEYS.length;

    if (checkedCount === totalFields) completed++;
    else if (checkedCount > 0) inProgress++;
    else notStarted++;

    // 預かり書類チェックシート
    const clCheckedCount = DOC_CHECKLIST_KEYS.filter(k => {
      const val = (f as any)[k];
      return val && val.trim() !== '' && val.trim() !== '0';
    }).length;
    const clTotalFields = DOC_CHECKLIST_KEYS.length;

    if (clCheckedCount === clTotalFields) clCompleted++;
    else if (clCheckedCount > 0) clInProgress++;
    else clNotStarted++;

    const assignee = f.assignee || '未割当';
    if (!assigneeStats[assignee]) assigneeStats[assignee] = { total: 0, checkedFields: 0, totalFields: 0, clChecked: 0, clTotal: 0 };
    assigneeStats[assignee].total++;
    assigneeStats[assignee].checkedFields += checkedCount;
    assigneeStats[assignee].totalFields += totalFields;
    assigneeStats[assignee].clChecked += clCheckedCount;
    assigneeStats[assignee].clTotal += clTotalFields;
  }

  const byAssignee = Object.entries(assigneeStats)
    .map(([name, s]) => ({
      assignee: name,
      total: s.total,
      checkedFields: s.checkedFields,
      totalFields: s.totalFields,
      rate: s.totalFields > 0 ? Math.round((s.checkedFields / s.totalFields) * 100) : 0,
      clChecked: s.clChecked,
      clTotal: s.clTotal,
      clRate: s.clTotal > 0 ? Math.round((s.clChecked / s.clTotal) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  return {
    total: allFiles.length,
    completed,
    inProgress,
    notStarted,
    byAssignee,
    checklistStats: {
      total: allFiles.length,
      completed: clCompleted,
      inProgress: clInProgress,
      notStarted: clNotStarted,
    },
  };
}

// ダッシュボード用: 各カルテの預かり書類チェックシート進捗一覧
export async function getChecklistProgress() {
  const db = await getDb();
  if (!db) return [];

  const allFiles = await db.select({
    id: customerFiles.id,
    fileNumber: customerFiles.fileNumber,
    customerName: customerFiles.customerName,
    assignee: customerFiles.assignee,
    phase: customerFiles.phase,
    updatedAt: customerFiles.updatedAt,
    docLicense: customerFiles.docLicense,
    docInsurance: customerFiles.docInsurance,
    docGensen1: customerFiles.docGensen1,
    docGensen2: customerFiles.docGensen2,
    docGensen3: customerFiles.docGensen3,
    docCic: customerFiles.docCic,
    docPublicDoc: customerFiles.docPublicDoc,
    docPreReview: customerFiles.docPreReview,
    docCompliance: customerFiles.docCompliance,
    docHearing: customerFiles.docHearing,
    docExistingLoan: customerFiles.docExistingLoan,
  }).from(customerFiles).orderBy(desc(customerFiles.updatedAt));

  return allFiles.map(f => {
    const checked = DOC_CHECKLIST_KEYS.filter(k => {
      const val = (f as any)[k];
      return val && val.trim() !== '' && val.trim() !== '0';
    }).length;
    return {
      id: f.id,
      fileNumber: f.fileNumber,
      customerName: f.customerName,
      assignee: f.assignee,
      phase: f.phase,
      updatedAt: f.updatedAt,
      checkedCount: checked,
      totalCount: DOC_CHECKLIST_KEYS.length,
      percentage: Math.round((checked / DOC_CHECKLIST_KEYS.length) * 100),
      details: DOC_CHECKLIST_KEYS.map(k => ({
        key: k,
        checked: !!((f as any)[k] && (f as any)[k].trim() !== '' && (f as any)[k].trim() !== '0'),
        date: (f as any)[k] || null,
      })),
    };
  });
}

// 最近更新された顧客カルテ（ダッシュボード用）
export async function getRecentCustomerFiles(limit = 5) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(customerFiles).orderBy(desc(customerFiles.updatedAt)).limit(limit);
}

// ダッシュボード用: 各チャンネルの最新メッセージ（プレビュー用）
export async function getRecentSlackMessagesByChannel(limitPerChannel = 3) {
  const db = await getDb();
  if (!db) return [];
  // 全チャンネルから最新メッセージを取得
  const allRecent = await db
    .select()
    .from(slackMessages)
    .orderBy(desc(slackMessages.postedAt))
    .limit(limitPerChannel * 10); // 十分な件数を取得
  // チャンネルごとにグループ化して各チャンネルからlimitPerChannel件ずつ
  const byChannel = new Map<string, typeof allRecent>();
  for (const msg of allRecent) {
    const existing = byChannel.get(msg.channelId) || [];
    if (existing.length < limitPerChannel) {
      existing.push(msg);
      byChannel.set(msg.channelId, existing);
    }
  }
  return Array.from(byChannel.entries()).map(([channelId, messages]) => ({
    channelId,
    channelName: messages[0]?.channelName ?? "",
    messages: messages.map(m => ({
      id: m.id,
      userName: m.userName ?? "不明",
      messageText: (m.messageText ?? "").substring(0, 200),
      postedAt: m.postedAt,
      files: m.files,
    })),
  }));
}


// ============ Slack Message Upsert (for auto-sync) ============
export async function upsertSlackMessage(msg: {
  channelId: string;
  channelName: string;
  messageTs: string;
  userId?: string;
  userName?: string;
  messageText?: string;
  threadTs?: string;
  threadReplyCount?: number;
  reactions?: string;
  files?: string;
  postedAt: number;
}) {
  const db = await getDb();
  if (!db) return null;
  
  // Check if message already exists by channelId + messageTs
  const existing = await db.select({ id: slackMessages.id })
    .from(slackMessages)
    .where(and(
      eq(slackMessages.channelId, msg.channelId),
      eq(slackMessages.messageTs, msg.messageTs)
    ))
    .limit(1);
  
  if (existing.length > 0) {
    // Update existing message
    await db.update(slackMessages)
      .set({
        messageText: msg.messageText,
        userName: msg.userName,
        threadReplyCount: msg.threadReplyCount,
        reactions: msg.reactions,
        files: msg.files,
      })
      .where(eq(slackMessages.id, existing[0].id));
    return existing[0].id;
  } else {
    // Insert new message
    const result = await db.insert(slackMessages).values(msg);
    return result[0].insertId;
  }
}

// Get latest message timestamp per channel (for incremental sync)
export async function getLatestMessageTs(channelId: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select({ maxTs: sql<string>`MAX(${slackMessages.messageTs})` })
    .from(slackMessages)
    .where(eq(slackMessages.channelId, channelId));
  
  return result[0]?.maxTs || null;
}


// ============ Map with Document Progress ============
export async function getCustomersForMap(ownerId: number | null) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (ownerId !== null) conditions.push(eq(customers.ownerId, ownerId));
  
  const custs = await db.select().from(customers).where(conditions.length > 0 ? and(...conditions) : undefined);
  
  // Get all customer files to compute doc progress
  const files = await db.select().from(customerFiles);
  
  // Build a map of customerId -> doc progress
  const docProgressMap = new Map<number, { total: number; done: number }>();
  
  // Also build a map by customerName for fallback matching
  const docProgressByName = new Map<string, { total: number; done: number }>();
  
  const docFields = [
    'docLicense', 'docInsurance', 'docGensen1', 'docGensen2', 'docGensen3',
    'docCic', 'docPublicDoc', 'docPreReview', 'docCompliance', 'docHearing', 'docExistingLoan'
  ] as const;
  
  for (const file of files) {
    const total = docFields.length; // 11 items
    let done = 0;
    for (const field of docFields) {
      if (file[field] && String(file[field]).trim() !== '') done++;
    }
    
    if (file.customerId) {
      docProgressMap.set(file.customerId, { total, done });
    }
    // Also store by name for fallback
    docProgressByName.set(file.customerName, { total, done });
  }
  
  return custs.map(c => {
    const progress = docProgressMap.get(c.id) || docProgressByName.get(c.companyName) || { total: 11, done: 0 };
    return {
      ...c,
      docProgress: progress,
    };
  });
}


// ============ 案件相談シート ステータス管理 ============

// 案件相談シートのステータスを更新
export async function updateConsultationStatus(messageId: number, status: "pending" | "done") {
  const db = await getDb();
  if (!db) return null;
  await db.update(slackMessages)
    .set({ consultationStatus: status })
    .where(eq(slackMessages.id, messageId));
  return { id: messageId, status };
}

// 案件相談シートのサマリー（ダッシュボード用）
export async function getConsultationSummary() {
  const db = await getDb();
  if (!db) return { total: 0, pending: 0, done: 0, recentMessages: [] };
  
  const channelId = "C08GAE2QWLA";
  
  const [totalResult, pendingResult, doneResult, recentMsgs] = await Promise.all([
    db.select({ count: sql<number>`COUNT(*)` }).from(slackMessages)
      .where(eq(slackMessages.channelId, channelId)),
    db.select({ count: sql<number>`COUNT(*)` }).from(slackMessages)
      .where(and(
        eq(slackMessages.channelId, channelId),
        or(
          eq(slackMessages.consultationStatus, "pending"),
          sql`${slackMessages.consultationStatus} IS NULL`
        )
      )),
    db.select({ count: sql<number>`COUNT(*)` }).from(slackMessages)
      .where(and(
        eq(slackMessages.channelId, channelId),
        eq(slackMessages.consultationStatus, "done")
      )),
    db.select().from(slackMessages)
      .where(eq(slackMessages.channelId, channelId))
      .orderBy(desc(slackMessages.postedAt))
      .limit(5),
  ]);
  
  return {
    total: totalResult[0]?.count || 0,
    pending: pendingResult[0]?.count || 0,
    done: doneResult[0]?.count || 0,
    recentMessages: recentMsgs,
  };
}

// 案件相談シートの住所データ取得（マップ用）
export async function getConsultationAddresses() {
  const db = await getDb();
  if (!db) return [];
  
  const channelId = "C08GAE2QWLA";
  const msgs = await db.select().from(slackMessages)
    .where(eq(slackMessages.channelId, channelId))
    .orderBy(desc(slackMessages.postedAt));
  
  return msgs;
}

// 投稿者一覧（件数付き）
export async function getSlackMessagePostersWithCount(channelId: string) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select({
    userName: slackMessages.userName,
    count: sql<number>`COUNT(*)`,
  })
    .from(slackMessages)
    .where(and(eq(slackMessages.channelId, channelId), sql`${slackMessages.userName} IS NOT NULL`))
    .groupBy(slackMessages.userName)
    .orderBy(slackMessages.userName);
  return result.filter(r => r.userName);
}


// ========== 議事録No.管理 ==========

// No.管理リスト全件取得
export async function getAllMinutesNumbers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(minutesNumbers).orderBy(minutesNumbers.number);
}

// 名前でNo.を検索（あいまいマッチ: スペース・全角半角を正規化して比較）
export async function findMinutesNumberByName(name: string) {
  const db = await getDb();
  if (!db) return null;
  // 全件取得してJS側で柔軟にマッチング
  const all = await db.select().from(minutesNumbers).orderBy(minutesNumbers.number);
  const normalize = (s: string) => s.replace(/[\s　]+/g, '').replace(/様$/g, '');
  const normalizedName = normalize(name);
  // 完全一致（正規化後）
  const exact = all.find(r => normalize(r.customerName) === normalizedName);
  if (exact) return exact;
  // 姓のみマッチ（2文字以上の姓）
  const surname = normalizedName.length >= 2 ? normalizedName.slice(0, 2) : normalizedName;
  const partial = all.filter(r => normalize(r.customerName).startsWith(surname));
  if (partial.length === 1) return partial[0];
  return null;
}

// 次のNo.を取得
export async function getNextMinutesNumber() {
  const db = await getDb();
  if (!db) return 354;
  const result = await db.select({ maxNum: sql<number>`MAX(\`number\`)` }).from(minutesNumbers);
  return (result[0]?.maxNum || 353) + 1;
}

// 新しいNo.を登録
export async function createMinutesNumber(data: { number: number; customerName: string; note?: string; slackMessageTs?: string; customerFileId?: number }) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(minutesNumbers).values({
    number: data.number,
    customerName: data.customerName,
    note: data.note || null,
    slackMessageTs: data.slackMessageTs || null,
    customerFileId: data.customerFileId || null,
  });
  return { number: data.number, customerName: data.customerName };
}



// ==================== 資金計画書 CRUD ====================

export async function createFundingPlan(data: InsertFundingPlan) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(fundingPlans).values(data);
  return { id: result[0].insertId };
}

export async function getFundingPlans(opts?: { status?: string; limit?: number; offset?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (opts?.status) {
    conditions.push(eq(fundingPlans.status, opts.status as any));
  }
  const query = db.select().from(fundingPlans);
  if (conditions.length > 0) {
    return query.where(and(...conditions)).orderBy(desc(fundingPlans.createdAt)).limit(opts?.limit || 50).offset(opts?.offset || 0);
  }
  return query.orderBy(desc(fundingPlans.createdAt)).limit(opts?.limit || 50).offset(opts?.offset || 0);
}

export async function getFundingPlanById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(fundingPlans).where(eq(fundingPlans.id, id)).limit(1);
  return rows[0] || null;
}

export async function updateFundingPlanStatus(id: number, data: {
  status: "pending" | "reviewing" | "approved" | "rejected";
  reviewedBy?: number;
  reviewedByName?: string;
  reviewComment?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(fundingPlans).set({
    status: data.status,
    reviewedBy: data.reviewedBy || null,
    reviewedByName: data.reviewedByName || null,
    reviewComment: data.reviewComment || null,
    reviewedAt: new Date(),
  }).where(eq(fundingPlans.id, id));
}

export async function getFundingPlanSummary() {
  const db = await getDb();
  if (!db) return { total: 0, pending: 0, reviewing: 0, approved: 0, rejected: 0 };
  const rows = await db.select({
    status: fundingPlans.status,
    count: sql<number>`count(*)`,
  }).from(fundingPlans).groupBy(fundingPlans.status);
  const summary = { total: 0, pending: 0, reviewing: 0, approved: 0, rejected: 0 };
  for (const row of rows) {
    const c = Number(row.count);
    summary.total += c;
    if (row.status === "pending") summary.pending = c;
    if (row.status === "reviewing") summary.reviewing = c;
    if (row.status === "approved") summary.approved = c;
    if (row.status === "rejected") summary.rejected = c;
  }
  return summary;
}

// ==================== 買付証明書 CRUD ====================

export async function createPurchaseOffer(data: InsertPurchaseOffer) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(purchaseOffers).values(data);
  return { id: result[0].insertId };
}

export async function getPurchaseOffers(opts?: { status?: string; limit?: number; offset?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (opts?.status) {
    conditions.push(eq(purchaseOffers.status, opts.status as any));
  }
  const query = db.select().from(purchaseOffers);
  if (conditions.length > 0) {
    return query.where(and(...conditions)).orderBy(desc(purchaseOffers.createdAt)).limit(opts?.limit || 50).offset(opts?.offset || 0);
  }
  return query.orderBy(desc(purchaseOffers.createdAt)).limit(opts?.limit || 50).offset(opts?.offset || 0);
}

export async function getPurchaseOfferById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(purchaseOffers).where(eq(purchaseOffers.id, id)).limit(1);
  return rows[0] || null;
}

export async function updatePurchaseOfferStatus(id: number, data: {
  status: "pending" | "reviewing" | "approved" | "rejected";
  reviewedBy?: number;
  reviewedByName?: string;
  reviewComment?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(purchaseOffers).set({
    status: data.status,
    reviewedBy: data.reviewedBy || null,
    reviewedByName: data.reviewedByName || null,
    reviewComment: data.reviewComment || null,
    reviewedAt: new Date(),
  }).where(eq(purchaseOffers.id, id));
}

export async function getPurchaseOfferSummary() {
  const db = await getDb();
  if (!db) return { total: 0, pending: 0, reviewing: 0, approved: 0, rejected: 0 };
  const rows = await db.select({
    status: purchaseOffers.status,
    count: sql<number>`count(*)`,
  }).from(purchaseOffers).groupBy(purchaseOffers.status);
  const summary = { total: 0, pending: 0, reviewing: 0, approved: 0, rejected: 0 };
  for (const row of rows) {
    const c = Number(row.count);
    summary.total += c;
    if (row.status === "pending") summary.pending = c;
    if (row.status === "reviewing") summary.reviewing = c;
    if (row.status === "approved") summary.approved = c;
    if (row.status === "rejected") summary.rejected = c;
  }
  return summary;
}

// ==================== フォームデータ更新 ====================

export async function updateFundingPlanFormData(id: number, data: {
  customerName?: string;
  propertyName?: string;
  formData?: any;
  note?: string;
  customerFileId?: number | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(fundingPlans).set(data).where(eq(fundingPlans.id, id));
}

export async function updatePurchaseOfferFormData(id: number, data: {
  customerName?: string;
  propertyName?: string;
  propertyAddress?: string;
  purchasePrice?: string;
  deposit?: string;
  formData?: any;
  note?: string;
  customerFileId?: number | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(purchaseOffers).set(data).where(eq(purchaseOffers.id, id));
}

// ==================== 顧客カルテ名前検索 ====================

export async function searchCustomerFilesByName(search: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: customerFiles.id,
    fileNumber: customerFiles.fileNumber,
    customerName: customerFiles.customerName,
    assignee: customerFiles.assignee,
    propertyAddress: customerFiles.propertyAddress,
    propertyPrice: customerFiles.propertyPrice,
    phase: customerFiles.phase,
  }).from(customerFiles)
    .where(like(customerFiles.customerName, `%${search}%`))
    .orderBy(desc(customerFiles.id))
    .limit(10);
}

// ==================== フォームテンプレート ====================

export async function getFormTemplates(ownerId: number, type: "purchaseOffer" | "fundingPlan") {
  const db = await getDb();
  if (!db) return [];
  // 自分のテンプレート + チーム共有テンプレートを取得
  return db.select().from(formTemplates)
    .where(and(
      eq(formTemplates.type, type),
      or(
        eq(formTemplates.ownerId, ownerId),
        eq(formTemplates.isShared, 1)
      )
    ))
    .orderBy(desc(formTemplates.isShared), desc(formTemplates.updatedAt));
}

export async function createFormTemplate(data: {
  ownerId: number;
  ownerName?: string;
  name: string;
  type: "purchaseOffer" | "fundingPlan";
  formData: any;
  isShared?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(formTemplates).values({
    ...data,
    isShared: data.isShared ?? 0,
  });
  return result.insertId;
}

export async function updateFormTemplate(id: number, ownerId: number, data: {
  name?: string;
  formData?: any;
  isShared?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(formTemplates).set(data).where(and(eq(formTemplates.id, id), eq(formTemplates.ownerId, ownerId)));
}

export async function deleteFormTemplate(id: number, ownerId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(formTemplates).where(and(eq(formTemplates.id, id), eq(formTemplates.ownerId, ownerId)));
}

// ============ Slack通知キュー ============
export async function addSlackNotification(data: InsertSlackNotificationQueue) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(slackNotificationQueue).values(data);
  return result;
}

export async function getPendingSlackNotifications() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(slackNotificationQueue)
    .where(eq(slackNotificationQueue.status, "pending"))
    .orderBy(slackNotificationQueue.createdAt);
}

export async function markSlackNotificationSent(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(slackNotificationQueue)
    .set({ status: "sent", sentAt: new Date() })
    .where(eq(slackNotificationQueue.id, id));
}

export async function markSlackNotificationFailed(id: number, errorMessage: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(slackNotificationQueue)
    .set({ status: "failed", errorMessage })
    .where(eq(slackNotificationQueue.id, id));
}

export async function getSlackNotificationHistory(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(slackNotificationQueue)
    .orderBy(desc(slackNotificationQueue.createdAt))
    .limit(limit);
}
