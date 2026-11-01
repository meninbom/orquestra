const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const { EventEmitter } = require('node:events');
const handlers = new Map(), listeners = new Map();
class Window extends EventEmitter {
  constructor(options) { super(); this.options=options; this.webContents=new EventEmitter(); this.webContents.mainFrame={}; this.webContents.send=(...v)=>this.sent=v; this.webContents.setBackgroundThrottling=()=>{}; this.webContents.setWindowOpenHandler=()=>{}; this.bounds=options; }
  isDestroyed(){return false} isMinimized(){return false} show(){} focus(){} setMenuBarVisibility(){} loadFile(){} getBounds(){return this.bounds} setBounds(v){this.bounds=v} minimize(){this.minimized=true} close(){this.emit('closed')}
}
const electron={BrowserWindow:Window,ipcMain:{handle:(k,v)=>handlers.set(k,v),on:(k,v)=>listeners.set(k,v)},screen:{getDisplayNearestPoint:()=>({workArea:{x:0,y:0,width:1920,height:1080}})}};
const load=Module._load; Module._load=function(name,...args){return name==='electron'?electron:load.call(this,name,...args)};
const {installOperator,cleanState,cleanCommand}=require('../desktop/operator.cjs'); Module._load=load;
const state={scenes:[{id:'a',name:'A',secret:'drop'}],index:0,step:0,maxStep:0,playing:false,audience:false,fullscreen:false,laser:false,light:false,notes:'privado',timer:{elapsedMs:0,startedAt:null,extra:1},extra:'drop'};

test('timer accepts a real epoch timestamp when moving a running console', () => {
  const running = { elapsedMs: 1500, startedAt: Date.now() - 1500 };
  assert.deepEqual(cleanState({ ...state, timer: running }).timer, running);
  assert.deepEqual(cleanCommand({ type: 'timer', timer: running }), { type: 'timer', timer: running });
  assert.equal(cleanCommand({ type: 'timer', timer: { elapsedMs: 0, startedAt: Infinity } }), null);
});
test('schema projects fields and rejects invalid limits',()=>{
  assert.deepEqual(cleanState(state).scenes,[{id:'a',name:'A'}]); assert.equal(cleanState(state).extra,undefined); assert.equal(cleanState(state).timer.extra,undefined);
  for(const patch of [{notes:'x'.repeat(20001)},{scenes:Array(201).fill({id:'a',name:'b'})},{index:1},{step:21},{timer:{elapsedMs:Infinity,startedAt:null}},{playing:1}]) assert.equal(cleanState({...state,...patch}),null);
  assert.deepEqual(cleanCommand({type:'select',index:0,secret:1}),{type:'select',index:0}); assert.equal(cleanCommand({type:'timer',timer:{elapsedMs:1e13,startedAt:null}}),null); assert.equal(cleanCommand({type:'library'}),null);
});
test('IPC requires window and main frame and isolates audience',()=>{
  const main=new Window({x:0,y:0,width:800,height:600}); let held=0; const service=installOperator({mainWindow:main,rendering:{acquire:()=>held++,release:()=>held--}});
  const event=wc=>({sender:wc,senderFrame:wc.mainFrame}); const wrong={sender:main.webContents,senderFrame:{}}; const outsider=new Window({});
  assert.throws(()=>handlers.get('operator:open')(wrong)); assert.equal(handlers.get('operator:open')(event(main.webContents)),true); assert.equal(held,1);
  const op=service.window; assert.throws(()=>handlers.get('operator:publish')(event(outsider.webContents),state)); assert.throws(()=>handlers.get('operator:publish')(event(op.webContents),state));
  handlers.get('operator:publish')(event(main.webContents),state); listeners.get('operator:ready')(event(outsider.webContents)); assert.equal(op.sent,undefined); listeners.get('operator:ready')(event(op.webContents)); assert.equal(op.sent[1].notes,'privado');
  listeners.get('operator:command')(event(outsider.webContents),{type:'next'}); assert.equal(main.sent,undefined); listeners.get('operator:command')({sender:op.webContents,senderFrame:{}},{type:'next'}); assert.equal(main.sent,undefined); listeners.get('operator:command')(event(op.webContents),{type:'next',extra:1}); assert.deepEqual(main.sent,['operator:command',{type:'next'}]);
  assert.throws(()=>handlers.get('operator:expanded')(event(outsider.webContents),true)); handlers.get('operator:expanded')(event(op.webContents),true); assert.equal(op.bounds.width,420); handlers.get('operator:close')(event(main.webContents)); assert.equal(held,0); assert.equal(main.sent[0],'operator:closed');
});
