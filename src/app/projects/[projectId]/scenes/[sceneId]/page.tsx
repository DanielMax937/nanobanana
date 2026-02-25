import { db } from "@/db";
import { projects, scenes, shots, images } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { SceneDetailClient } from "./scene-detail-client";

export default async function ScenePage({
  params,
}: {
  params: Promise<{ projectId: string; sceneId: string }>;
}) {
  const { projectId, sceneId } = await params;

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });
  const scene = await db.query.scenes.findFirst({
    where: eq(scenes.id, sceneId),
  });

  if (!project || !scene) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        场景不存在
      </div>
    );
  }

  const allShots = await db
    .select()
    .from(shots)
    .where(eq(shots.sceneId, sceneId))
    .orderBy(asc(shots.sortOrder));

  const activeImages: Record<string, { id: string; filePath: string; version: number } | null> = {};
  for (const shot of allShots) {
    const activeImage = await db.query.images.findFirst({
      where: and(eq(images.shotId, shot.id), eq(images.isActive, true)),
    });
    activeImages[shot.id] = activeImage
      ? { id: activeImage.id, filePath: activeImage.filePath, version: activeImage.version }
      : null;
  }

  return (
    <div className="flex flex-col h-full p-6 space-y-6 overflow-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>{project.name}</span>
        <span>/</span>
        <span className="text-foreground font-medium">{scene.name}</span>
      </div>

      {/* Client wrapper for SceneEditor + ShotCardList with refresh support */}
      <SceneDetailClient
        sceneId={sceneId}
        defaultDescription={scene.description || ""}
        shots={allShots.map((s) => ({
          id: s.id,
          shotName: s.shotName,
          description: s.description,
          nanoPrompt: s.nanoPrompt,
        }))}
        activeImages={activeImages}
      />
    </div>
  );
}
