const test = require('node:test');
const assert = require('node:assert/strict');
const { AiClient } = require('../desktop/ai.cjs');
function client() { const c = new AiClient('unused'); const sent=[]; c.child={stdin:{write:s=>sent.push(JSON.parse(s))}}; return {c,sent}; }
test('nega requisições do servidor e invalida turno com ferramenta', async () => {
 const {c,sent}=client(); let rejected; const result=new Promise((_,reject)=>{rejected=reject});result.catch(()=>{});
 c.rpc=async(method)=>{ assert.equal(method,'turn/interrupt'); };
 c.active={threadId:'t',turnId:'u',reject:rejected,timer:setTimeout(()=>{},10000)};
 c.onLine(JSON.stringify({id:42,method:'item/commandExecution/requestApproval',params:{}}));
 await assert.rejects(result,/cancelada/);assert.equal(sent[0].error.code,-32601);
});
test('somente turno concluído entrega JSON, ferramenta invalida resultado', async () => {
 const {c}=client(); let resolve,reject;const result=new Promise((a,b)=>{resolve=a;reject=b});
 c.active={threadId:'t',turnId:'u',resolve,reject,timer:setTimeout(()=>{},10000)};
 c.onLine(JSON.stringify({method:'item/completed',params:{item:{type:'agentMessage',text:'{"title":"A"}'}}}));
 c.onLine(JSON.stringify({method:'turn/completed',params:{threadId:'t',turn:{status:'completed'}}}));
 assert.deepEqual(await result,{title:'A'});
});
test('cancelamento durante início aguarda identificador e interrompe', async () => {
 const {c}=client();let reject;const result=new Promise((_,b)=>reject=b);result.catch(()=>{});let interrupted=false;
 c.rpc=async()=>{interrupted=true};c.active={threadId:'t',turnId:null,reject,timer:setTimeout(()=>{},10000)};
 await c.cancel();assert.equal(interrupted,false);assert.equal(c.active.cancelRequested,true);
 c.active.turnId='u';await c.cancel();assert.equal(interrupted,true);await assert.rejects(result,/cancelada/);
});
test('geração usa schema e sandbox e só entrega após evento concluído', async () => {
 const {c}=client();c.cwd='C:/temporary';c.start=async()=>{};const calls=[];
 c.rpc=async(method,params)=>{calls.push({method,params});if(method==='thread/start')return {thread:{id:'t'}};if(method==='turn/start'){setImmediate(()=>{c.onLine(JSON.stringify({method:'item/completed',params:{item:{type:'agentMessage',text:'{"title":"Quadro","sections":[]}'}}}));c.onLine(JSON.stringify({method:'turn/completed',params:{threadId:'t',turn:{status:'completed'}}}));});return {turn:{id:'u'}};}throw Error(method);};
 const output=await c.generate('Um roteiro','modelo');assert.equal(output.title,'Quadro');assert.equal(calls[0].params.sandbox,'read-only');assert.deepEqual(calls[1].params.sandboxPolicy,{type:'readOnly',networkAccess:false});assert.equal(calls[1].params.outputSchema.additionalProperties,false);
});
test('recusa chamada de ferramenta no evento bruto', async () => {
 const {c}=client();let reject;const result=new Promise((_,b)=>reject=b);result.catch(()=>{});c.rpc=async()=>{};c.active={threadId:'t',turnId:'u',reject,timer:setTimeout(()=>{},10000)};
 c.onLine(JSON.stringify({method:'rawResponseItem/completed',params:{item:{type:'function_call'}}}));await assert.rejects(result,/cancelada/);
});

test('cancelamento durante thread/start impede iniciar turno e geração concorrente', async () => {
 const {c}=client();c.start=async()=>{};let release;let began;
 const entered=new Promise(resolve=>began=resolve);
 c.rpc=async(method)=>{assert.equal(method,'thread/start');began();return new Promise(resolve=>release=resolve)};
 const generation=c.generate('Roteiro','modelo');
 await entered;
 await assert.rejects(c.generate('Outro','modelo'),/andamento/);
 await c.cancel();release({thread:{id:'cancelled'}});
 await assert.rejects(generation,/cancelada/);
 assert.equal(c.active,null);
});
