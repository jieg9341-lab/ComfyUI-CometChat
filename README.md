# ComfyUI-CometChat

ComfyUI-CometChat 是一个给 ComfyUI 使用的轻量对话插件，提供独立的 Chat 工作台、模型渠道配置、附件输入、Markdown/代码块渲染、图片生成模型调用和划词助手等能力。

作者：B站「那颗星星188」

协议：Apache License 2.0

## 功能特点

- 在 ComfyUI 内打开独立对话窗口，支持宽屏和半屏模式。
- 支持 OpenAI 兼容、Gemini 原生、Claude Messages 等文本模型接口格式。
- 支持 Gemini Image 和 gptimage 类图片模型的 Chat 生图调用。
- 支持图片、PDF、音频、视频、文本等附件输入。
- 支持 Markdown、代码块、表格、复制、重新生成等常用对话交互。
- 支持生成图片的复制、下载、重新生成和多版本翻页。
- 内置划词助手，可手动启用翻译、解释、复制、提示词优化和继续提问。
- 如果同时安装了 ComfyUI-CometAPI 的集成对话版本，本插件会自动隐藏独立悬浮入口，避免两个对话入口冲突。

## 安装方式

进入 ComfyUI 的 `custom_nodes` 目录：

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/jieg9341-lab/ComfyUI-CometChat.git
```

然后重启 ComfyUI。

插件启动时会检查并尝试安装必要依赖：

- `requests`
- `aiohttp`

如果自动安装失败，可以手动安装：

```bash
python -m pip install requests aiohttp
```

## 使用说明

1. 重启 ComfyUI 后进入网页界面。
2. 使用 CometChat 的悬浮入口打开对话窗口。
3. 在设置页添加自己的渠道、API URL、API Key 和模型名称。
4. 根据模型接口选择对应格式，例如 OpenAI 兼容、Gemini 原生或 Claude Messages。
5. 如需使用图片模型，在模型设置中选择图片格式并填写对应模型名。

## 数据存储

插件会在本地插件目录下创建 `data/` 用于保存配置和对话数据。该目录包含用户本地数据，不建议提交到 Git 仓库。

生成图片会保存到 ComfyUI 的 `output/comet_chat` 目录，便于重启后继续查看。

## 目录说明

```text
ComfyUI-CometChat/
├─ __init__.py               # ComfyUI 插件入口
├─ comet_chat_plugin.py      # 后端 API、配置、对话和图片生成逻辑
├─ web/                      # 前端工作台源码
├─ README.md                 # 项目说明
└─ LICENSE                   # Apache 2.0 协议
```

## 许可证

本项目采用 Apache License 2.0 协议开源。详见 [LICENSE](LICENSE)。
