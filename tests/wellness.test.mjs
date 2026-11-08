import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const W=createRequire(import.meta.url)('../wellness.js');

test('legacy state migration preserves every log and health source while deriving character colors',()=>{
  const raw={profile:{name:'Mint',c1:'#123456',hc:'#654321',skin:3,gl:true},goal:{target:60},logs:{'2026-11-01':{meals:[{id:'a'}],health:{activeKcal:400},water:[{id:'w',ml:250}]}},custom:[{name:'own'}],unknownFutureField:{value:1}};
  const state=W.normalizeState(raw,{profile:{height:170},goal:{stepGoal:8000},fast:{hours:16,hist:[]}});
  assert.deepEqual(state.logs,raw.logs);assert.deepEqual(state.custom,raw.custom);assert.deepEqual(state.unknownFutureField,raw.unknownFutureField);
  assert.equal(state.character.top,'#123456');assert.equal(state.character.accessory,'glasses');assert.equal(state.character.skin,'#C98F62');
  assert.equal(state.profile.height,170);assert.equal(state.wellness.waterGoal,2000);assert.equal(state.fast.hours,16);
});
test('new settings, favorites and templates survive reload without retaining photo blobs',()=>{
  const food={id:'f',name:'meal',serving:'1 bowl',qty:1.5,kcal:450,p:20,c:60,f:15,nomac:false,img:'private photo',_h:'search index'};
  const input={wellness:{waterGoal:1750,glassMl:300,macroMode:'custom',macroSplit:{p:30,c:40,f:30}},favorites:[food],mealTemplates:[{id:'t',name:'Breakfast',items:[food]}],character:{skin:'#aabbcc',outfit:'explorer',accessory:'cap',pose:'wave',scene:'night'}};
  const state=W.normalizeState(input);assert.deepEqual(W.normalizeState(JSON.parse(JSON.stringify(state))),state);
  assert.equal(state.favorites[0].img,undefined);assert.equal(state.mealTemplates[0].items[0].img,undefined);assert.equal(state.character.outfit,'explorer');
});
test('macro splits require complete valid percentages and convert energy using 4/4/9',()=>{
  assert.equal(W.validateMacroSplit({p:30,c:40,f:30}),true);
  for(const split of [{p:0,c:70,f:30},{p:25,c:45,f:29},{p:30.5,c:40,f:29.5},{p:NaN,c:40,f:60}])assert.equal(W.validateMacroSplit(split),false);
  assert.deepEqual(W.macroTargets(2000,{p:30,c:40,f:30}),{p:150,c:200,f:66.7});
  assert.deepEqual(W.normalizeState({wellness:{macroSplit:{p:99,c:99,f:99}}}).wellness.macroSplit,W.SPLITS.balanced);
});
test('saved portions scale totals once and preserve fractional units and unknown nutrition',()=>{
  const meal={name:'rice',serving:'100 g',qty:2.5,kcal:325,p:0,c:0,f:0,nomac:true,img:'excluded'};
  assert.deepEqual(W.scaleFood(meal,2),{name:'rice',serving:'100 g',qty:5,kcal:650,p:0,c:0,f:0,nomac:true,source:''});
  assert.equal(W.scaleFood(meal,0),null);assert.equal(W.foodSnapshot({...meal,kcal:-1}),null);assert.equal(W.foodSnapshot({...meal,kcal:NaN}),null);
});
test('weekly insights average only recorded food days, distinguish no weight change data, and exclude future dates',()=>{
  const state={logs:{'2026-11-01':{meals:[{kcal:1000,p:50}]},'2026-11-03':{meals:[{kcal:2000,p:100,nomac:true}],water:[{ml:250},{ml:500}],steps:7000,workouts:[{min:30}]},'2026-11-08':{meals:[{kcal:9999}]}},weights:[{d:'2026-11-03',w:65}]};
  const summary=W.weeklySummary(state,'2026-11-07');assert.equal(summary.days.length,7);assert.equal(summary.foodDays,2);assert.equal(summary.avgKcal,1500);assert.equal(summary.avgProtein,75);
  assert.equal(summary.totalWaterMl,750);assert.equal(summary.waterDays,1);assert.equal(summary.totalSteps,7000);assert.equal(summary.totalMinutes,30);assert.equal(summary.unknownMacros,1);assert.equal(summary.weightChange,null);
  state.weights.push({d:'2026-11-07',w:64.6});assert.equal(W.weeklySummary(state,'2026-11-07').weightChange,-0.4);
  assert.equal(W.weeklySummary({logs:{}},'2026-11-07').avgKcal,null);assert.throws(()=>W.weeklySummary(state,'2026-02-30'));
});
test('favorite identities distinguish serving/source and legacy all-zero nutrition is treated as unknown',()=>{
  const food={name:'rice',serving:'100 g',kcal:130,p:0,c:0,f:0};
  assert.equal(W.foodSnapshot(food).nomac,true);
  assert.notEqual(W.foodIdentity(food),W.foodIdentity({...food,serving:'1 plate'}));
  assert.notEqual(W.foodIdentity({...food,src:'D'}),W.foodIdentity({...food,source:'E'}));
  assert.equal(W.foodIdentity({...food,src:'D'}),W.foodIdentity(W.foodSnapshot({...food,src:'D'})));
});
test('water history ignores invalid entries and milestones reward recording rather than calorie restriction',()=>{
  assert.equal(W.waterTotal({water:[{ml:250},{ml:500},{ml:-100},{ml:NaN},{ml:Infinity},{ml:6000}]}),750);
  const state={logs:{}};for(let i=1;i<=7;i++)state.logs['2026-11-0'+i]={meals:[{kcal:4000}],water:[{ml:250}],steps:100};
  const progress=W.milestones(state,'2026-11-07');assert.equal(progress.trackedDays,7);assert.equal(progress.badges.filter(b=>b.unlocked).length,4);
  state.logs['2026-11-08']={meals:[{}]};assert.equal(W.milestones(state,'2026-11-07').trackedDays,7);
});
