import { NextResponse } from "next/server";
import { db } from "@/db";
import { images } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { annotationEditImage } from "@/lib/genai";

export async function POST(request: Request) {
  try {
    const {
      shotId,
      geminiApiKey,
      geminiBaseUrl,
      geminiModel,
    } = await request.json();

    // Load the active image
    const activeImage = await db.query.images.findFirst({
      where: and(eq(images.shotId, shotId), eq(images.isActive, true)),
    });
    if (!activeImage) {
      return NextResponse.json(
        { error: "No active image to upscale" },
        { status: 400 }
      );
    }

    // Check if already 4K
    if (activeImage.resolution === "4K") {
      return NextResponse.json(
        { error: "Image is already 4K" },
        { status: 400 }
      );
    }

    // Extract base64 from data URL
    let originalBase64: string;
    let originalMimeType: string;
    if (activeImage.filePath.startsWith("data:")) {
      const match = activeImage.filePath.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) throw new Error("Invalid data URL format");
      originalMimeType = match[1];
      originalBase64 = match[2];
    } else {
      // Legacy: read from filesystem
      const fs = await import("fs");
      const path = await import("path");
      const originalFilePath = path.join(process.cwd(), "public", activeImage.filePath);
      const originalBuffer = fs.readFileSync(originalFilePath);
      originalBase64 = originalBuffer.toString("base64");
      originalMimeType = activeImage.filePath.endsWith(".png")
        ? "image/png"
        : "image/jpeg";
    }

    // Upscale using annotationEditImage with upscale prompt
    const result = await annotationEditImage(
      originalBase64,
      originalMimeType,
      geminiApiKey,
      geminiModel,
      geminiBaseUrl || undefined,
      "4K"
    );

    // Store as data URL
    const dataUrl = `data:${result.mimeType};base64,${result.imageBase64}`;

    // Deactivate previous images
    await db
      .update(images)
      .set({ isActive: false })
      .where(eq(images.shotId, shotId));

    // Get next version number
    const { nanoid } = await import("nanoid");
    const { sql } = await import("drizzle-orm");
    const maxVersion = await db
      .select({ max: sql<number>`MAX(version)` })
      .from(images)
      .where(eq(images.shotId, shotId));
    const version = (maxVersion[0]?.max ?? 0) + 1;

    // Insert new 4K image record
    const imageRecord = {
      id: nanoid(),
      shotId,
      filePath: dataUrl,
      prompt: activeImage.prompt,
      editInstruction: "高清化至 4K",
      referenceImagePath: null,
      resolution: "4K",
      version,
      isActive: true,
      createdAt: new Date(),
    };
    await db.insert(images).values(imageRecord);

    return NextResponse.json(imageRecord);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
