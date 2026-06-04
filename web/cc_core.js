import {
  createId, cloneFiles, nowIso,
  inferManualModelSettings, normalizeImageApiFormatValue, normalizeImageInterfaceMode, normalizeModelCategory
} from "./cc_utils.js";

export const EXT_NAME = "Nkxx.CometChatPlugin";
export const STYLE_ID = "nkxx-comet-chat-style";
export const WORKSPACE_ID = "nkxx-comet-chat-workspace";
export const GLOBAL_LAUNCHER_ID = "nkxx-comet-chat-launcher";
export const GLOBAL_LAUNCHER_POS_KEY = "nkxx_comet_chat_launcher_pos_v1";
export const PANEL_POS_KEY = "nkxx_comet_chat_panel_pos_v1";
export const GLOBAL_PLUGIN_ID = "__nkxx_global_plugin__";
export const GLOBAL_PLUGIN_STATE_KEY = "nkxx_comet_chat_plugin_state_v1";
export const GLOBAL_PLUGIN_CONFIG_KEY = "nkxx_comet_chat_plugin_config_v7";

export const DEFAULT_CHAT_CONFIG = {
  activeChannelId: "default_1",
  activeModelId: "m_1",
  channels: [
    {
      id: "default_1",
      name: "默认渠道",
      api_url: "https://api.openai.com",
      api_key: "",
      enabled: true,
      models: [
        { id: "m_1", name: "", override_api_key: "", api_format: "openai", category: "llm" }
      ]
    }
  ],
  presets: [],
  hiddenCometApiChannelIds: [],
  selection_assistant: {
    enabled: false,
    channel_id: "",
    model_id: "",
  },
  system_prompt: "You are a helpful assistant.",
};

export function safeReadJsonStorage(key, fallback) {
  try {
    const raw = window.localStorage?.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch (_) {
    return fallback;
  }
}

export function safeWriteJsonStorage(key, value) {
  try {
    window.localStorage?.setItem(key, JSON.stringify(value));
  } catch (_) {
  }
}

export function normalizePluginConfig(rawConfig) {
  const source = rawConfig && typeof rawConfig === "object" ? rawConfig : {};
  let channels = Array.isArray(source.channels) ? source.channels : [DEFAULT_CHAT_CONFIG.channels[0]];
  if (channels.length === 0) channels = [DEFAULT_CHAT_CONFIG.channels[0]];
  
  const normalizedChannels = channels.map((c, index) => {
    const rawId = String(c.id || "");
    const isCometApiManaged = rawId.startsWith("cometapi_");
    let models = Array.isArray(c.models) ? c.models : [];
    if (models.length === 0 && c.model) {
        const inferred = inferManualModelSettings(c.model, { api_format: c.api_format });
        models = [{
          id: createId("m"),
          name: c.model,
          override_api_key: "",
          api_format: inferred.api_format,
          category: inferred.category,
          interface_mode: inferred.interface_mode,
        }];
    } else if (models.length === 0 && !isCometApiManaged) {
        models = [{ id: createId("m"), name: "", override_api_key: "", api_format: "openai", category: "llm" }];
    } else {
        models = models.map(m => ({
            ...m,
            // 允许自定义预设ID，不强制转为 openai/claude/gemini
            api_format: String(m.api_format || c.api_format || "openai")
        }));
    }
    
    let enabled = c.enabled;
    if (enabled === undefined) enabled = index < 3;
    
    return {
      id: String(c.id || createId("ch")),
      name: String(c.name || "未命名渠道"),
      api_url: String(c.api_url || "https://api.openai.com"),
      api_key: String(c.api_key || ""),
      enabled: !!enabled,
      models: models.map(m => {
          const category = normalizeModelCategory(m.category, m.api_format, m.name);
          const apiFormat = category === "image"
            ? normalizeImageApiFormatValue(m.api_format, m.name)
            : String(m.api_format || "openai");
          return {
            id: String(m.id || createId("m")),
            name: String(m.name || ""),
            override_api_key: String(m.override_api_key || ""),
            api_format: apiFormat,
            category,
            interface_mode: category === "image" ? normalizeImageInterfaceMode(m.interface_mode, apiFormat) : "",
          };
      })
    };
  });

  let presets = Array.isArray(source.presets) ? source.presets : [];
  const normalizedPresets = presets.map(p => ({
    id: String(p.id || createId("preset")),
    name: String(p.name || "自定义预设"),
    url_template: String(p.url_template || "{api_url}"),
    headers_template: typeof p.headers_template === 'object' && p.headers_template ? p.headers_template : {},
    upload_step: typeof p.upload_step === 'object' && p.upload_step ? p.upload_step : { enabled: false },
    body_template: typeof p.body_template === 'object' && p.body_template ? p.body_template : {},
    message_mapping: typeof p.message_mapping === 'object' && p.message_mapping ? p.message_mapping : {},
    attachment_mapping: typeof p.attachment_mapping === 'object' && p.attachment_mapping ? p.attachment_mapping : {},
    stream_parser: typeof p.stream_parser === 'object' && p.stream_parser ? p.stream_parser : {}
  }));

  let activeChannelId = String(source.activeChannelId || normalizedChannels[0].id);
  let activeChannel = normalizedChannels.find(c => c.id === activeChannelId);
  if (!activeChannel) {
      activeChannel = normalizedChannels[0];
      activeChannelId = activeChannel.id;
  }
  if (activeChannel && !activeChannel.enabled) {
      const firstEnabled = normalizedChannels.find(c => c.enabled);
      if (firstEnabled) {
          activeChannel = firstEnabled;
          activeChannelId = firstEnabled.id;
      }
  }

  let activeModelId = String(source.activeModelId || activeChannel.models[0]?.id || "");
  if (!activeChannel.models.find(m => m.id === activeModelId)) {
      activeModelId = activeChannel.models[0]?.id || "";
  }

  const findTextModelRef = (channelId = "", modelId = "") => {
    const channelsToScan = channelId
      ? normalizedChannels.filter((channel) => channel.id === channelId)
      : normalizedChannels;
    for (const channel of channelsToScan) {
      if (!channel.enabled) continue;
      const textModels = (channel.models || []).filter((model) => model.category === "llm");
      if (!textModels.length) continue;
      if (modelId) {
        const matched = textModels.find((model) => model.id === modelId);
        if (matched) return { channelId: channel.id, modelId: matched.id };
      } else {
        return { channelId: channel.id, modelId: textModels[0].id };
      }
    }
    return null;
  };

  const rawSelectionAssistant = source.selection_assistant && typeof source.selection_assistant === "object"
    ? source.selection_assistant
    : {};
  const selectionRef = findTextModelRef(
    String(rawSelectionAssistant.channel_id || ""),
    String(rawSelectionAssistant.model_id || "")
  ) || findTextModelRef(activeChannelId, activeModelId) || findTextModelRef();

  return {
    activeChannelId: activeChannelId,
    activeModelId: activeModelId,
    channels: normalizedChannels,
    presets: normalizedPresets,
    hiddenCometApiChannelIds: Array.isArray(source.hiddenCometApiChannelIds)
      ? Array.from(new Set(source.hiddenCometApiChannelIds.map((id) => String(id || "")).filter(Boolean)))
      : [],
    selection_assistant: {
      enabled: rawSelectionAssistant.enabled === true,
      channel_id: selectionRef?.channelId || "",
      model_id: selectionRef?.modelId || "",
    },
    system_prompt: String(source.system_prompt ?? DEFAULT_CHAT_CONFIG.system_prompt),
    temperature: 0.7,
    max_tokens: 20000,
  };
}

export function normalizeMessage(message = {}) {
  const kind = message.kind === "display-only" || message.kind === "synthetic"
    ? message.kind
    : "record";
  const tone = message.tone === "error" ? "error" : "";
  return {
    id: String(message.id || createId("msg")),
    role: message.role === "user" ? "user" : "assistant",
    label: String(message.label || ""),
    text: String(message.text || ""),
    files: cloneFiles(message.files || []),
    tone,
    kind,
    includeInContext: message.includeInContext !== false && tone !== "error" && kind === "record",
    createdAt: String(message.createdAt || nowIso()),
    streaming: !!message.streaming,
  };
}

export function createSession(index = 1) {
  return {
    id: createId("session"),
    title: index === 1 ? "当前对话" : `新对话 ${index}`,
    autoTitle: true,
    pinned: false,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    draft: "",
    pendingFiles: [],
    messages: [],
  };
}

export function normalizeSession(session = {}, index = 1) {
  return {
    id: String(session.id || createId("session")),
    title: String(session.title || (index === 1 ? "当前对话" : `新对话 ${index}`)),
    autoTitle: session.autoTitle !== false,
    pinned: !!session.pinned,
    createdAt: String(session.createdAt || nowIso()),
    updatedAt: String(session.updatedAt || session.createdAt || nowIso()),
    draft: String(session.draft || ""),
    pendingFiles: cloneFiles(session.pendingFiles || []),
    messages: Array.isArray(session.messages) ? session.messages.map((message) => normalizeMessage(message)) : [],
  };
}

export function normalizeWorkspaceState(rawState) {
  const source = rawState && typeof rawState === "object" ? rawState : {};
  const sessions = Array.isArray(source.sessions) ? source.sessions.map((session, index) => normalizeSession(session, index + 1)) : [];
  if (!sessions.length) sessions.push(createSession(1));

  const sessionMap = new Map(sessions.map((session) => [session.id, session]));
  const currentSessionId = sessionMap.has(source.currentSessionId) ? String(source.currentSessionId) : sessions[0].id;

  return {
    currentSessionId,
    sidebarOpen: source.sidebarOpen === true,
    sessions,
  };
}

export function getMissingConfigMessage(plugin) {
  const config = plugin.getConfigValues();
  const activeChannel = config.channels.find(c => c.id === config.activeChannelId);
  const activeModel = activeChannel?.models?.find(m => m.id === config.activeModelId) || activeChannel?.models?.[0];
  const missing = [];
  
  if (!activeChannel) return "当前没有可用的渠道，请在设置中添加并启用。";
  if (!activeModel) return "当前渠道没有可用的模型，请在设置中添加。";
  
  // 预设模式可能不需要 API URL，但为了通用默认检查
  if (!String(activeChannel.api_url || "").trim()) missing.push("API URL");
  
  const finalApiKey = String(activeModel.override_api_key || "").trim() || String(activeChannel.api_key || "").trim();
  if (!finalApiKey) missing.push("API Key (模型独立或渠道通用)");
  
  if (!String(activeModel.name || "").trim()) missing.push("模型名称");
  
  return missing.length ? `请先在设置中配置：${missing.join("、")}。` : "";
}

