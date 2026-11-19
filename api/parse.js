// POST /api/parse  { text: "어제 서면역에서 흰색 에어팟 잃어버렸어" }
// 생성형 AI(Gemini)로 문장을 검색 조건으로 바꾼다.
// AI가 바쁘거나(503) 실패해도 화면이 멈추지 않도록, 간단한 규칙 해석으로 대신 답한다.
import { TYPES, REGIONS, COLORS, COLOR_WORDS } from "./_lib.js";

// 앞에서부터 시도. 붐비면(503·500·429) 잠깐 쉬고 다음 모델로 넘어간다.
const MODELS = [
  process.env.GEMINI_MODEL, "gemini-3.8-flash", "gemini-flash-latest",
  "gemini-flash-lite-latest", "gemini-2.5-flash", "gemini-2.5-flash-lite",
].filter(Boolean).filter((m, i, a) => a.indexOf(m) === i);

function buildPrompt(text) {
  const types = Object.entries(TYPES).map(([k, v]) => `${k}(${v.name})`).join(", ");
  const regions = Object.entries(REGIONS).map(([k, v]) => `${k}(${v})`).join(", ");
  const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  return `너는 분실물 검색 조건을 뽑는 도우미야. 오늘은 ${today}(한국 시간)이야.
사용자 문장에서 아래 JSON만 출력해. 설명은 쓰지 마.
{"type": 물건 종류 키, "words": 물품명에서 찾을 단어 배열(최대 4개, 예: ["에어팟","이어폰"]), "color": 색상 또는 "", "days": 잃어버린 날부터 오늘까지 며칠 전부터 찾을지(0~30 정수, 모르면 7), "region": 지역 코드 또는 "", "place": 문장에 나온 장소 이름 또는 ""}
- type은 다음 중 하나: ${types}
- color는 다음 중 하나 또는 "": ${COLORS.join(", ")}
- region은 다음 중 하나 또는 "": ${regions}. 역 이름·동네 이름이면 해당 시도를 골라 (예: 서면역 → LCT000, 사상 → LCT000).
- 버스·기차·비행기로 여러 지역을 오가다 잃어버렸거나 지역이 두 곳 이상 나오면 region에 코드를 쉼표로 이어 적고(최대 3개, 예: "LCR000,LCT000"), place에 "대구→부산역"처럼 적어.
- days는 "어제"면 2, "오늘"이면 1, "지난주"면 10처럼 여유를 조금 둬.
사용자 문장: """${text}"""`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function askGemini(key, prompt) {
  let lastErr;
  const started = Date.now();
  for (const model of MODELS) {
    if (Date.now() - started > 8000) break; // 너무 오래 걸리면 규칙 해석으로
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
    let r, data;
    try {
      r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0 },
        }),
        signal: AbortSignal.timeout(6000),
      });
      data = await r.json().catch(() => ({}));
    } catch (e) {
      console.error(`[parse] ${model} 연결 실패: ${e.message}`);
      lastErr = e;
      continue;
    }
    if (r.ok) {
      console.log(`[parse] ${model} 사용`);
      return data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    }
    const msg = data?.error?.message || `HTTP ${r.status}`;
    console.error(`[parse] ${model} 실패 (${r.status}): ${msg.slice(0, 120)}`);
    lastErr = new Error(msg);
    if (r.status === 400 || r.status === 401 || r.status === 403) break; // 키 문제는 다른 모델도 안 됨
    if (r.status >= 500 || r.status === 429) await sleep(500);
  }
  throw lastErr || new Error("AI 응답 없음");
}

// ---------- AI 없이 규칙으로 해석 (대체용) ----------
const TYPE_ORDER = ["earphone", "wallet", "phone", ...Object.keys(TYPES)];
const EXTRA_WORDS = { phone: ["폰"], cash: ["돈"], key: ["키"] };

const PLACE_REGION = [
  [/부산|사상|서면|해운대|남포|센텀|광안|동래|연산|사하|하단|덕천|기장|김해공항/, "LCT000"],
  [/서울|강남|홍대|신촌|잠실|명동|종로|여의도|건대|성수|이태원|용산|신림|노원/, "LCA000"],
  [/인천|부평|송도|주안/, "LCV000"],
  [/경기|수원|성남|분당|판교|고양|일산|용인|부천|안양|의정부|화성|평택/, "LCI000"],
  [/대구|동성로|반월당/, "LCR000"],
  [/대전|둔산/, "LCS000"], [/울산/, "LCU000"], [/세종/, "LCW000"], [/광주|전남|여수|순천|목포/, "LCG000"],
  [/강원|춘천|강릉|원주|속초/, "LCH000"], [/충북|청주|충주/, "LCO000"], [/충남|천안|아산/, "LCN000"],
  [/전북|전주|군산|익산/, "LCM000"], [/경북|포항|구미|경주|안동/, "LCK000"],
  [/경남|창원|마산|진주|양산|김해|거제/, "LCJ000"], [/제주|서귀포/, "LCP000"],
];

function ruleParse(text) {
  const t = text.replace(/\s+/g, " ");
  let type = "etc", words = [];
  for (const k of TYPE_ORDER) {
    const v = TYPES[k];
    if (!v) continue;
    const hit = [...(v.words || []), ...(EXTRA_WORDS[k] || [])].filter((w) => t.includes(w));
    if (hit.length) { type = k; words = hit.filter((w) => w.length >= 2).slice(0, 4); break; }
  }
  let color = "";
  for (const [c, ws] of Object.entries(COLOR_WORDS)) {
    if ([c, ...ws].some((w) => w.length >= 2 && t.includes(w))) { color = c; break; }
  }
  let days = 7;
  const n = t.match(/(\d+)\s*일\s*전/);
  if (n) days = Number(n[1]) + 1;
  else if (/오늘|방금|아까/.test(t)) days = 1;
  else if (/그저께|그제/.test(t)) days = 3;
  else if (/어제/.test(t)) days = 2;
  else if (/지난\s*주|저번\s*주/.test(t)) days = 10;
  else if (/지난\s*달|저번\s*달|한\s*달/.test(t)) days = 30;
  // 문장에 나온 지역을 순서대로 모두 찾는다
  const found = [];
  for (const [re, code] of PLACE_REGION) {
    const g = new RegExp(re.source, "g");
    let m;
    while ((m = g.exec(t))) {
      const next = t.slice(m.index + m[0].length).match(/^(역|공항|터미널)/);
      const name = m[0] + (next ? next[0] : "");
      found.push({ code, name, at: m.index });
    }
  }
  found.sort((a, b) => a.at - b.at);
  const codes = [...new Set(found.map((f) => f.code))];
  let region = "", place = "";
  if (codes.length === 1) { region = codes[0]; place = found[0].name; }
  else if (codes.length > 1) {
    // 여러 지역을 오갔으면 그 지역들을 모두 검색 (최대 3곳, 그보다 많으면 전국)
    region = codes.length <= 3 ? codes.join(",") : "";
    place = codes.map((c) => found.find((f) => f.code === c).name).join("→");
  }
  return { type, words, color, days, region, place };
}

function clean(out) {
  return {
    type: TYPES[out.type] ? out.type : "etc",
    words: Array.isArray(out.words) ? out.words.map(String).filter(Boolean).slice(0, 4) : [],
    color: COLORS.includes(out.color) ? out.color : "",
    days: Math.min(Math.max(parseInt(out.days, 10) || 7, 1), 30),
    region: [...new Set(String(out.region || "").split(",").map((r) => r.trim()).filter((r) => REGIONS[r]))].slice(0, 3).join(","),
    place: typeof out.place === "string" ? out.place.slice(0, 30) : "",
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST만 지원합니다." });
    return;
  }
  const text = String((req.body && req.body.text) || "").slice(0, 300).trim();
  if (!text) {
    res.status(400).json({ error: "문장을 입력해 주세요." });
    return;
  }
  const key = (process.env.GEMINI_API_KEY || "").trim().replace(/^["']|["']$/g, "");
  if (key) {
    try {
      const raw = await askGemini(key, buildPrompt(text));
      const out = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ""));
      res.status(200).json({ ...clean(out), by: "ai" });
      return;
    } catch (e) {
      console.error("[parse] AI 실패, 규칙 해석으로 대체:", String(e.message || e).slice(0, 120));
    }
  }
  res.status(200).json({ ...clean(ruleParse(text)), by: "rule" });
}
