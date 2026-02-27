"use client";

import { useState, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useSettingsStore } from "@/store/settings";
import { ParseLoadingSkeleton } from "@/components/loading-skeleton";
import { cn } from "@/lib/utils";

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

interface AnalysisResult {
  hasIssues: boolean;
  issues: string[];
  suggestions: string[];
  summary: string;
}

interface ShotProgress {
  shotId: string;
  shotName: string;
  status: "pending" | "generating" | "analyzing" | "regenerating" | "done" | "error";
  iteration: number;
  analysis?: AnalysisResult;
  message: string;
}

interface AutoModeProgress {
  type: string;
  shotId?: string;
  shotName?: string;
  iteration?: number;
  message: string;
  analysis?: AnalysisResult;
}

export function SceneEditor({
  sceneId,
  onParsed,
  defaultDescription = "",
}: SceneEditorProps) {
  const [description, setDescription] = useState(defaultDescription);
  const [loading, setLoading] = useState(false);
  const [autoMode, setAutoMode] = useState(false);
  const [shotProgress, setShotProgress] = useState<Map<string, ShotProgress>>(new Map());
  const [currentMessage, setCurrentMessage] = useState<string>("");
  const abortControllerRef = useRef<AbortController | null>(null);
  const { llmApiKey, llmBaseUrl, llmModel, geminiApiKey, geminiBaseUrl, geminiModel, autoModeMaxLoops } = useSettingsStore();

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

      // Trigger sidebar refresh via custom event
      window.dispatchEvent(new CustomEvent("sidebar:refresh"));
      onParsed(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "解析失败";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAutoMode() {
    if (!description.trim()) {
      toast.error("请输入镜头描述");
      return;
    }

    if (!llmApiKey || !geminiApiKey) {
      toast.error("请先在设置中配置 LLM 和 Gemini API Key");
      return;
    }

    setLoading(true);
    setShotProgress(new Map());
    setCurrentMessage("启动自动模式...");
    abortControllerRef.current = new AbortController();

    try {
      const res = await fetch("/api/auto-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneId,
          description,
          llmApiKey,
          llmBaseUrl,
          llmModel,
          geminiApiKey,
          geminiBaseUrl,
          geminiModel,
          maxLoops: autoModeMaxLoops,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Auto mode failed");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const progress: AutoModeProgress = JSON.parse(line.slice(6));
              setCurrentMessage(progress.message);

              if (progress.shotId && progress.shotName) {
                setShotProgress((prev) => {
                  const next = new Map(prev);
                  const existing = next.get(progress.shotId!) || {
                    shotId: progress.shotId!,
                    shotName: progress.shotName!,
                    status: "pending",
                    iteration: 0,
                    message: "",
                  };

                  let status: ShotProgress["status"] = "pending";
                  switch (progress.type) {
                    case "generate":
                      status = "generating";
                      break;
                    case "analyze":
                      status = "analyzing";
                      break;
                    case "regenerate":
                      status = "regenerating";
                      break;
                    case "done":
                      status = "done";
                      break;
                    case "error":
                      status = "error";
                      break;
                  }

                  next.set(progress.shotId!, {
                    ...existing,
                    status,
                    iteration: progress.iteration || existing.iteration,
                    analysis: progress.analysis || existing.analysis,
                    message: progress.message,
                  });
                  return next;
                });
              }

              if (progress.type === "done" && !progress.shotId) {
                toast.success(progress.message);
                // Trigger sidebar refresh via custom event
                window.dispatchEvent(new CustomEvent("sidebar:refresh"));
                onParsed([]);
              } else if (progress.type === "error") {
                toast.error(progress.message);
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        toast.info("已取消");
      } else {
        const message = err instanceof Error ? err.message : "自动模式失败";
        toast.error(message);
      }
    } finally {
      setLoading(false);
      setCurrentMessage("");
      abortControllerRef.current = null;
    }
  }

  function handleCancel() {
    abortControllerRef.current?.abort();
  }

  const shotProgressArray = Array.from(shotProgress.values());

  return (
    <div className="space-y-4">
      <Textarea
        placeholder="输入镜头描述，例如：一个女孩在雨中奔跑，镜头从远景拉到近景，最后定格在她的笑脸上..."
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        disabled={loading}
        className="min-h-32 resize-y"
      />

      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Button onClick={handleParse} disabled={loading} variant="outline">
            {loading && !autoMode && <Loader2 className="animate-spin" />}
            {loading ? "解析中..." : "解析为分镜 Prompt"}
          </Button>

          <div className="flex items-center gap-2">
            <Checkbox
              id="auto-mode"
              checked={autoMode}
              onCheckedChange={(checked) => setAutoMode(checked as boolean)}
              disabled={loading}
            />
            <Label htmlFor="auto-mode" className="text-sm cursor-pointer">
              自动模式
            </Label>
          </div>
        </div>

        {autoMode && (
          <Button onClick={handleAutoMode} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="animate-spin" />
                处理中...
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                开始自动生成
              </>
            )}
          </Button>
        )}

        {loading && autoMode && (
          <Button variant="ghost" size="sm" onClick={handleCancel}>
            取消
          </Button>
        )}
      </div>

      {loading && !autoMode && <ParseLoadingSkeleton />}

      {/* Auto mode progress panel */}
      {autoMode && shotProgressArray.length > 0 && (
        <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
          <div className="flex items-center gap-2 text-sm font-medium">
            {loading && <Loader2 className="size-4 animate-spin" />}
            <span>{currentMessage}</span>
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto">
            {shotProgressArray.map((shot) => (
              <div
                key={shot.shotId}
                className="border rounded-md p-3 bg-background space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {shot.status === "done" && !shot.analysis?.hasIssues ? (
                      <CheckCircle2 className="size-4 text-green-500" />
                    ) : shot.status === "error" ? (
                      <XCircle className="size-4 text-destructive" />
                    ) : shot.status === "generating" || shot.status === "analyzing" || shot.status === "regenerating" ? (
                      <Loader2 className="size-4 animate-spin text-primary" />
                    ) : shot.analysis?.hasIssues ? (
                      <AlertCircle className="size-4 text-yellow-500" />
                    ) : (
                      <div className="size-4 rounded-full border-2 border-muted-foreground" />
                    )}
                    <span className="font-medium text-sm">{shot.shotName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {shot.iteration > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-muted">
                        v{shot.iteration}
                      </span>
                    )}
                    <span className={cn(
                      "px-1.5 py-0.5 rounded",
                      shot.status === "done" && "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
                      shot.status === "error" && "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
                      (shot.status === "generating" || shot.status === "analyzing" || shot.status === "regenerating") && "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
                    )}>
                      {shot.status === "generating" && "生成中"}
                      {shot.status === "analyzing" && "分析中"}
                      {shot.status === "regenerating" && "重新生成"}
                      {shot.status === "done" && "完成"}
                      {shot.status === "error" && "错误"}
                      {shot.status === "pending" && "等待中"}
                    </span>
                  </div>
                </div>

                {shot.analysis && (
                  <div className="text-xs space-y-1 pl-6">
                    <p className="text-muted-foreground">{shot.analysis.summary}</p>
                    {shot.analysis.issues.length > 0 && (
                      <div className="space-y-0.5">
                        <span className="text-yellow-600 dark:text-yellow-400">问题:</span>
                        <ul className="list-disc list-inside text-muted-foreground">
                          {shot.analysis.issues.map((issue, i) => (
                            <li key={i}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {shot.analysis.suggestions.length > 0 && (
                      <div className="space-y-0.5">
                        <span className="text-blue-600 dark:text-blue-400">建议:</span>
                        <ul className="list-disc list-inside text-muted-foreground">
                          {shot.analysis.suggestions.slice(0, 3).map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
