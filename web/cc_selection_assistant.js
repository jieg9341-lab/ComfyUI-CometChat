import { api } from "../../scripts/api.js";
import { escapeHtml, parseMarkdown, copyTextToClipboard, normalizeModelCategory } from "./cc_utils.js";

const ACTIONS = {
  translate: { label: "翻译", title: "翻译" },
  explain: { label: "解释", title: "解释" },
  optimize: { label: "优化", title: "提示词优化" },
};

let installed = false;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function isAssistantUiTarget(target) {
  const el = target?.nodeType === Node.ELEMENT_NODE ? target : null;
  if (!el) return false;
  return !!el.closest(".cc-workspace-shell, .cc-global-launcher, .cc-selection-toolbar, .cc-selection-panel, .cc-settings-modal-backdrop, .cc-model-popup, .cc-launcher-menu");
}

function isTextControl(target) {
  const el = target?.nodeType === Node.ELEMENT_NODE ? target : null;
  if (!el) return false;
  const tag = String(el.tagName || "").toLowerCase();
  if (tag === "textarea") return true;
  if (tag !== "input") return false;
  const type = String(el.type || "text").toLowerCase();
  return ["text", "search", "url", "email", "tel", "number", ""].includes(type);
}

function getFrameElement(doc) {
  try {
    const frame = doc?.defaultView?.frameElement;
    return frame instanceof HTMLIFrameElement ? frame : null;
  } catch (_) {
    return null;
  }
}

function adjustRectToTopWindow(rect, doc = document) {
  const frame = getFrameElement(doc);
  if (!frame) return rect;
  const frameRect = frame.getBoundingClientRect();
  return {
    left: rect.left + frameRect.left,
    top: rect.top + frameRect.top,
    right: rect.right + frameRect.left,
    bottom: rect.bottom + frameRect.top,
    width: rect.width,
    height: rect.height,
  };
}

function getTextControlSelectionInfo(target = document.activeElement) {
  const raw = target?.nodeType === Node.ELEMENT_NODE ? target : null;
  const el = raw?.matches?.("input, textarea") ? raw : raw?.closest?.("input, textarea");
  if (!isTextControl(el) || isAssistantUiTarget(el)) return null;
  const start = Number(el.selectionStart);
  const end = Number(el.selectionEnd);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start === end) return null;
  const selectionStart = Math.min(start, end);
  const selectionEnd = Math.max(start, end);
  const text = String(el.value || "").slice(selectionStart, selectionEnd).replace(/\s+/g, " ").trim();
  if (!text) return null;
  const rect = adjustRectToTopWindow(el.getBoundingClientRect(), el.ownerDocument);
  if (!rect || (!rect.width && !rect.height)) return null;
  return {
    text,
    rect,
    replacement: { type: "text-control", element: el, start: selectionStart, end: selectionEnd },
  };
}

function getSelectionInfo(docRoot = document) {
  const selection = docRoot?.getSelection?.() || docRoot?.defaultView?.getSelection?.();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
  const text = selection.toString().replace(/\s+/g, " ").trim();
  if (!text) return null;
  const range = selection.getRangeAt(0);
  const ancestor = range.commonAncestorContainer?.nodeType === Node.ELEMENT_NODE
    ? range.commonAncestorContainer
    : range.commonAncestorContainer?.parentElement;
  if (isAssistantUiTarget(ancestor)) return null;
  const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0);
  const rect = adjustRectToTopWindow(rects[0] || range.getBoundingClientRect(), range.startContainer?.ownerDocument || document);
  if (!rect || (!rect.width && !rect.height)) return null;
  const editableRoot = ancestor?.isContentEditable
    ? ancestor
    : ancestor?.closest?.("[contenteditable='true'], [contenteditable='plaintext-only'], [contenteditable='']");
  return {
    text,
    rect,
    replacement: editableRoot ? { type: "range", range: range.cloneRange(), root: editableRoot } : null,
  };
}

function unionRects(rects) {
  const usable = rects.filter((rect) => rect && rect.width > 0 && rect.height > 0);
  if (usable.length === 0) return null;
  const left = Math.min(...usable.map((rect) => rect.left));
  const top = Math.min(...usable.map((rect) => rect.top));
  const right = Math.max(...usable.map((rect) => rect.right));
  const bottom = Math.max(...usable.map((rect) => rect.bottom));
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

function intersectRect(rect, bounds) {
  const left = Math.max(rect.left, bounds.left);
  const top = Math.max(rect.top, bounds.top);
  const right = Math.min(rect.right, bounds.right);
  const bottom = Math.min(rect.bottom, bounds.bottom);
  if (right <= left || bottom <= top) return null;
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

function getXtermSelectionInfo() {
  const terminals = Array.from(document.querySelectorAll(".xterm"));
  for (const terminal of terminals) {
    if (isAssistantUiTarget(terminal)) continue;
    const selectionLayer = terminal.querySelector(".xterm-selection");
    const screen = terminal.querySelector(".xterm-screen") || terminal;
    const screenRect = screen.getBoundingClientRect();
    if (!selectionLayer || !screenRect.width || !screenRect.height) continue;

    const selectionRects = Array.from(selectionLayer.querySelectorAll("div"))
      .map((element) => intersectRect(element.getBoundingClientRect(), screenRect))
      .filter(Boolean);
    if (selectionRects.length === 0) {
      const layerRect = intersectRect(selectionLayer.getBoundingClientRect(), screenRect);
      if (layerRect) selectionRects.push(layerRect);
    }
    if (selectionRects.length === 0) continue;

    const rows = Array.from(terminal.querySelectorAll(".xterm-accessibility-tree [role='listitem'], .xterm-rows > div"));
    const rowTexts = rows.map((row) => String(row.textContent || "").replace(/\u00a0/g, " "));
    if (rowTexts.length === 0) continue;

    const firstRowRect = rows[0]?.getBoundingClientRect?.();
    const cellHeight = parseFloat(rows[0]?.style?.height || "") || firstRowRect?.height || (screenRect.height / rowTexts.length) || 18;
    const measure = terminal.querySelector(".xterm-char-measure-element");
    const measuredWidth = measure?.getBoundingClientRect?.().width || parseFloat(getComputedStyle(measure || terminal).width || "");
    const maxLineLength = Math.max(1, ...rowTexts.map((text) => text.length));
    const cellWidth = measuredWidth > 0 ? measuredWidth : (screenRect.width / Math.max(maxLineLength, 80));
    if (!cellWidth || !cellHeight) continue;

    const ranges = new Map();
    for (const rect of selectionRects) {
      const rowStart = clamp(Math.floor((rect.top - screenRect.top) / cellHeight), 0, rowTexts.length - 1);
      const rowEnd = clamp(Math.floor((rect.bottom - 1 - screenRect.top) / cellHeight), 0, rowTexts.length - 1);
      for (let row = rowStart; row <= rowEnd; row += 1) {
        const start = row === rowStart ? Math.max(0, Math.floor((rect.left - screenRect.left) / cellWidth)) : 0;
        const end = row === rowEnd ? Math.max(start, Math.ceil((rect.right - screenRect.left) / cellWidth)) : rowTexts[row].length;
        const previous = ranges.get(row);
        ranges.set(row, previous
          ? { start: Math.min(previous.start, start), end: Math.max(previous.end, end) }
          : { start, end });
      }
    }

    const selectedRows = Array.from(ranges.entries()).sort((a, b) => a[0] - b[0]);
    const text = selectedRows
      .map(([row, range]) => rowTexts[row].slice(range.start, range.end).replace(/\s+$/g, ""))
      .join("\n")
      .trim();
    const rect = unionRects(selectionRects);
    if (text && rect) {
      return { text, rect, replacement: null };
    }
  }
  return null;
}

function inferTranslateTarget(text) {
  const source = String(text || "");
  const zhCount = (source.match(/[\u3400-\u9fff]/g) || []).length;
  const enCount = (source.match(/[A-Za-z]/g) || []).length;
  return zhCount > enCount ? "英文" : "中文（简体）";
}

function getEnabledTextChannels(config) {
  return (config?.channels || [])
    .filter((channel) => channel?.enabled)
    .map((channel) => ({
      ...channel,
      models: (channel.models || []).filter((model) => normalizeModelCategory(model.category, model.api_format, model.name) === "llm"),
    }))
    .filter((channel) => channel.models.length > 0);
}

function resolveAssistantModelConfig(controller) {
  const config = controller.getConfigValues();
  const assistant = config.selection_assistant || {};
  const channels = getEnabledTextChannels(config);
  const channel = channels.find((item) => item.id === assistant.channel_id) || channels[0];
  const model = channel?.models?.find((item) => item.id === assistant.model_id) || channel?.models?.[0];
  if (!channel || !model) throw new Error("请先在设置页为划词助手指定可用的文本模型。");
  const apiKey = String(model.override_api_key || "").trim() || String(channel.api_key || "").trim();
  if (!String(channel.api_url || "").trim()) throw new Error("划词助手默认渠道缺少 API URL。");
  if (!apiKey) throw new Error("划词助手默认模型缺少 API Key。");
  if (!String(model.name || "").trim()) throw new Error("划词助手默认模型名称为空。");
  return {
    api_url: channel.api_url,
    api_key: apiKey,
    model: model.name,
    api_format: model.api_format || "openai",
    model_category: "llm",
    channel_id: channel.id || "",
    channel_name: channel.name || "",
    source_channel: channel.source_channel || "",
    temperature: 0.2,
    max_tokens: config.max_tokens,
    presets: config.presets || [],
  };
}

function icon(name) {
  const icons = {
    translate: '<path d="M2 5h12"></path><path d="M7 2h1"></path><path d="m5 8 6 6"></path><path d="m4 14 6-6 2-3"></path><path d="m22 22-5-10-5 10"></path><path d="M14 18h6"></path>',
    explain: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path><path d="M8 7h8M8 11h6"></path>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"></rect><path d="M5 15V6a2 2 0 0 1 2-2h9"></path>',
    replace: '<path d="M3 7h12"></path><path d="m12 4 3 3-3 3"></path><path d="M21 17H9"></path><path d="m12 14-3 3 3 3"></path>',
    optimize: '<path d="m14 4 6 6"></path><path d="m5 19 9.5-9.5"></path><path d="m14 4-1 5 5-1"></path><path d="M4 8h3M6 6v4M17 17h3M18.5 15.5v3"></path>',
    ask: '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"></path><path d="M9 9h6M9 13h4"></path>',
    close: '<path d="M18 6 6 18M6 6l12 12"></path>',
    send: '<path d="M12 19V5"></path><path d="m5 12 7-7 7 7"></path>',
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || ""}</svg>`;
}

function buildDraft({ text, action, result, question = "" }) {
  const selected = String(text || "").trim();
  const answer = String(result || "").trim();
  const asked = String(question || "").trim();
  if (!answer) {
    return `我想问问这段内容：\n\n${selected}${asked ? `\n\n我的问题：${asked}` : "\n\n"}`;
  }
  const actionLabel = ACTIONS[action]?.title || "划词助手";
  return `基于这段划词内容继续聊：\n\n原文：\n${selected}\n\n${actionLabel}结果：\n${answer}${asked ? `\n\n我的问题：${asked}` : "\n\n"}`;
}

function openChatWithDraft(controller, workspace, draft) {
  window.CometChat?.open?.();
  controller.updateDraft(draft, "selection");
  window.requestAnimationFrame(() => {
    workspace?.refs?.textarea?.focus?.();
    workspace?.refs?.textarea?.setSelectionRange?.(draft.length, draft.length);
  });
}

export function installSelectionAssistant(controller, workspace, options = {}) {
  if (installed) return;
  installed = true;
  const isSuppressed = () => options?.shouldSuppress?.() === true;

  const state = {
    text: "",
    rect: null,
    action: "",
    result: "",
    abortController: null,
    hideTimer: null,
    lastSelectionTarget: null,
    replacement: null,
    toolbarDragging: false,
    toolbarMoved: false,
    panelDragging: false,
    panelMoved: false,
  };

  const toolbar = document.createElement("div");
  toolbar.className = "cc-selection-toolbar";
  toolbar.innerHTML = `
    <div class="cc-selection-grip" aria-hidden="true"></div>
    <button type="button" data-sa-action="translate" data-tip="翻译">${icon("translate")}</button>
    <button type="button" data-sa-action="explain" data-tip="解释">${icon("explain")}</button>
    <button type="button" data-sa-action="copy" data-tip="复制">${icon("copy")}</button>
    <button type="button" data-sa-action="optimize" data-tip="提示词优化">${icon("optimize")}</button>
    <button type="button" data-sa-action="ask" data-tip="问问">${icon("ask")}</button>
    <button class="cc-selection-close" type="button" data-sa-action="close" data-tip="关闭">${icon("close")}</button>
  `;

  const panel = document.createElement("div");
  panel.className = "cc-selection-panel";
  panel.innerHTML = `
    <div class="cc-selection-panel-handle" aria-hidden="true"></div>
    <div class="cc-selection-panel-head">
      <div>
        <div class="cc-selection-panel-title"></div>
        <div class="cc-selection-panel-meta"></div>
      </div>
      <button class="cc-selection-panel-close" type="button" title="关闭">${icon("close")}</button>
    </div>
    <div class="cc-selection-source"></div>
    <div class="cc-selection-result"></div>
    <div class="cc-selection-result-actions" hidden>
      <button type="button" data-result-action="copy" title="复制结果" aria-label="复制结果">${icon("copy")}</button>
      <button type="button" data-result-action="replace" title="替换原文" aria-label="替换原文">${icon("replace")}</button>
    </div>
    <form class="cc-selection-followup">
      <input type="text" placeholder="继续提问">
      <button type="submit" title="打开 Chat 继续提问">${icon("send")}</button>
    </form>
  `;

  document.body.appendChild(toolbar);
  document.body.appendChild(panel);

  const hideToolbar = () => {
    toolbar.classList.remove("is-open", "is-close-zone");
    state.toolbarMoved = false;
  };
  const hidePanel = () => {
    panel.classList.remove("is-open", "is-loading", "is-error", "has-result-actions");
    state.abortController?.abort?.();
    state.abortController = null;
  };

  const positionElement = (element, rect, preferred = "top") => {
    if (!rect) return;
    element.style.left = "0px";
    element.style.top = "0px";
    const margin = 12;
    const box = element.getBoundingClientRect();
    const left = clamp(rect.left + rect.width / 2 - box.width / 2, margin, window.innerWidth - box.width - margin);
    let top = preferred === "bottom" ? rect.bottom + margin : rect.top - box.height - margin;
    if (top < margin) top = rect.bottom + margin;
    if (top + box.height > window.innerHeight - margin) top = Math.max(margin, rect.top - box.height - margin);
    element.style.left = `${Math.round(left)}px`;
    element.style.top = `${Math.round(top)}px`;
  };

  const makeDraggable = (element, handle, stateKey) => {
    if (!element || !handle) return;
    let drag = null;
    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      if (event.target?.closest?.("button, input, textarea, select")) return;
      event.preventDefault();
      event.stopPropagation();
      const rect = element.getBoundingClientRect();
      drag = {
        pointerId: event.pointerId,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
        width: rect.width,
        height: rect.height,
      };
      state[stateKey] = true;
      element.classList.add("is-dragging");
      handle.setPointerCapture?.(event.pointerId);
    });
    handle.addEventListener("pointermove", (event) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      event.preventDefault();
      const margin = 8;
      const left = clamp(event.clientX - drag.offsetX, margin, window.innerWidth - drag.width - margin);
      const top = clamp(event.clientY - drag.offsetY, margin, window.innerHeight - drag.height - margin);
      element.style.left = `${Math.round(left)}px`;
      element.style.top = `${Math.round(top)}px`;
    });
    const finish = (event) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      drag = null;
      state[stateKey] = false;
      if (stateKey === "toolbarDragging") state.toolbarMoved = true;
      if (stateKey === "panelDragging") state.panelMoved = true;
      element.classList.remove("is-dragging");
      handle.releasePointerCapture?.(event.pointerId);
    };
    handle.addEventListener("pointerup", finish);
    handle.addEventListener("pointercancel", finish);
  };

  const dispatchInputEvent = (element, value) => {
    try {
      element.dispatchEvent(new InputEvent("input", {
        bubbles: true,
        inputType: "insertReplacementText",
        data: value,
      }));
    } catch (_) {
      element.dispatchEvent(new Event("input", { bubbles: true }));
    }
  };

  const canReplaceOriginalSelection = () => {
    const replacement = state.replacement;
    if (!replacement) return false;
    if (replacement.type === "text-control") {
      return replacement.element?.isConnected && isTextControl(replacement.element);
    }
    if (replacement.type === "range") {
      return !!replacement.range && replacement.root?.isConnected && replacement.root.isContentEditable;
    }
    return false;
  };

  const replaceOriginalSelection = (value) => {
    const replacement = state.replacement;
    const text = String(value || "");
    if (!text || !canReplaceOriginalSelection()) return false;
    if (replacement.type === "text-control") {
      const element = replacement.element;
      const doc = element.ownerDocument || document;
      element.focus({ preventScroll: true });
      element.setSelectionRange(replacement.start, replacement.end);
      let ok = false;
      try {
        ok = doc.execCommand?.("insertText", false, text) === true;
      } catch (_) {}
      if (!ok) {
        element.setRangeText(text, replacement.start, replacement.end, "end");
        dispatchInputEvent(element, text);
      }
      element.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    if (replacement.type === "range") {
      const doc = replacement.root.ownerDocument || document;
      const selection = doc.getSelection?.() || doc.defaultView?.getSelection?.();
      selection?.removeAllRanges?.();
      selection?.addRange?.(replacement.range);
      let ok = false;
      try {
        ok = doc.execCommand?.("insertText", false, text) === true;
      } catch (_) {}
      if (!ok) {
        replacement.range.deleteContents();
        const textNode = document.createTextNode(text);
        replacement.range.insertNode(textNode);
        replacement.range.setStartAfter(textNode);
        replacement.range.collapse(true);
        selection?.removeAllRanges?.();
        selection?.addRange?.(replacement.range);
        dispatchInputEvent(replacement.root, text);
      }
      return true;
    }
    return false;
  };

  const isSameToolbarSelection = (info) => {
    if (!state.rect) return false;
    const rect = info.rect;
    return info.text === state.text
      && Math.abs(rect.left - state.rect.left) < 2
      && Math.abs(rect.top - state.rect.top) < 2
      && Math.abs(rect.width - state.rect.width) < 2
      && Math.abs(rect.height - state.rect.height) < 2;
  };

  const showToolbar = (info) => {
    if (isSuppressed()) return;
    const config = controller.getConfigValues();
    if (config.selection_assistant?.enabled !== true) return;
    if (!isSameToolbarSelection(info)) {
      state.toolbarMoved = false;
      toolbar.classList.remove("is-close-zone");
    }
    state.text = info.text;
    state.rect = info.rect;
    state.replacement = info.replacement || null;
    toolbar.classList.add("is-open");
    if (!state.toolbarMoved && !state.toolbarDragging) {
      window.requestAnimationFrame(() => positionElement(toolbar, info.rect, "top"));
    }
  };

  const refreshSelection = () => {
    if (isSuppressed()) {
      hideToolbar();
      hidePanel();
      return;
    }
    if (state.toolbarDragging) return;
    if (panel.classList.contains("is-open")) return;
    const config = controller.getConfigValues();
    if (config.selection_assistant?.enabled !== true) {
      hideToolbar();
      return;
    }
    const info = getActiveSelectionInfo();
    if (!info || info.text.length > 12000) {
      hideToolbar();
      return;
    }
    showToolbar(info);
  };

  const getActiveSelectionInfo = () => {
    return getSelectionInfo(document)
      || getTextControlSelectionInfo(state.lastSelectionTarget || document.activeElement)
      || getXtermSelectionInfo();
  };

  const scheduleSelectionRefresh = (event = null) => {
    if (event?.target) state.lastSelectionTarget = event.target;
    window.clearTimeout(state.hideTimer);
    state.hideTimer = window.setTimeout(refreshSelection, 80);
  };

  const renderPanel = (action, loading = false, errorText = "") => {
    const targetLanguage = inferTranslateTarget(state.text);
    state.action = action;
    const title = ACTIONS[action]?.title || "划词助手";
    panel.querySelector(".cc-selection-panel-title").textContent = title;
    panel.querySelector(".cc-selection-panel-meta").innerHTML = action === "translate"
      ? `<span>自动检测</span><svg viewBox="0 0 24 24"><path d="M5 12h14"></path><path d="m13 6 6 6-6 6"></path></svg><span>${escapeHtml(targetLanguage)}</span>`
      : `<span>${escapeHtml((state.text || "").length)} 字符</span>`;
    panel.querySelector(".cc-selection-source").textContent = state.text;
    const resultEl = panel.querySelector(".cc-selection-result");
    const actionsEl = panel.querySelector(".cc-selection-result-actions");
    if (loading) {
      panel.classList.add("is-loading");
      panel.classList.remove("is-error");
      resultEl.innerHTML = `<div class="cc-selection-loading"><span></span><span></span><span></span></div>`;
      if (actionsEl) actionsEl.hidden = true;
      panel.classList.remove("has-result-actions");
    } else if (errorText) {
      panel.classList.remove("is-loading");
      panel.classList.add("is-error");
      resultEl.textContent = errorText;
      if (actionsEl) actionsEl.hidden = true;
      panel.classList.remove("has-result-actions");
    } else {
      panel.classList.remove("is-loading", "is-error");
      resultEl.innerHTML = parseMarkdown(state.result || "");
      const showResultActions = action === "translate" && !!String(state.result || "").trim();
      if (actionsEl) {
        const replaceButton = actionsEl.querySelector('[data-result-action="replace"]');
        const replaceable = canReplaceOriginalSelection();
        actionsEl.hidden = !showResultActions;
        replaceButton.disabled = !replaceable;
        replaceButton.title = replaceable ? "替换原文" : "当前划词位置不可替换";
      }
      panel.classList.toggle("has-result-actions", showResultActions);
    }
    panel.classList.add("is-open");
    if (!state.panelMoved) {
      window.requestAnimationFrame(() => positionElement(panel, state.rect, "bottom"));
    }
  };

  const runAssistantAction = async (action) => {
    if (isSuppressed()) {
      hideToolbar();
      hidePanel();
      return;
    }
    if (!state.text) return;
    hideToolbar();
    if (action === "ask") {
      openChatWithDraft(controller, workspace, buildDraft({ text: state.text }));
      return;
    }
    if (action === "copy") {
      await copyTextToClipboard(state.text);
      return;
    }
    state.result = "";
    state.panelMoved = false;
    renderPanel(action, true);
    state.abortController?.abort?.();
    state.abortController = new AbortController();
    try {
      const config = resolveAssistantModelConfig(controller);
      const response = await api.fetchApi("/nkxx/comet_chat/selection/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: state.abortController.signal,
        body: JSON.stringify({
          action,
          text: state.text,
          target_language: inferTranslateTarget(state.text),
          config,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.error) throw new Error(payload.error || `HTTP ${response.status}`);
      state.result = String(payload.result || "").trim() || "没有返回内容。";
      renderPanel(action, false);
    } catch (error) {
      if (error?.name === "AbortError") return;
      renderPanel(action, false, error?.message || String(error));
    } finally {
      state.abortController = null;
    }
  };

  const updateToolbarCloseZone = (event) => {
    if (!toolbar.classList.contains("is-open")) return;
    const rect = toolbar.getBoundingClientRect();
    const inZone = event.clientX >= rect.right - 30
      && event.clientX <= rect.right + 36
      && event.clientY >= rect.top - 10
      && event.clientY <= rect.bottom + 10;
    toolbar.classList.toggle("is-close-zone", inZone);
  };

  toolbar.addEventListener("mousedown", (event) => event.preventDefault());
  toolbar.addEventListener("click", (event) => {
    const button = event.target.closest("[data-sa-action]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const action = button.dataset.saAction;
    if (action === "close") {
      hideToolbar();
      window.getSelection?.()?.removeAllRanges?.();
      return;
    }
    void runAssistantAction(action);
  });

  makeDraggable(toolbar, toolbar.querySelector(".cc-selection-grip"), "toolbarDragging");
  makeDraggable(panel, panel.querySelector(".cc-selection-panel-handle"), "panelDragging");
  makeDraggable(panel, panel.querySelector(".cc-selection-panel-head"), "panelDragging");

  panel.querySelector(".cc-selection-panel-close").addEventListener("click", () => hidePanel());
  panel.querySelector(".cc-selection-result-actions").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-result-action]");
    if (!button || button.disabled) return;
    event.preventDefault();
    event.stopPropagation();
    const result = String(state.result || "").trim();
    if (!result) return;
    if (button.dataset.resultAction === "copy") {
      await copyTextToClipboard(result);
      return;
    }
    if (button.dataset.resultAction === "replace" && replaceOriginalSelection(result)) {
      hidePanel();
    }
  });
  panel.querySelector(".cc-selection-followup").addEventListener("submit", (event) => {
    event.preventDefault();
    const input = panel.querySelector(".cc-selection-followup input");
    const question = input.value.trim();
    openChatWithDraft(controller, workspace, buildDraft({
      text: state.text,
      action: state.action,
      result: state.result,
      question,
    }));
    hidePanel();
  });
  document.addEventListener("selectionchange", scheduleSelectionRefresh, true);
  document.addEventListener("select", scheduleSelectionRefresh, true);
  document.addEventListener("mouseup", scheduleSelectionRefresh, true);
  document.addEventListener("pointerup", scheduleSelectionRefresh, true);
  document.addEventListener("keyup", scheduleSelectionRefresh, true);
  document.addEventListener("mousemove", updateToolbarCloseZone, true);
  document.addEventListener("mousedown", (event) => {
    if (toolbar.contains(event.target) || panel.contains(event.target)) return;
    hideToolbar();
  }, true);
  window.addEventListener("scroll", hideToolbar, true);
  window.addEventListener("resize", () => {
    hideToolbar();
    if (panel.classList.contains("is-open")) positionElement(panel, state.rect, "bottom");
  }, true);
}
