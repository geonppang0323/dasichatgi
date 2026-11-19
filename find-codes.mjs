// 다시찾기 - 경찰청 습득물 API 코드표 확인 스크립트
// 사용법 (PowerShell 기준):
//   $env:SERVICE_KEY="공공데이터포털_일반인증키(Decoding)"
//   node find-codes.mjs
// 결과는 화면에 나오고, 같은 폴더의 codes-result.txt 에도 저장됩니다.
// 인증키는 결과 파일에 저장되지 않습니다.

import { writeFileSync } from "node:fs";

const KEY = (process.env.SERVICE_KEY || "").trim().replace(/^["']|["']$/g, "");
if (!KEY) {
  console.error("SERVICE_KEY 환경변수가 없습니다. 위 사용법을 참고하세요.");
  process.exit(1);
}

const BASE = "https://apis.data.go.kr/1320000";
const POLICE_LIST = `${BASE}/LosfundInfoInqireService/getLosfundInfoAccToClAreaPd`;
const PORTAL_LIST = `${BASE}/LosPtfundInfoInqireService/getPtLosfundInfoAccToClAreaPd`;

const lines = [];
const log = (s = "") => { console.log(s); lines.push(s); };

function ymd(d) {
  return d.toISOString().slice(0, 10).replaceAll("-", "");
}
const today = new Date();
const daysAgo = (n) => new Date(today.getTime() - n * 86400000);

function tag(xml, name) {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return m ? m[1].trim() : "";
}
function items(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
}

// Encoding 키(%가 들어 있음)는 그대로, Decoding 키는 인코딩해서 붙인다
const KEY_PARAM = KEY.includes("%") ? KEY : encodeURIComponent(KEY);

async function call(url, params) {
  const qs = new URLSearchParams(params);
  try {
    const res = await fetch(`${url}?serviceKey=${KEY_PARAM}&${qs}`);
    const xml = await res.text();
    return {
      status: res.status,
      code: tag(xml, "resultCode"),
      msg: tag(xml, "resultMsg") || xml.slice(0, 120).replace(/\s+/g, " "),
      total: Number(tag(xml, "totalCount") || 0),
      items: items(xml),
    };
  } catch (e) {
    return { status: 0, code: "ERR", msg: String(e), total: 0, items: [] };
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

log("=== 다시찾기 코드표 확인 결과 ===");
log(`실행일: ${today.toISOString().slice(0, 10)}`);
log("");

// 0. 키 확인 (키 내용은 출력하지 않음)
log(`[0] 키 길이: ${KEY.length}자 / 형태: ${KEY.includes("%") ? "Encoding 키" : "Decoding 키"}`);
const first = await call(PORTAL_LIST, {
  pageNo: "1", numOfRows: "1",
  START_YMD: ymd(daysAgo(3)), END_YMD: ymd(today),
});
if (first.code !== "00") {
  log(`  키 확인 실패: ${first.code} ${first.msg}`);
  log("  → 마이페이지에서 다른 형태의 키(Encoding ↔ Decoding)로 바꿔서 다시 실행해 보세요.");
  writeFileSync(new URL("./codes-result.txt", import.meta.url), lines.join("\n"), "utf8");
  process.exit(1);
}
log("  키 확인 성공!");
log("");

// 1. 기본 호출 + 한 번에 가져올 수 있는 최대 건수
log("[1] 한 번에 가져올 수 있는 건수 (최근 3일, 전국)");
for (const [name, url] of [["경찰서", POLICE_LIST], ["포털기관", PORTAL_LIST]]) {
  for (const rows of [100, 500, 1000]) {
    const r = await call(url, {
      pageNo: "1", numOfRows: String(rows),
      START_YMD: ymd(daysAgo(3)), END_YMD: ymd(today),
    });
    log(`  ${name} numOfRows=${rows} -> 결과코드 ${r.code} ${r.msg} / 전체 ${r.total}건 / 받은 ${r.items.length}건`);
    await sleep(200);
  }
}
log("");

// 2. 지역 코드 찾기 (LCA000 ~ LCZ000)
log("[2] 지역 코드 (최근 30일 경찰서 습득물 기준, 보관장소 예시)");
for (const L of LETTERS) {
  const code = `LC${L}000`;
  const r = await call(POLICE_LIST, {
    pageNo: "1", numOfRows: "3",
    START_YMD: ymd(daysAgo(30)), END_YMD: ymd(today),
    N_FD_LCT_CD: code,
  });
  if (r.total > 0) {
    const places = r.items.map((it) => tag(it, "depPlace")).join(", ");
    log(`  ${code}: ${r.total}건 / 예: ${places}`);
  } else {
    log(`  ${code}: 0건 (${r.code} ${r.msg})`);
  }
  await sleep(150);
}
log("");

// 3. 물품 대분류 코드 찾기 (PRA000 ~ PRZ000)
log("[3] 물품 대분류 코드 (최근 7일 포털기관 습득물 기준, 분류명 예시)");
for (const L of LETTERS) {
  const code = `PR${L}000`;
  const r = await call(PORTAL_LIST, {
    pageNo: "1", numOfRows: "5",
    START_YMD: ymd(daysAgo(7)), END_YMD: ymd(today),
    PRDT_CL_CD_01: code,
  });
  if (r.total > 0) {
    const names = [...new Set(r.items.map((it) => tag(it, "prdtClNm")))].join(", ");
    log(`  ${code}: ${r.total}건 / 예: ${names}`);
  } else {
    log(`  ${code}: 0건`);
  }
  await sleep(150);
}
log("");

// 4. 색상 코드 일부 확인 (CL1001 ~ CL1015)
log("[4] 색상 코드 (최근 7일 포털기관 습득물 기준)");
for (let i = 1; i <= 15; i++) {
  const code = `CL10${String(i).padStart(2, "0")}`;
  const r = await call(PORTAL_LIST, {
    pageNo: "1", numOfRows: "3",
    START_YMD: ymd(daysAgo(7)), END_YMD: ymd(today),
    CLR_CD: code,
  });
  const colors = [...new Set(r.items.map((it) => tag(it, "clrNm")))].join(", ");
  log(`  ${code}: ${r.total}건 ${colors ? "/ 예: " + colors : ""}`);
  await sleep(150);
}

writeFileSync(new URL("./codes-result.txt", import.meta.url), lines.join("\n"), "utf8");
log("");
log("완료! 같은 폴더의 codes-result.txt 파일을 채팅에 올려주세요.");
