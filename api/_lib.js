// 공통 도구: 경찰청 API 호출, XML 해석, 분류 사전, 점수 계산
// 파일 이름이 _ 로 시작하면 Vercel이 API 주소로 만들지 않는다.

const BASE = "https://apis.data.go.kr/1320000";

export const ENDPOINTS = {
  police: {
    list: `${BASE}/LosfundInfoInqireService/getLosfundInfoAccToClAreaPd`,
    detail: `${BASE}/LosfundInfoInqireService/getLosfundDetailInfo`,
    label: "경찰서",
  },
  portal: {
    list: `${BASE}/LosPtfundInfoInqireService/getPtLosfundInfoAccToClAreaPd`,
    detail: `${BASE}/LosPtfundInfoInqireService/getPtLosfundDetailInfo`,
    label: "기관",
  },
};

// 지역 코드 (2026-11-13 실제 호출로 확인)
export const REGIONS = {
  LCA000: "서울", LCV000: "인천", LCI000: "경기", LCH000: "강원",
  LCO000: "충북", LCN000: "충남", LCS000: "대전", LCW000: "세종",
  LCM000: "전북", LCG000: "전남광주", LCK000: "경북", LCR000: "대구",
  LCJ000: "경남", LCT000: "부산", LCU000: "울산", LCP000: "제주",
};

// 물건 종류 사전
// primary: 원래 분류, related: 다르게 등록될 수 있는 분류, words: 물품명·설명에서 찾을 단어
// home: "제자리"로 볼 분류 [대분류, 중분류 글자]. 없으면 primary 대분류 전체가 제자리.
// not: 다른 분류에서 찾을 때 물품명에 이 단어가 있으면 그 물건이 아니라고 보고 뺀다 (예: 아이폰 "충전기")
export const TYPES = {
  wallet:   { name: "지갑",     primary: ["PRH000"], related: ["PRZ000", "PRA000"], words: ["지갑", "카드지갑", "반지갑", "장지갑", "동전지갑", "머니클립"] },
  phone:    { name: "휴대폰",   primary: ["PRJ000"], related: ["PRG000", "PRZ000"], words: ["휴대폰", "핸드폰", "아이폰", "갤럭시", "스마트폰"],
              not: ["충전기", "충전", "케이블", "케이스", "버즈", "탭", "워치", "배터리", "거치대", "이어폰", "필름", "어댑터"] },
  earphone: { name: "이어폰",   primary: ["PRG000"], home: [["전자기기", "이어폰"]], related: ["PRZ000"], words: ["이어폰", "에어팟", "버즈", "이어버드", "헤드셋", "헤드폰"],
              not: ["충전기", "케이블", "어댑터"] },
  card:     { name: "카드",     primary: ["PRP000"], related: ["PRH000", "PRZ000"], words: ["카드", "신용카드", "체크카드", "교통카드", "티머니"] },
  bag:      { name: "가방",     primary: ["PRA000"], related: ["PRQ000", "PRZ000"], words: ["가방", "백팩", "배낭", "파우치", "에코백", "크로스백"] },
  id:       { name: "신분증",   primary: ["PRN000"], related: ["PRH000", "PRP000", "PRZ000"], words: ["신분증", "주민등록증", "면허증", "학생증", "여권"] },
  key:      { name: "열쇠",     primary: ["PRF000"], related: ["PRZ000"], words: ["열쇠", "스마트키", "차키", "자동차키", "카드키", "키홀더"] },
  laptop:   { name: "노트북·태블릿", primary: ["PRI000", "PRG000"], home: [["컴퓨터", ""], ["전자기기", "태블릿"]], related: ["PRZ000"], words: ["노트북", "맥북", "태블릿", "아이패드", "갤럭시탭"],
              not: ["충전기", "충전", "케이블", "어댑터", "마우스", "거치대", "필름", "파우치", "케이스"] },
  clothes:  { name: "옷",       primary: ["PRK000"], related: ["PRQ000", "PRZ000"], words: ["옷", "의류", "자켓", "재킷", "패딩", "코트", "모자", "목도리"] },
  jewelry:  { name: "시계·귀금속", primary: ["PRO000", "PRG000"], home: [["귀금속", ""], ["전자기기", "스마트워치"]], related: ["PRZ000"], words: ["시계", "반지", "목걸이", "귀걸이", "팔찌", "워치"],
              not: ["충전기", "케이블"] },
  cash:     { name: "현금",     primary: ["PRL000"], related: ["PRH000", "PRZ000"], words: ["현금", "지폐"] },
  etc:      { name: "기타",     primary: ["PRZ000"], related: [], words: [] },
};

export const CATEGORY_NAMES = {
  PRA000: "가방", PRB000: "도서용품", PRC000: "서류", PRE000: "스포츠용품", PRF000: "자동차",
  PRG000: "전자기기", PRH000: "지갑", PRI000: "컴퓨터", PRJ000: "휴대폰", PRK000: "의류",
  PRL000: "현금", PRM000: "유가증권", PRN000: "증명서", PRO000: "귀금속", PRP000: "카드",
  PRQ000: "쇼핑백", PRZ000: "기타물품",
};

// ---------- XML ----------
// 숫자로 된 특수기호(&#xd; = 줄바꿈 등)까지 풀고, 줄바꿈과 여러 칸 공백은 한 칸으로 정리
const numeric = (str) =>
  str.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)));
const decode = (s) =>
  numeric(
    numeric(s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1"))
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'").replace(/&amp;/g, "&")
  ) // &amp;#xd; 처럼 두 번 감싼 경우를 위해 한 번 더
    .replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim();

export function tag(xml, name) {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return m ? decode(m[1]) : "";
}

// <item> 안의 태그를 모두 객체로
export function parseItems(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => {
    const obj = {};
    for (const t of m[1].matchAll(/<(\w+)>([\s\S]*?)<\/\1>/g)) obj[t[1]] = decode(t[2]);
    return obj;
  });
}

// ---------- 호출 ----------
export function keyParam() {
  const key = (process.env.SERVICE_KEY || "").trim();
  if (!key) return null;
  return key.includes("%") ? key : encodeURIComponent(key);
}

// 공공 API가 가끔 "어플리케이션 에러"(500)를 내므로: 잠깐 쉬고 한 번 더, 그래도 안 되면 개수를 줄여 한 번 더
export async function callApi(url, params, timeoutMs = 9000) {
  try {
    return await callOnce(url, params, timeoutMs);
  } catch (e1) {
    if (/SERVICE_KEY|등록되지 않은/.test(String(e1.message))) throw e1; // 키 문제는 재시도해도 소용없음
    await new Promise((r) => setTimeout(r, 400));
    try {
      return await callOnce(url, params, timeoutMs);
    } catch (e2) {
      if (!params.numOfRows || Number(params.numOfRows) <= 300) throw e2;
      return await callOnce(url, { ...params, numOfRows: "300" }, timeoutMs);
    }
  }
}

async function callOnce(url, params, timeoutMs) {
  const key = keyParam();
  if (!key) throw new Error("SERVICE_KEY 환경변수가 없습니다.");
  const qs = new URLSearchParams(params);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${url}?serviceKey=${key}&${qs}`, { signal: ctrl.signal });
    const xml = await res.text();
    const code = tag(xml, "resultCode");
    if (code !== "00") {
      const msg = tag(xml, "resultMsg") || tag(xml, "returnAuthMsg") || tag(xml, "errMsg") || "알 수 없는 오류";
      throw new Error(`API 오류 ${code || res.status}: ${msg}`);
    }
    return { total: Number(tag(xml, "totalCount") || 0), items: parseItems(xml) };
  } finally {
    clearTimeout(timer);
  }
}

// ---------- 날짜 ----------
export function ymd(d) {
  const k = new Date(d.getTime() + 9 * 3600000); // 한국 시간
  return k.toISOString().slice(0, 10).replaceAll("-", "");
}

export function daysSince(fdYmd) {
  if (!fdYmd) return null;
  const found = Date.parse(fdYmd.slice(0, 10) + "T00:00:00+09:00");
  const now = Date.now() + 9 * 3600000;
  const today = Date.parse(new Date(now).toISOString().slice(0, 10) + "T00:00:00+09:00");
  return Math.max(0, Math.round((today - found) / 86400000));
}

// ---------- 점수 ----------
const norm = (s) => (s || "").replace(/\s+/g, "").toLowerCase();

// 색상 이름 → 데이터에 쓰이는 표현
export const COLOR_WORDS = {
  검정: ["블랙", "검정", "검은"], 흰색: ["화이트", "흰"], 회색: ["그레이", "회"],
  빨강: ["레드", "빨강", "적"], 파랑: ["블루", "파랑", "청"], 남색: ["네이비", "남"],
  초록: ["그린", "초록", "녹"], 노랑: ["옐로우", "노랑", "황"], 분홍: ["핑크", "분홍"],
  보라: ["퍼플", "보라"], 갈색: ["브라운", "갈"], 베이지: ["베이지"], 은색: ["실버", "은"],
  금색: ["골드", "금"], 주황: ["오렌지", "주황"],
};
export const COLORS = Object.keys(COLOR_WORDS);

export function scoreItem(item, { type, words, color }) {
  const name = norm(item.fdPrdtNm);
  const subject = norm(item.fdSbjt);
  const cls = item.prdtClNm || "";
  const reasons = [];
  let score = 0;

  // 제자리 분류인지 (예: 태블릿은 '전자기기 > 태블릿'이 제자리라 '다른 분류'가 아님)
  const home = type.home || type.primary.map((c) => [CATEGORY_NAMES[c], ""]);
  const inPrimary = home.some(([top, sub]) => cls.startsWith(top) && (!sub || cls.includes(sub)));

  // 다른 분류의 물건인데 이름에 제외 단어(충전기, 케이스 등)가 있으면 단어 일치로 보지 않음
  const excluded = !inPrimary && (type.not || []).some((w) => name.includes(norm(w)));
  const hitName = !excluded && words.find((w) => w && name.includes(norm(w)));
  const hitSubject = !excluded && !hitName && words.find((w) => w && subject.includes(norm(w)));
  if (hitName) { score += 3; reasons.push(`물품명 '${hitName}' 일치`); }
  else if (hitSubject) { score += 1; reasons.push(`설명에 '${hitSubject}' 포함`); }

  if (color) {
    const cw = COLOR_WORDS[color] || [color];
    if (cw.some((w) => (item.clrNm || "").includes(w))) { score += 2; reasons.push("색상 일치"); }
  }

  if (inPrimary) { score += 2; reasons.push("분류 일치"); }

  return { score, reasons, inPrimary, matchedWord: Boolean(hitName || hitSubject) };
}

// ---------- 간단한 메모리 캐시 (같은 조건 재호출 줄이기) ----------
const cache = new Map();
export async function cached(key, ms, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ms) return hit.value;
  const value = await fn();
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 200) cache.delete(cache.keys().next().value);
  return value;
}
