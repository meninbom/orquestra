const { BrowserWindow, ipcMain, screen } = require('electron');
const path = require('node:path');
const simple = new Set(['next','previous','togglePlay','stop','openAudience','closeAudience','toggleFullscreen','toggleLaser','attach']);
const obj = v => v && typeof v === 'object' && !Array.isArray(v);
const number = v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1e12;
const integer = (v, max) => Number.isInteger(v) && v >= 0 && v <= max;
const timestamp = v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 8.64e15;
const timer = v => obj(v) && number(v.elapsedMs) && (v.startedAt === null || timestamp(v.startedAt)) ? { elapsedMs:v.elapsedMs, startedAt:v.startedAt } : null;
function cleanState(v) {
  if (!obj(v) || !Array.isArray(v.scenes) || v.scenes.length === 0 || v.scenes.length > 200 || !v.scenes.every(s => obj(s) && typeof s.id === 'string' && s.id.length <= 200 && typeof s.name === 'string' && s.name.length <= 1000) || !integer(v.index,199) || (v.scenes.length && v.index >= v.scenes.length) || !integer(v.step,20) || !integer(v.maxStep,20) || v.step > v.maxStep || !['playing','audience','fullscreen','laser','light'].every(k => typeof v[k] === 'boolean') || (v.notes !== undefined && (typeof v.notes !== 'string' || v.notes.length > 20000))) return null;
  const t = timer(v.timer); if (!t) return null;
  return { scenes:v.scenes.map(s => ({id:s.id,name:s.name})), index:v.index, step:v.step, maxStep:v.maxStep, playing:v.playing, audience:v.audience, fullscreen:v.fullscreen, laser:v.laser, ...(v.notes === undefined ? {} : {notes:v.notes}), light:v.light, timer:t };
}
function cleanCommand(v) {
  if (!obj(v) || typeof v.type !== 'string') return null;
  if (simple.has(v.type)) return {type:v.type};
  if (v.type === 'select' && integer(v.index,199)) return {type:v.type,index:v.index};
  if (v.type === 'timer') { const t = timer(v.timer); return t ? {type:v.type,timer:t} : null; }
  return null;
}
const trustedFrame = (e, wc) => !!wc && e.sender === wc && e.senderFrame === wc.mainFrame;
function installOperator({mainWindow, rendering}) {
  let win = null, latest = null, ready = false;
  const send = () => { if (ready && win && !win.isDestroyed() && latest) win.webContents.send('operator:state',latest); };
  const bounds = (expanded, current) => {
    const base = current || mainWindow.getBounds();
    const area = screen.getDisplayNearestPoint({x:Math.round(base.x + base.width/2),y:Math.round(base.y + base.height/2)}).workArea;
    const width = Math.min(expanded ? 420 : 380, area.width), height = Math.min(expanded ? 680 : 64, area.height);
    return {x:Math.round(Math.max(area.x,Math.min(area.x+area.width-width,base.x+base.width/2-width/2))), y:Math.round(Math.max(area.y,Math.min(area.y+area.height-height,current ? base.y : area.y))), width, height};
  };
  const open = () => {
    if (win && !win.isDestroyed()) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); return true; }
    ready = false; rendering.acquire('operator');
    try {
      win = new BrowserWindow({...bounds(false), show:false, frame:false, transparent:true, backgroundColor:'#00000000', title:'Orquestra — Operador', showInTaskbar:true, alwaysOnTop:true, resizable:false, webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
      const created = win;
      win.setMenuBarVisibility(false); win.webContents.setBackgroundThrottling(false);
      win.webContents.setWindowOpenHandler(() => ({action:'deny'}));
      win.webContents.on('will-navigate', e => e.preventDefault());
      win.on('closed', () => { if (win !== created) return; win=null; ready=false; latest=null; rendering.release('operator'); if (!mainWindow.isDestroyed()) mainWindow.webContents.send('operator:closed'); });
      win.webContents.once('did-finish-load', () => { if (!created.isDestroyed()) created.show(); });
      win.loadFile(path.join(__dirname,'../dist/orquestra.html'),{hash:'operator'});
      return true;
    } catch (error) { rendering.release('operator'); throw error; }
  };
  const main = e => trustedFrame(e,mainWindow.webContents);
  const operator = e => !!win && !win.isDestroyed() && trustedFrame(e,win.webContents);
  ipcMain.handle('operator:open', e => { if (!main(e)) throw new Error('Origem não permitida.'); return open(); });
  ipcMain.handle('operator:close', e => { if (!main(e)) throw new Error('Origem não permitida.'); win?.close(); });
  ipcMain.handle('operator:publish', (e,v) => { const state = cleanState(v); if (!main(e) || !state) throw new Error('Estado inválido ou origem não permitida.'); latest=state; send(); });
  ipcMain.on('operator:ready', e => { if (operator(e)) {ready=true; send();} });
  ipcMain.on('operator:command', (e,v) => { if (!operator(e)) return; const command=cleanCommand(v); if (command && (command.type !== 'select' || (latest && command.index < latest.scenes.length)) && !mainWindow.isDestroyed()) mainWindow.webContents.send('operator:command',command); });
  ipcMain.handle('operator:minimize', e => { if (!operator(e)) throw new Error('Origem não permitida.'); win.minimize(); });
  ipcMain.handle('operator:expanded', (e,v) => { if (!operator(e) || typeof v !== 'boolean') throw new Error('Origem não permitida.'); win.setBounds(bounds(v,win.getBounds())); });
  mainWindow.once('closed', () => { if (win && !win.isDestroyed()) win.close(); });
  return {get window(){return win;}};
}
module.exports={installOperator,cleanState,cleanCommand,trustedFrame};
