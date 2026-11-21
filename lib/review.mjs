import {tokenizeDocument,buildDocIndex,tokenizeSource,findSourceRuns,resolveSpans} from '../vendor/free-turnitin/shared/similarity.js';

export const DEFAULT_RUBRIC=[
 {id:'intro',name:'Introducción',max:3,description:'Presenta el problema, delimita el caso y formula una tesis.'},
 {id:'argument',name:'Desarrollo argumentativo',max:6,description:'Relaciona las teorías, sostiene argumentos y examina objeciones.'},
 {id:'analysis',name:'Análisis aplicado',max:5,description:'Aplica conceptos a casos concretos con evidencia y límites explícitos.'},
 {id:'conclusions',name:'Conclusiones',max:3,description:'Responde a la pregunta inicial y sintetiza lo demostrado.'},
 {id:'references',name:'Referencias',max:3,description:'Conecta citas y referencias y permite localizar las fuentes.'}
];
export const normalized=s=>String(s).normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
export const words=s=>[...String(s).replace(/https?:\/\/\S+/g,' ').matchAll(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)].map(m=>m[0]);
export function paragraphs(text){
 const result=[]; let id=0;
 for(const m of text.matchAll(/[^\n]+/g)) if(m[0].trim()){
  const leading=m[0].length-m[0].trimStart().length;
  result.push({id:++id,text:m[0].trim(),start:m.index+leading,end:m.index+m[0].trimEnd().length});
 }
 return result;
}
function heading(text){
 const n=normalized(text).replace(/^\s*(?:\d+[.)]?\s*)+/,'').replace(/[:.\s]+$/,'').trim();
 if(n.length>65)return null;
 if(/^(referencias(?: bibliograficas)?|bibliografia|fuentes consultadas)$/.test(n))return 'references';
 if(/^(anexos?|apendices?)\b/.test(n))return 'annexes';
 if(/^(introduccion|presentacion)$/.test(n))return 'intro';
 if(/^(desarrollo(?: argumentativo)?|marco teorico|argumentacion)$/.test(n))return 'argument';
 if(/^(analisis(?: aplicado)?|discusion|aplicacion(?: al caso)?)$/.test(n))return 'analysis';
 if(/^conclusiones?$/.test(n))return 'conclusions';
 return null;
}
export function splitDocument(text){
 const ps=paragraphs(text); const sections=ps.filter(p=>heading(p.text)).map(p=>({...p,kind:heading(p.text)}));
 const boundary=sections.find(p=>['references','annexes'].includes(p.kind));
 const end=boundary?.start??text.length;
 const ref=sections.find(p=>p.kind==='references');
 const next=ref?sections.find(p=>p.start>ref.start&&p.kind==='annexes'):null;
 const refs=ref?ps.filter(p=>p.start>ref.start&&p.start<(next?.start??text.length)):[];
 const body=text.slice(0,end).trimEnd();
 return {ps,sections,body,refs,bodyEnd:end};
}
export function normalizeSettings(input={}){
 const limit=Number(input.wordTarget??5000);
 if(!Number.isInteger(limit)||limit<1||limit>100000)throw new Error('La extensión debe estar entre 1 y 100 000 palabras.');
 const wordMode=['reference','min','max'].includes(input.wordMode)?input.wordMode:'reference';
 const rubric=(input.rubric??DEFAULT_RUBRIC).map((r,i)=>({id:String(i),name:String(r.name??'').slice(0,100),description:String(r.description??'').slice(0,1200),max:Number(r.max)}));
 if(!rubric.length||rubric.length>12||rubric.some(r=>!r.name||!Number.isFinite(r.max)||r.max<=0||r.max>100))throw new Error('Revisa los nombres y puntajes de la rúbrica.');
 return {wordTarget:limit,wordMode,excludeQuotes:input.excludeQuotes===true,rubric};
}
function citationAudit(body,refs){
 const citations=[];const seen=new Set();
 // This checks common author-year forms, not every APA variant.
 const re=/\b([\p{Lu}][\p{L}’'-]+)(?:\s+(?:et\s+al\.|y|&)\s*[\p{L}’'-]*)?\s*(?:\(\s*((?:19|20)\d{2}[a-z]?)\s*\)|,\s*((?:19|20)\d{2}[a-z]?))/gu;
 for(const m of body.matchAll(re)){
  const author=m[1],year=m[2]??m[3],key=normalized(author)+'|'+year;
  if(seen.has(key))continue;seen.add(key);
  const found=refs.some(r=>new RegExp('(?:^|[^a-z])'+normalized(author)+'(?:[^a-z]|$)').test(normalized(r.text))&&r.text.includes(year));
  citations.push({author,year,found,quote:m[0],offset:m.index});
 }
 const entries=refs.map(r=>{
  const author=r.text.match(/^([\p{L}’'-]+)/u)?.[1]??'';
  const year=r.text.match(/\b((?:19|20)\d{2}[a-z]?)\b/)?.[1]??'';
  return {...r,author,year,cited:citations.some(c=>normalized(c.author)===normalized(author)&&c.year===year)};
 });
 return {citations,entries,missing:citations.filter(c=>!c.found),uncited:entries.filter(e=>e.author&&e.year&&!e.cited),scope:'Comprobación orientativa de formas autor-año habituales. No verifica la existencia ni el contenido de las fuentes.'};
}
export function compareLocal(text,sources,excludeQuotes=false){
 const doc=tokenizeDocument(text,{excludeQuotes});const index=buildDocIndex(doc);
 const entries=sources.map((s,i)=>({key:String(i),title:String(s.name??`Fuente ${i+1}`),runs:findSourceRuns(doc,index,tokenizeSource(String(s.text??''),doc),{maxGap:0})}));
 const resolved=resolveSpans(doc,entries);
 return {...resolved,compared:sources.length,scope:'Comparación local de secuencias de al menos 7 palabras. Se ignoran mayúsculas, tildes y puntuación. Cada palabra coincidente cuenta una sola vez. El porcentaje no determina plagio.'};
}
export function reviewDocument(text,input={},sources=[]){
 if(typeof text!=='string'||!text.trim())throw new Error('Carga un documento o pega el texto para revisarlo.');
 if(text.length>180000)throw new Error('El límite de esta versión es 180 000 caracteres por documento.');
 const settings=normalizeSettings(input);const d=splitDocument(text);const count=words(d.body).length,total=words(text).length;
 const audit=citationAudit(d.body,d.refs);const findings=[];
 const add=(kind,title,detail,p,quote)=>findings.push({kind,title,detail,paragraph:p?.id??null,quote:quote??p?.text??''});
 let lengthStatus='reference';
 if(settings.wordMode==='min')lengthStatus=count<settings.wordTarget?'short':'met';
 if(settings.wordMode==='max')lengthStatus=count>settings.wordTarget?'long':'met';
 if(lengthStatus==='short'||lengthStatus==='long')add('extension','Revisar la extensión',`${count.toLocaleString('es-PE')} palabras en el cuerpo; ${settings.wordMode==='min'?'mínimo':'máximo'} configurado: ${settings.wordTarget.toLocaleString('es-PE')}.`,null,'');
 for(const c of audit.missing){const p=d.ps.find(p=>p.start<=c.offset&&p.end>=c.offset);add('citations',`Referencia por localizar: ${c.author} (${c.year})`,'Se detectó la cita, pero no una entrada compatible en la sección Referencias. Comprueba autor, año y forma de cita.',p,c.quote);}
 for(const e of audit.uncited)add('citations',`Comprobar uso de ${e.author} (${e.year})`,'No se reconoció una cita autor-año compatible en el cuerpo. Puede tratarse de una forma que el lector automático no identifica.',e);
 const duplicates=new Map();
 for(const p of d.ps.filter(p=>p.start<d.bodyEnd)){
  if(words(p.text).length<12)continue;
  const key=normalized(p.text).replace(/[^a-z0-9]/g,'');
  if(duplicates.has(key))add('writing','Párrafo repetido',`Coincide con el párrafo ${duplicates.get(key)}. Revisa si la repetición es necesaria.`,p);else duplicates.set(key,p.id);
  const sentences=p.text.match(/[^.!?¿¡]+[.!?]?/g)??[];
  const longest=sentences.sort((a,b)=>words(b).length-words(a).length)[0];
  if(longest&&words(longest).length>55)add('writing','Oración extensa',`La oración tiene aproximadamente ${words(longest).length} palabras. Considera separar ideas o revisar la puntuación.`,p,longest.trim());
  if(/\b(todos|siempre|nunca|nadie|demuestra que)\b/i.test(p.text))add('evidence','Revisar el alcance de la afirmación','Comprueba si la evidencia permite este grado de generalización. La detección de estas palabras no demuestra que exista un error.',p);
 }
 const structure=DEFAULT_RUBRIC.map(r=>({id:r.id,name:r.name,present:d.sections.some(s=>s.kind===r.id)}));
 const local=sources.length?compareLocal(d.body,sources,settings.excludeQuotes):null;
 return {version:1,checkedAt:new Date().toISOString(),counts:{body:count,total,references:words(d.refs.map(p=>p.text).join('\n')).length,excluded:total-count},lengthStatus,settings,structure,citations:audit,findings,local,paragraphs:d.ps,body:d.body,limits:['La revisión local aplica reglas de estructura y redacción; no evalúa por sí sola la calidad de los argumentos.','No calcula autoría por IA. Los reportes externos tienen métricas y alcances distintos.','El cuerpo incluye título y encabezados y termina ante Referencias o Anexos reconocibles. Revisa el corte si el documento usa otro formato.']};
}
export function detectorReport(text){
 const compact=text.replace(/\s+/g,' ');
 const ia=compact.match(/\*\s*%\s*(?:detectado como IA|detected as AI|generado por IA)/i)?{kind:'suppressed',value:null,label:'*% · valor suprimido; no es 0 %'}:null;
 const near=(patterns)=>{for(const p of patterns){const m=compact.match(p);if(m){const value=Number((m[1]??m[2]).replace(',','.'));if(value>=0&&value<=100)return {kind:'exact',value,label:(m[1]??m[2])+' %',evidence:m[0]};}}return null;};
 const ai=ia??near([/(\d{1,3}(?:[.,]\d+)?)\s*%\s*(?:detectado como IA|detected as AI|generado por IA|AI generated)/i,/(?:AI writing|escritura con IA|detecci[oó]n de IA|generado con IA)[^%]{0,70}?(\d{1,3}(?:[.,]\d+)?)\s*%/i]);
 const similarity=near([/(\d{1,3}(?:[.,]\d+)?)\s*%\s*(?:similitud general|overall similarity|[ií]ndice de similitud)/i,/(?:similitud general|overall similarity|[ií]ndice de similitud)[^%]{0,50}?(\d{1,3}(?:[.,]\d+)?)\s*%/i]);
 return {ai,similarity,notice:'Lectura preliminar del texto del PDF. Comprueba el indicador en el reporte original. No se interpreta un porcentaje de similitud como porcentaje de IA.'};
}
