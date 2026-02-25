import { db } from "@/db";
import { scenes } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const projectScenes = await db.query.scenes.findMany({
    where: eq(scenes.projectId, projectId),
    orderBy: [scenes.sortOrder],
  });
  return NextResponse.json(projectScenes);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const { name } = await request.json();
  const now = new Date();
  const maxOrder = await db
    .select({ max: sql<number>`MAX(sort_order)` })
    .from(scenes)
    .where(eq(scenes.projectId, projectId));
  const sortOrder = ((maxOrder[0]?.max as number) ?? -1) + 1;
  const scene = {
    id: nanoid(),
    projectId,
    name,
    sortOrder,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(scenes).values(scene);
  return NextResponse.json(scene);
}
