"use client";

import { useState, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useSettingsStore } from "@/store/settings";
import { toast } from "sonner";
import { Loader2, ChevronDown, ChevronUp, Upload } from "lucide-react";

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
  const [editOpen, setEditOpen] = useState(false);
  const [editInstruction, setEditInstruction] = useState("");
  const [editing, setEditing] = useState(false);
  const [refFile, setRefFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  async function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(",")[1];
        resolve({ base64, mimeType: file.type });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleEdit(withRefImage: boolean) {
    if (!geminiApiKey) {
      toast.warning("请先在设置中配置 Gemini API Key");
      return;
    }
    if (!editInstruction.trim()) {
      toast.warning("请输入编辑指令");
      return;
    }
    if (withRefImage && !refFile) {
      toast.warning("请先上传参考图片");
      return;
    }

    setEditing(true);
    try {
      let referenceImageBase64: string | undefined;
      let referenceImageMimeType: string | undefined;

      if (withRefImage && refFile) {
        const { base64, mimeType } = await fileToBase64(refFile);
        referenceImageBase64 = base64;
        referenceImageMimeType = mimeType;
      }

      const res = await fetch("/api/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shotId: shot.id,
          editInstruction: editInstruction.trim(),
          referenceImageBase64,
          referenceImageMimeType,
          geminiApiKey,
          geminiModel,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "编辑失败");
      }

      toast.success("图片编辑成功");
      setEditInstruction("");
      setRefFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      onImageGenerated?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "编辑失败";
      toast.error(message);
    } finally {
      setEditing(false);
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
        <Button onClick={handleGenerate} disabled={loading || editing}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          生成图片
        </Button>

        {loading && !activeImage && (
          <Skeleton className="aspect-video w-full rounded-lg" />
        )}

        {activeImage && (
          <div className="relative">
            {(loading || editing) && (
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

        {activeImage && (
          <div className="space-y-3">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setEditOpen(!editOpen)}
            >
              {editOpen ? (
                <ChevronUp className="mr-2 h-4 w-4" />
              ) : (
                <ChevronDown className="mr-2 h-4 w-4" />
              )}
              编辑
            </Button>

            {editOpen && (
              <div className="space-y-3 rounded-lg border p-3">
                <Textarea
                  value={editInstruction}
                  onChange={(e) => setEditInstruction(e.target.value)}
                  rows={2}
                  placeholder="编辑指令，例如：把背景的散景效果去掉"
                  className="text-sm"
                />
                <Button
                  size="sm"
                  onClick={() => handleEdit(false)}
                  disabled={editing || loading}
                >
                  {editing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  文本修改
                </Button>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="text-sm"
                      onChange={(e) => setRefFile(e.target.files?.[0] || null)}
                    />
                  </div>
                  {refFile && (
                    <p className="text-xs text-muted-foreground">
                      已选择: {refFile.name}
                    </p>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleEdit(true)}
                    disabled={editing || loading || !refFile}
                  >
                    {editing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Upload className="mr-2 h-4 w-4" />
                    垫图修改
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
