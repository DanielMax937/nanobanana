import { GoogleGenAI } from "@google/genai";

function extractImage(response: any): { imageBase64: string; mimeType: string; text?: string } {
  if (!response.candidates || response.candidates.length === 0) {
    console.error("[GenAI] No candidates in response:", JSON.stringify(response, null, 2).slice(0, 500));
    throw new Error("Gemini 未返回任何结果（无 candidates）");
  }

  const candidate = response.candidates[0];
  if (!candidate.content || !candidate.content.parts) {
    console.error("[GenAI] No content/parts:", JSON.stringify(candidate, null, 2).slice(0, 500));
    // Check for safety/block reasons
    if (candidate.finishReason && candidate.finishReason !== "STOP") {
      throw new Error(`Gemini 请求被拒绝: ${candidate.finishReason}`);
    }
    throw new Error("Gemini 返回格式异常：缺少 content.parts");
  }

  let textContent: string | undefined;
  for (const part of candidate.content.parts) {
    if (part.text) textContent = part.text;
    if (part.inlineData) {
      return {
        imageBase64: part.inlineData.data,
        mimeType: part.inlineData.mimeType,
        text: textContent,
      };
    }
  }

  console.error("[GenAI] No inlineData in parts:", JSON.stringify(candidate.content.parts.map((p: any) => Object.keys(p)), null, 2));
  throw new Error("Gemini 未生成图片（响应中无 inlineData）");
}

export async function generateImage(
  prompt: string,
  apiKey: string,
  model: string = "gemini-3-pro-image-preview",
  baseUrl?: string
): Promise<{ imageBase64: string; mimeType: string; text?: string }> {
  if (!apiKey) throw new Error("Gemini API Key 未配置");

  const ai = new GoogleGenAI({
    apiKey,
    ...(baseUrl ? { httpOptions: { baseUrl } } : {}),
  });

  let response: any;
  try {
    response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    });
  } catch (err) {
    console.error("[GenAI] generateContent error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Gemini API 调用失败: ${msg}`);
  }

  return extractImage(response);
}

export async function editImage(
  prompt: string,
  originalImageBase64: string,
  originalImageMimeType: string,
  apiKey: string,
  model: string = "gemini-3-pro-image-preview",
  baseUrl?: string,
  referenceImageBase64?: string,
  referenceImageMimeType?: string
): Promise<{ imageBase64: string; mimeType: string; text?: string }> {
  if (!apiKey) throw new Error("Gemini API Key 未配置");

  const ai = new GoogleGenAI({
    apiKey,
    ...(baseUrl ? { httpOptions: { baseUrl } } : {}),
  });

  let editPrompt: string;
  const contentParts: any[] = [];

  if (referenceImageBase64 && referenceImageMimeType) {
    // 垫图修改: original image + reference image + instruction
    editPrompt = `Edit the first image according to this instruction: ${prompt}. The second image is provided as a reference only — extract relevant elements (such as a person's appearance, face, or features) from it and apply them to the first image. Do NOT replace the entire scene with the reference image. Keep the original image's composition, background, lighting, and layout intact.`;
    contentParts.push(
      { text: editPrompt },
      { inlineData: { mimeType: originalImageMimeType, data: originalImageBase64 } },
      { inlineData: { mimeType: referenceImageMimeType, data: referenceImageBase64 } },
    );
  } else {
    // 文本修改: original image + text instruction only
    editPrompt = prompt;
    contentParts.push(
      { text: editPrompt },
      { inlineData: { mimeType: originalImageMimeType, data: originalImageBase64 } },
    );
  }

  console.log("[GenAI editImage] prompt:", editPrompt);
  console.log("[GenAI editImage] model:", model);
  console.log("[GenAI editImage] baseUrl:", baseUrl || "(default)");
  console.log("[GenAI editImage] hasReferenceImage:", !!referenceImageBase64);

  let response: any;
  try {
    response = await ai.models.generateContent({
      model,
      contents: contentParts,
      config: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    });
  } catch (err) {
    console.error("[GenAI] editImage error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Gemini 编辑 API 调用失败: ${msg}`);
  }

  return extractImage(response);
}
