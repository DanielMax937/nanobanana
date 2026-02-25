"use client";

import { useRouter } from "next/navigation";
import { SceneEditor } from "@/components/scene-editor";
import { ShotCardList } from "@/components/shot-card-list";
import { Separator } from "@/components/ui/separator";

interface SceneDetailClientProps {
  sceneId: string;
  defaultDescription: string;
  shots: Array<{
    id: string;
    shotName: string;
    description: string;
    nanoPrompt: string;
  }>;
  activeImages: Record<string, { id: string; filePath: string; version: number } | null>;
}

export function SceneDetailClient({
  sceneId,
  defaultDescription,
  shots,
  activeImages,
}: SceneDetailClientProps) {
  const router = useRouter();

  function handleParsed() {
    router.refresh();
  }

  return (
    <>
      <SceneEditor
        sceneId={sceneId}
        onParsed={handleParsed}
        defaultDescription={defaultDescription}
      />
      <Separator />
      <ShotCardList shots={shots} activeImages={activeImages} />
    </>
  );
}
