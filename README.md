# 📷 拍照问TA（Vercel 可部署）

用手机或电脑摄像头拍照，识别 **食材 / 电路板 / 植物 / 穿搭**，并给出对应建议（菜谱、焊点排查、养护、搭配等）。

- 使用 **OpenAI 官方 API**（默认模型 `gpt-4.1-mini`，可选 `gpt-4o-mini` 等）。
- 支持从前端传入 **自定义 API Key**，否则使用服务端环境变量 `OPENAI_API_KEY`。
- 前端纯静态（`index.html` + `style.css` + `script.js`），后端为 Vercel Serverless Function：`/api/ask`。

> 接口使用 **Chat Completions** 的多模态输入（`image_url`）来分析图片并输出 JSON。

## 一键部署

1. Fork/下载本仓库。
2. 在 Vercel 新建项目，导入该目录。
3. 在 **Project Settings → Environment Variables** 增加：
   - `OPENAI_API_KEY` = 你的 Key
4. 部署。部署完成后直接访问站点即可。

> 也可本地预览：任意静态服务器（或 `npx serve`）即可，接口走 `/api/ask`。

## 目录结构

```
.
├── api
│   └── ask.js        # Vercel Serverless：调用 OpenAI Chat Completions（多模态）
├── index.html        # UI：选择/拍照 → 配置 → 结果
├── script.js         # 前端逻辑：摄像头、数据URL、调用 /api/ask
├── style.css         # 样式
└── vercel.json       # Edge Runtime 配置
```

## 自定义说明

- **模式**：自动 / 食材 / PCB / 植物 / 穿搭；仅作为提示引导模型。
- **结构化输出**：服务端使用 `response_format: { type: "json_object" }` 要求返回 JSON，前端会解析并渲染；若解析失败，会显示原始文本。

## 参考

- OpenAI API 参考与模型：
  - API 总览与参考：https://platform.openai.com/docs/api-reference
  - Chat Completions（多模态）：https://platform.openai.com/docs/api-reference/chat/create
  - 模型 gpt-4.1-mini：https://platform.openai.com/docs/models/gpt-4.1-mini
- Vercel Functions（Node / Edge）：https://vercel.com/docs/functions
