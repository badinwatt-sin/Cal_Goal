import test from 'node:test';
import assert from 'node:assert/strict';
import {createAppleParser, parseCSV, csvDays, dateKey, validNumber, selectAppleDays, applyHealthDays} from '../health-import.mjs';

const record = (type, source, unit, value, time='2026-11-07 10:00:00 +0700') => `<Record type="HKQuantityTypeIdentifier${type}" sourceName="${source}" unit="${unit}" value="${value}" startDate="${time}" endDate="${time}"/>`;
const xml = '<HealthData locale="th_TH">'+[
  record('StepCount','Apple Watch','count',3000),
  record('StepCount','Apple Watch','count',2000,'2026-11-07 23:30:00 +0700'),
  record('StepCount','iPhone','count',4800),
  record('ActiveEnergyBurned','Apple Watch','kJ',418.4),
  record('BodyMass','Scale &amp; Phone','lb',132.277),
  record('HeartRate','Apple Watch','count/min',80),
  record('StepCount','Apple Watch','count',0,'2026-11-08 00:10:00 +0700')
].join('')+'</HealthData>';

test('Apple XML streams across arbitrary tag boundaries and keeps sources separate',()=>{
  const parser=createAppleParser();
  for(let i=0;i<xml.length;i+=7)parser.push(xml.slice(i,i+7));
  const result=parser.finish();
  assert.equal(result.sources.length,3);
  const days=selectAppleDays(result,{steps:'Apple Watch',activeKcal:'Apple Watch',weightKg:'Scale & Phone'});
  assert.deepEqual(days,[{date:'2026-11-07',steps:5000,activeKcal:100,weightKg:60},{date:'2026-11-08',steps:0}]);
  assert.equal(days[0].steps,5000,'iPhone steps must not be added to Watch steps');
});
test('malformed or truncated Apple exports fail before applying data',()=>{
  const p=createAppleParser();p.push('<HealthData>'+record('StepCount','Watch','count',100));
  assert.throws(()=>p.finish(),/ไม่สมบูรณ์/);
  const q=createAppleParser();q.push('<Other/>');assert.throws(()=>q.finish(),/ไม่สมบูรณ์/);
});
test('dates preserve recorded day, accept Thai Buddhist years and reject rollover dates',()=>{
  assert.equal(dateKey('2026-11-07 23:59:59 -0800'),'2026-11-07');
  assert.equal(dateKey('7/11/2569'),'2026-11-07');
  assert.equal(dateKey('2026-02-30'),null);
  assert.equal(dateKey('not a date'),null);
});
test('CSV handles BOM, quoted thousands and duplicate daily totals without adding them',()=>{
  const data=parseCSV('\uFEFFdate,steps,active_kcal,weight_kg\r\n2026-11-07,"8,000",300,60\r\n2026-11-07,7500,280,59.9\r\n2026-11-08,0,0,\r\n');
  assert.deepEqual(csvDays(data,data.mapping).days,[{date:'2026-11-07',steps:8000,activeKcal:300,weightKg:59.9},{date:'2026-11-08',steps:0,activeKcal:0}]);
});
test('Samsung daily-step CSV accepts the metadata preamble and requires explicit active energy mapping',()=>{
  const data=parseCSV('com.samsung.shealth.step_daily_trend,1,2\nday_time,count,calorie\n2026-11-07,6500,230\n','com.samsung.shealth.step_daily_trend.csv');
  assert.equal(data.mapping.activeKcal,-1,'step calories are not automatically treated as total active energy');
  assert.deepEqual(csvDays(data,data.mapping).days,[{date:'2026-11-07',steps:6500}]);
});
test('manual CSV column mapping converts pounds and skips invalid rows',()=>{
  const data=parseCSV('When;Scale;Daily steps\n7/11/2569;132.277;5000\nbad;140;2000\n');
  assert.deepEqual(csvDays(data,{date:0,weightKg:1,steps:2,activeKcal:-1},'lb'),{days:[{date:'2026-11-07',steps:5000,weightKg:60}],skipped:1});
});
test('invalid numbers and malformed quotes do not silently become health readings',()=>{
  for(const v of ['', ' ', true, -1, Infinity, '1,2'])assert.equal(validNumber(v,'steps'),undefined);
  assert.equal(validNumber('0','activeKcal'),0);
  assert.equal(validNumber('8,000','steps'),8000);
  assert.throws(()=>parseCSV('date,steps\n"2026-11-07,5000'),/คำพูด/);
});
test('imports are idempotent, preserve meals/workouts, and retain selected-day history',()=>{
  const state={profile:{weight:61},logs:{'2026-11-07':{steps:2000,meals:[{name:'ข้าว',kcal:500}],workouts:[{name:'วิ่ง',kcal:200}]}},weights:[{d:'2026-11-07',w:61}]};
  const before=JSON.stringify(state),days=[{date:'2026-11-07',steps:8000,activeKcal:400,weightKg:60}];
  const selected={steps:true,activeKcal:true,weightKg:true};
  const first=applyHealthDays(state,days,selected,'Apple Health','now','2026-11-08');
  assert.deepEqual(first.changes,{days:1,steps:1,activeKcal:1,weightKg:1});
  assert.equal(JSON.stringify(state),before,'preview must not mutate existing data');
  assert.deepEqual(first.state.logs['2026-11-07'].meals,state.logs['2026-11-07'].meals);
  assert.deepEqual(first.state.logs['2026-11-07'].workouts,state.logs['2026-11-07'].workouts);
  assert.equal(first.state.profile.weight,61);
  const second=applyHealthDays(first.state,days,selected,'Apple Health','later','2026-11-08');
  assert.equal(second.changes.days,0);
  assert.equal(second.state.logs['2026-11-07'].steps,8000);
});
test('unselected fields and future dates are excluded; zero energy replaces earlier energy',()=>{
  const s={logs:{'2026-11-07':{steps:5000,meals:[],workouts:[],health:{activeKcal:300,energySource:'Watch'}}},weights:[]};
  const out=applyHealthDays(s,[{date:'2026-11-07',steps:6000,activeKcal:0},{date:'2026-11-09',steps:100}],{steps:false,activeKcal:true},'Phone','now','2026-11-08');
  assert.equal(out.state.logs['2026-11-07'].steps,5000);
  assert.equal(out.state.logs['2026-11-07'].health.activeKcal,0);
  assert.equal(out.state.logs['2026-11-09'],undefined);
});
