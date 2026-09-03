const { app, BrowserWindow, ipcMain, clipboard, Tray, Menu, nativeImage, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// ==================== 自动更新配置 ====================
// 改成你的 GitHub 仓库：所有者/仓库名。发布新版本时，在 GitHub Releases
// 上传 asset 名为 "Samaritan.exe" 的 portable 单文件即可。
const UPDATE_REPO = '18159303268/samaritan';
const UPDATE_ASSET_NAME = 'Samaritan.exe';
// =====================================================

// 无 GPU / 远程桌面环境下走软渲染，避免 GPU 进程崩溃拖垮渲染进程
app.disableHardwareAcceleration();

let mainWindow;
let tray = null;
let isQuitting = false;
let menuLang = 'zh';

const DEFAULT_CONFIG = {
  baseUrl: 'https://api.deepseek.com',
  apiKey: '',
  model: 'deepseek-v4-flash',
  autoLaunch: false,
  workspaceDir: '',
};

function configPath() {
  return path.join(app.getPath('userData'), 'config.json');
}

function loadConfig() {
  try {
    const raw = fs.readFileSync(configPath(), 'utf-8');
    return Object.assign({}, DEFAULT_CONFIG, JSON.parse(raw));
  } catch (e) {
    return Object.assign({}, DEFAULT_CONFIG);
  }
}

function saveConfig(cfg) {
  try {
    fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2), 'utf-8');
    return true;
  } catch (e) {
    return false;
  }
}

function compareVersion(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1080,
    height: 760,
    minWidth: 720,
    minHeight: 520,
    backgroundColor: '#ffffff',
    title: 'Samaritan',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  // mainWindow.webContents.openDevTools({ mode: 'detach' });

  // 点关闭 → 隐藏到托盘（不退出）
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function trayIconPath() {
  if (app.isPackaged) return path.join(process.resourcesPath, 'tray.png');
  return path.join(__dirname, 'build', 'tray.png');
}

function showWindow() {
  if (!mainWindow) return;
  mainWindow.show();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
}

function createTray() {
  const icon = nativeImage.createFromPath(trayIconPath());
  tray = new Tray(icon);
  tray.setToolTip('Samaritan');
  const L = menuLang === 'en' ? {
    show: 'Show Main Window', quit: 'Quit',
  } : {
    show: '显示主界面', quit: '退出',
  };
  const menu = Menu.buildFromTemplate([
    { label: L.show, click: () => showWindow() },
    { type: 'separator' },
    { label: L.quit, click: () => { isQuitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(menu);
  tray.on('click', () => showWindow());
}

// 应用菜单栏（中英双语）
function setupMenu(lang = 'zh') {
  menuLang = lang;
  const L = lang === 'en' ? {
    edit: 'Edit', undo: 'Undo', redo: 'Redo', cut: 'Cut', copy: 'Copy', paste: 'Paste', selectAll: 'Select All',
    window: 'Window', minimize: 'Minimize', close: 'Close Window',
    help: 'Help', getKey: 'How to get API Key', about: 'About Samaritan',
  } : {
    edit: '编辑', undo: '撤销', redo: '重做', cut: '剪切', copy: '复制', paste: '粘贴', selectAll: '全选',
    window: '窗口', minimize: '最小化', close: '关闭窗口',
    help: '帮助', getKey: '如何获取 API Key', about: '关于 Samaritan',
  };
  const template = [
    {
      label: L.edit,
      submenu: [
        { role: 'undo', label: L.undo },
        { role: 'redo', label: L.redo },
        { type: 'separator' },
        { role: 'cut', label: L.cut },
        { role: 'copy', label: L.copy },
        { role: 'paste', label: L.paste },
        { role: 'selectAll', label: L.selectAll },
      ],
    },
    {
      label: L.window,
      submenu: [
        { role: 'minimize', label: L.minimize },
        { role: 'close', label: L.close },
      ],
    },
    {
      label: L.help,
      submenu: [
        { label: L.getKey, click: () => shell.openExternal('https://platform.deepseek.com/') },
        { type: 'separator' },
        { label: L.about, click: () => showAbout() },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  if (tray) createTray(); // 刷新托盘菜单语言
}

function showAbout() {
  if (mainWindow) mainWindow.webContents.send('show:about');
}

// ---- IPC ----
ipcMain.handle('config:get', () => loadConfig());
ipcMain.handle('config:set', (e, cfg) => saveConfig(cfg));
ipcMain.handle('clipboard:write', (e, text) => { clipboard.writeText(String(text)); return true; });
ipcMain.handle('app:version', () => app.getVersion());

// 检查更新（GitHub Releases）
ipcMain.handle('update:check', async () => {
  try {
    const current = app.getVersion();
    const url = `https://api.github.com/repos/${UPDATE_REPO}/releases/latest`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Samaritan-Updater/1.0' } });
    if (!res.ok) throw new Error(`检查更新失败 (${res.status})`);
    const json = await res.json();
    const latest = String(json.tag_name || '').replace(/^v/i, '');
    const body = String(json.body || '');
    const asset = (json.assets || []).find(a => a.name === UPDATE_ASSET_NAME);
    if (!asset) throw new Error('未找到更新文件，请确认 Releases 中包含 ' + UPDATE_ASSET_NAME);
    const hasUpdate = compareVersion(latest, current) > 0;
    return {
      ok: true,
      current,
      latest,
      hasUpdate,
      url: asset.browser_download_url,
      size: asset.size || 0,
      body,
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// 下载更新（递归处理 302/307 重定向）
function downloadWithProgress(url, dest, size, sendProgress) {
  return new Promise((resolve, reject) => {
    const https = require('https');
    const file = fs.createWriteStream(dest);
    let received = 0;
    let finished = false;
    function finish(err) {
      if (finished) return;
      finished = true;
      file.destroy();
      if (err) reject(err); else resolve();
    }
    function go(u) {
      https.get(u, { headers: { 'User-Agent': 'Samaritan-Updater/1.0', Accept: 'application/octet-stream' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          go(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) { finish(new Error('下载失败 (' + res.statusCode + ')')); return; }
        res.on('data', (chunk) => {
          received += chunk.length;
          file.write(chunk);
          if (size) sendProgress(Math.min(100, Math.round((received / size) * 100)), received, size);
        });
        res.on('end', () => file.end());
        res.on('error', finish);
      }).on('error', finish);
    }
    file.on('finish', () => finish());
    file.on('error', finish);
    go(url);
  });
}

ipcMain.handle('update:download', async (e, { url, size }) => {
  try {
    const updateDir = path.join(app.getPath('userData'), 'update');
    fs.mkdirSync(updateDir, { recursive: true });
    const target = path.join(updateDir, UPDATE_ASSET_NAME);
    const temp = target + '.tmp';
    if (fs.existsSync(temp)) fs.unlinkSync(temp);
    await downloadWithProgress(url, temp, size, (percent, received, total) => {
      e.sender.send('update:progress', { percent, received, total });
    });
    fs.renameSync(temp, target);
    return { ok: true, path: target };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// 应用更新：写 PowerShell 脚本，退出后替换 exe 并重启
ipcMain.handle('update:apply', async () => {
  try {
    const updateExe = path.join(app.getPath('userData'), 'update', UPDATE_ASSET_NAME);
    if (!fs.existsSync(updateExe)) throw new Error('未找到已下载的更新文件');
    const currentExe = app.getPath('exe');
    const psPath = path.join(app.getPath('userData'), 'update', 'apply-update.ps1');
    const script = [
      `while (Get-Process -Id ${process.pid} -ErrorAction SilentlyContinue) { Start-Sleep -Seconds 1 }`,
      `Copy-Item -Path "${updateExe}" -Destination "${currentExe}" -Force`,
      `Start-Process -FilePath "${currentExe}"`,
      `Remove-Item -Path "${updateExe}" -Force`,
      `Remove-Item -Path "$PSCommandPath" -Force`,
    ].join('\r\n');
    fs.writeFileSync(psPath, '\ufeff' + script, 'utf-8');
    const { spawn } = require('child_process');
    spawn('powershell.exe', ['-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', psPath], { detached: true, shell: false, windowsHide: true });
    setTimeout(() => { isQuitting = true; app.quit(); }, 400);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// 用系统默认浏览器打开外部链接（仅放行 http/https）
ipcMain.handle('open:external', async (e, url) => {
  const u = String(url || '');
  if (!/^https?:\/\//i.test(u)) return false;
  try { await shell.openExternal(u); return true; } catch (err) { return false; }
});

// 语言切换：重建应用菜单与托盘菜单
ipcMain.handle('lang:set', (e, lang) => {
  setupMenu(lang === 'en' ? 'en' : 'zh');
  return true;
});

// 窗口置顶
ipcMain.handle('window:set-always-on-top', (e, v) => {
  if (mainWindow) mainWindow.setAlwaysOnTop(!!v);
  return mainWindow ? mainWindow.isAlwaysOnTop() : !!v;
});

// 开机自启
ipcMain.handle('auto-launch:get', () => {
  try {
    return app.getLoginItemSettings().openAtLogin || false;
  } catch (e) { return false; }
});
ipcMain.handle('auto-launch:set', (e, value) => {
  try {
    app.setLoginItemSettings({ openAtLogin: !!value, path: app.getPath('exe') });
    return true;
  } catch (err) { return false; }
});

// 自动生成会话标题（非流式，轻量调用）
ipcMain.handle('title:generate', async (e, payload) => {
  const { baseUrl, apiKey, model, messages } = payload || {};
  try {
    const url = String(baseUrl || '').replace(/\/+$/, '') + '/chat/completions';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + String(apiKey || ''),
      },
      body: JSON.stringify({ model, messages, temperature: 0.5, max_tokens: 20 }),
    });
    if (!res.ok) return { ok: false };
    const json = await res.json();
    const title = json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
    return { ok: true, title: String(title || '').trim().replace(/^["']|["']$/g, '').slice(0, 20) };
  } catch (err) {
    return { ok: false };
  }
});

// 选择默认工作空间目录
ipcMain.handle('workspace:select', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: '选择默认工作空间目录',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (canceled || !filePaths.length) return { ok: false };
  return { ok: true, path: filePaths[0] };
});

// 会话导出
ipcMain.handle('sessions:export', async (e, payload) => {
  const { data, defaultDir, title } = payload || {};
  const defaultPath = defaultDir ? path.join(defaultDir, 'ai-chat-sessions.json') : 'ai-chat-sessions.json';
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: title || '导出会话记录',
    defaultPath,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (canceled || !filePath) return { ok: false };
  try {
    fs.writeFileSync(filePath, String(data), 'utf-8');
    return { ok: true, path: filePath };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// 会话导入
ipcMain.handle('sessions:import', async (e, payload) => {
  const { title } = payload || {};
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: title || '导入会话记录',
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (canceled || !filePaths.length) return { ok: false };
  try {
    return { ok: true, data: fs.readFileSync(filePaths[0], 'utf-8') };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// 导出当前会话为 Markdown
ipcMain.handle('session:export-md', async (e, payload) => {
  const { data, defaultDir, title, filename } = payload || {};
  const safeName = (filename || 'chat').replace(/[\\/:*?"<>|]/g, '_');
  const defaultPath = defaultDir ? path.join(defaultDir, safeName + '.md') : (safeName + '.md');
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: title || '导出为 Markdown',
    defaultPath,
    filters: [{ name: 'Markdown', extensions: ['md'] }],
  });
  if (canceled || !filePath) return { ok: false };
  try {
    fs.writeFileSync(filePath, String(data), 'utf-8');
    return { ok: true, path: filePath };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

let activeAbort = null;
ipcMain.on('chat:abort', () => { if (activeAbort) activeAbort.abort(); });

ipcMain.handle('chat:stream', async (e, payload) => {
  const { messages, baseUrl, apiKey, model } = payload;
  const controller = new AbortController();
  activeAbort = controller;
  try {
    if (!apiKey) throw new Error('未配置 API Key，请在设置中填写');
    const url = baseUrl.replace(/\/+$/, '') + '/chat/completions';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
      },
      body: JSON.stringify({ model, messages, stream: true }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error('请求失败 ' + res.status + ': ' + errText.slice(0, 300));
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let idx;
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line.startsWith('data:')) continue;

        const data = line.slice(5).trim();
        if (data === '[DONE]') {
          e.sender.send('chat:done');
          return;
        }
        try {
          const json = JSON.parse(data);
          const delta = json.choices && json.choices[0] && json.choices[0].delta;
          if (delta) {
            const reasoning = delta.reasoning_content || '';
            const content = delta.content || '';
            if (reasoning) e.sender.send('chat:chunk', { type: 'reasoning', text: reasoning });
            if (content) e.sender.send('chat:chunk', { type: 'content', text: content });
          }
        } catch (err) { /* 忽略无法解析的行 */ }
      }
    }
    e.sender.send('chat:done');
  } catch (err) {
    if (err.name === 'AbortError') {
      e.sender.send('chat:done');   // 用户主动停止，视为正常结束
    } else {
      e.sender.send('chat:error', err.message || String(err));
    }
  } finally {
    if (activeAbort === controller) activeAbort = null;
  }
});

app.whenReady().then(() => {
  setupMenu();
  createWindow();
  createTray();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => { isQuitting = true; });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
