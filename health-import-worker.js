import {Unzip, UnzipInflate} from './assets/vendor/fflate/fflate.mjs';
import {createAppleParser, parseCSV, FILE_LIMIT, XML_LIMIT} from './health-import.mjs';

self.onmessage = async ({data: {file}}) => {
  try {
    if (!file?.size || file.size > FILE_LIMIT) throw new Error('เลือกไฟล์ที่มีข้อมูลและขนาดไม่เกิน 100 MB');
    if (/\.csv$/i.test(file.name)) {
      if (file.size > 10 * 1024 * 1024) throw new Error('CSV ต้องมีขนาดไม่เกิน 10 MB');
      self.postMessage({result: parseCSV(await file.text(), file.name)}); return;
    }
    if (!/\.(zip|xml)$/i.test(file.name)) throw new Error('รองรับ Apple Health ZIP/XML และ CSV สรุปรายวัน');
    const parser = createAppleParser(), decoder = new TextDecoder('utf-8', {fatal: true});
    let extracted = 0, processed = 0, found = false, complete = false, lastProgress = 0, zipError;
    function feed(bytes, final) {
      extracted += bytes.length;
      if (extracted > XML_LIMIT) throw new Error('ข้อมูล XML ใหญ่เกิน 512 MB กรุณาใช้ CSV สรุปรายวันแทน');
      parser.push(decoder.decode(bytes, {stream: !final}));
      if (final) complete = true;
    }
    let unzip;
    if (/\.zip$/i.test(file.name)) {
      unzip = new Unzip(entry => {
        if (!/(^|\/)export\.xml$/i.test(entry.name) || /^(__MACOSX\/|.*\/\._)/.test(entry.name)) return;
        if (found) return;
        found = true;
        if (entry.originalSize > XML_LIMIT) throw new Error('ข้อมูล XML ใหญ่เกิน 512 MB กรุณาใช้ CSV สรุปรายวันแทน');
        entry.ondata = (error, bytes, final) => {if (error) zipError = error; else feed(bytes, final);};
        entry.start();
      });
      unzip.register(UnzipInflate);
    } else found = true;
    const reader = file.stream().getReader();
    while (true) {
      const {value, done} = await reader.read();
      if (done) break;
      if (unzip) {
        // Bound each inflation burst, including archives with no declared size.
        for (let offset = 0; offset < value.length; offset += 8192) {
          unzip.push(value.subarray(offset, offset + 8192), false);
          if (zipError) throw zipError;
        }
      } else feed(value, false);
      if (zipError) throw zipError;
      processed += value.length;
      if (Date.now() - lastProgress > 120) {
        self.postMessage({progress: Math.round(processed / file.size * 100)}); lastProgress = Date.now();
      }
    }
    if (unzip) unzip.push(new Uint8Array(), true); else feed(new Uint8Array(), true);
    if (zipError) throw zipError;
    if (!found) throw new Error('ZIP นี้ไม่มี export.xml ของ Apple Health สำหรับ Zepp / Samsung Health ให้เลือก CSV สรุปรายวัน หรือกรอกยอดเอง');
    if (!complete) throw new Error('ไฟล์ไม่สมบูรณ์ กรุณาส่งออกใหม่');
    self.postMessage({result: parser.finish()});
  } catch (e) {self.postMessage({error: /[ก-๙]/.test(e.message || '') ? e.message : 'อ่านไฟล์ไม่สำเร็จ กรุณาตรวจรูปแบบไฟล์ ZIP ต้องไม่เสียหายหรือมีรหัสผ่าน และ CSV/XML ต้องเป็น UTF-8'});}
};
