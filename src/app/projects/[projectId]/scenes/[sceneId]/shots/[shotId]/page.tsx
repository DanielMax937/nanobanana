import { db } from "@/db";
import { projects, scenes, shots, images } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { ShotDetailClient } from "./shot-detail-client";

export default async function ShotPage({
  params,
}: {
  params: Promise<{ projectId: string; sceneId: string; shotId: string }>;
}) {
  const { projectId, sceneId, shotId } = await params;

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });
  const scene = await db.query.scenes.findFirst({
    where: eq(scenes.id, sceneId),
  });
  const shot = await db.query.shots.findFirst({
    where: eq(shots.id, shotId),
  });

  if (!project || !scene || !shot) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        分镜不存在
      </div>
    );
  }

  const allImages = await db
    .select()
    .from(images)
    .where(eq(images.shotId, shotId))
    .orderBy(asc(images.version));

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-none p-6 pb-3">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{project.name}</span>
          <span>/</span>
          <span>{scene.name}</span>
          <span>/</span>
          <span className="text-foreground font-medium">{shot.shotName}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <ShotDetailClient
          shot={{
            id: shot.id,
            shotName: shot.shotName,
            description: shot.description,
            nanoPrompt: shot.nanoPrompt,
          }}
          images={allImages.map((img) => ({
            id: img.id,
            filePath: img.filePath,
            prompt: img.prompt,
            editInstruction: img.editInstruction,
            referenceImagePath: img.referenceImagePath,
            version: img.version,
            isActive: img.isActive,
            createdAt: img.createdAt.toISOString(),
          }))}
        />
      </div>
    </div>
  );
}
