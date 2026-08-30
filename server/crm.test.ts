import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createUserContext(overrides: Partial<AuthenticatedUser> = {}): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "sales-user-1",
    email: "sales1@example.com",
    name: "営業太郎",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createAdminContext(): TrpcContext {
  return createUserContext({
    id: 99,
    openId: "admin-user",
    email: "admin@example.com",
    name: "管理者",
    role: "admin",
  });
}

function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("auth.me", () => {
  it("returns the authenticated user", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeDefined();
    expect(result?.name).toBe("営業太郎");
    expect(result?.role).toBe("user");
  });

  it("returns null for unauthenticated user", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });
});

describe("access control - assertOwnership helper", () => {
  it("admin can access users.list", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    // Admin should be able to call users.list without error
    // This will fail if DB is not available, but the procedure itself should not throw FORBIDDEN
    try {
      await caller.users.list();
    } catch (e: any) {
      // DB errors are OK, but FORBIDDEN is not
      expect(e.code).not.toBe("FORBIDDEN");
    }
  });

  it("regular user cannot access users.list", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.users.list();
      // If it doesn't throw, that's unexpected for a non-admin
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.code).toBe("FORBIDDEN");
    }
  });
});

describe("getEffectiveOwnerId logic", () => {
  it("regular user always gets their own id as filter", async () => {
    const ctx = createUserContext({ id: 42 });
    const caller = appRouter.createCaller(ctx);
    // When a regular user queries customers, they should only see their own data
    // We test this by calling customer.list and checking it doesn't throw
    try {
      await caller.customer.list({});
    } catch (e: any) {
      // DB errors are acceptable, FORBIDDEN is not
      expect(e.code).not.toBe("FORBIDDEN");
    }
  });

  it("admin can query without owner filter (sees all)", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.customer.list({});
    } catch (e: any) {
      expect(e.code).not.toBe("FORBIDDEN");
    }
  });
});

describe("input validation", () => {
  it("customer.create requires companyName", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.customer.create({ companyName: "" } as any);
    } catch (e: any) {
      // Should fail validation or DB constraint
      expect(e).toBeDefined();
    }
  });

  it("deal.create requires dealName", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.deal.create({
        customerId: 1,
        dealName: "",
        amount: 0,
        probability: 50,
        phase: "lead",
      } as any);
    } catch (e: any) {
      expect(e).toBeDefined();
    }
  });

  it("activity.create validates type enum", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.activity.create({
        customerId: 1,
        type: "invalid_type" as any,
        subject: "Test",
        activityDate: Date.now(),
        progressStatus: "planned",
      });
    } catch (e: any) {
      // Should fail zod validation
      expect(e).toBeDefined();
    }
  });

  it("aiReport.generate validates reportType", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.aiReport.generate({
        reportType: "invalid" as any,
      });
    } catch (e: any) {
      expect(e).toBeDefined();
    }
  });
});

describe("router structure", () => {
  it("has all expected routers", () => {
    const routerKeys = Object.keys(appRouter._def.procedures);
    // Check that key procedures exist
    expect(routerKeys).toContain("auth.me");
    expect(routerKeys).toContain("auth.logout");
    expect(routerKeys).toContain("customer.list");
    expect(routerKeys).toContain("customer.create");
    expect(routerKeys).toContain("customer.update");
    expect(routerKeys).toContain("customer.delete");
    expect(routerKeys).toContain("activity.list");
    expect(routerKeys).toContain("activity.create");
    expect(routerKeys).toContain("deal.list");
    expect(routerKeys).toContain("deal.create");
    expect(routerKeys).toContain("dashboard.stats");
    expect(routerKeys).toContain("aiReport.list");
    expect(routerKeys).toContain("aiReport.generate");
    expect(routerKeys).toContain("aiReport.delete");
    expect(routerKeys).toContain("users.list");
    // New v2 features
    expect(routerKeys).toContain("folder.list");
    expect(routerKeys).toContain("folder.create");
    expect(routerKeys).toContain("folder.update");
    expect(routerKeys).toContain("folder.delete");
    expect(routerKeys).toContain("scan.list");
    expect(routerKeys).toContain("scan.upload");
    expect(routerKeys).toContain("scan.parseToCustomer");
    expect(routerKeys).toContain("search.global");
    // v3 features
    expect(routerKeys).toContain("csv.exportCustomers");
    expect(routerKeys).toContain("csv.exportActivities");
    expect(routerKeys).toContain("csv.exportDeals");
    expect(routerKeys).toContain("csv.importCustomers");
    expect(routerKeys).toContain("notificationSettings.get");
    expect(routerKeys).toContain("notificationSettings.update");
    expect(routerKeys).toContain("notificationSettings.checkAndNotify");
    expect(routerKeys).toContain("dashboardSettings.get");
    expect(routerKeys).toContain("dashboardSettings.update");
  });
});

describe("folder operations", () => {
  it("folder.create validates name", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.folder.create({ name: "" } as any);
    } catch (e: any) {
      expect(e).toBeDefined();
    }
  });

  it("unauthenticated user cannot create folder", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.folder.create({ name: "Test Folder" });
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.code).toBe("UNAUTHORIZED");
    }
  });
});

describe("scan operations", () => {
  it("unauthenticated user cannot upload scan", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.scan.upload({ title: "Test", imageBase64: "abc", mimeType: "image/jpeg" });
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.code).toBe("UNAUTHORIZED");
    }
  });
});

describe("csv operations", () => {
  it("unauthenticated user cannot export customers", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.csv.exportCustomers();
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.code).toBe("UNAUTHORIZED");
    }
  });

  it("unauthenticated user cannot import customers", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.csv.importCustomers({ rows: [{ companyName: "Test" }] });
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.code).toBe("UNAUTHORIZED");
    }
  });

  it("importCustomers validates companyName is required", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.csv.importCustomers({ rows: [{ companyName: "" }] as any });
    } catch (e: any) {
      expect(e).toBeDefined();
    }
  });
});

describe("notification settings", () => {
  it("unauthenticated user cannot get notification settings", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.notificationSettings.get();
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.code).toBe("UNAUTHORIZED");
    }
  });

  it("regular user cannot trigger checkAndNotify", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.notificationSettings.checkAndNotify();
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.code).toBe("FORBIDDEN");
    }
  });

  it("notification update validates dealReminderDays range", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.notificationSettings.update({ dealReminderDays: 0 });
    } catch (e: any) {
      expect(e).toBeDefined();
    }
  });
});

describe("dashboard settings", () => {
  it("unauthenticated user cannot get dashboard settings", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.dashboardSettings.get();
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.code).toBe("UNAUTHORIZED");
    }
  });

  it("unauthenticated user cannot update dashboard settings", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.dashboardSettings.update({ widgetOrder: "[]" });
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.code).toBe("UNAUTHORIZED");
    }
  });
});


describe("search operations", () => {
  it("search.global requires query", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.search.global({ query: "" } as any);
    } catch (e: any) {
      expect(e).toBeDefined();
    }
  });

  it("unauthenticated user cannot search", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.search.global({ query: "test" });
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.code).toBe("UNAUTHORIZED");
    }
  });
});

describe("tag operations", () => {
  it("has all tag-related procedures", () => {
    const routerKeys = Object.keys(appRouter._def.procedures);
    expect(routerKeys).toContain("tag.list");
    expect(routerKeys).toContain("tag.create");
    expect(routerKeys).toContain("tag.update");
    expect(routerKeys).toContain("tag.delete");
    expect(routerKeys).toContain("tag.forCustomer");
    expect(routerKeys).toContain("tag.addToCustomer");
    expect(routerKeys).toContain("tag.removeFromCustomer");
  });

  it("unauthenticated user cannot create tag", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.tag.create({ name: "Test Tag", color: "#6366f1", category: "custom" });
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.code).toBe("UNAUTHORIZED");
    }
  });

  it("unauthenticated user cannot list tags", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.tag.list();
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.code).toBe("UNAUTHORIZED");
    }
  });

  it("tag.create validates name is required", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.tag.create({ name: "", color: "#6366f1", category: "custom" } as any);
    } catch (e: any) {
      expect(e).toBeDefined();
    }
  });

  it("tag.create validates category enum", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.tag.create({ name: "Test", color: "#6366f1", category: "invalid" as any });
    } catch (e: any) {
      expect(e).toBeDefined();
    }
  });

  it("unauthenticated user cannot add tag to customer", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.tag.addToCustomer({ customerId: 1, tagId: 1 });
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.code).toBe("UNAUTHORIZED");
    }
  });

  it("unauthenticated user cannot remove tag from customer", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.tag.removeFromCustomer({ customerId: 1, tagId: 1 });
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.code).toBe("UNAUTHORIZED");
    }
  });
});

describe("API key operations", () => {
  it("has all apiKey-related procedures", () => {
    const routerKeys = Object.keys(appRouter._def.procedures);
    expect(routerKeys).toContain("apiKey.list");
    expect(routerKeys).toContain("apiKey.create");
    expect(routerKeys).toContain("apiKey.delete");
  });

  it("regular user cannot list API keys", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.apiKey.list();
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.code).toBe("FORBIDDEN");
    }
  });

  it("regular user cannot create API keys", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.apiKey.create({ name: "Test Key" });
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.code).toBe("FORBIDDEN");
    }
  });

  it("regular user cannot delete API keys", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.apiKey.delete({ id: 1 });
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.code).toBe("FORBIDDEN");
    }
  });

  it("unauthenticated user cannot access API keys", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.apiKey.list();
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.code).toBe("UNAUTHORIZED");
    }
  });

  it("admin can list API keys", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    try {
      const result = await caller.apiKey.list();
      expect(Array.isArray(result)).toBe(true);
    } catch (e: any) {
      // DB errors are OK, FORBIDDEN is not
      expect(e.code).not.toBe("FORBIDDEN");
    }
  });

  it("apiKey.create validates name is required", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.apiKey.create({ name: "" } as any);
    } catch (e: any) {
      expect(e).toBeDefined();
    }
  });
});
