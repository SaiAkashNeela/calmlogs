const fs = require('fs');
let content = fs.readFileSync('/app/applet/worker/src/db/schema.ts', 'utf8');

content = content.replace(
  "	createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),\n});",
  "	createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),\n	updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull()\n});"
);

// wait, this replace will hit multiple places! Let's be careful.
