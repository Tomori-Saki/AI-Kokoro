const avatarInput = document.getElementById("avatarInput");
const avatarPreview = document.getElementById("avatarPreview");
const live2dInput = document.getElementById("live2dInput");
const live2dName = document.getElementById("live2dName");
const sendBtn = document.getElementById("sendBtn");
const chatInput = document.getElementById("chatInput");
const chatList = document.getElementById("chatList");
const saveSettings = document.getElementById("saveSettings");
const apiKeyInput = document.getElementById("apiKey");
const apiUrlInput = document.getElementById("apiUrl");

let characterProfile = null;
let exampleData = null;
let chatHistory = [];

const formatTime = () => {
  const now = new Date();
  return now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
};

const ensureChatAreaActive = () => {
  const empty = chatList.querySelector(".empty-state");
  if (empty) empty.remove();
};

const createBubble = (text, type) => {
  const bubble = document.createElement("div");
  bubble.className = `bubble ${type}`;

  const p = document.createElement("p");
  p.textContent = text;

  const meta = document.createElement("span");
  meta.className = "meta";
  meta.textContent = `${type === "user" ? "你" : "AI"} · ${formatTime()}`;

  bubble.appendChild(p);
  bubble.appendChild(meta);
  chatList.appendChild(bubble);
  chatList.scrollTop = chatList.scrollHeight;

  return { bubble, p };
};

const appendMessage = (text, type) => {
  return createBubble(text, type);
};

const appendSystemNotice = (text) => {
  const { bubble, p } = createBubble(text, "ai");
  bubble.style.borderStyle = "dashed";
  p.style.opacity = "0.8";
};

const normalizeBaseUrl = (url) => {
  if (!url) return "https://api.deepseek.com";
  return url.replace(/\/$/, "");
};

const buildPersonaMessages = () => {
  if (!characterProfile || !exampleData) return [];

  const systemPrompt = `你是一个人格化的 AI 助手，请严格遵循角色设定与对话风格。\n\n角色设定(JSON)：${JSON.stringify(
    characterProfile
  )}\n\n对话风格示例(JSON)：${JSON.stringify(exampleData)}`;

  const messages = [{ role: "system", content: systemPrompt }];

  if (Array.isArray(exampleData.dialogues)) {
    exampleData.dialogues.forEach((pair) => {
      if (pair.user) {
        messages.push({ role: "user", content: pair.user });
      }
      if (pair.assistant) {
        messages.push({ role: "assistant", content: pair.assistant });
      }
    });
  }

  return messages;
};

const loadPersona = async () => {
  try {
    const [charRes, exampleRes] = await Promise.all([
      fetch("character.json"),
      fetch("example.json"),
    ]);

    if (!charRes.ok || !exampleRes.ok) {
      throw new Error("无法读取角色模板文件");
    }

    characterProfile = await charRes.json();
    exampleData = await exampleRes.json();
    chatHistory = buildPersonaMessages();
  } catch (err) {
    characterProfile = null;
    exampleData = null;
    chatHistory = [];
    appendSystemNotice("角色模板读取失败，请使用本地服务器打开页面。");
  }
};

const streamChat = async (text) => {
  const apiKey = apiKeyInput.value.trim();
  const apiUrl = normalizeBaseUrl(apiUrlInput.value.trim());

  if (!apiKey) {
    appendSystemNotice("请先在左侧输入 API Key。");
    return;
  }

  ensureChatAreaActive();

  appendMessage(text, "user");
  chatHistory.push({ role: "user", content: text });

  const { p: aiTextEl } = appendMessage("", "ai");

  sendBtn.disabled = true;
  chatInput.disabled = true;

  try {
    const response = await fetch(`${apiUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: chatHistory,
        stream: true,
      }),
    });

    if (!response.ok || !response.body) {
      const errorText = await response.text();
      throw new Error(errorText || `请求失败：${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let assistantText = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) continue;

        const payload = trimmed.replace(/^data:\s*/, "");
        if (payload === "[DONE]") {
          buffer = "";
          break;
        }

        try {
          const data = JSON.parse(payload);
          const delta =
            data.choices?.[0]?.delta?.content ??
            data.choices?.[0]?.message?.content ??
            "";

          if (delta) {
            assistantText += delta;
            aiTextEl.textContent = assistantText;
            chatList.scrollTop = chatList.scrollHeight;
          }
        } catch (err) {
          // Ignore JSON parse errors from incomplete lines.
        }
      }
    }

    if (!assistantText) {
      assistantText = "（未收到有效回复）";
      aiTextEl.textContent = assistantText;
    }

    chatHistory.push({ role: "assistant", content: assistantText });
  } catch (err) {
    aiTextEl.textContent = "请求失败，请检查 API Key 或网络。";
  } finally {
    sendBtn.disabled = false;
    chatInput.disabled = false;
    chatInput.focus();
  }
};

avatarInput.addEventListener("change", (event) => {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    avatarPreview.src = reader.result;
  };
  reader.readAsDataURL(file);
});

live2dInput.addEventListener("change", (event) => {
  const file = event.target.files && event.target.files[0];
  live2dName.textContent = file ? file.name : "未选择文件";
});

sendBtn.addEventListener("click", () => {
  const text = chatInput.value.trim();
  if (!text) return;
  chatInput.value = "";
  streamChat(text);
});

chatInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendBtn.click();
  }
});

saveSettings.addEventListener("click", () => {
  appendSystemNotice("设置已保存（前端示意）。");
});

loadPersona();
