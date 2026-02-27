import { NextResponse } from "next/server";
import { db } from "@/db";
import { scenes, shots, images } from "@/db/schema";
import { eq, and, asc, desc, sql } from "drizzle-orm";
import { generateImage, analyzeImage, editImage } from "@/lib/genai";
import { parseShotDescription } from "@/lib/llm";
import { nanoid } from "nanoid";

interface AutoModeRequest {
  sceneId: string;
  description: string;
  llmApiKey: string;
  llmBaseUrl: string;
  llmModel: string;
  geminiApiKey: string;
  geminiBaseUrl: string;
  geminiModel: string;
  maxLoops?: number;
}

interface ProgressUpdate {
  type: "parse" | "generate" | "analyze" | "regenerate" | "done" | "error";
  shotId?: string;
  shotName?: string;
  iteration?: number;
  message: string;
  analysis?: {
    hasIssues: boolean;
    issues: string[];
    suggestions: string[];
    summary: string;
  };
}

async function parseSceneToShots(
  description: string,
  sceneId: string,
  llmApiKey: string,
  llmBaseUrl: string,
  llmModel: string
): Promise<Array<{ id: string; shotName: string; description: string; nanoPrompt: string }>> {
  // Parse with LLM directly
  const parsed = await parseShotDescription(description, {
    apiKey: llmApiKey,
    baseUrl: llmBaseUrl,
    model: llmModel,
  });

  // Update scene description
  await db
    .update(scenes)
    .set({ description, updatedAt: new Date() })
    .where(eq(scenes.id, sceneId));

  // Get next prompt version for this scene
  const maxVersion = await db
    .select({ max: sql<number>`MAX(prompt_version)` })
    .from(shots)
    .where(eq(shots.sceneId, sceneId));
  const promptVersion = (maxVersion[0]?.max ?? 0) + 1;

  // Insert shots with version
  const createdShots = parsed.map((shot, index) => ({
    id: nanoid(),
    sceneId,
    shotName: shot.shotName,
    description: shot.description,
    nanoPrompt: shot.nanoPrompt,
    promptVersion,
    sortOrder: index,
    createdAt: new Date(),
  }));

  for (const shot of createdShots) {
    await db.insert(shots).values(shot);
  }

  return createdShots.map((s) => ({
    id: s.id,
    shotName: s.shotName,
    description: s.description,
    nanoPrompt: s.nanoPrompt,
  }));
}

async function generateAndAnalyzeShot(
  shot: { id: string; shotName: string; description: string; nanoPrompt: string },
  sceneContext: string,
  geminiApiKey: string,
  geminiBaseUrl: string,
  geminiModel: string,
  maxLoops: number,
  onProgress: (update: ProgressUpdate) => void
): Promise<void> {
  const { id: shotId, shotName, description, nanoPrompt } = shot;

  let currentImageBase64: string | null = null;
  let currentImageMimeType: string | null = null;
  let iteration = 0;
  let analysisResult: { hasIssues: boolean; issues: string[]; suggestions: string[]; summary: string } | null = null;

  while (iteration < maxLoops) {
    iteration++;
    onProgress({
      type: "generate",
      shotId,
      shotName,
      iteration,
      message: `生成图片 (${iteration}/${maxLoops})...`,
    });

    // Generate or regenerate image
    let result: { imageBase64: string; mimeType: string };

    if (iteration === 1 && !currentImageBase64) {
      // First generation - use nanoPrompt
      result = await generateImage(
        nanoPrompt,
        geminiApiKey,
        geminiModel,
        geminiBaseUrl || undefined
      );
    } else {
      // Regenerate with analysis feedback
      let editPrompt = nanoPrompt;
      if (analysisResult && analysisResult.issues.length > 0) {
        editPrompt = `${nanoPrompt}\n\nPlease fix these issues:\n${analysisResult.issues.map((i, idx) => `${idx + 1}. ${i}`).join("\n")}\n\nSuggestions:\n${analysisResult.suggestions.map((s, idx) => `${idx + 1}. ${s}`).join("\n")}`;
      }

      if (currentImageBase64 && currentImageMimeType) {
        result = await editImage(
          editPrompt,
          currentImageBase64,
          currentImageMimeType,
          geminiApiKey,
          geminiModel,
          geminiBaseUrl || undefined
        );
      } else {
        result = await generateImage(
          editPrompt,
          geminiApiKey,
          geminiModel,
          geminiBaseUrl || undefined
        );
      }
    }

    currentImageBase64 = result.imageBase64;
    currentImageMimeType = result.mimeType;

    // Save the image
    const existingImages = await db
      .select()
      .from(images)
      .where(eq(images.shotId, shotId))
      .orderBy(desc(images.version));

    const nextVersion = existingImages.length > 0 ? Math.max(...existingImages.map((i) => i.version)) + 1 : 1;

    // Deactivate previous images
    await db
      .update(images)
      .set({ isActive: false })
      .where(eq(images.shotId, shotId));

    // Insert new image
    const imageId = nanoid();
    await db.insert(images).values({
      id: imageId,
      shotId,
      filePath: `data:${result.mimeType};base64,${result.imageBase64}`,
      prompt: iteration === 1 ? nanoPrompt : `Regeneration ${iteration}`,
      version: nextVersion,
      isActive: true,
      createdAt: new Date(),
    });

    onProgress({
      type: "analyze",
      shotId,
      shotName,
      iteration,
      message: `分析图片 (${iteration}/${maxLoops})...`,
    });

    // Analyze the image
    try {
      analysisResult = await analyzeImage(
        result.imageBase64,
        result.mimeType,
        description,
        sceneContext,
        geminiApiKey,
        geminiModel,
        geminiBaseUrl || undefined
      );

      // Update image with analysis result
      await db
        .update(images)
        .set({ analysisResult: JSON.stringify(analysisResult) })
        .where(eq(images.id, imageId));

      onProgress({
        type: iteration < maxLoops ? "regenerate" : "done",
        shotId,
        shotName,
        iteration,
        message: analysisResult.hasIssues
          ? `发现 ${analysisResult.issues.length} 个问题，正在重新生成...`
          : "图片质量良好",
        analysis: analysisResult,
      });

      // If no issues, we're done
      if (!analysisResult.hasIssues) {
        onProgress({
          type: "done",
          shotId,
          shotName,
          iteration,
          message: "完成",
          analysis: analysisResult,
        });
        return;
      }
    } catch (analyzeErr) {
      console.error(`[AutoMode] Failed to analyze shot ${shotId}:`, analyzeErr);
      // If analysis fails, treat as no issues and stop
      onProgress({
        type: "done",
        shotId,
        shotName,
        iteration,
        message: "分析失败，使用当前图片",
        analysis: {
          hasIssues: false,
          issues: [],
          suggestions: [],
          summary: "Analysis failed, accepting current result",
        },
      });
      return;
    }
  }

  // Max loops reached
  onProgress({
    type: "done",
    shotId,
    shotName,
    iteration: maxLoops,
    message: `达到最大迭代次数 (${maxLoops})`,
    analysis: analysisResult || {
      hasIssues: false,
      issues: [],
      suggestions: [],
      summary: "Max iterations reached",
    },
  });
}

export async function POST(request: Request) {
  const body: AutoModeRequest = await request.json();
  const {
    sceneId,
    description,
    llmApiKey,
    llmBaseUrl,
    llmModel,
    geminiApiKey,
    geminiBaseUrl,
    geminiModel,
    maxLoops = 5,
  } = body;

  if (!llmApiKey || !geminiApiKey) {
    return NextResponse.json({ error: "API keys not configured" }, { status: 400 });
  }

  if (!description.trim()) {
    return NextResponse.json({ error: "Description is required" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendProgress = (update: ProgressUpdate) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(update)}\n\n`));
      };

      try {
        // Get scene context
        const scene = await db.query.scenes.findFirst({
          where: eq(scenes.id, sceneId),
        });

        if (!scene) {
          sendProgress({
            type: "error",
            message: "场景不存在",
          });
          controller.close();
          return;
        }

        const sceneContext = scene.description || description;

        sendProgress({
          type: "parse",
          message: "正在解析场景描述...",
        });

        // Parse scene to shots
        const parsedShots = await parseSceneToShots(
          description,
          sceneId,
          llmApiKey,
          llmBaseUrl,
          llmModel
        );

        if (parsedShots.length === 0) {
          sendProgress({
            type: "error",
            message: "未能解析出任何分镜",
          });
          controller.close();
          return;
        }

        sendProgress({
          type: "parse",
          message: `已解析 ${parsedShots.length} 个分镜`,
        });

        // Process each shot
        for (const shot of parsedShots) {
          await generateAndAnalyzeShot(
            shot,
            sceneContext,
            geminiApiKey,
            geminiBaseUrl,
            geminiModel,
            maxLoops,
            sendProgress
          );
        }

        sendProgress({
          type: "done",
          message: "所有分镜处理完成",
        });

        controller.close();
      } catch (error) {
        console.error("[AutoMode] Error:", error);
        sendProgress({
          type: "error",
          message: error instanceof Error ? error.message : "Unknown error",
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
