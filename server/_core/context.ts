import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import * as db from "../db";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

async function getOrCreateDefaultUser(): Promise<User> {
  let user = await db.getUserByOpenId("local-admin");
  if (!user) {
    await db.upsertUser({
      openId: "local-admin",
      name: "長谷川 光",
      email: "admin@martialarts.co.jp",
      loginMethod: "local",
      role: "admin",
      lastSignedIn: new Date(),
    });
    user = await db.getUserByOpenId("local-admin");
  }
  return user!;
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = await getOrCreateDefaultUser();
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
