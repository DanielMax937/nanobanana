import { NextResponse } from "next/server";
import { db } from "@/db";
import { shots, scenes } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { parseShotDescription } from "@/lib/llm";

export async function POST(request: Request) {
  try {
    const { description, sceneId, llmApiKey, llmBaseUrl, llmModel } =
      await request.json();

    // Parse with LLM
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

    return NextResponse.json(createdShots);
  } catch (error: unknown) {
    console.error("[/api/llm/parse] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
