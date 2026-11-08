/* Shared, dependency-free data rules for daily wellness features. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CalGoalWellness = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const SPLITS = {balanced:{p:25,c:45,f:30},protein:{p:30,c:40,f:30}};
  const clamp = (value, min, max, fallback) => value!==null && value!=='' && Number.isFinite(+value) ? Math.min(max, Math.max(min, +value)) : fallback;
  const round = (value, precision=1) => Math.round(value * 10 ** precision) / 10 ** precision;
  const hex = (value, fallback) => /^#[\da-f]{6}$/i.test(value || '') ? value : fallback;
  const pick = (value, choices, fallback) => choices.includes(value) ? value : fallback;
  const text = (value, max) => String(value || '').trim().slice(0,max);
  const SKINS = ['#FBE0CC','#F3CBA6','#E3AE82','#C98F62','#A96F48','#7A4A2E'];
  function validDate(key) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key || '')) return false;
    const d = new Date(key + 'T12:00:00Z');
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10) === key;
  }
  function addDays(key, amount) {
    const d = new Date(key + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate()+amount); return d.toISOString().slice(0,10);
  }
  function validateMacroSplit(split) {
    return !!split && ['p','c','f'].every(k => Number.isInteger(+split[k]) && +split[k]>=5 && +split[k]<=70)
      && +split.p + +split.c + +split.f === 100;
  }
  function normalizeCharacter(raw={}, profile={}) {
    const legacyHair = ['short','long','bob','bob','long','curl'][profile.hs] || (profile.sex==='m'?'short':'bob');
    return {
      name:text(raw.name,24), preset:pick(raw.preset,['mint','sunset','lavender','night','custom'],'mint'),
      skin:hex(raw.skin,SKINS[profile.skin] || SKINS[0]), top:hex(raw.top,hex(profile.c1,'#65BDA2')),
      bottom:hex(raw.bottom,hex(profile.c2,'#314E48')), hairColor:hex(raw.hairColor,hex(profile.hc,'#332B2A')),
      hair:pick(raw.hair,['short','bob','long','curl','buzz'],legacyHair),
      outfit:pick(raw.outfit,['hoodie','sport','casual','explorer'],'hoodie'),
      accessory:pick(raw.accessory,['none','glasses','cap','headphones'],profile.gl?'glasses':'none'),
      pose:pick(raw.pose,['idle','wave','cheer','stretch'],'idle'),
      scene:pick(raw.scene,['mint','sunset','lavender','night'],'mint'),
      badge:pick(raw.badge,['leaf','spark','sun','moon'],'leaf')
    };
  }
  function foodSnapshot(food) {
    if (!food || !text(food.name,100) || !Number.isFinite(+food.kcal) || +food.kcal<0 || +food.kcal>20000) return null;
    return {
      name:text(food.name,100),serving:text(food.serving || '1 หน่วย',200),
      qty:round(clamp(food.qty,0.1,100,1),2),kcal:Math.round(+food.kcal),
      p:round(clamp(food.p,0,5000,0)),c:round(clamp(food.c,0,5000,0)),f:round(clamp(food.f,0,5000,0)),
      nomac:unknownNutrition(food),source:text(food.source || food.src,60)
    };
  }
  function unknownNutrition(food) {return !!food?.nomac || (+food?.kcal>0 && !(+food?.p || +food?.c || +food?.f));}
  function foodIdentity(food) {
    const item=foodSnapshot(food);if(!item)return '';
    return JSON.stringify([item.name,item.serving,item.kcal,item.p,item.c,item.f,item.nomac,item.source]);
  }
  function scaleFood(food, factor) {
    const item=foodSnapshot(food);
    if (!item || !Number.isFinite(+factor) || +factor<=0 || +factor>20) return null;
    return {...item,qty:round(item.qty*factor,2),kcal:Math.round(item.kcal*factor),p:round(item.p*factor),c:round(item.c*factor),f:round(item.f*factor)};
  }
  function normalizeState(raw={}, base={}) {
    const profile={...base.profile,...raw.profile},w=raw.wellness || {};
    const split=validateMacroSplit(w.macroSplit)?Object.fromEntries(['p','c','f'].map(k=>[k,+w.macroSplit[k]])):{...SPLITS.balanced};
    const favoriteList=Array.isArray(raw.favorites)?raw.favorites:[];
    const templateList=Array.isArray(raw.mealTemplates)?raw.mealTemplates:[];
    return {
      ...base,...raw,profile,goal:{...base.goal,...raw.goal},fast:{...base.fast,...raw.fast},
      logs:raw.logs && typeof raw.logs==='object' && !Array.isArray(raw.logs)?raw.logs:{},
      weights:Array.isArray(raw.weights)?raw.weights:[],custom:Array.isArray(raw.custom)?raw.custom:[],recent:Array.isArray(raw.recent)?raw.recent:[],
      wellness:{waterGoal:Math.round(clamp(w.waterGoal,250,10000,2000)),glassMl:Math.round(clamp(w.glassMl,50,2000,250)),
        macroMode:pick(w.macroMode,['balanced','protein','custom'],'balanced'),macroSplit:split},
      character:normalizeCharacter(raw.character || {},profile),
      favorites:favoriteList.map((f,i)=>{const food=foodSnapshot(f);return food?{...food,id:text(f.id,100)||'favorite-'+i}:null}).filter(Boolean),
      mealTemplates:templateList.map((m,i)=>{
        const items=(Array.isArray(m?.items)?m.items:[]).map(foodSnapshot).filter(Boolean);
        return text(m?.name,60)&&items.length?{id:text(m.id,100)||'meal-'+i,name:text(m.name,60),items}:null;
      }).filter(Boolean)
    };
  }
  function macroTargets(kcal, split=SPLITS.balanced) {
    const ratios=validateMacroSplit(split)?split:SPLITS.balanced,budget=clamp(kcal,0,20000,0);
    return {p:round(budget*ratios.p/100/4),c:round(budget*ratios.c/100/4),f:round(budget*ratios.f/100/9)};
  }
  function waterEntries(log) {
    return (Array.isArray(log?.water)?log.water:[]).filter(x=>x && Number.isFinite(+x.ml) && +x.ml>0 && +x.ml<=5000);
  }
  function waterTotal(log) {return waterEntries(log).reduce((sum,x)=>sum+(+x.ml),0);}
  function weeklySummary(state, endDate, length=7) {
    if (!validDate(endDate)) throw new Error('Invalid week end date');
    const count=Math.max(1,Math.min(31,Math.floor(length)||7)),days=[];
    for(let i=count-1;i>=0;i--){
      const date=addDays(endDate,-i),log=state.logs?.[date] || {},meals=Array.isArray(log.meals)?log.meals:[],works=Array.isArray(log.workouts)?log.workouts:[];
      days.push({date,foodLogged:meals.length>0,kcal:meals.reduce((sum,m)=>sum+clamp(m.kcal,0,20000,0),0),
        p:meals.reduce((sum,m)=>sum+clamp(m.p,0,5000,0),0),c:meals.reduce((sum,m)=>sum+clamp(m.c,0,5000,0),0),f:meals.reduce((sum,m)=>sum+clamp(m.f,0,5000,0),0),
        unknownMacros:meals.filter(unknownNutrition).length,steps:clamp(log.steps,0,200000,0),
        minutes:works.reduce((sum,w)=>sum+clamp(w.min,0,1440,0),0),waterMl:waterTotal(log)});
    }
    const foodDays=days.filter(d=>d.foodLogged),waterDays=days.filter(d=>d.waterMl>0),avg=key=>foodDays.length?round(foodDays.reduce((sum,d)=>sum+d[key],0)/foodDays.length):null;
    const weights=(Array.isArray(state.weights)?state.weights:[]).filter(w=>validDate(w.d)&&w.d>=days[0].date&&w.d<=endDate&&Number.isFinite(+w.w)&&+w.w>0).sort((a,b)=>a.d.localeCompare(b.d));
    return {start:days[0].date,end:endDate,days,foodDays:foodDays.length,waterDays:waterDays.length,
      avgKcal:avg('kcal'),avgProtein:avg('p'),unknownMacros:days.reduce((sum,d)=>sum+d.unknownMacros,0),
      totalSteps:days.reduce((sum,d)=>sum+d.steps,0),totalMinutes:days.reduce((sum,d)=>sum+d.minutes,0),
      totalWaterMl:waterDays.reduce((sum,d)=>sum+d.waterMl,0),
      weightChange:weights.length>=2?round(+weights.at(-1).w-(+weights[0].w)):null,weightReadings:weights.length};
  }
  function milestones(state, endDate) {
    const logs=Object.entries(state.logs || {}).filter(([date])=>validDate(date)&&date<=endDate);
    let trackedDays=0,waterDays=0,activeDays=0;
    for(const [,log] of logs){
      const food=Array.isArray(log?.meals)&&log.meals.length>0,water=waterTotal(log)>0,active=clamp(log?.steps,0,200000,0)>0||(Array.isArray(log?.workouts)&&log.workouts.length>0);
      if(food||water||active)trackedDays++;if(water)waterDays++;if(active)activeDays++;
    }
    return {trackedDays,waterDays,activeDays,badges:[
      {id:'leaf',name:'เริ่มต้นดูแลตัวเอง',description:'บันทึกสุขภาพ 1 วัน',value:trackedDays,target:1},
      {id:'spark',name:'จังหวะที่ต่อเนื่อง',description:'สะสมวันที่บันทึก 7 วัน',value:trackedDays,target:7},
      {id:'sun',name:'ทุกก้าวมีความหมาย',description:'บันทึกกิจกรรม 5 วัน',value:activeDays,target:5},
      {id:'moon',name:'ทีละแก้วในทุกวัน',description:'บันทึกน้ำดื่ม 5 วัน',value:waterDays,target:5}
    ].map(b=>({...b,unlocked:b.value>=b.target}))};
  }
  return {SPLITS,validateMacroSplit,normalizeCharacter,normalizeState,foodSnapshot,foodIdentity,unknownNutrition,scaleFood,macroTargets,waterEntries,waterTotal,weeklySummary,milestones,validDate};
});
