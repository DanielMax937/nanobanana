import { db } from "@/db";
import { projects } from "@/db/schema";
import { desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";

export async function GET() {
  const allProjects = await db.query.projects.findMany({
    with: { scenes: true },
    orderBy: [desc(projects.createdAt)],
  });
  return NextResponse.json(allProjects);
}

export async function POST(request: Request) {
  const { name } = await request.json();
  const now = new Date();
  const project = { id: nanoid(), name, createdAt: now, updatedAt: now };
  await db.insert(projects).values(project);
  return NextResponse.json(project);
}
