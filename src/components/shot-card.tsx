"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useSettingsStore } from "@/store/settings";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface ShotCardProps {
  shot: {
    id: string;
    shotName: string;
    description: string;
    nanoPrompt: string;
  };
  activeImage?: {
    id: string;
    filePath: string;
    version: number;
  } | null;
  onImageGenerated?: () => void;
}

export function ShotCard({ shot, activeImage, onImageGenerated }: ShotCardProps) {
  const [prompt, setPrompt] = useState(shot.nanoPrompt);
  const [loading, setLoading] = useState(false);
  const { geminiApiKey, geminiModel } = useSettingsStore();

  async function handleGenerate() {
    if (!geminiApiKey) {
      toast.warning("请先在设置中配置 Gemini API Key");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          shotId: shot.id,
          geminiApiKey,
          geminiModel,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "生成失败");
      }

      toast.success("图片生成成功");
      onImageGenerated?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "生成失败";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{shot.shotName}</CardTitle>
        <CardDescription>{shot.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          className="font-mono text-sm"
          placeholder="Nano prompt..."
        />
        <Button onClick={handleGenerate} disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          生成图片
        </Button>

        {loading && !activeImage && (
          <Skeleton className="aspect-video w-full rounded-lg" />
        )}

        {activeImage && (
          <div className="relative">
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/60">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeImage.filePath}
              alt={shot.shotName}
              className="w-full rounded-lg"
            />
            <span className="absolute bottom-2 right-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">
              v{activeImage.version}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
