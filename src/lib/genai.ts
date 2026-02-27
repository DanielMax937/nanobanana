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

function extractText(response: any): string {
  if (!response.candidates || response.candidates.length === 0) {
    throw new Error("Gemini 未返回任何结果（无 candidates）");
  }

  const candidate = response.candidates[0];
  if (!candidate.content || !candidate.content.parts) {
    if (candidate.finishReason && candidate.finishReason !== "STOP") {
      throw new Error(`Gemini 请求被拒绝: ${candidate.finishReason}`);
    }
    throw new Error("Gemini 返回格式异常：缺少 content.parts");
  }

  for (const part of candidate.content.parts) {
    if (part.text) return part.text;
  }

  throw new Error("Gemini 未返回文本内容");
}

// Resolution to pixel size mapping
const RESOLUTION_MAP: Record<string, { width: number; height: number }> = {
  "512px": { width: 512, height: 512 },
  "1K": { width: 1024, height: 1024 },
  "2K": { width: 2048, height: 2048 },
  "4K": { width: 4096, height: 4096 },
};

export async function generateImage(
  prompt: string,
  apiKey: string,
  model: string = "gemini-3-pro-image-preview",
  baseUrl?: string,
  resolution: string = "1K"
): Promise<{ imageBase64: string; mimeType: string; text?: string }> {
  if (!apiKey) throw new Error("Gemini API Key 未配置");

  const ai = new GoogleGenAI({
    apiKey,
    ...(baseUrl ? { httpOptions: { baseUrl } } : {}),
  });

  const dimensions = RESOLUTION_MAP[resolution] || RESOLUTION_MAP["1K"];

  let response: any;
  try {
    response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseModalities: ["TEXT", "IMAGE"],
        imageGenerationConfig: {
          width: dimensions.width,
          height: dimensions.height,
        },
      } as any,
    });
  } catch (err) {
    console.error("[GenAI] generateContent error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Gemini API 调用失败: ${msg}`);
  }

  return extractImage(response);
}

export async function annotationEditImage(
  annotatedImageBase64: string,
  annotatedImageMimeType: string,
  apiKey: string,
  model: string = "gemini-3-pro-image-preview",
  baseUrl?: string,
  resolution?: string
): Promise<{ imageBase64: string; mimeType: string; text?: string }> {
  if (!apiKey) throw new Error("Gemini API Key 未配置");

  const ai = new GoogleGenAI({
    apiKey,
    ...(baseUrl ? { httpOptions: { baseUrl } } : {}),
  });

  const prompt = resolution === "4K"
    ? `Upscale this image to 4K resolution (4096x4096) while preserving all details and quality. Enhance clarity and sharpness.`
    : `This image has hand-drawn annotations (circles, arrows, text labels in red) indicating desired edits.
Interpret each annotation and apply the requested changes to produce a clean final image WITHOUT any annotations.
Remove all red markings, circles, arrows, and text labels from the output.`;

  console.log("[GenAI annotationEditImage] model:", model);
  console.log("[GenAI annotationEditImage] baseUrl:", baseUrl || "(default)");
  console.log("[GenAI annotationEditImage] resolution:", resolution || "default");

  const config: any = {
    responseModalities: ["TEXT", "IMAGE"],
  };

  if (resolution === "4K") {
    config.imageGenerationConfig = {
      width: 4096,
      height: 4096,
    };
  }

  let response: any;
  try {
    response = await ai.models.generateContent({
      model,
      contents: [
        { text: prompt },
        { inlineData: { mimeType: annotatedImageMimeType, data: annotatedImageBase64 } },
      ],
      config,
    });
  } catch (err) {
    console.error("[GenAI] annotationEditImage error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Gemini 标注编辑 API 调用失败: ${msg}`);
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

export interface ImageAnalysisResult {
  hasIssues: boolean;
  issues: string[];
  suggestions: string[];
  summary: string;
}

export async function analyzeImage(
  imageBase64: string,
  imageMimeType: string,
  shotDescription: string,
  sceneContext: string,
  apiKey: string,
  model: string = "gemini-2.5-flash",
  baseUrl?: string
): Promise<ImageAnalysisResult> {
  if (!apiKey) throw new Error("Gemini API Key 未配置");

  const ai = new GoogleGenAI({
    apiKey,
    ...(baseUrl ? { httpOptions: { baseUrl } } : {}),
  });

  const prompt = `You are an expert image analyst for film storyboard validation.

Scene Context:
${sceneContext}

Shot Description (what this image should depict):
${shotDescription}

Analyze the provided image and determine if it correctly represents the shot description within the scene context.

Check for:
1. Does the image match the shot description?
2. Are there any missing elements mentioned in the description?
3. Are there any unwanted elements that shouldn't be there?
4. Is the composition, lighting, and mood appropriate?
5. Are there any visual artifacts or quality issues?

Respond in JSON format:
{
  "hasIssues": true/false,
  "issues": ["list of specific issues found"],
  "suggestions": ["specific suggestions for how to fix each issue"],
  "summary": "brief overall assessment"
}

If the image is good and matches the description well, set hasIssues to false and provide an empty issues array.`;

  console.log("[GenAI analyzeImage] model:", model);
  console.log("[GenAI analyzeImage] baseUrl:", baseUrl || "(default)");

  let response: any;
  try {
    response = await ai.models.generateContent({
      model,
      contents: [
        { text: prompt },
        { inlineData: { mimeType: imageMimeType, data: imageBase64 } },
      ],
      config: {
        responseModalities: ["TEXT"],
      },
    });
  } catch (err) {
    console.error("[GenAI] analyzeImage error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Gemini 分析 API 调用失败: ${msg}`);
  }

  const textResponse = extractText(response);
  console.log("[GenAI analyzeImage] response:", textResponse.slice(0, 500));

  try {
    // Try to parse JSON from the response
    const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (parseErr) {
    console.error("[GenAI] Failed to parse analysis JSON:", parseErr);
  }

  // Fallback: treat as issues if we can't parse
  return {
    hasIssues: true,
    issues: ["Unable to parse analysis response"],
    suggestions: ["Please try again"],
    summary: textResponse.slice(0, 200),
  };
}
