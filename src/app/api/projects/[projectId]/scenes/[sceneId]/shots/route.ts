import { NextResponse } from "next/server";
import { db } from "@/db";
import { shots } from "@/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string; sceneId: string }> }
) {
  try {
    const { sceneId } = await params;
    const { shotName, description, nanoPrompt } = await request.json();

    if (!shotName?.trim()) {
      return NextResponse.json(
        { error: "Shot name is required" },
        { status: 400 }
      );
    }

    // Get max sortOrder for this scene
    const existingShots = await db
      .select()
      .from(shots)
      .where(eq(shots.sceneId, sceneId));
    const maxSortOrder = Math.max(0, ...existingShots.map((s) => s.sortOrder));

    const shot = {
      id: nanoid(),
      sceneId,
      shotName: shotName.trim(),
      description: description?.trim() || "",
      nanoPrompt: nanoPrompt?.trim() || "",
      sortOrder: maxSortOrder + 1,
      createdAt: new Date(),
    };

    await db.insert(shots).values(shot);
    return NextResponse.json(shot);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
