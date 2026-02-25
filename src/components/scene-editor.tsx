"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useSettingsStore } from "@/store/settings";
import { ParseLoadingSkeleton } from "@/components/loading-skeleton";

interface SceneEditorProps {
  sceneId: string;
  onParsed: (shots: Array<{
    id: string;
    sceneId: string;
    shotName: string;
    description: string;
    nanoPrompt: string;
    sortOrder: number;
    createdAt: string;
  }>) => void;
  defaultDescription?: string;
}

export function SceneEditor({
  sceneId,
  onParsed,
  defaultDescription = "",
}: SceneEditorProps) {
  const [description, setDescription] = useState(defaultDescription);
  const [loading, setLoading] = useState(false);
  const { llmApiKey, llmBaseUrl, llmModel } = useSettingsStore();

  async function handleParse() {
    if (!description.trim()) {
      toast.error("请输入镜头描述");
      return;
    }

    if (!llmApiKey) {
      toast.error("请先在设置中配置 LLM API Key");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/llm/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          sceneId,
          llmApiKey,
          llmBaseUrl,
          llmModel,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "解析失败");
      }

      onParsed(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "解析失败";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Textarea
        placeholder="输入镜头描述，例如：一个女孩在雨中奔跑，镜头从远景拉到近景，最后定格在她的笑脸上..."
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        disabled={loading}
        className="min-h-32 resize-y"
      />
      <Button onClick={handleParse} disabled={loading}>
        {loading && <Loader2 className="animate-spin" />}
        {loading ? "解析中..." : "解析为分镜 Prompt"}
      </Button>
      {loading && <ParseLoadingSkeleton />}
    </div>
  );
}
