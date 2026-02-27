export async function parseShotDescription(
  description: string,
  config: { apiKey: string; baseUrl: string; model: string }
): Promise<
  Array<{ shotName: string; description: string; nanoPrompt: string }>
> {
  if (!config.apiKey) {
    throw new Error("LLM API Key 未配置");
  }
  if (!config.baseUrl) {
    throw new Error("LLM Base URL 未配置");
  }
  if (!config.model) {
    throw new Error("LLM Model 未配置");
  }

  const systemPrompt = `你是一个专业的电影分镜师和AI生图提示词专家。请根据用户提供的镜头描述，将其拆解为按时间或逻辑顺序排列的分镜列表。每个分镜需要提供一个专为图像生成模型优化的英文 Prompt。输出格式必须为 JSON 数组，每个对象包含 shotName (分镜名称), description (画面动作描述), nanoPrompt (用于生图的英文提示词)。只输出 JSON，不要其他内容。`;

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: description },
        ],
        temperature: 0.7,
      }),
    });
  } catch (fetchError) {
    throw new Error(
      `网络请求失败: ${fetchError instanceof Error ? fetchError.message : "未知错误"}`
    );
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[LLM API Error]", response.status, errorText);
    throw new Error(`LLM API 错误 (${response.status}): ${errorText.slice(0, 200)}`);
  }

  let data: {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const responseText = await response.text();
  console.log("[LLM Raw Response]", responseText.slice(0, 500));
  try {
    data = JSON.parse(responseText);
  } catch (parseError) {
    throw new Error(
      `LLM API 返回无效 JSON。原始响应: ${responseText.slice(0, 300)}`
    );
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    console.error("[LLM Response]", JSON.stringify(data, null, 2));
    throw new Error("LLM 返回格式异常：缺少 choices[0].message.content");
  }

  // Clean up markdown code blocks if present
  const cleanedContent = content.replace(/```json\n?|\n?```/g, "").trim();

  try {
    return JSON.parse(cleanedContent);
  } catch (parseError) {
    console.error("[JSON Parse Error] Content:", cleanedContent.slice(0, 500));
    throw new Error(
      `LLM 返回内容无法解析为 JSON: ${cleanedContent.slice(0, 100)}...`
    );
  }
}
