import { NextResponse } from "next/server";
import { db } from "@/db";
import { images } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ imageId: string }> }
) {
  const { imageId } = await params;

  const image = await db.query.images.findFirst({
    where: eq(images.id, imageId),
  });
  if (!image) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  // Deactivate all images for this shot
  await db
    .update(images)
    .set({ isActive: false })
    .where(eq(images.shotId, image.shotId));

  // Activate the selected one
  await db
    .update(images)
    .set({ isActive: true })
    .where(eq(images.id, imageId));

  return NextResponse.json({ success: true });
}
