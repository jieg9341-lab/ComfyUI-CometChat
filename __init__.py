# ComfyUI-CometChat/__init__.py
import os
import sys
import subprocess
import importlib.util
import traceback

# ======================================================================
# 1. 自动依赖安装逻辑
# ======================================================================
def check_and_install_dependencies():
    # 仅保留 CometChat 后端真正需要的依赖
    required_packages = {
        "requests": "requests",
        "aiohttp": "aiohttp"
    }

    print("--- [ComfyUI-CometChat] 正在检查核心依赖... ---")
    for package_name, import_name in required_packages.items():
        spec = importlib.util.find_spec(import_name)
        if spec is None:
            print(f"  > 检测到缺失库: {package_name}，正在自动安装...")
            try:
                subprocess.check_call([sys.executable, '-m', 'pip', 'install', package_name])
            except subprocess.CalledProcessError:
                print(f"  > [警告] {package_name} 安装失败，请手动通过终端安装。")

check_and_install_dependencies()

# ======================================================================
# 2. 核心插件加载 (注册后端 API 路由)
# ======================================================================
NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}

# 尝试导入后端的 python 文件以激活路由注册
# 假设您的后端文件重命名为了 comet_chat_plugin.py
try:
    from . import comet_chat_plugin
    
    # 兼容处理：如果文件内部有导出节点，则合并（目前为空）
    if hasattr(comet_chat_plugin, "NODE_CLASS_MAPPINGS"):
        NODE_CLASS_MAPPINGS.update(comet_chat_plugin.NODE_CLASS_MAPPINGS)
    if hasattr(comet_chat_plugin, "NODE_DISPLAY_NAME_MAPPINGS"):
        NODE_DISPLAY_NAME_MAPPINGS.update(comet_chat_plugin.NODE_DISPLAY_NAME_MAPPINGS)
        
    print("  > [ComfyUI-CometChat] 后端 API 路由加载成功。")
except Exception as e:
    print("  > [ComfyUI-CometChat] 后端加载失败，错误信息如下:")
    traceback.print_exc()

# ======================================================================
# 3. 暴露给 ComfyUI 的核心接口
# ======================================================================
# 告诉 ComfyUI 这个插件的前端 JS 存放位置
WEB_DIRECTORY = "./web"

__all__ = ['NODE_CLASS_MAPPINGS', 'NODE_DISPLAY_NAME_MAPPINGS', 'WEB_DIRECTORY']