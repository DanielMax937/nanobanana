import { NextResponse } from "next/server";
import { db } from "@/db";
import { shots, scenes } from "@/db/schema";
import { eq } from "drizzle-orm";
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

    // Insert shots
    const createdShots = parsed.map((shot, index) => ({
      id: nanoid(),
      sceneId,
      shotName: shot.shotName,
      description: shot.description,
      nanoPrompt: shot.nanoPrompt,
      sortOrder: index,
      createdAt: new Date(),
    }));

    for (const shot of createdShots) {
      await db.insert(shots).values(shot);
    }

    return NextResponse.json(createdShots);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
