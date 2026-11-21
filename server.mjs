import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {reviewDocument,normalizeSettings,detectorReport,DEFAULT_RUBRIC,splitDocument} from './lib/review.mjs';
import {reviewWithAI} from './lib/ai.mjs';
import {checkPlagiarism} from './vendor/free-turnitin/server/plagiarism.js';
const ROOT=path.dirname(fileURLToPath(import.meta.url));
// Local optional configuration. Secrets are never returned to the browser.
try{const env=await readFile(path.join(ROOT,'.env'),'utf8');for(const line of env.split(/\r?\n/)){const m=line.match(/^([A-Z_]+)=(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,'');}}catch{}
let runtime={};try{runtime=JSON.parse(await readFile(path.join(ROOT,'.runtime.json'),'utf8'));}catch{}
const PYTHON=process.env.MARGEN_PYTHON||runtime.python||'python';
const PORT=Number(process.env.PORT||4317);
const ORIGIN=`http://127.0.0.1:${PORT}`;
const TOKEN=randomBytes(24).toString('hex');
let busy=0;
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
async function body(req){
 let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>18000000)throw new Error('La solicitud supera el tamaño permitido.');chunks.push(c);}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new Error('La solicitud no contiene JSON válido.');}
}
function validateSources(sources=[]){
 if(!Array.isArray(sources)||sources.length>8)throw new Error('Puedes comparar hasta ocho fuentes por revisión.');
 if(sources.some(s=>typeof s?.text!=='string'||s.text.length>180000))throw new Error('Una fuente supera el límite permitido.');
 return sources;
}
async function extract(payload){
 if(typeof payload.name!=='string'||typeof payload.data!=='string'||payload.data.length>16000000)throw new Error('Selecciona un archivo válido de hasta 12 MB.');
 return new Promise((resolve,reject)=>{
  const child=spawn(PYTHON,[path.join(ROOT,'extract.py')],{windowsHide:true,stdio:['pipe','pipe','pipe']});
  let output='';const timer=setTimeout(()=>{child.kill();reject(new Error('La extracción excedió el tiempo permitido.'));},40000);
  child.stdout.on('data',c=>{output+=c;if(output.length>2000000)child.kill();});
  child.stderr.resume();
  child.on('error',()=>{clearTimeout(timer);reject(new Error('No se pudo iniciar Python. Ejecuta Iniciar.ps1 o configura MARGEN_PYTHON.'));});
  child.on('close',()=>{clearTimeout(timer);try{const result=JSON.parse(output);if(result.error)reject(new Error(result.error));else resolve(result);}catch{reject(new Error('No se pudo leer el archivo. Comprueba el formato y las dependencias Python.'));}});
  child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify(payload));
 });
}
const STATIC=new Map([['/','index.html'],['/app.js','app.js'],['/styles.css','styles.css']]);
const server=http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
 const host=req.headers.host;
 if(![`127.0.0.1:${PORT}`,`localhost:${PORT}`].includes(host))return json(res,403,{error:'Acceso local requerido.'});
 const url=new URL(req.url,ORIGIN);
 try{
  if(req.method==='GET'&&STATIC.has(url.pathname)){
   const f=STATIC.get(url.pathname);const data=await readFile(path.join(ROOT,'public',f));
   res.writeHead(200,{'Content-Type':f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8','Cache-Control':'no-store'});res.end(data);return;
  }
  if(req.method==='GET'&&url.pathname==='/api/config')return json(res,200,{token:TOKEN,aiConfigured:!!process.env.OPENAI_API_KEY,model:process.env.OPENAI_MODEL||'gpt-6.2-astra',rubric:DEFAULT_RUBRIC});
  if(req.method==='GET'&&url.pathname==='/api/health')return json(res,200,{ok:true,app:'Margen',version:'1.0.0'});
  if(req.method!=='POST')return json(res,404,{error:'Ruta no disponible.'});
  if(req.headers['x-margen-token']!==TOKEN)return json(res,403,{error:'Actualiza la página para iniciar una sesión local.'});
  if(req.headers.origin&&![ORIGIN,`http://localhost:${PORT}`].includes(req.headers.origin))return json(res,403,{error:'Origen no permitido.'});
  if(!String(req.headers['content-type']).includes('application/json'))return json(res,415,{error:'Se requiere JSON.'});
  if(busy>=2)return json(res,429,{error:'Hay dos revisiones en curso. Espera a que terminen.'});
  const data=await body(req);busy++;
  try{
   if(url.pathname==='/api/extract')return json(res,200,await extract(data));
   if(url.pathname==='/api/analyze')return json(res,200,reviewDocument(data.text,data.settings,validateSources(data.sources)));
   if(url.pathname==='/api/report')return json(res,200,detectorReport(String(data.text??'').slice(0,180000)));
   if(url.pathname==='/api/ai'){
    const local=reviewDocument(data.text,data.settings);
    if(data.consent!==true)throw new Error('Confirma el envío del texto a OpenAI en la pantalla de revisión.');
    return json(res,200,await reviewWithAI(data.text,local.settings));
   }
   if(url.pathname==='/api/web'){
    const settings=normalizeSettings(data.settings);reviewDocument(data.text,settings);
    if(data.consent!==true)throw new Error('Activa el permiso para enviar fragmentos a los buscadores.');
    const controller=new AbortController();res.on('close',()=>controller.abort());
    res.writeHead(200,{'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-store'});
    const send=v=>{if(!res.destroyed)res.write(JSON.stringify(v)+'\n');};
    try{
     const result=await checkPlagiarism(splitDocument(data.text).body,{excludeQuotes:settings.excludeQuotes,maxQueries:12,maxFetches:25,timeBudgetMs:45000,signal:AbortSignal.any([controller.signal,AbortSignal.timeout(55000)]),onProgress:p=>send({type:'progress',percent:p.percent,completed:p.completed,total:p.total})});
     send({type:'result',result});
    }catch{send({type:'error',error:'La búsqueda no terminó o fue cancelada. No se puede interpretar como 0 %.'});}
    res.end();return;
   }
   return json(res,404,{error:'Ruta no disponible.'});
  }finally{busy--;}
 }catch(error){if(!res.headersSent)json(res,400,{error:error.message||'No se pudo completar la revisión.'});else res.end();}
});
server.listen(PORT,'127.0.0.1',()=>console.log(`Margen disponible en ${ORIGIN}`));
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?`El puerto ${PORT} ya está ocupado. Cambia PORT o abre la app existente.`:e.message);process.exitCode=1;});
