import {randomBytes,scrypt as scryptCallback,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(scryptCallback);
export async function passwordHash(password,salt=randomBytes(16).toString('hex')){
 if(typeof password!=='string'||password.length<12||password.length>200)throw new Error('La clave de acceso debe tener entre 12 y 200 caracteres.');
 return `scrypt:${salt}:${(await scrypt(password,salt,32)).toString('hex')}`;
}
export async function verifyPassword(password,stored){
 const [type,salt,hash,...rest]=String(stored).split(':');
 if(type!=='scrypt'||rest.length||!/^[a-f0-9]{32}$/.test(salt)||!/^[a-f0-9]{64}$/.test(hash))return false;
 if(typeof password!=='string'||password.length>200)return false;
 const derived=await scrypt(password,salt,32);return timingSafeEqual(derived,Buffer.from(hash,'hex'));
}
export function createAccess({hash='',secure=false,required=false,now=Date.now}={}){
 const sessions=new Map(),attempts=new Map();const ttl=12*60*60*1000;
 if(required&&!hash)throw new Error('Configura APP_PASSWORD_HASH antes de publicar AI Redaction.');
 if(hash&&!/^scrypt:[a-f0-9]{32}:[a-f0-9]{64}$/.test(hash))throw new Error('APP_PASSWORD_HASH no tiene un formato válido.');
 const cookieName='ai_redaction_session';
 function read(req){
  const id=String(req.headers.cookie??'').split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1);
  const entry=sessions.get(id);if(!entry)return null;
  if(entry.expires<=now()){sessions.delete(id);return null;}return {...entry,id};
 }
 const cookie=(id,maxAge)=>`${cookieName}=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure?'; Secure':''}`;
 function issue(res){
  for(const [id,s] of sessions)if(s.expires<=now())sessions.delete(id);
  if(sessions.size>=32)sessions.delete(sessions.keys().next().value);
  const id=randomBytes(32).toString('hex'),token=randomBytes(24).toString('hex');sessions.set(id,{token,expires:now()+ttl});res.setHeader('Set-Cookie',cookie(id,ttl/1000));return {id,token};
 }
 const publicToken=randomBytes(24).toString('hex');
 return {
  required:!!hash,
  session(req){return hash?read(req):{token:publicToken};},
  async login(req,res,password){
   const ip=req.socket.remoteAddress??'unknown';const time=now();let a=attempts.get(ip);
   if(!a||a.until<=time){a={count:0,until:time+15*60*1000};attempts.set(ip,a);}
   if(a.count>=10){const e=new Error('Hubo varios intentos. Espera 15 minutos antes de volver a intentar.');e.status=429;throw e;}a.count++;
   if(!hash||!await verifyPassword(password,hash)){const e=new Error('La clave de acceso no es correcta.');e.status=401;throw e;}
   attempts.delete(ip);return issue(res);
  },
  logout(req,res){const current=read(req);if(current)sessions.delete(current.id);res.setHeader('Set-Cookie',cookie('',0));},
  validToken(session,value){return !!session&&typeof value==='string'&&/^[a-f0-9]{48}$/.test(value)&&timingSafeEqual(Buffer.from(value),Buffer.from(session.token));}
 };
}
export function createLimiter({limit=6,windowMs=600000,now=Date.now}={}){
 const buckets=new Map();return key=>{
  const time=now();if(buckets.size>1000)for(const [k,v] of buckets)if(v.until<=time)buckets.delete(k);
  let b=buckets.get(key);if(!b||b.until<=time){b={n:0,until:time+windowMs};buckets.set(key,b);}return ++b.n<=limit;
 };
}
