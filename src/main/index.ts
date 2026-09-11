import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

function createWindow(): void {
  // Ana pencere
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 800,
    minHeight: 560,
    title: 'Kişisel Asistan',
    backgroundColor: '#09090b',
    show: false,
    autoHideMenuBar: true,
    ...(process.platform !== 'darwin' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // Uygulama içindeki dış linkler varsayılan tarayıcıda açılsın
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Geliştirme modunda Vite sunucusunu (anlık yenileme), üretimde derlenmiş dosyayı yükle
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // Windows bildirimlerinde ve görev çubuğunda uygulama kimliği
  electronApp.setAppUserModelId('com.kisisel.asistan')

  // Geliştirmede F12 ile DevTools açılır, üretimde Ctrl+R yenilemesi kapatılır
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Tüm pencereler kapanınca çık (Aşama 3'te tepside kalacak şekilde değişecek)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
