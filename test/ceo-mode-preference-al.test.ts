import {afterAll, beforeAll, expect, test} from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {getQuestion} from '../scripts/question-registry';
import {CARVE_GUARDS} from './helpers/carve-guards';
import {expectMentions} from './helpers/prompt-structure';
const root=path.resolve(import.meta.dir,'..');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'gstack-ceo-mode-preference-'));
function section(s:string){
 const match=s.match(/^### 0[A-Z]\. (?:Mode Selection|モード選択)\n([\s\S]*?)(?=^### |$(?![\s\S]))/m);
 if(!match)throw new Error('CEO Mode Selection section missing');
 return match[1]!;
}
const rendered=new Map<string,string>();
const env=(state:string)=>({...process.env,GSTACK_HOME:state,GSTACK_STATE_ROOT:state});
beforeAll(()=>{
 for(const host of ['claude','codex']){
  const out=path.join(temp,host),state=path.join(temp,'render-state');
  const result=spawnSync(process.execPath,['run','scripts/gen-skill-docs.ts','--host',host,'--out-dir',out],{cwd:root,env:env(state),encoding:'utf8',timeout:120_000});
  if(result.status!==0)throw new Error(result.stderr||result.stdout);
  rendered.set(host,fs.readFileSync(path.join(out,host==='claude'?'plan-ceo-review':'.agents/skills/gstack-plan-ceo-review','SKILL.md'),'utf8'));
 }
},120_000);
afterAll(()=>fs.rmSync(temp,{recursive:true,force:true}));
function modeId(document:string){
 const ids=[...section(document).matchAll(/`question_id=([^`]+)`/g)].map(m=>m[1]!);
 expect(ids).toHaveLength(1);return ids[0]!;
}
function tuning(document:string){
 return document.split('## Question Tuning(`QUESTION_TUNING: false`')[1]!.split('\n## ')[0]!;
}
function renderedCheck(host:string,id:string){
 // The mode id is registered, so the rendered check carries no summary file
 // (that is only for ids outside the registry).
 const match=tuning(rendered.get(host)!).match(/`(([^`]+)\/gstack-question-preference --check "<id>")`/)!;
 expect(match).not.toBeNull();
 expect(match[2]).toBe(host==='claude'?'~/.claude/skills/gstack/bin':'$GSTACK_BIN');
 expectMentions(tuning(rendered.get(host)!),[['`--summary-file .gstack/tmp/qt.txt`','付けます']],'tuning');
 const quote=(value:string)=>"'"+value.replace(/'/g,"'\\''")+"'";
 // Run the rendered command, substituting its documented fields and mapping
 // the host's installed executable location to this isolated checkout.
 return match[1]!.replace('"<id>"',quote(id))
  .replace(match[2]!+'/gstack-question-preference',quote(path.join(root,'bin/gstack-question-preference')));
}
function checkWithPreference(host:string,preference?:string,writeId?:string){
 const id=modeId(rendered.get(host)!),state=fs.mkdtempSync(path.join(temp,'state-'));
 const run=(args:string[],input?:string)=>spawnSync(path.join(root,'bin/gstack-question-preference'),args,{cwd:root,env:env(state),input,encoding:'utf8',timeout:30_000});
 if(preference){const written=run(['--write',JSON.stringify({question_id:writeId??id,preference,source:'plan-tune'})]);expect(written.status).toBe(0);}
 const result=spawnSync('bash',['-c',renderedCheck(host,id)],{cwd:root,env:env(state),encoding:'utf8',timeout:30_000});
 expect(result.status).toBe(0);return {id,result,run};
}
test('source and both isolated host renders bind the shared check, marker and log to the registered mode identity',()=>{
 const source=fs.readFileSync(path.join(root,'plan-ceo-review/SKILL.md.tmpl'),'utf8');
 for(const document of [source,...rendered.values()]){
  const id=modeId(document),s=section(document);
  expect(getQuestion(id)).toMatchObject({id:'plan-ceo-review-mode',skill:'plan-ceo-review',category:'routing',door_type:'two-way'});
  const routing=s.slice(s.indexOf('3. その推奨を解決します'),s.indexOf('4. **モードの引き継ぎ:**'));
  expectMentions(routing,[['`question_id=plan-ceo-review-mode`','確認'],['`AUTO_DECIDE`','推奨','選び'],['手順 4','自動的な引き継ぎ'],['調整が false','省き']],'routing');
  const handoff=s.split('**モードの引き継ぎ:**')[1]!;
  expect(handoff).toContain('`'+id+': AUTO_DECIDE`');
  expect(handoff).toContain('Auto-decided review mode → <selected mode> (your preference)');
  const asked=routing.split('確認が成功しない場合は、')[1]!;
  expectMentions(asked,[['4 つのモードすべて','AskUserQuestion']],'asked');
  expect(asked).toContain('**回答を待って停止**');
  expect(asked).toContain('`QUESTION_TUNING: true`');
  expect(asked).toContain('`<gstack-qid:'+id+'>`');
  const logging=handoff.split('引き継ぎの後に、モードの出所を記録してください')[1]!.split('0D でアプローチ')[0]!.replace(/\s+/g,' ');
  expectMentions(logging,[['質問をしていない','質問ログはありません']],'logging');
  expect(logging).toContain('`'+id+'`');
  expect(logging).toContain('`auto_decided: true`');
  expectMentions(logging,[['`auto_decided: false`','記録'],['質問の ID','`QUESTION_TUNING: true`']],'logging');
  expect(s.indexOf('3. その推奨を解決します')).toBeGreaterThanOrEqual(0);
  expect(s.indexOf('4. **モードの引き継ぎ:**')).toBeGreaterThan(s.indexOf('3. その推奨を解決します'));
  expectMentions(handoff,[['選択の後','他のツール','前に']],'handoff');
  expect(handoff).toMatch(/`[^`]*\/bin\/gstack-ceo-mode-handoff /);
  expectMentions(handoff,[['その行で始まる','チャット']],'handoff');
  expect(s.slice(0,s.indexOf('4. **モードの引き継ぎ:**'))).not.toMatch(/\blog (?:with|that ID)\b/);
  expect(handoff.indexOf('引き継ぎの後に、モードの出所を記録してください')).toBeGreaterThan(handoff.indexOf('- その他の選択:'));
  expect(handoff.indexOf('選択されたモードのルートに従ってください')).toBeGreaterThan(handoff.indexOf('引き継ぎの後に、モードの出所を記録してください'));
  expect(s).not.toContain('plan-ceo-review-mode-selection');
 }
 for(const document of rendered.values()){
  expect(tuning(document)).toContain('<gstack-qid:{question_id}>');
  expect(tuning(document)).toContain('"question_id":"<id>"');
 }
});
test('both rendered canonical checks actually honor a stored never-ask preference',()=>{
 for(const host of rendered.keys()){
  const {result,run}=checkWithPreference(host,'never-ask');
  expect(result.stdout.trim()).toBe('AUTO_DECIDE');
  const wrong=run(['--check','plan-ceo-review-mode-selection','--summary-stdin'],'Select the CEO review mode.');
  expect(wrong.status).toBe(0);expect(wrong.stdout.trim()).toBe('ASK_NORMALLY');
 }
});
test('absent, always-ask and foreign preferences do not authorize either host to select a mode',()=>{
 for(const host of rendered.keys()){
  for(const [preference,id] of [[undefined,undefined],['always-ask',undefined],['never-ask','plan-design-review-mode']] as const){
   expect(checkWithPreference(host,preference,id).result.stdout.trim()).toBe('ASK_NORMALLY');
  }
 }
});
test('only an explicit user selection or enabled successful mode check bypasses asking',()=>{
 for(const document of rendered.values()){
  const s=section(document),q=tuning(document);
  expectMentions(s,[['明示的に選んだ場合','手順 2〜3','飛ばします']],'s');
  const routing=s.slice(s.indexOf('3. その推奨を解決します'),s.indexOf('4. **モードの引き継ぎ:**'));
  expectMentions(routing,[['`QUESTION_TUNING: true`','`question_id=plan-ceo-review-mode`','確認'],['調整が false','省き'],['`AUTO_DECIDE`','推奨','選び']],'routing');
  expect(s).toContain('**回答を待って停止**');
  expect(document).toContain('## Question Tuning(`QUESTION_TUNING: false` の場合は丸ごとスキップ)');
  expectMentions(q,[['`AUTO_DECIDE`','推奨オプション','選ぶ'],['`ASK_NORMALLY`','質問']],'q');
  expect(q).toContain('Auto-decided [summary] → [option] (your preference). Change with /plan-tune.');
  expectMentions(s,[['モードを選んでも','変更','承認されません']],'s');
  expectMentions(document,[['必要な選択がない場合','0E','進んでください']],'document');
  expectMentions(s,[['0D','承認','維持'],['提案された追加や削除','尋ねて'],['4 つのモードすべて','AskUserQuestion'],['手順 2 の推奨'],['15 を超える','SCOPE REDUCTION','推奨'],['ファイル数のしきい値','尋ねて'],['新規ファイル、編集、削除','数えて'],['推定した数','推定値'],['カバレッジ','種類'],['完全性のスコアは付けないでください']],'s');
  expectMentions(document,[['8 ファイルを超える','新しいクラスやサービス','2 つを超える'],['注記','カバレッジ','種類']],'document');
}
});
test('rendered mode contract stays within the existing canonical skeleton cap',()=>{
 // --out-dir changes section-link roots only. Undo that output-location
 // substitution before measuring the same canonical bytes as parity-suite.
 const out=path.join(temp,'claude').replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const canonical=rendered.get('claude')!.replace(new RegExp(out+'/([^\\s)`"\'*]+/sections/)','g'),(_m,p1)=>'~/.claude/skills/gstack/'+p1);
 const cap=Object.values(CARVE_GUARDS).find(g=>g.skill==='plan-ceo-review')!.maxSkeletonBytes;
 expect(Buffer.byteLength(canonical)).toBeLessThanOrEqual(cap);
});
