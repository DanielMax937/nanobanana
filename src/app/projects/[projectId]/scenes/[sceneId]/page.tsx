import { db } from "@/db";
import { projects, scenes, shots, images } from "@/db/schema";
import { eq, and, asc, desc } from "drizzle-orm";
import { SceneDetailClient } from "./scene-detail-client";

export default async function ScenePage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; sceneId: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const { projectId, sceneId } = await params;
  const { v } = await searchParams;
  const selectedVersion = v ? parseInt(v, 10) : undefined;

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

  // Get all prompt versions for this scene
  const versionRows = await db
    .selectDistinct({ version: shots.promptVersion })
    .from(shots)
    .where(eq(shots.sceneId, sceneId))
    .orderBy(desc(shots.promptVersion));
  const promptVersions = versionRows.map((r) => r.version);

  // Get latest version if none selected
  const currentVersion = selectedVersion || promptVersions[0] || 1;

  // Get shots for the selected version
  const versionShots = await db
    .select()
    .from(shots)
    .where(and(eq(shots.sceneId, sceneId), eq(shots.promptVersion, currentVersion)))
    .orderBy(asc(shots.sortOrder));

  const activeImages: Record<string, { id: string; filePath: string; version: number, resolution?: string | null, analysisResult?: string | null } | null> = {};
  for (const shot of versionShots) {
    const activeImage = await db.query.images.findFirst({
      where: and(eq(images.shotId, shot.id), eq(images.isActive, true)),
    });
    activeImages[shot.id] = activeImage
      ? { id: activeImage.id, filePath: activeImage.filePath, version: activeImage.version, resolution: activeImage.resolution, analysisResult: activeImage.analysisResult }
      : null;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-none p-6 pb-3">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{project.name}</span>
          <span>/</span>
          <span className="text-foreground font-medium">{scene.name}</span>
        </div>
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="space-y-6">
          {/* Client wrapper for SceneEditor + ShotCardList with refresh support */}
          <SceneDetailClient
            sceneId={sceneId}
            defaultDescription={scene.description || ""}
            shots={versionShots.map((s) => ({
              id: s.id,
              shotName: s.shotName,
              description: s.description,
              nanoPrompt: s.nanoPrompt,
            }))}
            activeImages={activeImages}
            promptVersions={promptVersions}
            currentVersion={currentVersion}
          />
        </div>
      </div>
    </div>
  );
}
