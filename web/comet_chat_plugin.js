import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { injectStyles } from "./cc_styles.js";
import {
  cloneFiles, nowIso, summarizeText, getAttachmentSupportError, copyTextToClipboard, cloneFileRecord, isTextFile,
  isImageGenerationModel, getPreviewUrl, createId
} from "./cc_utils.js";
import {
  EXT_NAME, GLOBAL_PLUGIN_ID, GLOBAL_LAUNCHER_ID,
  DEFAULT_CHAT_CONFIG,
  normalizePluginConfig, normalizeWorkspaceState, normalizeMessage,
  createSession, getMissingConfigMessage
} from "./cc_core.js";
import {
  createWorkspaceShell, createWorkspaceManager, createGlobalLauncher
} from "./cc_ui.js";
import { installSelectionAssistant } from "./cc_selection_assistant.js";

injectStyles();
window._cometChatPlugins = window._cometChatPlugins || {};

export const workspaceDom = createWorkspaceShell();
export const workspace = createWorkspaceManager(workspaceDom);
export let globalLauncher = null;

const DISMISSED_STORAGE_KEY = "nkxx_comet_chat_launcher_dismissed_v1";

function isImageVariantFile(file) {
  return file?.category === "image" || file?.category === "image_error";
}

function getImageVariantErrorText(file) {
  return String(file?.content || file?.preview_text || file?.original_name || file?.name || "").trim();
}

function createImageErrorVariant(message) {
  const text = String(message || "图片生成失败").trim() || "图片生成失败";
  return {
    id: createId("image_error"),
    name: "image-generation-error",
    original_name: "图片生成失败",
    category: "image_error",
    type: "inline_error",
    subfolder: "",
    mime_type: "text/plain",
    preview_text: text,
    size: text.length,
    content: text,
    remote_file_id: "",
  };
}

function isIntegratedChatAvailable() {
  return !!globalThis.__cometapiIntegratedChatAvailable || !!window.CometAPIChat;
}

function readLauncherDismissed() {
  try {
    return window.localStorage?.getItem(DISMISSED_STORAGE_KEY) === "1";
  } catch (_) {
    return false;
  }
}

function setLauncherDismissed(dismissed) {
  try {
    if (dismissed) {
      window.localStorage?.setItem(DISMISSED_STORAGE_KEY, "1");
    } else {
      window.localStorage?.removeItem(DISMISSED_STORAGE_KEY);
    }
  } catch (_) {}
}

function hideGlobalLauncher({ closeWorkspace = false } = {}) {
  globalLauncher?.closeMenu?.();
  const button = globalLauncher?.button || document.getElementById(GLOBAL_LAUNCHER_ID);
  if (button) button.style.display = "none";
  document.getElementById(`${GLOBAL_LAUNCHER_ID}-menu`)?.classList.remove("is-open");
  if (closeWorkspace) workspace?.close?.();
}

function dismissGlobalLauncher() {
  setLauncherDismissed(true);
  hideGlobalLauncher();
}

function ensureGlobalLauncher() {
  if (isIntegratedChatAvailable()) {
    hideGlobalLauncher({ closeWorkspace: true });
    return null;
  }
  if (readLauncherDismissed()) {
    hideGlobalLauncher();
    return null;
  }
  if (!globalLauncher) {
    globalLauncher = createGlobalLauncher(globalPluginController, workspaceDom, workspace, {
      onDismiss: dismissGlobalLauncher,
      canShow: () => !isIntegratedChatAvailable() && !readLauncherDismissed(),
    });
  }
  globalLauncher?.syncState?.();
  return globalLauncher;
}
function assemblePayloadText(baseText, files) {
  let text = String(baseText || "").trim();
  const textFiles = (files || []).filter(f => f.category === "text");
  if (textFiles.length > 0) {
    const blocks = textFiles.map(tf => {
      const ext = String(tf.name).split('.').pop().toLowerCase();
      return `\n\n以下是附件 \`${tf.name}\` 的内容：\n\`\`\`${ext}\n${tf.content}\n\`\`\``;
    });
    text += blocks.join("");
  }
  return text;
}

function filterContextMessages(messages = []) {
  return (messages || []).filter((message) => message?.includeInContext !== false);
}

function toRequestFileRef(file) {
  return {
    id: file?.id || "",
    name: file?.name || "",
    type: file?.type || "temp",
    subfolder: file?.subfolder || "",
    original_name: file?.original_name || file?.name || "",
    preview_text: file?.preview_text || "",
    size: Number(file?.size || 0),
  };
}

async function fetchJsonOrThrow(url, options = {}) {
  const response = await api.fetchApi(url, options);
  const text = await response.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch (_) {
    data = null;
  }
  if (!response.ok) {
    throw new Error(data?.error || text || `HTTP ${response.status}`);
  }
  return data || {};
}

const sharedChatControllerMethods = {
  getStatusText() { return this.statusText || "已就绪"; },
  getStatusKind() { return this.statusKind || "ready"; },
  setStatus(text, kind = "ready") {
    this.statusText = text;
    this.statusKind = kind;
    this.properties = this.properties || {};
    this.properties.__nkxx_status_text = text;
    this.properties.__nkxx_status_kind = kind;
    this.renderPlugin();
    workspace.refreshIfActive(this);
  },
  getAssistantLabel() {
    const config = this.getConfigValues();
    const activeChannel = config.channels.find(c => c.id === config.activeChannelId);
    return activeChannel ? (activeChannel.name || "助手") : "助手";
  },
  getConfigValues() { return this._config || normalizePluginConfig(DEFAULT_CHAT_CONFIG); },
  buildWorkspaceMeta() {
    const state = this.ensureWorkspaceState();
    return {
      currentSessionId: String(state.currentSessionId || ""),
      sidebarOpen: state.sidebarOpen === true,
    };
  },
  queuePersist({ config = false, meta = false, sessionId = null, deleteSessionId = null, immediate = false } = {}) {
    if (config) this._dirtyConfig = true;
    if (meta) this._dirtyMeta = true;
    if (sessionId) this._dirtySessionIds.add(String(sessionId));
    if (deleteSessionId) {
      const deletedId = String(deleteSessionId);
      this._deletedSessionIds.add(deletedId);
      this._dirtySessionIds.delete(deletedId);
    }
    if (!this._storageReady) return;
    if (immediate) {
      void this.flushPersistQueue();
      return;
    }
    if (this._persistTimer) window.clearTimeout(this._persistTimer);
    this._persistTimer = window.setTimeout(() => {
      this._persistTimer = null;
      void this.flushPersistQueue();
    }, 350);
  },
  async persistConfigToBackend() {
    await fetchJsonOrThrow("/nkxx/comet_chat/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: this.getConfigValues() }),
    });
  },
  async persistWorkspaceMetaToBackend() {
    await fetchJsonOrThrow("/nkxx/comet_chat/workspace_meta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(this.buildWorkspaceMeta()),
    });
  },
  async persistSessionToBackend(sessionId) {
    const session = this.getSessionById(sessionId);
    if (!session) return;
    await fetchJsonOrThrow("/nkxx/comet_chat/session/upsert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session: {
          id: session.id,
          title: session.title,
          autoTitle: session.autoTitle !== false,
          pinned: session.pinned,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          draft: session.draft,
          pendingFiles: cloneFiles(session.pendingFiles || []),
          messages: session.messages.map((message) => ({
            id: message.id,
            role: message.role,
            label: message.label,
            text: message.text,
            files: cloneFiles(message.files || []),
            tone: message.tone,
            kind: message.kind,
            includeInContext: message.includeInContext !== false,
            createdAt: message.createdAt,
            streaming: !!message.streaming,
          })),
        },
        workspace_meta: this.buildWorkspaceMeta(),
      }),
    });
  },
  async deleteSessionFromBackend(sessionId) {
    await fetchJsonOrThrow("/nkxx/comet_chat/session/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: String(sessionId || ""),
        workspace_meta: this.buildWorkspaceMeta(),
      }),
    });
  },
  async flushPersistQueue() {
    if (!this._storageReady) return;
    if (this._persistRunning) {
      this._persistQueued = true;
      return;
    }

    if (this._persistTimer) {
      window.clearTimeout(this._persistTimer);
      this._persistTimer = null;
    }

    const dirtyConfig = this._dirtyConfig;
    const dirtyMeta = this._dirtyMeta;
    const dirtySessionIds = Array.from(this._dirtySessionIds);
    const deletedSessionIds = Array.from(this._deletedSessionIds);

    if (!dirtyConfig && !dirtyMeta && !dirtySessionIds.length && !deletedSessionIds.length) {
      return;
    }

    this._dirtyConfig = false;
    this._dirtyMeta = false;
    this._dirtySessionIds.clear();
    this._deletedSessionIds.clear();
    this._persistRunning = true;

    try {
      if (dirtyConfig) await this.persistConfigToBackend();
      if (dirtyMeta) await this.persistWorkspaceMetaToBackend();
      for (const sessionId of deletedSessionIds) {
        await this.deleteSessionFromBackend(sessionId);
      }
      for (const sessionId of dirtySessionIds) {
        if (deletedSessionIds.includes(sessionId)) continue;
        await this.persistSessionToBackend(sessionId);
      }
    } catch (error) {
      console.warn("[CometChat] Failed to persist sqlite state:", error);
      if (dirtyConfig) this._dirtyConfig = true;
      if (dirtyMeta) this._dirtyMeta = true;
      dirtySessionIds.forEach((sessionId) => this._dirtySessionIds.add(sessionId));
      deletedSessionIds.forEach((sessionId) => this._deletedSessionIds.add(sessionId));
    } finally {
      this._persistRunning = false;
      if (this._persistQueued || this._dirtyConfig || this._dirtyMeta || this._dirtySessionIds.size || this._deletedSessionIds.size) {
        this._persistQueued = false;
        this.queuePersist({ immediate: true });
      }
    }
  },
  async loadPersistedState() {
    if (this._loadPromise) return this._loadPromise;
    this._loadPromise = (async () => {
      let bootstrapFailed = false;
      try {
        const payload = await fetchJsonOrThrow("/nkxx/comet_chat/bootstrap");
        this._backendBootId = String(payload?.boot_id || "");
        if (payload?.config) {
          this._config = normalizePluginConfig(payload.config);
        } else {
          this._dirtyConfig = true;
        }
        if (payload?.workspace_state) {
          this._workspaceState = normalizeWorkspaceState(payload.workspace_state);
        } else {
          this._dirtyMeta = true;
          this._workspaceState.sessions.forEach((session) => this._dirtySessionIds.add(session.id));
        }
      } catch (error) {
        bootstrapFailed = true;
        console.warn("[CometChat] Failed to bootstrap sqlite state:", error);
      } finally {
        this._storageReady = true;
        this.renderPlugin();
        workspace.refreshIfActive(this);
        if (
          !bootstrapFailed &&
          (
            this._dirtyConfig ||
            this._dirtyMeta ||
            this._dirtySessionIds.size ||
            this._deletedSessionIds.size
          )
        ) {
          this.queuePersist({ immediate: true });
        }
      }
    })();
    return this._loadPromise;
  },
  applySettingsValues(values = {}) {
    this._config = normalizePluginConfig(values);
    this.queuePersist({ config: true, immediate: true });
    this.renderPlugin();
    workspace.refreshIfActive(this);
  },
  touchSession(session) { if (session) session.updatedAt = nowIso(); },
  getSessionById(sessionId) { return this.ensureWorkspaceState().sessions.find((session) => session.id === sessionId) || null; },
  getCurrentSession() {
    const state = this.ensureWorkspaceState();
    return this.getSessionById(state.currentSessionId) || state.sessions[0] || null;
  },
  saveAndRender() {
    this.renderPlugin();
    workspace.refreshIfActive(this);
  },
  createSession(switchTo = true) {
    const state = this.ensureWorkspaceState();
    const session = createSession(state.sessions.length + 1);
    state.sessions.unshift(session);
    if (switchTo) state.currentSessionId = session.id;
    this.queuePersist({ sessionId: session.id, meta: true });
    this.saveAndRender();
    return session;
  },
  setCurrentSession(sessionId) {
    const state = this.ensureWorkspaceState();
    if (!this.getSessionById(sessionId)) return;
    state.currentSessionId = sessionId;
    this.queuePersist({ meta: true });
    this.saveAndRender();
  },
  renameSession(sessionId, nextTitle) {
    const session = this.getSessionById(sessionId);
    if (!session) return;
    const trimmed = String(nextTitle || "").trim();
    if (!trimmed) return;
    session.title = trimmed;
    session.autoTitle = false;
    this.touchSession(session);
    this.queuePersist({ sessionId: session.id });
    this.saveAndRender();
  },
  renameCurrentSession(nextTitle) {
    const session = this.getCurrentSession();
    if (!session) return;
    this.renameSession(session.id, nextTitle);
  },
  togglePinSession(sessionId) {
    const session = this.getSessionById(sessionId);
    if (!session) return;
    session.pinned = !session.pinned;
    this.queuePersist({ sessionId: session.id });
    this.saveAndRender();
  },
  deleteSession(sessionId) {
    const state = this.ensureWorkspaceState();
    const nextSessions = state.sessions.filter((session) => session.id !== sessionId);
    state.sessions = nextSessions.length ? nextSessions : [createSession(1)];
    if (!state.sessions.some((session) => session.id === state.currentSessionId)) {
      state.currentSessionId = state.sessions[0].id;
    }
    this.queuePersist({ deleteSessionId: sessionId, meta: true });
    if (!nextSessions.length) {
      this.queuePersist({ sessionId: state.sessions[0].id });
    }
    this.saveAndRender();
  },
  deleteCurrentSession() {
    const current = this.getCurrentSession();
    if (!current) return;
    this.deleteSession(current.id);
  },
  toggleSidebar() {
    const state = this.ensureWorkspaceState();
    state.sidebarOpen = !state.sidebarOpen;
    this.queuePersist({ meta: true });
    this.saveAndRender();
  },
  updateDraft(text, source = "plugin") {
    const session = this.getCurrentSession();
    if (!session) return;
    session.draft = String(text || "");
    this.queuePersist({ sessionId: session.id });
    if (source !== "plugin") this.renderPlugin();
    if (source !== "workspace") workspace.refreshIfActive(this);
  },
  removePendingFile(index) {
    const session = this.getCurrentSession();
    if (!session) return;
    session.pendingFiles.splice(index, 1);
    this.touchSession(session);
    this.queuePersist({ sessionId: session.id });
    this.saveAndRender();
  },
  appendMessage(sessionId, messageInput) {
    const session = this.getSessionById(sessionId);
    if (!session) return null;
    const message = normalizeMessage(messageInput);
    session.messages.push(message);
    this.touchSession(session);
    this.queuePersist({ sessionId: session.id });
    return message;
  },
  findMessage(sessionId, messageId) {
    return this.getSessionById(sessionId)?.messages.find((message) => message.id === messageId) || null;
  },
  getMessageFile(messageId, fileIndex = 0, sessionId = null) {
    const session = this.getSessionById(sessionId || this.getCurrentSession()?.id);
    const message = session?.messages.find((item) => item.id === messageId);
    const index = Math.max(0, Number(fileIndex) || 0);
    return { session, message, file: message?.files?.[index] || null };
  },
  getMessageImageFiles(message) {
    return (message?.files || []).filter((file) => file?.category === "image");
  },
  getMessageImageVariants(message) {
    return (message?.files || []).filter((file) => isImageVariantFile(file));
  },
  appendImageErrorVariant(message, errorText) {
    if (!message) return 0;
    message.files = [...cloneFiles(message.files || []), createImageErrorVariant(errorText)];
    const variantCount = this.getMessageImageVariants(message).length;
    if (variantCount > 0) message.imageIndex = variantCount - 1;
    message.text = "";
    message.tone = "";
    message.kind = "record";
    message.includeInContext = false;
    return variantCount;
  },
  setMessageImageIndex(messageId, nextIndex, sessionId = null) {
    const session = this.getSessionById(sessionId || this.getCurrentSession()?.id);
    const message = session?.messages.find((item) => item.id === messageId);
    const variantCount = this.getMessageImageVariants(message).length;
    if (!message || variantCount <= 1) return false;
    const index = Math.min(Math.max(Math.round(Number(nextIndex) || 0), 0), variantCount - 1);
    if (message.imageIndex === index) return true;
    message.imageIndex = index;
    if (workspace.activePlugin === this && typeof workspace.renderMessages === "function") {
      workspace.renderMessages();
    } else {
      this.renderPlugin();
      workspace.refreshIfActive(this);
    }
    return true;
  },
  stepMessageImageIndex(messageId, delta = 0, sessionId = null) {
    const session = this.getSessionById(sessionId || this.getCurrentSession()?.id);
    const message = session?.messages.find((item) => item.id === messageId);
    const variantCount = this.getMessageImageVariants(message).length;
    if (!message || variantCount <= 1) return false;
    const current = Number.isFinite(Number(message.imageIndex)) ? Number(message.imageIndex) : variantCount - 1;
    return this.setMessageImageIndex(messageId, current + Number(delta || 0), session?.id);
  },
  async copyImageFile(file, session = null) {
    if (!file || file.category !== "image") return false;
    const imageUrl = getPreviewUrl(file);
    try {
      const response = await fetch(imageUrl, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const mimeType = String(blob.type || file.mime_type || "image/png").replace("image/jpg", "image/jpeg");
      if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
        throw new Error("当前浏览器不支持复制图片");
      }
      const imageBlob = blob.type === mimeType ? blob : new Blob([await blob.arrayBuffer()], { type: mimeType });
      await navigator.clipboard.write([new ClipboardItem({ [mimeType]: imageBlob })]);
      this.setStatus("图片已复制", "ready");
      this.renderPlugin();
      workspace.refreshIfActive(this);
      return true;
    } catch (error) {
      const copied = await copyTextToClipboard(new URL(imageUrl, window.location.href).href);
      if (copied) {
        this.setStatus("已复制图片链接", "ready");
        this.renderPlugin();
        workspace.refreshIfActive(this);
        return true;
      }
      if (session) this.showSessionError(`复制图片失败：${error?.message || error}`, session.id);
      this.setStatus("复制失败", "error");
      return false;
    }
  },
  async copyMessageImage(messageId, fileIndex = 0, sessionId = null) {
    const { session, file } = this.getMessageFile(messageId, fileIndex, sessionId);
    return this.copyImageFile(file, session);
  },
  downloadMessageFile(messageId, fileIndex = 0, sessionId = null) {
    const { file } = this.getMessageFile(messageId, fileIndex, sessionId);
    if (!file) return false;
    const link = document.createElement("a");
    link.href = getPreviewUrl(file);
    link.download = file.original_name || file.name || "comet-chat-image.png";
    link.rel = "noreferrer";
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
    this.setStatus("已开始下载", "ready");
    return true;
  },
  async copyMessageText(messageId, sessionId = null) {
    const session = this.getSessionById(sessionId || this.getCurrentSession()?.id);
    const message = session?.messages.find((item) => item.id === messageId);
    if (!message) return false;
    if (String(message.text || "").trim()) {
      const copied = await copyTextToClipboard(message.text);
      if (copied) {
        this.setStatus("已复制", "ready");
        this.renderPlugin();
        workspace.refreshIfActive(this);
      }
      return copied;
    }
    const variants = this.getMessageImageVariants(message);
    const imageIndex = Number.isFinite(Number(message.imageIndex)) ? Number(message.imageIndex) : variants.length - 1;
    const activeVariant = variants[Math.min(Math.max(Math.round(imageIndex), 0), variants.length - 1)];
    if (activeVariant?.category === "image_error") {
      const copied = await copyTextToClipboard(getImageVariantErrorText(activeVariant));
      if (copied) {
        this.setStatus("已复制", "ready");
        this.renderPlugin();
        workspace.refreshIfActive(this);
      }
      return copied;
    }
    return this.copyImageFile(activeVariant, session);
  },

  async regenerateAssistantMessage(messageId, sessionId = null) {
    if (this.isStreaming) {
      await this.cancelStreaming();
      return;
    }

    const session = this.getSessionById(sessionId || this.getCurrentSession()?.id);
    if (!session?.messages?.length) return;

    const assistantIndex = session.messages.findIndex((message) => message.id === messageId && message.role === "assistant");
    if (assistantIndex < 0) return;
    const targetAssistant = session.messages[assistantIndex];
    const assistantHasImage = (targetAssistant.files || []).some((file) => isImageVariantFile(file));

    if (targetAssistant.streaming) {
      this.setStatus(assistantHasImage ? "图片生成中" : "正在生成", "warn");
      return;
    }

    if (!assistantHasImage) {
      const lastAssistantIndex = (() => {
        for (let index = session.messages.length - 1; index >= 0; index -= 1) {
          const message = session.messages[index];
          if (message?.role !== "assistant") continue;
          if (message.streaming) return -1;
          if (message.tone === "error") continue;
          if (message.includeInContext !== false) return index;
        }
        return -1;
      })();

      if (assistantIndex !== lastAssistantIndex) {
        this.showSessionError("当前仅支持重新生成最后一条助手回复。", session.id);
        this.setStatus("暂不支持", "warn");
        return;
      }
    }

    let userIndex = -1;
    for (let index = assistantIndex - 1; index >= 0; index -= 1) {
      if (session.messages[index]?.role === "user") {
        userIndex = index;
        break;
      }
    }
    if (userIndex < 0) {
      this.showSessionError("没有找到可重新生成的上一条用户消息。", session.id);
      this.setStatus("无法重试", "warn");
      return;
    }

    const userMessage = session.messages[userIndex];
    const payloadTextInput = assemblePayloadText(userMessage.text, userMessage.files);
    const mediaFiles = cloneFiles(userMessage.files || []).filter(f => f.category !== "text");

    const configError = getMissingConfigMessage(this);
    if (configError) {
      this.showSessionError(configError, session.id);
      this.setStatus("配置未完成", "warn");
      return;
    }

    const config = this.getConfigValues();
    const activeChannel = config.channels.find(c => c.id === config.activeChannelId);
    const activeModel = activeChannel?.models?.find(m => m.id === config.activeModelId) || activeChannel?.models?.[0];
    
    const finalApiKey = String(activeModel.override_api_key || "").trim() || activeChannel.api_key;
    const finalModelName = activeModel.name;
    const finalApiFormat = activeModel.api_format || "openai";
    const finalModelCategory = activeModel.category || "llm";
    const finalInterfaceMode = activeModel.interface_mode || "";
    const isImageChat = isImageGenerationModel(finalApiFormat, finalModelName, finalModelCategory);

    if (assistantHasImage && !isImageChat) {
      this.showSessionError("重新生成图片需要先切回图片模型。", session.id);
      this.setStatus("请切回图片模型", "warn");
      return;
    }
    if (!assistantHasImage && isImageChat) {
      this.showSessionError("重新生成文本回复需要先切回文本模型。", session.id);
      this.setStatus("请切回文本模型", "warn");
      return;
    }

    const historyMessages = isImageChat ? [] : filterContextMessages(session.messages.slice(0, userIndex));
    
    const historyPayload = historyMessages.map(msg => ({
      role: msg.role,
      text: assemblePayloadText(msg.text, msg.files),
      files: cloneFiles(msg.files || []).filter(f => f.category !== "text")
    }));

    // 关键修正：确保 presets 被打包发给后端
    const flatConfig = {
      api_url: activeChannel.api_url,
      api_key: finalApiKey,
      model: finalModelName,
      api_format: finalApiFormat,
      model_category: finalModelCategory,
      interface_mode: finalInterfaceMode,
      channel_id: activeChannel.id || "",
      channel_name: activeChannel.name || "",
      source_channel: activeChannel.source_channel || "",
      system_prompt: config.system_prompt,
      temperature: config.temperature,
      max_tokens: config.max_tokens,
      presets: config.presets || [] // 新增预设数据传递
    };

    const attachmentSupportError = getAttachmentSupportError(flatConfig.api_format, flatConfig.model, mediaFiles, flatConfig.model_category);
    if (attachmentSupportError) {
      this.showSessionError(attachmentSupportError, session.id);
      this.setStatus("附件不支持", "warn");
      return;
    }

    let assistantMessage = null;
    if (isImageChat) {
      assistantMessage = targetAssistant;
      assistantMessage.label = this.getAssistantLabel();
      assistantMessage.text = "正在生成图片...";
      assistantMessage.tone = "";
      assistantMessage.streaming = true;
      assistantMessage.includeInContext = false;
    } else {
      session.messages = session.messages.slice(0, assistantIndex);
    }
    if (assistantMessage) {
      this.imageTasks.set(assistantMessage.id, { sessionId: session.id, messageId: assistantMessage.id });
    }
    this.touchSession(session);
    this.queuePersist({ sessionId: session.id });
    this.renderPlugin();
    workspace.refreshIfActive(this);
    this.setStatus(isImageChat ? "图片生成中" : "请求已提交", "streaming");

    try {
      this.refreshPluginRegistry();
      const response = await api.fetchApi("/nkxx/comet_chat/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plugin_id: this.getBackendPluginId(),
          session_id: session.id,
          text_input: payloadTextInput, 
          pending_files: mediaFiles.map((file) => toRequestFileRef(file)),
          config: flatConfig,
          history: historyPayload,
          message_id: assistantMessage?.id || "",
        }),
      });
      if (!response.ok) throw new Error((await response.text()) || `HTTP ${response.status}`);
    } catch (error) {
      const errorText = `重新生成失败：${error?.message || error}`;
      if (assistantMessage) {
        this.imageTasks.delete(assistantMessage.id);
        assistantMessage.streaming = false;
        this.appendImageErrorVariant(assistantMessage, errorText);
        this.touchSession(session);
        this.queuePersist({ sessionId: session.id });
        this.saveAndRender();
      } else {
        this.showSessionError(errorText, session.id);
      }
      this.setStatus("重新生成失败", "error");
    }
  },

  maybeAutoTitleSession(session, text) {
    if (!session || session.autoTitle === false) return;
    const userMsgCount = session.messages.filter(m => m.role === 'user').length;
    if (userMsgCount > 0) {
      session.autoTitle = false;
      return;
    }
    const nextTitle = summarizeText(text, 30);
    if (!nextTitle) return;
    session.title = nextTitle;
    session.autoTitle = false;
  },

  showSessionError(message, sessionId = null) {
    const current = this.getCurrentSession();
    const targetSession = this.getSessionById(sessionId || current?.id);
    if (!targetSession) return;
    this.appendMessage(targetSession.id, {
      role: "assistant",
      label: this.getAssistantLabel(),
      text: message,
      tone: "error",
      kind: "synthetic",
      includeInContext: false,
    });
    this.saveAndRender();
  },

  startStream(detail = {}) {
    const sessionId = String(detail.session_id || this.getCurrentSession()?.id || "");
    const session = this.getSessionById(sessionId) || this.getCurrentSession();
    if (!session) return;
    if (this.streamInfo?.messageId) {
      const previousMessage = this.findMessage(this.streamInfo.sessionId, this.streamInfo.messageId);
      if (previousMessage) previousMessage.streaming = false;
    }
    const message = this.appendMessage(session.id, {
      role: "assistant",
      label: this.getAssistantLabel(),
      text: "",
      streaming: true,
    });
    if (!message) return;
    this.isStreaming = true;
    this.isCancelling = false;
    this.streamInfo = { sessionId: session.id, messageId: message.id };
    this.setStatus("正在生成", "streaming");
    this.saveAndRender();
  },

  chunkStream(detail = {}) {
    if (!this.streamInfo) return; 
    const sessionId = String(detail.session_id || this.streamInfo?.sessionId || this.getCurrentSession()?.id || "");
    const chunkText = String(detail.chunk || "");
    if (!chunkText) return;
    const target = this.findMessage(sessionId, this.streamInfo?.messageId);
    if (!target) return;
    target.text += chunkText;
    this.touchSession(this.getSessionById(sessionId));
    this.queuePersist({ sessionId });
    this.renderPlugin();
    workspace.refreshIfActive(this);
  },

  endStream(detail = {}) {
    const sessionId = String(detail.session_id || this.streamInfo?.sessionId || this.getCurrentSession()?.id || "");
    const target = this.findMessage(sessionId, this.streamInfo?.messageId);
    const wasCancelled = !!detail.cancelled;
    if (target) {
      target.streaming = false;
      if (wasCancelled && !target.text.trim()) {
        target.text = "已停止生成";
        target.tone = "error";
        target.kind = "synthetic";
        target.includeInContext = false;
      }
    }
    this.isStreaming = false;
    this.isCancelling = false;
    this.streamInfo = null;
    this.queuePersist({ sessionId });
    this.setStatus(wasCancelled ? "已停止" : "已就绪", wasCancelled ? "warn" : "ready");
    this.saveAndRender();
  },

  errorStream(detail = {}) {
    const sessionId = String(detail.session_id || this.streamInfo?.sessionId || this.getCurrentSession()?.id || "");
    const errorText = String(detail.error || "未知错误");
    const target = this.findMessage(sessionId, this.streamInfo?.messageId);
    if (target) {
      target.streaming = false;
      target.tone = "error";
      target.kind = "synthetic";
      target.includeInContext = false;
      target.text = target.text.trim() ? `${target.text}\n\n错误：${errorText}` : `错误：${errorText}`;
    } else {
      this.appendMessage(sessionId, {
        role: "assistant",
        label: this.getAssistantLabel(),
        text: `错误：${errorText}`,
        tone: "error",
        kind: "synthetic",
        includeInContext: false,
      });
    }
    this.isStreaming = false;
    this.isCancelling = false;
    this.streamInfo = null;
    this.queuePersist({ sessionId });
    this.setStatus("请求出错", "error");
    this.saveAndRender();
  },

  imageStart(detail = {}) {
    const messageId = String(detail.message_id || "");
    if (!messageId) return;
    const sessionId = String(detail.session_id || this.getCurrentSession()?.id || "");
    this.imageTasks.set(messageId, { sessionId, messageId, taskId: String(detail.task_id || "") });
  },

  imageResult(detail = {}) {
    const sessionId = String(detail.session_id || this.getCurrentSession()?.id || "");
    const messageId = String(detail.message_id || "");
    const target = this.findMessage(sessionId, messageId);
    if (!target) return;
    const files = cloneFiles(detail.files || []);
    target.files = [...cloneFiles(target.files || []), ...files];
    const variantCount = this.getMessageImageVariants(target).length;
    if (variantCount > 0) target.imageIndex = variantCount - 1;
    const text = String(detail.text || "").trim();
    target.text = text || "";
    target.tone = "";
    target.kind = "record";
    target.streaming = false;
    target.includeInContext = false;
    this.imageTasks.delete(messageId);
    this.touchSession(this.getSessionById(sessionId));
    this.queuePersist({ sessionId });
    if (!this.imageTasks.size && !this.isStreaming) this.setStatus("已就绪", "ready");
    this.saveAndRender();
  },

  imageEnd(detail = {}) {
    const sessionId = String(detail.session_id || this.getCurrentSession()?.id || "");
    const messageId = String(detail.message_id || "");
    const target = this.findMessage(sessionId, messageId);
    if (target) {
      target.streaming = false;
      if (!detail.cancelled && (target.files || []).some((file) => isImageVariantFile(file)) && String(target.text || "").trim() === "正在生成图片...") {
        target.text = "";
        target.tone = "";
        target.kind = "record";
        target.includeInContext = false;
      }
      if (detail.cancelled && !target.files?.length) {
        target.text = "已停止生成";
        target.tone = "error";
        target.kind = "synthetic";
        target.includeInContext = false;
      }
    }
    if (messageId) this.imageTasks.delete(messageId);
    this.queuePersist({ sessionId });
    if (!this.imageTasks.size && !this.isStreaming) this.setStatus("已就绪", "ready");
    this.saveAndRender();
  },

  imageError(detail = {}) {
    const sessionId = String(detail.session_id || this.getCurrentSession()?.id || "");
    const messageId = String(detail.message_id || "");
    const errorText = String(detail.error || "未知错误");
    const target = this.findMessage(sessionId, messageId);
    if (target) {
      target.streaming = false;
      this.appendImageErrorVariant(target, `图片生成失败：${errorText}`);
    } else {
      this.appendMessage(sessionId, {
        role: "assistant",
        label: this.getAssistantLabel(),
        text: "",
        files: [createImageErrorVariant(`图片生成失败：${errorText}`)],
        includeInContext: false,
      });
    }
    if (messageId) this.imageTasks.delete(messageId);
    this.queuePersist({ sessionId });
    this.setStatus("图片生成失败", "error");
    this.saveAndRender();
  },

  async cancelStreaming() {
    if (!this.isStreaming || this.isCancelling) return;
    this.isCancelling = true;
    this.endStream({ cancelled: true });
    try {
      this.refreshPluginRegistry();
      const response = await api.fetchApi("/nkxx/comet_chat/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plugin_id: this.getBackendPluginId() }),
      });
      if (!response.ok) throw new Error((await response.text()) || `HTTP ${response.status}`);
    } catch (error) {
      this.isCancelling = false;
      this.showSessionError(`停止生成失败：${error?.message || error}`);
      this.setStatus("停止失败", "error");
    }
  },

  async handleSelectedFiles(files) {
    const session = this.getCurrentSession();
    if (!session) return;

    for (const file of files) {
      if (isTextFile(file.name, file.type)) {
        try {
          const textContent = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = e => reject(e);
            reader.readAsText(file);
          });
          
          session.pendingFiles.push(cloneFileRecord({
            name: file.name,
            original_name: file.name,
            category: "text",
            type: "local_text",
            content: textContent,
            mime_type: file.type || "text/plain",
            size: Number(file.size || 0),
          }));
          
          this.touchSession(session);
          this.queuePersist({ sessionId: session.id });
          this.saveAndRender();
        } catch (e) {
          this.showSessionError(`读取文本文件失败：${file.name}`);
          this.setStatus("读取失败", "error");
        }
        continue;
      }

      const formData = new FormData();
      formData.append("file", file, file.name);

      try {
        const response = await api.fetchApi("/nkxx/comet_chat/upload", {
          method: "POST",
          body: formData,
        });
        if (!response.ok) throw new Error((await response.text()) || `HTTP ${response.status}`);
        const data = await response.json();
        session.pendingFiles.push(cloneFileRecord(data));
        this.touchSession(session);
      } catch (error) {
        this.showSessionError(`文件上传失败：${error?.message || error}`);
        this.setStatus("上传失败", "error");
        break;
      }
    }

    this.queuePersist({ sessionId: session.id });
    this.saveAndRender();
  },

  async sendCurrentMessage(_source = "workspace") {
    const session = this.getCurrentSession();
    if (!session) return;

    const text = String(session.draft || "").trim();
    const files = cloneFiles(session.pendingFiles || []);
    if (!text && !files.length) return;

    const configError = getMissingConfigMessage(this);
    if (configError) {
      this.showSessionError(configError, session.id);
      this.setStatus("配置未完成", "warn");
      return;
    }

    const config = this.getConfigValues();
    const activeChannel = config.channels.find(c => c.id === config.activeChannelId);
    const activeModel = activeChannel?.models?.find(m => m.id === config.activeModelId) || activeChannel?.models?.[0];
    
    const finalApiKey = String(activeModel.override_api_key || "").trim() || activeChannel.api_key;
    const finalModelName = activeModel.name;
    const finalApiFormat = activeModel.api_format || "openai";
    const finalModelCategory = activeModel.category || "llm";
    const finalInterfaceMode = activeModel.interface_mode || "";
    const isImageChat = isImageGenerationModel(finalApiFormat, finalModelName, finalModelCategory);

    if (this.isStreaming && !isImageChat) {
      await this.cancelStreaming();
      return;
    }

    // 关键修正：确保 presets 被打包发给后端
    const flatConfig = {
      api_url: activeChannel.api_url,
      api_key: finalApiKey,
      model: finalModelName,
      api_format: finalApiFormat,
      model_category: finalModelCategory,
      interface_mode: finalInterfaceMode,
      channel_id: activeChannel.id || "",
      channel_name: activeChannel.name || "",
      source_channel: activeChannel.source_channel || "",
      system_prompt: config.system_prompt,
      temperature: config.temperature,
      max_tokens: config.max_tokens,
      presets: config.presets || [] // 新增预设数据传递
    };

    const mediaFiles = files.filter(f => f.category !== "text");

    const attachmentSupportError = getAttachmentSupportError(flatConfig.api_format, flatConfig.model, mediaFiles, flatConfig.model_category);
    if (attachmentSupportError) {
      this.showSessionError(attachmentSupportError, session.id);
      this.setStatus("附件不支持", "warn");
      return;
    }

    this.refreshPluginRegistry();

    const historyPayload = isImageChat ? [] : filterContextMessages(session.messages).map(msg => ({
      role: msg.role,
      text: assemblePayloadText(msg.text, msg.files),
      files: cloneFiles(msg.files || []).filter(f => f.category !== "text")
    }));

    this.maybeAutoTitleSession(session, text);
    const userMessage = this.appendMessage(session.id, {
      role: "user",
      label: "你",
      text,
      files,
      includeInContext: !isImageChat,
    });
    const assistantMessage = isImageChat ? this.appendMessage(session.id, {
      role: "assistant",
      label: this.getAssistantLabel(),
      text: "正在生成图片...",
      files: [],
      streaming: true,
      includeInContext: false,
    }) : null;
    if (isImageChat && assistantMessage) {
      this.imageTasks.set(assistantMessage.id, { sessionId: session.id, messageId: assistantMessage.id });
    }
    
    session.draft = "";
    session.pendingFiles = [];
    this.touchSession(session);
    this.queuePersist({ sessionId: session.id });

    if (workspace?.refs?.textarea) {
      workspace.refs.textarea.value = "";
      workspace.refs.textarea.style.height = 'auto'; 
    }

    this.renderPlugin();
    workspace.refreshIfActive(this);
    this.setStatus(isImageChat ? "图片生成中" : "请求已提交", "streaming");

    const payloadTextInput = assemblePayloadText(text, files);

    try {
      const response = await api.fetchApi("/nkxx/comet_chat/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plugin_id: this.getBackendPluginId(),
          session_id: session.id,
          text_input: payloadTextInput,
          pending_files: mediaFiles.map((file) => toRequestFileRef(file)),
          config: flatConfig,
          history: historyPayload,
          message_id: assistantMessage?.id || "",
        }),
      });
      if (!response.ok) throw new Error((await response.text()) || `HTTP ${response.status}`);
    } catch (error) {
      if (userMessage) {
        session.messages = session.messages.filter(m => m.id !== userMessage.id && m.id !== assistantMessage?.id);
      }
      if (assistantMessage) this.imageTasks.delete(assistantMessage.id);
      session.draft = text;
      session.pendingFiles = files;
      
      this.showSessionError(`启动对话任务失败：${error?.message || error}`, session.id);
      this.setStatus("发送失败", "error");
      
      this.saveAndRender(); 
      if (workspace?.refs?.textarea) {
        workspace.refs.textarea.value = text;
        workspace.refs.textarea.style.height = 'auto';
        workspace.refs.textarea.style.height = `${Math.min(workspace.refs.textarea.scrollHeight, 200)}px`;
      }
    }
  },
};

function createGlobalPluginController() {
  const controller = {
    id: GLOBAL_PLUGIN_ID,
    title: "Comet 对话",
    isGlobalPlugin: true,
    properties: {},
    statusText: "已就绪",
    statusKind: "ready",
    isStreaming: false,
    isCancelling: false,
    streamInfo: null,
    imageTasks: new Map(),
    _backendBootId: "",
    _config: normalizePluginConfig(DEFAULT_CHAT_CONFIG),
    _workspaceState: normalizeWorkspaceState(null),
    _persistTimer: null,
    _persistRunning: false,
    _persistQueued: false,
    _dirtyConfig: false,
    _dirtyMeta: false,
    _dirtySessionIds: new Set(),
    _deletedSessionIds: new Set(),
    _storageReady: false,
    _loadPromise: null,

    getBackendPluginId() { return GLOBAL_PLUGIN_ID; },
    refreshPluginRegistry() {
      window._cometChatPlugins[GLOBAL_PLUGIN_ID] = this;
    },
    getWidgetValue(name, fallback = "") { return this._config?.[name] ?? fallback; },
    setWidgetValue(name, value) {
      this._config = normalizePluginConfig({ ...this._config, [name]: value });
      this.queuePersist({ config: true, immediate: true });
      this.renderPlugin();
      workspace.refreshIfActive(this);
    },
    ensureWorkspaceState() {
      if (!this._workspaceState) {
        this._workspaceState = normalizeWorkspaceState(null);
      }
      return this._workspaceState;
    },
    persistWorkspaceState() {
      const state = this.ensureWorkspaceState();
      this._dirtyMeta = true;
      state.sessions.forEach((session) => this._dirtySessionIds.add(session.id));
      this.queuePersist({ immediate: true });
    },
    renderPlugin() { globalLauncher?.syncState?.(); },
    syncPluginBounds() {},
    openWorkspace() {
      workspace.open(this);
      globalLauncher?.syncState?.();
    },
  };

  Object.assign(controller, sharedChatControllerMethods);
  controller.refreshPluginRegistry();
  return controller;
}

const globalPluginController = createGlobalPluginController();

function getPluginFromEvent(detail) {
  const key = String(detail?.plugin_id ?? "");
  if (window._cometChatPlugins?.[key]) return window._cometChatPlugins[key];
  return null;
}

function exposeCometChat() {
  window.CometChat = {
    controller: globalPluginController,
    open() {
      if (isIntegratedChatAvailable()) {
        window.CometAPIChat?.open?.();
        return;
      }
      setLauncherDismissed(false);
      globalPluginController.refreshPluginRegistry();
      ensureGlobalLauncher();
      globalPluginController.openWorkspace();
    },
    showLauncher() {
      if (isIntegratedChatAvailable()) return null;
      setLauncherDismissed(false);
      return ensureGlobalLauncher();
    },
  };
}

app.registerExtension({
  name: EXT_NAME,
  async setup() {
    try {
      await globalPluginController.loadPersistedState();
    } catch (e) {
      console.warn("[CometChat] Failed to load persisted state:", e);
    } finally {
      exposeCometChat();
      ensureGlobalLauncher();
      installSelectionAssistant(globalPluginController, workspace, {
        shouldSuppress: isIntegratedChatAvailable,
      });
      window.setTimeout(() => ensureGlobalLauncher(), 500);
    }
  }
});

api.addEventListener("comet_chat_stream_start", (event) => getPluginFromEvent(event.detail)?.startStream(event.detail || {}));
api.addEventListener("comet_chat_stream_chunk", (event) => getPluginFromEvent(event.detail)?.chunkStream(event.detail || {}));
api.addEventListener("comet_chat_stream_end", (event) => getPluginFromEvent(event.detail)?.endStream(event.detail || {}));
api.addEventListener("comet_chat_stream_error", (event) => getPluginFromEvent(event.detail)?.errorStream(event.detail || {}));
api.addEventListener("comet_chat_image_start", (event) => getPluginFromEvent(event.detail)?.imageStart(event.detail || {}));
api.addEventListener("comet_chat_image_result", (event) => getPluginFromEvent(event.detail)?.imageResult(event.detail || {}));
api.addEventListener("comet_chat_image_end", (event) => getPluginFromEvent(event.detail)?.imageEnd(event.detail || {}));
api.addEventListener("comet_chat_image_error", (event) => getPluginFromEvent(event.detail)?.imageError(event.detail || {}));

