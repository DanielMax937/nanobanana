export async function parseShotDescription(
  description: string,
  config: { apiKey: string; baseUrl: string; model: string }
): Promise<
  Array<{ shotName: string; description: string; nanoPrompt: string }>
> {
  const systemPrompt = `你是一个专业的电影分镜师和AI生图提示词专家。请根据用户提供的镜头描述，将其拆解为按时间或逻辑顺序排列的分镜列表。每个分镜需要提供一个专为图像生成模型优化的英文 Prompt。输出格式必须为 JSON 数组，每个对象包含 shotName (分镜名称), description (画面动作描述), nanoPrompt (用于生图的英文提示词)。只输出 JSON，不要其他内容。`;

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
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

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LLM API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  return JSON.parse(content.replace(/```json\n?|\n?```/g, "").trim());
}
