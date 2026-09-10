import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";

export const auth = betterAuth({
  database: drizzleAdapter(null as any, { provider: "sqlite" }),
  emailAndPassword: { enabled: true },
  socialProviders: { google: { clientId: "dummy", clientSecret: "dummy" } },
  plugins: [organization()]
});
