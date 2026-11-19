// GET /api/search?type=earphone&words=에어팟&color=흰색&days=7&region=LCT000&widen=1
// region은 "LCR000,LCT000"처럼 여러 개(최대 3)도 가능
import {
  ENDPOINTS, REGIONS, TYPES, CATEGORY_NAMES, callApi, ymd, daysSince, scoreItem, cached,
} from "./_lib.js";
import { mockList } from "./_mock.js";

const MAX_ROWS = 1000;

function cleanImg(url) {
  if (!url || /no_img/i.test(url)) return null;
  return url;
}

async function fetchList(source, cat, params) {
  if (process.env.MOCK === "1") {
    const from = `${params.start.slice(0, 4)}-${params.start.slice(4, 6)}-${params.start.slice(6)}`;
    return { total: 0, items: mockList(source, cat).filter((it) => it.fdYmd >= from) };
  }
  const p = {
    pageNo: "1", numOfRows: String(MAX_ROWS),
    START_YMD: params.start, END_YMD: params.end, PRDT_CL_CD_01: cat,
  };
  if (params.region) p.N_FD_LCT_CD = params.region;
  const key = `${source}|${cat}|${params.start}|${params.end}|${params.region}`;
  return cached(key, 10 * 60 * 1000, () => callApi(ENDPOINTS[source].list, p));
}

export default async function handler(req, res) {
  try {
    const q = req.query || {};
    const type = TYPES[q.type] || TYPES.etc;
    const days = Math.min(Math.max(parseInt(q.days || "7", 10) || 7, 0), 30);
    const regions = [...new Set(String(q.region || "").split(",").filter((r) => REGIONS[r]))].slice(0, 3);
    const color = (q.color || "").trim();
    const widen = q.widen !== "0";
    const extraWords = (q.words || "").split(/[,\s]+/).map((w) => w.trim()).filter((w) => w.length >= 1);
    const words = [...new Set([...extraWords, ...type.words])];

    const now = new Date();
    const params = {
      start: ymd(new Date(now.getTime() - days * 86400000)),
      end: ymd(now),
    };

    const cats = widen ? [...type.primary, ...type.related] : type.primary;
    const jobs = [];
    for (const region of regions.length ? regions : [""]) {
      for (const source of ["police", "portal"]) {
        for (const cat of cats) jobs.push({ source, cat, region });
      }
    }

    const settled = await Promise.allSettled(jobs.map((j) => fetchList(j.source, j.cat, { ...params, region: j.region })));

    const errors = [];
    const truncated = [];
    const seen = new Set();
    const results = [];

    settled.forEach((r, i) => {
      const { source, cat } = jobs[i];
      if (r.status === "rejected") {
        console.error(`[search] ${source} ${cat} 실패:`, r.reason?.message || r.reason);
        const where = regions.length > 1 ? `${REGIONS[jobs[i].region]} ` : "";
        errors.push(`${where}${source === "police" ? "경찰서" : "지하철·상점 등 기관"} 보관 ${CATEGORY_NAMES[cat] || cat}`);
        return;
      }
      if (r.value.total > MAX_ROWS) truncated.push(`${ENDPOINTS[source].label} ${CATEGORY_NAMES[cat]}`);
      for (const it of r.value.items) {
        const id = `${source}:${it.atcId}:${it.fdSn || "1"}`;
        if (seen.has(id)) continue;
        seen.add(id);

        const s = scoreItem(it, { type, words, color });
        // 원래 분류가 아닌 물건은 물품명·설명에 단어가 맞을 때만 보여준다
        if (!s.inPrimary && !s.matchedWord) continue;
        // 사용자가 단어를 따로 적었는데 원래 분류 안에서도 전혀 안 맞으면 뒤로 보낸다 (제외하진 않음)

        results.push({
          id: it.atcId,
          sn: it.fdSn || "1",
          source,
          sourceLabel: ENDPOINTS[source].label,
          name: it.fdPrdtNm,
          category: it.prdtClNm,
          color: it.clrNm,
          date: it.fdYmd,
          days: daysSince(it.fdYmd),
          place: it.depPlace,
          img: cleanImg(it.fdFilePathImg),
          score: s.score,
          reasons: s.reasons,
          otherCategory: !s.inPrimary,
        });
      }
    });

    results.sort((a, b) => b.score - a.score || (b.date || "").localeCompare(a.date || ""));

    if (errors.length === jobs.length) {
      res.status(502).json({ error: "습득물 정보를 불러오지 못했습니다.", details: errors });
      return;
    }

    res.status(200).json({
      count: results.length,
      // 상위 150건 + 그 밖의 '다른 분류' 물건도 모아보기에서 빠지지 않게 함께 보냄
      items: [
        ...results.slice(0, 150),
        ...results.slice(150).filter((r) => r.otherCategory).slice(0, 150),
      ],
      widenedCount: results.filter((r) => r.otherCategory).length,
      period: { start: params.start, end: params.end, days },
      region: regions.length ? regions.map((r) => REGIONS[r]).join("·") : "전국",
      typeName: type.name,
      categories: cats.map((c) => CATEGORY_NAMES[c] || c),
      errors,
      truncated,
      fetchedAt: new Date().toISOString(),
      mock: process.env.MOCK === "1",
    });
  } catch (e) {
    res.status(500).json({ error: "검색 중 오류가 발생했습니다.", details: [String(e.message || e)] });
  }
}
