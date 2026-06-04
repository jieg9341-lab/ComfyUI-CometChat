export function injectStyles() {
  const STYLE_ID = "nkxx-comet-chat-style";
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
.cc-hidden{display:none !important}
.cc-workspace-shell, .cc-global-launcher, .cc-launcher-menu, .cc-settings-modal-backdrop, .cc-selection-toolbar, .cc-selection-panel {
  color-scheme: dark;
  --cc-bg-base: #1c1e23;
  --cc-bg-surface: #26282e;
  --cc-bg-surface-hover: #31343c;
  --cc-bg-surface-active: #3b3f49;
  --cc-text-primary: #e3e3e3;
  --cc-text-secondary: #a8adb8;
  --cc-border: rgba(255, 255, 255, 0.12);
  --cc-border-light: rgba(255, 255, 255, 0.18);
  --cc-accent: #a8c7fa;
  --cc-accent-dark: #041e49;
  --cc-ai-grad: linear-gradient(135deg, #4285f4 0%, #9b72cb 50%, #d96570 100%);
  --cc-error: #f28b82;
  --cc-error-bg: #3b1c1c;
  --cc-font: "Google Sans", "Segoe UI", system-ui, -apple-system, sans-serif;
}

.cc-badge {
  display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:16px;
  background: var(--cc-bg-surface-hover); color: var(--cc-text-secondary); font-size:12px; border: 1px solid var(--cc-border);
}
.cc-badge-dot { width:6px; height:6px; border-radius:50%; background: #5bb974; }
.cc-badge[data-kind="warn"] .cc-badge-dot { background: #fde293; }
.cc-badge[data-kind="error"] .cc-badge-dot { background: var(--cc-error); }
.cc-badge[data-kind="streaming"] .cc-badge-dot { background: var(--cc-accent); box-shadow: 0 0 8px rgba(168, 199, 250, 0.4); }

.cc-btn, .cc-icon-btn, .cc-send-btn, .cc-chip-del, .cc-session-action, .cc-settings-menu button, .cc-modal-btn {
  appearance:none; border:none; outline:none; cursor:pointer; font:inherit; transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
}
.cc-btn {
  display:inline-flex; align-items:center; justify-content:center; gap:8px; height:34px; padding:0 16px;
  border-radius:10px; background: rgba(255,255,255,0.05); color: var(--cc-text-primary); font-size: 13px; 
  font-weight: 500; border: 1px solid rgba(255,255,255,0.1);
}
.cc-btn:hover, .cc-settings-menu button:hover, .cc-modal-btn:hover {
  background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.2); transform: translateY(-1px);
}
.cc-btn:active { transform: translateY(0); }

.cc-btn.primary, .cc-modal-btn.primary {
  background: var(--cc-accent); color: var(--cc-accent-dark); border: none; font-weight: 600; box-shadow: 0 4px 12px rgba(168, 199, 250, 0.15);
}
.cc-btn.primary:hover, .cc-modal-btn.primary:hover {
  background: #b9d3fa; transform: translateY(-1px); box-shadow: 0 6px 16px rgba(168, 199, 250, 0.25);
}

.cc-icon-btn {
  display:inline-flex; align-items:center; justify-content:center; width:36px; height:36px;
  border-radius:10px; background: transparent; color: var(--cc-text-secondary);
}
.cc-icon-btn:hover { background: rgba(255,255,255,0.06); color: var(--cc-text-primary); }

.cc-chat-messages::-webkit-scrollbar, .cc-session-list::-webkit-scrollbar, .cc-compose-files::-webkit-scrollbar, .cc-settings-panel-inner::-webkit-scrollbar, .cc-channel-list::-webkit-scrollbar, .cc-channels-editor-pane::-webkit-scrollbar, .cc-model-popup::-webkit-scrollbar, .cc-models-body::-webkit-scrollbar { width:6px; height:6px; }
.cc-chat-messages::-webkit-scrollbar-track, .cc-session-list::-webkit-scrollbar-track, .cc-compose-files::-webkit-scrollbar-track, .cc-settings-panel-inner::-webkit-scrollbar-track, .cc-channel-list::-webkit-scrollbar-track, .cc-channels-editor-pane::-webkit-scrollbar-track, .cc-model-popup::-webkit-scrollbar-track, .cc-models-body::-webkit-scrollbar-track { background: transparent; }
.cc-chat-messages::-webkit-scrollbar-thumb, .cc-session-list::-webkit-scrollbar-thumb, .cc-compose-files::-webkit-scrollbar-thumb, .cc-settings-panel-inner::-webkit-scrollbar-thumb, .cc-channel-list::-webkit-scrollbar-thumb, .cc-channels-editor-pane::-webkit-scrollbar-thumb, .cc-model-popup::-webkit-scrollbar-thumb, .cc-models-body::-webkit-scrollbar-thumb { background: var(--cc-bg-surface-active); border-radius:10px; }

.cc-empty {
  min-height:120px; display:flex; align-items:center; justify-content:center;
  border:1px dashed var(--cc-bg-surface-active); border-radius:20px; color: var(--cc-text-secondary);
  font-size:14px; background: transparent; text-align:center; padding:24px;
}

.cc-msg { display:flex; flex-direction:column; gap:4px; width: 100%; }
.cc-msg.user { align-items:flex-end; }
.cc-msg.assistant { align-items:flex-start; }
.cc-role { padding:0 12px; color: var(--cc-text-secondary); font-size:12px; font-weight: 500; display: none; }

.cc-bubble {
  font-size: 15px; line-height: 1.6; word-break: break-word; border: none; box-shadow: none; max-width: 90%; user-select: text;
}
.cc-msg.user .cc-bubble { 
  background: var(--cc-bg-surface-hover); color: var(--cc-text-primary); 
  padding: 12px 20px; border-radius: 24px; 
}
.cc-msg.assistant .cc-bubble { 
  background: transparent; color: var(--cc-text-primary); 
  padding: 4px 0; max-width: 100%;
}
.cc-bubble.error { background: var(--cc-error-bg); color: var(--cc-error); border-radius: 24px; padding: 12px 20px; }

.cc-bubble p { margin: 0 0 12px; }
.cc-bubble p:last-child { margin-bottom: 0; }
.cc-bubble h1, .cc-bubble h2, .cc-bubble h3, .cc-bubble h4, .cc-bubble h5, .cc-bubble h6 { margin: 16px 0 8px; font-weight: 600; line-height: 1.4; color: var(--cc-text-primary); }
.cc-bubble h1 { font-size: 1.4em; }
.cc-bubble h2 { font-size: 1.25em; }
.cc-bubble h3 { font-size: 1.1em; }
.cc-bubble h4, .cc-bubble h5, .cc-bubble h6 { font-size: 1em; }
.cc-bubble ul, .cc-bubble ol { margin: 8px 0 16px; padding-left: 24px; }
.cc-bubble li { margin-bottom: 4px; }
.cc-inline-code { background: rgba(255,255,255,0.08); padding: 2px 6px; border-radius: 6px; color: #e3e3e3; font-family: "JetBrains Mono", "SF Mono", Consolas, "PingFang SC", "Microsoft YaHei", monospace; font-size: 13px; }

.cc-code-block { 
  margin: 16px 0; border-radius: 12px; background: #212328; 
  border: 1px solid rgba(255, 255, 255, 0.08); display: flex; flex-direction: column; 
}
.cc-code-header { 
  display: flex; justify-content: space-between; align-items: center; padding: 10px 16px; 
  background: #282a32; color: var(--cc-text-secondary); font-size: 12px; font-family: var(--cc-font); 
  position: sticky; top: -1px; z-index: 20; 
  border-top-left-radius: 11px; border-top-right-radius: 11px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.cc-code-lang { text-transform: capitalize; font-weight: 500; color: var(--cc-text-primary); }
.cc-code-copy { 
  background: transparent; border: none; color: var(--cc-text-secondary); cursor: pointer; display: flex; align-items: center; 
  gap: 6px; font-size: 12px; padding: 4px 8px; border-radius: 6px; transition: all 0.2s; outline: none; font-family: var(--cc-font); 
}
.cc-code-copy:hover { background: rgba(255,255,255,0.1); color: var(--cc-text-primary); }
.cc-code-copy svg { width: 14px; height: 14px; stroke: currentColor; }
.cc-code-body { position: relative; z-index: 1; }
.cc-code-block pre { 
  margin: 0; padding: 16px; background: transparent; border: none; overflow-x: auto; 
  border-bottom-left-radius: 11px; border-bottom-right-radius: 11px;
}
.cc-code-block code { font-family: "JetBrains Mono", "SF Mono", Consolas, "PingFang SC", "Microsoft YaHei", monospace; font-size: 14px; line-height: 1.6; color: #e3e3e3; }

.cc-table-wrap { overflow-x: auto; margin: 16px 0; border-radius: 10px; border: 1px solid var(--cc-border); }
.cc-bubble table { width: 100%; border-collapse: collapse; text-align: left; font-size: 14px; margin: 0; }
.cc-bubble th, .cc-bubble td { padding: 10px 14px; border-bottom: 1px solid var(--cc-border); color: var(--cc-text-primary); line-height: 1.5; word-break: break-word; }
.cc-bubble th { font-weight: 600; color: #fff; }
.cc-bubble tr:last-child td { border-bottom: none; }

.cc-msg-attach-single { display: inline-flex; margin-bottom: 12px; max-width: 100%; border-radius: 12px; overflow: hidden; position: relative; }
.cc-msg-attach-single img, .cc-msg-attach-single video { max-width: 100%; max-height: 480px; object-fit: contain; display: block; border-radius: 12px; background: rgba(0,0,0,0.2); }
.cc-msg-image-shell { position:relative; display:inline-block; max-width:100%; border-radius:12px; overflow:hidden; line-height:0; }
.cc-msg-image-shell.is-missing {
  display:inline-flex; align-items:center; justify-content:center; min-width:min(420px, 100%); min-height:180px;
  padding:18px; box-sizing:border-box; background:rgba(255,255,255,.035); border:1px dashed rgba(255,255,255,.12); line-height:1.45;
}
.cc-msg-image-shell.is-missing img { display:none; }
.cc-msg-image-shell.is-missing::after {
  content:"图片文件不存在或已被清理"; color:var(--cc-text-secondary); font-size:13px; font-weight:500;
}
.cc-msg-attach-thumb.is-missing { display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,.035); }
.cc-msg-attach-thumb.is-missing img { display:none; }
.cc-msg-attach-thumb.is-missing::after { content:"图片丢失"; color:var(--cc-text-secondary); font-size:12px; font-weight:600; }
.cc-msg-image-link { display:block; color:inherit; text-decoration:none; }
.cc-msg-image-actions {
  position:absolute; top:10px; right:10px; z-index:2; display:flex; align-items:center; gap:8px;
  opacity:0; visibility:hidden; transform:translateY(-2px); pointer-events:none;
  transition:opacity .16s, visibility .16s, transform .16s;
}
.cc-msg-image-shell:hover .cc-msg-image-actions,
.cc-msg-image-shell:focus-within .cc-msg-image-actions,
.cc-msg-attach-thumb:hover .cc-msg-image-actions,
.cc-msg-attach-thumb:focus-within .cc-msg-image-actions {
  opacity:1; visibility:visible; transform:translateY(0); pointer-events:auto;
}
.cc-msg-image-action {
  appearance:none; border:none; outline:none; width:34px; height:34px; border-radius:50%; display:flex; align-items:center; justify-content:center;
  color:#fff; background:rgba(34,36,42,.72); box-shadow:0 6px 18px rgba(0,0,0,.28); cursor:pointer;
  backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); transition:background .16s, transform .16s, box-shadow .16s;
}
.cc-msg-image-action:hover { background:rgba(58,61,69,.88); transform:translateY(-1px); box-shadow:0 8px 22px rgba(0,0,0,.34); }
.cc-msg-image-action:active { transform:translateY(0) scale(.96); }
.cc-msg-image-action svg { width:18px; height:18px; stroke:currentColor; stroke-width:2; fill:none; stroke-linecap:round; stroke-linejoin:round; }
.cc-msg-image-carousel { display:inline-flex; flex-direction:column; align-items:center; max-width:100%; margin-bottom:0; }
.cc-msg-image-carousel .cc-msg-attach-single { margin-bottom:0; }
.cc-msg-image-error-page {
  max-width:min(760px, 100%); min-width:min(520px, 100%); box-sizing:border-box;
  padding:18px 2px 4px; color:var(--cc-text-primary); font-size:16px; line-height:1.75; font-weight:500;
  white-space:normal; word-break:break-word;
}
.cc-workspace.compact .cc-msg-image-error-page {
  min-width:0; max-width:100%; padding-top:10px; font-size:15px; line-height:1.7;
}
.cc-msg-image-pager {
  display:flex; align-items:center; justify-content:center; gap:8px; min-height:30px; margin:0;
  color:var(--cc-text-secondary); font-size:12px; font-weight:500; line-height:1; user-select:none;
}
.cc-msg-image-page-btn {
  appearance:none; border:none; outline:none; width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center;
  color:var(--cc-text-secondary); background:transparent; cursor:pointer; transition:background .16s, color .16s, transform .16s;
}
.cc-msg-image-page-btn:hover:not(:disabled) { color:var(--cc-text-primary); background:rgba(255,255,255,.06); transform:translateY(-1px); }
.cc-msg-image-page-btn:disabled { opacity:.35; cursor:default; }
.cc-msg-image-page-btn svg { width:18px; height:18px; stroke:currentColor; stroke-width:2.2; fill:none; stroke-linecap:round; stroke-linejoin:round; }

.cc-msg-attach-row { display: flex; gap: 10px; flex-wrap: nowrap; overflow-x: auto; margin-bottom: 12px; padding-bottom: 6px; max-width: 100%; }
.cc-msg-attach-row::-webkit-scrollbar { height: 6px; }
.cc-msg-attach-row::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
.cc-msg-attach-row::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }

.cc-msg-attach-item { text-decoration: none; display: block; flex: 0 0 auto; border-radius: 16px; transition: transform 0.2s; }
.cc-msg-attach-item:hover { transform: translateY(-2px); }

.cc-msg-attach-thumb { position: relative; width: 80px; height: 80px; border-radius: 16px; overflow: hidden; background: var(--cc-bg-surface); border: 1px solid var(--cc-border); }
.cc-msg-attach-thumb img, .cc-msg-attach-thumb video { width: 100%; height: 100%; object-fit: cover; display: block; }
.cc-msg-attach-thumb .cc-msg-image-actions { top:5px; right:5px; gap:4px; }
.cc-msg-attach-thumb .cc-msg-image-action { width:26px; height:26px; }
.cc-msg-attach-thumb .cc-msg-image-action svg { width:14px; height:14px; }
.cc-msg-attach-video-badge { position: absolute; bottom: 6px; left: 6px; background: rgba(0,0,0,0.65); color: #fff; font-size: 11px; font-weight: 600; padding: 2px 6px; border-radius: 8px; display: flex; align-items: center; gap: 3px; backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); letter-spacing: 0.2px; }
.cc-msg-attach-video-badge svg { width: 10px; height: 10px; fill: currentColor; }

.cc-msg-attach-file { display: flex; flex-direction: column; justify-content: center; gap: 8px; height: 80px; min-width: 180px; max-width: 260px; padding: 0 16px; border-radius: 16px; background: var(--cc-bg-surface); border: 1px solid var(--cc-border); box-sizing: border-box; }
.cc-msg-attach-name { font-size: 14px; font-weight: 500; color: var(--cc-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.3; }
.cc-msg-attach-type { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; color: var(--cc-text-secondary); line-height: 1; text-transform: uppercase; }

.cc-msg-actions { display:flex; align-items:center; gap:6px; margin-top:4px; padding-left:2px; }
.cc-msg-actions.has-image-pager { width:100%; justify-content:space-between; gap:14px; padding-left:0; margin-top:8px; }
.cc-msg-actions-pager { margin-left:auto; display:flex; align-items:center; justify-content:flex-end; }
.cc-msg-action {
  display:inline-flex; align-items:center; justify-content:center; gap:6px; height:30px; padding:0 10px;
  border-radius:999px; background: transparent; color: var(--cc-text-secondary); border:none; cursor:pointer;
  font-size:12px; font-weight:500; transition: background 0.2s, color 0.2s;
}
.cc-msg-action:hover { background: rgba(255,255,255,0.06); color: var(--cc-text-primary); }
.cc-msg-action svg { width:16px; height:16px; stroke: currentColor; stroke-width: 1.8; fill:none; stroke-linecap:round; stroke-linejoin:round; }

.cc-think {
  margin:8px 0 14px; padding-left:10px; border-left:2px solid rgba(168,199,250,.24);
  color:var(--cc-text-secondary); background:transparent;
}
.cc-think summary {
  display:inline-flex; align-items:center; gap:6px; width:auto; padding:0; cursor:pointer;
  color:var(--cc-text-secondary); font-size:13px; font-weight:500; line-height:1.6; user-select:none;
  transition:color .16s;
}
.cc-think summary::-webkit-details-marker { display:none; }
.cc-think summary::before {
  content:""; width:6px; height:6px; border-right:1.8px solid currentColor; border-bottom:1.8px solid currentColor;
  transform:rotate(-45deg); opacity:.72; transition:transform .16s, opacity .16s;
}
.cc-think[open] summary::before { transform:rotate(45deg); opacity:.92; }
.cc-think summary:hover { color:var(--cc-text-primary); }
.cc-think div {
  margin-top:6px; padding:0 0 0 12px; white-space:pre-wrap; color:var(--cc-text-secondary);
  font-size:13px; line-height:1.7; border-left:1px solid rgba(255,255,255,.08);
}

.cc-compose { flex: 0 0 auto; padding: 0 32px 24px; background: transparent; display: flex; flex-direction: column; gap: 12px; }

.cc-compose-container {
  display:grid; grid-template-columns:36px minmax(0,1fr); grid-template-areas:"attach input";
  align-items:center; column-gap:10px; row-gap:0; min-height:58px;
  background: #1e2025; border-radius: 999px; padding: 10px 14px 10px 16px;
  border: 1px solid rgba(255,255,255,0.08); transition: border-color 0.2s;
}
.cc-compose-container.has-compose-content {
  grid-template-columns:36px minmax(0,1fr) 36px; grid-template-areas:"attach input send";
}
.cc-compose-container.is-compose-expanded {
  grid-template-columns:36px minmax(0,1fr); grid-template-areas:"input input" "attach .";
  align-items:start; row-gap:6px; min-height:104px; border-radius:28px; padding:14px 12px 10px 16px;
}
.cc-compose-container.is-compose-expanded.has-compose-content {
  grid-template-columns:36px minmax(0,1fr) 36px; grid-template-areas:"input input input" "attach . send";
}
.cc-compose-container.is-compose-expanded.has-compose-files {
  grid-template-columns:36px minmax(0,1fr); grid-template-areas:"files files" "input input" "attach .";
}
.cc-compose-container.is-compose-expanded.has-compose-files.has-compose-content {
  grid-template-columns:36px minmax(0,1fr) 36px; grid-template-areas:"files files files" "input input input" "attach . send";
}
.cc-compose-container:focus-within {
  border-color: rgba(255,255,255,0.2);
}

.cc-compose-files { grid-area:files; display: flex; gap: 10px; flex-wrap: nowrap; padding: 4px 4px 8px; overflow-x: auto; overflow-y: hidden; max-width: 100%; }
.cc-compose-files:empty { display: none; margin: 0; padding: 0; height: 0; }

.cc-file-card { position: relative; display: flex; flex: 0 0 auto; box-sizing: border-box; }
.cc-file-card.media { width: 76px; height: 76px; border-radius: 16px; background: transparent; padding: 0; border: none; }
.cc-file-card.media .cc-file-thumb { width: 100%; height: 100%; border-radius: 16px; overflow: hidden; background: var(--cc-bg-base); position: relative; }
.cc-file-thumb.is-video::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 50%; background: linear-gradient(to top, rgba(0,0,0,0.7), transparent); pointer-events: none; border-radius: 0 0 16px 16px;}
.cc-file-duration { position: absolute; bottom: 6px; left: 8px; font-size: 11px; font-weight: 600; color: #fff; z-index: 2; text-shadow: 0 1px 2px rgba(0,0,0,0.8); letter-spacing: 0.2px; }

.cc-file-card.doc { height: 76px; width: 220px; padding: 12px 16px; border-radius: 16px; background: rgba(255,255,255,0.06); border: none; align-items: center; gap: 14px; flex-direction: row; }
.cc-file-card.doc .cc-file-thumb { width: 24px; height: 24px; flex: 0 0 auto; display: flex; align-items: center; justify-content: center; }
.cc-file-card.doc .cc-file-info { display: flex; flex-direction: column; gap: 2px; overflow: hidden; }
.cc-file-card.doc .cc-file-name { font-size: 14px; font-weight: 500; color: var(--cc-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cc-file-card.doc .cc-file-type { font-size: 12px; color: var(--cc-text-secondary); background: transparent; padding: 0; border-radius: 0; }

.cc-file-thumb img, .cc-file-thumb video { width: 100%; height: 100%; object-fit: cover; display: block; }
.cc-file-remove { position: absolute; top: -6px; right: -6px; width: 22px; height: 22px; border-radius: 50%; background: #31343c; color: var(--cc-text-primary); border: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 10; transition: all 0.2s; }
.cc-file-remove:hover { background: var(--cc-error); color: var(--cc-error-bg); border-color: rgba(255,140,154,0.4); }
.cc-file-remove svg { width: 12px; height: 12px; stroke: currentColor; stroke-width: 2.5; stroke-linecap: round; }

.cc-workspace-input { 
  grid-area:input; align-self:center; width: 100%; height:24px; padding: 0; border-radius: 0; background: transparent; border: none; 
  color: var(--cc-text-primary); resize: none; outline: none; box-sizing: border-box; 
  line-height: 24px; font-family: inherit; font-size: 15px; overflow-y: hidden;
}
.cc-compose-container.is-compose-expanded .cc-workspace-input {
  align-self:start; height:auto; min-height:30px; padding:0 2px 2px; line-height:1.5; overflow-y:auto;
}
.cc-workspace-input { min-height: 24px; max-height: 200px; }
.cc-workspace-input::placeholder { color: var(--cc-text-secondary); }

.cc-compose-toolbar { display:contents; margin:0; padding:0; }
.cc-compose-toolbar-left, .cc-compose-toolbar-right { display: flex; align-items: center; gap: 8px; }
.cc-compose-toolbar-left { grid-area:attach; justify-content:center; }
.cc-compose-toolbar-right { grid-area:send; justify-content:center; display:none; }
.cc-compose-container.has-compose-content .cc-compose-toolbar-right { display:flex; }

.cc-toolbar-btn { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 50%; background: transparent; color: var(--cc-text-secondary); border: none; cursor: pointer; transition: background 0.2s, color 0.2s; }
.cc-toolbar-btn:hover { background: rgba(255,255,255,0.06); color: var(--cc-text-primary); }
.cc-toolbar-btn svg { width: 22px; height: 22px; stroke: currentColor; stroke-width: 1.5; fill: none; stroke-linecap: round; stroke-linejoin: round; }

.cc-send-btn { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 50%; background: #e3e3e3; color: #131314; transition: transform 0.2s, background 0.2s; margin-left: 0; border: none; cursor: pointer; }
.cc-send-btn:hover { transform: scale(1.05); background: #ffffff; }
.cc-send-btn.is-streaming { background: var(--cc-bg-surface-active); color: var(--cc-text-primary); }
.cc-send-btn svg { width: 18px; height: 18px; stroke: currentColor; stroke-width: 2; fill: none; stroke-linecap: round; stroke-linejoin: round; }
.cc-stop-square { width: 12px; height: 12px; border-radius: 3px; background: currentColor; }

.cc-compose-tip { color: var(--cc-text-secondary); font-size: 12px; padding: 0 16px; text-align: center; }

.cc-workspace-shell {
  --cc-shell-top:24px; --cc-shell-right:24px; --cc-shell-bottom:24px; --cc-shell-left:24px;
  --cc-viewport-gap-x:96px;
  --cc-viewport-gap-y:48px;
  --cc-full-panel-width:min(960px,calc(100vw - var(--cc-viewport-gap-x)));
  --cc-full-panel-height:min(680px,calc(100vh - var(--cc-viewport-gap-y)),calc(var(--cc-full-panel-width) - 280px));
  --cc-compact-panel-width:min(392px,calc(100vw - 48px));
  --cc-compact-panel-height:min(650px,calc(100vh - 36px),calc(var(--cc-compact-panel-width) + 258px));
  position:absolute; inset:0; z-index:3200; display:none; align-items:stretch; justify-content:center;
  padding:var(--cc-shell-top) var(--cc-shell-right) var(--cc-shell-bottom) var(--cc-shell-left); box-sizing:border-box; pointer-events:none;
}
.cc-workspace-shell.is-open { display:flex; }
.cc-workspace-shell.is-body-host { position:fixed; z-index:100000; justify-content: flex-start; align-items: center; }
.cc-workspace-shell.is-body-host.is-compact-mode { justify-content:flex-end; align-items:center; padding:18px; }
.cc-workspace-shell.is-embedded-host { z-index:3200; }

.cc-workspace-backdrop { position:absolute; inset:0; background:rgba(0,0,0,0.6); backdrop-filter:blur(8px); pointer-events:none; }
.cc-workspace-shell.is-body-host .cc-workspace-backdrop, .cc-workspace-shell.is-embedded-host .cc-workspace-backdrop { display:none; }

.cc-workspace-panel {
  --cc-panel-offset-x:0px; --cc-panel-offset-y:0px; position:relative; display:grid;
  grid-template-columns: 260px minmax(0,1fr); color: var(--cc-text-primary);
  width:min(100%,var(--cc-full-panel-width)); height:min(920px,100%); min-height:0; margin:auto; background: var(--cc-bg-base);
  border:1px solid rgba(255, 255, 255, 0.15); border-radius:32px; overflow:hidden;
  box-shadow:0 24px 64px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05);
  pointer-events:auto; transform:translate3d(var(--cc-panel-offset-x),var(--cc-panel-offset-y),0); will-change:transform;
  transition:transform .2s cubic-bezier(0.2,0,0,1), grid-template-columns .28s cubic-bezier(0.2,0,0,1), border-radius .24s ease, box-shadow .24s ease, background .24s ease;
}
.cc-workspace-shell.is-body-host .cc-workspace-panel {
  width:min(100%,var(--cc-full-panel-width)); height:var(--cc-full-panel-height); max-height:calc(100vh - var(--cc-viewport-gap-y)); margin:0; border-radius:32px;
}
.cc-workspace-shell.is-body-host .cc-workspace-panel.is-compact-mode,
.cc-workspace-shell.is-embedded-host .cc-workspace-panel.is-compact-mode,
.cc-workspace-panel.is-compact-mode {
  grid-template-columns:minmax(0,1fr); width:min(100%,var(--cc-compact-panel-width)); height:var(--cc-compact-panel-height); max-height:calc(100vh - 36px);
  margin:0; border-radius:26px; background:rgba(28,30,35,0.98);
  box-shadow:0 24px 72px rgba(0,0,0,0.58), inset 0 1px 0 rgba(255,255,255,0.06);
}
.cc-workspace-panel.is-sidebar-collapsed { grid-template-columns: 68px minmax(0,1fr); }
.cc-workspace-panel.is-compact-mode.is-sidebar-collapsed { grid-template-columns:minmax(0,1fr); }

.cc-compact-sidebar-backdrop {
  position:absolute; inset:0; z-index:70; display:none; background:rgba(0,0,0,0.46);
  backdrop-filter:blur(4px); -webkit-backdrop-filter:blur(4px);
}
.cc-workspace-panel.is-compact-mode.is-compact-sidebar-open .cc-compact-sidebar-backdrop { display:block; }

.cc-workspace-shell.is-body-host .cc-main-top, .cc-workspace-shell.is-body-host .cc-chat-messages, .cc-workspace-shell.is-body-host .cc-compose {
  width:min(720px,calc(100% - 80px)); align-self:center; box-sizing:border-box;
}
.cc-workspace-shell.is-body-host .cc-main-top { padding:18px 32px 12px; border-bottom:none; }

.cc-chat-messages { flex:1 1 auto; min-height:0; overflow:auto; padding:0 32px 24px; display:flex; flex-direction:column; gap:24px; }
.cc-chat-messages > :first-child { margin-top: 24px; }
.cc-workspace-shell.is-body-host .cc-chat-messages { padding:0 32px 24px; gap:24px; }
.cc-workspace-shell.is-body-host .cc-chat-messages > :first-child { margin-top: 16px; }

.cc-workspace-shell.is-body-host .cc-workspace-msg { max-width:100%; }
.cc-workspace-shell.is-body-host .cc-empty { width:min(680px,100%); min-height:180px; align-self:center; border-radius:24px; }
.cc-workspace-shell.is-embedded-host .cc-workspace-panel { width:min(100%,var(--cc-full-panel-width)); height:min(var(--cc-full-panel-height),100%); margin:0 auto auto; }
.cc-workspace-panel.is-dragging { transition:none; box-shadow:0 32px 84px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.05); }
.cc-workspace-panel.is-layout-transitioning { pointer-events:none; will-change:transform; }

.cc-sidebar {
  display: flex; flex-direction: column; background: var(--cc-bg-surface);
  border-right: 1px solid rgba(255, 255, 255, 0.04); overflow: hidden; transition: opacity 0.2s;
}
.cc-workspace-panel.is-compact-mode .cc-sidebar {
  position:absolute; left:0; top:0; bottom:0; z-index:80; width:min(320px,84%) !important;
  border-right:1px solid rgba(255,255,255,0.1); border-radius:26px 20px 20px 26px;
  box-shadow:18px 0 48px rgba(0,0,0,0.45); opacity:0; pointer-events:none;
  transform:translateX(-102%); transition:transform .22s cubic-bezier(0.2,0,0,1), opacity .18s ease;
}
.cc-workspace-panel.is-compact-mode.is-compact-sidebar-open .cc-sidebar {
  opacity:1; pointer-events:auto; transform:translateX(0);
}

.cc-sidebar-header {
  display: flex; align-items: center; height: 64px; padding: 0 14px; flex: 0 0 auto;
}

.cc-sidebar-body {
  flex: 1 1 auto; display: flex; flex-direction: column; min-height: 0; padding: 0 14px;
}

.cc-sidebar-footer {
  flex: 0 0 auto; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px;
}

.cc-new-chat-btn, .cc-settings-btn {
  display: flex; align-items: center; justify-content: flex-start; gap: 12px;
  width: 100%; height: 40px; padding: 0 11px; border-radius: 20px;
  background: transparent; color: var(--cc-text-secondary); border: none;
  font-size: 14px; font-weight: 500; cursor: pointer; transition: background 0.2s, color 0.2s;
  overflow: hidden; white-space: nowrap;
}
.cc-new-chat-btn { margin-bottom: 24px; color: var(--cc-text-primary); }
.cc-new-chat-btn:hover, .cc-settings-btn:hover { background: rgba(255,255,255,0.06); color: var(--cc-text-primary); }
.cc-new-chat-btn svg, .cc-settings-btn svg { flex: 0 0 auto; width: 18px; height: 18px; overflow: visible; }
.cc-sidebar-layout-toggle { margin-bottom:6px; }

.cc-workspace-panel.is-sidebar-collapsed .cc-sidebar-text { opacity: 0; display: none; }
.cc-workspace-panel.is-sidebar-collapsed .cc-new-chat-btn,
.cc-workspace-panel.is-sidebar-collapsed .cc-settings-btn {
  width: 40px; justify-content: center; padding: 0; border-radius: 50%;
}
.cc-workspace-panel.is-sidebar-collapsed .cc-new-chat-btn { margin-bottom: 0; }

.cc-session-list-wrapper { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; overflow: hidden; transition: opacity 0.2s; }
.cc-workspace-panel.is-sidebar-collapsed .cc-session-list-wrapper { opacity: 0; pointer-events: none; display: none; }
.cc-workspace-panel.is-compact-mode .cc-sidebar-text { opacity:1; display:inline; }
.cc-workspace-panel.is-compact-mode .cc-new-chat-btn,
.cc-workspace-panel.is-compact-mode .cc-settings-btn {
  width:100%; justify-content:flex-start; padding:0 11px; border-radius:20px;
}
.cc-workspace-panel.is-compact-mode .cc-session-list-wrapper { opacity:1; pointer-events:auto; display:flex; }

.cc-session-group-title { 
  font-size: 14px; font-weight: 600; color: var(--cc-text-primary); 
  padding: 20px 11px 8px; letter-spacing: 0.3px; 
}

.cc-session-list { flex: 1 1 auto; overflow-y: auto; padding-bottom: 12px; display: flex; flex-direction: column; gap: 2px; }

.cc-session-item {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  height: 40px; padding: 0 11px; border-radius: 20px; border: none;
  background: transparent; cursor: pointer; transition: background 0.2s, color 0.2s;
  box-sizing: border-box; color: var(--cc-text-primary); position: relative;
}
.cc-session-item:hover { background: var(--cc-bg-surface-hover); }
.cc-session-item.is-active { background: rgba(168,199,250,0.12); color: var(--cc-accent); font-weight: 500; }

.cc-session-item-title {
  font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  flex: 1 1 auto; min-width: 0; padding-right: 4px;
}

.cc-session-item-right {
  display: flex; align-items: center; flex: 0 0 auto;
}

.cc-session-pin-indicator {
  display: flex; align-items: center; justify-content: center;
  width: 20px; height: 20px; color: var(--cc-text-secondary);
}
.cc-session-item.is-active .cc-session-pin-indicator { color: inherit; }

.cc-session-more-btn {
  display: none; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 50%;
  background: transparent; color: inherit; border: none; cursor: pointer;
}
.cc-session-more-btn:hover { background: rgba(255,255,255,0.1); }
.cc-session-more-btn svg { width: 16px; height: 16px; fill: currentColor; }

.cc-session-item:hover .cc-session-pin-indicator, 
.cc-session-item.menu-open .cc-session-pin-indicator { display: none; }
.cc-session-item:hover .cc-session-more-btn, 
.cc-session-item.menu-open .cc-session-more-btn { display: flex; }

.cc-context-menu {
  position: absolute; display: none; flex-direction: column;
  min-width: 180px; padding: 6px 0; background: var(--cc-bg-surface-hover);
  border: 1px solid var(--cc-border); border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4); z-index: 100000;
}
.cc-context-menu.is-open { display: flex; }
.cc-context-menu button {
  display: flex; align-items: center; gap: 12px;
  width: 100%; padding: 10px 16px; background: transparent; border: none;
  color: var(--cc-text-primary); font-size: 14px; cursor: pointer; text-align: left;
}
.cc-context-menu button:hover { background: rgba(255,255,255,0.06); }
.cc-context-menu svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; overflow: visible; }

.cc-main { display:flex; flex-direction:column; min-width:0; min-height:0; background: transparent; flex: 1 1 0; position: relative;}
.cc-main-top { display:flex; align-items:center; justify-content:flex-end; gap:14px; padding:20px 32px 14px; border-bottom:none; position: relative;}
.cc-workspace-drag-zone { cursor:grab; user-select:none; }
.cc-workspace-panel.is-dragging .cc-workspace-drag-zone { cursor:grabbing; }

.cc-main-top-actions { display:flex; align-items:center; justify-content:flex-end; gap:10px; min-width:0; max-width:100%; }
.cc-main-badges { display:flex; flex-wrap:nowrap; justify-content:flex-end; gap:10px; align-items: center; min-width:0; position: relative;}
.cc-badge.cc-main-status[data-kind="ready"] { display: none; }

.cc-window-actions { display:flex; align-items:center; gap:6px; flex:0 0 auto; }
.cc-window-btn {
  appearance:none; box-sizing:border-box; padding:0; font:inherit;
  display:flex; align-items:center; justify-content:center; width:34px; height:34px; border-radius:50%;
  background:transparent; color:var(--cc-text-secondary); border:1px solid transparent; cursor:pointer;
  transition:background .18s, color .18s, border-color .18s, transform .18s;
}
.cc-window-btn:hover { background:rgba(255,255,255,0.06); color:var(--cc-text-primary); border-color:rgba(255,255,255,0.08); }
.cc-window-btn:active { transform:scale(0.96); }
.cc-window-btn svg { width:18px; height:18px; stroke:currentColor; stroke-width:2; fill:none; stroke-linecap:round; stroke-linejoin:round; }
.cc-compact-menu-btn { display:none; flex:0 0 auto; }
.cc-layout-toggle-btn svg { fill:none; stroke:currentColor; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; }
.cc-layout-icon-full { display:none; }
.cc-layout-toggle-btn[aria-pressed="true"] .cc-layout-icon-compact { display:none; }
.cc-layout-toggle-btn[aria-pressed="true"] .cc-layout-icon-full { display:block; }
.cc-workspace-panel:not(.is-compact-mode) .cc-window-actions .cc-layout-toggle-btn { display:none; }
.cc-workspace-panel.is-compact-mode .cc-sidebar-layout-toggle { display:none; }

.cc-model-trigger {
  display: inline-flex; align-items: center; gap: 10px; min-width:0; max-width:100%; min-height:42px; padding: 8px 16px; border-radius: 14px;
  background: transparent; cursor: pointer; border: 1px solid transparent; transition: background 0.2s, border-color 0.2s, transform 0.2s; user-select: none;
}
.cc-model-trigger:hover { background: rgba(255,255,255,0.06); }
.cc-model-trigger.is-open { background: var(--cc-bg-surface-hover); border-color: var(--cc-border); }
.cc-model-trigger-text { min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size: 17px; line-height:1.2; font-weight: 650; color: var(--cc-text-primary); font-family: "JetBrains Mono", Consolas, monospace;}
.cc-model-trigger-sep { color: var(--cc-text-secondary); opacity: 0.5; }
.cc-model-trigger-channel { min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size: 15px; line-height:1.2; font-weight: 520; color: var(--cc-text-secondary); }
.cc-model-trigger-chevron { width: 18px; height: 18px; flex:0 0 auto; stroke: var(--cc-text-secondary); stroke-width: 2; fill: none; stroke-linecap: round; stroke-linejoin: round; transition: transform 0.2s; }
.cc-model-trigger.is-open .cc-model-trigger-chevron { transform: rotate(180deg); }

.cc-model-popup {
  position: absolute; top: calc(100% + 6px); right: 0; width: 320px; max-height: min(400px, 60vh); overflow-y: auto; overscroll-behavior: contain;
  background: rgba(38, 40, 46, 0.98); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; box-shadow: 0 16px 48px rgba(0,0,0,0.5);
  z-index: 4000; display: none; flex-direction: column; padding: 8px; transform-origin: top right;
}
.cc-model-popup.is-open { display: flex; animation: ccPopupIn 0.15s ease-out forwards; }
@keyframes ccPopupIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }

.cc-model-group { margin-bottom: 8px; }
.cc-model-group:last-child { margin-bottom: 0; }
.cc-model-group-title { font-size: 12px; color: var(--cc-text-secondary); padding: 6px 12px; font-weight: 600; }
.cc-model-item {
  display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 10px;
  cursor: pointer; transition: background 0.2s; border: none; background: transparent; width: 100%; text-align: left;
}
.cc-model-item:hover { background: rgba(255,255,255,0.06); }
.cc-model-item.is-active { background: rgba(168,199,250,0.1); }
.cc-model-item-name { font-size: 14px; color: var(--cc-text-primary); flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: "JetBrains Mono", Consolas, monospace;}
.cc-model-item.is-active .cc-model-item-name { color: var(--cc-accent); font-weight: 600; }

.cc-workspace-panel.is-compact-mode .cc-main {
  background:linear-gradient(180deg, rgba(38,40,46,0.22) 0%, rgba(28,30,35,0) 120px);
}
.cc-workspace-panel.is-compact-mode .cc-main-top {
  position:relative; z-index:60; flex-direction:row; align-items:center; justify-content:space-between; gap:8px; padding:12px 12px 10px;
  border-bottom:1px solid rgba(255,255,255,0.06); width:100%; align-self:stretch; box-sizing:border-box;
}
.cc-workspace-panel.is-compact-mode .cc-compact-menu-btn { display:flex; }
.cc-workspace-panel.is-compact-mode .cc-main-top-actions { flex:1 1 auto; align-items:center; justify-content:space-between; gap:8px; min-width:0; }
.cc-workspace-panel.is-compact-mode .cc-main-badges {
  position:relative; flex:1 1 auto; min-width:0; flex-wrap:nowrap; justify-content:flex-start; gap:6px;
}
.cc-workspace-panel.is-compact-mode .cc-window-actions { flex:0 0 auto; }
.cc-workspace-panel.is-compact-mode .cc-window-btn { width:32px; height:32px; background:rgba(255,255,255,0.03); border-color:rgba(255,255,255,0.06); }
.cc-workspace-panel.is-compact-mode .cc-model-trigger {
  flex:1 1 auto; min-height:38px; padding:7px 10px; gap:8px; border-radius:13px;
}
.cc-workspace-panel.is-compact-mode .cc-model-trigger-text { font-size:15px; font-weight:650; }
.cc-workspace-panel.is-compact-mode .cc-model-trigger-channel { font-size:13px; font-weight:520; }
.cc-workspace-panel.is-compact-mode .cc-model-trigger-chevron { width:16px; height:16px; }
.cc-workspace-panel.is-compact-mode .cc-badge.cc-main-status { height:30px; padding:0 8px; flex:0 0 auto; }
.cc-workspace-panel.is-compact-mode .cc-model-popup {
  position:absolute; left:0; right:0; top:calc(100% + 8px); bottom:auto; width:auto;
  max-height:min(440px,calc(100vh - 160px)); border-radius:20px; padding:8px; transform-origin:top center;
  box-shadow:0 20px 60px rgba(0,0,0,0.58), 0 0 0 1px rgba(255,255,255,0.04);
}
.cc-workspace-panel.is-compact-mode .cc-model-item { min-height:42px; border-radius:12px; }
.cc-workspace-panel.is-compact-mode .cc-chat-messages {
  width:100%; align-self:stretch; box-sizing:border-box; padding:0 14px 14px; gap:18px; overscroll-behavior:contain;
}
.cc-workspace-panel.is-compact-mode .cc-chat-messages > :first-child { margin-top:14px; }
.cc-workspace-panel.is-compact-mode .cc-workspace-msg { max-width:100%; }
.cc-workspace-panel.is-compact-mode .cc-msg.user .cc-bubble { max-width:88%; border-radius:20px 20px 6px 20px; }
.cc-workspace-panel.is-compact-mode .cc-msg.assistant .cc-bubble { max-width:100%; border-radius:20px; }
.cc-workspace-panel.is-compact-mode .cc-bubble { font-size:14px; line-height:1.62; padding:12px 14px; }
.cc-workspace-panel.is-compact-mode .cc-code-block { max-width:100%; border-radius:14px; }
.cc-workspace-panel.is-compact-mode .cc-code-header { padding:9px 12px; }
.cc-workspace-panel.is-compact-mode .cc-code-block pre { padding:12px; }
.cc-workspace-panel.is-compact-mode .cc-code-block code { font-size:12.5px; line-height:1.55; }
.cc-workspace-panel.is-compact-mode .cc-table-wrap { max-width:100%; }
.cc-workspace-panel.is-compact-mode .cc-msg-actions { padding-left:6px; }
.cc-workspace-panel.is-compact-mode .cc-empty {
  width:100%; min-height:150px; border-radius:22px; padding:22px; font-size:14px; text-align:center;
}
.cc-workspace-panel.is-compact-mode .cc-compose {
  width:100%; align-self:stretch; padding:0 14px 12px; box-sizing:border-box;
}
.cc-workspace-panel.is-compact-mode .cc-compose-container {
  grid-template-columns:34px minmax(0,1fr); grid-template-areas:"attach input";
  align-items:center; column-gap:8px; row-gap:0; min-height:54px; border-radius:999px; padding:8px 10px 8px 14px; background:rgba(49,52,60,0.82);
  border:1px solid rgba(255,255,255,0.08); box-shadow:0 10px 30px rgba(0,0,0,0.22);
}
.cc-workspace-panel.is-compact-mode .cc-compose-container.has-compose-content {
  grid-template-columns:34px minmax(0,1fr) 34px; grid-template-areas:"attach input send";
}
.cc-workspace-panel.is-compact-mode .cc-compose-container.is-compose-expanded {
  grid-template-columns:34px minmax(0,1fr); grid-template-areas:"input input" "attach .";
  align-items:start; row-gap:6px; min-height:104px; border-radius:24px; padding:12px 12px 8px;
}
.cc-workspace-panel.is-compact-mode .cc-compose-container.is-compose-expanded.has-compose-content {
  grid-template-columns:34px minmax(0,1fr) 34px; grid-template-areas:"input input input" "attach . send";
}
.cc-workspace-panel.is-compact-mode .cc-compose-container.is-compose-expanded.has-compose-files {
  grid-template-columns:34px minmax(0,1fr); grid-template-areas:"files files" "input input" "attach .";
}
.cc-workspace-panel.is-compact-mode .cc-compose-container.is-compose-expanded.has-compose-files.has-compose-content {
  grid-template-columns:34px minmax(0,1fr) 34px; grid-template-areas:"files files files" "input input input" "attach . send";
}
.cc-workspace-panel.is-compact-mode .cc-compose-files { grid-area:files; padding:0 2px 8px; }
.cc-workspace-panel.is-compact-mode .cc-compose-files:empty { display:none; padding:0; }
.cc-workspace-panel.is-compact-mode .cc-workspace-input {
  grid-area:input; align-self:center; height:24px; min-height:24px; max-height:132px; padding:0; font-size:15px; line-height:24px; overflow-y:hidden;
}
.cc-workspace-panel.is-compact-mode .cc-compose-container.is-compose-expanded .cc-workspace-input {
  align-self:start; height:auto; min-height:30px; padding:0 2px 2px; line-height:1.45; overflow-y:auto;
}
.cc-workspace-panel.is-compact-mode .cc-compose-tip { display:none; }
.cc-workspace-panel.is-compact-mode .cc-compose-toolbar-left { grid-area:attach; justify-content:center; }
.cc-workspace-panel.is-compact-mode .cc-toolbar-btn,
.cc-workspace-panel.is-compact-mode .cc-send-btn { width:34px; height:34px; margin-left:0; }

.cc-settings-modal-backdrop {
  position:absolute; inset:0; display:none; align-items:center; justify-content:center;
  background:rgba(0,0,0,0.5); backdrop-filter:blur(4px); z-index:3000; pointer-events:none;
}
.cc-settings-modal-backdrop.is-open { display:flex; pointer-events:auto; }
.cc-settings-modal {
  position: relative;
  width: min(860px, calc(100% - 80px)); height: min(680px, calc(100% - 80px)); display: flex; flex-direction: row;
  background: var(--cc-bg-base); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 24px; overflow: hidden; box-shadow: 0 24px 64px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05);
}

.cc-settings-sidebar {
  width: 170px; flex: 0 0 auto; border-right: 1px solid var(--cc-border);
  background: var(--cc-bg-surface); padding: 24px 12px; display: flex; flex-direction: column; gap: 4px;
}
.cc-settings-sidebar-title {
  font-size: 15px; font-weight: 600; color: var(--cc-text-primary); padding: 0 12px; margin-bottom: 16px; letter-spacing: 0.2px;
}
.cc-settings-nav-btn, .cc-settings-return-btn {
  display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 12px;
  border-radius: 12px; background: transparent; color: var(--cc-text-secondary); border: none;
  font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s; text-align: left;
  user-select: none; -webkit-tap-highlight-color: transparent;
}
.cc-settings-nav-btn:hover, .cc-settings-return-btn:hover { background: rgba(255,255,255,0.04); color: var(--cc-text-primary); }
.cc-settings-nav-btn.is-active { background: rgba(168,199,250,0.1); color: var(--cc-accent); }
.cc-settings-nav-btn svg, .cc-settings-return-btn svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

.cc-settings-content { flex: 1 1 auto; position: relative; display: flex; flex-direction: column; overflow: hidden; }
.cc-settings-panel { display: none; flex-direction: column; flex: 1; height: 100%; }
.cc-settings-panel.is-active { display: flex; }
.cc-settings-panel-inner { padding: 32px 40px; overflow-y: auto; height: 100%; flex: 1; display: flex; flex-direction: column; gap: 24px;}
.cc-settings-panel-title { font-size: 18px; font-weight: 600; color: var(--cc-text-primary); margin: 0; }

.cc-settings-field { display:flex; flex-direction:column; gap:8px; }
.cc-settings-field label { font-size:13px; color: var(--cc-text-secondary); font-weight: 500; }
.cc-settings-field input[type="text"], .cc-settings-field input[type="password"], .cc-settings-field textarea {
  width:100%; max-width: 540px; padding:10px 14px; border-radius:10px; background: var(--cc-bg-base); border:1px solid var(--cc-border); color: var(--cc-text-primary); box-sizing:border-box; font:inherit; font-size: 14px; transition: border-color 0.2s, background 0.2s;
}
.cc-settings-field input:focus, .cc-settings-field textarea:focus {
  border-color: var(--cc-accent); background: #1a1b1e; outline: none;
}
.cc-settings-field textarea { min-height:100px; resize:vertical; }

.cc-toggle { position: relative; display: inline-block; width: 40px; height: 22px; flex-shrink: 0; }
.cc-toggle input { opacity: 0; width: 0; height: 0; margin: 0; }
.cc-toggle-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(255,255,255,0.15); transition: .2s; border-radius: 22px; }
.cc-toggle-slider:before { position: absolute; content: ""; height: 16px; width: 16px; left: 3px; bottom: 3px; background-color: white; transition: .2s; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
.cc-toggle input:checked + .cc-toggle-slider { background-color: #4285f4; }
.cc-toggle input:checked + .cc-toggle-slider:before { transform: translateX(18px); }

.cc-custom-select { position: relative; width: 100%; max-width: 540px; user-select: none; }
.cc-select-display {
  display: flex; align-items: center; justify-content: space-between;
  width: 100%; padding: 10px 14px; border-radius: 10px;
  background: var(--cc-bg-base); border: 1px solid var(--cc-border);
  color: var(--cc-text-primary); font-size: 14px; cursor: pointer; transition: border-color 0.2s, background 0.2s;
}
.cc-select-display:hover { border-color: var(--cc-border-light); }
.cc-custom-select.is-open .cc-select-display { border-color: var(--cc-accent); background: #1a1b1e; }
.cc-select-arrow { width: 16px; height: 16px; stroke: var(--cc-text-secondary); transition: transform 0.15s ease-out; }
.cc-custom-select.is-open .cc-select-arrow { transform: rotate(180deg); }
.cc-select-dropdown {
  position: absolute; top: calc(100% + 6px); left: 0; right: 0;
  background: rgba(38, 40, 46, 0.96); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px; padding: 6px; box-shadow: 0 12px 32px rgba(0,0,0,0.6);
  z-index: 100; opacity: 0; transform: translateY(-4px); pointer-events: none;
  transition: opacity 0.12s ease-out, transform 0.12s ease-out;
}
.cc-custom-select.is-open .cc-select-dropdown { opacity: 1; transform: translateY(0); pointer-events: auto; }
.cc-select-option {
  padding: 10px 12px; border-radius: 8px; color: var(--cc-text-primary);
  font-size: 14px; cursor: pointer; transition: background 0.12s, color 0.12s; 
  display: flex; align-items: center; justify-content: space-between;
}
.cc-select-option:hover { background: rgba(255,255,255,0.06); }
.cc-select-option.is-selected { background: rgba(168,199,250,0.1); color: var(--cc-accent); font-weight: 500; }
.cc-select-check { width: 16px; height: 16px; stroke: currentColor; stroke-width: 2.5; fill: none; opacity: 0; transition: opacity 0.12s; }
.cc-select-option.is-selected .cc-select-check { opacity: 1; }

.cc-channels-layout { display: flex; height: 100%; width: 100%; flex: 1; overflow: hidden; }
.cc-channels-list-pane { 
  width: 240px; flex: 0 0 auto; border-right: 1px solid var(--cc-border); 
  display: flex; flex-direction: column; background: transparent;
}
.cc-channels-editor-pane { 
  flex: 1 1 auto; overflow-y: auto; padding: 32px 40px; position: relative;
}

.cc-channel-list { flex: 1 1 auto; overflow-y: auto; padding: 16px 12px; display: flex; flex-direction: column; gap: 8px; }
.cc-channel-item { 
  display: flex; align-items: center; gap: 8px; padding: 10px 12px; 
  background: transparent; border: none; border-radius: 10px; cursor: pointer;
  transition: background 0.2s; position: relative; user-select: none;
}
.cc-channel-item:hover { background: rgba(255,255,255,0.05); }
.cc-channel-item.is-editing { background: rgba(255,255,255,0.08); }

.cc-channel-drag-handle {
  width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; color: var(--cc-text-secondary);
  opacity: 0; cursor: grab; transition: opacity 0.2s; flex-shrink: 0;
}
.cc-channel-item:hover .cc-channel-drag-handle { opacity: 0.6; }
.cc-channel-drag-handle:hover { opacity: 1 !important; }
.cc-channel-item.is-dragging { opacity: 0.4; transform: scale(0.98); }
.cc-channel-item.drag-over { background: rgba(168,199,250,0.1); transform: scale(1.02); }

.cc-channel-info-list { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.cc-channel-name-list { font-size: 14px; font-weight: 500; color: var(--cc-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.cc-channel-on-tag {
  font-size: 11px; font-weight: 600; padding: 2px 6px; border-radius: 10px;
  background: rgba(168, 199, 250, 0.15); color: var(--cc-accent); border: 1px solid rgba(168, 199, 250, 0.3); flex-shrink: 0;
}

.cc-channel-add-btn {
  margin: 0 12px 16px; padding: 10px; border-radius: 12px; border: 1px dashed var(--cc-border);
  background: transparent; color: var(--cc-text-secondary); font-size: 14px; font-weight: 500; cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s; flex-shrink: 0;
}
.cc-channel-add-btn:hover { background: rgba(255,255,255,0.05); color: var(--cc-text-primary); border-color: var(--cc-border-light); }

.cc-editor-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid var(--cc-border); max-width: 100%;}
.cc-editor-title { font-size: 18px; font-weight: 600; margin: 0; display: flex; align-items: center; gap: 12px; color: var(--cc-text-primary);}
.cc-editor-actions { display: flex; align-items: center; gap: 12px; }

.cc-models-manager { border: 1px solid var(--cc-border); border-radius: 12px; background: var(--cc-bg-base); max-width: 600px;}
.cc-models-body { display: flex; flex-direction: column; }
.cc-model-row { display: flex; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); position: relative; }
.cc-model-row:last-child { border-bottom: none; }
.cc-model-col-name { flex: 1; min-width: 0; padding: 6px 6px 6px 12px; }
.cc-model-col-act { width: 44px; flex: 0 0 auto; display: flex; justify-content: center; padding: 6px; border-left: 1px solid rgba(255,255,255,0.05); }

.cc-model-row input { border: none !important; background: transparent !important; border-radius: 4px !important; padding: 8px !important; width: 100%; max-width: 100%; box-sizing: border-box; color: var(--cc-text-primary); outline: none; text-overflow: ellipsis; font-family: "JetBrains Mono", Consolas, monospace; font-size: 14px;}
.cc-model-row input:focus { background: rgba(255,255,255,0.05) !important; }

.cc-model-row-popup {
  position: absolute; right: 44px; top: calc(100% - 10px); z-index: 100;
  background: rgba(32, 34, 40, 0.98); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 14px; padding: 14px; 
  box-shadow: 0 16px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,0,0,0.2); display: none; flex-direction: column; gap: 12px; width: 250px;
}
.cc-model-row-popup.is-open { display: flex; animation: ccPopupIn 0.15s ease-out forwards; }
.cc-model-row-popup-field { display: flex; flex-direction: column; gap: 6px; }
.cc-model-row-popup label { font-size: 12px; color: var(--cc-text-secondary); font-weight: 500; margin: 0; }
.cc-model-row-popup input { border: 1px solid rgba(255,255,255,0.08) !important; background: rgba(0,0,0,0.25) !important; padding: 8px 10px !important; border-radius: 8px !important; text-overflow: ellipsis; font-family: inherit; font-size: 13px; color: #e3e3e3;}
.cc-model-row-popup input:focus { border-color: var(--cc-accent) !important; background: rgba(0,0,0,0.4) !important;}

.cc-model-row-popup .cc-custom-select { width: 100%; max-width: 100%; }
.cc-model-row-popup .cc-select-display { border: 1px solid rgba(255,255,255,0.08) !important; background: rgba(0,0,0,0.25) !important; border-radius: 8px !important; padding: 8px 10px !important; height: auto; }
.cc-model-row-popup .cc-custom-select.is-open .cc-select-display, .cc-model-row-popup .cc-select-display:hover { background: rgba(0,0,0,0.4) !important; border-color: rgba(255,255,255,0.15) !important;}
.cc-model-row-popup .cc-select-dropdown { top: calc(100% + 4px); min-width: 100%; z-index: 150; }

.cc-model-row-popup .cc-delete-btn-wrap { display: flex; margin-top: 2px; padding-top: 14px; border-top: 1px dashed rgba(255,255,255,0.08); }
.cc-model-row-popup .cc-delete-row-btn {
  width: 100%; background: transparent; color: var(--cc-error); border: none;
  padding: 8px 12px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 6px;
}
.cc-model-row-popup .cc-delete-row-btn:hover { background: rgba(242, 139, 130, 0.1); }
.cc-model-row-popup .cc-delete-row-btn:disabled { opacity: 0.3; cursor: not-allowed; background: transparent; }

.cc-model-add-btn { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 12px; background: rgba(255,255,255,0.02); color: var(--cc-text-secondary); font-size: 13px; border: none; cursor: pointer; transition: background 0.2s, color 0.2s; width: 100%; border-top: 1px solid var(--cc-border); border-bottom-left-radius: 12px; border-bottom-right-radius: 12px; font-weight: 500;}

.cc-about-logo { width: 80px; height: 80px; border-radius: 20px; background: var(--cc-ai-grad); display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.4); }
.cc-about-logo svg { width: 40px; height: 40px; stroke: #fff; }
.cc-about-title { text-align: center; font-size: 24px; font-weight: 600; margin: 0 0 8px; color: var(--cc-text-primary); }
.cc-about-desc { text-align: center; color: var(--cc-text-secondary); font-size: 14px; margin: 0 0 32px; }
.cc-about-author { background: var(--cc-bg-surface); border-radius: 16px; padding: 20px; display: flex; align-items: center; justify-content: space-between; border: 1px solid var(--cc-border); }
.cc-author-info { display: flex; align-items: center; gap: 16px; }
.cc-author-avatar { width: 48px; height: 48px; border-radius: 50%; background: #3b3f49; display: flex; align-items: center; justify-content: center; font-size: 20px;}
.cc-author-text h4 { margin: 0 0 4px; font-size: 16px; color: var(--cc-text-primary); }
.cc-author-text p { margin: 0; font-size: 13px; color: var(--cc-text-secondary); }
.cc-bilibili-btn {
  display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 20px;
  background: #fb7299; color: #fff; text-decoration: none; font-size: 13px; font-weight: 500; transition: transform 0.2s, background 0.2s;
}
.cc-bilibili-btn:hover { background: #fc8bab; transform: translateY(-2px); }

.cc-global-launcher {
  position:fixed; left:24px; top:calc(100vh - 82px); z-index:100001; display:flex; align-items:center; justify-content:center;
  width:50px; height:50px; border-radius:50%; border:1px solid var(--cc-border); background: var(--cc-bg-surface);
  color: var(--cc-text-primary); box-shadow:0 10px 28px rgba(0,0,0,0.3); cursor:grab; transition:transform .2s, box-shadow .2s, background .2s;
}
.cc-global-launcher:hover { transform:translateY(-3px); box-shadow:0 14px 34px rgba(0,0,0,0.4); background: var(--cc-bg-surface-hover); }
.cc-global-launcher.is-active { background: var(--cc-ai-grad); color: white; border-color: transparent; }
.cc-global-launcher.is-dragging { cursor:grabbing; transition:none; transform:none; }
.cc-global-launcher svg { width:22px; height:22px; stroke:currentColor; stroke-width:1.5; fill:none; stroke-linecap:round; stroke-linejoin:round; }
.cc-launcher-menu {
  position:fixed; z-index:100002; display:none; flex-direction:column; width:max-content; padding:4px;
  border-radius:10px; border:1px solid rgba(255,255,255,0.10); background:rgba(29,31,36,0.94); color:var(--cc-text-primary);
  box-shadow:0 12px 28px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.04); backdrop-filter:blur(16px); transform-origin:top left;
}
.cc-launcher-menu.is-open { display:flex; animation:ccLauncherMenuIn .12s cubic-bezier(.2,0,0,1) both; }
@keyframes ccLauncherMenuIn { from { opacity:0; transform:translateY(3px) scale(.98); } to { opacity:1; transform:translateY(0) scale(1); } }
.cc-launcher-menu button {
  appearance:none; border:none; outline:none; width:auto; height:32px; padding:0 10px 0 9px; border-radius:7px;
  display:flex; align-items:center; gap:8px; background:transparent; color:#c8ccd6; cursor:pointer;
  font:500 12px/1 var(--cc-font); text-align:left; white-space:nowrap; transition:background .14s, color .14s;
}
.cc-launcher-menu button:hover { background:rgba(255,255,255,0.07); color:#eef1f6; }
.cc-launcher-menu button:active { background:rgba(255,255,255,0.10); }
.cc-launcher-menu svg {
  width:15px; height:15px; flex:0 0 auto; stroke:currentColor; stroke-width:1.8; fill:none; stroke-linecap:round; stroke-linejoin:round; opacity:.92;
}

.cc-selection-settings-card {
  max-width:640px; padding:16px; border-radius:12px; border:1px solid var(--cc-border);
  background:rgba(255,255,255,.035);
}
.cc-selection-settings-head { display:flex; align-items:center; justify-content:space-between; gap:18px; }
.cc-selection-settings-title { color:var(--cc-text-primary); font-size:15px; font-weight:600; margin-bottom:4px; }
.cc-selection-settings-desc { color:var(--cc-text-secondary); font-size:13px; line-height:1.55; max-width:500px; }

.cc-selection-toolbar {
  position:fixed; z-index:100004; display:flex; align-items:center; gap:1px; height:34px; padding:3px 5px;
  border-radius:11px; border:1px solid rgba(255,255,255,.16); background:rgba(56,59,66,.96);
  color:var(--cc-text-primary); box-shadow:0 10px 22px rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.07);
  backdrop-filter:blur(18px); -webkit-backdrop-filter:blur(18px); opacity:0; visibility:hidden; transform:translateY(4px) scale(.98);
  transition:opacity .14s, visibility .14s, transform .14s;
}
.cc-selection-toolbar.is-open { opacity:1; visibility:visible; transform:translateY(0) scale(1); }
.cc-selection-toolbar.is-dragging, .cc-selection-panel.is-dragging { transition:none; }
.cc-selection-grip {
  width:14px; height:26px; margin:0 1px 0 0; border-radius:7px; cursor:grab; opacity:.76; position:relative;
}
.cc-selection-grip:active { cursor:grabbing; }
.cc-selection-grip::before, .cc-selection-grip::after {
  content:""; position:absolute; top:6px; bottom:6px; width:1.5px; border-radius:2px; background:rgba(255,255,255,.38);
}
.cc-selection-grip::before { left:4px; }
.cc-selection-grip::after { right:4px; }
.cc-selection-toolbar button {
  appearance:none; border:none; outline:none; position:relative; width:28px; height:28px; border-radius:8px;
  display:flex; align-items:center; justify-content:center; background:transparent; color:#d5d9e2; cursor:pointer;
  transition:background .14s, color .14s, transform .14s, opacity .14s, width .14s, margin .14s;
}
.cc-selection-toolbar button:hover { background:rgba(255,255,255,.09); color:#f5f7fb; transform:translateY(-1px); }
.cc-selection-toolbar button svg { width:16px; height:16px; stroke:currentColor; stroke-width:2; fill:none; stroke-linecap:round; stroke-linejoin:round; }
.cc-selection-toolbar button[data-sa-action="translate"] svg { width:17px; height:17px; stroke-width:1.9; }
.cc-selection-toolbar button[data-tip]::after {
  content:attr(data-tip); position:absolute; left:50%; bottom:calc(100% + 9px); transform:translateX(-50%) translateY(2px);
  padding:6px 8px; border-radius:8px; background:#08090b; color:#f2f3f5; font:500 12px/1 var(--cc-font);
  white-space:nowrap; opacity:0; visibility:hidden; pointer-events:none; box-shadow:0 8px 20px rgba(0,0,0,.32); transition:opacity .12s, visibility .12s, transform .12s;
}
.cc-selection-toolbar button[data-tip]:hover::after { opacity:1; visibility:visible; transform:translateX(-50%) translateY(0); }
.cc-selection-close {
  position:relative !important; right:auto; top:auto; width:0 !important; height:28px !important; padding:0 !important; margin-left:0 !important;
  flex:0 0 auto; overflow:hidden; border-radius:8px !important; background:rgba(255,255,255,.08) !important; color:#eef1f6 !important;
  opacity:0; visibility:hidden; pointer-events:none; box-shadow:none;
}
.cc-selection-close svg { width:12px !important; height:12px !important; }
.cc-selection-toolbar.is-close-zone .cc-selection-close { width:28px !important; margin-left:1px !important; opacity:1; visibility:visible; pointer-events:auto; }

.cc-selection-panel {
  position:fixed; z-index:100003; width:min(440px, calc(100vw - 40px)); max-height:min(420px, calc(100vh - 40px));
  display:flex; flex-direction:column; gap:9px; padding:13px 15px 13px; box-sizing:border-box;
  border-radius:14px; border:1px solid rgba(255,255,255,.14); background:rgba(34,37,43,.97);
  color:var(--cc-text-primary); box-shadow:0 18px 40px rgba(0,0,0,.34), inset 0 1px 0 rgba(255,255,255,.06);
  backdrop-filter:blur(22px); -webkit-backdrop-filter:blur(22px); opacity:0; visibility:hidden; transform:translateY(8px) scale(.98);
  transition:opacity .16s, visibility .16s, transform .16s;
}
.cc-selection-panel.is-open { opacity:1; visibility:visible; transform:translateY(0) scale(1); }
.cc-selection-panel-handle { width:24px; height:3px; border-radius:3px; background:rgba(255,255,255,.32); align-self:center; margin:-3px 0 1px; cursor:grab; }
.cc-selection-panel-handle:active, .cc-selection-panel-head:active { cursor:grabbing; }
.cc-selection-panel-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; cursor:grab; }
.cc-selection-panel-title { font-size:16px; font-weight:700; line-height:1.35; color:var(--cc-text-primary); }
.cc-selection-panel-meta { display:flex; align-items:center; flex-wrap:wrap; gap:7px; min-height:26px; margin-top:6px; color:var(--cc-text-secondary); font-size:12px; line-height:1.35; }
.cc-selection-panel-meta span { display:inline-flex; align-items:center; height:26px; padding:0 10px; border-radius:9px; background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.09); line-height:1.35; }
.cc-selection-panel-meta svg { width:16px; height:16px; stroke:currentColor; stroke-width:2; fill:none; stroke-linecap:round; stroke-linejoin:round; opacity:.72; }
.cc-selection-panel-close {
  appearance:none; border:none; outline:none; width:30px; height:30px; border-radius:9px; display:flex; align-items:center; justify-content:center;
  background:transparent; color:var(--cc-text-secondary); cursor:pointer; transition:background .14s, color .14s;
}
.cc-selection-panel-close:hover { background:rgba(255,255,255,.07); color:var(--cc-text-primary); }
.cc-selection-panel-close svg { width:18px; height:18px; stroke:currentColor; stroke-width:2; fill:none; stroke-linecap:round; stroke-linejoin:round; }
.cc-selection-source {
  max-height:52px; overflow:auto; padding-left:9px; border-left:2px solid rgba(168,199,250,.24);
  color:var(--cc-text-secondary); font-size:12px; line-height:1.55; white-space:pre-wrap;
}
.cc-selection-result {
  overflow:auto; min-height:76px; padding-right:6px; color:var(--cc-text-primary); font-size:14px; line-height:1.62;
}
.cc-selection-result h1, .cc-selection-result h2, .cc-selection-result h3, .cc-selection-result h4, .cc-selection-result h5, .cc-selection-result h6 {
  margin:12px 0 6px; color:var(--cc-text-primary); font-weight:700; line-height:1.35;
}
.cc-selection-result h1 { font-size:18px; }
.cc-selection-result h2 { font-size:16px; }
.cc-selection-result h3 { font-size:15px; }
.cc-selection-result h4, .cc-selection-result h5, .cc-selection-result h6 { font-size:14px; }
.cc-selection-result p { margin:0 0 10px; }
.cc-selection-result ul, .cc-selection-result ol { margin:8px 0 10px; padding-left:22px; }
.cc-selection-result li { margin:4px 0; }
.cc-selection-result-actions {
  display:flex; align-items:center; gap:6px; margin:-2px 0 2px; min-height:30px;
}
.cc-selection-result-actions[hidden] { display:none !important; }
.cc-selection-result-actions button {
  appearance:none; border:none; outline:none; width:30px; height:30px; border-radius:9px;
  display:flex; align-items:center; justify-content:center; background:transparent; color:var(--cc-text-secondary);
  cursor:pointer; transition:background .14s, color .14s, transform .14s, opacity .14s;
}
.cc-selection-result-actions button:hover:not(:disabled) { background:rgba(255,255,255,.07); color:var(--cc-text-primary); transform:translateY(-1px); }
.cc-selection-result-actions button:disabled { opacity:.35; cursor:not-allowed; }
.cc-selection-result-actions svg {
  width:17px; height:17px; stroke:currentColor; stroke-width:2; fill:none; stroke-linecap:round; stroke-linejoin:round;
}
.cc-selection-result::-webkit-scrollbar, .cc-selection-source::-webkit-scrollbar { width:6px; height:6px; }
.cc-selection-result::-webkit-scrollbar-thumb, .cc-selection-source::-webkit-scrollbar-thumb { background:var(--cc-bg-surface-active); border-radius:10px; }
.cc-selection-panel.is-error .cc-selection-result { color:var(--cc-error); }
.cc-selection-loading { display:flex; align-items:center; gap:8px; padding:28px 4px; }
.cc-selection-loading span { width:8px; height:8px; border-radius:50%; background:var(--cc-accent); opacity:.35; animation:ccSelectionPulse 1s infinite ease-in-out; }
.cc-selection-loading span:nth-child(2) { animation-delay:.12s; }
.cc-selection-loading span:nth-child(3) { animation-delay:.24s; }
@keyframes ccSelectionPulse { 0%, 80%, 100% { transform:scale(.75); opacity:.35; } 40% { transform:scale(1); opacity:.9; } }
.cc-selection-followup {
  display:grid; grid-template-columns:minmax(0,1fr) 32px; align-items:center; gap:8px; min-height:42px; padding:6px 7px 6px 14px;
  border-radius:16px; border:1px solid rgba(255,255,255,.10); background:var(--cc-bg-surface);
}
.cc-selection-followup input {
  min-width:0; border:none; outline:none; background:transparent; color:var(--cc-text-primary); font:500 14px/1.4 var(--cc-font);
}
.cc-selection-followup input::placeholder { color:var(--cc-text-secondary); }
.cc-selection-followup button {
  appearance:none; border:none; outline:none; width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center;
  background:#f1f3f4; color:#202124; cursor:pointer; transition:transform .14s, background .14s;
}
.cc-selection-followup button:hover { background:#fff; transform:translateY(-1px); }
.cc-selection-followup button svg { width:17px; height:17px; stroke:currentColor; stroke-width:2.2; fill:none; stroke-linecap:round; stroke-linejoin:round; }

@media (max-width: 1180px){
  .cc-workspace-shell { --cc-viewport-gap-x:48px; --cc-viewport-gap-y:32px; --cc-full-panel-width:min(960px,calc(100vw - var(--cc-viewport-gap-x))); }
  .cc-workspace-panel { width:min(100%,var(--cc-full-panel-width)); height:var(--cc-full-panel-height); max-height:calc(100vh - var(--cc-viewport-gap-y)); margin:16px auto; }
  .cc-workspace-panel.is-compact-mode { width:min(100%,var(--cc-compact-panel-width)); height:var(--cc-compact-panel-height); margin:0; }
}
@media (max-width: 760px){
  .cc-settings-modal { width:calc(100% - 24px); height:calc(100% - 24px); }
}
@media (max-width: 980px){
  .cc-sidebar { position:absolute; left:0; top:0; bottom:0; width:260px !important; z-index:1; border-radius: 0; border-right: 1px solid var(--cc-border); }
  .cc-workspace-panel.is-sidebar-collapsed .cc-sidebar { transform:translateX(-100%); opacity:0; width: 260px !important; }
}
@media (max-width: 540px){
  .cc-workspace-shell {
    --cc-viewport-gap-x:16px;
    --cc-viewport-gap-y:16px;
    --cc-full-panel-width:calc(100vw - 16px);
    --cc-full-panel-height:min(calc(100vh - 16px),calc(var(--cc-full-panel-width) + 120px));
    --cc-compact-panel-width:calc(100vw - 16px);
    --cc-compact-panel-height:min(calc(100vh - 16px),calc(var(--cc-compact-panel-width) + 258px));
  }
  .cc-workspace-shell.is-body-host.is-compact-mode { padding:8px; }
  .cc-workspace-panel.is-compact-mode { width:min(100%,var(--cc-compact-panel-width)); height:var(--cc-compact-panel-height); max-height:calc(100vh - 16px); border-radius:22px; }
  .cc-workspace-panel.is-compact-mode .cc-sidebar { border-radius:22px 18px 18px 22px; width:min(310px,88%) !important; }
  .cc-workspace-panel.is-compact-mode .cc-main-top { padding:12px 12px 9px; }
  .cc-workspace-panel.is-compact-mode .cc-model-popup { left:0; right:0; top:calc(100% + 8px); max-height:calc(100vh - 150px); }
  .cc-workspace-panel.is-compact-mode .cc-chat-messages { padding:0 12px 12px; }
  .cc-workspace-panel.is-compact-mode .cc-compose { padding:0 12px 12px; }
}
  `;
  document.head.appendChild(style);
}
