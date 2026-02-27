import { db } from "@/db";
import { projects, shots } from "@/db/schema";
import { desc, eq, asc, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";

export async function GET() {
  const allProjects = await db.query.projects.findMany({
    with: {
      scenes: true,
    },
    orderBy: [desc(projects.createdAt)],
  });

  // Get versions and shots for each scene
  const projectsWithVersions = await Promise.all(
    allProjects.map(async (project) => ({
      ...project,
      displayName: project.alias || project.name,
      scenes: await Promise.all(
        project.scenes.map(async (scene) => {
          // Get all shots for this scene grouped by version
          const sceneShots = await db
            .select()
            .from(shots)
            .where(eq(shots.sceneId, scene.id))
            .orderBy(asc(shots.promptVersion), asc(shots.sortOrder));

          // Group by promptVersion
          const versionMap = new Map<number, typeof sceneShots>();
          for (const shot of sceneShots) {
            const existing = versionMap.get(shot.promptVersion) || [];
            existing.push(shot);
            versionMap.set(shot.promptVersion, existing);
          }

          const promptVersions = Array.from(versionMap.entries())
            .sort(([a], [b]) => b - a)
            .map(([version, shots]) => ({
              version,
              shots: shots.map((s) => ({
                id: s.id,
                shotName: s.shotName,
                alias: s.alias,
                displayName: s.alias || s.shotName,
                sortOrder: s.sortOrder,
              })),
            }));

          return {
            ...scene,
            displayName: scene.alias || scene.name,
            promptVersions,
          };
        })
      ),
    }))
  );

  return NextResponse.json(projectsWithVersions);
}

export async function POST(request: Request) {
  const { name } = await request.json();
  const now = new Date();
  const project = { id: nanoid(), name, createdAt: now, updatedAt: now };
  await db.insert(projects).values(project);
  return NextResponse.json(project);
}
