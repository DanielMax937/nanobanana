"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Loader2, Upload, Pen } from "lucide-react";
import { useSettingsStore } from "@/store/settings";
import { toast } from "sonner";
import { ImageAnnotator } from "@/components/image-annotator";
import { ImagePreview } from "@/components/image-preview";

interface ShotDetailClientProps {
  shot: {
    id: string;
    shotName: string;
    description: string;
    nanoPrompt: string;
  };
  images: Array<{
    id: string;
    filePath: string;
    prompt: string;
    editInstruction: string | null;
    referenceImagePath: string | null;
    version: number;
    isActive: boolean;
    createdAt: string;
  }>;
}

export function ShotDetailClient({ shot, images }: ShotDetailClientProps) {
  const router = useRouter();
  const [selectedVersion, setSelectedVersion] = useState<number>(
    images.find((img) => img.isActive)?.version || images[images.length - 1]?.version || 1
  );
  const [editInstruction, setEditInstruction] = useState("");
  const [editing, setEditing] = useState(false);
  const [refFile, setRefFile] = useState<File | null>(null);
  const [annotatorOpen, setAnnotatorOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { geminiApiKey, geminiBaseUrl, geminiModel } = useSettingsStore();

  const selectedImage = images.find((img) => img.version === selectedVersion);
  const activeImage = images.find((img) => img.isActive);

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
          geminiBaseUrl,
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
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "编辑失败";
      toast.error(message);
    } finally {
      setEditing(false);
    }
  }

  async function handleAnnotationEdit(annotatedBase64: string) {
    if (!geminiApiKey) {
      toast.warning("请先在设置中配置 Gemini API Key");
      return;
    }

    setAnnotatorOpen(false);
    setEditing(true);
    try {
      const res = await fetch("/api/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shotId: shot.id,
          editInstruction: "标注修改",
          annotatedImageBase64: annotatedBase64,
          geminiApiKey,
          geminiBaseUrl,
          geminiModel,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "标注编辑失败");
      }

      toast.success("标注编辑成功");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "标注编辑失败";
      toast.error(message);
    } finally {
      setEditing(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Shot Info */}
      <Card>
        <CardHeader>
          <CardTitle>{shot.shotName}</CardTitle>
          {shot.description && <CardDescription>{shot.description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="text-sm font-medium">Nano Prompt:</div>
            <div className="text-sm text-muted-foreground font-mono bg-muted p-3 rounded-md">
              {shot.nanoPrompt || "暂无 prompt"}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Version History */}
      {images.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>版本历史</CardTitle>
            <CardDescription>共 {images.length} 个版本</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Version selector */}
            <div className="flex flex-wrap gap-2">
              {images.map((img) => (
                <Button
                  key={img.id}
                  variant={selectedVersion === img.version ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedVersion(img.version)}
                  className="relative"
                >
                  v{img.version}
                  {img.isActive && (
                    <CheckCircle2 className="ml-1 h-3 w-3 text-green-500" />
                  )}
                </Button>
              ))}
            </div>

            {/* Selected version details */}
            {selectedImage && (
              <Tabs defaultValue="image" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="image">生成图片</TabsTrigger>
                  <TabsTrigger value="prompt">Prompt</TabsTrigger>
                  <TabsTrigger value="reference">参考图片</TabsTrigger>
                </TabsList>

                <TabsContent value="image" className="space-y-3">
                  <div className="relative max-w-md mx-auto">
                    {editing && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/60">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    )}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedImage.filePath}
                      alt={`Version ${selectedImage.version}`}
                      className="w-full rounded-lg border cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => setPreviewOpen(true)}
                    />
                    <Badge className="absolute top-2 right-2">
                      v{selectedImage.version}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground text-center">
                    创建时间: {new Date(selectedImage.createdAt).toLocaleString("zh-CN")}
                  </div>

                  {/* Edit section - only show if this is the active version */}
                  {selectedImage.isActive && (
                    <div className="space-y-3 rounded-lg border p-3 mt-4">
                      <div className="text-sm font-medium">编辑图片</div>
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
                        disabled={editing}
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
                          disabled={editing || !refFile}
                        >
                          {editing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          <Upload className="mr-2 h-4 w-4" />
                          垫图修改
                        </Button>
                      </div>

                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setAnnotatorOpen(true)}
                        disabled={editing}
                      >
                        <Pen className="mr-2 h-4 w-4" />
                        标注修改
                      </Button>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="prompt" className="space-y-3">
                  <div className="space-y-2">
                    <div className="text-sm font-medium">生成 Prompt:</div>
                    <div className="text-sm text-muted-foreground font-mono bg-muted p-3 rounded-md whitespace-pre-wrap">
                      {selectedImage.prompt}
                    </div>
                  </div>
                  {selectedImage.editInstruction && (
                    <div className="space-y-2">
                      <div className="text-sm font-medium">编辑指令:</div>
                      <div className="text-sm text-muted-foreground font-mono bg-muted p-3 rounded-md whitespace-pre-wrap">
                        {selectedImage.editInstruction}
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="reference" className="space-y-3">
                  {selectedImage.referenceImagePath ? (
                    <div className="text-sm text-muted-foreground">
                      参考图片: {selectedImage.referenceImagePath}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      此版本无参考图片
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            暂无生成的图片
          </CardContent>
        </Card>
      )}

      {activeImage && (
        <ImageAnnotator
          imageSrc={activeImage.filePath}
          open={annotatorOpen}
          onConfirm={handleAnnotationEdit}
          onCancel={() => setAnnotatorOpen(false)}
        />
      )}

      {selectedImage && (
        <ImagePreview
          src={selectedImage.filePath}
          open={previewOpen}
          onOpenChange={setPreviewOpen}
        />
      )}
    </div>
  );
}
