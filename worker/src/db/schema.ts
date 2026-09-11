import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const user = sqliteTable("user", {
	id: text("id").primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: integer('emailVerified', { mode: 'boolean' }).notNull(),
	image: text('image'),
	createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
	updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull()
});

export const session = sqliteTable("session", {
	id: text("id").primaryKey(),
	expiresAt: integer('expiresAt', { mode: 'timestamp' }).notNull(),
	token: text('token').notNull().unique(),
	createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
	updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull(),
	ipAddress: text('ipAddress'),
	userAgent: text('userAgent'),
	userId: text('userId').notNull().references(() => user.id),
	activeOrganizationId: text('activeOrganizationId')
});

export const account = sqliteTable("account", {
	id: text("id").primaryKey(),
	accountId: text('accountId').notNull(),
	providerId: text('providerId').notNull(),
	userId: text('userId').notNull().references(() => user.id),
	accessToken: text('accessToken'),
	refreshToken: text('refreshToken'),
	idToken: text('idToken'),
	accessTokenExpiresAt: integer('accessTokenExpiresAt', { mode: 'timestamp' }),
	refreshTokenExpiresAt: integer('refreshTokenExpiresAt', { mode: 'timestamp' }),
	scope: text('scope'),
	password: text('password'),
	createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
	updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull()
});

export const verification = sqliteTable("verification", {
	id: text("id").primaryKey(),
	identifier: text('identifier').notNull(),
	value: text('value').notNull(),
	expiresAt: integer('expiresAt', { mode: 'timestamp' }).notNull(),
	createdAt: integer('createdAt', { mode: 'timestamp' }),
	updatedAt: integer('updatedAt', { mode: 'timestamp' })
});

export const organization = sqliteTable("organization", {
	id: text("id").primaryKey(),
	name: text('name').notNull(),
	slug: text('slug').unique(),
	logo: text('logo'),
	createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
	metadata: text('metadata')
});

export const member = sqliteTable("member", {
	id: text("id").primaryKey(),
	organizationId: text('organizationId').notNull().references(() => organization.id),
	userId: text('userId').notNull().references(() => user.id),
	role: text('role').notNull(),
	createdAt: integer('createdAt', { mode: 'timestamp' }).notNull()
});

export const invitation = sqliteTable("invitation", {
	id: text("id").primaryKey(),
	organizationId: text('organizationId').notNull().references(() => organization.id),
	email: text('email').notNull(),
	role: text('role'),
	status: text('status').notNull(),
	expiresAt: integer('expiresAt', { mode: 'timestamp' }).notNull(),
	inviterId: text('inviterId').notNull().references(() => user.id),
	createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
	teamId: text('teamId'),
});

export const projects = sqliteTable("projects", {
	id: text("id").primaryKey(),
	organizationId: text("organization_id").notNull().references(() => organization.id),
	name: text("name").notNull(),
	description: text("description"),
	createdAt: integer("created_at", { mode: 'timestamp' }).notNull(),
	updatedAt: integer("updated_at", { mode: 'timestamp' }).notNull(),
});

export const services = sqliteTable("services", {
	id: text("id").primaryKey(),
	projectId: text("project_id").notNull().references(() => projects.id),
	name: text("name").notNull(),
	type: text("type"),
	createdAt: integer("created_at", { mode: 'timestamp' }).notNull(),
	updatedAt: integer("updated_at", { mode: 'timestamp' }).notNull(),
	lastSeenAt: integer("last_seen_at", { mode: 'timestamp' }),
	status: text("status").notNull().default('active'),
	ingestionKeyHash: text("ingestion_key_hash") 
});

export const logIndexes = sqliteTable("log_indexes", {
	id: text("id").primaryKey(),
	projectId: text("project_id").notNull().references(() => projects.id),
	serviceId: text("service_id").notNull().references(() => services.id),
	segmentPath: text("segment_path").notNull(),
	startTime: integer("start_time", { mode: 'timestamp' }),
	endTime: integer("end_time", { mode: 'timestamp' }),
	recordCount: integer("record_count").default(0),
	createdAt: integer("created_at", { mode: 'timestamp' }).notNull()
});
