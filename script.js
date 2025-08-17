const $ = (s)=>document.querySelector(s);
const fileInput = $("#file");
const openCameraBtn = $("#openCamera");
const video = $("#video");
const cameraCanvas = $("#camera");
const previewWrap = $("#previewWrap");
const previewImg = $("#preview");
const retakeBtn = $("#retake");
const modeSel = $("#mode");
const modelSel = $("#model");
const hintTxt = $("#hint");
const userKey = $("#userKey");
const goBtn = $("#go");
const statusEl = $("#status");
const jsonEl = $("#json"); // hidden by default
const pretty = $("#pretty");
const catPill = $("#catPill");
const confPill = $("#confPill");
const modelPill = $("#modelPill");
const bullets = $("#bullets");
const advice = $("#advice");
const disclaimerTitle = $("#disclaimerTitle");
const disclaimer = $("#disclaimer");
const summaryEl = $("#summary");

const viewJsonBtn = $("#viewJsonBtn");
const jsonModal = $("#jsonModal");
const jsonModalContent = $("#jsonModalContent");
const closeJsonModal = $("#closeJsonModal");
const closeJsonBottom = $("#closeJsonBottom");
const downloadJsonBtn = $("#downloadJson");

let stream = null;
let imageDataURL = null;
let lastRawJson = null;

function setStatus(t){ statusEl.textContent = t || ""; }

async function startCamera(){
  try{
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
    video.srcObject = stream;
    video.classList.remove("hidden");
    cameraCanvas.classList.add("hidden");
    previewWrap.classList.add("hidden");
    setStatus("摄像头已打开，点击视频画面拍照。");
  }catch(e){
    setStatus("无法访问摄像头：" + e.message);
  }
}

openCameraBtn.addEventListener("click", startCamera);

video.addEventListener("click", ()=>{
  const w = video.videoWidth;
  const h = video.videoHeight;
  cameraCanvas.width = w; cameraCanvas.height = h;
  cameraCanvas.getContext("2d").drawImage(video, 0, 0, w, h);
  imageDataURL = cameraCanvas.toDataURL("image/jpeg", 0.92);
  previewImg.src = imageDataURL;
  previewWrap.classList.remove("hidden");
  video.classList.add("hidden");
  if(stream){ stream.getTracks().forEach(t=>t.stop()); stream=null; }
  setStatus("已拍照，可开始识别。");
});

retakeBtn.addEventListener("click", ()=>{
  imageDataURL=null;
  previewWrap.classList.add("hidden");
  startCamera();
});

fileInput.addEventListener("change", ()=>{
  const file = fileInput.files?.[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    imageDataURL = reader.result;
    previewImg.src = imageDataURL;
    previewWrap.classList.remove("hidden");
    setStatus("已选择图片，可开始识别。");
  };
  reader.readAsDataURL(file);
});

// JSON Modal controls
function openJsonModal(content) {
  jsonModalContent.textContent = content;
  jsonModal.classList.remove("hidden");
  jsonModal.setAttribute("aria-hidden", "false");
}
function closeModal() {
  jsonModal.classList.add("hidden");
  jsonModal.setAttribute("aria-hidden", "true");
}
viewJsonBtn.addEventListener("click", ()=> {
  if(lastRawJson) openJsonModal(JSON.stringify(lastRawJson, null, 2));
});
closeJsonModal.addEventListener("click", closeModal);
closeJsonBottom.addEventListener("click", closeModal);
downloadJsonBtn.addEventListener("click", ()=>{
  if(!lastRawJson) return;
  const blob = new Blob([JSON.stringify(lastRawJson, null, 2)], {type: "application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "result.json";
  a.click();
  URL.revokeObjectURL(url);
});

// close modal on escape
document.addEventListener("keydown", (e)=>{ if(e.key === "Escape") closeModal(); });

function buildUserInstruction(mode, hint){
  return `任务：请根据图片进行识别，并给出对应场景的建议。\\n模式：${mode}\\n用户补充：${hint || "无"}\\n输出：必须返回 UTF-8 JSON（不要额外文字）。字段：{
    "category": "auto|ingredient|pcb|plant|outfit",
    "labels": [{"name": "string", "confidence": 0~1}],
    "summary": "核心识别要点（中文，<= 120字）",
    "suggestions": ["要点1","要点2","要点3"],
    "disclaimer": "必要的提醒或建议（例如食材过敏、电气安全、请勿仅凭照片诊断植物病害等）"
  }`;
}

goBtn.addEventListener("click", async ()=>{
  if(!imageDataURL){
    setStatus("请先拍照或选择图片。");
    return;
  }
  const payload = {
    image: imageDataURL,
    mode: modeSel.value,
    model: modelSel.value,
    hint: hintTxt.value
  };
  setStatus("识别中…");
  pretty.classList.add("hidden");
  jsonEl.classList.add("hidden");
  jsonEl.textContent = "";
  lastRawJson = null;

  try{
    const resp = await fetch("/api/ask", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(userKey.value ? {"x-openai-key": userKey.value.trim() } : {})
      },
      body: JSON.stringify(payload)
    });
    if(!resp.ok){
      const msg = await resp.text();
      throw new Error(msg || ("HTTP " + resp.status));
    }
    const data = await resp.json();
    // keep raw for modal/download
    lastRawJson = data;

    // Try to get fields safely
    const category = data.category || data?.raw?.category || "未知";
    const labels = Array.isArray(data.labels) ? data.labels : (Array.isArray(data?.raw?.labels) ? data.raw.labels : []);
    const summary = data.summary || data?.raw?.summary || (typeof data.raw === "string" ? data.raw.slice(0,300) : "");
    const suggestions = Array.isArray(data.suggestions) ? data.suggestions : (Array.isArray(data?.raw?.suggestions) ? data.raw.suggestions : []);
    const disc = data.disclaimer || data?.raw?.disclaimer || "";

    // Render pretty
    pretty.classList.remove("hidden");
    catPill.textContent = "分类: " + category;
    confPill.textContent = labels.length>0 ? "最高置信度: " + (Math.max(...labels.map(l=>l.confidence||0))*100).toFixed(1) + "%" : "置信度: -";
    modelPill.textContent = "模型: " + (data._model || modelSel.value);

    bullets.innerHTML = "";
    (labels || []).slice(0,5).forEach(it=>{
      const li = document.createElement("li");
      li.textContent = `${it.name}（置信度 ${( (it.confidence||0)*100).toFixed(1)}%）`;
      bullets.appendChild(li);
    });
    if((labels || []).length === 0){
      const li = document.createElement("li");
      li.textContent = "未识别到明确标签。";
      bullets.appendChild(li);
    }

    summaryEl.textContent = summary || "无摘要信息。";

    advice.innerHTML = "";
    (suggestions || []).forEach(it=>{
      const li = document.createElement("li");
      li.textContent = it;
      advice.appendChild(li);
    });
    if((suggestions || []).length === 0){
      const li = document.createElement("li");
      li.textContent = "无具体建议。";
      advice.appendChild(li);
    }

    disclaimer.textContent = disc || "";
    disclaimerTitle.classList.toggle("hidden", !disc);

    // store raw JSON in hidden pre too (for progressive enhancement)
    jsonEl.textContent = JSON.stringify(data, null, 2);
    jsonEl.classList.add("hidden");

    setStatus("完成 ✅");
  }catch(e){
    setStatus("请求失败：" + e.message);
    lastRawJson = { error: e.message || String(e) };
    // show modal with error JSON for debugging if user wants
    openJsonModal(JSON.stringify(lastRawJson, null, 2));
  }
});
