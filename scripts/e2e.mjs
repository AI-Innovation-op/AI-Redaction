import {spawn} from 'node:child_process';import {readFile} from 'node:fs/promises';import assert from 'node:assert/strict';import {passwordHash} from '../lib/access.mjs';
const external=process.env.TEST_BASE_URL;const port=process.env.TEST_PORT||String(14000+Math.floor(Math.random()*1000));const base=external||`http://127.0.0.1:${port}`;
const password=process.env.TEST_ACCESS_FILE?JSON.parse(await readFile(process.env.TEST_ACCESS_FILE,'utf8')).password:'clave-ficticia-prueba-completa';
let child;
if(!external){child=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:port,NODE_ENV:'production',APP_ORIGIN:base,APP_PASSWORD_HASH:await passwordHash(password),AI_PROVIDER:'openai',OPENAI_API_KEY:'',HOST:'127.0.0.1'},windowsHide:true,stdio:'ignore'});}
let cookie='',token='';
async function post(route,data,{authenticated=true}={}){
 const res=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json',Origin:base,...(authenticated?{Cookie:cookie,'X-AI-Redaction-Token':token}:{})},body:JSON.stringify(data)});return {res,data:await res.json()};
}
try{
 for(let i=0;i<80;i++){try{const h=await fetch(base+'/api/health');if(h.ok)break;}catch{}if(i===79)throw new Error('El servidor no inició.');await new Promise(r=>setTimeout(r,250));}
 const health=await (await fetch(base+'/api/health')).json();assert.equal(health.version,'0.5.0');
 assert.equal((await fetch(base+'/api/config')).status,401);
 const incorrect=await post('login',{password:'incorrecta'},{authenticated:false});assert.equal(incorrect.res.status,401);
 const login=await post('login',{password},{authenticated:false});assert.equal(login.res.status,200);cookie=login.res.headers.get('set-cookie').split(';')[0];assert.match(login.res.headers.get('set-cookie'),/HttpOnly/);
 const config=await (await fetch(base+'/api/config',{headers:{Cookie:cookie}})).json();token=config.token;assert.equal(config.version,'0.5.0');assert.ok(!JSON.stringify(config).includes('sk-or-'));
 const badOrigin=await fetch(base+'/api/analyze',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://otro.example',Cookie:cookie,'X-AI-Redaction-Token':token},body:JSON.stringify({text:'Hola'})});assert.equal(badOrigin.status,403);
 const input='Introducción\n\nBauman (2003) permite preguntar por la duración de los vínculos y por los compromisos compartidos.\n\nConclusiones\n\nEl ejemplo necesita evidencia adicional.\n\nReferencias\n\nBauman, Z. (2003). Modernidad líquida. Fondo de Cultura Económica.';
 const extracted=await post('extract',{name:'ejemplo.txt',data:Buffer.from(input).toString('base64')});assert.equal(extracted.res.status,200);assert.equal(extracted.data.text,input);
 const result=await post('analyze',{text:input,settings:{wordTarget:5000,wordMode:'reference'},sources:[{name:'Fuente sintética',text:input}]});assert.equal(result.res.status,200);assert.equal(result.data.citations.missing.length,0);assert.equal(result.data.local.stats.overallPercent,100);
 const report=await post('report',{text:'8% Similitud general'});assert.equal(report.data.similarity.value,8);assert.equal(report.data.ai,null);
 const noConsent=await post('ai',{text:input,settings:{}});assert.equal(noConsent.res.status,400);
 if(process.env.TEST_DOCUMENT){const raw=await readFile(process.env.TEST_DOCUMENT);const doc=await post('extract',{name:process.env.TEST_DOCUMENT.replaceAll('\\','/').split('/').at(-1),data:raw.toString('base64')});assert.equal(doc.res.status,200);assert.ok(doc.data.text.length>100);console.log('Carga de documento real: correcta.');}
 const logout=await post('logout',{});assert.equal(logout.res.status,200);assert.equal((await fetch(base+'/api/config',{headers:{Cookie:cookie}})).status,401);
 console.log(JSON.stringify({version:health.version,privateLogin:true,cookieProtected:true,originProtected:true,extraction:true,citations:true,comparison:true,logout:true,aiConfigured:config.aiConfigured}));
}finally{if(child){child.kill();}}
