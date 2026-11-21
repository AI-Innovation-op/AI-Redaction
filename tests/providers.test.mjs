import test from 'node:test';import assert from 'node:assert/strict';
import {reviewWithAI,aiConfiguration} from '../lib/ai.mjs';import {normalizeSettings} from '../lib/review.mjs';
const settings=normalizeSettings({rubric:[{name:'Análisis',max:5}]});
const review={summary:'Lectura orientativa',strengths:['Caso delimitado'],criteria:[{id:'0',score:3,reason:'Conecta dos ideas',quote:'Texto real',suggestion:'Añadir evidencia'}],priorities:[],limitations:['Prueba simulada']};
async function providerEnv(provider,fn){const keys=['AI_PROVIDER','OPENROUTER_API_KEY','GEMINI_API_KEY','OPENAI_API_KEY'];const old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));try{for(const k of keys)delete process.env[k];process.env.AI_PROVIDER=provider;process.env[provider==='openrouter'?'OPENROUTER_API_KEY':'GEMINI_API_KEY']='credencial-ficticia-test';await fn();}finally{for(const k of keys)if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}}
test('OpenRouter usa esquema estricto y devuelve un informe con evidencia',async()=>providerEnv('openrouter',async()=>{
 const r=await reviewWithAI('Texto real',settings,{fetchImpl:async(url,request)=>{assert.equal(url,'https://openrouter.ai/api/v1/chat/completions');const p=JSON.parse(request.body);assert.equal(p.provider.data_collection,'deny');assert.equal(p.response_format.json_schema.strict,true);return {ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify(review)}}]})};}});assert.equal(r.total,3);assert.equal(r.provider,'OpenRouter');
}));
test('Gemini usa Interactions sin almacenamiento y lee los bloques finales',async()=>providerEnv('gemini',async()=>{
 const r=await reviewWithAI('Texto real',settings,{fetchImpl:async(url,request)=>{assert.match(url,/\/interactions$/);assert.equal(JSON.parse(request.body).store,false);return {ok:true,json:async()=>({status:'completed',steps:[{type:'model_output',content:[{type:'text',text:JSON.stringify(review)}]}]})};}});assert.equal(r.total,3);assert.equal(r.provider,'Gemini');
}));
test('OpenRouter no convierte un fallo de saldo en una revisión aprobada',async()=>providerEnv('openrouter',async()=>{
 await assert.rejects(reviewWithAI('Texto real',settings,{fetchImpl:async()=>({ok:false,status:402,json:async()=>({error:{message:'detail'}})})}),/saldo/);
 await assert.rejects(reviewWithAI('Texto real',settings,{fetchImpl:async()=>({ok:true,json:async()=>({choices:[{finish_reason:'length',message:{content:'{}'}}]})})}),/incompleta/);
}));
test('la configuración pública no incluye la API key',async()=>providerEnv('openrouter',async()=>{const c=aiConfiguration();assert.equal(c.aiConfigured,true);assert.ok(!JSON.stringify(c).includes('credencial-ficticia-test'));}));
