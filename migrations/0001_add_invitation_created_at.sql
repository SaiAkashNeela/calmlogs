ALTER TABLE `invitation` ADD COLUMN `createdAt` integer NOT NULL DEFAULT (unixepoch());
--> statement-breakpoint
ALTER TABLE `invitation` ADD COLUMN `teamId` text;
