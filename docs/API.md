# Nanobanana API 文档

**Base URL**: `http://127.0.0.1:8500`

**端口**: 8500

---

## 健康检查

### GET /api/health

服务健康检查。

**Response**: `200 OK`

```json
{
  "status": "ok",
  "service": "nanobanana"
}
```

---

## 项目管理

### GET /api/projects

获取所有项目（含场景、分镜、版本结构）。

**Response**: `200 OK`

```json
[
  {
    "id": "string",
    "name": "string",
    "alias": "string | null",
    "displayName": "string",
    "createdAt": "string",
    "updatedAt": "string",
    "scenes": [
      {
        "id": "string",
        "name": "string",
        "alias": "string | null",
        "displayName": "string",
        "description": "string | null",
        "promptVersions": [
          {
            "version": "number",
            "shots": [
              {
                "id": "string",
                "shotName": "string",
                "alias": "string | null",
                "displayName": "string",
                "sortOrder": "number"
              }
            ]
          }
        ]
      }
    ]
  }
]
```

### POST /api/projects

创建项目。

**Request Body**:
```json
{
  "name": "string"
}
```

**Response**: `200 OK`

```json
{
  "id": "string",
  "name": "string",
  "createdAt": "string",
  "updatedAt": "string"
}
```

### DELETE /api/projects/[projectId]

删除项目。

**Response**: `200 OK`

```json
{
  "success": true
}
```

---

## 场景管理

### GET /api/projects/[projectId]/scenes

获取项目下所有场景。

**Response**: `200 OK`

```json
[
  {
    "id": "string",
    "projectId": "string",
    "name": "string",
    "sortOrder": "number",
    "createdAt": "string",
    "updatedAt": "string"
  }
]
```

### POST /api/projects/[projectId]/scenes

创建场景。

**Request Body**:
```json
{
  "name": "string"
}
```

**Response**: `200 OK`

```json
{
  "id": "string",
  "projectId": "string",
  "name": "string",
  "sortOrder": "number",
  "createdAt": "string",
  "updatedAt": "string"
}
```

### DELETE /api/projects/[projectId]/scenes/[sceneId]

删除场景。

**Response**: `200 OK`

```json
{
  "success": true
}
```

---

## 分镜管理

### POST /api/projects/[projectId]/scenes/[sceneId]/shots

手动创建分镜。

**Request Body**:
```json
{
  "shotName": "string",
  "description": "string (optional)",
  "nanoPrompt": "string (optional)"
}
```

**Response**: `200 OK`

```json
{
  "id": "string",
  "sceneId": "string",
  "shotName": "string",
  "description": "string",
  "nanoPrompt": "string",
  "sortOrder": "number",
  "createdAt": "string"
}
```

### DELETE /api/shots/[shotId]

删除分镜。

**Response**: `200 OK`

```json
{
  "success": true
}
```

### DELETE /api/projects/[projectId]/scenes/[sceneId]/versions/[version]

删除场景下指定 prompt 版本的所有分镜。

**Response**: `200 OK`

```json
{
  "success": true
}
```

---

## 重命名

### PATCH /api/rename

更新项目、场景或分镜的别名（alias）。

**Request Body**:
```json
{
  "type": "project" | "scene" | "shot",
  "id": "string",
  "alias": "string | null"
}
```

**Response**: `200 OK`

```json
{
  "success": true
}
```

---

## 图片生成与编辑

### POST /api/generate

根据 prompt 生成图片（使用 Gemini）。

**Request Body**:
```json
{
  "prompt": "string",
  "shotId": "string",
  "geminiApiKey": "string",
  "geminiBaseUrl": "string (optional)",
  "geminiModel": "string (optional)",
  "resolution": "1K" | "4K (optional, default: 1K)"
}
```

**Response**: `200 OK`

```json
{
  "id": "string",
  "shotId": "string",
  "filePath": "data:image/...;base64,...",
  "prompt": "string",
  "resolution": "string",
  "version": "number",
  "isActive": true,
  "createdAt": "string"
}
```

### POST /api/edit

编辑当前激活图片（文字指令或标注图）。

**Request Body**:
```json
{
  "shotId": "string",
  "editInstruction": "string (optional, 文字编辑指令)",
  "referenceImageBase64": "string (optional)",
  "referenceImageMimeType": "string (optional)",
  "annotatedImageBase64": "string (optional, 标注图 base64)",
  "geminiApiKey": "string",
  "geminiBaseUrl": "string (optional)",
  "geminiModel": "string (optional)"
}
```

**Response**: `200 OK`

```json
{
  "id": "string",
  "shotId": "string",
  "filePath": "data:image/...;base64,...",
  "prompt": "string",
  "editInstruction": "string",
  "version": "number",
  "isActive": true,
  "createdAt": "string"
}
```

### POST /api/upscale

将当前激活图片高清化至 4K。

**Request Body**:
```json
{
  "shotId": "string",
  "geminiApiKey": "string",
  "geminiBaseUrl": "string (optional)",
  "geminiModel": "string (optional)"
}
```

**Response**: `200 OK`

```json
{
  "id": "string",
  "shotId": "string",
  "filePath": "data:image/...;base64,...",
  "prompt": "string",
  "resolution": "4K",
  "version": "number",
  "isActive": true,
  "createdAt": "string"
}
```

---

## 图片历史与激活

### GET /api/shots/[shotId]/images

获取分镜下所有图片版本（按 version 升序）。

**Response**: `200 OK`

```json
[
  {
    "id": "string",
    "shotId": "string",
    "filePath": "string",
    "prompt": "string",
    "version": "number",
    "isActive": "boolean",
    "createdAt": "string"
  }
]
```

### PATCH /api/images/[imageId]/activate

将指定图片设为该分镜的激活图片。

**Response**: `200 OK`

```json
{
  "success": true
}
```

---

## LLM 与自动化

### POST /api/llm/parse

使用 LLM 解析场景描述，自动生成分镜列表。

**Request Body**:
```json
{
  "description": "string",
  "sceneId": "string",
  "llmApiKey": "string",
  "llmBaseUrl": "string (optional)",
  "llmModel": "string (optional)"
}
```

**Response**: `200 OK`

```json
[
  {
    "id": "string",
    "sceneId": "string",
    "shotName": "string",
    "description": "string",
    "nanoPrompt": "string",
    "promptVersion": "number",
    "sortOrder": "number",
    "createdAt": "string"
  }
]
```

### POST /api/auto-mode

自动模式：解析场景 → 生成分镜 → 逐 shot 生成图片 → 分析质量 → 必要时重生成（SSE 流式进度）。

**Request Body**:
```json
{
  "sceneId": "string",
  "description": "string",
  "llmApiKey": "string",
  "llmBaseUrl": "string (optional)",
  "llmModel": "string (optional)",
  "geminiApiKey": "string",
  "geminiBaseUrl": "string (optional)",
  "geminiModel": "string (optional)",
  "maxLoops": "number (optional, default: 5)"
}
```

**Response**: `200 OK` — `Content-Type: text/event-stream`

SSE 事件格式：
```
data: {"type":"parse"|"generate"|"analyze"|"regenerate"|"done"|"error","shotId":"string","shotName":"string","iteration":number,"message":"string","analysis":{...}}
```

---

## 错误响应

所有接口在出错时返回：

```json
{
  "error": "string"
}
```

HTTP 状态码：`400`（参数错误）、`404`（资源不存在）、`500`（服务器错误）。
