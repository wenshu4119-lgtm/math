@echo off
echo 正在启动本地预览，浏览器将自动打开 http://localhost:8000
start http://localhost:8000
python -m http.server 8000
