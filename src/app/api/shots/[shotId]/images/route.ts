import { NextResponse } from "next/server";
import { db } from "@/db";
import { images } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ shotId: string }> }
) {
  const { shotId } = await params;
  const allImages = await db
    .select()
    .from(images)
    .where(eq(images.shotId, shotId))
    .orderBy(asc(images.version));
  return NextResponse.json(allImages);
}
