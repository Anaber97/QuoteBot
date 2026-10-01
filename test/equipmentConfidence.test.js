import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveConfidence, normalizeSourcedResults, normalizeStoredResults, matchesEquipmentSearch, deFuzzEquipmentQuery, geminiGroundedUrls } from '../api/searchEquipment.js';
const source = (overrides = {}) => ({ url: 'https://cat.com/spec', make: 'CAT', model: '320D', operating_weight_lbs: 45000, width_in: 102, height_in: 138, ...overrides });
const normalize = (evidence, overrides = {}) => normalizeSourcedResults({ grounded_urls: evidence.map(s => s.url), results: [{ make: 'CAT', model: '320D', evidence }], ...overrides }, 'CAT 320D');
test('manufacturer evidence produces HIGH and autofills', () => {
 const [result] = normalize([source()]); assert.equal(result.confidence, 'HIGH'); assert.equal(result.requires_confirmation, false);
});
test('two independent sources within five percent use the higher value for each field', () => {
 const [result] = normalize([source({url:'https://first.com/spec'}),source({url:'https://second.com/spec', operating_weight_lbs:47000,width_in:100,height_in:140})]);
 assert.equal(result.confidence,'MEDIUM'); assert.equal(result.requires_confirmation,false); assert.equal(result.operating_weight_lbs,47000); assert.equal(result.width_in,102); assert.equal(result.height_in,140);
});
test('five percent boundary is inclusive, beyond it is LOW', () => {
 const a=source({url:'https://one.com',operating_weight_lbs:9500});
 assert.equal(deriveConfidence([a,source({url:'https://two.com',operating_weight_lbs:10000})]).confidence,'MEDIUM');
 assert.equal(deriveConfidence([a,source({url:'https://two.com',operating_weight_lbs:10001})]).confidence,'LOW');
});
test('a single source and disagreeing sources return LOW with confirmation', () => {
 for(const evidence of [[source({url:'https://one.com'})],[source({url:'https://one.com'}),source({url:'https://two.com',width_in:150})]]){
 const [r]=normalize(evidence); assert.equal(r.confidence,'LOW');assert.equal(r.requires_confirmation,true);
 }
});
test('subdomains are not independent corroboration', () => {
 assert.equal(normalize([source({url:'https://www.dealer.com/spec'}),source({url:'https://used.dealer.com/spec'})])[0].confidence,'LOW');
});
test('model supplied manufacturer flags and lookalike domains cannot confer HIGH', () => {
 for(const url of ['https://cat.used-parts.com/spec','https://cat.com.evil.com/spec','https://caterpillar-used-parts.com/spec']) assert.equal(normalize([source({url,is_manufacturer:true})])[0].confidence,'LOW');
});
test('requires exact grounded page, not just matching domain or a guessed citation', () => {
 assert.equal(normalize([source()],{grounded_urls:['https://cat.com/other-model']}).length,0);
 assert.equal(normalize([source()],{grounded_urls:[]}).length,0);
 assert.equal(normalize([source()],{grounded_urls:['https://www.cat.com/spec?utm_source=google']})[0].confidence,'HIGH');
});
test('rejects unrelated model evidence, missing model, mixed configurations and incomplete fields', () => {
 for(const change of [{model:'330D'},{model:''},{configuration:'wide tracks'},{width_in:null}]) assert.equal(normalize([source(change)]).length,0);
});
test('can combine partial manufacturer evidence for the same configuration', () => {
 const [r]=normalize([source({width_in:null,height_in:null}),source({url:'https://cat.com/manual',operating_weight_lbs:null})]);
 assert.equal(r.confidence,'HIGH');assert.equal(r.width_in,102);
});
test('existing shared database records are trusted HIGH; available sources are re-evaluated', () => {
 const base={make:'CAT',model:'320D',operating_weight_lbs:45000,width_in:102,height_in:138,verification_status:'Verified'};
 assert.equal(normalizeStoredResults([base],'CAT 320D')[0].confidence,'HIGH');
 assert.equal(normalizeStoredResults([base],'CAT 320D')[0].requires_confirmation,false);
 assert.equal(normalizeStoredResults([{...base,sources:[source()]}],'CAT 320D')[0].confidence,'HIGH');
 assert.equal(normalizeStoredResults([{...base,sources:[source({model:'330D'})]}],'CAT 320D')[0].confidence,'HIGH');
 assert.equal(normalizeStoredResults([{...base,sources:[source({url:'https://dealer.com/spec'})]}],'CAT 320D')[0].confidence,'LOW');
});
test('normalizes aliases and compact model identifiers', () => {
 assert.equal(deFuzzEquipmentQuery('2021 CAT320'),'caterpillar 320');
 assert.equal(matchesEquipmentSearch({make:'Volvo',model:'L90H'},'volvo l90h'),true);
 assert.equal(matchesEquipmentSearch({make:'Lee Boy',model:'G700B'},'Leeboy G700B'),true);
 assert.equal(matchesEquipmentSearch({make:'CAT',model:'330D'},'CAT 320D'),false);
});
test('Google redirect resolves without fetching the destination', async(t) => {
 const calls=[];t.mock.method(globalThis,'fetch',async(url)=>{calls.push(url);return new Response(null,{status:302,headers:{location:'https://cat.com/spec'}})});
 const urls=await geminiGroundedUrls({candidates:[{groundingMetadata:{groundingChunks:[{web:{uri:'https://vertexaisearch.cloud.google.com/grounding-api-redirect/test'}}]}}]});
 assert.equal(urls[0].url,'https://cat.com/spec');assert.equal(calls.length,1);
});
