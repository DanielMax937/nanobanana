import { NextResponse } from "next/server";
import { db } from "@/db";
import { images } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { editImage } from "@/lib/genai";
import fs from "fs";
import path from "path";

export async function POST(request: Request) {
  try {
    const {
      shotId,
      editInstruction,
      referenceImageBase64,
      referenceImageMimeType,
      geminiApiKey,
      geminiModel,
    } = await request.json();

    let refBase64 = referenceImageBase64;
    let refMimeType = referenceImageMimeType || "image/png";

    // If no reference image provided, use the current active image
    if (!refBase64) {
      const activeImage = await db.query.images.findFirst({
        where: and(eq(images.shotId, shotId), eq(images.isActive, true)),
      });
      if (!activeImage) {
        return NextResponse.json(
          { error: "No active image to edit" },
          { status: 400 }
        );
      }
      const filePath = path.join(process.cwd(), "public", activeImage.filePath);
      const fileBuffer = fs.readFileSync(filePath);
      refBase64 = fileBuffer.toString("base64");
      refMimeType = activeImage.filePath.endsWith(".png")
        ? "image/png"
        : "image/jpeg";
    }

    const result = await editImage(
      editInstruction,
      refBase64,
      refMimeType,
      geminiApiKey,
      geminiModel
    );

    // Save image file
    const imagesDir = path.join(process.cwd(), "public", "images");
    if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });

    const ext = result.mimeType.includes("png") ? "png" : "jpg";
    const fileName = `${nanoid()}.${ext}`;
    const filePath = path.join(imagesDir, fileName);
    fs.writeFileSync(filePath, Buffer.from(result.imageBase64, "base64"));

    // Get next version number
    const maxVersion = await db
      .select({ max: sql<number>`MAX(version)` })
      .from(images)
      .where(eq(images.shotId, shotId));
    const version = (maxVersion[0]?.max ?? 0) + 1;

    // Deactivate previous images
    await db
      .update(images)
      .set({ isActive: false })
      .where(eq(images.shotId, shotId));

    // Insert new image record
    const imageRecord = {
      id: nanoid(),
      shotId,
      filePath: `/images/${fileName}`,
      prompt: editInstruction,
      editInstruction,
      referenceImagePath: referenceImageBase64 ? "uploaded" : null,
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
