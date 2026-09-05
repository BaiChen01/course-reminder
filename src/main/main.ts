import { app, BrowserWindow, ipcMain, Menu, nativeImage, safeStorage, shell, Tray } from 'electron';
import path from 'node:path';
import type { AppSettings, Course, CourseInput } from '../shared/types';
import { DataStore } from './store';
import { ReminderService } from './reminder-service';
import { SecretStore } from './secret-store';
import { DeliveryLedger } from './delivery-ledger';
import { WechatPushService } from './wechat-push-service';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let quitting = false;
let store: DataStore;
let reminders: ReminderService;
let secrets: SecretStore;
let ledger: DeliveryLedger;
let wechat: WechatPushService;

const trayPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAO0lEQVR42mNgGAWjYBSMglEwCkbBKBgFo2AUjIJRMApGwSgYBaNgFIyCUTAKRsEoGAWjYBSMglEwCkYBAAA0EAAB8LqV8QAAAABJRU5ErkJggg==';

function showMainWindow(): BrowserWindow | null {
  if (!mainWindow) return null;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  return mainWindow;
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 980,
    minHeight: 680,
    title: '课程提示器',
    backgroundColor: '#f5f8fc',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.removeMenu();
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://sct.ftqq.com/')) void shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.on('close', (event) => {
    if (!quitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
  mainWindow.once('ready-to-show', () => mainWindow?.show());

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) void mainWindow.loadURL(devUrl);
  else void mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
}

function createTray(): void {
  const image = nativeImage.createFromDataURL(trayPng).resize({ width: 16, height: 16 });
  tray = new Tray(image);
  tray.setToolTip('课程提示器');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '打开课表', click: () => showMainWindow() },
    { type: 'separator' },
    { label: '退出程序', click: () => { quitting = true; app.quit(); } },
  ]));
  tray.on('double-click', () => showMainWindow());
}

function registerIpc(): void {
  ipcMain.handle('settings:get', () => store.getSettings());
  ipcMain.handle('settings:save', async (_event, settings: AppSettings) => {
    if (settings.wechat.enabled && !secrets.getStatus(true).testPassed) {
      throw new Error('请先保存 SendKey 并成功发送测试消息');
    }
    const data = await store.saveSettings(settings);
    reminders.refresh();
    return data;
  });
  ipcMain.handle('courses:list', () => store.listCourses());
  ipcMain.handle('courses:week', (_event, week: number) => store.getWeekSchedule(week));
  ipcMain.handle('courses:add', async (_event, input: CourseInput) => {
    const course = await store.addCourse(input);
    reminders.refresh();
    return course;
  });
  ipcMain.handle('courses:update', async (_event, input: Course) => {
    const course = await store.updateCourse(input);
    reminders.refresh();
    return course;
  });
  ipcMain.handle('courses:delete', async (_event, id: string) => {
    await store.deleteCourse(id);
    reminders.refresh();
  });
  ipcMain.handle('wechat:status', () => secrets.getStatus(store.getSettings().wechat.enabled));
  ipcMain.handle('wechat:save-key', async (_event, sendKey: string) => {
    await secrets.saveKey(sendKey);
    await store.setWechatEnabled(false);
    return secrets.getStatus(false);
  });
  ipcMain.handle('wechat:clear-key', async () => {
    await store.setWechatEnabled(false);
    await secrets.clear();
    return secrets.getStatus(false);
  });
  ipcMain.handle('wechat:test', async () => {
    const sendKey = secrets.getKey();
    if (!sendKey) throw new Error('请先保存有效的 SendKey');
    const result = await wechat.sendTest(sendKey);
    await secrets.setLastResult(result, true);
    return secrets.getStatus(store.getSettings().wechat.enabled);
  });
  ipcMain.handle('wechat:set-enabled', async (_event, enabled: boolean) => {
    if (enabled && !secrets.getStatus(false).testPassed) throw new Error('请先成功发送测试消息');
    await store.setWechatEnabled(Boolean(enabled));
    reminders.refresh();
    return secrets.getStatus(Boolean(enabled));
  });
}

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) app.quit();
else {
  app.on('second-instance', () => showMainWindow());
  app.whenReady().then(async () => {
    app.setAppUserModelId('cn.local.course-reminder');
    store = new DataStore(app.getPath('userData'));
    await store.load();
    secrets = new SecretStore(app.getPath('userData'), safeStorage);
    ledger = new DeliveryLedger(app.getPath('userData'));
    wechat = new WechatPushService();
    await Promise.all([secrets.load(), ledger.load()]);
    reminders = new ReminderService(store, showMainWindow, secrets, ledger, wechat);
    registerIpc();
    createWindow();
    createTray();
    reminders.start();
  });
}

app.on('before-quit', () => {
  quitting = true;
  reminders?.stop();
});

app.on('activate', () => showMainWindow());
app.on('window-all-closed', () => {
  // Windows 上保持托盘运行，只有托盘“退出程序”才真正退出。
});
