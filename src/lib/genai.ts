import { GoogleGenAI } from "@google/genai";

export async function generateImage(
  prompt: string,
  apiKey: string,
  model: string = "gemini-3-pro-image-preview"
): Promise<{ imageBase64: string; mimeType: string; text?: string }> {
  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseModalities: ["TEXT", "IMAGE"],
    },
  });

  for (const part of response.candidates![0].content!.parts!) {
    if (part.inlineData) {
      return {
        imageBase64: part.inlineData.data!,
        mimeType: part.inlineData.mimeType!,
        text: response.candidates![0].content!.parts!.find((p: any) => p.text)?.text,
      };
    }
  }
  throw new Error("No image generated");
}

export async function editImage(
  prompt: string,
  referenceImageBase64: string,
  referenceImageMimeType: string,
  apiKey: string,
  model: string = "gemini-3-pro-image-preview"
): Promise<{ imageBase64: string; mimeType: string; text?: string }> {
  const ai = new GoogleGenAI({ apiKey });

  const contents = [
    { text: prompt },
    { inlineData: { mimeType: referenceImageMimeType, data: referenceImageBase64 } },
  ];

  const response = await ai.models.generateContent({
    model,
    contents,
    config: {
      responseModalities: ["TEXT", "IMAGE"],
    },
  });

  for (const part of response.candidates![0].content!.parts!) {
    if (part.inlineData) {
      return {
        imageBase64: part.inlineData.data!,
        mimeType: part.inlineData.mimeType!,
        text: response.candidates![0].content!.parts!.find((p: any) => p.text)?.text,
      };
    }
  }
  throw new Error("No image generated");
}
