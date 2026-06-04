import { app } from "../../scripts/app.js";
import {
  makeCustomSelect, escapeHtml, parseMarkdown, clearElement,
  copyTextToClipboard, createId, formatTimeLabel,
  getPreviewUrl, getPreviewFallbackUrl, getFileCategoryLabel,
  inferManualModelSettings, normalizeImageInterfaceMode, normalizeImageApiFormatValue, normalizeModelCategory
} from "./cc_utils.js";
import {
  WORKSPACE_ID, GLOBAL_LAUNCHER_ID, GLOBAL_LAUNCHER_POS_KEY,
  PANEL_POS_KEY, safeReadJsonStorage, safeWriteJsonStorage
} from "./cc_core.js";

const DEFAULT_PRESET_JSON = {
  "url_template": "{api_url}",
  "headers_template": {
    "Content-Type": "application/json",
    "Authorization": "Bearer {api_key}"
  },
  "upload_step": {
    "enabled": false,
    "url": "{api_url}/v1/files",
    "method": "POST",
    "headers": {
      "Authorization": "Bearer {api_key}"
    },
    "payload_type": "multipart/form-data",
    "file_field_name": "file",
    "extra_fields": {
      "purpose": "file-extract"
    },
    "response_extractor": "id"
  },
  "body_template": {
    "model": "{model}",
    "messages": "{messages}",
    "stream": true,
    "temperature": "{temperature}",
    "max_tokens": "{max_tokens}"
  },
  "message_mapping": {
    "system_role": "system",
    "user_role": "user",
    "assistant_role": "assistant",
    "role_key": "role",
    "content_key": "content"
  },
  "attachment_mapping": {
    "support_image": true,
    "support_video": false,
    "support_audio": false,
    "support_document": false,
    "text_template": {
      "type": "text",
      "text": "{text}"
    },
    "image_template": {
      "type": "image_url",
      "image_url": {
        "url": "data:{mime_type};base64,{data}"
      }
    }
  },
  "stream_parser": {
    "content_path": "choices.0.delta.content",
    "thinking_path": "choices.0.delta.reasoning_content"
  }
};

const LAYOUT_MODE_KEY = "nkxx_comet_chat_layout_mode_v1";

const CHAT_TEXT_API_FORMAT_OPTIONS = [
  { value: "openai", label: "OpenAI 格式" },
  { value: "claude", label: "Claude 原生" },
  { value: "gemini", label: "Gemini 原生" },
];

const CHAT_IMAGE_API_FORMAT_OPTIONS = [
  { value: "gemini_image", label: "Gemini Image" },
  { value: "gpt_image", label: "gptimage" },
];

const CHAT_IMAGE_INTERFACE_MODE_OPTIONS = {
  gemini_image: [
    { value: "native", label: "Gemini 原生" },
    { value: "openai_compat", label: "OpenAI Images 兼容" },
  ],
  gpt_image: [
    { value: "unified", label: "统一接口 (/v1/images/generations)" },
    { value: "split", label: "分离接口 (/v1/images/edits)" },
  ],
};

function isCometApiManagedChannel(channelOrId) {
  const id = typeof channelOrId === "string" ? channelOrId : channelOrId?.id;
  return String(id || "").startsWith("cometapi_");
}

function isCometApiManagedModel(channelOrId, modelOrId) {
  const channelId = typeof channelOrId === "string" ? channelOrId : channelOrId?.id;
  const modelId = typeof modelOrId === "string" ? modelOrId : modelOrId?.id;
  return isCometApiManagedChannel(channelId) && String(modelId || "").startsWith(`${channelId}__`);
}

function getSelectionAssistantConfig(config) {
  if (!config.selection_assistant || typeof config.selection_assistant !== "object") {
    config.selection_assistant = { enabled: false, channel_id: "", model_id: "" };
  }
  return config.selection_assistant;
}

function getSelectionTextChannels(config) {
  return (config?.channels || [])
    .filter((channel) => channel?.enabled)
    .map((channel) => ({
      ...channel,
      models: (channel.models || []).filter((model) => normalizeModelCategory(model.category, model.api_format, model.name) === "llm"),
    }))
    .filter((channel) => channel.models.length > 0);
}

function ensureSelectionAssistantModel(config) {
  const assistant = getSelectionAssistantConfig(config);
  const channels = getSelectionTextChannels(config);
  if (!channels.length) {
    assistant.channel_id = "";
    assistant.model_id = "";
    return { assistant, channels, channel: null, model: null };
  }
  let channel = channels.find((item) => item.id === assistant.channel_id) || null;
  if (!channel) {
    channel = channels[0];
    assistant.channel_id = channel.id;
  }
  let model = channel.models.find((item) => item.id === assistant.model_id) || null;
  if (!model) {
    model = channel.models[0];
    assistant.model_id = model?.id || "";
  }
  return { assistant, channels, channel, model };
}

function renderImageOverlayControls(messageId, fileIndex) {
  const safeMessageId = escapeHtml(messageId || "");
  if (!safeMessageId) return "";
  return `
    <div class="cc-msg-image-actions">
      <button class="cc-msg-image-action" type="button" data-action="copy-image" data-message-id="${safeMessageId}" data-file-index="${fileIndex}" title="复制图片" aria-label="复制图片">
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"></rect><path d="M5 15V6a2 2 0 0 1 2-2h9"></path></svg>
      </button>
      <button class="cc-msg-image-action" type="button" data-action="download-image" data-message-id="${safeMessageId}" data-file-index="${fileIndex}" title="下载图片" aria-label="下载图片">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12"></path><path d="m7 10 5 5 5-5"></path><path d="M5 21h14"></path></svg>
      </button>
    </div>
  `;
}

function renderImagePagerMarkup(messageId, activeIndex, total) {
  if (!messageId || total <= 1) return "";
  const safeMessageId = escapeHtml(messageId || "");
  const current = Math.min(Math.max(Math.round(Number(activeIndex) || 0), 0), total - 1);
  const previousDisabled = current <= 0 ? "disabled" : "";
  const nextDisabled = current >= total - 1 ? "disabled" : "";
  return `
    <div class="cc-msg-image-pager">
      <button class="cc-msg-image-page-btn" type="button" data-action="image-page-prev" data-message-id="${safeMessageId}" ${previousDisabled} title="上一张" aria-label="上一张">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"></path></svg>
      </button>
      <span>${current + 1} / ${total}</span>
      <button class="cc-msg-image-page-btn" type="button" data-action="image-page-next" data-message-id="${safeMessageId}" ${nextDisabled} title="下一张" aria-label="下一张">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg>
      </button>
    </div>
  `;
}

function renderImageTag(file, style, alt = "图片") {
  const url = escapeHtml(getPreviewUrl(file));
  const fallbackUrl = getPreviewFallbackUrl(file);
  const fallbackAttr = fallbackUrl ? ` data-fallback-src="${escapeHtml(fallbackUrl)}"` : "";
  return `<img class="cc-msg-image-media" src="${url}"${fallbackAttr} alt="${escapeHtml(alt)}" loading="lazy" style="${style}">`;
}

function isImageVariantFile(file) {
  return file?.category === "image" || file?.category === "image_error";
}

function getImageErrorText(file) {
  return String(file?.content || file?.preview_text || file?.original_name || file?.name || "图片生成失败").trim();
}

function renderImageCarousel(entries, options = {}) {
  const messageId = options?.messageId || "";
  if (!entries.length) return "";
  const fallbackIndex = entries.length - 1;
  const activeImageIndex = Number.isFinite(Number(options?.activeImageIndex))
    ? Number(options.activeImageIndex)
    : fallbackIndex;
  const activeIndex = Math.min(Math.max(Math.round(activeImageIndex), 0), entries.length - 1);
  const activeEntry = entries[activeIndex] || entries[fallbackIndex];
  const file = activeEntry.file;
  if (file?.category === "image_error") {
    const errorText = escapeHtml(getImageErrorText(file)).replace(/\n/g, "<br>");
    return `
      <div class="cc-msg-image-carousel" data-message-id="${escapeHtml(messageId)}">
        <div class="cc-msg-image-error-page">${errorText}</div>
      </div>
    `;
  }
  const url = escapeHtml(getPreviewUrl(file));
  const canOpen = file.type !== "local_text" && file.type !== "inline_text" && !!file.name;
  const mediaStyle = "max-height: 480px; max-width: 100%; object-fit: contain; display: block; border-radius: 12px; background: rgba(0,0,0,0.1);";
  const img = renderImageTag(file, mediaStyle);
  const imageBody = canOpen
    ? `<div class="cc-msg-image-shell"><a class="cc-msg-image-link" href="${url}" target="_blank" rel="noreferrer">${img}</a>${renderImageOverlayControls(messageId, activeEntry.index)}</div>`
    : `<div class="cc-msg-image-shell">${img}${renderImageOverlayControls(messageId, activeEntry.index)}</div>`;
  return `
    <div class="cc-msg-image-carousel" data-message-id="${escapeHtml(messageId)}">
      <div class="cc-msg-attach-single">${imageBody}</div>
    </div>
  `;
}

function renderMessageAttachments(files = [], options = {}) {
  if (!files.length) return "";
  const messageId = options?.messageId || "";
  const imageVariantEntries = files
    .map((file, index) => ({ file, index }))
    .filter((entry) => isImageVariantFile(entry.file));
  if (options?.variantCarousel && imageVariantEntries.length && imageVariantEntries.length === files.length) {
    return renderImageCarousel(imageVariantEntries, options);
  }

  const visualFiles = files.filter(f => f.category === "image" || f.category === "video");
  const isSingleVisual = files.length === 1 && visualFiles.length === 1;

  if (isSingleVisual) {
    const file = files[0];
    const isVideo = file.category === "video";
    const url = escapeHtml(getPreviewUrl(file));
    const canOpen = file.type !== "local_text" && file.type !== "inline_text" && !!file.name;
    
    let content;
    const mediaStyle = "max-height: 200px; max-width: 100%; object-fit: contain; display: block; border-radius: 12px; background: rgba(0,0,0,0.1);";
    if (isVideo) {
      content = `<video src="${url}" controls preload="metadata" style="${mediaStyle}"></video>`;
    } else {
      const img = renderImageTag(file, mediaStyle);
      content = canOpen
        ? `<div class="cc-msg-image-shell"><a class="cc-msg-image-link" href="${url}" target="_blank" rel="noreferrer">${img}</a>${renderImageOverlayControls(messageId, 0)}</div>`
        : `<div class="cc-msg-image-shell">${img}${renderImageOverlayControls(messageId, 0)}</div>`;
    }

    const wrapStyle = "display: block; margin-bottom: 12px; max-width: 100%;";
    if (!isVideo) return `<div class="cc-msg-attach-single" style="${wrapStyle}">${content}</div>`;
    return canOpen 
      ? `<a class="cc-msg-attach-single" href="${url}" target="_blank" rel="noreferrer" style="${wrapStyle}">${content}</a>`
      : `<div class="cc-msg-attach-single" style="${wrapStyle}">${content}</div>`;
  }

  const cards = files.map((file, index) => {
    const isVisual = file.category === "image" || file.category === "video";
    const isVideo = file.category === "video";
    const fileName = escapeHtml(file.original_name || file.name || "attachment");
    const url = escapeHtml(getPreviewUrl(file));
    const canOpen = file.type !== "local_text" && file.type !== "inline_text" && !!file.name;

    let innerHtml = "";

    if (isVisual) {
      if (isVideo) {
         const durationScript = `if(!isNaN(this.duration)&&isFinite(this.duration)){const m=Math.floor(this.duration/60);const s=Math.floor(this.duration%60).toString().padStart(2,'0');const span=this.nextElementSibling.querySelector('span');if(span)span.textContent=m+':'+s;}`;
         innerHtml = `
           <div class="cc-msg-attach-thumb" style="position: relative; width: 80px; height: 80px; border-radius: 16px; overflow: hidden; border: 1px solid var(--cc-border);">
             <video src="${url}" muted preload="metadata" onloadedmetadata="${durationScript}" style="width: 100%; height: 100%; object-fit: cover; display: block;"></video>
             <div class="cc-msg-attach-video-badge" style="position: absolute; bottom: 6px; left: 6px; background: rgba(0,0,0,0.65); color: #fff; font-size: 11px; font-weight: 600; padding: 2px 6px; border-radius: 8px; display: flex; align-items: center; gap: 3px; backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); letter-spacing: 0.2px;">
               <span>0:00</span>
               <svg viewBox="0 0 24 24" style="width: 10px; height: 10px; fill: currentColor;"><path d="M8 5v14l11-7z"/></svg>
             </div>
           </div>
         `;
      } else {
         const img = renderImageTag(file, "width: 100%; height: 100%; object-fit: cover; display: block;");
         innerHtml = `
           <div class="cc-msg-attach-thumb" style="position: relative; width: 80px; height: 80px; border-radius: 16px; overflow: hidden; border: 1px solid var(--cc-border);">
             ${canOpen ? `<a class="cc-msg-image-link" href="${url}" target="_blank" rel="noreferrer">${img}</a>` : img}
             ${renderImageOverlayControls(messageId, index)}
           </div>
         `;
      }
    } else {
      const extStr = String(file.original_name || file.name || "").split('.').pop().toLowerCase();
      const codeExts = ['py', 'js', 'json', 'md', 'html', 'css', 'ts', 'jsx', 'tsx', 'cpp', 'c', 'h', 'java', 'go', 'rs', 'php', 'sh', 'yaml', 'yml', 'ini', 'xml'];
      const tableExts = ['csv', 'tsv', 'xlsx', 'xls'];
      
      let iconSvg = '';
      if (file.category === "text" || file.category === "document" || codeExts.includes(extStr) || tableExts.includes(extStr) || extStr === 'pdf') {
        iconSvg = `<svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:none;fill:#4285f4;flex:0 0 auto;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/><path d="M13 9V3.5L18.5 9H13z" fill="#bbdefb"/><path d="M8 14h8v2H8zm0-4h8v2H8zm0 8h4v2H8z" fill="#ffffff"/></svg>`;
        
        if (codeExts.includes(extStr)) {
          iconSvg = `<svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:#ea4335;stroke:none;flex:0 0 auto;"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M10 16l-4-4 4-4M14 8l4 4-4 4" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        } else if (tableExts.includes(extStr)) {
          iconSvg = `<svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:#34a853;stroke:none;flex:0 0 auto;"><rect x="2" y="4" width="20" height="16" rx="3"/><path d="M10 8v8H5V8h5zm1 0h8v2h-8V8zm0 3h8v2h-8v-2zm0 3h8v2h-8v-2z" fill="#fff"/><path d="M6 10l3 4M9 10l-3 4" stroke="#34a853" stroke-width="1.5" stroke-linecap="round"/></svg>`;
        }
      } else {
        iconSvg = file.category === "audio"
          ? `<svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:currentColor;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round;color:#f28b82;flex:0 0 auto;"><path d="M3 18v-6a9 9 0 0 1 18 0v6"></path><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path></svg>`
          : `<svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:currentColor;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round;color:#a8c7fa;flex:0 0 auto;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`;
      }

      let typeLabel = extStr.toUpperCase();
      if (!extStr || !String(file.original_name || file.name || "").includes('.')) {
          typeLabel = getFileCategoryLabel(file.category).toUpperCase();
      }

      innerHtml = `
        <div class="cc-msg-attach-file" style="display: flex; flex-direction: column; justify-content: center; gap: 8px; height: 80px; width: 160px; padding: 0 16px; border-radius: 16px; background: var(--cc-bg-surface); border: 1px solid var(--cc-border); box-sizing: border-box;">
          <div class="cc-msg-attach-name" title="${fileName}" style="font-size: 14px; font-weight: 500; color: var(--cc-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.3;">${fileName}</div>
          <div class="cc-msg-attach-type" style="display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; color: var(--cc-text-secondary); line-height: 1;">
            ${iconSvg}
            <span>${typeLabel}</span>
          </div>
        </div>
      `;
    }

    if (isVisual && !isVideo) {
      return `<div class="cc-msg-attach-item" style="display: block; flex: 0 0 auto; text-decoration: none;">${innerHtml}</div>`;
    }

    return canOpen 
      ? `<a class="cc-msg-attach-item" href="${url}" target="_blank" rel="noreferrer" style="display: block; flex: 0 0 auto; text-decoration: none;">${innerHtml}</a>`
      : `<div class="cc-msg-attach-item" style="cursor:default; display: block; flex: 0 0 auto;">${innerHtml}</div>`;
  }).join("");

  return `<div class="cc-msg-attach-row" style="display: flex; gap: 10px; flex-wrap: nowrap; overflow-x: auto; margin-bottom: 12px; padding-bottom: 6px; max-width: 100%;">${cards}</div>`;
}

export function createMessageElement(message, options = false) {
  const compact = typeof options === "boolean" ? options : !!options?.compact;
  const isAssistant = message.role === "assistant";
  const isUser = message.role === "user";
  const hasFiles = !!message.files?.length;
  const imageEntries = (message.files || [])
    .map((file, index) => ({ file, index }))
    .filter((entry) => entry.file?.category === "image");
  const imageVariantEntries = (message.files || [])
    .map((file, index) => ({ file, index }))
    .filter((entry) => isImageVariantFile(entry.file));
  const hasImageContent = imageEntries.length > 0;
  const hasImageVariantContent = imageVariantEntries.length > 0;
  const hasImageErrorContent = imageVariantEntries.some((entry) => entry.file?.category === "image_error");
  const rawText = String(message.text || "").trim();
  const isStaleImagePendingText = isAssistant && !message.streaming && hasImageVariantContent && rawText === "正在生成图片...";
  const hasTextContent = rawText.length > 0 && !isStaleImagePendingText;
  const hideFilesWhileStreaming = isAssistant && message.streaming && hasImageVariantContent;
  const shouldRenderFiles = hasFiles && !hideFilesWhileStreaming;
  const shouldRenderBubble = hasTextContent || message.streaming || message.tone === "error" || !shouldRenderFiles;
  const activeVariantIndex = Number.isFinite(Number(message.imageIndex))
    ? Math.min(Math.max(Math.round(Number(message.imageIndex)), 0), Math.max(imageVariantEntries.length - 1, 0))
    : Math.max(imageVariantEntries.length - 1, 0);

  const canCopy = !compact && !message.streaming && (hasTextContent || hasImageContent || hasImageErrorContent); 
  const canRegenerate = !compact && !message.streaming && isAssistant && !!options?.canRegenerate;
  
  const wrap = document.createElement("div");
  wrap.className = `cc-msg ${isUser ? "user" : "assistant"} cc-workspace-msg`;

  const role = document.createElement("div");
  role.className = "cc-role";
  role.textContent = message.label || (isUser ? "你" : "助手");
  wrap.appendChild(role);

  if (shouldRenderFiles) {
    const attachContainer = document.createElement("div");
    attachContainer.style.display = "flex";
    attachContainer.style.flexDirection = "column";
    attachContainer.style.alignItems = isUser ? "flex-end" : "flex-start";
    attachContainer.style.width = "100%";
    attachContainer.innerHTML = renderMessageAttachments(message.files, {
      messageId: message.id,
      activeImageIndex: activeVariantIndex,
      variantCarousel: isAssistant,
    });
    wrap.appendChild(attachContainer);
  }

  let bubble = null;
  if (shouldRenderBubble) {
    bubble = document.createElement("div");
    bubble.className = "cc-bubble";
    if (message.tone === "error") bubble.classList.add("error");

    const text = isStaleImagePendingText ? "" : (message.text || (message.streaming ? "正在思考..." : ""));
    const textHtml = isAssistant
      ? parseMarkdown(text || (message.streaming ? "正在思考..." : ""))
      : escapeHtml(text || "").replace(/\n/g, "<br>");

    bubble.innerHTML = textHtml || "<span style='color:var(--cc-text-secondary)'>空消息。</span>";
  }

  let actions = null;
  if (canCopy || canRegenerate) {
    actions = document.createElement("div");
    actions.className = "cc-msg-actions";
    actions.style.opacity = "0";
    actions.style.visibility = "hidden";
    actions.style.transition = "opacity 0.2s, visibility 0.2s";

    wrap.addEventListener("mouseenter", () => {
      actions.style.opacity = "1";
      actions.style.visibility = "visible";
    });
    wrap.addEventListener("mouseleave", () => {
      actions.style.opacity = "0";
      actions.style.visibility = "hidden";
    });

    if (canCopy) {
      const copyButton = document.createElement("button");
      copyButton.className = "cc-msg-action";
      copyButton.type = "button";
      copyButton.dataset.action = "copy-message";
      copyButton.dataset.messageId = message.id || "";
      
      if (isUser) {
        copyButton.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" style="width:16px;height:16px;stroke:currentColor;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round;"><rect x="9" y="9" width="11" height="11" rx="2"></rect><path d="M5 15V6a2 2 0 0 1 2-2h9"></path></svg>`;
        copyButton.title = "复制";
        copyButton.style.padding = "0";
        copyButton.style.width = "30px";
        copyButton.style.height = "30px";
        copyButton.style.borderRadius = "50%";
      } else {
        copyButton.innerHTML = `
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"></rect><path d="M5 15V6a2 2 0 0 1 2-2h9"></path></svg>
          <span>复制</span>
        `;
      }
      actions.appendChild(copyButton);
    }

    if (canRegenerate) {
      const regenerateButton = document.createElement("button");
      regenerateButton.className = "cc-msg-action";
      regenerateButton.type = "button";
      regenerateButton.dataset.action = "regenerate-message";
      regenerateButton.dataset.messageId = message.id || "";
      regenerateButton.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
        <span>重新生成</span>
      `;
      actions.appendChild(regenerateButton);
    }

    if (isAssistant && hasImageVariantContent && imageVariantEntries.length > 1) {
      const pager = document.createElement("div");
      pager.className = "cc-msg-actions-pager";
      pager.innerHTML = renderImagePagerMarkup(message.id || "", activeVariantIndex, imageVariantEntries.length);
      actions.appendChild(pager);
      actions.classList.add("has-image-pager");
    }
  }

  if (isUser) {
    const rowWrap = document.createElement("div");
    rowWrap.style.display = "flex";
    rowWrap.style.alignItems = "center"; 
    rowWrap.style.justifyContent = "flex-end";
    rowWrap.style.gap = "8px";
    rowWrap.style.width = "100%";
    
    if (actions) {
      actions.style.marginTop = "0";
      actions.style.paddingLeft = "0";
      rowWrap.appendChild(actions);
    }
    if (bubble) rowWrap.appendChild(bubble);
    wrap.appendChild(rowWrap);
  } else {
    if (bubble) wrap.appendChild(bubble);
    if (actions) wrap.appendChild(actions);
  }

  return wrap;
}

export function createWorkspaceFileCard(file, onRemove) {
  const isMedia = file.category === "image" || file.category === "video";
  const card = document.createElement("div");
  card.className = `cc-file-card ${isMedia ? 'media' : 'doc'}`;

  const removeButton = document.createElement("button");
  removeButton.className = "cc-file-remove";
  removeButton.type = "button";
  removeButton.innerHTML = `<svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"></path></svg>`;
  
  removeButton.style.top = "4px";
  removeButton.style.right = "4px";
  removeButton.style.opacity = "0";
  removeButton.style.visibility = "hidden";
  removeButton.style.transition = "opacity 0.2s, visibility 0.2s, background 0.2s, color 0.2s";
  
  removeButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onRemove();
  });

  card.addEventListener("mouseenter", () => {
    removeButton.style.opacity = "1";
    removeButton.style.visibility = "visible";
  });
  card.addEventListener("mouseleave", () => {
    removeButton.style.opacity = "0";
    removeButton.style.visibility = "hidden";
  });

  card.appendChild(removeButton);

  if (isMedia) {
    const thumb = document.createElement("div");
    thumb.className = "cc-file-thumb";
    if (file.category === "image") {
      const image = document.createElement("img");
      image.src = getPreviewUrl(file);
      image.alt = file.original_name || file.name;
      thumb.appendChild(image);
    } else if (file.category === "video") {
      const video = document.createElement("video");
      video.src = getPreviewUrl(file);
      video.muted = true;
      video.preload = "metadata";
      thumb.appendChild(video);
      thumb.classList.add("is-video"); 
      
      const duration = document.createElement("div");
      duration.className = "cc-file-duration";
      duration.textContent = "0:06";
      thumb.appendChild(duration);
    }
    card.appendChild(thumb);
  } else {
    card.style.flexDirection = "column";
    card.style.alignItems = "flex-start";
    card.style.justifyContent = "center";
    card.style.gap = "8px";
    card.style.padding = "0 16px";
    card.style.width = "160px";

    const extStr = String(file.original_name || file.name || "").split('.').pop().toLowerCase();
    const codeExts = ['py', 'js', 'json', 'md', 'html', 'css', 'ts', 'jsx', 'tsx', 'cpp', 'c', 'h', 'java', 'go', 'rs', 'php', 'sh', 'yaml', 'yml', 'ini', 'xml'];
    const tableExts = ['csv', 'tsv', 'xlsx', 'xls'];
    
    let iconSvg = '';
    if (file.category === "text" || file.category === "document" || codeExts.includes(extStr) || tableExts.includes(extStr) || extStr === 'pdf') {
      iconSvg = `<svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:none;fill:#4285f4;flex:0 0 auto;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/><path d="M13 9V3.5L18.5 9H13z" fill="#bbdefb"/><path d="M8 14h8v2H8zm0-4h8v2H8zm0 8h4v2H8z" fill="#ffffff"/></svg>`;
      
      if (codeExts.includes(extStr)) {
        iconSvg = `<svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:#ea4335;stroke:none;flex:0 0 auto;"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M10 16l-4-4 4-4M14 8l4 4-4 4" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      } else if (tableExts.includes(extStr)) {
        iconSvg = `<svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:#34a853;stroke:none;flex:0 0 auto;"><rect x="2" y="4" width="20" height="16" rx="3"/><path d="M10 8v8H5V8h5zm1 0h8v2h-8V8zm0 3h8v2h-8v-2zm0 3h8v2h-8v-2z" fill="#fff"/><path d="M6 10l3 4M9 10l-3 4" stroke="#34a853" stroke-width="1.5" stroke-linecap="round"/></svg>`;
      }
    } else {
      iconSvg = file.category === "audio"
        ? `<svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:currentColor;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round;color:#f28b82;flex:0 0 auto;"><path d="M3 18v-6a9 9 0 0 1 18 0v6"></path><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path></svg>`
        : `<svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:currentColor;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round;color:#a8c7fa;flex:0 0 auto;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`;
    }

    let typeLabel = extStr.toUpperCase();
    if (!extStr || !String(file.original_name || file.name || "").includes('.')) {
        typeLabel = getFileCategoryLabel(file.category).toUpperCase();
    }

    const name = document.createElement("div");
    name.className = "cc-file-name";
    name.textContent = file.original_name || file.name;
    name.title = file.original_name || file.name;
    name.style.fontSize = "14px";
    name.style.fontWeight = "500";
    name.style.color = "var(--cc-text-primary)";
    name.style.whiteSpace = "nowrap";
    name.style.overflow = "hidden";
    name.style.textOverflow = "ellipsis";
    name.style.lineHeight = "1.3";
    name.style.width = "100%";

    const type = document.createElement("div");
    type.className = "cc-file-type";
    type.style.display = "flex";
    type.style.alignItems = "center";
    type.style.gap = "8px";
    type.style.fontSize = "12px";
    type.style.fontWeight = "600";
    type.style.color = "var(--cc-text-secondary)";
    type.style.lineHeight = "1";
    type.style.padding = "0";
    type.style.background = "transparent";

    type.innerHTML = `
      ${iconSvg}
      <span>${escapeHtml(typeLabel)}</span>
    `;

    card.appendChild(name);
    card.appendChild(type);
  }

  return card;
}

export function setSendButtonState(button, isStreaming) {
  button.classList.toggle("is-streaming", !!isStreaming);
  button.setAttribute("aria-label", isStreaming ? "停止生成" : "发送消息");
  button.title = isStreaming ? "停止生成" : "发送消息";
  button.innerHTML = isStreaming
    ? '<span class="cc-stop-square" aria-hidden="true"></span>'
    : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5"></path><path d="M7 10L12 5L17 10"></path></svg>`;
}

export function openFilePicker(fileInput) {
  if (!fileInput) return;
  fileInput.value = "";
  try {
    if (typeof fileInput.showPicker === "function") fileInput.showPicker();
    else fileInput.click();
  } catch (_) {
    fileInput.click();
  }
}

export function getActiveGraphRef() {
  return app.graph || app.canvas?.graph || null;
}

export function getWorkspaceHostElement() {
  const canvasElement = app.canvas?.canvas || document.querySelector("canvas");
  if (canvasElement instanceof HTMLElement) {
    const ancestors = [];
    let current = canvasElement.parentElement;
    while (current && current !== document.body && ancestors.length < 10) {
      ancestors.push(current);
      current = current.parentElement;
    }

    const preferred = ancestors.find((element) => {
      if (!(element instanceof HTMLElement) || element.clientWidth <= 0 || element.clientHeight <= 0) return false;
      const rect = element.getBoundingClientRect();
      return rect.top > 4 || rect.left > 4 || rect.width < window.innerWidth - 12 || rect.height < window.innerHeight - 12;
    });
    if (preferred) return preferred;

    const fallback = ancestors.find((element) => element instanceof HTMLElement && element.clientWidth > 0 && element.clientHeight > 0);
    if (fallback) return fallback;
  }
  return document.body;
}

export function prepareWorkspaceHost(host) {
  if (!(host instanceof HTMLElement)) return document.body;
  if (host !== document.body && window.getComputedStyle(host).position === "static") {
    host.style.position = "relative";
  }
  return host;
}

export function applyWorkspaceInset(shell, host) {
  const isBodyHost = host === document.body;
  shell.classList.toggle("is-body-host", isBodyHost);
  shell.classList.toggle("is-embedded-host", !isBodyHost);
  shell.style.setProperty("--cc-shell-top", isBodyHost ? "24px" : "24px");
  shell.style.setProperty("--cc-shell-right", isBodyHost ? "24px" : "24px");
  shell.style.setProperty("--cc-shell-bottom", isBodyHost ? "24px" : "24px");
  shell.style.setProperty("--cc-shell-left", isBodyHost ? "24px" : "24px");
}

export function getGlobalLauncherIconMarkup() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
    </svg>
  `;
}

export function createWorkspaceShell() {
  let shell = document.getElementById(WORKSPACE_ID);
  if (!shell) {
    shell = document.createElement("div");
    shell.id = WORKSPACE_ID;
    shell.className = "cc-workspace-shell";
    shell.innerHTML = `
      <div class="cc-workspace-backdrop" data-action="close-workspace"></div>
      <div class="cc-workspace-panel">
        <div class="cc-compact-sidebar-backdrop" data-action="close-compact-sidebar"></div>
        
        <aside class="cc-sidebar">
          <div class="cc-sidebar-header cc-workspace-drag-zone" data-drag-handle="workspace">
            <button class="cc-icon-btn" style="background:transparent;border:none" type="button" data-action="toggle-sidebar" title="展开或收起侧边栏">
              <svg viewBox="0 0 24 24" style="width:20px;height:20px;stroke:currentColor;stroke-width:2;fill:none;stroke-linecap:round;"><path d="M3 12h18M3 6h18M3 18h18"></path></svg>
            </button>
          </div>
          
          <div class="cc-sidebar-body">
            <div style="padding: 12px 0;">
              <button class="cc-new-chat-btn" type="button" data-action="new-session" title="发起新对话">
                <svg viewBox="0 0 24 24" style="stroke:currentColor;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                <span class="cc-sidebar-text">发起新对话</span>
              </button>
            </div>
            
            <div class="cc-session-list-wrapper">
              <div class="cc-session-group-title">对话</div>
              <div class="cc-session-list"></div>
            </div>
          </div>
          
          <div class="cc-sidebar-footer">
            <button class="cc-settings-btn cc-sidebar-layout-toggle cc-layout-toggle-btn" type="button" data-action="toggle-compact-mode" title="切换半屏模式" aria-label="切换半屏模式" aria-pressed="false">
              <svg class="cc-layout-icon-compact" viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="3"></rect><path d="M13 5v14"></path></svg>
              <svg class="cc-layout-icon-full" viewBox="0 0 24 24"><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"></path></svg>
              <span class="cc-sidebar-text">半屏模式</span>
            </button>
            <button class="cc-settings-btn" type="button" data-action="open-settings-modal" title="设置和帮助">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              <span class="cc-sidebar-text">设置和帮助</span>
            </button>
          </div>
        </aside>

        <main class="cc-main">
          <div class="cc-main-top cc-workspace-drag-zone" data-drag-handle="workspace">
            <button class="cc-window-btn cc-compact-menu-btn" type="button" data-action="open-compact-sidebar" title="打开对话列表" aria-label="打开对话列表">
              <svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"></path></svg>
            </button>
            
            <div class="cc-main-top-actions">
              <div class="cc-main-badges">
                <button class="cc-model-trigger" type="button" data-action="toggle-model-selector" id="cc-model-selector-trigger" title="切换模型与渠道">
                  <span class="cc-model-trigger-text">未选择模型</span>
                  <span class="cc-model-trigger-sep">|</span>
                  <span class="cc-model-trigger-channel">默认渠道</span>
                  <svg class="cc-model-trigger-chevron" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>
                
                <span class="cc-badge cc-main-status" data-kind="ready"><span class="cc-badge-dot"></span><span class="cc-main-status-text"></span></span>
                
                <div class="cc-model-popup" id="cc-model-popup">
                </div>
              </div>

              <div class="cc-window-actions">
                <button class="cc-window-btn cc-layout-toggle-btn" type="button" data-action="toggle-compact-mode" title="切换半屏模式" aria-label="切换半屏模式" aria-pressed="false">
                  <svg class="cc-layout-icon-compact" viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="3"></rect><path d="M13 5v14"></path></svg>
                  <svg class="cc-layout-icon-full" viewBox="0 0 24 24"><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"></path></svg>
                </button>
                <button class="cc-window-btn" type="button" data-action="close-workspace" title="关闭对话" aria-label="关闭对话">
                  <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"></path></svg>
                </button>
              </div>
            </div>
            
          </div>
          <div class="cc-chat-messages"></div>
          
          <div class="cc-compose">
            <div class="cc-compose-container">
              <div class="cc-compose-files"></div>
              <textarea class="cc-workspace-input" placeholder="输入消息...（Shift+Enter 换行）"></textarea>
              <div class="cc-compose-toolbar">
                <div class="cc-compose-toolbar-left">
                  <button class="cc-toolbar-btn" type="button" data-action="workspace-add-file" title="上传文件">
                    <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"></path></svg>
                  </button>
                </div>
                <div class="cc-compose-toolbar-right">
                  <button class="cc-send-btn" type="button" data-action="workspace-send"></button>
                </div>
              </div>
            </div>
            <div class="cc-compose-tip">支持图片 / PDF / 音频 / 视频 / 纯文本 · 全局快捷对话中枢</div>
            <input class="cc-hidden" data-role="workspace-file-input" type="file" multiple accept="image/*,application/pdf,audio/*,video/*,text/*,.txt,.py,.js,.json,.md,.csv,.html,.css,.ts,.jsx,.tsx,.cpp,.c,.h,.java,.go,.rs,.php,.sh,.yaml,.yml,.ini,.log,.xml">
          </div>
        </main>
        
        <div class="cc-context-menu" id="cc-session-context-menu">
          <button type="button" data-context-action="pin">
            <svg viewBox="0 0 24 24"><path d="M16 11V7a4 4 0 0 0-8 0v4L5 14v2h14v-2l-3-3z"></path><path d="M12 16v6"></path></svg>
            <span class="cc-context-pin-text">固定</span>
          </button>
          <button type="button" data-context-action="rename">
            <svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path></svg>
            <span>重命名</span>
          </button>
          <button type="button" data-context-action="delete">
            <svg viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            <span>删除</span>
          </button>
        </div>

        <div class="cc-settings-modal-backdrop">
          <div class="cc-settings-modal">
            <aside class="cc-settings-sidebar">
              <div class="cc-settings-sidebar-title">偏好设置</div>
              <button class="cc-settings-nav-btn is-active" data-tab="general">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                基础设置
              </button>
              <button class="cc-settings-nav-btn" data-tab="channels">
                <svg viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
                渠道管理
              </button>
              <button class="cc-settings-nav-btn" data-tab="presets">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
                格式预设
              </button>
              <button class="cc-settings-nav-btn" data-tab="selection">
                <svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h10M4 17h7"></path><path d="m16 14 4 4M20 14l-4 4"></path></svg>
                划词助手
              </button>
              <button class="cc-settings-nav-btn" data-tab="about">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                关于
              </button>
              
              <button class="cc-settings-return-btn" type="button" data-action="close-settings-modal" style="margin-top: auto;" title="返回并保存">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                返回
              </button>
            </aside>
            
            <main class="cc-settings-content">
              <!-- Panel: General -->
              <div class="cc-settings-panel is-active" id="cc-panel-general">
                <div class="cc-settings-panel-inner">
                  <h3 class="cc-settings-panel-title">基础设置</h3>
                  <div class="cc-settings-field">
                    <label>系统提示词 (System Prompt)</label>
                    <textarea data-setting-field="system_prompt" placeholder="你是一个得力的 AI 助手..."></textarea>
                  </div>
                  <div class="cc-compose-tip" style="text-align:left; padding:0;">高级参数 (Token / Temperature) 已由底层自动寻优配置。</div>
                </div>
              </div>

              <!-- Panel: Channels -->
              <div class="cc-settings-panel" id="cc-panel-channels">
                <div class="cc-channels-layout">
                  <div class="cc-channels-list-pane">
                    <div class="cc-channel-list" id="cc-channel-list"></div>
                    <button class="cc-channel-add-btn" type="button" data-action="add-channel">
                      <svg viewBox="0 0 24 24" style="width:16px; height:16px; stroke:currentColor; stroke-width:2; fill:none;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                      添加渠道
                    </button>
                  </div>
                  <div class="cc-channels-editor-pane" id="cc-channel-editor">
                    <div class="cc-editor-header">
                      <h3 class="cc-editor-title" id="cc-editor-title">渠道设置</h3>
                      <div class="cc-editor-actions" id="cc-editor-actions"></div>
                    </div>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 24px;">
                      <div class="cc-settings-field" style="grid-column: 1 / -1;">
                        <label>渠道别名</label>
                        <input data-channel-field="name" type="text" placeholder="例如：我的主API">
                      </div>
                      <div class="cc-settings-field" style="grid-column: 1 / -1;">
                        <label>API URL</label>
                        <input data-channel-field="api_url" type="text" placeholder="例如：https://api.openai.com/v1/chat/completions">
                      </div>
                      <div class="cc-settings-field" style="grid-column: 1 / -1;">
                        <label>渠道通用 API Key <span style="font-weight:normal; opacity:0.7;">(可选，若模型独立配置则覆盖此项)</span></label>
                        <input data-channel-field="api_key" type="password" placeholder="sk-...">
                      </div>
                      <div class="cc-settings-field" style="grid-column: 1 / -1;">
                        <label>配置模型列表</label>
                        <div class="cc-models-manager">
                           <div class="cc-models-body" id="cc-models-body"></div>
                           <button class="cc-model-add-btn" type="button" data-action="add-channel-model">
                             <svg viewBox="0 0 24 24" style="width:14px;height:14px;stroke:currentColor;stroke-width:2;fill:none;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> 添加模型
                           </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Panel: Presets -->
              <div class="cc-settings-panel" id="cc-panel-presets">
                <div class="cc-channels-layout">
                  <div class="cc-channels-list-pane">
                    <div class="cc-channel-list" id="cc-preset-list"></div>
                    <button class="cc-channel-add-btn" type="button" data-action="add-preset">
                      <svg viewBox="0 0 24 24" style="width:16px; height:16px; stroke:currentColor; stroke-width:2; fill:none;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                      添加预设
                    </button>
                  </div>
                  <div class="cc-channels-editor-pane" id="cc-preset-editor" style="display:none;">
                    <div class="cc-editor-header">
                      <h3 class="cc-editor-title" id="cc-preset-title">预设设置</h3>
                      <div class="cc-editor-actions" id="cc-preset-actions">
                         <button class="cc-icon-btn cc-delete-btn" type="button" data-action="delete-preset" title="删除此预设" style="width:30px;height:30px;">
                           <svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:var(--cc-error);stroke-width:2;fill:none;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                         </button>
                      </div>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:16px;">
                      <div class="cc-settings-field">
                        <label>预设名称</label>
                        <input type="text" id="cc-preset-name-input" placeholder="例如：某中转专有格式">
                      </div>
                      <div class="cc-settings-field">
                        <label>JSON 配置定义 <span style="font-weight:normal; opacity:0.7;">(请遵守格式规范)</span></label>
                        <textarea id="cc-preset-json-input" style="font-family:'JetBrains Mono', Consolas, monospace; min-height:360px; font-size:13px; line-height:1.5; white-space:pre; tab-size:2;"></textarea>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Panel: Selection Assistant -->
              <div class="cc-settings-panel" id="cc-panel-selection">
                <div class="cc-settings-panel-inner">
                  <h3 class="cc-settings-panel-title">划词助手</h3>
                  <div class="cc-selection-settings-card">
                    <div class="cc-selection-settings-head">
                      <div>
                        <div class="cc-selection-settings-title">启用划词助手</div>
                        <div class="cc-selection-settings-desc">选中文本后显示快捷横条，可翻译、解释、复制、优化提示词或打开 Chat 继续聊。</div>
                      </div>
                      <label class="cc-toggle" data-action="toggle-selection-assistant">
                        <input data-setting-field="selection_enabled" type="checkbox" tabindex="-1">
                        <span class="cc-toggle-slider"></span>
                      </label>
                    </div>
                  </div>
                  <div class="cc-settings-field">
                    <label>默认渠道</label>
                    <div data-setting-field="selection_channel"></div>
                  </div>
                  <div class="cc-settings-field">
                    <label>默认模型</label>
                    <div data-setting-field="selection_model"></div>
                  </div>
                  <div class="cc-compose-tip" data-setting-field="selection_hint" style="text-align:left; padding:0;"></div>
                </div>
              </div>

              <!-- Panel: About -->
              <div class="cc-settings-panel" id="cc-panel-about">
                <div class="cc-settings-panel-inner" style="align-items: center; justify-content: center; padding-top: 60px;">
                  <div class="cc-about-logo">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                  </div>
                  <h3 class="cc-about-title">CometChat</h3>
                  <p class="cc-about-desc">星空沉浸式对话工作台 · 为 ComfyUI 打造的顶级 AI 交互体验</p>
                  
                  <div class="cc-about-author" style="width: 100%; max-width: 480px;">
                    <div class="cc-author-info">
                      <div class="cc-author-avatar">✨</div>
                      <div class="cc-author-text">
                        <h4>那颗星星</h4>
                        <p>CometChat 核心开发者 & 独立创作者</p>
                      </div>
                    </div>
                    <a href="https://space.bilibili.com/3546882187987924?spm_id_from=333.40164.0.0" target="_blank" class="cc-bilibili-btn">
                      <svg viewBox="0 0 24 24" style="width:16px; height:16px; fill:currentColor;"><path d="M17.813 4.653h.854c1.51.054 2.769.578 3.773 1.574 1.004.995 1.524 2.249 1.56 3.76v7.36c-.036 1.51-.556 2.769-1.56 3.773s-2.262 1.524-3.773 1.56H5.333c-1.51-.036-2.769-.556-3.773-1.56S.036 18.858 0 17.347v-7.36c.036-1.511.556-2.765 1.56-3.76 1.004-.996 2.262-1.52 3.773-1.574h.774l-1.174-1.12a1.234 1.234 0 0 1-.373-.906c0-.356.124-.658.373-.907l.027-.027c.267-.249.573-.373.92-.373.347 0 .653.124.92.373L9.653 4.44c.071.071.134.142.187.213h4.267a.836.836 0 0 1 .16-.213l2.853-2.747c.267-.249.573-.373.92-.373.347 0 .662.124.947.373.284.249.426.551.426.907s-.142.65-.426.906l-1.174 1.147zM5.333 7.24c-.746.018-1.373.276-1.88.773-.506.498-.769 1.13-.786 1.894v7.52c.017.764.28 1.395.786 1.893.507.498 1.134.756 1.88.773h13.334c.746-.017 1.373-.275 1.88-.773.506-.498.769-1.129.786-1.893v-7.52c-.017-.765-.28-1.396-.786-1.894-.507-.497-1.134-.755-1.88-.773H5.333zM8 11.107c.373 0 .684.124.933.373.25.249.383.569.4.96v1.173c-.017.391-.15.711-.4.96-.249.25-.56.374-.933.374s-.684-.125-.933-.374c-.25-.249-.383-.569-.4-.96V12.44c0-.373.129-.689.386-.947.258-.257.574-.386.947-.386zm8 0c.373 0 .684.124.933.373.25.249.383.569.4.96v1.173c-.017.391-.15.711-.4.96-.249.25-.56.374-.933.374s-.684-.125-.933-.374c-.25-.249-.383-.569-.4-.96V12.44c0-.373.129-.689.386-.947.258-.257.574-.386.947-.386z"></path></svg>
                      关注 Bilibili
                    </a>
                  </div>
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>
    `;
  }

  const panelEl = shell.querySelector(".cc-workspace-panel");
  const settingsBackdropEl = shell.querySelector(".cc-settings-modal-backdrop");
  if (settingsBackdropEl && panelEl && settingsBackdropEl.parentElement !== panelEl) {
    panelEl.appendChild(settingsBackdropEl);
  }

  const refs = {
    shell,
    panel: shell.querySelector(".cc-workspace-panel"),
    compactSidebarBackdrop: shell.querySelector(".cc-compact-sidebar-backdrop"),
    layoutToggleButtons: shell.querySelectorAll(".cc-layout-toggle-btn"),
    sessionList: shell.querySelector(".cc-session-list"),
    modelTrigger: shell.querySelector("#cc-model-selector-trigger"),
    modelTriggerText: shell.querySelector(".cc-model-trigger-text"),
    modelTriggerChannel: shell.querySelector(".cc-model-trigger-channel"),
    modelPopup: shell.querySelector("#cc-model-popup"),

    status: shell.querySelector(".cc-main-status"),
    statusText: shell.querySelector(".cc-main-status-text"),
    messages: shell.querySelector(".cc-chat-messages"),
    files: shell.querySelector(".cc-compose-files"),
    composeContainer: shell.querySelector(".cc-compose-container"),
    textarea: shell.querySelector(".cc-workspace-input"),
    sendButton: shell.querySelector('[data-action="workspace-send"]'),
    fileInput: shell.querySelector('[data-role="workspace-file-input"]'),
    settingsModalBackdrop: shell.querySelector(".cc-settings-modal-backdrop"),
    sessionContextMenu: shell.querySelector("#cc-session-context-menu"),
    contextPinText: shell.querySelector(".cc-context-pin-text"),
    
    settingsNavBtns: shell.querySelectorAll(".cc-settings-nav-btn"),
    settingsPanels: shell.querySelectorAll(".cc-settings-panel"),
    channelListEl: shell.querySelector("#cc-channel-list"),
    channelEditorEl: shell.querySelector("#cc-channel-editor"),
    modelsBodyEl: shell.querySelector("#cc-models-body"),
  };

  const settingFields = {};
  shell.querySelectorAll("[data-setting-field]").forEach((element) => {
    settingFields[element.dataset.settingField] = element;
  });

  const channelFields = {};
  shell.querySelectorAll("[data-channel-field]").forEach((element) => {
    channelFields[element.dataset.channelField] = element;
  });

  return { shell, refs, settingFields, channelFields };
}

export function createGlobalLauncher(controller, workspaceDom, workspace, options = {}) {
  let button = document.getElementById(GLOBAL_LAUNCHER_ID);
  if (!button) {
    button = document.createElement("button");
    button.id = GLOBAL_LAUNCHER_ID;
    button.className = "cc-global-launcher";
    button.type = "button";
    button.innerHTML = getGlobalLauncherIconMarkup();
    button.title = "打开 CometChat 全局对话";
    button.setAttribute("aria-label", "打开 CometChat 全局对话");
    document.body.appendChild(button);
  }

  const launcherMenuId = `${GLOBAL_LAUNCHER_ID}-menu`;
  let menu = document.getElementById(launcherMenuId);
  if (!menu) {
    menu = document.createElement("div");
    menu.id = launcherMenuId;
    menu.className = "cc-launcher-menu";
    menu.setAttribute("role", "menu");
    menu.innerHTML = `
      <button type="button" role="menuitem" data-launcher-action="dismiss">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"></path><path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"></path><path d="m2 2 20 20"></path><path d="M9.88 9.88a3 3 0 0 0 4.24 4.24"></path></svg>
        <span>隐藏悬浮球</span>
      </button>
    `;
    document.body.appendChild(menu);
  }

  let launcherDragState = null;
  let suppressClick = false;
  let launcherStoredPosition = null;
  const launcherSize = 50;
  const launcherMargin = 16;
  const launcherEdgeEpsilon = 1;

  const isWorkspaceOpen = () => workspace.activePlugin === controller && workspaceDom.refs.shell.classList.contains("is-open");

  const closeLauncherMenu = () => {
    menu.classList.remove("is-open");
  };

  const canShowLauncher = () => options?.canShow?.() !== false;

  const openLauncherMenu = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (isWorkspaceOpen() || !canShowLauncher()) {
      closeLauncherMenu();
      return;
    }
    menu.classList.add("is-open");
    const rect = menu.getBoundingClientRect();
    const menuWidth = rect.width || 116;
    const menuHeight = rect.height || 40;
    const margin = 10;
    const left = Math.min(Math.max(event.clientX, margin), window.innerWidth - menuWidth - margin);
    const top = Math.min(Math.max(event.clientY, margin), window.innerHeight - menuHeight - margin);
    menu.style.left = `${Math.round(left)}px`;
    menu.style.top = `${Math.round(top)}px`;
  };

  const toggleWorkspace = () => {
    if (isWorkspaceOpen()) {
      workspace.close();
    } else {
      controller.openWorkspace();
    }
    syncState();
  };

  const getLauncherBounds = () => {
    const maxX = Math.max(launcherMargin, window.innerWidth - launcherSize - launcherMargin);
    const maxY = Math.max(launcherMargin, window.innerHeight - launcherSize - launcherMargin);
    return { minX: launcherMargin, minY: launcherMargin, maxX, maxY };
  };

  const launcherFiniteNumber = (value, fallback) => {
    const next = Number(value);
    return Number.isFinite(next) ? next : fallback;
  };

  const getDefaultLauncherPosition = () => ({
    x: 24,
    edgeY: "bottom",
    offsetY: Math.max(0, (window.innerHeight - launcherSize - launcherMargin) - (window.innerHeight - 82)),
  });

  const clampLauncherPosition = (x, y) => {
    const bounds = getLauncherBounds();
    return {
      x: Math.min(Math.max(Math.round(x), bounds.minX), bounds.maxX),
      y: Math.min(Math.max(Math.round(y), bounds.minY), bounds.maxY),
    };
  };

  const resolveLauncherPosition = (position) => {
    const source = position && typeof position === "object" ? position : getDefaultLauncherPosition();
    const bounds = getLauncherBounds();
    let x = launcherFiniteNumber(source.x, 24);
    let y = launcherFiniteNumber(source.y, window.innerHeight - 82);
    const offsetX = Math.max(0, launcherFiniteNumber(source.offsetX, 0));
    const offsetY = Math.max(0, launcherFiniteNumber(source.offsetY, 0));
    if (source.edgeX === "left") x = bounds.minX + offsetX;
    if (source.edgeX === "right") x = bounds.maxX - offsetX;
    if (source.edgeY === "top") y = bounds.minY + offsetY;
    if (source.edgeY === "bottom") y = bounds.maxY - offsetY;
    return clampLauncherPosition(x, y);
  };

  const upgradeLegacyLauncherPosition = (position) => {
    if (!position || typeof position !== "object" || position.version === 2) return position;
    const bounds = getLauncherBounds();
    const next = { ...position, version: 2 };
    const rawX = Number(position.x);
    const rawY = Number(position.y);
    if (!position.edgeX && Number.isFinite(rawX)) {
      if (Math.abs(rawX - bounds.minX) <= launcherEdgeEpsilon) {
        next.edgeX = "left";
        next.offsetX = 0;
      } else if (Math.abs(rawX - bounds.maxX) <= launcherEdgeEpsilon) {
        next.edgeX = "right";
        next.offsetX = 0;
      }
    }
    if (!position.edgeY && Number.isFinite(rawY)) {
      if (Math.abs(rawY - bounds.minY) <= launcherEdgeEpsilon) {
        next.edgeY = "top";
        next.offsetY = 0;
      } else if (Math.abs(rawY - bounds.maxY) <= launcherEdgeEpsilon) {
        next.edgeY = "bottom";
        next.offsetY = 0;
      }
    }
    return next;
  };

  const serializeLauncherPosition = (position) => {
    const bounds = getLauncherBounds();
    const next = clampLauncherPosition(position?.x ?? 24, position?.y ?? (window.innerHeight - 82));
    const saved = { version: 2, x: next.x, y: next.y };
    if (next.x <= bounds.minX + launcherEdgeEpsilon) {
      saved.edgeX = "left";
      saved.offsetX = 0;
    } else if (next.x >= bounds.maxX - launcherEdgeEpsilon) {
      saved.edgeX = "right";
      saved.offsetX = 0;
    }
    if (next.y <= bounds.minY + launcherEdgeEpsilon) {
      saved.edgeY = "top";
      saved.offsetY = 0;
    } else if (next.y >= bounds.maxY - launcherEdgeEpsilon) {
      saved.edgeY = "bottom";
      saved.offsetY = 0;
    }
    return saved;
  };

  const applyLauncherPosition = (position) => {
    const next = resolveLauncherPosition(position);
    button.style.left = `${next.x}px`;
    button.style.top = `${next.y}px`;
    button.style.bottom = "auto";
    return next;
  };

  const saveLauncherPosition = (position) => {
    launcherStoredPosition = serializeLauncherPosition(position);
    safeWriteJsonStorage(GLOBAL_LAUNCHER_POS_KEY, launcherStoredPosition);
  };

  const loadLauncherPosition = () => {
    const saved = safeReadJsonStorage(GLOBAL_LAUNCHER_POS_KEY, null);
    launcherStoredPosition = upgradeLegacyLauncherPosition(saved) || getDefaultLauncherPosition();
    return applyLauncherPosition(launcherStoredPosition);
  };

  const reapplyStoredLauncherPosition = () => {
    if (launcherDragState) return;
    launcherStoredPosition = upgradeLegacyLauncherPosition(launcherStoredPosition) || getDefaultLauncherPosition();
    applyLauncherPosition(launcherStoredPosition || getDefaultLauncherPosition());
  };

  const syncState = () => {
    const workspaceOpen = isWorkspaceOpen();
    button.classList.toggle("is-active", workspaceOpen);
    if (workspaceOpen || !canShowLauncher()) {
      closeLauncherMenu();
      button.style.display = "none";
      return;
    }
    button.style.display = "";
  };

  button.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    closeLauncherMenu();
    const rect = button.getBoundingClientRect();
    launcherDragState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: rect.left,
      originY: rect.top,
      moved: false,
    };
    button.classList.add("is-dragging");
    if (typeof button.setPointerCapture === "function") {
      try {
        button.setPointerCapture(event.pointerId);
      } catch (_) {}
    }
  });

  button.addEventListener("pointermove", (event) => {
    if (!launcherDragState || launcherDragState.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - launcherDragState.startX;
    const deltaY = event.clientY - launcherDragState.startY;
    if (!launcherDragState.moved && Math.hypot(deltaX, deltaY) >= 4) {
      launcherDragState.moved = true;
    }
    if (!launcherDragState.moved) return;
    applyLauncherPosition({
      x: launcherDragState.originX + deltaX,
      y: launcherDragState.originY + deltaY,
    });
  });

  const finishLauncherDrag = (event) => {
    if (!launcherDragState) return;
    if (event?.pointerId != null && launcherDragState.pointerId !== event.pointerId) return;
    if (typeof button.releasePointerCapture === "function") {
      try {
        button.releasePointerCapture(launcherDragState.pointerId);
      } catch (_) {}
    }
    button.classList.remove("is-dragging");
    if (launcherDragState.moved) {
      const finalPosition = applyLauncherPosition({
        x: launcherDragState.originX + (event.clientX - launcherDragState.startX),
        y: launcherDragState.originY + (event.clientY - launcherDragState.startY),
      });
      saveLauncherPosition(finalPosition);
      suppressClick = true;
      window.setTimeout(() => {
        suppressClick = false;
      }, 0);
    }
    launcherDragState = null;
  };

  button.addEventListener("pointerup", finishLauncherDrag);
  button.addEventListener("pointercancel", finishLauncherDrag);

  button.addEventListener("click", (event) => {
    closeLauncherMenu();
    if (suppressClick) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    toggleWorkspace();
  });

  button.addEventListener("contextmenu", openLauncherMenu);

  menu.addEventListener("click", (event) => {
    const actionButton = event.target?.closest?.("[data-launcher-action]");
    if (!actionButton || !menu.contains(actionButton)) return;
    event.preventDefault();
    event.stopPropagation();
    const action = actionButton.dataset.launcherAction;
    closeLauncherMenu();
    if (action === "dismiss") {
      options?.onDismiss?.();
    }
  });

  const handleOutsideLauncherMenuPointerDown = (event) => {
    if (!menu.classList.contains("is-open")) return;
    if (menu.contains(event.target) || button.contains(event.target)) return;
    closeLauncherMenu();
  };

  window.addEventListener("pointerdown", handleOutsideLauncherMenuPointerDown, true);
  document.addEventListener("pointerdown", handleOutsideLauncherMenuPointerDown, true);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeLauncherMenu();
    }
  });

  window.addEventListener("resize", () => {
    reapplyStoredLauncherPosition();
  });

  loadLauncherPosition();
  syncState();
  return { button, menu, syncState, closeMenu: closeLauncherMenu };
}

export function createWorkspaceManager({ shell, refs, settingFields, channelFields }) {
  let openSessionMenuId = null;
  let tempConfig = null;
  let editingChannelId = null;
  let editingPresetId = null;
  let tempEditingModels = []; 
  let isChannelEditorInitialized = false; 
  let isPresetEditorInitialized = false;
  let textMeasureCanvas = null;

  const presetJsonInput = shell.querySelector("#cc-preset-json-input");
  if (presetJsonInput) {
      presetJsonInput.addEventListener("input", () => {
          try {
              JSON.parse(presetJsonInput.value);
              presetJsonInput.style.borderColor = "var(--cc-border)";
          } catch(e) {
              presetJsonInput.style.borderColor = "var(--cc-error)";
          }
      });
      presetJsonInput.addEventListener("keydown", (e) => {
          if (e.key === "Tab") {
              e.preventDefault();
              const start = presetJsonInput.selectionStart;
              const end = presetJsonInput.selectionEnd;
              presetJsonInput.value = presetJsonInput.value.substring(0, start) + "  " + presetJsonInput.value.substring(end);
              presetJsonInput.selectionStart = presetJsonInput.selectionEnd = start + 2;
          }
      });
  }

  const manager = {
    refs,
    activePlugin: null,
    activeGraph: null,
    activeHost: null,
    watchTimer: null,
    requestedOpen: false,
    targetPluginId: null,
    targetBackendPluginId: null,
    layoutMode: "full",
    compactSidebarOpen: false,
    panelOffsetX: 0,
    panelOffsetY: 0,
    dragState: null,

    getPanelPositionKey() {
      return this.layoutMode === "compact" ? `${PANEL_POS_KEY}_compact` : `${PANEL_POS_KEY}_full`;
    },

    loadLayoutMode() {
      const saved = safeReadJsonStorage(LAYOUT_MODE_KEY, null);
      this.layoutMode = saved?.mode === "compact" ? "compact" : "full";
      this.applyLayoutMode();
    },

    saveLayoutMode() {
      safeWriteJsonStorage(LAYOUT_MODE_KEY, { mode: this.layoutMode });
    },

    isCompactMode() {
      return this.layoutMode === "compact";
    },

    syncSettingsModalPlacement() {
      const target = this.isCompactMode() ? refs.shell : refs.panel;
      if (refs.settingsModalBackdrop.parentElement !== target) {
        target.appendChild(refs.settingsModalBackdrop);
      }
    },

    applyLayoutMode() {
      const compact = this.isCompactMode();
      refs.shell.classList.toggle("is-compact-mode", compact);
      refs.panel.classList.toggle("is-compact-mode", compact);
      refs.panel.classList.toggle("is-compact-sidebar-open", compact && this.compactSidebarOpen);
      if (!compact) this.compactSidebarOpen = false;
      this.syncSettingsModalPlacement();
      refs.textarea.placeholder = compact ? "发消息..." : "输入消息...（Shift+Enter 换行）";
      this.updateComposerState();
      refs.layoutToggleButtons.forEach((button) => {
        button.setAttribute("aria-pressed", compact ? "true" : "false");
        button.title = compact ? "切换到大窗口" : "切换到半屏模式";
        button.setAttribute("aria-label", compact ? "切换到大窗口" : "切换到半屏模式");
      });
    },

    withLayoutTransition(applyChange) {
      const prefersReducedMotion = (() => {
        try {
          return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
        } catch (_) {
          return false;
        }
      })();
      if (prefersReducedMotion || !refs.shell.classList.contains("is-open")) {
        applyChange();
        return;
      }

      const first = refs.panel.getBoundingClientRect();
      applyChange();
      const last = refs.panel.getBoundingClientRect();
      const dx = first.left - last.left;
      const dy = first.top - last.top;
      const sx = last.width ? first.width / last.width : 1;
      const sy = last.height ? first.height / last.height : 1;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(sx - 1) < 0.01 && Math.abs(sy - 1) < 0.01) return;

      const fromTransform = `translate3d(calc(var(--cc-panel-offset-x) + ${dx}px), calc(var(--cc-panel-offset-y) + ${dy}px), 0) scale(${sx}, ${sy})`;
      const toTransform = "translate3d(var(--cc-panel-offset-x), var(--cc-panel-offset-y), 0) scale(1)";
      let done = false;
      let fallbackTimer = null;
      const cleanup = () => {
        if (done) return;
        done = true;
        if (fallbackTimer) window.clearTimeout(fallbackTimer);
        refs.panel.removeEventListener("transitionend", onEnd);
        refs.panel.classList.remove("is-layout-transitioning");
        refs.panel.style.removeProperty("transform-origin");
        refs.panel.style.removeProperty("transition");
        refs.panel.style.removeProperty("transform");
        this.ensurePanelWithinBounds();
      };
      const onEnd = (event) => {
        if (event.target === refs.panel && event.propertyName === "transform") cleanup();
      };

      refs.panel.classList.add("is-layout-transitioning");
      refs.panel.style.transformOrigin = "top left";
      refs.panel.style.transition = "none";
      refs.panel.style.transform = fromTransform;
      refs.panel.getBoundingClientRect();
      window.requestAnimationFrame(() => {
        refs.panel.addEventListener("transitionend", onEnd);
        refs.panel.style.transition = "transform .24s cubic-bezier(0.2,0,0,1)";
        refs.panel.style.transform = toTransform;
        fallbackTimer = window.setTimeout(cleanup, 360);
      });
    },

    setLayoutMode(mode, { persist = true, resetPosition = true } = {}) {
      const nextMode = mode === "compact" ? "compact" : "full";
      if (this.layoutMode === nextMode) return;
      this.withLayoutTransition(() => {
        this.layoutMode = nextMode;
        this.compactSidebarOpen = false;
        this.applyLayoutMode();
        if (persist) this.saveLayoutMode();
        if (resetPosition) this.resetPanelOffset({ persist: false });
        this.loadPanelOffset();
        this.render();
      });
    },

    toggleLayoutMode() {
      this.setLayoutMode(this.isCompactMode() ? "full" : "compact");
    },

    openCompactSidebar() {
      if (!this.isCompactMode()) {
        this.activePlugin?.toggleSidebar?.();
        return;
      }
      this.closeModelSelector();
      this.compactSidebarOpen = true;
      this.applyLayoutMode();
    },

    closeCompactSidebar() {
      if (!this.compactSidebarOpen) return;
      this.compactSidebarOpen = false;
      this.applyLayoutMode();
    },

    notifyWorkspaceStateChanged(plugin = this.activePlugin) {
      plugin?.renderPlugin?.();
    },

    applyPanelOffset() {
      refs.panel.style.setProperty("--cc-panel-offset-x", `${Math.round(this.panelOffsetX)}px`);
      refs.panel.style.setProperty("--cc-panel-offset-y", `${Math.round(this.panelOffsetY)}px`);
    },

    loadPanelOffset() {
      const saved = safeReadJsonStorage(this.getPanelPositionKey(), null) ||
        (this.layoutMode === "full" ? safeReadJsonStorage(PANEL_POS_KEY, null) : null);
      if (saved) {
        this.panelOffsetX = saved.x || 0;
        this.panelOffsetY = saved.y || 0;
      } else {
        this.panelOffsetX = 0;
        this.panelOffsetY = 0;
      }
      this.applyPanelOffset();
    },

    savePanelOffset() {
      safeWriteJsonStorage(this.getPanelPositionKey(), { x: this.panelOffsetX, y: this.panelOffsetY });
    },

    resetPanelOffset({ persist = true } = {}) {
      this.panelOffsetX = 0;
      this.panelOffsetY = 0;
      this.applyPanelOffset();
      if (persist) this.savePanelOffset();
    },

    clampPanelOffset(nextX = this.panelOffsetX, nextY = this.panelOffsetY) {
      const shellRect = refs.shell.getBoundingClientRect();
      const panelRect = refs.panel.getBoundingClientRect();
      const shellStyle = window.getComputedStyle(refs.shell);
      const bounds = {
        left: shellRect.left + (parseFloat(shellStyle.paddingLeft) || 0),
        right: shellRect.right - (parseFloat(shellStyle.paddingRight) || 0),
        top: shellRect.top + (parseFloat(shellStyle.paddingTop) || 0),
        bottom: shellRect.bottom - (parseFloat(shellStyle.paddingBottom) || 0),
      };

      const minX = this.panelOffsetX - (panelRect.left - bounds.left);
      const maxX = this.panelOffsetX + (bounds.right - panelRect.right);
      const minY = this.panelOffsetY - (panelRect.top - bounds.top);
      const maxY = this.panelOffsetY + (bounds.bottom - panelRect.bottom);
      const clampAxis = (value, min, max) => {
        if (!Number.isFinite(min) || !Number.isFinite(max)) return value;
        if (min > max) return (min + max) / 2;
        return Math.min(Math.max(value, min), max);
      };

      return {
        x: clampAxis(nextX, minX, maxX),
        y: clampAxis(nextY, minY, maxY),
      };
    },

    ensurePanelWithinBounds() {
      const next = this.clampPanelOffset();
      if (next.x === this.panelOffsetX && next.y === this.panelOffsetY) return;
      this.panelOffsetX = next.x;
      this.panelOffsetY = next.y;
      this.applyPanelOffset();
    },

    beginPanelDrag(event) {
      if (!refs.shell.classList.contains("is-open")) return;
      const bounds = this.clampPanelOffset();
      this.panelOffsetX = bounds.x;
      this.panelOffsetY = bounds.y;
      this.applyPanelOffset();
      this.dragState = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startOffsetX: this.panelOffsetX,
        startOffsetY: this.panelOffsetY,
      };
      refs.panel.classList.add("is-dragging");
      if (typeof refs.panel.setPointerCapture === "function") {
        try {
          refs.panel.setPointerCapture(event.pointerId);
        } catch (_) {}
      }
      event.preventDefault();
    },

    updatePanelDrag(event) {
      if (!this.dragState || event.pointerId !== this.dragState.pointerId) return;
      const next = this.clampPanelOffset(
        this.dragState.startOffsetX + (event.clientX - this.dragState.startX),
        this.dragState.startOffsetY + (event.clientY - this.dragState.startY),
      );
      this.panelOffsetX = next.x;
      this.panelOffsetY = next.y;
      this.applyPanelOffset();
    },

    endPanelDrag(event) {
      if (!this.dragState) return;
      if (event?.pointerId != null && this.dragState.pointerId !== event.pointerId) return;
      if (typeof refs.panel.releasePointerCapture === "function" && this.dragState.pointerId != null) {
        try {
          refs.panel.releasePointerCapture(this.dragState.pointerId);
        } catch (_) {}
      }
      this.dragState = null;
      refs.panel.classList.remove("is-dragging");
      this.ensurePanelWithinBounds();
      this.savePanelOffset();
    },

    open(plugin) {
      this.activePlugin = plugin;
      this.activeGraph = plugin?.graph || getActiveGraphRef();
      this.requestedOpen = true;
      this.targetPluginId = plugin ? String(plugin.id) : null;
      this.targetBackendPluginId = plugin?.getBackendPluginId?.() || this.targetPluginId;
      this.loadLayoutMode();
      this.mountToActiveWorkflow();
      this.closeSettingsModal();
      this.closeContextMenu();
      this.closeModelSelector();
      this.startWatch();
      this.syncWorkflowVisibility(true);
      
      this.loadPanelOffset();
      requestAnimationFrame(() => this.ensurePanelWithinBounds());
    },

    close() {
      this.endPanelDrag();
      this.closeSettingsModal();
      this.closeContextMenu();
      this.closeModelSelector();
      this.closeCompactSidebar();
      refs.shell.classList.remove("is-open");
      this.notifyWorkspaceStateChanged();
      this.activePlugin = null;
      this.activeGraph = null;
      this.activeHost = null;
      this.requestedOpen = false;
      this.targetPluginId = null;
      this.targetBackendPluginId = null;
      this.stopWatch();
    },

    suspend() {
      this.endPanelDrag();
      this.closeSettingsModal();
      this.closeContextMenu();
      this.closeModelSelector();
      this.closeCompactSidebar();
      refs.shell.classList.remove("is-open");
      this.notifyWorkspaceStateChanged();
      this.activePlugin = null;
      this.activeGraph = null;
      this.activeHost = null;
    },

    refreshIfActive(plugin) {
      if (this.activePlugin === plugin && this.isActiveWorkflowVisible()) this.render();
    },

    attachMatchingPlugin(plugin, shouldFocus = false) {
      if (!this.requestedOpen || !plugin) return false;
      const backendId = plugin.getBackendPluginId?.();
      const matches = (
        (this.targetBackendPluginId != null && backendId === this.targetBackendPluginId) ||
        (this.targetPluginId != null && String(plugin.id) === this.targetPluginId)
      );
      if (!matches) return false;
      this.activePlugin = plugin;
      this.activeGraph = plugin.graph || getActiveGraphRef();
      this.startWatch();
      this.syncWorkflowVisibility(shouldFocus);
      return true;
    },

    restoreActivePlugin() {
      if (!this.requestedOpen || this.activePlugin) return !!this.activePlugin;
      const candidates = [
        this.targetBackendPluginId,
        this.targetPluginId,
      ].filter(Boolean);
      for (const key of candidates) {
        const plugin = window._cometChatPlugins?.[String(key)];
        if (plugin && this.attachMatchingPlugin(plugin)) return true;
      }
      return false;
    },

    isActiveWorkflowVisible() {
      if (!this.activePlugin) return false;
      if (this.activePlugin.isGlobalPlugin) return true;
      return false;
    },

    mountToActiveWorkflow() {
      const host = this.activePlugin?.isGlobalPlugin
        ? prepareWorkspaceHost(document.body)
        : prepareWorkspaceHost(getWorkspaceHostElement());
      if (this.activeHost !== host || shell.parentElement !== host) {
        host.appendChild(shell);
        this.activeHost = host;
      }
      applyWorkspaceInset(shell, host);
    },

    syncWorkflowVisibility(shouldFocus = false) {
      const shouldShow = !!this.activePlugin && this.isActiveWorkflowVisible();
      const wasOpen = refs.shell.classList.contains("is-open");

      if (!shouldShow) {
        refs.shell.classList.remove("is-open");
        this.closeSettingsModal();
        this.closeContextMenu();
        this.closeModelSelector();
        this.closeCompactSidebar();
        this.notifyWorkspaceStateChanged();
        return;
      }

      this.mountToActiveWorkflow();
      refs.shell.classList.add("is-open");
      this.render();
      this.ensurePanelWithinBounds();
      this.notifyWorkspaceStateChanged();
      if (shouldFocus && !wasOpen) refs.textarea.focus();
    },

    startWatch() {
      if (this.watchTimer) return;
      this.watchTimer = window.setInterval(() => {
        if (!this.activePlugin) {
          if (!this.restoreActivePlugin()) return;
        }
        const shouldShow = this.isActiveWorkflowVisible();
        const isOpen = refs.shell.classList.contains("is-open");
        if (shouldShow !== isOpen) {
          this.syncWorkflowVisibility();
          return;
        }
        if (shouldShow) {
          this.mountToActiveWorkflow();
          if (!this.dragState) this.ensurePanelWithinBounds();
        }
      }, 250);
    },

    stopWatch() {
      if (!this.watchTimer) return;
      window.clearInterval(this.watchTimer);
      this.watchTimer = null;
    },

    render() {
      const plugin = this.activePlugin;
      if (!plugin) return;
      if (!this.isActiveWorkflowVisible()) return;

      this.mountToActiveWorkflow();
      const state = plugin.ensureWorkspaceState();
      this.applyLayoutMode();
      refs.panel.classList.toggle("is-sidebar-collapsed", !state.sidebarOpen);
      const config = plugin.getConfigValues();
      const activeChannel = config.channels.find(c => c.id === config.activeChannelId);
      const activeModel = activeChannel?.models?.find(m => m.id === config.activeModelId) || activeChannel?.models?.[0];
      
      refs.modelTriggerText.textContent = activeModel?.name || "未选择模型";
      refs.modelTriggerChannel.textContent = activeChannel?.name || "未配置渠道";

      refs.status.dataset.kind = plugin.getStatusKind();
      refs.statusText.textContent = plugin.getStatusText();
      setSendButtonState(refs.sendButton, plugin.isStreaming);
      this.renderSessionList();
      this.renderMessages();
      this.renderComposer();
    },

    openModelSelector() {
      const config = this.activePlugin?.getConfigValues();
      if (!config) return;
      this.closeCompactSidebar();

      refs.modelTrigger.classList.add("is-open");
      clearElement(refs.modelPopup);

      const enabledChannels = config.channels.filter(c => c.enabled);
      
      if (enabledChannels.length === 0) {
          refs.modelPopup.innerHTML = `<div style="padding:12px; color:var(--cc-text-secondary); text-align:center; font-size:13px;">请先在设置中启用渠道</div>`;
          refs.modelPopup.classList.add("is-open");
          return;
      }

      enabledChannels.forEach(channel => {
        if (!channel.models || channel.models.length === 0) return;
        
        const groupEl = document.createElement("div");
        groupEl.className = "cc-model-group";
        
        const titleEl = document.createElement("div");
        titleEl.className = "cc-model-group-title";
        titleEl.textContent = channel.name;
        groupEl.appendChild(titleEl);

        channel.models.forEach(model => {
          const isAct = config.activeChannelId === channel.id && config.activeModelId === model.id;
          const itemEl = document.createElement("button");
          itemEl.className = `cc-model-item ${isAct ? 'is-active' : ''}`;
          itemEl.type = "button";
          itemEl.dataset.action = "select-model";
          itemEl.dataset.chId = channel.id;
          itemEl.dataset.mId = model.id;
          
          itemEl.innerHTML = `
            <div class="cc-model-item-name">${escapeHtml(model.name)}</div>
          `;
          groupEl.appendChild(itemEl);
        });
        
        refs.modelPopup.appendChild(groupEl);
      });
      
      refs.modelPopup.classList.add("is-open");
    },
    
    closeModelSelector() {
      refs.modelTrigger.classList.remove("is-open");
      refs.modelPopup.classList.remove("is-open");
    },

    renderSessionList() {
      const plugin = this.activePlugin;
      const state = plugin.ensureWorkspaceState();
      const currentId = state.currentSessionId;
      
      const signature = `${state.sessions.length}|${currentId}|${openSessionMenuId}|${state.sessions.map(s=>s.id+s.title+s.pinned+s.updatedAt).join(',')}`;
      if (refs.sessionList.dataset.renderSignature === signature) return;
      refs.sessionList.dataset.renderSignature = signature;

      const sortedSessions = [...state.sessions].sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });

      clearElement(refs.sessionList);

      sortedSessions.forEach((session) => {
        const item = document.createElement("div");
        const isOpenState = openSessionMenuId === session.id ? " menu-open" : "";
        item.className = `cc-session-item${session.id === currentId ? " is-active" : ""}${isOpenState}`;
        item.dataset.sessionId = session.id;

        const titleDiv = document.createElement("div");
        titleDiv.className = "cc-session-item-title";
        titleDiv.textContent = session.title;

        const rightDiv = document.createElement("div");
        rightDiv.className = "cc-session-item-right";

        if (session.pinned) {
          const pinIndicator = document.createElement("div");
          pinIndicator.className = "cc-session-pin-indicator";
          pinIndicator.innerHTML = `<svg viewBox="0 0 24 24" style="width:14px;height:14px;stroke:currentColor;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round;"><path d="M16 11V7a4 4 0 0 0-8 0v4L5 14v2h14v-2l-3-3z"></path><path d="M12 16v6"></path></svg>`;
          rightDiv.appendChild(pinIndicator);
        }

        const moreButton = document.createElement("button");
        moreButton.className = "cc-session-more-btn";
        moreButton.type = "button";
        moreButton.dataset.action = "open-session-menu";
        moreButton.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="5" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="12" cy="19" r="2"></circle></svg>`;
        rightDiv.appendChild(moreButton);

        item.appendChild(titleDiv);
        item.appendChild(rightDiv);
        refs.sessionList.appendChild(item);
      });
    },

    renderMessages() {
      const plugin = this.activePlugin;
      const session = plugin.getCurrentSession();
      const container = refs.messages;
      
      const getSignature = () => {
        if (!session) return "empty";
        if (!session.messages.length) return `${session.id}|0`;
        const messageSig = session.messages
          .map((msg) => `${msg.id}:${msg.text.length}:${msg.tone}:${msg.streaming}:${(msg.files || []).length}:${msg.imageIndex ?? ""}`)
          .join("|");
        const imageTaskSig = Array.from(plugin.imageTasks?.values?.() || [])
          .map((task) => `${task.sessionId}:${task.messageId}`)
          .join("|");
        return `${session.id}|${messageSig}|${plugin.isStreaming}|${imageTaskSig}`;
      };
      
      const currentSignature = getSignature();
      if (container.dataset.renderSignature === currentSignature) {
        return; 
      }

      const previousScrollTop = container.scrollTop;
      const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight <= 10;
      const previousSessionId = container.dataset.renderedSessionId;

      clearElement(container);

      if (!session?.messages.length) {
        container.dataset.renderedSessionId = session?.id || "";
        container.dataset.renderSignature = currentSignature;
        return;
      }

      const lastTextAssistantId = (() => {
        for (let index = session.messages.length - 1; index >= 0; index -= 1) {
          const message = session.messages[index];
          if (message.role !== "assistant") continue;
          if (message.streaming) return "";
          if (message.tone === "error") continue;
          const hasImageContent = (message.files || []).some((file) => isImageVariantFile(file));
          if (!hasImageContent && message.includeInContext !== false) return message.id || "";
        }
        return "";
      })();
      session.messages.forEach((message) => {
        const hasImageContent = (message.files || []).some((file) => isImageVariantFile(file));
        container.appendChild(createMessageElement(message, {
          compact: false,
          canRegenerate: hasImageContent || (!!lastTextAssistantId && message.id === lastTextAssistantId && message.includeInContext !== false),
        }));
      });
      
      if (previousSessionId !== (session?.id || "") || isAtBottom) {
        container.scrollTop = container.scrollHeight;
      } else {
        container.scrollTop = previousScrollTop;
      }
      container.dataset.renderedSessionId = session?.id || "";
      container.dataset.renderSignature = currentSignature;
    },

    renderComposer() {
      const plugin = this.activePlugin;
      const session = plugin.getCurrentSession();
      if (!session) return;

      if (document.activeElement !== refs.textarea) refs.textarea.value = session.draft || "";
      this.updateComposerState();

      const fileSignature = (session.pendingFiles || []).map(f => f.name).join('|');
      if (refs.files.dataset.renderSignature === fileSignature) return;
      refs.files.dataset.renderSignature = fileSignature;

      clearElement(refs.files);
      session.pendingFiles.forEach((file, index) => {
        refs.files.appendChild(createWorkspaceFileCard(file, () => plugin.removePendingFile(index)));
      });
      this.updateComposerState();
    },

    doesDraftNeedMultipleLines(draft, hasContent) {
      const text = String(draft || "").replace(/\r\n/g, "\n");
      if (!text.length) return false;
      if (text.includes("\n")) return true;

      const containerRect = refs.composeContainer.getBoundingClientRect();
      if (!containerRect.width) return false;
      const containerStyle = window.getComputedStyle(refs.composeContainer);
      const inputStyle = window.getComputedStyle(refs.textarea);
      const gap = parseFloat(containerStyle.columnGap) || 0;
      const paddingX = (parseFloat(containerStyle.paddingLeft) || 0) + (parseFloat(containerStyle.paddingRight) || 0);
      const attachWidth = shell.querySelector('[data-action="workspace-add-file"]')?.getBoundingClientRect().width || (this.isCompactMode() ? 34 : 36);
      const sendWidth = hasContent ? (refs.sendButton.getBoundingClientRect().width || (this.isCompactMode() ? 34 : 36)) : 0;
      const inputWidth = containerRect.width - paddingX - attachWidth - sendWidth - gap * (hasContent ? 2 : 1);
      if (inputWidth <= 0) return false;

      if (!textMeasureCanvas) textMeasureCanvas = document.createElement("canvas");
      const ctx = textMeasureCanvas.getContext("2d");
      if (!ctx) return false;
      ctx.font = inputStyle.font || `${inputStyle.fontSize} ${inputStyle.fontFamily}`;
      return ctx.measureText(text).width > inputWidth - 2;
    },

    updateComposerState() {
      const session = this.activePlugin?.getCurrentSession?.();
      const draft = session ? String(session.draft || "") : refs.textarea.value || "";
      const hasFiles = !!session?.pendingFiles?.length || refs.files.children.length > 0;
      const hasContent = !!draft.trim() || hasFiles || !!this.activePlugin?.isStreaming;
      const isMultiline = this.doesDraftNeedMultipleLines(draft, hasContent);
      const expanded = hasFiles || isMultiline;
      refs.composeContainer.classList.toggle("is-compose-expanded", expanded);
      refs.composeContainer.classList.toggle("is-compact-expanded", this.isCompactMode() && expanded);
      refs.composeContainer.classList.toggle("has-compose-content", hasContent);
      refs.composeContainer.classList.toggle("has-compose-files", hasFiles);
      this.resizeComposerInput(expanded);
    },

    resizeComposerInput(expanded = refs.composeContainer.classList.contains("is-compose-expanded")) {
      refs.textarea.style.height = "auto";
      if (!expanded) {
        refs.textarea.style.height = "24px";
        return;
      }
      refs.textarea.style.height = `${Math.min(refs.textarea.scrollHeight, this.isCompactMode() ? 132 : 200)}px`;
    },

    closeContextMenu() {
        refs.sessionContextMenu.classList.remove("is-open");
        shell.querySelectorAll('.cc-session-item.menu-open').forEach(el => el.classList.remove('menu-open'));
        openSessionMenuId = null;
    },

    openSettingsModal() {
      if (!this.activePlugin) return;
      tempConfig = JSON.parse(JSON.stringify(this.activePlugin.getConfigValues()));
      editingChannelId = tempConfig.activeChannelId;
      if (tempConfig.presets && tempConfig.presets.length > 0) {
        editingPresetId = tempConfig.presets[0].id;
      }
      isChannelEditorInitialized = false;
      isPresetEditorInitialized = false;
      
      this.switchSettingsTab("general");
      refs.settingsModalBackdrop.classList.add("is-open");
    },

    closeSettingsModal() {
      refs.settingsModalBackdrop.classList.remove("is-open");
      tempConfig = null;
      editingChannelId = null;
      editingPresetId = null;
      tempEditingModels = [];
      isChannelEditorInitialized = false;
      isPresetEditorInitialized = false;
    },

    switchSettingsTab(tabId) {
      if (isChannelEditorInitialized) this.saveCurrentChannelEdits();
      if (isPresetEditorInitialized) this.saveCurrentPresetEdits();

      refs.settingsNavBtns.forEach(btn => {
        btn.classList.toggle("is-active", btn.dataset.tab === tabId);
      });
      refs.settingsPanels.forEach(panel => {
        panel.classList.toggle("is-active", panel.id === `cc-panel-${tabId}`);
      });

      if (tabId === "general") this.renderGeneralSettings();
      if (tabId === "channels") this.renderChannelSettings();
      if (tabId === "presets") this.renderPresetSettings();
      if (tabId === "selection") this.renderSelectionSettings();
    },

    renderGeneralSettings() {
      if (!tempConfig) return;
      settingFields.system_prompt.value = tempConfig.system_prompt || "";
    },

    renderSelectionSettings() {
      if (!tempConfig) return;
      const { assistant, channels, channel } = ensureSelectionAssistantModel(tempConfig);
      if (settingFields.selection_enabled) {
        settingFields.selection_enabled.checked = assistant.enabled === true;
        settingFields.selection_enabled.onchange = () => {
          assistant.enabled = settingFields.selection_enabled.checked;
        };
      }

      const channelOptions = channels.length
        ? channels.map((item) => ({ value: item.id, label: item.name || "未命名渠道" }))
        : [{ value: "", label: "暂无可用文本渠道" }];
      makeCustomSelect(settingFields.selection_channel, channelOptions);
      settingFields.selection_channel.value = assistant.channel_id || "";
      settingFields.selection_channel.onchange = () => {
        assistant.channel_id = settingFields.selection_channel.value;
        assistant.model_id = "";
        this.renderSelectionSettings();
      };
      settingFields.selection_channel.style.pointerEvents = channels.length ? "" : "none";
      settingFields.selection_channel.style.opacity = channels.length ? "" : "0.6";

      const activeChannel = channels.find((item) => item.id === assistant.channel_id) || channel || channels[0];
      const modelOptions = activeChannel?.models?.length
        ? activeChannel.models.map((model) => ({ value: model.id, label: model.name || "未命名模型" }))
        : [{ value: "", label: "暂无可用文本模型" }];
      makeCustomSelect(settingFields.selection_model, modelOptions);
      settingFields.selection_model.value = assistant.model_id || "";
      settingFields.selection_model.onchange = () => {
        assistant.model_id = settingFields.selection_model.value;
      };
      settingFields.selection_model.style.pointerEvents = activeChannel?.models?.length ? "" : "none";
      settingFields.selection_model.style.opacity = activeChannel?.models?.length ? "" : "0.6";

      if (settingFields.selection_hint) {
        settingFields.selection_hint.textContent = channels.length
          ? "划词助手只使用文本模型；翻译、解释、提示词优化不会写入当前对话历史。"
          : "请先在渠道管理中添加并启用至少一个文本模型。";
      }
    },

    renderPresetSettings() {
      if (!tempConfig) return;
      if (!tempConfig.presets) tempConfig.presets = [];
      
      const listEl = shell.querySelector("#cc-preset-list");
      if(!listEl) return;
      clearElement(listEl);
      
      tempConfig.presets.forEach(preset => {
        const isEditing = preset.id === editingPresetId;
        const el = document.createElement("div");
        el.className = `cc-channel-item ${isEditing ? 'is-editing' : ''}`;
        el.dataset.action = "edit-preset";
        el.dataset.id = preset.id;
        el.innerHTML = `
          <div class="cc-channel-info-list" style="pointer-events:none;">
            <div class="cc-channel-name-list">${escapeHtml(preset.name)}</div>
          </div>
        `;
        listEl.appendChild(el);
      });

      const presetToEdit = tempConfig.presets.find(p => p.id === editingPresetId) || tempConfig.presets[0];
      const editorEl = shell.querySelector("#cc-preset-editor");
      
      if (presetToEdit && editorEl) {
        editingPresetId = presetToEdit.id;
        editorEl.style.display = "block";
        shell.querySelector("#cc-preset-title").textContent = presetToEdit.name + " 预设";
        
        const deleteBtn = editorEl.querySelector('[data-action="delete-preset"]');
        if(deleteBtn) deleteBtn.dataset.id = presetToEdit.id;

        shell.querySelector("#cc-preset-name-input").value = presetToEdit.name || "";
        
        const presetClone = { ...presetToEdit };
        delete presetClone.id;
        delete presetClone.name;
        const presetJsonInputEl = shell.querySelector("#cc-preset-json-input");
        if(presetJsonInputEl) {
            presetJsonInputEl.value = JSON.stringify(presetClone, null, 2);
            presetJsonInputEl.style.borderColor = "var(--cc-border)";
        }
        
        isPresetEditorInitialized = true;
      } else if (editorEl) {
        editorEl.style.display = "none";
        editingPresetId = null;
        isPresetEditorInitialized = false;
      }
    },

    saveCurrentPresetEdits() {
      if (!tempConfig || !editingPresetId || !isPresetEditorInitialized) return;
      const target = tempConfig.presets.find(p => p.id === editingPresetId);
      if (target) {
        target.name = shell.querySelector("#cc-preset-name-input").value.trim() || "未命名预设";
        const jsonStr = shell.querySelector("#cc-preset-json-input").value;
        try {
          const parsed = JSON.parse(jsonStr);
          Object.assign(target, {
            url_template: parsed.url_template || "{api_url}",
            headers_template: typeof parsed.headers_template === 'object' ? parsed.headers_template : {},
            body_template: typeof parsed.body_template === 'object' ? parsed.body_template : {},
            message_mapping: typeof parsed.message_mapping === 'object' ? parsed.message_mapping : {},
            attachment_mapping: typeof parsed.attachment_mapping === 'object' ? parsed.attachment_mapping : {},
            stream_parser: typeof parsed.stream_parser === 'object' ? parsed.stream_parser : {}
          });
          shell.querySelector("#cc-preset-json-input").style.borderColor = "var(--cc-border)";
        } catch (e) {
          shell.querySelector("#cc-preset-json-input").style.borderColor = "var(--cc-error)";
        }
      }
    },

    renderChannelSettings() {
      if (!tempConfig) return;
      clearElement(refs.channelListEl);
      
      tempConfig.channels.sort((a, b) => {
        if (a.enabled && !b.enabled) return -1;
        if (!a.enabled && b.enabled) return 1;
        return 0;
      });
      
      let draggedIndex = -1;

      tempConfig.channels.forEach((channel, index) => {
        const isEditing = channel.id === editingChannelId;
        
        const el = document.createElement("div");
        el.className = `cc-channel-item ${isEditing ? 'is-editing' : ''}`;
        el.dataset.action = "edit-channel"; 
        el.dataset.id = channel.id;
        el.draggable = true;
        
        el.innerHTML = `
          <div class="cc-channel-drag-handle">
             <svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:currentColor;"><circle cx="8.5" cy="5" r="1.5"></circle><circle cx="15.5" cy="5" r="1.5"></circle><circle cx="8.5" cy="12" r="1.5"></circle><circle cx="15.5" cy="12" r="1.5"></circle><circle cx="8.5" cy="19" r="1.5"></circle><circle cx="15.5" cy="19" r="1.5"></circle></svg>
          </div>
          <div class="cc-channel-info-list" style="pointer-events:none;">
            <div class="cc-channel-name-list">${escapeHtml(channel.name)}</div>
          </div>
          ${channel.enabled ? '<div class="cc-channel-on-tag">ON</div>' : ''}
        `;
        
        el.addEventListener("dragstart", (e) => {
            draggedIndex = index;
            e.dataTransfer.effectAllowed = "move";
            
            const dragImage = el.cloneNode(true);
            dragImage.style.width = `${el.offsetWidth}px`;
            dragImage.style.position = "absolute";
            dragImage.style.top = "-1000px";
            dragImage.style.left = "-1000px";
            dragImage.style.background = "var(--cc-bg-surface-hover)";
            dragImage.style.border = "1px solid var(--cc-accent)";
            dragImage.style.boxShadow = "0 16px 32px rgba(0,0,0,0.6)";
            dragImage.style.opacity = "1";
            document.body.appendChild(dragImage);
            
            const rect = el.getBoundingClientRect();
            e.dataTransfer.setDragImage(dragImage, e.clientX - rect.left, e.clientY - rect.top);
            
            setTimeout(() => {
                el.classList.add("is-dragging");
                dragImage.remove(); 
            }, 0); 
        });

        el.addEventListener("dragover", (e) => {
            e.preventDefault(); 
            e.dataTransfer.dropEffect = "move";
            el.classList.add("drag-over");
            
            const listEl = refs.channelListEl;
            const listRect = listEl.getBoundingClientRect();
            const threshold = 40;
            if (e.clientY < listRect.top + threshold) {
                listEl.scrollTop -= 10;
            } else if (e.clientY > listRect.bottom - threshold) {
                listEl.scrollTop += 10;
            }
        });

        el.addEventListener("dragleave", () => {
            el.classList.remove("drag-over");
        });

        el.addEventListener("drop", (e) => {
            e.preventDefault();
            el.classList.remove("drag-over");
            if (draggedIndex === -1 || draggedIndex === index) return;

            const [movedItem] = tempConfig.channels.splice(draggedIndex, 1);
            tempConfig.channels.splice(index, 0, movedItem);
            
            manager.saveCurrentChannelEdits();
            manager.renderChannelSettings();
        });

        el.addEventListener("dragend", () => {
            el.classList.remove("is-dragging");
            draggedIndex = -1;
        });

        refs.channelListEl.appendChild(el);
      });

      const channelToEdit = tempConfig.channels.find(c => c.id === editingChannelId) || tempConfig.channels[0];
      if (channelToEdit) {
        editingChannelId = channelToEdit.id;
        const isManagedChannel = isCometApiManagedChannel(channelToEdit);

        shell.querySelector("#cc-editor-title").textContent = channelToEdit.name + " 设置";
        
        const actionsEl = shell.querySelector("#cc-editor-actions");
        if(actionsEl) {
            actionsEl.innerHTML = `
              ${isManagedChannel
                ? `<span class="cc-channel-on-tag" title="来自 CometAPI 设置中心">SYNC</span>`
                : `<label class="cc-toggle" data-action="toggle-channel" data-id="${channelToEdit.id}">
                     <input type="checkbox" ${channelToEdit.enabled ? 'checked' : ''} tabindex="-1">
                     <span class="cc-toggle-slider"></span>
                   </label>`}
              ${(tempConfig.channels.length > 1 || isManagedChannel)
                ? `<button class="cc-icon-btn cc-delete-btn" type="button" data-action="delete-channel" data-id="${channelToEdit.id}" title="${isManagedChannel ? '在 Chat 中隐藏此 CometAPI 渠道' : '删除此渠道'}" style="width:30px;height:30px; margin-left: 8px;"><svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:var(--cc-error);stroke-width:2;fill:none;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>` 
                : ''}
            `;
        }

        channelFields.name.value = channelToEdit.name || "";
        channelFields.api_url.value = channelToEdit.api_url || "";
        channelFields.api_key.value = channelToEdit.api_key || "";
        Object.values(channelFields).forEach((input) => {
          input.disabled = isManagedChannel;
          input.title = isManagedChannel ? "此渠道来自 CometAPI 设置中心，请在 CometAPI 中修改。" : "";
        });
        
        tempEditingModels = JSON.parse(JSON.stringify(channelToEdit.models || []));
        if(tempEditingModels.length === 0) tempEditingModels.push({ id: createId("m"), name: "", override_api_key: "", api_format: "openai", category: "llm", interface_mode: "", _formatTouched: false });
        this.renderModelsEditor();
        
        isChannelEditorInitialized = true;
      }
    },
    
    renderModelsEditor() {
       clearElement(refs.modelsBodyEl);
       const editingChannel = tempConfig?.channels?.find(c => c.id === editingChannelId);
       const isManagedChannel = isCometApiManagedChannel(editingChannel);
       const addModelBtn = shell.querySelector('[data-action="add-channel-model"]');
       if (addModelBtn) {
         addModelBtn.disabled = false;
         addModelBtn.style.display = "";
         addModelBtn.title = isManagedChannel ? "添加仅供 Chat 使用的本地模型" : "";
       }
       
       const textFormatOptions = [...CHAT_TEXT_API_FORMAT_OPTIONS];
       if (tempConfig && tempConfig.presets) {
         tempConfig.presets.forEach(p => {
           textFormatOptions.push({value: p.id, label: `[预设] ${escapeHtml(p.name)}`});
         });
       }

       tempEditingModels.forEach((model, idx) => {
          const isImportedModel = isCometApiManagedModel(editingChannel, model);
          const modelCategory = normalizeModelCategory(model.category, model.api_format, model.name);
          model.category = modelCategory;
          if (modelCategory === "image") {
            model.api_format = normalizeImageApiFormatValue(model.api_format, model.name);
            model.interface_mode = normalizeImageInterfaceMode(model.interface_mode, model.api_format);
          } else {
            model.interface_mode = "";
          }
          const formatOptions = modelCategory === "image" ? CHAT_IMAGE_API_FORMAT_OPTIONS : textFormatOptions;
          const interfaceOptions = modelCategory === "image" ? (CHAT_IMAGE_INTERFACE_MODE_OPTIONS[model.api_format] || []) : [];
          const row = document.createElement("div");
          row.className = "cc-model-row";
          row.innerHTML = `
            <div class="cc-model-col-name">
               <input type="text" value="${escapeHtml(model.name)}" title="${escapeHtml(isImportedModel ? '此模型来自 CometAPI 设置中心，请在 CometAPI 中修改。' : model.name)}" data-model-idx="${idx}" data-model-field="name" placeholder="输入模型名称" ${isImportedModel ? "disabled" : ""}>
            </div>
            <div class="cc-model-col-act">
               <button class="cc-icon-btn" type="button" data-action="toggle-model-row-menu" style="width:28px;height:28px;" title="模型设置">
                 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                 </svg>
               </button>
               <div class="cc-model-row-popup">
                  <div class="cc-model-row-popup-field">
                      <label>接口格式</label>
                      <div class="cc-model-format-select" data-model-idx="${idx}"></div>
                  </div>
                  ${modelCategory === "image" ? `
                  <div class="cc-model-row-popup-field">
                      <label>接口模式</label>
                      <div class="cc-model-interface-select" data-model-idx="${idx}"></div>
                  </div>
                  ` : ""}
                  <div class="cc-model-row-popup-field">
                      <label>独立 API Key (可选)</label>
                      <input type="password" value="${escapeHtml(model.override_api_key)}" title="${isImportedModel ? '此模型 Key 来自 CometAPI 设置中心。' : (model.override_api_key ? '已设置独立的API Key' : '未设置')}" data-model-idx="${idx}" data-model-field="override_api_key" placeholder="留空则使用渠道通用 Key" ${isImportedModel ? "disabled" : ""}>
                  </div>
                  <div class="cc-delete-btn-wrap">
                      <button class="cc-delete-row-btn" type="button" data-action="delete-channel-model" data-idx="${idx}" ${isImportedModel ? 'disabled title="CometAPI 模型请在 CometAPI 设置中心管理"' : (tempEditingModels.length <= 1 ? 'disabled title="至少需要保留一个模型"' : '')}>
                          <svg viewBox="0 0 24 24" style="width:14px;height:14px;stroke:currentColor;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                          删除此模型
                      </button>
                  </div>
               </div>
            </div>
          `;
          refs.modelsBodyEl.appendChild(row);
          
          const selectEl = row.querySelector('.cc-model-format-select');
          makeCustomSelect(selectEl, formatOptions);
          
          const exists = formatOptions.find(o => o.value === model.api_format);
          selectEl.value = exists ? model.api_format : (modelCategory === "image" ? "gpt_image" : "openai");
          if (isImportedModel) {
             selectEl.style.pointerEvents = "none";
             selectEl.style.opacity = "0.65";
             selectEl.title = "此模型来自 CometAPI 设置中心，请在 CometAPI 中修改。";
          }
          
          selectEl.addEventListener("change", () => {
             if (isImportedModel) return;
             if(tempEditingModels[idx]) {
                 tempEditingModels[idx].api_format = selectEl.value;
                 tempEditingModels[idx].category = modelCategory;
                 if (modelCategory === "image") {
                   tempEditingModels[idx].interface_mode = normalizeImageInterfaceMode(tempEditingModels[idx].interface_mode, selectEl.value);
                   this.renderModelsEditor();
                 }
                 tempEditingModels[idx]._formatTouched = true;
             }
          });

          const interfaceSelectEl = row.querySelector('.cc-model-interface-select');
          if (interfaceSelectEl) {
             makeCustomSelect(interfaceSelectEl, interfaceOptions);
             interfaceSelectEl.value = model.interface_mode;
             if (isImportedModel) {
                interfaceSelectEl.style.pointerEvents = "none";
                interfaceSelectEl.style.opacity = "0.65";
                interfaceSelectEl.title = "此模型来自 CometAPI 设置中心，请在 CometAPI 中修改。";
             }
             interfaceSelectEl.addEventListener("change", () => {
                if (isImportedModel) return;
                if (tempEditingModels[idx]) {
                   tempEditingModels[idx].interface_mode = normalizeImageInterfaceMode(interfaceSelectEl.value, tempEditingModels[idx].api_format);
                }
             });
          }
       });
       
       refs.modelsBodyEl.querySelectorAll('input').forEach(el => {
          el.addEventListener("input", (e) => {
             const idx = parseInt(e.target.dataset.modelIdx);
             if (isCometApiManagedModel(editingChannel, tempEditingModels[idx])) return;
             const field = e.target.dataset.modelField;
             if(tempEditingModels[idx]) {
                 tempEditingModels[idx][field] = e.target.value;
                 if (field === "name" && !tempEditingModels[idx]._formatTouched) {
                    const inferred = inferManualModelSettings(e.target.value, tempEditingModels[idx]);
                    const changed = inferred.api_format !== tempEditingModels[idx].api_format
                      || inferred.category !== tempEditingModels[idx].category
                      || inferred.interface_mode !== tempEditingModels[idx].interface_mode;
                    if (changed) {
                       tempEditingModels[idx].api_format = inferred.api_format;
                       tempEditingModels[idx].category = inferred.category;
                       tempEditingModels[idx].interface_mode = inferred.interface_mode;
                       this.renderModelsEditor();
                    }
                 }
             }
          });
       });
    },

    saveCurrentChannelEdits() {
      if (!tempConfig || !editingChannelId || !isChannelEditorInitialized) return;
      const target = tempConfig.channels.find(c => c.id === editingChannelId);
      if (target) {
        const savedModels = tempEditingModels.map((model) => {
          const { _formatTouched, ...rest } = model;
          return rest;
        });
        if (isCometApiManagedChannel(target)) {
          target.models = JSON.parse(JSON.stringify(savedModels));
          return;
        }
        target.name = channelFields.name.value.trim();
        target.api_url = channelFields.api_url.value.trim();
        target.api_key = channelFields.api_key.value.trim();
        target.models = JSON.parse(JSON.stringify(savedModels));
      }
    },

    applyAndSaveSettings() {
      if (!this.activePlugin || !tempConfig) return;
      
      tempConfig.system_prompt = settingFields.system_prompt.value;
      if (settingFields.selection_enabled) {
        const assistant = getSelectionAssistantConfig(tempConfig);
        assistant.enabled = settingFields.selection_enabled.checked;
        assistant.channel_id = settingFields.selection_channel?.value || assistant.channel_id || "";
        assistant.model_id = settingFields.selection_model?.value || assistant.model_id || "";
      }
      
      this.saveCurrentChannelEdits();
      this.saveCurrentPresetEdits();
      
      const enabledChannels = tempConfig.channels.filter(c => c.enabled);
      if (enabledChannels.length > 0) {
          const activeChannel = tempConfig.channels.find(c => c.id === tempConfig.activeChannelId);
          if (!activeChannel || !activeChannel.enabled) {
              tempConfig.activeChannelId = enabledChannels[0].id;
          }
          const newActive = tempConfig.channels.find(c => c.id === tempConfig.activeChannelId);
          if (newActive && !newActive.models.find(m => m.id === tempConfig.activeModelId)) {
              tempConfig.activeModelId = newActive.models[0]?.id || "";
          }
      }
      
      this.activePlugin.applySettingsValues(tempConfig);
      this.closeSettingsModal();
    }
  };

  const updateTextareaHeight = () => {
    manager.resizeComposerInput();
  };

  refs.sendButton.addEventListener("click", async () => {
    if (!manager.activePlugin) return;
    if (manager.activePlugin.isStreaming) {
      await manager.activePlugin.cancelStreaming();
      return;
    }
    await manager.activePlugin.sendCurrentMessage("workspace");
  });

  refs.textarea.addEventListener("input", () => {
    manager.activePlugin?.updateDraft(refs.textarea.value, "workspace");
    updateTextareaHeight();
    manager.updateComposerState();
  });

  const pastedImageExtension = (mimeType) => {
    const safeType = String(mimeType || "").toLowerCase();
    if (safeType.includes("jpeg") || safeType.includes("jpg")) return "jpg";
    if (safeType.includes("webp")) return "webp";
    if (safeType.includes("gif")) return "gif";
    return "png";
  };

  const collectClipboardImageFiles = (clipboardData) => {
    const files = [];
    const seen = new Set();
    const addFile = (file) => {
      if (!file || !String(file.type || "").startsWith("image/")) return;
      const key = `${file.name || ""}|${file.type || ""}|${file.size || 0}`;
      if (seen.has(key)) return;
      seen.add(key);
      const ext = pastedImageExtension(file.type);
      const safeName = file.name && file.name !== "image.png"
        ? file.name
        : `pasted_image_${Date.now()}_${files.length + 1}.${ext}`;
      try {
        files.push(new File([file], safeName, { type: file.type || `image/${ext}` }));
      } catch (_) {
        files.push(file);
      }
    };

    Array.from(clipboardData?.items || []).forEach((item) => {
      if (item?.kind === "file" && String(item.type || "").startsWith("image/")) {
        addFile(item.getAsFile());
      }
    });
    Array.from(clipboardData?.files || []).forEach(addFile);
    return files;
  };

  refs.textarea.addEventListener("paste", async (event) => {
    const files = collectClipboardImageFiles(event.clipboardData);
    if (!files.length || !manager.activePlugin) return;
    event.preventDefault();
    event.stopPropagation();
    await manager.activePlugin.handleSelectedFiles(files);
    manager.updateComposerState();
  });

  refs.composeContainer.addEventListener("focusin", () => {
    manager.updateComposerState();
  });

  refs.composeContainer.addEventListener("focusout", () => {
    window.setTimeout(() => manager.updateComposerState(), 0);
  });

  ["keydown", "keyup", "keypress", "copy", "paste", "cut"].forEach(eventType => {
    refs.shell.addEventListener(eventType, (event) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName) || event.target.isContentEditable) {
        event.stopPropagation();
        return;
      }
      if (["copy", "paste", "cut"].includes(eventType)) {
        event.stopPropagation();
        return;
      }
      if (eventType === "keydown" && (event.key === "c" || event.key === "C") && (event.ctrlKey || event.metaKey)) {
        const selection = window.getSelection();
        if (selection && selection.toString().length > 0) {
          event.stopPropagation();
        }
      }
    });
  });

  refs.shell.addEventListener("error", (event) => {
    const image = event.target;
    if (!image || image.tagName !== "IMG" || !image.classList.contains("cc-msg-image-media")) return;
    const fallbackUrl = image.dataset?.fallbackSrc || "";
    if (fallbackUrl && image.dataset.fallbackTried !== "1") {
      image.dataset.fallbackTried = "1";
      image.src = fallbackUrl;
      return;
    }
    image.alt = "";
    image.closest(".cc-msg-image-shell, .cc-msg-attach-thumb")?.classList.add("is-missing");
  }, true);

  refs.textarea.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      refs.sendButton.click();
    }
  });

  refs.fileInput.addEventListener("change", async () => {
    const files = Array.from(refs.fileInput.files || []);
    refs.fileInput.value = "";
    if (!files.length || !manager.activePlugin) return;
    await manager.activePlugin.handleSelectedFiles(files);
    manager.updateComposerState();
  });

  refs.files.addEventListener("wheel", (event) => {
    if (event.deltaY !== 0) {
      event.preventDefault();
      refs.files.scrollBy({
        left: event.deltaY,
        behavior: "smooth"
      });
    }
  }, { passive: false });

  refs.files.addEventListener("dragstart", (e) => e.preventDefault());

  let isDraggingFiles = false;
  let fileDragStartX;
  let fileDragScrollLeft;

  refs.files.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('.cc-file-remove')) return; 
    
    isDraggingFiles = true;
    fileDragStartX = e.pageX - refs.files.offsetLeft;
    fileDragScrollLeft = refs.files.scrollLeft;
    refs.files.style.cursor = "grabbing"; 
    try { refs.files.setPointerCapture(e.pointerId); } catch (_) {}
  });

  refs.files.addEventListener("pointermove", (e) => {
    if (!isDraggingFiles) return;
    e.preventDefault(); 
    const x = e.pageX - refs.files.offsetLeft;
    const walk = (x - fileDragStartX) * 1.5; 
    refs.files.scrollLeft = fileDragScrollLeft - walk;
  });

  const stopFileDrag = (e) => {
    if (!isDraggingFiles) return;
    isDraggingFiles = false;
    refs.files.style.cursor = ""; 
    try { refs.files.releasePointerCapture(e.pointerId); } catch (_) {}
  };

  refs.files.addEventListener("pointerup", stopFileDrag);
  refs.files.addEventListener("pointercancel", stopFileDrag);

  refs.panel.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    const handle = event.target.closest('[data-drag-handle="workspace"]');
    if (!handle) return;
    if (event.target.closest("button, input, textarea, select, option, a, label")) return;
    if (refs.settingsModalBackdrop.classList.contains("is-open")) return;
    manager.beginPanelDrag(event);
  });

  refs.panel.addEventListener("pointermove", (event) => {
    manager.updatePanelDrag(event);
  });

  refs.panel.addEventListener("pointerup", (event) => {
    manager.endPanelDrag(event);
  });

  refs.panel.addEventListener("pointercancel", (event) => {
    manager.endPanelDrag(event);
  });

  refs.modelTrigger.addEventListener("click", (e) => {
      e.stopPropagation();
      if (refs.modelPopup.classList.contains("is-open")) {
          manager.closeModelSelector();
      } else {
          manager.openModelSelector();
      }
  });

  refs.sessionList.addEventListener("click", (event) => {
    const moreBtn = event.target.closest('[data-action="open-session-menu"]');
    const sessionItem = event.target.closest("[data-session-id]");
    if (!manager.activePlugin || !sessionItem) return;

    const sessionId = sessionItem.dataset.sessionId;

    if (moreBtn) {
        event.preventDefault();
        event.stopPropagation();
        openSessionMenuId = sessionId;

        shell.querySelectorAll('.cc-session-item.menu-open').forEach(el => el.classList.remove('menu-open'));
        sessionItem.classList.add('menu-open');

        const session = manager.activePlugin.getSessionById(sessionId);
        refs.contextPinText.textContent = session?.pinned ? "取消固定" : "固定";

        const btnRect = moreBtn.getBoundingClientRect();
        const panelRect = refs.panel.getBoundingClientRect();
        
        const menuWidth = 180;
        const menuHeight = 136;

        let topPos = btnRect.bottom - panelRect.top + 4;
        let leftPos = btnRect.left - panelRect.left;

        if (leftPos + menuWidth > panelRect.width) {
            leftPos = panelRect.width - menuWidth - 10;
        }
        
        if (topPos + menuHeight > panelRect.height) {
            topPos = btnRect.top - panelRect.top - menuHeight - 4;
        }

        refs.sessionContextMenu.style.top = `${topPos}px`;
        refs.sessionContextMenu.style.left = `${leftPos}px`;
        
        refs.sessionContextMenu.classList.add("is-open");
        return;
    }

    manager.activePlugin.setCurrentSession(sessionId);
    manager.closeCompactSidebar();
  });
  
  refs.sessionContextMenu.addEventListener("click", (event) => {
      const actionBtn = event.target.closest("[data-context-action]");
      if (!actionBtn || !manager.activePlugin || !openSessionMenuId) return;

      const action = actionBtn.dataset.contextAction;
      if (action === "pin") {
          manager.activePlugin.togglePinSession(openSessionMenuId);
      } else if (action === "rename") {
          const nextTitle = window.prompt("重命名会话", manager.activePlugin.getSessionById(openSessionMenuId)?.title || "");
          if (nextTitle != null) manager.activePlugin.renameSession(openSessionMenuId, nextTitle);
      } else if (action === "delete") {
          manager.activePlugin.deleteSession(openSessionMenuId);
      }

      manager.closeContextMenu();
  });

  refs.settingsNavBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      manager.switchSettingsTab(btn.dataset.tab);
    });
  });

  Object.values(channelFields).forEach(input => {
    input.addEventListener("change", () => {
      manager.saveCurrentChannelEdits();
      manager.renderChannelSettings(); 
    });
  });

  shell.addEventListener("change", (event) => {
    const toggleTarget = event.target.closest('.cc-toggle[data-action="toggle-channel"]');
    if (toggleTarget) {
       const idToToggle = toggleTarget.dataset.id;
       const channel = tempConfig.channels.find(c => c.id === idToToggle);
       if (channel) {
           if (isCometApiManagedChannel(channel)) return;
           channel.enabled = event.target.checked;
           manager.saveCurrentChannelEdits();
           manager.renderChannelSettings();
       }
    }
  });

  shell.addEventListener("click", (event) => {
    const actionTarget = event.target.closest("[data-action]");
    
    if (event.target === refs.settingsModalBackdrop) {
      manager.applyAndSaveSettings();
      return;
    }
    
    if (!actionTarget) return;

    const action = actionTarget.dataset.action;
    if (action === "copy-image" || action === "download-image") {
      event.preventDefault();
      event.stopPropagation();
    }
    if (action === "image-page-prev" || action === "image-page-next") {
      event.preventDefault();
      event.stopPropagation();
    }
    
    if (action === "toggle-channel") {
       event.stopPropagation();
       return;
    }

    if (action === "toggle-model-row-menu") {
       const popup = actionTarget.nextElementSibling;
       const isOpen = popup?.classList.contains("is-open");
       document.querySelectorAll(".cc-model-row-popup").forEach(el => el.classList.remove("is-open"));
       if (!isOpen && popup) {
           popup.classList.add("is-open");
           setTimeout(() => {
               const scrollPane = popup.closest(".cc-channels-editor-pane");
               if (scrollPane) {
                   const popRect = popup.getBoundingClientRect();
                   const paneRect = scrollPane.getBoundingClientRect();
                   if (popRect.bottom > paneRect.bottom - 10) {
                       scrollPane.scrollBy({ top: popRect.bottom - paneRect.bottom + 16, behavior: "smooth" });
                   }
               }
           }, 10);
       }
       return;
    }

    if (action === "close-workspace") {
      manager.close();
      return;
    }

    if (action === "toggle-compact-mode") {
      manager.toggleLayoutMode();
      return;
    }

    if (action === "open-compact-sidebar") {
      manager.openCompactSidebar();
      return;
    }

    if (action === "close-compact-sidebar") {
      manager.closeCompactSidebar();
      return;
    }
    
    if (action === "copy-code") {
      const codeEl = actionTarget.closest('.cc-code-block')?.querySelector('code');
      if (codeEl) {
        copyTextToClipboard(codeEl.textContent).then(copied => {
          if (copied) {
            const originalHTML = actionTarget.innerHTML;
            actionTarget.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> 已复制`;
            setTimeout(() => { if (actionTarget) actionTarget.innerHTML = originalHTML; }, 2000);
          }
        });
      }
      return;
    }
    
    if (action === "toggle-model-selector") {
        if (refs.modelPopup.classList.contains("is-open")) {
            manager.closeModelSelector();
        } else {
            manager.openModelSelector();
        }
        return;
    }
    
    if (action === "select-model") {
        if (!manager.activePlugin) return;
        const config = manager.activePlugin.getConfigValues();
        config.activeChannelId = actionTarget.dataset.chId;
        config.activeModelId = actionTarget.dataset.mId;
        manager.activePlugin.applySettingsValues(config);
        manager.closeModelSelector();
        return;
    }

    if (!manager.activePlugin) return;

    if (action === "copy-message") manager.activePlugin.copyMessageText(actionTarget.dataset.messageId);
    else if (action === "copy-image") manager.activePlugin.copyMessageImage(actionTarget.dataset.messageId, actionTarget.dataset.fileIndex);
    else if (action === "download-image") manager.activePlugin.downloadMessageFile(actionTarget.dataset.messageId, actionTarget.dataset.fileIndex);
    else if (action === "image-page-prev") manager.activePlugin.stepMessageImageIndex(actionTarget.dataset.messageId, -1);
    else if (action === "image-page-next") manager.activePlugin.stepMessageImageIndex(actionTarget.dataset.messageId, 1);
    else if (action === "regenerate-message") manager.activePlugin.regenerateAssistantMessage(actionTarget.dataset.messageId);
    else if (action === "toggle-sidebar") {
      if (manager.isCompactMode()) manager.closeCompactSidebar();
      else manager.activePlugin.toggleSidebar();
    }
    else if (action === "new-session") {
      manager.activePlugin.createSession(true);
      manager.closeCompactSidebar();
    }
    else if (action === "workspace-add-file") openFilePicker(refs.fileInput);
    
    else if (action === "open-settings-modal") {
      manager.closeCompactSidebar();
      manager.openSettingsModal();
    }
    else if (action === "close-settings-modal") manager.applyAndSaveSettings();
    
    else if (action === "add-channel") {
      manager.saveCurrentChannelEdits();
      const newId = createId("ch");
      tempConfig.channels.push({
        id: newId, name: `新渠道 ${tempConfig.channels.length + 1}`,
        api_url: "https://api.openai.com", api_key: "", enabled: false,
        models: [{ id: createId("m"), name: "", override_api_key: "", api_format: "openai", category: "llm", interface_mode: "", _formatTouched: false }]
      });
      editingChannelId = newId;
      manager.renderChannelSettings();
    }
    else if (action === "edit-channel") {
      manager.saveCurrentChannelEdits();
      editingChannelId = actionTarget.dataset.id;
      manager.renderChannelSettings();
    }
    else if (action === "delete-channel") {
      if (!actionTarget.classList.contains("is-confirming")) {
        actionTarget.classList.add("is-confirming");
        const origHtml = actionTarget.innerHTML;
        actionTarget.innerHTML = `<span style="font-size:12px; font-weight:600;">确定删除?</span>`;
        actionTarget.style.width = "auto";
        actionTarget.style.padding = "0 10px";
        actionTarget.style.background = "rgba(242, 139, 130, 0.15)";
        actionTarget.style.color = "var(--cc-error)";
        actionTarget.style.border = "1px solid rgba(242, 139, 130, 0.3)";

        setTimeout(() => {
          if (actionTarget) {
            actionTarget.classList.remove("is-confirming");
            actionTarget.innerHTML = origHtml;
            actionTarget.style.width = "";
            actionTarget.style.padding = "";
            actionTarget.style.background = "";
            actionTarget.style.color = "";
            actionTarget.style.border = "";
          }
        }, 3000);
        return;
      }

      const idToDelete = actionTarget.dataset.id;
      if (isCometApiManagedChannel(idToDelete)) {
        tempConfig.hiddenCometApiChannelIds = Array.from(new Set([...(tempConfig.hiddenCometApiChannelIds || []), idToDelete]));
      }
      tempConfig.channels = tempConfig.channels.filter(c => c.id !== idToDelete);
      if (!tempConfig.channels.length) {
        tempConfig.channels.push({
          id: createId("ch"),
          name: "默认渠道",
          api_url: "https://api.openai.com",
          api_key: "",
          enabled: false,
          models: [{ id: createId("m"), name: "", override_api_key: "", api_format: "openai", category: "llm", interface_mode: "", _formatTouched: false }],
        });
      }
      if (tempConfig.activeChannelId === idToDelete) {
        tempConfig.activeChannelId = tempConfig.channels[0]?.id || "";
      }
      if (editingChannelId === idToDelete) {
        editingChannelId = tempConfig.channels[0]?.id || "";
      }
      manager.renderChannelSettings();
    }
    
    else if (action === "add-channel-model") {
      tempEditingModels.push({ id: createId("m"), name: "", override_api_key: "", api_format: "openai", category: "llm", interface_mode: "", _formatTouched: false });
      manager.renderModelsEditor();
    }
    else if (action === "delete-channel-model") {
      const idx = parseInt(actionTarget.dataset.idx);
      if (isCometApiManagedModel(editingChannelId, tempEditingModels[idx])) return;
      if (tempEditingModels.length > 1) {
          tempEditingModels.splice(idx, 1);
          manager.renderModelsEditor();
      }
    }
    
    else if (action === "add-preset") {
      manager.saveCurrentPresetEdits();
      const newId = createId("preset");
      tempConfig.presets = tempConfig.presets || [];
      tempConfig.presets.push({
        id: newId, 
        name: `新预设 ${tempConfig.presets.length + 1}`,
        ...JSON.parse(JSON.stringify(DEFAULT_PRESET_JSON))
      });
      editingPresetId = newId;
      manager.renderPresetSettings();
    }
    else if (action === "edit-preset") {
      manager.saveCurrentPresetEdits();
      editingPresetId = actionTarget.dataset.id;
      manager.renderPresetSettings();
    }
    else if (action === "delete-preset") {
      if (!actionTarget.classList.contains("is-confirming")) {
        actionTarget.classList.add("is-confirming");
        const origHtml = actionTarget.innerHTML;
        actionTarget.innerHTML = `<svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:currentColor;stroke-width:2;fill:none;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
        actionTarget.style.background = "rgba(242, 139, 130, 0.15)";
        actionTarget.style.color = "var(--cc-error)";
        actionTarget.style.border = "1px solid rgba(242, 139, 130, 0.3)";

        setTimeout(() => {
          if (actionTarget) {
            actionTarget.classList.remove("is-confirming");
            actionTarget.innerHTML = origHtml;
            actionTarget.style.background = "";
            actionTarget.style.color = "";
            actionTarget.style.border = "";
          }
        }, 3000);
        return;
      }
      
      const idToDelete = actionTarget.dataset.id;
      tempConfig.presets = tempConfig.presets.filter(p => p.id !== idToDelete);
      editingPresetId = tempConfig.presets[0]?.id || null;
      manager.renderPresetSettings();
    }
  });

  document.addEventListener("mousedown", (event) => {
    if (!refs.shell.classList.contains("is-open")) return;
    
    if (refs.sessionContextMenu.classList.contains("is-open") && !refs.sessionContextMenu.contains(event.target) && !event.target.closest('[data-action="open-session-menu"]')) {
      manager.closeContextMenu();
    }

    if (!event.target.closest('.cc-custom-select')) {
      document.querySelectorAll(".cc-custom-select").forEach(sel => sel.classList.remove("is-open"));
    }

    if (!event.target.closest('.cc-model-col-act')) {
      document.querySelectorAll(".cc-model-row-popup").forEach(el => el.classList.remove("is-open"));
    }
    
    if (refs.modelPopup.classList.contains("is-open") && !refs.modelPopup.contains(event.target) && !refs.modelTrigger.contains(event.target)) {
        manager.closeModelSelector();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (refs.modelPopup.classList.contains("is-open")) {
      manager.closeModelSelector();
      return;
    }
    if (refs.settingsModalBackdrop.classList.contains("is-open")) {
      manager.applyAndSaveSettings();
      return;
    }
    if (refs.sessionContextMenu.classList.contains("is-open")) {
      manager.closeContextMenu();
      return;
    }
    if (refs.shell.classList.contains("is-open")) manager.close();
  });

  return manager;
}

