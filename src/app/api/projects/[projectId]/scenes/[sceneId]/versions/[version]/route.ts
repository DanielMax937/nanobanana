import { NextResponse } from "next/server";
import { db } from "@/db";
import { shots } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function DELETE(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ projectId: string; sceneId: string; version: string }>;
  }
) {
  try {
    const { projectId, sceneId, version } = await params;
    const versionNum = parseInt(version, 10);

    // Delete all shots in this version
    await db
      .delete(shots)
      .where(
        and(
          eq(shots.sceneId, sceneId),
          eq(shots.promptVersion, versionNum)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
