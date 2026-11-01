import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import os from 'node:os';
import richFixture from './rich-fixture.cjs';
import { makeAcceptancePdf } from './acceptance-flow.mjs';

export async function testAiFlow({cdp, run, mainRun, waitFor, profile, cdpEvents}) {
 const folder=path.join(os.homedir(),'Documents','Orquestra-Rich-Flows-2026-10-27'); await mkdir(folder,{recursive:true});
 const shot=async name=>writeFile(path.join(folder,name+'.png'),Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
 const click=async s=>{await run(`document.querySelector(${JSON.stringify(s)}).click();true`);await delay(120)};
 const edit=async(s,v)=>{await run(`(()=>{const x=document.querySelector(${JSON.stringify(s)});if(!x)throw Error('Missing '+${JSON.stringify(s)});let p=x instanceof HTMLSelectElement?HTMLSelectElement.prototype:x instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(x,${JSON.stringify(v)});x.dispatchEvent(new Event(x instanceof HTMLSelectElement?'change':'input',{bubbles:true}));return true})()`);await delay(100)};
 const open=async()=>{await run(`[...document.querySelectorAll('.projects-trigger')].find(x=>x.textContent.includes('Criar com IA')).click();true`);await waitFor(()=>run('!!document.querySelector(".ai-dialog")'),'AI dialog')};
 const disk=async()=>JSON.parse(await readFile(path.join(profile,'biblioteca.json'),'utf8'));
 const active=l=>l.projects.find(p=>p.id===l.activeId);
 await waitFor(()=>run('window.orquestraDesktop.loadLibrary().then(x=>!!x?.projects?.length)'),'initial library');
 await cdp('Debugger.enable');
 let breakpoint, variable;
 for(const ev of cdpEvents.filter(x=>x.method==='Debugger.scriptParsed')) {
   const src=(await cdp('Debugger.getScriptSource',{scriptId:ev.params.scriptId})).scriptSource;
   const match=src?.match(/await (\w+)\.aiGenerate\([^)]*\)/);
   if(!match)continue;
   variable=match[1];const before=src.slice(0,match.index);const lineNumber=before.split('\n').length-1,columnNumber=before.length-before.lastIndexOf('\n')-1;
   breakpoint=(await cdp('Debugger.setBreakpoint',{location:{scriptId:ev.params.scriptId,lineNumber,columnNumber}})).breakpointId;break;
 }
 assert.ok(breakpoint,'renderer generation call located');
 let eventIndex=cdpEvents.length;
 const generate=async({pages=[],failure='',slow=false,long=false,rich=false}={})=>{
   const trigger=run(`document.querySelector('.ai-actions button').click();true`);
   const event=await waitFor(()=>cdpEvents.slice(eventIndex).find(e=>e.method==='Debugger.paused'),'generation intercepted',30000);eventIndex=cdpEvents.length;
   const frame=event.params.callFrames[0];let scope=-1;
   for(let i=0;i<frame.scopeChain.length;i++){const p=await cdp('Runtime.getProperties',{objectId:frame.scopeChain[i].object.objectId,ownProperties:true});if(p.result.some(x=>x.name===variable)){scope=i;break}}
   assert.ok(scope>=0,'bridge closure found');
   const outline=rich ? richFixture : {title:'Roteiro de teste',sections:Array.from({length:long?12:1},(_,i)=>({title:'Introdução '+(i+1),summary:'Resumo revisável',points:long?Array.from({length:6},(_,j)=>('Conteúdo extenso para revisão '+j+' ').repeat(4)):['Primeiro ponto','Segundo ponto'],pages}))};
   const expr=`({...${variable},aiGenerate:async(prompt,model,pages)=>{window.__aiCapture={prompt,model,pages};${slow?'await new Promise(r=>setTimeout(r,800));':''}${failure?`throw Error(${JSON.stringify(failure)});`:''}return ${JSON.stringify(outline)}}})`;
   const fake=await cdp('Debugger.evaluateOnCallFrame',{callFrameId:frame.callFrameId,expression:expr});assert.ok(fake.result.objectId);
   await cdp('Debugger.setVariableValue',{scopeNumber:scope,variableName:variable,newValue:{objectId:fake.result.objectId},callFrameId:frame.callFrameId});
   await cdp('Debugger.resume');await trigger;
 };
 await open();
 await click('.ai-account button');await waitFor(()=>run('document.querySelector(".ai-account span").textContent==="Desconectada" && document.querySelectorAll(".ai-grid select")[1].options.length>1'),'real disconnected status and models',45000);
 const models=await run(`Array.from(document.querySelectorAll('.ai-grid select')[1].options).slice(1).map(x=>({id:x.value,name:x.textContent}))`);assert.ok(models.length>0 && models.every(x=>x.id&&x.name));
 const win="process.mainModule.require('electron').BrowserWindow.getAllWindows()[0]";
 const layouts=[];
 for(const [width,height] of [[800,600],[1440,900]]){
   await mainRun(`${win}.setContentSize(${width},${height})`);await delay(300);
   for(const theme of ['dark','light']){
     await run(`localStorage.setItem('orquestra-theme',${JSON.stringify(theme)});true`);
     // Theme is React state: toggle through board settings after closing the dialog.
     await click('.ai-inner header button');await click('[aria-label="Configurações do board"]');await run(`[...document.querySelectorAll('.board-settings-panel button')].find(b=>b.textContent===${JSON.stringify(theme==='light'?'Claro':'Escuro')}).click();true`);await open();await delay(150);
     const metrics=await run(`(()=>{let d=document.querySelector('.ai-dialog'),i=document.querySelector('.ai-inner'),r=d.getBoundingClientRect();return {width:innerWidth,height:innerHeight,left:r.left,right:r.right,top:r.top,bottom:r.bottom,scroll:i.scrollWidth,client:i.clientWidth,doc:document.documentElement.scrollWidth}})()`);
     layouts.push({theme,...metrics});assert.ok(metrics.left>=-1&&metrics.right<=metrics.width+1&&metrics.top>=-1&&metrics.bottom<=metrics.height+1&&metrics.scroll<=metrics.client+1&&metrics.doc<=metrics.width+1,JSON.stringify(metrics));await shot(`modal-${width}x${height}-${theme}`);
   }
 }
 // Re-check models on each newly opened dialog.
 await click('.ai-account button');await waitFor(()=>run('document.querySelectorAll(".ai-grid select")[1].options.length>1'),'models refreshed',45000);
 await edit('.ai-grid label:nth-child(2) select',models[1].id);
 await click('.ai-actions button');await waitFor(()=>run('document.querySelector(".ai-error")?.textContent.includes("Informe conteúdo")'),'empty input error');
 await edit('.ai-inner textarea','Descrição de teste');await generate({failure:'Falha simulada do transporte'});await waitFor(()=>run('document.querySelector(".ai-error")?.textContent.includes("Falha simulada")'),'generation error');
 await generate({slow:true});await click('.ai-actions button:nth-child(2)');await waitFor(()=>run('document.querySelector(".ai-error")?.textContent.includes("cancelada")'),'generation cancellation',10000);assert.equal(await run('!!document.querySelector(".ai-preview")'),false);
 await generate({long:true});await waitFor(()=>run('!!document.querySelector(".ai-preview")'),'description preview');await edit('.ai-preview > label input','Título revisado');await edit('.ai-preview article input','Seção revisada');await shot('previa-descricao');
 const longPreview=[];
 for(const [width,height] of [[800,600],[1440,900]]) {
  await mainRun(`${win}.setContentSize(${width},${height})`);await delay(200);
  for(const position of ['top','bottom']) {
   const geometry=await run(`(()=>{const s=document.querySelector('.ai-scroll');s.scrollTop=${position=='top'?'0':'s.scrollHeight'};const d=document.querySelector('.ai-dialog').getBoundingClientRect(),f=document.querySelector('.ai-apply').getBoundingClientRect(),r=s.getBoundingClientRect();return {top:d.top,bottom:d.bottom,height:innerHeight,buttonTop:f.top,buttonBottom:f.bottom,scrollBottom:r.bottom,scrollHeight:s.scrollHeight,clientHeight:s.clientHeight,hit:document.elementFromPoint(f.x+f.width/2,f.y+f.height/2)?.closest('button')===document.querySelector('.ai-apply')}})()`);
   assert.ok(geometry.scrollHeight>geometry.clientHeight*2,'long outline scrolls');
   assert.ok(geometry.top>=0&&geometry.bottom<=geometry.height&&geometry.buttonTop>=geometry.scrollBottom&&geometry.buttonBottom<=geometry.bottom&&geometry.hit,JSON.stringify(geometry));
   longPreview.push({width,height,position,...geometry});await shot(`long-preview-${width}-${position}`);
  }
 }
 const captured=await run('window.__aiCapture');assert.equal(captured.model,models[1].id);assert.ok(captured.prompt.includes('Descrição de teste'));
 const beforeNew=await disk();await click('.ai-apply');await waitFor(async()=>{const l=await disk();return l.projects.length===beforeNew.projects.length+1&&active(l).board.title==='Título revisado'},'new project application');
 let now=await disk();assert.equal(active(now).board.scenes[0].name,'Seção revisada');
 await open();await click('.ai-account button');await waitFor(()=>run('document.querySelectorAll(".ai-grid select")[1].options.length>1'),'text models',45000);
 await edit('.ai-grid select','text');await edit('.ai-inner textarea','Texto para apresentação');await edit('.ai-grid label:nth-child(9) select','append');await generate();await waitFor(()=>run('!!document.querySelector(".ai-preview")'),'text preview');
 const initialScenes=active(await disk()).board.scenes.length;await click('.ai-apply');await waitFor(async()=>active(await disk()).board.scenes.length===initialScenes+1,'append');
 await click('[title="Desfazer (Ctrl+Z)"]');await waitFor(async()=>active(await disk()).board.scenes.length===initialScenes,'undo append',20000);
 await open();await click('.ai-account button');await waitFor(()=>run('document.querySelectorAll(".ai-grid select")[1].options.length>1'),'rich models',45000);
 await edit('.ai-inner textarea','Fluxo fictício para teste');await generate({rich:true});await waitFor(()=>run('!!document.querySelector(".ai-visual svg")'),'rich visual preview');

 for(const [layout,detail] of [['flow','rich'],['map','rich'],['presentation','rich'],['flow','simple']]) {
   await edit('.ai-grid label:nth-child(6) select',layout); await edit('.ai-grid label:nth-child(7) select',detail); await delay(300);
   const preview=await run(`(()=>{const svg=document.querySelector('.ai-visual svg');return {items:svg.querySelectorAll('[data-item]').length, text:svg.textContent}})()`);
   assert.ok(preview.items>=12 && preview.text.includes('Sim') && preview.text.includes('Não'), JSON.stringify(preview));
   await run(`document.querySelector(".ai-visual").scrollIntoView({block:"center"});true`); await delay(250);
   await shot(`layout-${layout}-${detail}`);
 }
 await edit('.ai-grid label:nth-child(6) select','flow'); await edit('.ai-grid label:nth-child(7) select','rich');
 assert.ok(await run('document.querySelectorAll(".ai-visual [data-item]").length>=14')); await edit('.ai-preview article label:nth-of-type(3) textarea','Receber solicitação revisada');await shot('fluxo-rico-previa');
 const beforeRich=await disk();await click('.ai-apply');await waitFor(async()=>{const l=await disk();return l.projects.length===beforeRich.projects.length+1&&active(l).board.title==='Atendimento'},'rich application');
 const richBoard=active(await disk()).board, richItems=richBoard.scenes[0].items; assert.ok(richItems.some(x=>x.text==='Receber solicitação revisada')); assert.equal(richItems.filter(x=>x.type==='arrow').length,6); assert.ok(richItems.some(x=>x.type==='arrow'&&x.text==='Não'&&x.fromPort&&x.toPort)); assert.ok(richItems.some(x=>x.arrowMotion==='pulse')); assert.equal(richItems.filter(x=>x.type==='frame').length,2); assert.ok(new Set(richItems.map(x=>x.step)).size>=5);await shot('fluxo-rico-aplicado');
 await click('.present-button');
 if(await run('!!window.orquestraOperator')) { await waitFor(()=>run('!!document.querySelector(".operator-return")'),'operator opens'); await run('window.orquestraOperator.close()'); }
 await waitFor(()=>run('!!document.querySelector(".presenter-panel")'),'presenter panel');
 await run(`(()=>{document.querySelector('.presenter-panel.minimized [aria-label="Expandir console do apresentador"]')?.click();document.querySelector('.presenter-tools-toggle[aria-expanded="false"]')?.click();return true})()`);
 await click('.presenter-audience');
 const audience=expression=>mainRun(`(async()=>{const w=process.mainModule.require('electron').BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('audience'));if(!w)throw Error('Audience missing');return w.webContents.executeJavaScript(${JSON.stringify(expression)},true)})()`);
 await waitFor(()=>audience('!!document.querySelector(".audience-artwork")'),'rich audience',25000);
 const startId=richItems.find(x=>x.text==='Receber solicitação revisada').id, decisionId=richItems.find(x=>x.name==='Decisão').id;
 assert.equal(await audience(`!!document.querySelector('[data-item="${startId}"]')`),false);
 await click('.presenter-next');await waitFor(()=>audience(`!!document.querySelector('[data-item="${startId}"]')`),'first step');
 assert.equal(await audience(`!!document.querySelector('[data-item="${decisionId}"]')`),false);
 await click('.presenter-next');await waitFor(()=>audience(`!!document.querySelector('[data-item="${decisionId}"]')`),'decision step');
 await click('.presenter-next');await click('.presenter-next');await click('.presenter-next');
 await waitFor(()=>audience('!!document.querySelector(".arrow-motion-flow")'),'animated arrow in audience');
 await shot('fluxo-rico-apresentador');
 const audiencePng=await mainRun(`(async()=>{const w=process.mainModule.require('electron').BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('audience'));return (await w.webContents.capturePage()).toPNG().toString('base64')})()`);await writeFile(path.join(folder,'fluxo-rico-publico.png'),Buffer.from(audiencePng,'base64'));
 await click('.presenter-stop');

 const pdf=makeAcceptancePdf(),fixture=path.join(folder,'fixture-tres-paginas.pdf');await writeFile(fixture,pdf);
 await open();await click('.ai-account button');await waitFor(()=>run('document.querySelectorAll(".ai-grid select")[1].options.length>1'),'pdf models',45000);await edit('.ai-grid select','pdf');
 let doc=await cdp('DOM.getDocument');let input=await cdp('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'.ai-inner input[type=file]'});await cdp('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[fixture]});await edit('.ai-grid:nth-of-type(2) label:nth-child(2) input','4');await click('.ai-actions button');await waitFor(()=>run('document.querySelector(".ai-error")?.textContent.includes("3 páginas")'),'invalid PDF page');await edit('.ai-grid:nth-of-type(2) label:nth-child(2) input','3');
 await generate({pages:[3]});await waitFor(()=>run('!!document.querySelector(".ai-preview")'),'PDF preview',30000);assert.ok((await run('window.__aiCapture.prompt')).includes('Página 3:'));await shot('previa-pdf-pagina-3');
 // Inject one failure in the main-process IPC handler with the existing Inspector; restore immediately.
 await mainRun(`(()=>{const i=process.mainModule.require('electron').ipcMain;global.__aiOriginalSave=i._invokeHandlers.get('library:save');i._invokeHandlers.set('library:save',()=>{throw Error('Falha controlada de gravação')});return true})()`);
 const beforeFailure=await disk();const filesBefore=await readdir(path.join(profile,'media')).catch(()=>[]);
 await click('.ai-apply');await waitFor(()=>run('document.querySelector(".ai-error")?.textContent.includes("Falha controlada")'),'controlled rollback');
 await mainRun(`(()=>{const i=process.mainModule.require('electron').ipcMain;i._invokeHandlers.set('library:save',global.__aiOriginalSave);delete global.__aiOriginalSave;return true})()`);
 assert.deepEqual(await disk(),beforeFailure);assert.deepEqual((await readdir(path.join(profile,'media')).catch(()=>[])).sort(),filesBefore.sort());await shot('rollback-falha-controlada');
 await click('.ai-apply');await waitFor(async()=>{let l=await disk();return active(l).board.scenes[0].items.some(x=>x.pdfPage===3)},'PDF application');
 now=await disk();const item=active(now).board.scenes[0].items.find(x=>x.pdfPage===3);assert.deepEqual(await readFile(path.join(profile,'media',item.assetId+'.bin')),pdf);
 const openPdf=async()=>{await click(`[aria-label="Visualizar PDF ${path.basename(fixture)}"]`);try{await waitFor(()=>run('document.querySelector("[aria-label=\\"Página atual\\"]")?.value==="3" && document.querySelector("[data-pdf-page=\\"3\\"] canvas")?.dataset.rendered==="true"'),'PDF opens on page 3',30000)}catch(e){console.log('PDF diagnostics',await run(`({page:document.querySelector('.pdf-viewer-toolbar input')?.value,status:document.querySelector('.pdf-status')?.textContent,error:document.querySelector('.pdf-error')?.textContent,rendered:document.querySelector('[data-pdf-page="3"] canvas')?.dataset.rendered,scroll:document.querySelector('.pdf-viewer-scroller')?.scrollTop})`));await shot('pdf-debug');throw e}await delay(700);assert.equal(await run('document.querySelector("[aria-label=\\"Página atual\\"]").value'),'3')};
 await openPdf();await shot('pdf-pagina-3');await click('[aria-label="Fechar PDF"]');await run('window.__aiReload=true');await cdp('Page.reload');await waitFor(()=>run('!window.__aiReload && !!document.querySelector(".document-title")'),'reload');await waitFor(()=>run(`!!document.querySelector(${JSON.stringify(`[aria-label="Visualizar PDF ${path.basename(fixture)}"]`)})`),'PDF card after reload',20000);await openPdf();await shot('pdf-pagina-3-apos-reload');
 await cdp('Debugger.removeBreakpoint',{breakpointId:breakpoint});
 return {richFixture:true,richNodesEdited:true,richEdges:6,richGroups:2,richPresenterAndAudience:true,longPreview,realDisconnected:true,models,selectedModel:models[1].id,simulation:'CDP renderer closure substitutes aiGenerate only; no real inference or login',descriptionEditedNewProject:true,textAppendUndo:true,pdfPage:3,pdfOriginalBytes:true,pdfViewerReload:true,controlledSaveFailureRollback:true,invalidPdfPage:true,emptyInputError:true,simulatedTransportError:true,cancel:true,layouts,screenshots:folder};
}
