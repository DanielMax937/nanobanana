import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(), // nanoid
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const scenes = sqliteTable("scenes", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"), // 用户输入的镜头描述原文
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const shots = sqliteTable("shots", {
  id: text("id").primaryKey(),
  sceneId: text("scene_id")
    .notNull()
    .references(() => scenes.id, { onDelete: "cascade" }),
  shotName: text("shot_name").notNull(),
  description: text("description").notNull(),
  nanoPrompt: text("nano_prompt").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const images = sqliteTable("images", {
  id: text("id").primaryKey(),
  shotId: text("shot_id")
    .notNull()
    .references(() => shots.id, { onDelete: "cascade" }),
  filePath: text("file_path").notNull(),
  prompt: text("prompt").notNull(),
  editInstruction: text("edit_instruction"),
  referenceImagePath: text("reference_image_path"),
  version: integer("version").notNull().default(1),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
