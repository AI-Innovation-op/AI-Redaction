import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {reviewDocument,normalizeSettings,detectorReport,DEFAULT_RUBRIC,splitDocument} from './lib/review.mjs';
import {reviewWithAI,aiConfiguration} from './lib/ai.mjs';
import {createAccess,createLimiter} from './lib/access.mjs';
import {checkPlagiarism} from './vendor/free-turnitin/server/plagiarism.js';
const ROOT=path.dirname(fileURLToPath(import.meta.url));
try{const env=await readFile(path.join(ROOT,'.env'),'utf8');for(const line of env.split(/\r?\n/)){const m=line.match(/^([A-Z_]+)=(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,'');}}catch{}
let runtime={};try{runtime=JSON.parse(await readFile(path.join(ROOT,'.runtime.json'),'utf8'));}catch{}
const PYTHON=process.env.APP_PYTHON||process.env.MARGEN_PYTHON||runtime.python||(process.platform==='win32'?'python':'python3');
const PORT=Number(process.env.PORT||4317),HOST=process.env.HOST||(process.env.NODE_ENV==='production'?'0.0.0.0':'127.0.0.1');
const PUBLIC_ORIGIN=new URL(process.env.APP_ORIGIN||process.env.RENDER_EXTERNAL_URL||`http://127.0.0.1:${PORT}`).origin;
const origins=new Set([PUBLIC_ORIGIN,...(process.env.NODE_ENV==='production'?[]:[`http://localhost:${PORT}`,`http://127.0.0.1:${PORT}`])]);
const hosts=new Set([...origins].map(o=>new URL(o).host));
const access=createAccess({hash:process.env.APP_PASSWORD_HASH,secure:PUBLIC_ORIGIN.startsWith('https:'),required:process.env.NODE_ENV==='production'});
const expensiveLimit=createLimiter({limit:6,windowMs:10*60*1000});
let busy=0,shuttingDown=false;
const tasks=new Set();
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
async function body(req){
 let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>18000000){const e=new Error('El archivo supera el tamaño permitido.');e.status=413;throw e;}chunks.push(c);}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new Error('La solicitud no contiene JSON válido.');}
}
function validateSources(sources=[]){
 if(!Array.isArray(sources)||sources.length>8)throw new Error('Puedes comparar hasta ocho fuentes por revisión.');
 if(sources.some(s=>typeof s?.text!=='string'||s.text.length>180000))throw new Error('Una fuente supera el límite permitido.');return sources;
}
async function extract(payload){
 if(typeof payload.name!=='string'||typeof payload.data!=='string'||payload.data.length>16000000)throw new Error('Selecciona un archivo válido de hasta 12 MB.');
 return new Promise((resolve,reject)=>{
  const child=spawn(PYTHON,[path.join(ROOT,'extract.py')],{windowsHide:true,stdio:['pipe','pipe','pipe']});tasks.add(child);
  let output='';const timer=setTimeout(()=>{child.kill();reject(new Error('La lectura del archivo excedió el tiempo permitido.'));},40000);
  child.stdout.on('data',c=>{output+=c;if(output.length>2000000)child.kill();});child.stderr.resume();
  child.on('error',()=>{clearTimeout(timer);tasks.delete(child);reject(new Error('No se pudo iniciar el lector de archivos. Revisa la configuración Python.'));});
  child.on('close',()=>{clearTimeout(timer);tasks.delete(child);try{const result=JSON.parse(output);if(result.error)reject(new Error(result.error));else resolve(result);}catch{reject(new Error('No se pudo leer el archivo. Comprueba su formato.'));}});
  child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify(payload));
 });
}
const STATIC=new Map([['/','index.html'],['/app.js','app.js'],['/styles.css','styles.css']]);
export const server=http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Cache-Control','no-store');
 res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
 if(PUBLIC_ORIGIN.startsWith('https:'))res.setHeader('Strict-Transport-Security','max-age=31536000');
 let url;try{url=new URL(req.url,PUBLIC_ORIGIN);}catch{return json(res,400,{error:'Dirección no válida.'});}
 if(req.method==='GET'&&url.pathname==='/api/health')return json(res,shuttingDown?503:200,{ok:!shuttingDown,app:'AI Redaction',version:'0.5.0'});
 if(!hosts.has(req.headers.host))return json(res,403,{error:'Dominio no permitido.'});
 if(req.headers.origin&&!origins.has(req.headers.origin))return json(res,403,{error:'Origen no permitido.'});
 try{
  if(req.method==='GET'&&STATIC.has(url.pathname)){
   const f=STATIC.get(url.pathname);res.writeHead(200,{'Content-Type':f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8'});res.end(await readFile(path.join(ROOT,'public',f)));return;
  }
  const session=access.session(req);
  if(req.method==='GET'&&url.pathname==='/api/session')return json(res,200,{required:access.required,authenticated:!!session});
  if(req.method==='POST'&&url.pathname==='/api/login'){
   if(!String(req.headers['content-type']).includes('application/json'))return json(res,415,{error:'Se requiere JSON.'});
   const loginData=await body(req);await access.login(req,res,loginData.password);return json(res,200,{ok:true});
  }
  if(!session)return json(res,401,{error:'Ingresa tu clave de acceso para continuar.'});
  if(req.method==='GET'&&url.pathname==='/api/config')return json(res,200,{token:session.token,...aiConfiguration(),accessRequired:access.required,rubric:DEFAULT_RUBRIC,version:'0.5.0'});
  if(req.method!=='POST')return json(res,404,{error:'Ruta no disponible.'});
  if(!access.validToken(session,req.headers['x-ai-redaction-token']))return json(res,403,{error:'La sesión cambió. Vuelve a abrir la página.'});
  if(!String(req.headers['content-type']).includes('application/json'))return json(res,415,{error:'Se requiere JSON.'});
  if(url.pathname==='/api/logout'){access.logout(req,res);return json(res,200,{ok:true});}
  if(shuttingDown||busy>=2)return json(res,429,{error:'Estamos terminando otra revisión. Espera un momento y vuelve a intentar.'});
  if(['/api/ai','/api/web'].includes(url.pathname)&&!expensiveLimit(session.id||'local'))return json(res,429,{error:'Puedes solicitar seis revisiones con IA o web cada diez minutos. Espera un momento.'});
  busy++;
  try{
   const data=await body(req);
   if(url.pathname==='/api/extract')return json(res,200,await extract(data));
   if(url.pathname==='/api/analyze')return json(res,200,reviewDocument(data.text,data.settings,validateSources(data.sources)));
   if(url.pathname==='/api/report')return json(res,200,detectorReport(String(data.text??'').slice(0,180000)));
   if(url.pathname==='/api/ai'){
    const local=reviewDocument(data.text,data.settings);
    if(data.consent!==true)throw new Error('Activa el permiso de revisión con IA para continuar.');
    const controller=new AbortController();res.on('close',()=>controller.abort());tasks.add(controller);
    try{return json(res,200,await reviewWithAI(data.text,local.settings,{signal:controller.signal}));}finally{tasks.delete(controller);}
   }
   if(url.pathname==='/api/web'){
    const settings=normalizeSettings(data.settings);reviewDocument(data.text,settings);
    if(data.consent!==true)throw new Error('Activa el permiso de búsqueda web para continuar.');
    const controller=new AbortController();res.on('close',()=>controller.abort());tasks.add(controller);
    res.writeHead(200,{'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-store','X-Accel-Buffering':'no'});
    const send=v=>{if(!res.destroyed)res.write(JSON.stringify(v)+'\n');};
    try{
     const result=await checkPlagiarism(splitDocument(data.text).body,{excludeQuotes:settings.excludeQuotes,maxQueries:12,maxFetches:25,timeBudgetMs:45000,signal:AbortSignal.any([controller.signal,AbortSignal.timeout(55000)]),onProgress:p=>send({type:'progress',percent:p.percent})});send({type:'result',result});
    }catch{send({type:'error',error:'La búsqueda no terminó o fue cancelada. No se puede interpretar como 0 %.'});}finally{tasks.delete(controller);}
    res.end();return;
   }
   return json(res,404,{error:'Ruta no disponible.'});
  }finally{busy--;}
 }catch(error){if(!res.headersSent)json(res,error.status||400,{error:error.name==='TimeoutError'?'La revisión tardó demasiado. Vuelve a intentar.':error.message||'No se pudo completar la revisión.'});else res.end();}
});
server.requestTimeout=60000;server.headersTimeout=15000;server.keepAliveTimeout=5000;
server.listen(PORT,HOST,()=>console.log(`AI Redaction v0.5 disponible en ${PUBLIC_ORIGIN}`));
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?`El puerto ${PORT} ya está ocupado.`:e.message);process.exitCode=1;});
function stop(){if(shuttingDown)return;shuttingDown=true;for(const task of tasks){if(task.abort)task.abort();else task.kill();}server.close(()=>process.exit(0));server.closeIdleConnections();setTimeout(()=>process.exit(0),20000).unref();}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
