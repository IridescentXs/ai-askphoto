// /api/ask.js - Vercel Serverless Function
export const config = {
  runtime: "edge" // fast cold starts
};

function isBase64DataUrl(url) {
  return /^data:image\/(png|jpe?g|webp);base64,/.test(url || "");
}

function sanitizeKey(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  // basic sanity check
  if (!s.startsWith("sk-") || s.length < 20) return null;
  return s;
}

const SYS_PROMPT = `你是一名图像识别与生活助手。你将收到一张用户拍摄的图片（可能是食材、电路板、植物或穿搭），请：
- 先判断所属场景（ingredient/pcb/plant/outfit，若不确定用auto）。
- 给出 1~5 个可能标签（name+confidence）。
- 结合场景，输出实用建议：
  - 食材：判断新鲜度/可食性；给2~3个菜谱（含核心做法或技巧）；过敏与食安提醒。
  - 电路板：指出可疑焊点/连线/元件；提供测量步骤与安全注意；必要时建议断电排查。
  - 植物：推测品种/症状；提供养护要点（土壤、光照、水分、施肥）；提醒仅供参考。
  - 穿搭：识别单品风格/色系/场合；给替换或配色建议（含鞋/包/外套）。
- 严禁输出与图片无关或不安全的具体操作指导（如危险拆解），以“安全优先”的姿态提醒用户。

必须输出 UTF-8 JSON，字段：
{
  "category": "auto|ingredient|pcb|plant|outfit",
  "labels": [{"name": "string", "confidence": 0~1}],
  "summary": "中文 <=120字",
  "suggestions": ["要点1","要点2","要点3"],
  "disclaimer": "必要提醒"
}`;

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  let body;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const { image, mode = "auto", model = "gpt-4.1-mini", hint = "" } = body || {};
  if (!isBase64DataUrl(image)) {
    return new Response("image 必须是 data:image/*;base64, 开头的 Data URL", { status: 400 });
  }

  // Key precedence: header override > env
  const headerKey = sanitizeKey(req.headers.get("x-openai-key"));
  const apiKey = headerKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response("未配置 OPENAI_API_KEY，且未提供自定义 Key。", { status: 401 });
  }

  // Compose messages for Chat Completions with vision
  const userText = `模式: ${mode}\n用户补充: ${hint || "无"}\n请严格按系统要求输出 JSON。`;
  const payload = {
    model,
    response_format: { type: "json_object" }, // 尝试强制 JSON
    temperature: 0.2,
    messages: [
      { role: "system", content: SYS_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: userText },
          { type: "image_url", image_url: { url: image } }
        ]
      }
    ]
  };

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!r.ok) {
      const errText = await r.text().catch(()=>"");
      return new Response(errText || `Upstream ${r.status}`, { status: r.status });
    }
    const data = await r.json();

    const text = data?.choices?.[0]?.message?.content || "";
    // Try parse JSON; if failed, wrap as text
    let out;
    try {
      out = JSON.parse(text);
    } catch {
      out = { raw: text };
    }
    // attach model used for UI
    out._model = model;

    return new Response(JSON.stringify(out), {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  } catch (e) {
    return new Response("调用 OpenAI 失败: " + (e?.message || e), { status: 500 });
  }
}
