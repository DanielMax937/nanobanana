"use client";

import { useEffect, useState, useCallback } from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ImageVersion {
  id: string;
  shotId: string;
  filePath: string;
  prompt: string;
  editInstruction: string | null;
  version: number;
  isActive: boolean;
  createdAt: string;
}

interface ImageHistoryProps {
  shotId: string;
  onVersionChange?: () => void;
}

export function ImageHistory({ shotId, onVersionChange }: ImageHistoryProps) {
  const [versions, setVersions] = useState<ImageVersion[]>([]);
  const [switching, setSwitching] = useState<string | null>(null);

  const fetchVersions = useCallback(async () => {
    try {
      const res = await fetch(`/api/shots/${shotId}/images`);
      if (!res.ok) throw new Error("Failed to fetch versions");
      const data: ImageVersion[] = await res.json();
      setVersions(data);
    } catch {
      toast.error("加载版本历史失败");
    }
  }, [shotId]);

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  async function handleActivate(imageId: string) {
    setSwitching(imageId);
    try {
      const res = await fetch(`/api/images/${imageId}/activate`, {
        method: "PATCH",
      });
      if (!res.ok) throw new Error("Failed to switch version");
      await fetchVersions();
      onVersionChange?.();
    } catch {
      toast.error("版本切换失败");
    } finally {
      setSwitching(null);
    }
  }

  if (versions.length <= 1) return null;

  return (
    <TooltipProvider>
      <ScrollArea className="w-full">
        <div className="flex gap-2 pb-2">
          {versions.map((img) => (
            <Tooltip key={img.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  disabled={switching !== null}
                  onClick={() => {
                    if (!img.isActive) handleActivate(img.id);
                  }}
                  className={cn(
                    "relative shrink-0 overflow-hidden rounded-md transition-all",
                    "h-20 w-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    img.isActive
                      ? "ring-2 ring-primary"
                      : "ring-1 ring-border hover:ring-primary/50",
                    switching === img.id && "opacity-50"
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.filePath}
                    alt={`v${img.version}`}
                    className="h-full w-full object-cover"
                  />
                  <Badge
                    variant={img.isActive ? "default" : "secondary"}
                    className="absolute bottom-0.5 right-0.5 px-1 py-0 text-[10px] leading-4"
                  >
                    v{img.version}
                  </Badge>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-64">
                <p className="line-clamp-3 text-xs">
                  {img.editInstruction || img.prompt}
                </p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </TooltipProvider>
  );
}
