import test from 'node:test';import assert from 'node:assert/strict';
import {passwordHash,verifyPassword,createAccess,createLimiter} from '../lib/access.mjs';
test('una clave privada se valida con scrypt sin almacenar el texto plano',async()=>{
 const p='clave-ficticia-solo-para-pruebas',hash=await passwordHash(p);assert.ok(!hash.includes(p));assert.equal(await verifyPassword(p,hash),true);assert.equal(await verifyPassword('otra-clave',hash),false);assert.equal(await verifyPassword(p,'malformado'),false);assert.throws(()=>createAccess({required:true}));
});
test('sesión privada: cookie HttpOnly y Secure, CSRF por sesión, caducidad y cierre',async()=>{
 let time=1000;const hash=await passwordHash('clave-ficticia-solo-pruebas');const access=createAccess({hash,secure:true,now:()=>time});
 const req={headers:{},socket:{remoteAddress:'127.0.0.1'}};const headers={};const res={setHeader:(k,v)=>headers[k]=v};
 assert.equal(access.session(req),null);const issued=await access.login(req,res,'clave-ficticia-solo-pruebas');assert.match(headers['Set-Cookie'],/HttpOnly; SameSite=Strict/);assert.match(headers['Set-Cookie'],/Secure/);
 req.headers.cookie=headers['Set-Cookie'].split(';')[0];const session=access.session(req);assert.equal(access.validToken(session,issued.token),true);assert.equal(access.validToken(session,'é'.repeat(48)),false);
 access.logout(req,res);assert.equal(access.session(req),null);
 await access.login(req,res,'clave-ficticia-solo-pruebas');req.headers.cookie=headers['Set-Cookie'].split(';')[0];time+=13*60*60*1000;assert.equal(access.session(req),null);
});
test('frena intentos de acceso repetidos y permite volver tras la espera',async()=>{
 let time=0;const access=createAccess({hash:await passwordHash('clave-correcta-ficticia'),now:()=>time});const req={headers:{},socket:{remoteAddress:'x'}},res={setHeader(){}};
 for(let i=0;i<10;i++)await assert.rejects(access.login(req,res,'incorrecta'),e=>e.status===401);
 await assert.rejects(access.login(req,res,'clave-correcta-ficticia'),e=>e.status===429);time+=16*60*1000;assert.ok((await access.login(req,res,'clave-correcta-ficticia')).token);
});
test('el límite de revisiones se aplica por sesión y se restablece',()=>{let time=0;const take=createLimiter({limit:2,windowMs:100,now:()=>time});assert.equal(take('a'),true);assert.equal(take('a'),true);assert.equal(take('a'),false);assert.equal(take('b'),true);time=101;assert.equal(take('a'),true);});
