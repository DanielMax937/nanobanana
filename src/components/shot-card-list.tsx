"use client";

import { useRouter } from "next/navigation";
import { ShotCard } from "@/components/shot-card";
import { ImageHistory } from "@/components/image-history";

interface Shot {
  id: string;
  shotName: string;
  description: string;
  nanoPrompt: string;
}

interface ActiveImage {
  id: string;
  filePath: string;
  version: number;
}

interface ShotCardListProps {
  shots: Shot[];
  activeImages: Record<string, ActiveImage | null>;
}

export function ShotCardList({ shots, activeImages }: ShotCardListProps) {
  const router = useRouter();

  function handleRefresh() {
    router.refresh();
  }

  if (shots.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        暂无分镜，请在上方输入镜头描述并解析
      </p>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {shots.map((shot) => (
        <div key={shot.id} className="space-y-2">
          <ShotCard
            shot={shot}
            activeImage={activeImages[shot.id]}
            onImageGenerated={handleRefresh}
          />
          <ImageHistory
            shotId={shot.id}
            onVersionChange={handleRefresh}
          />
        </div>
      ))}
    </div>
  );
}
