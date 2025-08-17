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
const jsonEl = $("#json");
const pretty = $("#pretty");
const catPill = $("#catPill");
const confPill = $("#confPill");
const modelPill = $("#modelPill");
const bullets = $("#bullets");
const advice = $("#advice");
const disclaimerTitle = $("#disclaimerTitle");
const disclaimer = $("#disclaimer");
const summary = $("#summary");
const toggleJsonBtn = $("#toggleJson");

let stream = null;
let imageDataURL = null;

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
  // stop stream tracks
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

function buildUserInstruction(mode, hint){
  return `任务：请根据图片进行识别，并给出对应场景的建议。\n模式：${mode}\n用户补充：${hint || "无"}\n输出：必须返回 UTF-8 JSON（不要额外文字）。字段：{
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
  jsonEl.textContent = "";
  try {
    const resp = await fetch("/api/ask", { /* ... */ });
    const data = await resp.json();

    // 渲染卡片
    pretty.classList.remove("hidden");
    catPill.textContent = "分类: " + (data.category || "未知");
    confPill.textContent = "最高置信度: " + ((data.labels?.[0]?.confidence ?? 0)*100).toFixed(1) + "%";
    modelPill.textContent = "模型: " + (data._model || modelSel.value);

    bullets.innerHTML = "";
    (data.labels || []).slice(0,5).forEach(it=>{
      const li = document.createElement("li");
      li.textContent = `${it.name}（置信度 ${(it.confidence*100).toFixed(1)}%）`;
      bullets.appendChild(li);
    });

    summary.textContent = data.summary || "";

    advice.innerHTML = "";
    (data.suggestions || []).forEach(it=>{
      const li = document.createElement("li");
      li.textContent = it;
      advice.appendChild(li);
    });

    disclaimer.textContent = data.disclaimer || "";
    disclaimerTitle.classList.toggle("hidden", !data.disclaimer);

    // JSON 存入但默认隐藏
    jsonEl.textContent = JSON.stringify(data, null, 2);
    jsonEl.classList.add("hidden");

    // 绑定按钮
    toggleJsonBtn.onclick = ()=>{
      jsonEl.classList.toggle("hidden");
      toggleJsonBtn.textContent = jsonEl.classList.contains("hidden") ? "查看原始 JSON" : "隐藏原始 JSON";
    };

    setStatus("完成 ✅");
  } catch(e){
    setStatus("请求失败：" + e.message);
    jsonEl.textContent = "错误：" + e.message;
    jsonEl.classList.remove("hidden");
  }
});
