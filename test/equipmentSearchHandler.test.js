import test from 'node:test';
import assert from 'node:assert/strict';
import { createMockReqRes } from './helpers/mockSupabase.js';

for (const scenario of ['database', 'HIGH', 'MEDIUM', 'LOW', 'quota', 'save-failure', 'disabled']) {
 test('equipment search: '+scenario, async(t)=>{
  const events=[]; const writes=[]; const filters=[];
  const source=(url)=>({url,make:'CAT',model:'320D',operating_weight_lbs:45000,width_in:102,height_in:138});
  const sources=scenario==='MEDIUM'?[source('https://one.com/spec'),source('https://two.com/spec')]:[source(scenario==='LOW'?'https://one.com/spec':'https://cat.com/spec')];
  const stored={id:'saved',make:'CAT',model:'320D',operating_weight_lbs:45000,width_in:102,height_in:138,sources};
  const admin={from(){const state={};const b={select(){return b},or(v){filters.push(v);return b},eq(){return b},ilike(){return b},is(){return b},limit(){return b},insert(row){state.row=row;return b},update(row){state.row=row;return b},then(resolve){events.push(state.row?'save':'database');if(state.row)writes.push(state.row);resolve({data:state.row?null:scenario==='database'?[stored]:[],error:state.row&&scenario==='save-failure'?new Error('save failed'):null})}};return b}};
  t.mock.module('../api/_security.js',{exports:{requireUser:async()=>({admin,profile:{id:'user',company_id:'company-a'}}),enforceRateLimit:async(_a,key,options)=>{events.push(key);if(key.endsWith(':global'))assert.equal(options.limit,20)},sendApiError:(res,e)=>res.status(e.status||500).json({error:e.message})}});
  t.mock.module('../api/_monitoring.js',{exports:{reportOperationalError:async()=>{}}});
  t.mock.module('../api/_env.js',{exports:{getServerEnv:(name)=>name==='GOOGLE_GEMINI_API_KEY'?'test-key':name==='GEMINI_DAILY_CAP'&&scenario==='disabled'?'0':undefined}});
  t.mock.method(globalThis,'fetch',async()=>{events.push('web'); if(scenario==='quota')return Response.json({error:{message:'quota exhausted'}},{status:429});return Response.json({steps:[{type:'google_search_result',result:[]},{type:'model_output',content:[{type:'text',text:JSON.stringify({results:[{make:'CAT',model:'320D',evidence:sources}]}),annotations:sources.map(s=>({type:'url_citation',url:s.url}))}]}]})});
  const {default:handler}=await import('../api/searchEquipment.js?'+scenario);
  const {req,res}=createMockReqRes({query:{query:'CAT 320D'}});await handler(req,res);
  assert.ok(filters.includes('company_id.is.null,company_id.eq.company-a'));
  if(scenario==='quota'){assert.equal(res.statusCode,429);return;}
  assert.equal(res.statusCode,200,JSON.stringify(res.body));
  if(scenario==='disabled'){assert.equal(events.includes('web'),false);assert.match(res.body.error,/disabled/);return;}
  assert.equal(res.body.results[0].confidence,['database','save-failure'].includes(scenario)?'HIGH':scenario);
  if(scenario==='database'){assert.equal(events.includes('web'),false);assert.equal(res.body.source,'database');}
  else{assert.ok(events.indexOf('database')<events.indexOf('web'));assert.equal(writes.length,['HIGH','save-failure'].includes(scenario)?1:0);if(writes.length)assert.equal(writes[0].company_id,'company-a');}
 });
}
