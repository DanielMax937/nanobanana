import { db } from "@/db";
import { scenes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ sceneId: string }> }
) {
  const { sceneId } = await params;
  await db.delete(scenes).where(eq(scenes.id, sceneId));
  return NextResponse.json({ success: true });
}
