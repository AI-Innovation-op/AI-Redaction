import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const base=process.env.MARGEN_URL||'http://127.0.0.1:4317';
const config=await (await fetch(base+'/api/config')).json();
const post=async(route,data)=>{const r=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json','X-Margen-Token':config.token},body:JSON.stringify(data)});const v=await r.json();if(!r.ok)throw new Error(v.error);return v;};
const args=process.argv.slice(2);
const text=process.env.MARGEN_ESSAY?await fs.readFile(process.env.MARGEN_ESSAY,'utf8'):`Introducción

Este ejemplo ficticio permite comprobar la lectura de citas y referencias. Bauman (2003), Giddens (2011), Baudrillard (1978), Elliott (2019), Pérez (2020) y Rojas (2021) aparecen únicamente como datos de prueba. La comprobación de la aplicación busca correspondencias entre apellidos y años; no establece que una fuente respalde una afirmación ni que una referencia exista. La evaluación académica exige leer el argumento, contrastar la evidencia y reconocer sus límites. Un conteo correcto ayuda a revisar la forma del documento, pero no puede sustituir esa lectura. Por ese motivo, el ejemplo distingue las reglas que puede aplicar el programa de las decisiones que requieren el juicio del revisor.

Referencias

Bauman, Z. (2003). Entrada de prueba.

Giddens, A. (2011). Entrada de prueba.

Baudrillard, J. (1978). Entrada de prueba.

Elliott, A. (2019). Entrada de prueba.

Pérez, A. (2020). Entrada ficticia de prueba.

Rojas, B. (2021). Entrada ficticia de prueba.`;
const local=await post('analyze',{text,settings:{wordTarget:5000,wordMode:'reference'}});
assert.equal(local.citations.missing.length,0);assert.equal(local.citations.entries.length,6);assert.ok(local.counts.body>100);assert.equal(local.lengthStatus,'reference');
const sources=await post('analyze',{text,settings:{},sources:[{name:'Mismo texto',text}]});assert.equal(sources.local.stats.overallPercent,100);
const forbidden=await fetch(base+'/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text})});assert.equal(forbidden.status,403);
console.log(JSON.stringify({localBodyWords:local.counts.body,citations:local.citations.citations.length,referenceEntries:local.citations.entries.length,identicalSourceSimilarity:sources.local.stats.overallPercent,requestWithoutToken:forbidden.status,aiConfigured:config.aiConfigured}));
for(const file of args){
 const raw=await fs.readFile(file);const name=file.replaceAll('\\','/').split('/').at(-1);const extracted=await post('extract',{name,data:raw.toString('base64')});assert.ok(extracted.text.length>100);
 const result=await post('report',{text:extracted.text});
 console.log(JSON.stringify({file:name,extractedChars:extracted.text.length,ai:result.ai?.label??null,similarity:result.similarity?.label??null}));
}
console.log('Prueba HTTP completa. No se enviaron documentos a servicios externos.');
