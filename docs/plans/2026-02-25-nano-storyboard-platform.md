# Nano 影视分镜与图片生成管理平台 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 构建一个基于 Next.js 的影视分镜管理平台，用户输入镜头描述后通过 LLM 解析为分镜 Prompt 列表，再调用 Google GenAI (Gemini 3 Pro Image) 生成和编辑图片。

**Architecture:** Next.js App Router + SQLite (better-sqlite3 + Drizzle ORM) 后端存储三级数据结构（项目→镜头序列→分镜）。前端用 Zustand 管理状态，shadcn/ui 构建深色主题 UI。图片生成通过 Next.js API Routes 调用 Google GenAI SDK，base64 图片存储在本地 `public/images/` 目录。

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM + better-sqlite3, Zustand, @google/genai

---

## 目录结构

```
nano/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # 根布局（深色主题、全局 Toaster）
│   │   ├── page.tsx                # 首页重定向到项目列表
│   │   ├── globals.css             # Tailwind + 深色主题变量
│   │   ├── api/
│   │   │   ├── llm/parse/route.ts        # LLM 解析镜头描述 → 分镜列表
│   │   │   ├── generate/route.ts         # Gemini 文生图
│   │   │   └── edit/route.ts             # Gemini 图片编辑
│   │   └── projects/
│   │       └── [projectId]/
│   │           └── scenes/
│   │               └── [sceneId]/
│   │                   └── page.tsx      # 镜头序列详情页（分镜卡片列表）
│   ├── components/
│   │   ├── sidebar.tsx             # 三级导航侧边栏
│   │   ├── settings-dialog.tsx     # LLM + Gemini API 配置弹窗
│   │   ├── scene-editor.tsx        # 镜头描述输入 + 解析按钮
│   │   ├── shot-card.tsx           # 分镜卡片（prompt、生图、编辑、历史）
│   │   ├── shot-card-list.tsx      # 分镜卡片列表
│   │   ├── image-history.tsx       # 图片历史版本切换
│   │   └── loading-skeleton.tsx    # 骨架屏 / Loader
│   ├── db/
│   │   ├── index.ts                # Drizzle + better-sqlite3 初始化
│   │   ├── schema.ts               # 数据库 schema（projects, scenes, shots, images）
│   │   └── migrate.ts              # 自动迁移脚本
│   ├── lib/
│   │   ├── genai.ts                # Google GenAI SDK 封装
│   │   ├── llm.ts                  # OpenAI 兼容 LLM 调用封装
│   │   └── utils.ts                # 工具函数
│   └── store/
│       └── settings.ts             # Zustand store（API 配置）
├── public/
│   └── images/                     # 生成的图片存储目录
├── drizzle.config.ts               # Drizzle 配置
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
└── components.json                 # shadcn/ui 配置
```

---

### Task 1: 项目初始化 + 基础配置

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`

**Step 1: 创建 Next.js 项目**

Run: `pnpm create next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --turbopack`

**Step 2: 安装核心依赖**

Run:
```bash
pnpm add @google/genai better-sqlite3 drizzle-orm zustand
pnpm add -D drizzle-kit @types/better-sqlite3
```

**Step 3: 初始化 shadcn/ui**

Run: `pnpm dlx shadcn@latest init`
选择: New York style, Zinc color, CSS variables enabled

**Step 4: 安装 shadcn 组件**

Run:
```bash
pnpm dlx shadcn@latest add button input textarea dialog toast sidebar card tabs scroll-area dropdown-menu separator badge sheet tooltip
```

**Step 5: 配置深色主题**

修改 `src/app/globals.css`，确保 dark mode 为默认主题。在 `src/app/layout.tsx` 的 `<html>` 标签添加 `className="dark"`。

**Step 6: Commit**

```bash
git init && git add -A && git commit -m "feat: init Next.js project with shadcn/ui and core deps"
```

---

### Task 2: 数据库 Schema + Drizzle 配置

**Files:**
- Create: `src/db/schema.ts`, `src/db/index.ts`, `drizzle.config.ts`

**Step 1: 创建 Drizzle 配置**

```typescript
// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: "./data/nano.db",
  },
});
```

**Step 2: 定义数据库 Schema**

```typescript
// src/db/schema.ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(), // nanoid
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const scenes = sqliteTable("scenes", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"), // 用户输入的镜头描述原文
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const shots = sqliteTable("shots", {
  id: text("id").primaryKey(),
  sceneId: text("scene_id").notNull().references(() => scenes.id, { onDelete: "cascade" }),
  shotName: text("shot_name").notNull(),
  description: text("description").notNull(), // 画面动作描述
  nanoPrompt: text("nano_prompt").notNull(),   // 生图英文 prompt
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const images = sqliteTable("images", {
  id: text("id").primaryKey(),
  shotId: text("shot_id").notNull().references(() => shots.id, { onDelete: "cascade" }),
  filePath: text("file_path").notNull(),       // public/images/xxx.png
  prompt: text("prompt").notNull(),            // 生成时使用的 prompt
  editInstruction: text("edit_instruction"),    // 编辑指令（如有）
  referenceImagePath: text("reference_image_path"), // 参考图路径（如有）
  version: integer("version").notNull().default(1),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
```

**Step 3: 创建数据库初始化**

```typescript
// src/db/index.ts
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

const dbDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const sqlite = new Database(path.join(dbDir, "nano.db"));
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
```

**Step 4: 生成并运行迁移**

Run:
```bash
pnpm drizzle-kit generate
pnpm drizzle-kit push
```

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: add SQLite database schema with Drizzle ORM"
```

---

### Task 3: Zustand Settings Store + 设置弹窗

**Files:**
- Create: `src/store/settings.ts`, `src/components/settings-dialog.tsx`

**Step 1: 创建 Settings Store**

```typescript
// src/store/settings.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface Settings {
  // LLM 配置（OpenAI 兼容）
  llmApiKey: string;
  llmBaseUrl: string;
  llmModel: string;
  // Gemini 图片生成配置
  geminiApiKey: string;
  geminiModel: string;
}

interface SettingsStore extends Settings {
  updateSettings: (partial: Partial<Settings>) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      llmApiKey: "",
      llmBaseUrl: "https://api.openai.com/v1",
      llmModel: "gpt-4o",
      geminiApiKey: "",
      geminiModel: "gemini-3-pro-image-preview",
      updateSettings: (partial) => set(partial),
    }),
    { name: "nano-settings" }
  )
);
```

**Step 2: 创建设置弹窗组件**

使用 shadcn Dialog + Input 组件，包含 LLM 和 Gemini 两组配置表单。API Key 输入框用 `type="password"`。

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: add settings store and config dialog"
```

---

### Task 4: 三级侧边栏导航 + 项目 CRUD

**Files:**
- Create: `src/components/sidebar.tsx`
- Create: `src/app/api/projects/route.ts` (GET/POST)
- Create: `src/app/api/projects/[projectId]/route.ts` (DELETE)
- Create: `src/app/api/projects/[projectId]/scenes/route.ts` (GET/POST)
- Create: `src/app/api/projects/[projectId]/scenes/[sceneId]/route.ts` (DELETE)

**Step 1: 创建项目 API Routes**

实现 RESTful CRUD：
- `GET /api/projects` — 获取所有项目（含 scenes 子列表）
- `POST /api/projects` — 创建项目
- `DELETE /api/projects/[projectId]` — 删除项目（级联删除）
- `POST /api/projects/[projectId]/scenes` — 创建镜头序列
- `DELETE /api/projects/[projectId]/scenes/[sceneId]` — 删除镜头序列

**Step 2: 创建侧边栏组件**

使用 shadcn Sidebar 组件，实现三级树状导航：
- 顶层：项目列表（可展开/折叠）
- 二层：镜头序列列表
- 每层有 "+" 按钮创建新项目/镜头
- 每项有右键菜单或删除按钮
- 点击镜头序列跳转到 `/projects/[projectId]/scenes/[sceneId]`

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: add sidebar navigation with project/scene CRUD"
```

---

### Task 5: LLM 解析模块（镜头描述 → 分镜列表）

**Files:**
- Create: `src/lib/llm.ts`
- Create: `src/app/api/llm/parse/route.ts`
- Create: `src/components/scene-editor.tsx`

**Step 1: 封装 LLM 调用**

```typescript
// src/lib/llm.ts
export async function parseShotDescription(
  description: string,
  config: { apiKey: string; baseUrl: string; model: string }
): Promise<Array<{ shotName: string; description: string; nanoPrompt: string }>> {
  const systemPrompt = `你是一个专业的电影分镜师和AI生图提示词专家。请根据用户提供的镜头描述，将其拆解为按时间或逻辑顺序排列的分镜列表。每个分镜需要提供一个专为图像生成模型优化的英文 Prompt。输出格式必须为 JSON 数组，每个对象包含 shotName (分镜名称), description (画面动作描述), nanoPrompt (用于生图的英文提示词)。只输出 JSON，不要其他内容。`;

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: description },
      ],
      temperature: 0.7,
    }),
  });

  const data = await response.json();
  const content = data.choices[0].message.content;
  return JSON.parse(content.replace(/```json\n?|\n?```/g, "").trim());
}
```

**Step 2: 创建 API Route**

`POST /api/llm/parse` — 接收 `{ description, sceneId }` + settings，调用 LLM 解析，将结果写入 shots 表。

**Step 3: 创建 Scene Editor 组件**

大 Textarea + "解析为分镜 Prompt" 按钮，带 Loading 状态。解析完成后刷新分镜卡片列表。

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: add LLM parsing module for shot descriptions"
```

---

### Task 6: Gemini 图片生成模块

**Files:**
- Create: `src/lib/genai.ts`
- Create: `src/app/api/generate/route.ts`
- Modify: `src/components/shot-card.tsx`

**Step 1: 封装 Google GenAI SDK**

```typescript
// src/lib/genai.ts
import { GoogleGenAI } from "@google/genai";

export async function generateImage(
  prompt: string,
  apiKey: string,
  model: string = "gemini-3-pro-image-preview"
): Promise<{ imageBase64: string; mimeType: string; text?: string }> {
  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseModalities: ["TEXT", "IMAGE"],
    },
  });

  for (const part of response.candidates![0].content!.parts!) {
    if (part.inlineData) {
      return {
        imageBase64: part.inlineData.data!,
        mimeType: part.inlineData.mimeType!,
        text: response.candidates![0].content!.parts!.find((p) => p.text)?.text,
      };
    }
  }
  throw new Error("No image generated");
}

export async function editImage(
  prompt: string,
  referenceImageBase64: string,
  referenceImageMimeType: string,
  apiKey: string,
  model: string = "gemini-3-pro-image-preview"
): Promise<{ imageBase64: string; mimeType: string; text?: string }> {
  const ai = new GoogleGenAI({ apiKey });

  const contents = [
    { text: prompt },
    { inlineData: { mimeType: referenceImageMimeType, data: referenceImageBase64 } },
  ];

  const response = await ai.models.generateContent({
    model,
    contents,
    config: {
      responseModalities: ["TEXT", "IMAGE"],
    },
  });

  for (const part of response.candidates![0].content!.parts!) {
    if (part.inlineData) {
      return {
        imageBase64: part.inlineData.data!,
        mimeType: part.inlineData.mimeType!,
        text: response.candidates![0].content!.parts!.find((p) => p.text)?.text,
      };
    }
  }
  throw new Error("No image generated");
}
```

**Step 2: 创建生图 API Route**

`POST /api/generate` — 接收 `{ prompt, shotId, geminiApiKey, geminiModel }`，调用 `generateImage`，将 base64 保存为文件到 `public/images/`，在 images 表插入记录。

**Step 3: 创建分镜卡片组件**

每个卡片显示：shotName、description、nanoPrompt（可编辑）、"生成图片"按钮、生成的图片预览。Loading 时显示骨架屏。

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: add Gemini image generation with shot cards"
```

---

### Task 7: 图片编辑模块（文本修改 + 垫图修改）

**Files:**
- Create: `src/app/api/edit/route.ts`
- Modify: `src/components/shot-card.tsx` (添加编辑 UI)

**Step 1: 创建编辑 API Route**

`POST /api/edit` — 接收 `{ shotId, editInstruction, referenceImageBase64?, geminiApiKey, geminiModel }`。
- 读取该 shot 当前 active image 的文件作为参考图
- 如果用户上传了新参考图，使用上传的图
- 调用 `editImage`，保存新版本，更新 isActive 标记

**Step 2: 在分镜卡片中添加编辑 UI**

- 文本修改：Input 输入框 + "修改"按钮
- 垫图修改：文件上传按钮 + Input + "修改"按钮
- 编辑时显示 Loading 状态

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: add image editing with text and reference image"
```

---

### Task 8: 图片历史版本管理

**Files:**
- Create: `src/components/image-history.tsx`
- Modify: `src/components/shot-card.tsx` (集成历史版本)

**Step 1: 创建历史版本组件**

- 在每个分镜卡片底部显示缩略图列表（所有历史版本）
- 点击缩略图切换当前显示的大图
- 显示每个版本的 prompt 和编辑指令
- 支持将某个历史版本设为当前 active 版本

**Step 2: 添加 API 支持**

`GET /api/shots/[shotId]/images` — 获取某分镜的所有图片版本
`PATCH /api/images/[imageId]/activate` — 设置某版本为 active

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: add image version history with switching"
```

---

### Task 9: 镜头序列详情页整合

**Files:**
- Create: `src/app/projects/[projectId]/scenes/[sceneId]/page.tsx`
- Create: `src/components/shot-card-list.tsx`

**Step 1: 创建详情页**

整合所有组件：
- 顶部：面包屑导航（项目名 > 镜头序列名）
- Scene Editor（大 Textarea + 解析按钮）
- 分镜卡片列表（解析结果 + 图片生成/编辑/历史）

**Step 2: 数据获取**

使用 Server Component 从数据库加载 scene + shots + images 数据，传递给 Client Components。

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: add scene detail page with full storyboard workflow"
```

---

### Task 10: UI 打磨 + 错误处理

**Files:**
- Modify: `src/app/globals.css` (深色主题微调)
- Create: `src/components/loading-skeleton.tsx`
- Modify: 所有组件（添加 Toast 错误提示）

**Step 1: 深色主题打磨**

调整 CSS 变量，使配色接近 DaVinci Resolve 风格：
- 背景：`#1a1a2e` → `#16213e` 渐变
- 卡片：`#0f3460` 半透明
- 强调色：`#e94560`（红）或 `#533483`（紫）

**Step 2: Loading 状态**

- LLM 解析时：Textarea 下方显示骨架屏卡片
- 图片生成时：卡片内显示脉冲动画占位
- API 请求时：按钮显示 Spinner + disabled

**Step 3: 错误处理**

- API Key 无效 → Toast 提示 "API Key 无效，请在设置中检查"
- 网络错误 → Toast 提示 "网络请求失败，请重试"
- LLM 返回格式错误 → Toast 提示 "解析失败，请调整描述后重试"

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: polish dark theme, loading states, and error handling"
```

---

## 执行顺序

Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6 → Task 7 → Task 8 → Task 9 → Task 10

每个 Task 完成后 commit，保持增量可回滚。
