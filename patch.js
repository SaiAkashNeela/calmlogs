const fs = require('fs');
let content = fs.readFileSync('/app/applet/worker/src/db/schema.ts', 'utf8');

content = content.replace(
  "	inviterId: text('inviterId').notNull().references(() => user.id)\n});",
  "	inviterId: text('inviterId').notNull().references(() => user.id),\n	createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),\n	updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull()\n});"
);

fs.writeFileSync('/app/applet/worker/src/db/schema.ts', content);
