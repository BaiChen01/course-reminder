# 课程提示器

一款仅在本机运行的 Windows 课程表与课前提醒程序。支持按学期周数查看课表、单双周/自定义周次、课程冲突提示、系统通知、Server酱微信提醒和托盘常驻。

## 配置微信提醒

1. 登录 [Server酱 Turbo](https://sct.ftqq.com/sendkey/) 获取以 `SCT` 开头的 SendKey。
2. 打开“学期设置”底部的“微信提醒”，粘贴并保存 SendKey。
3. 点击“发送测试”；微信收到测试消息后即可开启提醒。

SendKey 使用 Electron `safeStorage` 调用 Windows DPAPI 加密，和课表数据分开保存在本机。启用后，课程名称、上课时间、教师和地点会发送给 Server酱；程序退出、电脑关机或断网时无法发送。同一开始时间的冲突课程会合并为一条微信消息。

从 1.0 升级时，程序会保留原课表并在用户数据目录创建 `schedule.v1.backup.json`，不需要重新录入课程。

## 开发运行

需要 Node.js 20 或更高版本。

```powershell
npm install
npm run dev
```

开发模式会启动 Vite 页面与 Electron 桌面窗口。关闭主窗口后程序仍驻留系统托盘；请从托盘菜单选择“退出程序”以完全退出。

## 测试与构建

```powershell
npm test
npm run typecheck
npm run build
npm run dist
```

- `npm test`：运行周数、周次、冲突、提醒和持久化测试。
- `npm run typecheck`：检查渲染进程、主进程和安全 IPC 类型。
- `npm run build`：生成渲染进程与 Electron 主进程产物。
- `npm run dist`：测试通过后，在 `release` 目录生成 Windows NSIS 安装包。

课程数据保存在 Electron 的用户数据目录中，不会上传到网络。首次打开后，请先在“学期设置”中填写第一周星期一和本校节次时间。
