import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(), // nanoid
  name: text("name").notNull(),
  alias: text("alias"), // display name
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const scenes = sqliteTable("scenes", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  alias: text("alias"), // display name
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
  alias: text("alias"), // display name
  description: text("description").notNull(),
  nanoPrompt: text("nano_prompt").notNull(),
  promptVersion: integer("prompt_version").notNull().default(1), // batch version for each parse
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
  resolution: text("resolution").default("1K"), // 512px, 1K, 2K, 4K
  version: integer("version").notNull().default(1),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  analysisResult: text("analysis_result"), // JSON string of LLM analysis result
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// Relations

export const projectsRelations = relations(projects, ({ many }) => ({
  scenes: many(scenes),
}));

export const scenesRelations = relations(scenes, ({ one, many }) => ({
  project: one(projects, { fields: [scenes.projectId], references: [projects.id] }),
  shots: many(shots),
}));

export const shotsRelations = relations(shots, ({ one, many }) => ({
  scene: one(scenes, { fields: [shots.sceneId], references: [scenes.id] }),
  images: many(images),
}));

export const imagesRelations = relations(images, ({ one }) => ({
  shot: one(shots, { fields: [images.shotId], references: [shots.id] }),
}));
