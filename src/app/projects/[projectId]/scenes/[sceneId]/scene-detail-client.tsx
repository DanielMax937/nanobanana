"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { SceneEditor } from "@/components/scene-editor";
import { ShotCardList } from "@/components/shot-card-list";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

interface SceneDetailClientProps {
  sceneId: string;
  defaultDescription: string;
  shots: Array<{
    id: string;
    shotName: string;
    description: string;
    nanoPrompt: string;
  }>;
  activeImages: Record<string, { id: string; filePath: string; version: number, resolution?: string | null, analysisResult?: string | null } | null>;
  promptVersions: number[];
  currentVersion: number;
}

export function SceneDetailClient({
  sceneId,
  defaultDescription,
  shots,
  activeImages,
  promptVersions,
  currentVersion,
}: SceneDetailClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleParsed() {
    router.refresh();
  }

  function handleVersionChange(version: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("v", String(version));
    router.push(`?${params.toString()}`);
  }

  return (
    <>
      <SceneEditor
        sceneId={sceneId}
        onParsed={handleParsed}
        defaultDescription={defaultDescription}
      />

      {/* Version selector */}
      {promptVersions.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Prompt 版本:</span>
          {promptVersions.map((v) => (
            <Button
              key={v}
              variant={v === currentVersion ? "default" : "outline"}
              size="sm"
              onClick={() => handleVersionChange(v)}
            >
              v{v}
            </Button>
          ))}
        </div>
      )}

      <Separator />
      <ShotCardList shots={shots} activeImages={activeImages} />
    </>
  );
}
