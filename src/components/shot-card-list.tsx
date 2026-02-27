"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShotCard } from "@/components/shot-card";
import { ImageHistory } from "@/components/image-history";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";

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
  resolution?: string | null;
  analysisResult?: string | null;
}

interface ShotCardListProps {
  shots: Shot[];
  activeImages: Record<string, ActiveImage | null>;
}

export function ShotCardList({ shots, activeImages }: ShotCardListProps) {
  const router = useRouter();
  const [openShots, setOpenShots] = useState<Set<string>>(
    new Set(shots.map((s) => s.id))
  );

  function handleRefresh() {
    router.refresh();
  }

  function toggleShot(shotId: string) {
    setOpenShots((prev) => {
      const next = new Set(prev);
      if (next.has(shotId)) {
        next.delete(shotId);
      } else {
        next.add(shotId);
      }
      return next;
    });
  }

  if (shots.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        暂无分镜，请在上方输入镜头描述并解析
      </p>
    );
  }

  return (
    <div className="space-y-4 min-w-0">
      {shots.map((shot) => {
        const isOpen = openShots.has(shot.id);
        return (
          <Collapsible key={shot.id} open={isOpen} onOpenChange={() => toggleShot(shot.id)}>
            <div className="border rounded-lg overflow-hidden">
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-between p-4 h-auto hover:bg-accent"
                >
                  <div className="flex flex-col items-start gap-1 min-w-0">
                    <span className="font-semibold truncate">{shot.shotName}</span>
                    {shot.description && (
                      <span className="text-sm text-muted-foreground truncate max-w-full">
                        {shot.description}
                      </span>
                    )}
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="p-4 pt-0 space-y-4">
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
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
      })}
    </div>
  );
}
