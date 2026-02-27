import { NextResponse } from "next/server";
import { db } from "@/db";
import { shots } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ shotId: string }> }
) {
  try {
    const { shotId } = await params;

    await db.delete(shots).where(eq(shots.id, shotId));

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
