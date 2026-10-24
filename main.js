const { app, BrowserWindow, Menu, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

/* ---------- Автоматическая резервная копия ---------- */
const KEEP_FILES = 30; // сколько последних дней хранить
function configPath() { return path.join(app.getPath('userData'), 'backup-config.json'); }
function defaultDir() { return path.join(app.getPath('documents'), 'OLED SERVICE Backups'); }
function readConfig() {
  try { return JSON.parse(fs.readFileSync(configPath(), 'utf8')); } catch (e) { return {}; }
}
function backupDir() { return readConfig().dir || defaultDir(); }
function listAutoFiles(dir) {
  try {
    return fs.readdirSync(dir)
      .filter(f => /^OLED_SERVICE_auto_\d{4}-\d{2}-\d{2}\.json$/.test(f))
      .sort();
  } catch (e) { return []; }
}
function info() {
  const dir = backupDir();
  const files = listAutoFiles(dir);
  let last = 0;
  if (files.length) {
    try { last = fs.statSync(path.join(dir, files[files.length - 1])).mtimeMs; } catch (e) {}
  }
  return { dir, count: files.length, last };
}

ipcMain.handle('backup:write', (event, json) => {
  try {
    const dir = backupDir();
    fs.mkdirSync(dir, { recursive: true });
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    const name = `OLED_SERVICE_auto_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
    const file = path.join(dir, name);
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, json, 'utf8');
    fs.renameSync(tmp, file);
    const files = listAutoFiles(dir);
    files.slice(0, Math.max(0, files.length - KEEP_FILES)).forEach(f => {
      try { fs.unlinkSync(path.join(dir, f)); } catch (e) {}
    });
    return { ok: true, ...info() };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e), ...info() };
  }
});
ipcMain.handle('backup:info', () => info());
ipcMain.handle('backup:open', async () => {
  const dir = backupDir();
  fs.mkdirSync(dir, { recursive: true });
  await shell.openPath(dir);
  return true;
});
ipcMain.handle('backup:choose', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const res = await dialog.showOpenDialog(win, {
    title: 'Папка для автоматических копий',
    defaultPath: backupDir(),
    properties: ['openDirectory', 'createDirectory']
  });
  if (res.canceled || !res.filePaths[0]) return null;
  const cfg = readConfig();
  cfg.dir = res.filePaths[0];
  fs.writeFileSync(configPath(), JSON.stringify(cfg), 'utf8');
  return info();
});

/* ---------- Окно ---------- */
function createWindow() {
  const win = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 1000,
    minHeight: 650,
    icon: path.join(__dirname, 'icon.ico'),
    autoHideMenuBar: true,
    backgroundColor: '#eef2fb',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  Menu.setApplicationMenu(null);

  // WhatsApp и другие ссылки открываются в обычном браузере
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  win.loadFile('oled_service.html');
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
