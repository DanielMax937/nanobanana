import { create } from "zustand";
import { persist } from "zustand/middleware";

interface Settings {
  llmApiKey: string;
  llmBaseUrl: string;
  llmModel: string;
  geminiApiKey: string;
  geminiBaseUrl: string;
  geminiModel: string;
}

interface SettingsStore extends Settings {
  updateSettings: (partial: Partial<Settings>) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      llmApiKey: "",
      llmBaseUrl: "https://api.openai.com/v1",
      llmModel: "gpt-4o",
      geminiApiKey: "",
      geminiBaseUrl: "",
      geminiModel: "gemini-3-pro-image-preview",
      updateSettings: (partial) => set(partial),
    }),
    { name: "nano-settings" }
  )
);
