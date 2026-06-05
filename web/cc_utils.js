export function makeCustomSelect(container, optionsList) {
  if (!container) return;
  container.classList.add("cc-custom-select");
  container.innerHTML = `
    <div class="cc-select-display">
      <span class="cc-select-text"></span>
      <svg class="cc-select-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
    </div>
    <div class="cc-select-dropdown">
      ${optionsList.map(opt => `
        <div class="cc-select-option" data-value="${opt.value}">
          <span>${escapeHtml(opt.label)}</span>
          <svg class="cc-select-check" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>
      `).join('')}
    </div>
  `;
  
  const display = container.querySelector(".cc-select-display");
  const textElement = container.querySelector(".cc-select-text");
  const options = container.querySelectorAll(".cc-select-option");

  let currentValue = optionsList[0]?.value;

  Object.defineProperty(container, "value", {
    configurable: true,
    get() { return currentValue; },
    set(val) {
      currentValue = val;
      const targetOpt = Array.from(options).find(o => o.dataset.value === val) || options[0];
      if (targetOpt) {
         textElement.textContent = targetOpt.querySelector('span').textContent;
         options.forEach(o => o.classList.remove("is-selected"));
         targetOpt.classList.add("is-selected");
      }
    }
  });

  container.value = currentValue; // Init UI

  display.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = container.classList.contains("is-open");
    document.querySelectorAll(".cc-custom-select").forEach(sel => sel.classList.remove("is-open"));
    
    if (!isOpen) {
      container.classList.add("is-open");
      
      // 自动滚动防遮挡逻辑
      setTimeout(() => {
        const dropdown = container.querySelector(".cc-select-dropdown");
        const scrollPane = container.closest(".cc-settings-panel-inner, .cc-channels-editor-pane");
        
        if (dropdown && scrollPane) {
          const dropRect = dropdown.getBoundingClientRect();
          const paneRect = scrollPane.getBoundingClientRect();
          
          if (dropRect.bottom > paneRect.bottom) {
            scrollPane.scrollBy({
              top: dropRect.bottom - paneRect.bottom + 16,
              behavior: "smooth"
            });
          }
        }
      }, 10);
    }
  });

  options.forEach(opt => {
    opt.addEventListener("click", (e) => {
      e.stopPropagation();
      container.value = opt.dataset.value;
      container.classList.remove("is-open");
      container.dispatchEvent(new Event("change"));
    });
  });
}

const IMAGE_API_FORMATS = new Set(["gemini_image", "gpt_image"]);
const GEMINI_IMAGE_EXACT_NAMES = new Set([
  "nanobanana",
  "nano-banana",
  "banana",
  "nano-banana-1",
  "nanobanana-1",
  "banana-1",
  "nano-banana-pro",
  "banana-pro",
  "nanobananapro",
  "nano-banana-2",
  "banana-2",
  "nanobanana2",
  "nano-banana-2-cl",
]);

function normalizeImageModelName(value) {
  return String(value || "").trim().toLowerCase().replace(/[\s_]+/g, "-");
}

function isGeminiImageModelName(modelName) {
  const name = normalizeImageModelName(modelName);
  if (!name) return false;
  if (GEMINI_IMAGE_EXACT_NAMES.has(name)) return true;
  if (name.includes("banana")) return true;
  return name.includes("gemini") && name.includes("image");
}

function isGptImageModelName(modelName) {
  const name = normalizeImageModelName(modelName);
  return !!name && (name.includes("gpt-image") || name.includes("gptimage") || name.includes("image"));
}

function isExplicitGptImageModelName(modelName) {
  const name = normalizeImageModelName(modelName);
  return !!name && (name.includes("gpt-image") || name.includes("gptimage"));
}

export function normalizeApiFormatValue(value) {
  const text = String(value || "").trim().toLowerCase();
  if (text.includes("claude")) return "claude";
  if (text.includes("gemini")) return "gemini";
  return "openai";
}

export function normalizeImageApiFormatValue(value, modelName = "") {
  const text = String(value || "").trim().toLowerCase().replace(/-/g, "_");
  if (isGeminiImageModelName(modelName)) return "gemini_image";
  if (isExplicitGptImageModelName(modelName)) return "gpt_image";
  if (IMAGE_API_FORMATS.has(text)) return text;
  if (isGptImageModelName(modelName)) return "gpt_image";
  if (text.includes("gemini")) return "gemini_image";
  if (text === "openai" || text === "openai_image" || text === "openai_images" || text === "images") return "gpt_image";
  return "gpt_image";
}

export function normalizeImageInterfaceMode(value, apiFormat) {
  const fmt = normalizeImageApiFormatValue(apiFormat);
  const text = String(value || "").trim().toLowerCase().replace(/-/g, "_");
  const valid = fmt === "gemini_image"
    ? ["native", "openai_compat"]
    : ["unified", "split"];
  if (valid.includes(text)) return text;
  return fmt === "gemini_image" ? "native" : "unified";
}

export function isImageApiFormat(apiFormat) {
  return IMAGE_API_FORMATS.has(String(apiFormat || "").trim().toLowerCase().replace(/-/g, "_"));
}

export function detectImageApiFormat(modelName) {
  return normalizeImageApiFormatValue("", modelName);
}

export function isGptImageChatModel(apiFormat, modelName, category = "") {
  const name = normalizeImageModelName(modelName);
  const format = String(apiFormat || "").trim().toLowerCase().replace(/-/g, "_");
  if (String(category || "").trim().toLowerCase() === "image" && normalizeImageApiFormatValue(format, name) === "gpt_image") return true;
  if (format === "gpt_image") return true;
  return isGptImageModelName(name) && !isGeminiImageModelName(name);
}

export function isGeminiImageChatModel(apiFormat, modelName) {
  const rawFormat = String(apiFormat || "").trim().toLowerCase().replace(/-/g, "_");
  if (rawFormat === "gemini_image") return true;
  if (isGeminiImageModelName(modelName)) return true;
  if (normalizeApiFormatValue(apiFormat) !== "gemini") return false;
  const name = normalizeImageModelName(modelName);
  if (!name) return false;
  return name.includes("gemini") && name.includes("image");
}

export function isImageGenerationModel(apiFormat, modelName, category = "") {
  if (String(category || "").trim().toLowerCase() === "image") return true;
  if (isImageApiFormat(apiFormat)) return true;
  return isGeminiImageChatModel(apiFormat, modelName) || isGptImageChatModel(apiFormat, modelName, category);
}

export function normalizeModelCategory(category, apiFormat = "", modelName = "") {
  const text = String(category || "").trim().toLowerCase();
  if (text === "image") return "image";
  if (isImageGenerationModel(apiFormat, modelName, text)) return "image";
  return "llm";
}

export function inferManualModelSettings(modelName, current = {}) {
  const currentCategory = normalizeModelCategory(current.category, current.api_format, modelName);
  const category = isImageGenerationModel(current.api_format, modelName, currentCategory) ? "image" : currentCategory;
  if (category === "image") {
    const apiFormat = normalizeImageApiFormatValue(current.api_format, modelName);
    return {
      category,
      api_format: apiFormat,
      interface_mode: normalizeImageInterfaceMode(current.interface_mode, apiFormat),
    };
  }
  return {
    category: "llm",
    api_format: normalizeApiFormatValue(current.api_format || "openai"),
    interface_mode: "",
  };
}

export function inferApiFormatForManualModel(modelName, currentFormat = "openai") {
  return inferManualModelSettings(modelName, { api_format: currentFormat }).api_format;
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function simpleHighlight(code, lang) {
  const tokens = [];
  const pushToken = (html) => {
    const id = `__TOK${tokens.length}__`;
    tokens.push(html);
    return id;
  };

  let tokenized = escapeHtml(code);
  const l = (lang || "").toLowerCase();

  // 0. JSON Key 特殊高亮 (在解析普通字符串前处理)
  if (['json', 'jsonc'].includes(l)) {
      tokenized = tokenized.replace(/&quot;(.*?)&quot;(?=\s*:)/g, (match, p1) => {
          // Gemini 像素级取色：亮橘色
          return pushToken(`<span style="color:#f79058">&quot;${p1}&quot;</span>`);
      });
  }

  // 1. 字符串 (Strings) - 通用
  tokenized = tokenized.replace(/(&quot;[\s\S]*?&quot;|&#039;[\s\S]*?&#039;|`[\s\S]*?`)/g, (match) => {
      // Gemini 像素级取色：薄荷绿
      const color = ['json', 'jsonc'].includes(l) ? '#6cc685' : '#ce9178';
      return pushToken(`<span style="color:${color}">${match}</span>`);
  });

  // 2. 注释 (Comments)
  // C/JS 风格、HTML 风格 & SQL 风格(--)
  tokenized = tokenized.replace(/(\/\/.*|\/\*[\s\S]*?\*\/|&lt;!--[\s\S]*?--&gt;|--\s.*)/g, (match) => {
      return pushToken(`<span style="color:#6a9955">${match}</span>`);
  });
  // Python/Shell 风格 (#)
  const pyLangs = ['python', 'py', 'sh', 'bash', 'yaml', 'yml', 'ruby', 'rb', 'dockerfile', 'makefile'];
  if (pyLangs.includes(l) || l === '') {
      tokenized = tokenized.replace(/(^|\s)(#.*)/gm, (match, p1, p2) => {
          return p1 + pushToken(`<span style="color:#6a9955">${p2}</span>`);
      });
  }

  // 3. HTML/XML 标签与属性
  if (['html', 'xml', 'vue', 'jsx', 'tsx', 'javascript', 'js', 'typescript', 'ts', ''].includes(l)) {
      tokenized = tokenized.replace(/(&lt;\/?)([a-zA-Z0-9\-:]+)(.*?)(&gt;)/g, (match, p1, p2, p3, p4) => {
           let attrs = p3.replace(/([^\s=>]+)=(__TOK\d+__)/g, '<span style="color:#9cdcfe">$1</span>=$2');
           attrs = attrs.replace(/([^\s=>]+)(?=\s|&gt;|$)/g, (m) => {
               if (m.includes('__TOK')) return m;
               return `<span style="color:#9cdcfe">${m}</span>`;
           });
           return pushToken(`${p1}<span style="color:#569cd6">${p2}</span>${attrs}${p4}`);
      });
  }

  // 4. CSS/SCSS 特定高亮
  if (['css', 'scss', 'less'].includes(l)) {
      tokenized = tokenized.replace(/([a-zA-Z\-]+)\s*(?=:)/g, (match) => pushToken(`<span style="color:#9cdcfe">${match}</span>`)); // 属性
      tokenized = tokenized.replace(/(\.[a-zA-Z0-9_\-]+|#[a-zA-Z0-9_\-]+)/g, (match) => pushToken(`<span style="color:#d7ba7d">${match}</span>`)); // 选择器
  }

  // 5. 变量与对象属性 ($变量, .属性, 函数())
  tokenized = tokenized.replace(/\$[a-zA-Z_]\w*/g, (match) => pushToken(`<span style="color:#9cdcfe">${match}</span>`)); // Shell/PHP 变量
  tokenized = tokenized.replace(/\.([a-zA-Z_]\w*)\b/g, (match, p1) => `.` + pushToken(`<span style="color:#9cdcfe">${p1}</span>`));
  tokenized = tokenized.replace(/\b([a-zA-Z_]\w*)\s*(?=\()/g, (match, p1) => pushToken(`<span style="color:#dcdcaa">${p1}</span>`));

  // 6. 语言关键字 (动态词库)
  let blueKws = [];
  let purpleKws = [];
  let cyanKws = [];
  
  const sqlLangs = ['sql', 'mysql', 'postgresql', 'postgres', 'sqlite'];

  if (pyLangs.includes(l)) {
      blueKws = ['def', 'class', 'None', 'True', 'False', 'self'];
      purpleKws = ['import', 'from', 'return', 'if', 'elif', 'else', 'for', 'while', 'try', 'except', 'with', 'as', 'pass', 'yield', 'and', 'or', 'not', 'in', 'is', 'lambda', 'global', 'nonlocal', 'async', 'await'];
      cyanKws = ['print', 'len', 'str', 'int', 'float', 'list', 'dict', 'set', 'tuple', 'open', 'range', 'enumerate', 'zip', 'map', 'filter', 'super', 'property'];
  } else if (sqlLangs.includes(l)) {
      blueKws = ['SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'TABLE', 'INDEX', 'VIEW', 'DATABASE'];
      purpleKws = ['JOIN', 'INNER', 'OUTER', 'LEFT', 'RIGHT', 'ON', 'AND', 'OR', 'NOT', 'IN', 'IS', 'NULL', 'AS', 'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET', 'ASC', 'DESC'];
      cyanKws = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'CAST', 'COALESCE'];
  } else if (['java', 'c', 'cpp', 'cs', 'csharp', 'go', 'rust', 'php', 'swift', 'kotlin', 'kt'].includes(l)) {
      blueKws = ['int', 'float', 'double', 'char', 'void', 'bool', 'boolean', 'string', 'class', 'struct', 'enum', 'public', 'private', 'protected', 'static', 'const', 'final', 'new', 'this', 'auto', 'var', 'let', 'mut', 'val', 'fun', 'type', 'interface'];
      purpleKws = ['if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'return', 'try', 'catch', 'finally', 'throw', 'namespace', 'using', 'import', 'package', 'func', 'fn', 'impl', 'trait', 'match', 'defer', 'chan', 'go'];
      cyanKws = ['String', 'System', 'Console', 'fmt', 'std'];
  } else {
      // JS/TS 默认 Fallback
      blueKws = ['const', 'let', 'var', 'function', 'class', 'true', 'false', 'null', 'undefined', 'new', 'this', 'type', 'interface'];
      purpleKws = ['return', 'if', 'else', 'for', 'while', 'import', 'export', 'from', 'await', 'async', 'switch', 'case', 'break', 'continue', 'default', 'try', 'catch', 'finally', 'typeof', 'instanceof', 'in', 'of'];
  }

  // SQL 关键字忽略大小写匹配
  const kwFlags = sqlLangs.includes(l) ? 'gi' : 'g';
  if (blueKws.length > 0) tokenized = tokenized.replace(new RegExp(`\\b(${blueKws.join('|')})\\b`, kwFlags), match => pushToken(`<span style="color:#569cd6">${match}</span>`));
  if (purpleKws.length > 0) tokenized = tokenized.replace(new RegExp(`\\b(${purpleKws.join('|')})\\b`, kwFlags), match => pushToken(`<span style="color:#c586c0">${match}</span>`));
  if (cyanKws.length > 0) tokenized = tokenized.replace(new RegExp(`\\b(${cyanKws.join('|')})\\b`, kwFlags), match => pushToken(`<span style="color:#4ec9b0">${match}</span>`));

  // 7. 全局对象与大写类名
  tokenized = tokenized.replace(/\b(document|window|console|Math|JSON|Promise|THREE|Date|Array|Object|[A-Z][a-zA-Z0-9_]*)\b/g, (match) => {
      if (match.startsWith('__TOK')) return match; 
      return pushToken(`<span style="color:#4ec9b0">${match}</span>`);
  });

  // 8. 数字 (含十六进制)
  tokenized = tokenized.replace(/\b(\d+(\.\d+)?|0x[0-9a-fA-F]+)\b/g, (match) => {
      return pushToken(`<span style="color:#b5cea8">${match}</span>`);
  });

  // 还原 Tokens
  let previous;
  do {
      previous = tokenized;
      tokenized = tokenized.replace(/__TOK(\d+)__/g, (_, idx) => tokens[idx]);
  } while (tokenized !== previous);

  return tokenized;
}

export function parseMarkdown(text) {
  if (!text) return "";

  const blocks = [];
  
  let processedText = text.replace(/```(\w+)?\n([\s\S]*?)\n```/g, (match, lang, code) => {
    const id = `__BLOCK_${blocks.length}__`;
    lang = (lang || "text").trim().toLowerCase();
    const highlighted = simpleHighlight(code, lang);
    blocks.push(`
      <div class="cc-code-block">
        <div class="cc-code-header">
          <span class="cc-code-lang">${escapeHtml(lang)}</span>
          <button class="cc-code-copy" type="button" data-action="copy-code" title="复制代码">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> 复制
          </button>
        </div>
        <div class="cc-code-body">
          <pre><code>${highlighted}</code></pre>
        </div>
      </div>
    `);
    return id;
  });

  processedText = processedText.replace(/<think>([\s\S]*?)<\/think>/gi, (_, content) => {
    const id = `__BLOCK_${blocks.length}__`;
    blocks.push(`<details class="cc-think"><summary>思考过程</summary><div>${escapeHtml(content).replace(/\n/g, "<br>")}</div></details>`);
    return id;
  });

  processedText = escapeHtml(processedText);

  const parseInline = (str) => {
      let res = str;
      res = res.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
      res = res.replace(/\*(.*?)\*/g, "<em>$1</em>");
      res = res.replace(/`([^`]+)`/g, '<code class="cc-inline-code">$1</code>');
      return res;
  };

  let lines = processedText.split('\n');
  let processedLines = [];
  let inList = false;
  let listType = '';
  let inParagraph = false;
  let inTable = false;
  let tableRows = [];

  const closeParagraph = () => { if (inParagraph) { processedLines.push('</p>'); inParagraph = false; } };
  const closeList = () => { if (inList) { processedLines.push(`</${listType}>`); inList = false; } };
  const closeTable = () => {
      if (inTable) {
          let tableHtml = '<div class="cc-table-wrap"><table>';
          const isSeparator = (line) => /^\|[\s\-:|]+\|$/.test(line.trim());
          let startIdx = 0;
          
          if (tableRows.length > 1 && isSeparator(tableRows[1])) {
              const headers = tableRows[0].split('|').slice(1, -1).map(s => s.trim());
              tableHtml += '<thead><tr>' + headers.map(h => `<th>${parseInline(h)}</th>`).join('') + '</tr></thead>';
              startIdx = 2;
          }
          
          tableHtml += '<tbody>';
          for (let i = startIdx; i < tableRows.length; i++) {
              if (isSeparator(tableRows[i])) continue;
              const cells = tableRows[i].split('|').slice(1, -1).map(s => s.trim());
              if (cells.length === 0) continue;
              tableHtml += '<tr>' + cells.map(c => `<td>${parseInline(c)}</td>`).join('') + '</tr>';
          }
          
          tableHtml += '</tbody></table></div>';
          processedLines.push(tableHtml);
          inTable = false;
          tableRows = [];
      }
  };

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    let trimmed = line.trim();
    
    if (line.match(/^__BLOCK_\d+__$/)) {
        closeParagraph();
        closeList();
        closeTable();
        processedLines.push(line);
        continue;
    }

    // 仅识别标准的 Markdown 表格格式
    if (/^\|.*\|$/.test(trimmed)) {
        closeParagraph();
        closeList();
        if (!inTable) { inTable = true; }
        tableRows.push(trimmed);
        continue;
    }

    if (inTable) closeTable();

    let headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
        closeParagraph();
        closeList();
        const level = headerMatch[1].length;
        processedLines.push(`<h${level}>${parseInline(headerMatch[2])}</h${level}>`);
        continue;
    }

    let ulMatch = line.match(/^(\s*)[*+-]\s+(.+)$/);
    if (ulMatch) {
        closeParagraph();
        if (!inList) { processedLines.push(`<ul>`); inList = true; listType = 'ul'; }
        else if (listType === 'ol') { processedLines.push(`</ol><ul>`); listType = 'ul'; }
        processedLines.push(`<li>${parseInline(ulMatch[2])}</li>`);
        continue;
    }

    let olMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);
    if (olMatch) {
        closeParagraph();
        if (!inList) { processedLines.push(`<ol>`); inList = true; listType = 'ol'; }
        else if (listType === 'ul') { processedLines.push(`</ul><ol>`); listType = 'ul'; }
        processedLines.push(`<li>${parseInline(olMatch[2])}</li>`);
        continue;
    }

    if (trimmed === '') {
        closeParagraph();
        closeList();
        continue;
    }

    if (inList) {
        processedLines[processedLines.length - 1] = processedLines[processedLines.length - 1].replace(/<\/li>$/, `<br>${parseInline(trimmed)}</li>`);
    } else {
        if (!inParagraph) { processedLines.push('<p>'); inParagraph = true; }
        else { processedLines.push('<br>'); }
        processedLines.push(parseInline(line));
    }
  }
  
  closeParagraph();
  closeList();
  closeTable();

  let finalHtml = processedLines.join('\n');
  finalHtml = finalHtml.replace(/__BLOCK_(\d+)__/g, (_, idx) => blocks[idx]);

  return finalHtml;
}

export function clearElement(element) {
  while (element?.firstChild) element.firstChild.remove();
}

export async function copyTextToClipboard(text) {
  const value = String(text || "");
  if (!value) return false;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch (_) {}

  try {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "readonly");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return !!copied;
  } catch (_) {
    return false;
  }
}

export function createId(prefix = "cc") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function summarizeText(text, limit = 36) {
  const cleaned = String(text || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  return cleaned.length > limit ? `${cleaned.slice(0, limit)}...` : cleaned;
}

export function formatTimeLabel(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isGeneratedChatImage(file) {
  return file?.category === "image"
    && String(file?.subfolder || "") === "comet_chat"
    && String(file?.name || "").startsWith("generated_");
}

export function getPreviewUrl(file, typeOverride = "") {
  const type = encodeURIComponent(typeOverride || file.type || "temp");
  const subfolder = encodeURIComponent(file.subfolder || "");
  return `/view?filename=${encodeURIComponent(file.name)}&type=${type}&subfolder=${subfolder}`;
}

export function getPreviewFallbackUrl(file) {
  if (!isGeneratedChatImage(file)) return "";
  const currentType = String(file?.type || "temp");
  if (currentType === "output") return getPreviewUrl(file, "temp");
  if (currentType === "temp") return getPreviewUrl(file, "output");
  return "";
}

export function getFileCategoryLabel(category) {
  switch (category) {
    case "image": return "图片";
    case "video": return "视频";
    case "audio": return "音频";
    case "document": return "PDF";
    case "text": return "文本"; 
    default: return "文件";
  }
}

export function isTextFile(filename, mimeType) {
  const ext = String(filename || "").split('.').pop().toLowerCase();
  const textExts = ['txt', 'py', 'js', 'json', 'md', 'csv', 'tsv', 'html', 'css', 'ts', 'jsx', 'tsx', 'cpp', 'c', 'h', 'java', 'go', 'rs', 'php', 'sh', 'yaml', 'yml', 'ini', 'log', 'xml'];
  if (textExts.includes(ext)) return true;
  if (mimeType && mimeType.startsWith('text/')) return true;
  if (mimeType === 'application/json' || mimeType === 'application/javascript') return true;
  return false;
}

export function getAttachmentSupportError(apiFormat, model, files = [], category = "") {
  if (!files.length) return "";

  const normalizedFormat = normalizeApiFormatValue(apiFormat);
  const categories = Array.from(new Set(files.filter(f => f?.category !== "text").map((file) => file?.category || "unknown")));
  
  if (categories.length === 0) return ""; 

  if (isImageGenerationModel(apiFormat, model, category)) {
    const unsupported = categories.filter((category) => category !== "image");
    if (unsupported.length) {
      return `图片模型当前不支持 ${unsupported.map(getFileCategoryLabel).join("、")} 附件。`;
    }
    return "";
  }

  if (normalizedFormat === "gemini") return "";

  if (normalizedFormat === "claude") {
    const unsupported = categories.filter((category) => !["image", "document"].includes(category));
    if (unsupported.length) {
      return `Claude 原生格式当前不支持 ${unsupported.map(getFileCategoryLabel).join("、")} 附件。`;
    }
    return "";
  }

  const unsupported = categories.filter((category) => category !== "image");
  if (unsupported.length) {
    return `OpenAI 兼容格式当前不支持 ${unsupported.map(getFileCategoryLabel).join("、")} 附件。`;
  }
  return "";
}

export function buildAttachmentPreviewText(file, limit = 160) {
  const name = String(file?.original_name || file?.name || "attachment").trim() || "attachment";
  const explicitPreview = String(file?.preview_text || "").replace(/\s+/g, " ").trim();
  if (explicitPreview) {
    return explicitPreview.length > limit ? `${explicitPreview.slice(0, limit)}…` : explicitPreview;
  }

  if (file?.category === "text") {
    const contentPreview = String(file?.content || "").replace(/\s+/g, " ").trim();
    if (contentPreview) {
      return contentPreview.length > limit ? `${contentPreview.slice(0, limit)}…` : contentPreview;
    }
  }

  return `${getFileCategoryLabel(file?.category || "unknown")}附件：${name}`;
}

export function cloneFileRecord(file) {
  return {
    id: file?.id || file?.file_id || createId("file"),
    name: file?.name || "",
    original_name: file?.original_name || file?.name || "",
    category: file?.category || "unknown",
    type: file?.type || "temp",
    subfolder: file?.subfolder || "",
    mime_type: file?.mime_type || "",
    preview_text: buildAttachmentPreviewText(file),
    size: Number(file?.size || 0),
    content: file?.content || "",
    remote_file_id: file?.remote_file_id || "",
  };
}

export function cloneFiles(files = []) {
  return files.map((file) => cloneFileRecord(file));
}
