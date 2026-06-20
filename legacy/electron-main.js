const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const fs = require('node:fs/promises');
const path = require('path');
const { pathToFileURL } = require('node:url');

let mainWindow;
const MAX_RECENT_DIRECTORIES = 6;

const IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.svg',
]);

function buildCharacterJsonPath(directoryPath) {
  return path.join(directoryPath, 'character.json');
}

function getRecentStorePath() {
  return path.join(app.getPath('userData'), 'recent-directories.json');
}

async function readRecentDirectories() {
  try {
    const filePath = getRecentStorePath();
    const text = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeRecentDirectories(entries) {
  const filePath = getRecentStorePath();
  await fs.writeFile(filePath, JSON.stringify(entries, null, 2), 'utf-8');
}

function normalizeRecentEntry(entry) {
  if (!entry || typeof entry.path !== 'string' || !entry.path.trim()) {
    return null;
  }

  const directoryPath = entry.path.trim();
  return {
    path: directoryPath,
    name: path.basename(directoryPath),
    lastUsedAt: entry.lastUsedAt || new Date().toISOString(),
  };
}

async function getValidatedRecentDirectories() {
  const entries = await readRecentDirectories();
  const valid = [];

  for (const rawEntry of entries) {
    const entry = normalizeRecentEntry(rawEntry);
    if (!entry) {
      continue;
    }

    try {
      const characterJsonPath = buildCharacterJsonPath(entry.path);
      await fs.access(characterJsonPath);
      valid.push(entry);
    } catch {
      // Skip invalid or removed directories.
    }
  }

  const unique = [];
  const seen = new Set();
  for (const item of valid) {
    if (seen.has(item.path)) {
      continue;
    }
    seen.add(item.path);
    unique.push(item);
    if (unique.length >= MAX_RECENT_DIRECTORIES) {
      break;
    }
  }

  await writeRecentDirectories(unique);
  return unique;
}

async function pushRecentDirectory(directoryPath) {
  const current = await getValidatedRecentDirectories();
  const nextEntry = {
    path: directoryPath,
    name: path.basename(directoryPath),
    lastUsedAt: new Date().toISOString(),
  };

  const merged = [
    nextEntry,
    ...current.filter((entry) => entry.path !== directoryPath),
  ].slice(0, MAX_RECENT_DIRECTORIES);

  await writeRecentDirectories(merged);
}

function sendBundleToRenderer(bundle) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  mainWindow.webContents.send('character:openBundleFromMenu', bundle);
}

async function ensureWriteAccess(filePath) {
  const handle = await fs.open(filePath, 'r+');
  await handle.close();
}

async function buildImageManifest(directoryPath) {
  const imagesDirPath = path.join(directoryPath, 'images');
  try {
    const entries = await fs.readdir(imagesDirPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase()))
      .sort((a, b) => a.localeCompare(b, 'it', { sensitivity: 'base' }))
      .map((file) => {
        const absolutePath = path.join(imagesDirPath, file);
        return {
          file,
          src: `images/${file}`,
          alt: file,
          caption: file,
          resolvedSrc: pathToFileURL(absolutePath).toString(),
        };
      });
  } catch {
    return [];
  }
}

async function readCharacterBundle(directoryPath) {
  const characterJsonPath = buildCharacterJsonPath(directoryPath);
  await ensureWriteAccess(characterJsonPath);
  const text = await fs.readFile(characterJsonPath, 'utf-8');
  const character = JSON.parse(text);
  const images = await buildImageManifest(directoryPath);
  await pushRecentDirectory(directoryPath);
  refreshApplicationMenu();
  return {
    directoryPath,
    character,
    images,
  };
}

async function openCharacterFromMenu() {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Apri cartella personaggio',
    });

    if (result.canceled || !result.filePaths.length) {
      return;
    }

    const bundle = await readCharacterBundle(result.filePaths[0]);
    sendBundleToRenderer(bundle);
  } catch (error) {
    dialog.showErrorBox('Errore apertura', error.message || String(error));
  }
}

async function openRecentFromMenu(directoryPath) {
  try {
    const bundle = await readCharacterBundle(directoryPath);
    sendBundleToRenderer(bundle);
  } catch (error) {
    dialog.showErrorBox('Errore recente', error.message || String(error));
  }
}

async function refreshApplicationMenu() {
  const recents = await getValidatedRecentDirectories();
  const openRecentSubmenu = recents.length
    ? recents.map((item) => ({
        label: item.name,
        sublabel: item.path,
        click: () => {
          openRecentFromMenu(item.path);
        },
      }))
    : [{ label: 'Nessun recente', enabled: false }];

  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open...',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            openCharacterFromMenu();
          },
        },
        {
          label: 'Open Recent',
          submenu: openRecentSubmenu,
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
      ],
    },
    {
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'close' }],
    },
  ];

  if (process.platform === 'darwin') {
    template.unshift({ role: 'appMenu' });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function setupIpcHandlers() {
  ipcMain.handle('character:pickDirectory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Apri cartella personaggio',
    });

    if (result.canceled || !result.filePaths.length) {
      return { canceled: true };
    }

    const directoryPath = result.filePaths[0];
    const bundle = await readCharacterBundle(directoryPath);
    return { canceled: false, ...bundle };
  });

  ipcMain.handle('character:loadFromDirectory', async (_event, directoryPath) => {
    return readCharacterBundle(directoryPath);
  });

  ipcMain.handle('character:getRecentDirectories', async () => {
    return getValidatedRecentDirectories();
  });

  ipcMain.handle('character:saveToDirectory', async (_event, payload) => {
    const { directoryPath, character } = payload || {};
    if (!directoryPath || !character) {
      throw new Error('Dati salvataggio non validi.');
    }

    const characterJsonPath = buildCharacterJsonPath(directoryPath);
    await ensureWriteAccess(characterJsonPath);
    await fs.writeFile(characterJsonPath, JSON.stringify(character, null, 2), 'utf-8');
    return { ok: true };
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadFile('index.html');
  mainWindow.webContents.openDevTools(); // Commenta per production
  refreshApplicationMenu();
}

app.on('ready', createWindow);

app.whenReady().then(() => {
  setupIpcHandlers();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
