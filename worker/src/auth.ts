import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./db/schema";

export function createAuth(env: any) {
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL || "http://localhost:3000",
    database: drizzleAdapter(drizzle(env.DB, { schema }), { provider: "sqlite" }),
    emailAndPassword: { enabled: true },
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID || "dummy",
        clientSecret: env.GOOGLE_CLIENT_SECRET || "dummy"
      }
    },
    plugins: [organization()]
  });
}
