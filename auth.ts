import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements, ownerAc } from "better-auth/plugins/organization/access";

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

export const auth = betterAuth({
  database: drizzleAdapter(null as any, { provider: "sqlite" }),
  socialProviders: { google: { clientId: "dummy", clientSecret: "dummy" } },
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

