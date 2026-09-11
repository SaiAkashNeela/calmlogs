import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./db/schema";

export function createAuth(env: any) {
  return betterAuth({
    secret: env.BETTER_AUTH_SECRET || "calmlogs-secret-key-32-chars-minimum-dev",
    baseURL: env.BETTER_AUTH_URL || "http://localhost:3000",
    database: drizzleAdapter(drizzle(env.DB, { schema }), { provider: "sqlite" }),
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID || "dummy",
        clientSecret: env.GOOGLE_CLIENT_SECRET || "dummy"
      }
    },
    plugins: [organization()]
  });
}
