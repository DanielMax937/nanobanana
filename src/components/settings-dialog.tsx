"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useSettingsStore } from "@/store/settings";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const settings = useSettingsStore();

  const [llmApiKey, setLlmApiKey] = useState(settings.llmApiKey);
  const [llmBaseUrl, setLlmBaseUrl] = useState(settings.llmBaseUrl);
  const [llmModel, setLlmModel] = useState(settings.llmModel);
  const [geminiApiKey, setGeminiApiKey] = useState(settings.geminiApiKey);
  const [geminiModel, setGeminiModel] = useState(settings.geminiModel);

  useEffect(() => {
    if (open) {
      setLlmApiKey(settings.llmApiKey);
      setLlmBaseUrl(settings.llmBaseUrl);
      setLlmModel(settings.llmModel);
      setGeminiApiKey(settings.geminiApiKey);
      setGeminiModel(settings.geminiModel);
    }
  }, [open, settings.llmApiKey, settings.llmBaseUrl, settings.llmModel, settings.geminiApiKey, settings.geminiModel]);

  function handleSave() {
    settings.updateSettings({
      llmApiKey,
      llmBaseUrl,
      llmModel,
      geminiApiKey,
      geminiModel,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure API keys and model settings.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="llm">
          <TabsList className="w-full">
            <TabsTrigger value="llm">LLM 配置</TabsTrigger>
            <TabsTrigger value="gemini">Gemini 图片生成配置</TabsTrigger>
          </TabsList>

          <TabsContent value="llm" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="llm-api-key">API Key</Label>
              <Input
                id="llm-api-key"
                type="password"
                placeholder="sk-..."
                value={llmApiKey}
                onChange={(e) => setLlmApiKey(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="llm-base-url">Base URL</Label>
              <Input
                id="llm-base-url"
                placeholder="https://api.openai.com/v1"
                value={llmBaseUrl}
                onChange={(e) => setLlmBaseUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="llm-model">Model</Label>
              <Input
                id="llm-model"
                placeholder="gpt-4o"
                value={llmModel}
                onChange={(e) => setLlmModel(e.target.value)}
              />
            </div>
          </TabsContent>

          <TabsContent value="gemini" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="gemini-api-key">API Key</Label>
              <Input
                id="gemini-api-key"
                type="password"
                placeholder="AIza..."
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gemini-model">Model</Label>
              <Input
                id="gemini-model"
                placeholder="gemini-3-pro-image-preview"
                value={geminiModel}
                onChange={(e) => setGeminiModel(e.target.value)}
              />
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end">
          <Button onClick={handleSave}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
