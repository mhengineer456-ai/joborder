/***** CONFIG — EDIT AS PER YOUR SETUP *****/
const SHEET_ID   = '1fKSwGBIpzWEFk566WRQ4bzQ0anJlmasoY8TwrTLQHXI'; // spreadsheet
const TARGET_TAB = 'JobOrder';                                       // data sheet/tab
const FOLDER_ID  = '1a2feVEIpklK2uREHajpQsF4gqKNJ0XBu';              // images/PDF folder

// (Kept for future, not used in challan status now)
const CUTTING_SHEET_ID = '1Hj3JeJEKB43aYYWv8gk2UhdU6BWuEQfCg5pBlTdBMNA';
const CUTTING_TAB      = 'Cutting';

/*** Single LotSeries sheet (party-wise + optional garment type) ***/
const LOT_TAB = 'LotSeries';

/*** Soft partial match enable ***/
const SOFT_MATCH_PARTY = true;
const SOFT_MATCH_GTYPE = true;

/***** EMAILS *****/
// ✅ Job Order emails ENABLED
const EMAIL_TO = [
  "mohithosieryfabric@gmail.com"
];
const EMAIL_CC = [
  "gparas287@gmail.com"
];
const EMAIL_SUBJECT_PFX = "New Job Order";

// ❌ Challan emails DISABLED (do not send)
const NOTIFIED_COL_NAME = "Email Notified At"; // stays as your anchor
const ORDER_NO_COL_NAME = "Order No.";         // lives just before NOTIFIED
const ATTACH_IMAGE_IF_PUBLIC = true;

/*** HEADER / COLUMN ORDER (JobOrder) - MATCH YOUR EXISTING SHEET ***/
const HEADER_ORDER = [
  'Job Order No','Date','Fabric','Brand','Shade','Size','Quantity','Unit',
  'Party Name','Garment Type','Section','Season',
  'Emb','Emb Details',
  'Printing','Printing Details',
  'Pattern','Style',
  'Remarks','Direct Stitching',
  'Submitted By','Image URL','Lot Number','Component',
  'Challan No','Challan Date','Challan Items JSON','Challan History JSON',
  'Challan Total Qty','Challan Complete Lot','Challan By','Challan PDF URL',
  'Priority',
  'Cancellation Timestamp','Cancelled By','Cancellation Approved From','Cancellation Reason','Status',
  'Tape/Lace','Bottom Type','Zip','Sticker','Collar','Bone','FULL BAJU',
  'Order No.','Email Notified At','FABRIC_SUPERVISOR'
];

/** Fields that come after Email Notified At (optional, for column insertion logic) */
const JOBORDER_AFTER_NOTIFIED = [
  'FABRIC_SUPERVISOR'
];

/***** Serials *****/
const SERIALS_TAB = 'Serials';
const DEFAULT_PAD = 4;

/** Cancel sheet/tab name */
const CANCEL_TAB = 'Cancel';

// --- in-request cache (cleared each invocation) ---
const _REQ_CACHE = { headerMap: null };

/*** SERIALS HELPERS ***/
function getOrCreateSerialsSheet_(){
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sh = ss.getSheetByName(SERIALS_TAB);
  if (!sh) {
    sh = ss.insertSheet(SERIALS_TAB);
    sh.getRange(1,1,1,2).setValues([['Series','Next']]);
    sh.getRange(2,1,2,2).setValues([['CH-EMB-', 1],['CH-PRT-', 1]]);
  } else {
    const first = sh.getRange(1,1,1,Math.max(2, sh.getLastColumn())).getValues()[0].map(v => String(v||'').trim());
    const have = new Set(first);
    const toAdd = [];
    if (!have.has('Series')) toAdd.push('Series');
    if (!have.has('Next'))   toAdd.push('Next');
    if (toAdd.length){
      sh.getRange(1, first.length+1, 1, toAdd.length).setValues([toAdd]);
    }
  }
  return sh;
}

function padSerial_(seriesPlusNum, width){
  const w = Number(width || DEFAULT_PAD);
  if (!w || w < 1) return seriesPlusNum;
  const m = seriesPlusNum.match(/^(.*-)(\d+)$/);
  if (!m) return seriesPlusNum;
  const pfx = m[1], n = m[2];
  return pfx + String(n).padStart(w, '0');
}

function reserveChallanNo_(series, zeroPad){
  if (!series) series = 'CH-EMB-';
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sh = getOrCreateSerialsSheet_();
    const header = sh.getRange(1,1,1,Math.max(2, sh.getLastColumn())).getValues()[0].map(v => String(v||'').trim());
    const colSeries = header.indexOf('Series') + 1;
    const colNext   = header.indexOf('Next') + 1;
    if (!colSeries || !colNext) throw new Error('Serials sheet must have "Series" and "Next" columns.');
    const lastRow = sh.getLastRow();
    let rowIdx = 0;
    if (lastRow >= 2) {
      const data = sh.getRange(2,1,lastRow-1,Math.max(2, sh.getLastColumn())).getValues();
      for (let i=0;i<data.length;i++){
        if (String(data[i][colSeries-1] || '').trim() === series) { rowIdx = 2 + i; break; }
      }
    }
    if (!rowIdx) {
      rowIdx = sh.getLastRow() + 1;
      sh.getRange(rowIdx, colSeries).setValue(series);
      sh.getRange(rowIdx, colNext).setValue(1);
    }
    let next = Number(sh.getRange(rowIdx, colNext).getValue() || 1);
    if (!Number.isFinite(next) || next < 1) next = 1;
    const challanNo = series + next;
    sh.getRange(rowIdx, colNext).setValue(next + 1);
    return padSerial_(challanNo, zeroPad);
  } finally { try { lock.releaseLock(); } catch (_){ } }
}

/*** JSON OUT ***/
function _jsonOut_(obj){ return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function ok_(obj){ return _jsonOut_(Object.assign({ success: true }, obj)); }
function fail_(msg, extra={}){ return _jsonOut_(Object.assign({ success:false, error:String(msg) }, extra)); }

/*** BODY PARSER — handles JSON and x-www-form-urlencoded (payload=...) ***/
function parseBody_(e) {
  if (!e || !e.postData) return {};
  const ct = String(e.postData.type || "").toLowerCase();

  // JSON body
  if (ct.indexOf("application/json") > -1) {
    try { return JSON.parse(e.postData.contents || "{}"); } catch (_) { return {}; }
  }

  // Form-encoded: expect payload=<JSON>
  if (e.parameter && typeof e.parameter.payload === "string") {
    try { return JSON.parse(e.parameter.payload); } catch (_) {}
  }

  // Fallback: manual parse of body into key/value then JSON.parse payload
  try {
    const pairs = (e.postData.contents || "").split("&").map(s => s.split("="));
    const obj = {};
    for (const [k, v] of pairs) obj[decodeURIComponent(k)] = decodeURIComponent(v || "");
    if (obj.payload) return JSON.parse(obj.payload);
  } catch (_) {}

  return {};
}

/*** OPEN SHEET ***/
function getSheet_(){
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sh = ss.getSheetByName(TARGET_TAB);
  if (!sh) sh = ss.insertSheet(TARGET_TAB);
  ensureHeaderAndMap_(sh);
  return { ss, sh, url: ss.getUrl() };
}

/*** HEADER REPAIR + MAP ***/
function ensureHeaderAndMap_(sh){
  if (_REQ_CACHE.headerMap) return _REQ_CACHE.headerMap;

  // read current header
  const lastCol = Math.max(sh.getLastColumn(), 0);
  let header = [];
  if (lastCol > 0) header = sh.getRange(1,1,1,lastCol).getValues()[0].map(v => String(v||'').trim());

  // if completely empty, write desired order exactly
  if (!header.length || header.every(v => v==='')){
    sh.getRange(1,1,1,HEADER_ORDER.length).setValues([HEADER_ORDER]);
    header = HEADER_ORDER.slice();
  } else {
    // add any missing headers (temporarily to the end)
    const have = new Set(header);
    const toAdd = HEADER_ORDER.filter(h => !have.has(h));
    if (toAdd.length){
      sh.getRange(1, header.length+1, 1, toAdd.length).setValues([toAdd]);
      header = header.concat(toAdd);
    }

    // Ensure "Challan History JSON" sits right AFTER "Challan Items JSON"
    const itemsIdx = header.indexOf('Challan Items JSON'); // 0-based
    const histIdx  = header.indexOf('Challan History JSON');
    if (itemsIdx >= 0) {
      if (histIdx < 0) {
        sh.insertColumnAfter(itemsIdx + 1);
        sh.getRange(1, itemsIdx + 2).setValue('Challan History JSON');
      } else if (histIdx !== itemsIdx + 1) {
        const lastRow = sh.getLastRow();
        const fromCol = histIdx + 1;
        const toCol   = itemsIdx + 2; // right after items
        const values = lastRow > 1 ? sh.getRange(2, fromCol, lastRow-1, 1).getValues() : [];
        sh.insertColumnBefore(toCol);
        sh.getRange(1, toCol).setValue('Challan History JSON');
        if (values.length) sh.getRange(2, toCol, values.length, 1).setValues(values);
        sh.deleteColumn(fromCol < toCol ? fromCol : fromCol + 1);
      }
      const newLast = sh.getLastColumn();
      header = sh.getRange(1,1,1,newLast).getValues()[0].map(v => String(v||'').trim());
    }

    /** Ensure ORDER_NO_COL_NAME then NOTIFIED_COL_NAME exist,
     * and append any JOBORDER_AFTER_NOTIFIED headers directly AFTER "Email Notified At".
     */
    const ensureField = (name) => {
      let idx = header.indexOf(name);
      if (idx < 0) {
        sh.insertColumnAfter(header.length || 1);
        sh.getRange(1, header.length + 1).setValue(name);
        const newLast = sh.getLastColumn();
        header = sh.getRange(1,1,1,newLast).getValues()[0].map(v => String(v||'').trim());
        idx = header.length - 1;
      }
      return idx; // 0-based
    };

    // Make sure both exist
    const orderIdx = ensureField(ORDER_NO_COL_NAME);
    const notifIdx = ensureField(NOTIFIED_COL_NAME);

    // Ensure new fields appear immediately AFTER Email Notified At
    let currentNotifIdx = header.indexOf(NOTIFIED_COL_NAME);
    for (let i = 0; i < JOBORDER_AFTER_NOTIFIED.length; i++) {
      const name = JOBORDER_AFTER_NOTIFIED[i];
      let idx = header.indexOf(name);
      if (idx < 0) {
        // Insert right after current NOTIFIED
        sh.insertColumnAfter(currentNotifIdx + 1); // 1-based
        sh.getRange(1, currentNotifIdx + 2).setValue(name);
        const newLast = sh.getLastColumn();
        header = sh.getRange(1,1,1,newLast).getValues()[0].map(v => String(v||'').trim());
        currentNotifIdx = header.indexOf(NOTIFIED_COL_NAME);
      }
    }
  }

  const map = {};
  header.forEach((h,i) => map[h]=i+1);
  _REQ_CACHE.headerMap = map;
  return map;
}

/*** WRITE ROWS BY NAME ***/
function buildRowArrayByMap_(map, p, imageUrl, lotNumber, componentLabel){
  const width = Math.max(...Object.values(map));
  const row = Array.from({length: width}, () => '');

  function set(name, val){
    const c = map[name];
    if (c) row[c-1] = (val == null ? '' : val);
  }

  set('Job Order No', p.jobOrderNo || '');
  set('Date', p.date || '');
  set('Fabric', p.fabric || '');
  set('Brand', p.brand || '');
  set('Shade', p.shade || '');
  set('Size', p.size || '');
  set('Quantity', p.quantity || '');
  set('Unit', p.unit || '');
  set('Party Name', p.partyName || '');
  set('Garment Type', p.garmentType || '');
  set('Section', p.section || '');
  set('Season', p.season || '');
  set('Emb', p.emb || '');
  set('Emb Details', p.embDetails || '');
  set('Printing', p.printing || '');
  set('Printing Details', p.printingDetails || '');
  set('Pattern', p.pattern || '');
  set('Style', p.style || '');
  set('Priority', (p.priority || '').toString().trim());
  set('Remarks', p.remarks || '');
  set('Direct Stitching', p.directStitching === true ? 'yes' : 'no');
  set('Submitted By', p.submittedBy || '');
  set('Image URL', imageUrl || '');
  set('Lot Number', lotNumber || '');
  set('Component', componentLabel || '');
  set('Order No.', p.orderNo || '');
  set('Email Notified At', '');
  
  // These fields are in your sheet
  set('Tape/Lace', p.tapeLace || '');
  set('Bottom Type', p.bottomType || '');
  set('Zip', p.zip || '');
  set('Sticker', p.sticker || '');
  set('Collar', p.collar || '');
  set('Bone', p.bone || '');
  set('FULL BAJU', p.fullBaju || '');
  
  // Map FABRIC_SUPERVISOR from the payload
  set('FABRIC_SUPERVISOR', p.fabricSupervisor || '');
  
  return row;
}

/*** BATCH APPEND (using sheet width) ***/
function appendRowsByWidth_(sh, rows2d){
  if (!rows2d || !rows2d.length) return { firstRow: 0, lastRow: 0 };
  const width = Math.max(sh.getLastColumn(), rows2d[0].length);
  const lastHeaderCol = sh.getLastColumn();
  if (lastHeaderCol < width) sh.insertColumnsAfter(lastHeaderCol || 1, width - lastHeaderCol);
  const startRow = Math.max(2, sh.getLastRow() + 1);
  const numRows  = rows2d.length;
  sh.getRange(startRow, 1, numRows, width).setValues(rows2d.map(r => {
    if (r.length === width) return r;
    const rr = Array.from({length: width}, ()=> '');
    for (let i=0;i<Math.min(width, r.length);i++) rr[i]=r[i];
    return rr;
  }));
  return { firstRow: startRow, lastRow: startRow + numRows - 1 };
}

/*** DRIVE HELPERS (used for image upload in Job Order email only) ***/
function uniqueName_(orig){
  const ts = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd-HHmmss-SSS");
  const hash = Utilities.getUuid().slice(0,8);
  const dot = orig.lastIndexOf('.');
  const ext = dot >= 0 ? orig.slice(dot) : '';
  const base = dot >= 0 ? orig.slice(0,dot) : orig;
  return `${base}-${ts}-${hash}${ext}`;
}

function directDriveUrlFromFile_(file){
  return `https://drive.google.com/uc?export=download&id=${file.getId()}`;
}

function saveBase64ToDrive_(name, mimeType, base64){
  if (!FOLDER_ID) throw new Error('FOLDER_ID is not configured.');
  const folder = DriveApp.getFolderById(FOLDER_ID);
  const blob = Utilities.newBlob(
    Utilities.base64Decode(base64),
    mimeType || 'application/octet-stream',
    uniqueName_(name || 'upload')
  );
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return directDriveUrlFromFile_(file);
}

/*** NORMALIZATION + LOT SERIES ***/
function _normBase_(s){
  return String(s || '')
    .replace(/\u00A0/g, ' ')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeParty(s){ return _normBase_(s); }

function normalizeGType(s){
  let k = _normBase_(s);
  k = k.replace(/\bt shirt\b/g, 'tshirt')
       .replace(/\bhalf pant\b/g, 'halfpant')
       .replace(/\btrack suit upper\b/g, 'tracksuitupper')
       .replace(/\btrack suit lower\b/g, 'tracksuitlower')
       .replace(/\btrack suit\b/g, 'tracksuit')
       .replace(/\btracksuit\b/g, 'tracksuit');
  return k;
}

function toNumberSafe(x){
  const n = Number(String(x || '').replace(/[,\s]/g, ''));
  return Number.isFinite(n) ? n : NaN;
}

function extractDriveId_(uStr){
  try {
    const u = new URL(uStr);
    if (u.hostname.includes('drive.google.com')) {
      const m = u.pathname.match(/\/file\/d\/([^/]+)\//);
      return m?.[1] || u.searchParams.get('id') || null;
    }
  } catch (_){}
  return null;
}

function getLotSheetWithIndex_(){
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sh = ss.getSheetByName(LOT_TAB);
  if (!sh) sh = ss.insertSheet(LOT_TAB);

  const lastCol = Math.max(5, sh.getLastColumn() || 0);
  const rawHeader = sh.getRange(1,1,1,lastCol).getValues()[0];

  const norm = s => String(s || '')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  const header = rawHeader.map(h => String(h || '').trim());
  const lower  = header.map(norm);

  const findAny = (aliases) => {
    for (const a of aliases) {
      const i = lower.indexOf(norm(a));
      if (i >= 0) return i + 1;
    }
    return 0;
  };

  const allBlank = header.every(v => v === '');
  if (allBlank) {
    const NEW = ['Party','Garment Type','Start','End','Next'];
    sh.getRange(1,1,1,NEW.length).setValues([NEW]);
    return { sh, idx: { party:1, type:2, start:3, end:4, next:5 }, hasType:true };
  }

  const party = findAny(['party','party name','partyname','customer','client']);
  const type  = findAny(['garment type','garment-type','garmenttype','type','category','item']);
  const start = findAny(['start','from','range start','begin']);
  const end   = findAny(['end','to','range end','finish']);
  const next  = findAny(['next','current','next no','next number']);

  if (party && start && end && next) {
    return { sh, idx: { party, type, start, end, next }, hasType: Boolean(type) };
  }
  return { sh, idx: { party:1, type:0, start:2, end:3, next:4 }, hasType:false };
}

/** Assign next lot */
function assignNextLotUnified_(partyName, garmentType){
  const { sh, idx } = getLotSheetWithIndex_();

  const partyKeyWanted = normalizeParty(partyName);
  const typeKeyWanted  = normalizeGType(garmentType);

  const lastRow = sh.getLastRow();
  if (lastRow < 2) throw new Error(`"${LOT_TAB}" me koi ranges nahi mili. Pehle ranges add karo.`);
  const lastCol = sh.getLastColumn();
  const values = sh.getRange(2,1,lastRow-1,lastCol).getValues();

  const cell = (row, col1) => {
    if (!col1) return '';
    const v = row[col1-1];
    return String(v == null ? '' : v).trim();
  };

  const rowsMeta = values.map((r, i) => {
    const partyRaw = cell(r, idx.party);
    const typeRaw  = idx.type ? cell(r, idx.type) : '';
    return {
      i, r,
      partyRaw, typeRaw,
      partyKey: normalizeParty(partyRaw),
      typeKey : normalizeGType(typeRaw),
    };
  });

  let match = null;
  if (idx.type && typeKeyWanted) {
    match = rowsMeta.find(m => (m.partyKey === partyKeyWanted && m.typeKey === typeKeyWanted));
    if (!match && SOFT_MATCH_PARTY && SOFT_MATCH_GTYPE) {
      const cands = rowsMeta.filter(m =>
        m.partyKey && m.partyKey.includes(partyKeyWanted) &&
        m.typeKey  && m.typeKey.includes(typeKeyWanted)
      );
      if (cands.length === 1) match = cands[0];
    }
  }

  if (!match) {
    match = rowsMeta.find(m => m.partyKey === partyKeyWanted && (!idx.type || m.typeKey === ''));
    if (!match && SOFT_MATCH_PARTY) {
      const cands = rowsMeta.filter(m =>
        m.partyKey && m.partyKey.includes(partyKeyWanted) && (!idx.type || m.typeKey === '')
      );
      if (cands.length === 1) match = cands[0];
    }
  }

  if (!match){
    if (idx.type){
      throw new Error(`"${partyName}" ke liye LotSeries me row nahi mili. Party-only ya Party + Garment Type row add karo.`);
    }
    throw new Error(`Party "${partyName}" LotSeries me nahi mili. Start/End/Next add karo.`);
  }

  const cellVal = (c) => toNumberSafe(c);

  const start = cellVal(values[match.i][idx.start-1]);
  const end   = cellVal(values[match.i][idx.end-1]);
  let next    = cellVal(values[match.i][idx.next-1]);

  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end){
    const who = match.typeKey ? `${match.partyRaw} / ${match.typeRaw}` : match.partyRaw;
    throw new Error(`Invalid range: ${who}. Start/End check karo.`);
  }
  if (!Number.isFinite(next) || next < start) next = start;
  if (next > end){
    const who = match.typeKey ? `${match.partyRaw} / ${match.typeRaw}` : match.partyRaw;
    throw new Error(`Range exhausted: ${who} (Next=${next}, End=${end}).`);
  }

  const assigned = next;
  const newNext  = next + 1;

  const absoluteRow = 2 + match.i;
  sh.getRange(absoluteRow, idx.next, 1, 1).setValue(newNext);

  return String(assigned);
}

/*** Simple JSON helpers ***/
function _parseJson_(s){ try { return JSON.parse(String(s||'')); } catch(_){ return null; } }
function _stringify_(o){ try { return JSON.stringify(o); } catch(_){ return ''; } }
function _sumItemsQty_(items){
  return (Array.isArray(items) ? items : []).reduce((a,it)=> a + (Number(it.qty)||0), 0);
}

/*** EMAIL HELPERS — JOB ORDER ONLY ***/
function _esc_(s){
  return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _buildOrderHtmlBlock_(order, idx){
  const card      = 'background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;padding:16px;';
  const header    = 'display:flex;align-items:center;gap:10px;margin-bottom:8px;';
  const title     = 'font-size:18px;font-weight:800;color:#0f172a;margin:0;';
  const subtitle  = 'color:#475569;margin:6px 0 0;';
  const chipWrap  = 'display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 12px;';
  const chip      = 'display:inline-block;padding:6px 10px;border:1px solid #e5e7eb;border-radius:999px;background:#f8fafc;font-size:12px;color:#334155;';
  const table     = 'border-collapse:collapse;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;width:100%;';
  const th        = 'padding:10px 12px;border:1px solid #e5e7eb;background:#f8fafc;font-weight:600;color:#0f172a;white-space:nowrap;';
  const td        = 'padding:10px 12px;border:1px solid #e5e7eb;color:#334155;';
  const imgBox    = 'margin:12px 0 0;';
  const imgStyle  = 'max-width:520px;border:1px solid #e5e7eb;border-radius:10px;display:block;';
  const foot      = 'margin-top:10px;color:#64748b;';
  const qtyStr = [order.quantity, order.unit].filter(Boolean).join(' ');
  const chips = [
    ['🔢 Qty', qtyStr],
    ['🏷️ Lot', order.lotNumber],
    ['👕 Type', order.garmentType],
    ['🧍 Party', order.partyName],
    ['🏷️ Brand', order.brand],
    ['⚡ Priority', order.priority],
    ['🏷️ Sticker', order.sticker],
    ['👔 Fabric Supervisor', order.fabricSupervisor]
  ]
  .filter(([,v]) => String(v||'').trim())
  .map(([k,v]) => `<span style="${chip}"><b>${_esc_(k)}:</b> ${_esc_(v)}</span>`).join('');
  
  const rows = [
    ['🧾 Job Order No', order.jobOrderNo],
    ['📅 Date', order.date],
    ['🏷️ Party Name', order.partyName],
    ['👕 Garment Type', order.garmentType],
    ['🧵 Fabric', order.fabric],
    ['🏷️ Brand', order.brand],
    ['👔 Fabric Supervisor', order.fabricSupervisor],
    ['📏 Size', order.size],
    ['🔢 Quantity', qtyStr],
    ['👤 Submitted By', order.submittedBy],
    ['🏷️ Lot Number', order.lotNumber],
    ['🏷️ Sticker', order.sticker],
  ].filter(([_, v]) => String(v||'').trim() !== '')
   .map(([k, v]) => `<tr><td style="${th}">${_esc_(k)}</td><td style="${td}">${_esc_(v)}</td></tr>`).join('');
  
  const img = order.imageUrl
    ? `<div style="${imgBox}"><img src="${_esc_(order.imageUrl)}" alt="Order image" style="${imgStyle}"/></div>`
    : '';
  return `
    <div style="${card};margin-top:${idx ? '16px' : '0'}">
      <div style="${header}">
        <div style="font-size:22px">✨</div>
        <div>
          <h1 style="${title}">${_esc_(EMAIL_SUBJECT_PFX)} — <span style="color:#2563eb">${_esc_(order.jobOrderNo || '')}</span></h1>
          <p style="${subtitle}">A new job order has been created successfully.</p>
        </div>
      </div>
      <div style="${chipWrap}">${chips}</div>
      <table cellspacing="0" cellpadding="0" style="${table}">${rows}</table>
      ${img}
      <div style="${foot}">✅ Automated notification • Please reply for any correction.</div>
    </div>`;
}

function _buildOrderHtmlMulti_(orders){
  const container = 'max-width:860px;margin:0 auto;padding:16px;background:#f6f7fb;';
  const blocks = orders.map(_buildOrderHtmlBlock_).join('');
  return `<div style="${container}">${blocks}</div>`;
}

function _sendEmailForOrders_(orders){
  if (!EMAIL_TO.length) return;
  const subjectPieces = [EMAIL_SUBJECT_PFX];
  if (orders.length === 1) {
    subjectPieces.push(orders[0].jobOrderNo, (orders[0].partyName || orders[0].fabric || orders[0].brand || ''));
  } else {
    subjectPieces.push(`${orders[0].jobOrderNo} (x${orders.length})`, (orders[0].partyName || ''));
  }
  const subject = subjectPieces.filter(Boolean).join(' — ');
  const htmlBody = _buildOrderHtmlMulti_(orders);

  const textBody = orders.map(o => (
`New Job Order
Job Order No: ${o.jobOrderNo || ''}
Date: ${o.date || ''}
Party: ${o.partyName || ''}
Garment: ${o.garmentType || ''}
Brand: ${o.brand || ''}
Fabric Supervisor: ${o.fabricSupervisor || ''}
Lot: ${o.lotNumber || ''}
Qty: ${[o.quantity, o.unit].filter(Boolean).join(' ') || ''}
Sticker: ${o.sticker || ''}`
  )).join('\n\n---\n\n');

  let attachments = [];
  if (ATTACH_IMAGE_IF_PUBLIC && orders.length === 1 && orders[0].imageUrl) {
    try {
      const resp = UrlFetchApp.fetch(orders[0].imageUrl, { followRedirects:true, muteHttpExceptions:true });
      if (resp.getResponseCode() >= 200 && resp.getResponseCode() < 300) {
        attachments = [resp.getBlob()];
      }
    } catch(_) {}
  }

  MailApp.sendEmail({
    to: EMAIL_TO.join(","),
    cc: (EMAIL_CC && EMAIL_CC.length) ? EMAIL_CC.join(",") : undefined,
    subject, htmlBody, body: textBody,
    attachments: attachments.length ? attachments : undefined
  });
}

/*** (Optional) HTML->PDF builder kept for future; we DO NOT store URL anywhere ***/
function _buildChallanHtml_({ challanNo, challanDate, party, lot, qty, emb, embDet, fabric, size, brand, remarks, items }) {
  const td = 'padding:8px 10px;border:1px solid #e5e7eb';
  const th = td + ';background:#f8fafd;font-weight:700';
  function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  const itemsTable = (Array.isArray(items) && items.length)
    ? `
      <h3 style="margin:18px 0 8px 0">Items</h3>
      <table style="border-collapse:collapse;width:100%;margin-bottom:12px">
        <tr>
          <td style="${th};text-align:center;width:60px">#</td>
          <td style="${th}">Shade</td>
          <td style="${th};text-align:right;width:160px">Quantity</td>
        </tr>
        ${items.map((it, i) =>
          `<tr>
            <td style="${td};text-align:center">${i+1}</td>
            <td style="${td}">${esc(it.shade || '')}</td>
            <td style="${td};text-align:right">${esc(String(it.qty || 0))}</td>
          </tr>`).join('')}
        <tr>
          <td style="${td};text-align:right;font-weight:700" colspan="2">Total</td>
          <td style="${td};text-align:right;font-weight:700">${esc(String(qty || 0))}</td>
        </tr>
      </table>`
    : '';

  return `
  <div style="max-width:960px;margin:0 auto;padding:16px;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
    <h2 style="margin:0 0 10px 0">EMBROIDERY CHALLAN</h2>
    <table style="border-collapse:collapse;width:100%;margin-bottom:12px">
      <tr><td style="${th}">Challan No</td><td style="${td}">${esc(challanNo)}</td>
          <td style="${th}">Date</td><td style="${td}">${esc(challanDate)}</td></tr>
      <tr><td style="${th}">Party</td><td style="${td}">${esc(party)}</td>
          <td style="${th}">Lot</td><td style="${td}">${esc(lot)}</td></tr>
      <tr><td style="${th}">Total Qty</td><td style="${td}">${esc(qty)}</td>
          <td style="${th}">Fabric</td><td style="${td}">${esc(fabric)}</td></tr>
      <tr><td style="${th}">Emb</td><td style="${td}">${esc(emb)}</td>
          <td style="${th}">Size</td><td style="${td}">${esc(size)}</td></tr>
      <tr><td style="${th}">Brand</td><td style="${td}">${esc(brand || '')}</td>
          <td style="${th}">Emb Details</td><td style="${td}">${esc(embDet)}</td></tr>
      <tr><td style="${th}">Remarks</td><td style="${td}" colspan="3">${esc(remarks || '-')}</td></tr>
    </table>
    ${itemsTable}
    <div style="display:flex;gap:12px;margin-top:28px">
      <div style="flex:1"><div style="border-top:1px solid #e5e7eb;padding-top:6px">Prepared By</div></div>
      <div style="flex:1"><div style="border-top:1px solid #e5e7eb;padding-top:6px">Verified By</div></div>
      <div style="flex:1"><div style="border-top:1px solid #e5e7eb;padding-top:6px">Receiver's Signature</div></div>
    </div>
  </div>`;
}

/*** LOT/ROW LOOKUPS ***/
function normalizeLot_(s){ return String(s||'').toUpperCase().replace(/[^A-Z0-9]+/g,'').trim(); }

function findRowByLot_(sh, colLot, lotNumber){
  const want = normalizeLot_(lotNumber);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return 0;
  const rng = sh.getRange(2, colLot, lastRow-1, 1).getValues();
  for (let i=0;i<rng.length;i++){
    if (normalizeLot_(rng[i][0]) === want) return 2+i;
  }
  return 0;
}

/*** ---------- CANCEL HELPERS ---------- ***/
function requireSheet_(ss, name) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}

function indexMap_(headers) {
  const map = {};
  headers.forEach((h, i) => { if (h) map[h] = i; });
  return map;
}

/** Ensure Cancel sheet headers = JobOrder headers + cancel extras (union) */
function ensureCancelHeaders_(cancelSheet, jobHeaders, extraCols) {
  const existing = cancelSheet.getLastRow() > 0
    ? cancelSheet.getRange(1, 1, 1, Math.max(1, cancelSheet.getLastColumn()))
        .getValues()[0].map(String)
    : [];
  const wanted = unique_([...jobHeaders, ...extraCols]);
  if (!arraysEqual_(existing, wanted)) {
    cancelSheet.getRange(1, 1, 1, wanted.length).setValues([wanted]);
  }
  return wanted;
}

function unique_(arr) {
  const seen = new Set(); const out = [];
  for (const v of arr) {
    const key = String(v);
    if (!seen.has(key)) { seen.add(key); out.push(key); }
  }
  return out;
}

function arraysEqual_(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (String(a[i]) !== String(b[i])) return false;
  return true;
}

function columnToLetter_(column) {
  let temp, letter = "";
  while (column > 0) {
    temp = (column - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    column = (column - temp - 1) / 26;
  }
  return letter;
}

/*** HTTP ROUTES ***/
function doGet(e){
  try {
    const action = e && e.parameter && e.parameter.action;
    if (action === 'getCredentials') {
      const creds = getCredentials_();
      return ok_({ credentials: creds });
    }
    if (action === 'proxyImage') {
      const rawUrl = e.parameter.url;
      if (!rawUrl) return fail_('No url');
      let blob, source = '';
      const driveId = extractDriveId_(rawUrl);
      if (driveId) {
        try { const file = DriveApp.getFileById(driveId); blob = file.getBlob(); source = 'drive'; }
        catch (_) { blob = null; }
      }
      if (!blob) {
        const resp = UrlFetchApp.fetch(rawUrl, { followRedirects:true, muteHttpExceptions:true });
        const code = resp.getResponseCode();
        if (code < 200 || code >= 300) return fail_('Fetch failed', { code, rawUrl });
        blob = resp.getBlob(); source = 'http';
      }
      const ct = blob.getContentType() || 'application/octet-stream';
      const b64 = Utilities.base64Encode(blob.getBytes());
      return ok_({ dataUrl: `data:${ct};base64,${b64}`, contentType: ct, source });
    }
    return ok_({ method: 'GET' });
  } catch (err) {
    return fail_(err.message || String(err));
  }
}

function getCredentials_() {
  try {
    const CREDENTIALS_SHEET_ID = '1iBDfsxA9XEC9nhQF-ALBYlyGRZWoACYVwSnGfYYbr1';
    const ss = SpreadsheetApp.openById(CREDENTIALS_SHEET_ID);
    const sh = ss.getSheetByName('JobOrderCredentials') || ss.getSheets()[0];
    const data = sh.getDataRange().getValues();
    if (!data || data.length < 2) return [];

    const headers = data[0].map(h => String(h || '').toLowerCase().trim());
    const userIdx = headers.findIndex(h => h.includes('user'));
    const passIdx = headers.findIndex(h => h.includes('pass'));
    const deptIdx = headers.findIndex(h => h.includes('dept') || h.includes('department') || h.includes('role'));

    const list = [];
    for (let i = 1; i < data.length; i++) {
      const u = String(data[i][userIdx !== -1 ? userIdx : 0] || '').trim();
      const p = String(data[i][passIdx !== -1 ? passIdx : 1] || '').trim();
      const d = String(data[i][deptIdx !== -1 ? deptIdx : 2] || '').trim();
      if (u) {
        const normD = d.toLowerCase();
        const role = normD.includes('admin') ? 'admin' :
                     normD.includes('sale') ? 'sales' :
                     normD.includes('prod') ? 'production' : 'viewer';
        list.push({ username: u, password: p, department: d, role: role });
      }
    }
    return list;
  } catch (e) {
    return [];
  }
}

function doPost(e){
  const lock = LockService.getScriptLock();
  try{
    if (!e || !e.postData) return fail_('No body');
    const p = parseBody_(e);

    if (p.action === 'getCredentials') {
      const creds = getCredentials_();
      return ok_({ credentials: creds });
    }

    /** ---------- NEW: cancel job order ---------- **/
    if (p.action === 'cancelJobOrder') {
      lock.tryLock(30000);

      const lotNumber   = (p.data?.lotNumber || '').toString().trim();
      const jobOrderNo  = (p.data?.jobOrderNo || '').toString().trim();
      const reason      = (p.data?.reason || '').toString().trim();
      const approvedFrom= (p.data?.approvedFrom || '').toString().trim();
      const cancelledBy = (p.data?.cancelledBy || '').toString().trim();
      const ts          = (p.data?.timestamp || new Date().toISOString()).toString().trim();

      if (!lotNumber && !jobOrderNo) return fail_('Provide lotNumber or jobOrderNo');

      const { ss, sh } = getSheet_();
      const map = ensureHeaderAndMap_(sh);

      const colLot = map['Lot Number'];
      const colJO  = map['Job Order No'];
      if (!colLot && !colJO) return fail_('Sheet must have "Lot Number" or "Job Order No"');

      // find row
      let rowIdx = 0;
      if (lotNumber && colLot) {
        rowIdx = findRowByLot_(sh, colLot, lotNumber);
      }
      if (!rowIdx && jobOrderNo && colJO) {
        const lastRow = sh.getLastRow();
        if (lastRow >= 2) {
          const rng = sh.getRange(2, colJO, lastRow-1, 1).getValues();
          const want = jobOrderNo.toLowerCase().trim();
          for (let i=0;i<rng.length;i++){
            if (String(rng[i][0]||'').toLowerCase().trim() === want) { rowIdx = 2+i; break; }
          }
        }
      }
      if (!rowIdx) return fail_('Lot/Job Order not found');

      // read full header + row
      const fullHeader = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(v => String(v||'').trim());
      const rowVals    = sh.getRange(rowIdx,1,1,sh.getLastColumn()).getValues()[0];

      // make sure trailing JobOrder fields exist after NOTIFIED
      ensureHeaderAndMap_(sh);

      // write JobOrder cancellation fields
      const writeField = (name, value) => {
        const col = ensureHeaderAndMap_(sh)[name];
        if (col) sh.getRange(rowIdx, col).setValue(value);
      };
      writeField('Status', 'Cancel');
      writeField('Cancellation Reason', reason);
      writeField('Cancellation Approved From', approvedFrom);
      writeField('Cancelled By', cancelledBy);
      writeField('Cancellation Timestamp', ts);

      // Append to Cancel sheet (Job headers + extras)
      const cancelSheet = requireSheet_(ss, CANCEL_TAB);
      const cancelExtras = [
        'Status','Cancellation Reason','Cancellation Approved From','Cancelled By','Cancellation Timestamp'
      ];
      const cancelHeaders = ensureCancelHeaders_(cancelSheet, fullHeader, cancelExtras);

      const jobRowObj = {};
      fullHeader.forEach((h, i) => jobRowObj[h] = rowVals[i]);

      const extraMap = {
        'Status':'Cancel',
        'Cancellation Reason': reason,
        'Cancellation Approved From': approvedFrom,
        'Cancelled By': cancelledBy,
        'Cancellation Timestamp': ts
      };

      const outRow = cancelHeaders.map(h => (h in jobRowObj) ? jobRowObj[h] : (h in extraMap ? extraMap[h] : ''));
      cancelSheet.appendRow(outRow);

      return ok_({
        message: 'Cancellation saved',
        cancelSheet: CANCEL_TAB,
        jobRow: rowIdx
      });
    }
    /** ---------- END cancel job order ---------- **/

    /** ---------- NEW: amend job order (No new JobOrder columns added) ---------- **/
    if (p.action === 'amendJobOrder') {
      lock.tryLock(30000);

      const lotNumber   = (p.lotNumber || p.updatedData?.lotNumber || '').toString().trim();
      const jobOrderNo  = (p.jobOrderNo || p.updatedData?.jobOrderNo || '').toString().trim();
      const amendedBy   = (p.amendedBy || '').toString().trim();
      const reason      = (p.amendmentReason || '').toString().trim();
      const ts          = (p.timestamp || new Date().toISOString()).toString().trim();

      if (!lotNumber && !jobOrderNo) return fail_('Provide lotNumber or jobOrderNo');

      const { ss, sh } = getSheet_();
      const map = ensureHeaderAndMap_(sh);

      const colLot = map['Lot Number'];
      const colJO  = map['Job Order No'];
      if (!colLot && !colJO) return fail_('Sheet must have "Lot Number" or "Job Order No"');

      // find row in JobOrder
      let rowIdx = 0;
      if (lotNumber && colLot) {
        rowIdx = findRowByLot_(sh, colLot, lotNumber);
      }
      if (!rowIdx && jobOrderNo && colJO) {
        const lastRow = sh.getLastRow();
        if (lastRow >= 2) {
          const rng = sh.getRange(2, colJO, lastRow - 1, 1).getValues();
          const want = jobOrderNo.toLowerCase().trim();
          for (let i = 0; i < rng.length; i++) {
            if (String(rng[i][0] || '').toLowerCase().trim() === want) { rowIdx = 2 + i; break; }
          }
        }
      }
      if (!rowIdx) return fail_('Lot/Job Order not found in sheet');

      // Helper to update cell value safely without inserting any new columns
      const writeField = (name, val) => {
        const col = map[name];
        if (col && val != null) {
          sh.getRange(rowIdx, col).setValue(String(val));
        }
      };

      const updated = p.updatedData || {};

      // Update allowed specification fields on JobOrder sheet row
      if (updated.brand !== undefined)           writeField('Brand', updated.brand);
      if (updated.pattern !== undefined)         writeField('Pattern', updated.pattern);
      if (updated.style !== undefined)           writeField('Style', updated.style);
      if (updated.emb !== undefined)             writeField('Emb', updated.emb);
      if (updated.embDetails !== undefined)      writeField('Emb Details', updated.embDetails);
      if (updated.printing !== undefined)        writeField('Printing', updated.printing);
      if (updated.printingDetails !== undefined)  writeField('Printing Details', updated.printingDetails);
      if (updated.remarks !== undefined)         writeField('Remarks', updated.remarks);

      // Append log entry to separate "AmendmentLog" sheet ONLY
      try {
        let auditSh = ss.getSheetByName('AmendmentLog');
        if (!auditSh) {
          auditSh = ss.insertSheet('AmendmentLog');
          auditSh.getRange(1, 1, 1, 7).setValues([['Timestamp', 'Lot Number', 'Job Order No', 'Amended By', 'Reason', 'Modified Fields', 'Changes Detail']]);
        }
        const changesSummary = (p.changes || []).map(c => `${c.label}: "${c.oldValue}" ➔ "${c.newValue}"`).join('; ');
        auditSh.appendRow([ts, lotNumber, jobOrderNo, amendedBy, reason, (p.changes || []).map(c => c.label).join(', '), changesSummary]);
      } catch (logErr) {
        console.warn('AmendmentLog sheet error:', logErr);
      }

      return ok_({
        message: 'Job Order amended & logged to AmendmentLog successfully',
        lotNumber,
        jobOrderNo,
        updatedRow: rowIdx,
        changesCount: (p.changes || []).length
      });
    }

    if (p.action === 'reserveChallanNo'){
      lock.tryLock(30000);
      const series  = String(p.series || 'CH-EMB-').trim();
      const zeroPad = Number(p.zeroPad || DEFAULT_PAD);
      const challanNo = reserveChallanNo_(series, zeroPad);
      return ok_({ challanNo });
    }

    if (p.action === 'summarizeLots') {
      const lots = Array.isArray(p.lots) ? p.lots : [];
      const want = (Array.isArray(lots) ? lots : []).map(s => String(s||'').toUpperCase().replace(/[^A-Z0-9]+/g,'').trim()).filter(Boolean);
      if (!want.length) return ok_({ data: {} });

      const { sh } = getSheet_();
      const map = ensureHeaderAndMap_(sh);
      const colLot = map['Lot Number'];
      const colQty = map['Quantity'] || map['Qty'] || map['Total Qty'];
      const colIssued = map['Challan Total Qty'];
      if (!colLot)  return fail_('"Lot Number" column not found.');
      if (!colQty)  return fail_('"Quantity" column not found.');

      const lastRow = sh.getLastRow();
      if (lastRow < 2) return ok_({ data: {} });

      const vals = sh.getRange(2, 1, lastRow-1, sh.getLastColumn()).getValues();
      const setWant = new Set(want);
      const out = {};
      for (let i=0;i<vals.length;i++){
        const lot = String(vals[i][colLot-1]||'').toUpperCase().replace(/[^A-Z0-9]+/g,'').trim();
        if (!setWant.has(lot)) continue;
        const sheetQty = Number(String(vals[i][colQty-1]||'').replace(/[,\s]/g,'')) || 0;
        const totalIssued = colIssued ? (Number(String(vals[i][colIssued-1]||'').replace(/[,\s]/g,'')) || 0) : 0;
        out[lot] = { sheetQty, totalIssued };
      }
      return ok_({ data: out });
    }

    if (p.action === 'setChallanReceivedDate') {
      lock.tryLock(30000);
      return setChallanReceivedDate_(p);
    }
    if (p.action === 'setChallanEmbStatus') {
      lock.tryLock(30000);
      return setChallanEmbStatus_(p);
    }

    if (p.action === 'saveChallan'){
      lock.tryLock(30000);
      const { sh, url } = getSheet_();
      const map = ensureHeaderAndMap_(sh);

      const lotNumber   = String(p.lotNumber||'').trim();
      const challanNo   = String(p.challan?.number||'').trim();
      const challanDate = String(p.challan?.date||'').trim();
      const items       = Array.isArray(p.challan?.items) ? p.challan.items : [];
      const totalQtyIn  = Number(p.challan?.totalQty||0) || 0;
      const completeLot = !!p.challan?.completeLot;
      const challanBy   = String(p.challan?.by||'').trim();

      if (!lotNumber) return fail_('Missing lotNumber');
      if (!challanNo) return fail_('Missing challan.number');

      // Locate row
      const rowLotCol = map['Lot Number'];
      if (!rowLotCol) return fail_('"Lot Number" column not found.');
      const rowIdx = findRowByLot_(sh, rowLotCol, lotNumber);
      if (!rowIdx) return fail_(`Lot "${lotNumber}" row not found in JobOrder.`);

      // Column indices
      const colNo     = map['Challan No'];
      const colDate   = map['Challan Date'];
      const colItems  = map['Challan Items JSON'];
      const colHist   = map['Challan History JSON'];
      const colTQty   = map['Challan Total Qty'];
      const colCFlag  = map['Challan Complete Lot'];
      const colBy     = map['Challan By'];
      const colPdf    = map['Challan PDF URL'];

      // Helpers
      const cleanItems = (arr) => (Array.isArray(arr) ? arr.map(it => ({
        shade: String(it.shade||'').trim(),
        qty  : Number(it.qty)||0
      })).filter(it => it.shade && it.qty > 0) : []);

      const currentItems = cleanItems(items);

      // ---- DELTA-ONLY HISTORY LOGIC (per challan number) ----
      const prevHist = _parseJson_(colHist ? sh.getRange(rowIdx, colHist).getValue() : '');
      let histArr = Array.isArray(prevHist) ? prevHist : [];

      // Build map of quantities already recorded for THIS challan number
      const alreadyForThisNo = {};
      histArr.filter(e => String(e.number||'') === challanNo)
             .forEach(e => (Array.isArray(e.items) ? e.items : []).forEach(it => {
               const s = String(it.shade||'').trim();
               const q = Number(it.qty)||0;
               if (!s || q<=0) return;
               alreadyForThisNo[s] = (alreadyForThisNo[s] || 0) + q;
             }));

      // Build current map
      const currentMap = {};
      currentItems.forEach(it => {
        currentMap[it.shade] = (currentMap[it.shade] || 0) + (Number(it.qty)||0);
      });

      // Compute delta items = current - alreadyForThisNo (only positives kept)
      const deltaItems = Object.keys(currentMap).map(shade => {
        const delta = (currentMap[shade] || 0) - (alreadyForThisNo[shade] || 0);
        return { shade, qty: delta };
      }).filter(it => it.qty > 0);

      // If no items provided but totalQtyIn present and no prior for this challan, treat as one delta block w/o shades
      const shouldAppendBareTotal = (!deltaItems.length && !currentItems.length && totalQtyIn > 0 && Object.keys(alreadyForThisNo).length === 0);

      // 1) Append to "Challan History JSON"
      if (deltaItems.length || shouldAppendBareTotal){
        const entryTotal = deltaItems.length ? _sumItemsQty_(deltaItems) : totalQtyIn;
        const entry = {
          number: challanNo,
          date: challanDate,
          by: challanBy,
          completeLot: !!completeLot,
          totalQty: entryTotal,
          items: deltaItems
        };
        histArr.push(entry);
        if (colHist) sh.getRange(rowIdx, colHist).setValue(_stringify_(histArr));
      }

      // 2) Keep "Challan Items JSON" = latest payload you sent (not delta)
      const latestPayload = { items: currentItems, completeLot: !!completeLot, notedAt: new Date().toISOString() };
      if (colItems) sh.getRange(rowIdx, colItems).setValue(_stringify_(latestPayload));

      // 3) Recompute cumulative "Challan Total Qty" from history
      const cumTotal = histArr.reduce((a, e) => a + (Number(e.totalQty)||0), 0);
      if (colTQty) sh.getRange(rowIdx, colTQty).setValue(cumTotal);

      // 4) Latest challan block fields
      if (colNo)   sh.getRange(rowIdx, colNo).setValue(challanNo);
      if (colDate) sh.getRange(rowIdx, colDate).setValue(challanDate);
      if (colCFlag)sh.getRange(rowIdx, colCFlag).setValue(completeLot ? 'yes' : 'no');
      if (colBy)   sh.getRange(rowIdx, colBy).setValue(challanBy);
      if (colPdf)  sh.getRange(rowIdx, colPdf).setValue('');

      return ok_({
        message: deltaItems.length ? 'Challan saved (delta appended, latest set, totals updated)' : 'No new shades/qty for this challan; latest set, totals intact',
        spreadsheetUrl: url,
        sheetName: TARGET_TAB,
        row: rowIdx,
        lotNumber,
        challanNo
      });
    }

    if (p.action !== 'createJobOrder') return fail_('Unknown action');

    // ===== CREATE JOB ORDER =====
    lock.tryLock(30000);
    const { sh, url } = getSheet_();
    const map = ensureHeaderAndMap_(sh);

    const req = ['jobOrderNo','date','fabric','shade','quantity','unit','partyName'];
    for (const k of req){ if (!String(p[k] ?? '').trim()) return fail_(`Missing field: ${k}`); }
    p.priority = (p.priority ? String(p.priority) : 'MEDIUM').toUpperCase();
    let imageUrl = '';
    if (p.image?.base64 && p.image?.name){
      try { imageUrl = saveBase64ToDrive_(p.image.name, p.image.mimeType, p.image.base64); }
      catch (_) { imageUrl = ''; }
    }

    // Check if this is a tracksuit order
    const garmentTypeLower = String(p.garmentType || '').toLowerCase().trim();
    const isTrackSuit = garmentTypeLower === 'track suit' || 
                        garmentTypeLower === 'tracksuit' || 
                        garmentTypeLower.includes('track');

    const rowsToInsert = [];
    const ordersForEmail = [];

    if (isTrackSuit) {
      // Create deep copies for Upper and Lower
      const pUpper = JSON.parse(JSON.stringify(p));
      const pLower = JSON.parse(JSON.stringify(p));
      
      // Set specific garment types
      pUpper.garmentType = 'Track Suit Upper';
      pLower.garmentType = 'Track Suit Lower';
      
      // Generate separate lot numbers for Upper and Lower
      let lotUpper = '';
      let lotLower = '';
      
      try { 
        lotUpper = assignNextLotUnified_(p.partyName, 'Track Suit Upper'); 
      } catch (e) {
        console.warn('Could not get lot for Track Suit Upper, using fallback:', e);
        try {
          lotUpper = assignNextLotUnified_(p.partyName, p.garmentType);
        } catch (e2) {
          throw new Error(`Failed to assign lot number for Upper: ${e2.message}`);
        }
      }
      
      try { 
        lotLower = assignNextLotUnified_(p.partyName, 'Track Suit Lower'); 
      } catch (e) {
        console.warn('Could not get lot for Track Suit Lower, using fallback:', e);
        try {
          lotLower = assignNextLotUnified_(p.partyName, p.garmentType);
        } catch (e2) {
          throw new Error(`Failed to assign lot number for Lower: ${e2.message}`);
        }
      }

      // Build rows for both
      const rowUpper = buildRowArrayByMap_(map, pUpper, imageUrl, lotUpper, 'UPPER');
      const rowLower = buildRowArrayByMap_(map, pLower, imageUrl, lotLower, 'LOWER');
      
      rowsToInsert.push(rowUpper);
      rowsToInsert.push(rowLower);

      ordersForEmail.push(
        { 
          jobOrderNo: p.jobOrderNo, 
          date: p.date, 
          fabric: p.fabric, 
          brand: p.brand, 
          fabricSupervisor: p.fabricSupervisor || '',
          shade: p.shade,
          size: p.size, 
          quantity: p.quantity, 
          unit: p.unit, 
          partyName: p.partyName, 
          garmentType: 'Track Suit Upper', 
          submittedBy: p.submittedBy, 
          lotNumber: String(lotUpper), 
          imageUrl, 
          priority: p.priority,
          sticker: p.sticker || '' 
        },
        { 
          jobOrderNo: p.jobOrderNo, 
          date: p.date, 
          fabric: p.fabric, 
          brand: p.brand, 
          fabricSupervisor: p.fabricSupervisor || '',
          shade: p.shade,
          size: p.size, 
          quantity: p.quantity, 
          unit: p.unit, 
          partyName: p.partyName, 
          garmentType: 'Track Suit Lower', 
          submittedBy: p.submittedBy, 
          lotNumber: String(lotLower), 
          imageUrl, 
          priority: p.priority,
          sticker: p.sticker || '' 
        }
      );
    } else {
      // Regular order - single lot
      let lotNumber = '';
      try { 
        lotNumber = assignNextLotUnified_(p.partyName, p.garmentType); 
      } catch (lotErr) { 
        return fail_(lotErr.message); 
      }

      rowsToInsert.push(buildRowArrayByMap_(map, p, imageUrl, lotNumber, ''));
      ordersForEmail.push({
        jobOrderNo: p.jobOrderNo, 
        date: p.date, 
        fabric: p.fabric, 
        brand: p.brand, 
        fabricSupervisor: p.fabricSupervisor || '',
        shade: p.shade,
        size: p.size, 
        quantity: p.quantity, 
        unit: p.unit, 
        partyName: p.partyName,
        garmentType: p.garmentType, 
        submittedBy: p.submittedBy, 
        lotNumber: String(lotNumber),
        imageUrl,
        priority: p.priority,
        sticker: p.sticker || ''
      });
    }

    const { firstRow, lastRow } = appendRowsByWidth_(sh, rowsToInsert);
    const writtenRows = firstRow ? Array.from({length: lastRow-firstRow+1}, (_,i)=> firstRow+i) : [];

    // ✅ Send Job Order email
    if (ordersForEmail.length) _sendEmailForOrders_(ordersForEmail);

    // ✅ Mark Email Notified At
    const map2 = ensureHeaderAndMap_(sh);
    const notifiedCol = map2[NOTIFIED_COL_NAME];
    if (notifiedCol && writtenRows.length){
      const now = new Date();
      sh.getRange(writtenRows[0], notifiedCol, writtenRows.length, 1)
        .setValues(writtenRows.map(()=>[now]));
    }

    return ok_({
      message: isTrackSuit ? 'Two rows appended for Track Suit (Upper & Lower)' : 'Row appended',
      spreadsheetUrl: url,
      sheetName: TARGET_TAB,
      writtenAtRows: writtenRows,
      jobOrderNo: p.jobOrderNo,
      lots: ordersForEmail.map(o=>o.lotNumber),
      imageUrl,
      submittedBy: p.submittedBy || ''
    });

  } catch(err){
    return fail_(err.message || String(err));
  } finally {
    try{ lock.releaseLock(); }catch(_){}
  }
}

/** ------------------ per-challan Emb status ------------------ */
function setChallanEmbStatus_(p) {
  try {
    const lotNumber      = String(p.lotNumber || '').trim();
    const challanNumber  = String(p.challanNumber || '').trim();
    const embCompletedIn = (String(p.embCompleted) === 'true' || p.embCompleted === true);
    const historyIndexIn = (function(v){
      const n = Number(v);
      return Number.isInteger(n) ? n : null;
    })(p.historyIndex);

    if (!lotNumber)     return fail_('Missing lotNumber');
    if (!challanNumber) return fail_('Missing challanNumber');

    const { sh } = getSheet_();
    const map    = ensureHeaderAndMap_(sh);

    const colLot  = map['Lot Number'];
    const colHist = map['Challan History JSON'];
    if (!colLot)  return fail_('"Lot Number" column not found.');
    if (!colHist) return fail_('"Challan History JSON" column not found.');

    const rowIdx = findRowByLot_(sh, colLot, lotNumber);
    if (!rowIdx) return fail_(`Lot "${lotNumber}" row not found in JobOrder.`);

    const raw = sh.getRange(rowIdx, colHist).getValue();
    let histArr = _parseJson_(raw);
    if (!Array.isArray(histArr)) histArr = [];

    const normChNo = (s) => String(s || '').replace(/\u00A0/g, ' ').trim();
    const wantNo   = normChNo(challanNumber);

    let targetIdx = -1;
    if (historyIndexIn != null && historyIndexIn >= 0 && historyIndexIn < histArr.length) {
      targetIdx = historyIndexIn;
    } else {
      targetIdx = histArr.findIndex(e => normChNo(e && e.number) === wantNo);
    }
    if (targetIdx < 0) return fail_('Challan entry not found for this lot.');

    const entry = histArr[targetIdx] || {};
    entry.embCompleted = embCompletedIn;
    entry.embUpdatedAt = new Date().toISOString();
    histArr[targetIdx] = entry;

    sh.getRange(rowIdx, colHist).setValue(_stringify_(histArr));

    return ok_({
      message: embCompletedIn ? 'Emb marked completed' : 'Emb completion cleared',
      lotNumber,
      challanNumber: entry.number || challanNumber,
      historyIndex: targetIdx,
      embCompleted: entry.embCompleted,
      row: rowIdx
    });
  } catch (err) {
    return fail_(err.message || String(err));
  }
}

/** ------------------ receivedDate setter ------------------ */
function setChallanReceivedDate_(p) {
  try {
    const lotNumber      = String(p.lotNumber || '').trim();
    const challanNumber  = String(p.challanNumber || '').trim();
    const receivedDate   = String(p.receivedDate || '');
    const historyIndexIn = (function(v){
      const n = Number(v);
      return Number.isInteger(n) ? n : null;
    })(p.historyIndex);

    if (!lotNumber)     return fail_('Missing lotNumber');
    if (!challanNumber) return fail_('Missing challanNumber');

    const { sh } = getSheet_();
    const map    = ensureHeaderAndMap_(sh);

    const colLot  = map['Lot Number'];
    const colHist = map['Challan History JSON'];
    if (!colLot)  return fail_('"Lot Number" column not found.');
    if (!colHist) return fail_('"Challan History JSON" column not found.');

    const rowIdx = findRowByLot_(sh, colLot, lotNumber);
    if (!rowIdx) return fail_(`Lot "${lotNumber}" row not found in JobOrder.`);

    const raw = sh.getRange(rowIdx, colHist).getValue();
    let histArr = _parseJson_(raw);
    if (!Array.isArray(histArr)) histArr = [];

    const normChNo = (s) => String(s || '').replace(/\u00A0/g, ' ').trim();
    const wantNo = normChNo(challanNumber);

    let targetIdx = -1;
    if (historyIndexIn != null && historyIndexIn >= 0 && historyIndexIn < histArr.length) {
      targetIdx = historyIndexIn;
    } else {
      targetIdx = histArr.findIndex(e => normChNo(e && e.number) === wantNo);
    }

    if (targetIdx < 0) {
      return fail_('Challan entry not found for this lot.');
    }

    const entry = histArr[targetIdx] || {};
    if (receivedDate) entry.receivedDate = receivedDate;
    else              delete entry.receivedDate;

    histArr[targetIdx] = entry;

    sh.getRange(rowIdx, colHist).setValue(_stringify_(histArr));

    return ok_({
      message: receivedDate ? 'Marked as received' : 'Received mark cleared',
      lotNumber,
      challanNumber: entry.number || challanNumber,
      historyIndex: targetIdx,
      row: rowIdx
    });
  } catch (err) {
    return fail_(err.message || String(err));
  }
}
