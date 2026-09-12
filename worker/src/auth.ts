import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements, ownerAc } from "better-auth/plugins/organization/access";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./db/schema";

const ac = createAccessControl(defaultStatements);

const writeRole = ac.newRole({
  ...ownerAc.statements,
});

const readRole = ac.newRole({
  organization: [],
  member: [],
  invitation: [],
  team: [],
  ac: [],
});

export function createAuth(env: any) {
  const trustedOrigins: string[] = [];

  if (env.BETTER_AUTH_URL) {
    try {
      trustedOrigins.push(new URL(env.BETTER_AUTH_URL).origin);
    } catch {
      trustedOrigins.push(env.BETTER_AUTH_URL.replace(/\/+$/, ''));
    }
  }

  if (env.TRUSTED_ORIGINS) {
    const extra = env.TRUSTED_ORIGINS.split(',').map((s: string) => s.trim()).filter(Boolean);
    trustedOrigins.push(...extra);
  }

  const baseURL = env.BETTER_AUTH_URL
    ? env.BETTER_AUTH_URL.replace(/\/+$/, '')
    : undefined;

  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL,
    trustedOrigins,
    database: drizzleAdapter(drizzle(env.DB, { schema }), { provider: "sqlite" }),
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID || "",
        clientSecret: env.GOOGLE_CLIENT_SECRET || ""
      }
    },
    plugins: [
      organization({
        ac,
        cancelPendingInvitationsOnReInvite: true,
        roles: {
          owner: writeRole,
          write: writeRole,
          read: readRole,
          admin: writeRole,
          member: readRole,
        }
      })
    ]
  });
}

