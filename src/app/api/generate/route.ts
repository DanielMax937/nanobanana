import { NextResponse } from "next/server";
import { db } from "@/db";
import { images } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { generateImage } from "@/lib/genai";

export async function POST(request: Request) {
  try {
    const { prompt, shotId, geminiApiKey, geminiBaseUrl, geminiModel, resolution } = await request.json();

    const result = await generateImage(prompt, geminiApiKey, geminiModel, geminiBaseUrl || undefined, resolution);

    // Store as data URL for preview (no filesystem save)
    const dataUrl = `data:${result.mimeType};base64,${result.imageBase64}`;

    // Get next version number
    const maxVersion = await db
      .select({ max: sql<number>`MAX(version)` })
      .from(images)
      .where(eq(images.shotId, shotId));
    const version = (maxVersion[0]?.max ?? 0) + 1;

    // Deactivate previous images
    await db.update(images).set({ isActive: false }).where(eq(images.shotId, shotId));

    // Insert new image record with data URL
    const imageRecord = {
      id: nanoid(),
      shotId,
      filePath: dataUrl,
      prompt,
      resolution: resolution || "1K",
      version,
      isActive: true,
      createdAt: new Date(),
    };
    await db.insert(images).values(imageRecord);

    return NextResponse.json(imageRecord);
  } catch (error: unknown) {
    console.error("[/api/generate] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
