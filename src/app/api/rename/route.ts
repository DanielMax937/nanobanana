import { NextResponse } from "next/server";
import { db } from "@/db";
import { projects, scenes, shots } from "@/db/schema";
import { eq } from "drizzle-orm";

// Rename (update alias) for project, scene, or shot
export async function PATCH(request: Request) {
  try {
    const { type, id, alias } = await request.json();

    if (!type || !id || alias === undefined) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    const trimmedAlias = alias.trim() || null;

    switch (type) {
      case "project":
        await db
          .update(projects)
          .set({ alias: trimmedAlias, updatedAt: new Date() })
          .where(eq(projects.id, id));
        break;
      case "scene":
        await db
          .update(scenes)
          .set({ alias: trimmedAlias, updatedAt: new Date() })
          .where(eq(scenes.id, id));
        break;
      case "shot":
        await db
          .update(shots)
          .set({ alias: trimmedAlias })
          .where(eq(shots.id, id));
        break;
      default:
        return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
