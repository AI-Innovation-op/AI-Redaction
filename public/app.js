'use strict';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number(n).toLocaleString('es-PE');
const state={config:null,review:null,web:null,ai:null,sources:[],external:[],file:'Texto pegado',busy:false,webController:null};
const categories={extension:'Extensión',citations:'Citas y referencias',writing:'Redacción',evidence:'Alcance y evidencia'};
function status(s){$('#status').textContent=s;}
function error(e){$('#error').hidden=!e;$('#error').textContent=e?.message??e??'';}
function switchTab(name,focus=false){
 for(const tab of document.querySelectorAll('[data-tab]')){const active=tab.dataset.tab===name;tab.classList.toggle('active',active);tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;$('#panel-'+tab.dataset.tab).hidden=!active;if(active&&focus)tab.focus();}
}
for(const tab of document.querySelectorAll('[data-tab]')){
 tab.addEventListener('click',()=>switchTab(tab.dataset.tab));
 tab.addEventListener('keydown',e=>{const tabs=[...document.querySelectorAll('[data-tab]')];let i=tabs.indexOf(tab);if(e.key==='ArrowDown'||e.key==='ArrowRight')i=(i+1)%tabs.length;else if(e.key==='ArrowUp'||e.key==='ArrowLeft')i=(i+tabs.length-1)%tabs.length;else if(e.key==='Home')i=0;else if(e.key==='End')i=tabs.length-1;else return;e.preventDefault();switchTab(tabs[i].dataset.tab,true);});
}
const empty=message=>`<div class="empty">${esc(message)}</div>`;
const pill=(s,kind='')=>`<span class="pill ${kind}">${esc(s)}</span>`;
const quoteButton=q=>q?`<button class="text-button find-quote" data-quote="${esc(q)}">Ver en el documento</button>`:'';
function settings(){
 return {wordTarget:Number($('#wordTarget').value),wordMode:$('#wordMode').value,excludeQuotes:$('#excludeQuotes').checked,
  rubric:[...document.querySelectorAll('.rubric-row')].map((r,i)=>({id:String(i),name:r.querySelector('.rubric-name').value,max:Number(r.querySelector('.rubric-max').value),description:r.querySelector('textarea').value}))};
}
async function api(route,data,options={}){
 if(!state.config)throw new Error('La app aún no se ha conectado al servidor. Actualiza la página.');
 const res=await fetch('/api/'+route,{method:'POST',headers:{'Content-Type':'application/json','X-AI-Redaction-Token':state.config.token},body:JSON.stringify(data),...options});
 const result=await res.json();if(res.status===401)showLogin();if(!res.ok)throw new Error(result.error??'La revisión no se completó.');return result;
}
async function run(fn,message){
 if(state.busy)return;state.busy=true;error(null);status(message);setBusy(true);
 try{await fn();}catch(e){error(e);status('La operación no terminó. Puedes corregir el problema e intentarlo otra vez.');}
 finally{state.busy=false;setBusy(false);}
}
function setBusy(b){for(const id of ['analyze','compare','webSearch','example','export'])$('#'+id).disabled=b||(id==='export'&&!state.review);$('#aiReview').disabled=b||!state.config?.aiConfigured;$('#editor').readOnly=b;for(const input of document.querySelectorAll('input,select,textarea:not(#editor)'))input.disabled=b;}
function invalidate(){
 state.review=null;state.web=null;state.ai=null;$('#overview').hidden=true;$('#export').disabled=true;$('#findingBadge').hidden=true;$('#sessionState').textContent='Cambios pendientes';renderResults();
}
let timer;
$('#editor').addEventListener('input',()=>{invalidate();clearTimeout(timer);timer=setTimeout(updateDraft,180);});
function updateDraft(){const list=$('#editor').value.replace(/https?:\/\/\S+/g,' ').match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)??[];$('#draftWords').textContent=`${fmt(list.length)} palabras en el editor`;}
for(const id of ['wordTarget','wordMode','excludeQuotes'])$('#'+id).addEventListener('change',invalidate);
async function extractFile(file){
 if(file.size>12000000)throw new Error('El archivo supera 12 MB.');
 const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=()=>reject(new Error('No se pudo abrir el archivo.'));r.readAsDataURL(file);});
 return api('extract',{name:file.name,data});
}
async function analyze(){
 const result=await api('analyze',{text:$('#editor').value,settings:settings(),sources:state.sources});
 state.review=result;state.ai=null;state.web=null;renderResults();$('#overview').hidden=false;$('#export').disabled=false;$('#sessionState').textContent='Revisión local lista';
 status(`Revisión local terminada: ${fmt(result.counts.body)} palabras en el cuerpo y ${result.findings.length} observaciones. La calidad argumentativa requiere lectura académica.`);
}
$('#documentFile').addEventListener('change',()=>run(async()=>{
 const file=$('#documentFile').files[0];if(!file)return;
 const result=await extractFile(file);invalidate();state.file=file.name;$('#editor').value=result.text;$('#fileName').textContent=file.name;updateDraft();await analyze();
 if(result.warnings.length)status(`Archivo cargado y revisión local lista. ${result.warnings.join(' ')}`);
 $('#documentFile').value='';
},'Leyendo el documento…'));
$('#analyze').addEventListener('click',()=>run(analyze,'Revisando estructura, extensión y citas…'));
$('#example').addEventListener('click',()=>run(async()=>{
 invalidate();state.file='Ejemplo de práctica';$('#fileName').textContent=state.file;
 $('#editor').value=`La lectura compartida en comunidades digitales\n\nIntroducción\n\nLas comunidades digitales facilitan el intercambio de recomendaciones de lectura. Este ensayo plantea que compartir un interés puede iniciar una relación, pero su continuidad depende de acuerdos y participación sostenida.\n\nDesarrollo argumentativo\n\nBauman (2003) permite preguntar por la estabilidad de los vínculos. Sin embargo, esta perspectiva no explica por sí sola todos los compromisos que construyen los participantes. Giddens (2011) permite examinar las reglas y los recursos de sus acciones.\n\nAnálisis aplicado\n\nEn un club ficticio, los integrantes acordaron una sesión mensual y distribuyeron las tareas de moderación. El ejemplo ilustra una forma posible de coordinación; no constituye evidencia empírica sobre todas las comunidades.\n\nConclusiones\n\nLa continuidad de una comunidad requiere observar prácticas y acuerdos. El caso hipotético permite explicar la tesis, pero no demostrar su frecuencia en la población.\n\nReferencias\n\nBauman, Z. (2003). Modernidad líquida. Fondo de Cultura Económica.`;
 updateDraft();await analyze();status('Ejemplo cargado: falta una referencia compatible con Giddens (2011). Puedes explorar la observación.');
},'Cargando un ejemplo de práctica…'));
function renderResults(){
 const r=state.review;
 if(!r){$('#findings').innerHTML=empty('Primero revisa un documento. Aquí aparecerán observaciones con evidencia.');$('#citations').innerHTML=empty('Carga el trabajo completo, incluidas sus referencias, y pulsa Revisar documento.');$('#localMatches').innerHTML='';$('#webMatches').innerHTML='';$('#aiResult').innerHTML='';return;}
 const lengthText={reference:'Referencia; sin sanción',met:'Cumple la regla configurada',short:'Por debajo del mínimo',long:'Supera el máximo'}[r.lengthStatus];
 $('#overview').innerHTML=`<div class="stats"><div class="stat"><span>CUERPO DEL DOCUMENTO</span><strong>${fmt(r.counts.body)}</strong><small>palabras con título y encabezados</small></div><div class="stat"><span>EXTENSIÓN</span><strong>${fmt(r.settings.wordTarget)}</strong><small>${esc(lengthText)}</small></div><div class="stat"><span>CITAS RECONOCIDAS</span><strong>${r.citations.citations.length}</strong><small>${r.citations.missing.length} referencias por localizar</small></div><div class="stat"><span>OBSERVACIONES</span><strong>${r.findings.length}</strong><small>para revisar con criterio</small></div></div><div class="structure">${r.structure.map(s=>pill(`${s.present?'Reconocido':'Sin reconocer'}: ${s.name}`,s.present?'success':'')).join('')}</div><p class="hint">${fmt(r.counts.total)} palabras en todo el texto · ${fmt(r.counts.excluded)} fuera del cuerpo. Un encabezado reconocido no demuestra la calidad de su sección.</p>`;
 $('#findingBadge').hidden=false;$('#findingBadge').textContent=r.findings.length;
 $('#findings').innerHTML=r.findings.length?r.findings.slice(0,100).map(f=>`<article class="finding"><span class="eyebrow">${esc(categories[f.kind]??f.kind)}${f.paragraph?` · PÁRRAFO ${f.paragraph}`:''}</span><h3>${esc(f.title)}</h3><p>${esc(f.detail)}</p>${f.quote?`<blockquote>${esc(f.quote)}</blockquote>${quoteButton(f.quote)}`:''}</article>`).join(''):empty('Las reglas locales no encontraron observaciones. Esto no certifica la precisión, originalidad o calidad académica del trabajo.');
 if(r.findings.length>100)$('#findings').insertAdjacentHTML('beforeend','<p class="hint">Se muestran las primeras 100 observaciones; el informe exportado incluye todas.</p>');
 $('#citations').innerHTML=`<div class="stats"><div class="stat"><span>CITAS AUTOR-AÑO</span><strong>${r.citations.citations.length}</strong></div><div class="stat"><span>ENTRADAS BIBLIOGRÁFICAS</span><strong>${r.citations.entries.length}</strong></div><div class="stat"><span>POR LOCALIZAR</span><strong>${r.citations.missing.length}</strong></div><div class="stat"><span>USO POR COMPROBAR</span><strong>${r.citations.uncited.length}</strong></div></div><div class="notice">${esc(r.citations.scope)}</div>${r.citations.citations.length?`<div class="table-wrap"><table><thead><tr><th>Cita reconocida</th><th>Referencia compatible</th><th>Evidencia</th></tr></thead><tbody>${r.citations.citations.map(c=>`<tr><td>${esc(c.author)} (${esc(c.year)})</td><td>${pill(c.found?'Localizada':'Por localizar',c.found?'success':'warning')}</td><td>${quoteButton(c.quote)}</td></tr>`).join('')}</tbody></table></div>`:empty('No se reconocieron citas autor-año. Las citas numéricas, colectivas o con formatos diferentes requieren revisión manual.')}${r.citations.entries.length?`<article class="card"><h3>Bibliografía reconocida</h3>${r.citations.entries.map(e=>`<p>${esc(e.text)}<br>${pill(e.cited?'Cita compatible localizada':'Comprobar uso en el cuerpo',e.cited?'success':'')}</p>`).join('')}</article>`:''}`;
 renderLocal();renderWeb();renderAI();
}
document.addEventListener('click',e=>{
 const button=e.target.closest('.find-quote');if(!button)return;const q=button.dataset.quote;const i=$('#editor').value.indexOf(q);if(i<0)return;
 switchTab('document');$('#editor').focus();$('#editor').setSelectionRange(i,i+q.length);$('#editor').scrollTop=$('#editor').scrollHeight*i/Math.max(1,$('#editor').value.length);status('Fragmento seleccionado en el editor.');
});
function renderSources(){
 $('#sourceList').innerHTML=state.sources.map((s,i)=>`<li><span>${esc(s.name)}</span><button type="button" data-remove-source="${i}" aria-label="Quitar fuente ${esc(s.name)}">Quitar</button></li>`).join('');
}
$('#sourceList').addEventListener('click',e=>{const b=e.target.closest('[data-remove-source]');if(!b)return;state.sources.splice(Number(b.dataset.removeSource),1);if(state.review)state.review.local=null;renderSources();renderLocal();});
$('#sourceFiles').addEventListener('change',()=>run(async()=>{
 const files=[...$('#sourceFiles').files];if(state.sources.length+files.length>8)throw new Error('Puedes añadir hasta ocho fuentes.');
 const loaded=[];for(const file of files)loaded.push(await extractFile(file));
 state.sources.push(...loaded);if(state.review)state.review.local=null;renderSources();renderLocal();$('#sourceFiles').value='';status(`${state.sources.length} fuentes listas. Pulsa Comparar fuentes locales.`);
},'Leyendo las fuentes de comparación…'));
$('#compare').addEventListener('click',()=>run(async()=>{if(!state.sources.length)throw new Error('Añade al menos una fuente.');await analyze();status('Comparación local terminada. Revisa los fragmentos y sus fuentes.');},'Comparando las fuentes locales…'));
function highlighted(text,spans){let result='',cursor=0;for(const s of spans??[]){result+=esc(text.slice(cursor,s.start))+`<mark title="Fuente ${s.sourceId}">${esc(text.slice(s.start,s.end))}</mark>`;cursor=s.end;}return result+esc(text.slice(cursor));}
function renderLocal(){
 const r=state.review,l=r?.local;if(!l){$('#localMatches').innerHTML=empty('Añade fuentes y ejecuta la comparación para obtener un porcentaje local.');return;}
 $('#localMatches').innerHTML=`<div class="section-title"><span class="eyebrow">COMPARACIÓN LOCAL</span><h2>${l.stats.overallPercent} % de palabras coincidentes</h2><p>${fmt(l.stats.matchedWords)} de ${fmt(l.stats.countedWords)} palabras comparadas · ${l.compared} fuentes aportadas.</p></div><div class="notice">${esc(l.scope)} Se comparó el cuerpo; no las referencias ni los anexos reconocidos.</div>${l.sources.length?`<article class="card"><h3>Fuentes con coincidencias</h3>${l.sources.map(s=>`<p><strong>[${s.id}] ${esc(s.title)}</strong> · ${s.sharePercent} % · ${s.matchedWords} palabras</p>`).join('')}</article><div class="highlight-text">${highlighted(r.body,l.spans)}</div>`:empty('No se encontraron secuencias de al menos siete palabras en estas fuentes. El resultado se limita al material aportado.')}`;
}
$('#webSearch').addEventListener('click',()=>run(async()=>{
 if(!$('#webConsent').checked)throw new Error('Activa el permiso de envío de fragmentos para usar la búsqueda web.');
 if(!state.review)await analyze();
 state.web=null;$('#webMatches').innerHTML='';const controller=new AbortController();state.webController=controller;$('#cancelWeb').hidden=false;$('#webProgress').hidden=false;$('#webProgress').value=0;
 try{
  const res=await fetch('/api/web',{method:'POST',headers:{'Content-Type':'application/json','X-AI-Redaction-Token':state.config.token},body:JSON.stringify({text:$('#editor').value,settings:settings(),consent:true}),signal:controller.signal});
  if(!res.ok)throw new Error((await res.json()).error);const reader=res.body.getReader(),decoder=new TextDecoder();let buffer='',gotResult=false;
  while(true){const {value,done}=await reader.read();buffer+=decoder.decode(value??new Uint8Array(),{stream:!done});let index;while((index=buffer.indexOf('\n'))>=0){const item=JSON.parse(buffer.slice(0,index));buffer=buffer.slice(index+1);if(item.type==='progress'){$('#webProgress').value=item.percent;status(`Buscando coincidencias públicas… ${item.percent} % del proceso.`);}if(item.type==='error')throw new Error(item.error);if(item.type==='result'){state.web=item.result;gotResult=true;}}if(done)break;}
  if(!gotResult)throw new Error('La búsqueda se interrumpió. No hay un resultado completo.');renderWeb();status('Búsqueda terminada. Comprueba la cobertura y las páginas que pudieron abrirse.');
 }catch(e){if(e.name==='AbortError')throw new Error('Búsqueda cancelada; no se obtuvo un resultado completo.');throw e;}
 finally{$('#cancelWeb').hidden=true;$('#webProgress').hidden=true;state.webController=null;}
},'Iniciando búsqueda pública…'));
$('#cancelWeb').addEventListener('click',()=>state.webController?.abort());
function safeLink(url){try{const u=new URL(url);return ['https:','http:'].includes(u.protocol)?u.href:'#';}catch{return '#';}}
function renderWeb(){
 const w=state.web;if(!w){$('#webMatches').innerHTML='';return;}const c=w.coverage;const any=c.queriesRun>c.queriesFailed&&c.pagesFetched>0;
 $('#webMatches').innerHTML=`<div class="section-title"><span class="eyebrow">BÚSQUEDA PÚBLICA · MUESTRA</span><h2>${any?w.similarity.overallPercent+' % de coincidencia observada':'Sin cobertura suficiente para un porcentaje'}</h2><p>${c.segmentsSearched} de ${c.segmentsTotal} segmentos consultados · ${c.pagesFetched} páginas leídas · ${c.queriesFailed} consultas sin respuesta.</p></div><div class="notice">${c.segmentsNotSearched} segmentos sin consultar; ${c.pagesFailed} páginas no pudieron leerse. ${c.timeLimitReached?'Se alcanzó el límite de tiempo. ':''}El porcentaje se limita a las páginas accesibles encontradas y puede subestimar coincidencias. No es un reporte de Turnitin.</div>${w.sources.length?`<article class="card">${w.sources.map(s=>`<p><a class="source-link" href="${esc(safeLink(s.url))}" target="_blank" rel="noopener noreferrer">[${s.id}] ${esc(s.title||s.host)}</a> · ${s.sharePercent} %</p>`).join('')}</article><div class="highlight-text">${highlighted(state.review.body,w.spans)}</div>`:''}`;
}
function renderRubric(rubric){
 $('#rubricEditor').innerHTML=rubric.map((r,i)=>`<div class="rubric-row"><div><label for="rubric-name-${i}">Criterio ${i+1}</label><input class="rubric-name" id="rubric-name-${i}" value="${esc(r.name)}" maxlength="100"></div><div><label for="rubric-max-${i}">Puntos</label><input class="rubric-max" id="rubric-max-${i}" type="number" min="0.5" max="100" step="0.5" value="${r.max}"></div><label class="sr-only" for="rubric-desc-${i}">Descripción del criterio ${i+1}</label><textarea id="rubric-desc-${i}" maxlength="1200">${esc(r.description)}</textarea></div>`).join('');
}
$('#rubricEditor').addEventListener('input',()=>{state.ai=null;$('#aiResult').innerHTML='';$('#rubricTotal').textContent=`${settings().rubric.reduce((n,r)=>n+r.max,0)} puntos`;invalidate();});
$('#aiReview').addEventListener('click',()=>run(async()=>{
 if(!$('#aiConsent').checked)throw new Error('Activa el permiso de revisión con IA para continuar.');
 if(!state.review)await analyze();state.ai=null;renderAI();
 state.ai=await api('ai',{text:$('#editor').value,settings:settings(),consent:true});renderAI();status('Revisión con IA terminada. Contrasta cada observación con sus evidencias y con la rúbrica real.');
},'Leyendo el documento con la rúbrica… Puede tardar unos minutos.'));
function renderAI(){
 const a=state.ai;if(!a){$('#aiResult').innerHTML='';return;}
 $('#aiResult').innerHTML=`<article class="card"><span class="eyebrow">EVALUACIÓN FORMATIVA · ${esc(a.model)}</span><h3>Lectura académica asistida</h3><p>${esc(a.summary)}</p><div class="ai-score">${a.total===null?'Puntaje no calculable':`${a.total} / ${a.max}`}</div><p class="hint">Estimación orientativa, sin penalidades. No reproduce la nota del profesor.</p><h3>Fortalezas</h3><ul>${a.strengths.map(s=>`<li>${esc(s)}</li>`).join('')}</ul></article>${a.criteria.map(c=>`<article class="finding"><h3>${esc(c.name)} · ${c.score===null?'Sin puntaje':c.score+' / '+c.max}</h3><p>${esc(c.reason)}</p>${c.quote?`<blockquote>${esc(c.quote)}</blockquote>${quoteButton(c.quote)}`:''}<p><strong>Siguiente paso:</strong> ${esc(c.suggestion)}</p></article>`).join('')}<article class="card"><h3>Prioridades de mejora</h3>${a.priorities.map(p=>`<h4>${esc(p.title)}</h4><p>${esc(p.explanation)}</p>${p.quote?`<blockquote>${esc(p.quote)}</blockquote>${quoteButton(p.quote)}`:''}<p>${esc(p.suggestion)}</p>`).join('')}<h3>Límites de esta lectura</h3><ul>${a.limitations.map(l=>`<li>${esc(l)}</li>`).join('')}</ul></article>`;
}
$('#reportFile').addEventListener('change',()=>run(async()=>{
 const f=$('#reportFile').files[0];if(!f)return;const extracted=await extractFile(f);const r=await api('report',{text:extracted.text});
 $('#parsedReport').innerHTML=`<div class="notice"><strong>${esc(f.name)}</strong><p>IA: ${esc(r.ai?.label??'Indicador no reconocido')}<br>Similitud: ${esc(r.similarity?.label??'Indicador no reconocido')}</p><p>${esc(r.notice)}</p>${r.ai?.evidence?`<blockquote>${esc(r.ai.evidence)}</blockquote>`:''}${r.similarity?.evidence?`<blockquote>${esc(r.similarity.evidence)}</blockquote>`:''}</div>`;
 status('Reporte leído. Contrasta los indicadores con el PDF antes de registrarlos.');$('#reportFile').value='';
},'Leyendo indicadores del reporte…'));
$('#externalForm').addEventListener('submit',e=>{
 e.preventDefault();error(null);const val=$('#percentage').value.trim();if(!val)return;
 const number=val.match(/^\s*(\d+(?:[.,]\d+)?)\s*%?\s*$/);if(number&&Number(number[1].replace(',','.'))>100){error('El porcentaje debe estar entre 0 y 100.');return;}
 state.external.push({service:$('#service').value,metric:$('#metric').value,value:val,scope:$('#scope').value.trim(),recordedAt:new Date().toISOString()});renderExternal();status('Resultado externo registrado en esta sesión.');
});
function renderExternal(){
 $('#externalResults').innerHTML=state.external.length?`<div class="table-wrap"><table><thead><tr><th>Servicio</th><th>Métrica</th><th>Resultado</th><th>Alcance informado</th><th>Acción</th></tr></thead><tbody>${state.external.map((r,i)=>`<tr><td>${esc(r.service)}</td><td>${esc(r.metric)}</td><td><strong>${esc(r.value)}</strong></td><td>${esc(r.scope)}</td><td><button class="text-button" data-remove-report="${i}">Quitar</button></td></tr>`).join('')}</tbody></table></div>`:'';
}
$('#externalResults').addEventListener('click',e=>{const b=e.target.closest('[data-remove-report]');if(!b)return;state.external.splice(Number(b.dataset.removeReport),1);renderExternal();});
function download(content,name,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);}
$('#export').addEventListener('click',()=>{
 const r=state.review;if(!r)return;
 const heading=(s)=>`<h2>${esc(s)}</h2>`;
 const findings=r.findings.map(f=>`<h3>${esc(f.title)}</h3><p>${esc(f.detail)}</p>${f.quote?`<blockquote>${esc(f.quote)}</blockquote>`:''}`).join('');
 const local=r.local?`<p>${r.local.stats.overallPercent} % · ${r.local.stats.matchedWords} de ${r.local.stats.countedWords} palabras comparadas; ${r.local.compared} fuentes aportadas.</p><p>${esc(r.local.scope)}</p>${r.local.sources.map(s=>`<p>${esc(s.title)}: ${s.sharePercent} %</p>`).join('')}<div style="white-space:pre-wrap">${highlighted(r.body,r.local.spans)}</div>`:'<p>No ejecutada.</p>';
 const a=state.ai;const ai=a?`<p>${esc(a.summary)}</p><p>Puntaje orientativo: ${a.total===null?'No calculable':a.total+' / '+a.max}. Sin penalidades.</p>${a.criteria.map(c=>`<h3>${esc(c.name)}: ${c.score===null?'No evaluable':c.score+' / '+c.max}</h3><p>${esc(c.reason)}</p><blockquote>${esc(c.quote)}</blockquote><p>${esc(c.suggestion)}</p>`).join('')}<ul>${a.limitations.map(s=>`<li>${esc(s)}</li>`).join('')}</ul>`:'<p>No ejecutada. La revisión local no puntúa la calidad argumentativa.</p>';
 const web=state.web?`<p>${state.web.coverage.pagesFetched>0&&state.web.coverage.queriesRun>state.web.coverage.queriesFailed?state.web.similarity.overallPercent+' % observado.':'Sin cobertura suficiente para un porcentaje.'} Consultados ${state.web.coverage.segmentsSearched}/${state.web.coverage.segmentsTotal} segmentos; ${state.web.coverage.pagesFetched} páginas leídas; ${state.web.coverage.queriesFailed} consultas fallidas. ${state.web.coverage.pagesFailed} páginas no pudieron leerse. Un fallo no equivale a ausencia de coincidencias.</p>${state.web.sources.map(s=>`<p><a href="${esc(safeLink(s.url))}">${esc(s.title||s.host)}</a>: ${s.sharePercent} %</p>`).join('')}`:'<p>No ejecutada.</p>';
 const html=`<!doctype html><html lang="es"><meta charset="utf-8"><title>Informe de revisión · AI Redaction</title><style>body{font:16px/1.6 Georgia,serif;max-width:900px;margin:50px auto;padding:0 25px;color:#202d3e}h1,h2,h3{font-family:Arial,sans-serif}h1{color:#1e3a5f}h2{border-bottom:1px solid #bbb;padding-bottom:9px;margin-top:40px}blockquote{background:#f6f7f9;border-left:3px solid #b28a45;padding:15px;margin:20px 0;white-space:pre-wrap;overflow-wrap:anywhere}mark{background:#f2dfb5}a{color:#1e3a5f}p,li{overflow-wrap:anywhere}@media print{body{margin:0;max-width:none}h2,h3{break-after:avoid}blockquote{break-inside:avoid}}</style><h1>AI Redaction · Informe de revisión</h1><p>${esc(state.file)}<br>${esc(new Date(r.checkedAt).toLocaleString('es-PE'))}</p><p>Revisión formativa. No certifica autoría, originalidad ni calificación oficial.</p>${heading('Extensión')}<p>${fmt(r.counts.body)} palabras en el cuerpo, ${fmt(r.counts.total)} en todo el texto. Configuración: ${esc(r.settings.wordMode)} · ${fmt(r.settings.wordTarget)} palabras.</p>${heading('Observaciones locales')}${findings||'<p>Sin observaciones detectadas por estas reglas.</p>'}${heading('Citas y referencias')}<p>${esc(r.citations.scope)}</p>${r.citations.citations.map(c=>`<p>${esc(c.author)} (${esc(c.year)}): ${c.found?'referencia compatible localizada':'referencia por localizar'}.</p>`).join('')}${heading('Coincidencias locales')}${local}${heading('Coincidencias web')}${web}${heading('Revisión académica con IA')}${ai}${heading('Resultados externos registrados')}${state.external.map(e=>`<p>${esc(e.service)} · ${esc(e.metric)}: ${esc(e.value)}. Alcance: ${esc(e.scope)}.</p>`).join('')||'<p>No registrados.</p>'}${heading('Límites')}<ul>${r.limits.map(l=>`<li>${esc(l)}</li>`).join('')}</ul></html>`;
 download(html,'AI Redaction-informe.html','text/html;charset=utf-8');status('Informe exportado como HTML. Puedes abrirlo e imprimirlo como PDF.');
});
function showLogin(){ $('#appShell').hidden=true;$('#loginScreen').hidden=false; }
$('#showPassword').addEventListener('click',()=>{const visible=$('#accessPassword').type==='password';$('#accessPassword').type=visible?'text':'password';$('#showPassword').textContent=visible?'Ocultar':'Mostrar';$('#showPassword').setAttribute('aria-pressed',String(visible));});
$('#loginForm').addEventListener('submit',async e=>{
 e.preventDefault();$('#loginError').hidden=true;$('#loginButton').disabled=true;$('#loginButton').textContent='Entrando…';
 try{
  const response=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:$('#accessPassword').value})});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'No se pudo iniciar la sesión.');$('#accessPassword').value='';await init();
 }catch(e){$('#loginError').textContent=e.message;$('#loginError').hidden=false;}finally{$('#loginButton').disabled=false;$('#loginButton').textContent='Entrar a mi espacio';}
});
$('#logout').addEventListener('click',async()=>{try{await api('logout',{});location.reload();}catch(e){error(e);}});
async function init(){
 renderResults();renderExternal();
 try{
  const sessionResponse=await fetch('/api/session');if(!sessionResponse.ok)throw new Error('No se pudo conectar. Vuelve a intentar.');
  const session=await sessionResponse.json();if(!session.authenticated){showLogin();return;}
  const res=await fetch('/api/config');if(!res.ok)throw new Error('No se pudo iniciar la sesión.');state.config=await res.json();renderRubric(state.config.rubric);
  $('#aiConfig').textContent=state.config.aiConfigured?`Lista para revisar con ${state.config.providerName}. Se inicia solo cuando lo solicitas.`:'La revisión con IA aún no está activada. Puedes revisar la extensión, las citas y las coincidencias.';
  $('#aiReview').disabled=!state.config.aiConfigured;$('#logout').hidden=!state.config.accessRequired;$('#loginScreen').hidden=true;$('#appShell').hidden=false;
 }catch(e){showLogin();$('#loginError').textContent=e.message;$('#loginError').hidden=false;}
}
init();
