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
    plugins: [
      organization({
        ac,
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

