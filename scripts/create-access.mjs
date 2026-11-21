import {randomBytes} from 'node:crypto';import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {passwordHash} from '../lib/access.mjs';
const root=new URL('../',import.meta.url),privateDir=new URL('.private/',root);
await mkdir(privateDir,{recursive:true});
let info;try{info=JSON.parse(await readFile(new URL('access.json',privateDir),'utf8'));}catch{
 const password=randomBytes(15).toString('base64url');info={password,hash:await passwordHash(password)};
 await writeFile(new URL('access.json',privateDir),JSON.stringify(info),{mode:0o600});
 await writeFile(new URL('Acceso-AI-Redaction.txt',privateDir),`AI Redaction · Acceso privado\n\nClave: ${password}\n\nCompártela únicamente con tu hermana.\nLa sesión dura 12 horas y puede cerrarse cuando el servidor se reinicia.\n`,{mode:0o600});
}
let env='';try{env=await readFile(new URL('.env',root),'utf8');}catch{}
env=env.split(/\r?\n/).filter(l=>!l.startsWith('APP_PASSWORD_HASH=')&&!l.startsWith('OPENROUTER_MODEL=')).join('\n').trimEnd();
await writeFile(new URL('.env',root),env+`\nOPENROUTER_MODEL=google/gemini-3.5-flash-lite\nAPP_PASSWORD_HASH=${info.hash}\n`,{mode:0o600});
console.log('Acceso guardado en .private/Acceso-AI-Redaction.txt. No se publica ni se incluye en Docker.');
