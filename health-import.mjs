// Parsing and merging are intentionally independent of the UI. Only daily
// steps, active energy and weight are kept; raw exports never leave the device.
export const FILE_LIMIT = 100 * 1024 * 1024;
export const XML_LIMIT = 512 * 1024 * 1024;
const fields = ['steps', 'activeKcal', 'weightKg'];
const ranges = {steps: [0, 200000], activeKcal: [0, 20000], weightKg: [5, 500]};
const round = n => Math.round(n * 100) / 100;
export function validNumber(value, field) {
  if (value === '' || value == null || typeof value === 'boolean') return undefined;
  const text = String(value).trim();
  if (!text || (text.includes(',') && !/^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(text))) return undefined;
  const n = Number(text.replace(/,/g, ''));
  const range = ranges[field];
  if (!range || !Number.isFinite(n) || n < range[0] || n > range[1]) return undefined;
  return field === 'steps' ? Math.round(n) : round(n);
}
export function dateKey(value) {
  let s = String(value ?? '').trim();
  if (/^\d{10}(\d{3})?$/.test(s)) {
    const d = new Date(Number(s) * (s.length === 10 ? 1000 : 1));
    s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  const local = /^(\d{4})-(\d{2})-(\d{2})(?:$|[ T])/.exec(s);
  const dayFirst = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (!local && !dayFirst) return null;
  let [y, m, d] = local ? local.slice(1).map(Number) : [Number(dayFirst[3]), Number(dayFirst[2]), Number(dayFirst[1])];
  if (y >= 2400) y -= 543;
  const check = new Date(Date.UTC(y, m - 1, d));
  if (y < 2000 || y > 2100 || check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function decodeXML(s) {
  return s.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, code) => {
    if (code[0] === '#') {
      const n = parseInt(code.slice(code[1].toLowerCase() === 'x' ? 2 : 1), code[1].toLowerCase() === 'x' ? 16 : 10);
      return n <= 0x10ffff ? String.fromCodePoint(n) : '';
    }
    return {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'"}[code.toLowerCase()];
  });
}
export function createAppleParser() {
  const sources = new Map(), last = new Map();
  let buffer = '', isHealth = false, complete = false, records = 0;
  function push(text) {
    buffer += text;
    if (buffer.includes('<HealthData')) isHealth = true;
    if (buffer.includes('</HealthData>')) complete = true;
    // Match opening Record tags, including records with nested metadata.
    const re = /<Record\b[^>]*>/g;
    let match, consumed = 0;
    while ((match = re.exec(buffer))) {
      consumed = re.lastIndex;
      if (!/\btype\s*=\s*["']HKQuantityTypeIdentifier(?:StepCount|ActiveEnergyBurned|BodyMass)["']/.test(match[0])) continue;
      const a = Object.create(null);
      for (const attr of match[0].matchAll(/([\w:]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) a[attr[1]] = decodeXML(attr[2] ?? attr[3]);
      const field = {HKQuantityTypeIdentifierStepCount: 'steps', HKQuantityTypeIdentifierActiveEnergyBurned: 'activeKcal', HKQuantityTypeIdentifierBodyMass: 'weightKg'}[a.type];
      if (!fields.includes(field)) continue;
      const date = dateKey(a.startDate), source = (a.sourceName || 'Apple Health').slice(0, 120);
      let value = Number(a.value);
      const unit = (a.unit || '').toLowerCase();
      if (field === 'steps' && unit !== 'count') continue;
      if (field === 'activeKcal') {
        if (unit === 'kj') value /= 4.184;
        else if (unit === 'j') value /= 4184;
        else if (!['kcal', 'cal'].includes(unit)) continue;
        // Apple uses kcal/Cal for dietary calories, not the lowercase SI cal.
        if (a.unit === 'cal') continue;
      }
      if (field === 'weightKg') {
        if (['lb', 'lbs'].includes(unit)) value *= .45359237;
        else if (unit === 'g') value /= 1000;
        else if (unit !== 'kg') continue;
      }
      if (!date || validNumber(value, field) === undefined) continue;
      const key = `${source}|${field}`, sample = `${a.startDate}|${a.endDate}|${a.value}`;
      if (last.get(key) === sample) continue;
      last.set(key, sample);
      if (!sources.has(source)) {
        if (sources.size >= 100) throw new Error('ไฟล์มีแหล่งข้อมูลมากเกินไป ลองใช้ CSV สรุปรายวัน');
        sources.set(source, new Map());
      }
      const days = sources.get(source);
      if (!days.has(date)) {
        if (days.size >= 10000) throw new Error('ไฟล์มีช่วงวันที่มากเกินไป');
        days.set(date, {date});
      }
      const day = days.get(date);
      if (field === 'weightKg') {
        if (!day.weightTime || a.startDate > day.weightTime) {day.weightKg = round(value); day.weightTime = a.startDate;}
      } else day[field] = (day[field] ?? 0) + value;
      records++;
    }
    if (consumed) buffer = buffer.slice(consumed);
    // Keep incomplete XML tags across UTF-8/chunk boundaries, without retaining
    // the complete export or unrelated health records.
    const pending = buffer.lastIndexOf('<');
    buffer = pending >= 0 ? buffer.slice(pending) : buffer.slice(-30);
    if (buffer.length > 128 * 1024) throw new Error('รูปแบบ XML ไม่ถูกต้องหรือมีรายการยาวเกินไป');
  }
  function finish() {
    if (!isHealth || !complete) throw new Error('ไฟล์ Apple Health ไม่สมบูรณ์ กรุณาส่งออกใหม่');
    const data = [...sources].map(([source, dates]) => ({source, days: [...dates.values()].map(day => {
      const clean = {date: day.date};
      for (const f of fields) {const n = validNumber(day[f], f); if (n !== undefined) clean[f] = n;}
      return clean;
    }).filter(d => fields.some(f => d[f] !== undefined)).sort((a, b) => a.date.localeCompare(b.date))})).filter(s => s.days.length);
    if (!data.length) throw new Error('ไม่พบก้าวเดิน พลังงานกิจกรรม หรือน้ำหนักในไฟล์นี้');
    return {format: 'apple', sources: data, records};
  }
  return {push, finish};
}

// CSV is a daily-summary format: multiple rows for the same date use the
// largest daily step/energy total, rather than summing duplicate device totals.
export function parseCSV(text, filename = '') {
  const input = text.replace(/^\uFEFF/, ''), lines = input.split(/\r?\n/);
  const likelyHeader = lines.findIndex(line => /(?:date|วันที่|day_time|start_time)/i.test(line) && /[,;\t]/.test(line));
  const raw = likelyHeader > 0 ? lines.slice(likelyHeader).join('\n') : input;
  const first = raw.split(/\r?\n/, 1)[0];
  const delimiter = ['\t', ';', ','].sort((a, b) => first.split(b).length - first.split(a).length)[0];
  const rows = []; let row = [], value = '', quoted = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === '"') {
      if (quoted && raw[i + 1] === '"') {value += '"'; i++;}
      else quoted = !quoted;
    } else if (!quoted && (c === delimiter || c === '\n' || c === '\r')) {
      row.push(value.trim()); value = '';
      if (c !== delimiter) {
        if (row.some(Boolean)) rows.push(row);
        row = []; if (c === '\r' && raw[i + 1] === '\n') i++;
      }
    } else value += c;
    if (rows.length > 20001 || value.length > 100000) throw new Error('CSV ใหญ่เกินไป เลือกไฟล์สรุปรายวันที่มีไม่เกิน 20,000 แถว');
  }
  if (quoted) throw new Error('CSV มีเครื่องหมายคำพูดไม่ครบ กรุณาตรวจไฟล์');
  row.push(value.trim()); if (row.some(Boolean)) rows.push(row);
  const columns = rows.shift();
  if (!columns || !rows.length || columns.length > 100 || rows.some(r => r.length > columns.length)) throw new Error('CSV ต้องมีหัวคอลัมน์และข้อมูลสรุปรายวัน');
  const names = columns.map(s => s.toLowerCase().replace(/[\s().-]/g, '_'));
  const index = list => names.findIndex(n => list.includes(n));
  const mapping = {
    date: index(['date', 'วันที่', 'day', 'day_time', 'start_time', 'timestamp']),
    steps: index(['steps', 'step_count', 'จำนวนก้าว', 'ก้าว']),
    activeKcal: index(['active_kcal', 'active_calories', 'active_energy_burned']),
    weightKg: index(['weight_kg', 'น้ำหนัก_กก', 'body_mass_kg'])
  };
  if (mapping.steps < 0 && /step_daily|step_count/i.test(filename)) mapping.steps = index(['count']);
  return {format: 'csv', columns, rows, mapping, filename: filename.slice(0, 160)};
}
export function csvDays(data, mapping, weightUnit = 'kg') {
  if (mapping.date < 0) throw new Error('เลือกคอลัมน์วันที่ก่อน');
  if (!fields.some(f => mapping[f] >= 0)) throw new Error('เลือกคอลัมน์ข้อมูลอย่างน้อยหนึ่งรายการ');
  const days = new Map(); let skipped = 0;
  for (const row of data.rows) {
    const date = dateKey(row[mapping.date]);
    if (!date) {skipped++; continue;}
    const out = days.get(date) || {date}; let found = false;
    for (const field of fields) {
      if (mapping[field] < 0) continue;
      let input = row[mapping[field]];
      if (field === 'weightKg' && weightUnit === 'lb' && input?.trim()) {
        if (input.includes(',') && !/^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(input)) continue;
        input = Number(input.replace(/,/g, '')) * .45359237;
      }
      const n = validNumber(input, field);
      if (n === undefined) continue;
      out[field] = field === 'weightKg' ? n : Math.max(out[field] ?? 0, n); found = true;
    }
    if (found) days.set(date, out); else skipped++;
  }
  return {days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)), skipped};
}
export function selectAppleDays(data, selections) {
  const days = new Map();
  for (const field of fields) {
    const source = data.sources.find(s => s.source === selections[field]);
    if (!source) continue;
    for (const entry of source.days) {
      if (entry[field] === undefined) continue;
      if (!days.has(entry.date)) days.set(entry.date, {date: entry.date});
      days.get(entry.date)[field] = entry[field];
    }
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}
export function applyHealthDays(state, days, selected, source, importedAt, today) {
  const next = {...state, logs: {...state.logs}, weights: state.weights.map(w => ({...w}))};
  const changes = {days: 0, steps: 0, activeKcal: 0, weightKg: 0};
  for (const day of days) {
    if (!dateKey(day.date) || day.date > today) continue;
    let changed = false;
    const previous = next.logs[day.date] || {meals: [], workouts: [], steps: 0};
    const log = {...previous, health: {...previous.health}};
    if (selected.steps && validNumber(day.steps, 'steps') !== undefined && log.steps !== day.steps) {
      log.steps = day.steps; log.health.stepSource = source.slice(0, 120); changes.steps++; changed = true;
    }
    if (selected.activeKcal && validNumber(day.activeKcal, 'activeKcal') !== undefined && log.health.activeKcal !== day.activeKcal) {
      log.health.activeKcal = day.activeKcal; log.health.energySource = source.slice(0, 120); changes.activeKcal++; changed = true;
    }
    if (selected.weightKg && validNumber(day.weightKg, 'weightKg') !== undefined) {
      const existing = next.weights.find(w => w.d === day.date);
      if (!existing || existing.w !== day.weightKg) {
        if (existing) existing.w = day.weightKg; else next.weights.push({d: day.date, w: day.weightKg});
        changes.weightKg++; changed = true;
      }
    }
    if (changed) {
      log.health.source = source.slice(0, 120); log.health.importedAt = importedAt;
      next.logs[day.date] = log; changes.days++;
    }
  }
  next.weights.sort((a, b) => a.d.localeCompare(b.d));
  return {state: next, changes};
}
