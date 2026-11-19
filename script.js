// 다시찾기 화면 동작
const TYPES = [
  ["wallet", "지갑", "👛"], ["phone", "휴대폰", "📱"], ["earphone", "이어폰", "🎧"], ["card", "카드", "💳"],
  ["bag", "가방", "🎒"], ["id", "신분증", "🪪"], ["key", "열쇠", "🔑"], ["laptop", "노트북·태블릿", "💻"],
  ["clothes", "옷", "🧥"], ["jewelry", "시계·귀금속", "⌚"], ["cash", "현금", "💵"], ["etc", "기타", "📦"],
];
const ICON = Object.fromEntries(TYPES.map(([k, , i]) => [k, i]));
const NAME = Object.fromEntries(TYPES.map(([k, n]) => [k, n]));

const DAYS = [["오늘", 1], ["어제", 2], ["3일 이내", 3], ["1주일", 7], ["한 달", 30]];

// 행정구역 순서로, 특별시·광역시와 도를 나눠서 보여줌
const REGION_GROUPS = [
  ["특별시·광역시", [["LCA000", "서울"], ["LCT000", "부산"], ["LCR000", "대구"], ["LCV000", "인천"],
    ["LCS000", "대전"], ["LCU000", "울산"], ["LCW000", "세종"]]],
  ["도", [["LCI000", "경기"], ["LCH000", "강원"], ["LCO000", "충북"], ["LCN000", "충남"],
    ["LCM000", "전북"], ["LCG000", "전남·광주"], ["LCK000", "경북"], ["LCJ000", "경남"], ["LCP000", "제주"]]],
];
const REGIONS = [["", "전국"], ...REGION_GROUPS.flatMap(([, list]) => list)];
const COLORS = ["검정", "흰색", "회색", "빨강", "파랑", "남색", "초록", "노랑", "분홍", "보라", "갈색", "베이지", "은색", "금색", "주황"];

// 분류명 → 아이콘 (사진 없을 때)
// 아이콘: 중분류 → 물품명 → 대분류 순으로 맞는 규칙을 찾음 (예: 귀금속 > 시계 → ⌚)
const ICON_RULES = [
  [/이어폰|에어팟|버즈|헤드셋|헤드폰/, "🎧"],
  [/스마트워치|워치|시계/, "⌚"],
  [/반지|목걸이|귀걸이|팔찌|귀금속/, "💍"],
  [/태블릿|노트북|컴퓨터|맥북|아이패드/, "💻"],
  [/휴대폰|핸드폰|아이폰|스마트폰/, "📱"],
  [/카메라/, "📷"],
  [/지갑/, "👛"],
  [/카드/, "💳"],
  [/가방|백팩|파우치|쇼핑백|캐리어/, "🎒"],
  [/증명서|신분증|면허|여권|학생증/, "🪪"],
  [/열쇠|자동차|키/, "🔑"],
  [/의류|옷|자켓|패딩|코트|모자/, "🧥"],
  [/현금|지폐/, "💵"],
  [/유가증권|상품권/, "🎫"],
  [/도서|서적|책/, "📚"],
  [/서류/, "📄"],
  [/스포츠/, "⚽"],
  [/악기/, "🎸"],
  [/안경|선글라스/, "👓"],
  [/우산/, "☂️"],
  [/전자기기|충전기|배터리/, "🔌"],
];
function iconFor(category, name = "") {
  const [top = "", sub = ""] = (category || "").split(">").map((x) => x.trim());
  for (const text of [sub, name, top]) {
    if (!text || /^기타/.test(text)) continue; // '기타'는 단서가 안 되므로 건너뜀
    const hit = ICON_RULES.find(([re]) => re.test(text));
    if (hit) return hit[1];
  }
  return "📦";
}

const state = { type: "earphone", days: 7, region: "LCT000", color: "", words: "", widen: true };

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// 마지막 지역 기억 (브라우저에만 저장)
try {
  const saved = localStorage.getItem("dasichatgi.region");
  if (saved !== null) state.region = saved;
} catch (_) { /* 저장소를 못 쓰는 환경 */ }

// ---------- 화면 만들기 ----------
function renderTypes() {
  $("type-grid").innerHTML = TYPES.map(([k, n, i]) =>
    `<button type="button" class="type-btn" role="radio" aria-checked="${state.type === k}" data-type="${k}">
       <span class="ico" aria-hidden="true">${i}</span><span>${n}</span></button>`).join("");
}
function renderDays() {
  $("day-buttons").innerHTML = DAYS.map(([n, d]) =>
    `<button type="button" role="radio" aria-checked="${state.days === d}" data-days="${d}">${n}</button>`).join("");
}
function renderSelects() {
  $("region").innerHTML = `<option value="">전국</option>` + REGION_GROUPS.map(([g, list]) =>
    `<optgroup label="${g}">${list.map(([c, n]) => `<option value="${c}">${n}</option>`).join("")}</optgroup>`).join("");
  // 문장 검색으로 여러 지역이 정해지면 목록에 임시 항목으로 보여준다
  if (state.region.includes(",")) {
    const label = state.region.split(",").map(regionName).join(" + ");
    $("region").insertAdjacentHTML("afterbegin", `<option value="${state.region}">${esc(label)}</option>`);
  }
  $("region").value = state.region;
  $("color").innerHTML = `<option value="">상관없음</option>` + COLORS.map((c) => `<option>${c}</option>`).join("");
  $("color").value = state.color;
  $("words").value = state.words;
  $("widen").checked = state.widen;
}

$("type-grid").addEventListener("click", (e) => {
  const b = e.target.closest("[data-type]");
  if (!b) return;
  state.type = b.dataset.type;
  renderTypes();
});
$("day-buttons").addEventListener("click", (e) => {
  const b = e.target.closest("[data-days]");
  if (!b) return;
  state.days = Number(b.dataset.days);
  renderDays();
});
$("region").addEventListener("change", (e) => {
  state.region = e.target.value;
  try { localStorage.setItem("dasichatgi.region", state.region); } catch (_) {}
});
$("color").addEventListener("change", (e) => { state.color = e.target.value; });
$("words").addEventListener("input", (e) => { state.words = e.target.value; });
$("widen").addEventListener("change", (e) => { state.widen = e.target.checked; });
$("search-btn").addEventListener("click", () => search());

// ---------- 문장으로 찾기 ----------
$("sentence-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = $("sentence").value.trim();
  const msg = $("sentence-msg");
  msg.className = "hint";
  if (!text) { msg.textContent = "잃어버린 상황을 한 줄로 적어 주세요."; return; }
  msg.textContent = "문장을 이해하는 중…";
  try {
    const r = await fetch("/api/parse", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "문장을 이해하지 못했어요.");
    state.type = data.type;
    state.days = nearestDays(data.days);
    if (data.region !== undefined) state.region = data.region;
    state.color = data.color || "";
    state.words = (data.words || []).join(", ");
    renderTypes(); renderDays(); renderSelects();
    showAiChips(data);
    msg.textContent = "이렇게 이해했어요. 틀린 부분은 아래에서 바로 고칠 수 있어요.";
    search();
  } catch (err) {
    msg.className = "hint error";
    const why = err instanceof TypeError ? "서버에 연결하지 못했어요." : err.message;
    msg.textContent = `${why} 아래 버튼으로 골라서 찾아 주세요.`;
    $("ai-chips").hidden = true;
  }
});

function nearestDays(d) {
  const opts = DAYS.map(([, v]) => v);
  return opts.find((v) => v >= d) || 30;
}

function showAiChips(d) {
  const region = d.region ? d.region.split(",").map(regionName).join(" + ") : "전국";
  const chips = [
    `물건: ${NAME[d.type] || "기타"}`,
    d.words?.length ? `이름: ${d.words.join(", ")}` : null,
    d.color ? `색상: ${d.color}` : null,
    `기간: 최근 ${nearestDays(d.days)}일`,
    `지역: ${region}${d.place ? ` (${d.place})` : ""}`,
  ].filter(Boolean);
  const box = $("ai-chips");
  box.innerHTML = chips.map((c) => `<span class="chip">${esc(c)}</span>`).join("");
  box.hidden = false;
}

// ---------- 검색 ----------
let lastData = null;

async function search(overrides = {}) {
  Object.assign(state, overrides);
  renderTypes(); renderDays(); renderSelects();
  const out = $("results");
  out.innerHTML = `<p class="loading">찾는 중이에요…</p>`;
  $("search-btn").disabled = true;
  const qs = new URLSearchParams({
    type: state.type, days: state.days, region: state.region,
    color: state.color, words: state.words, widen: state.widen ? "1" : "0",
  });
  try {
    const r = await fetch(`/api/search?${qs}`);
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "검색에 실패했어요.");
    lastData = { ...data, searchedType: state.type };
    renderResults(data);
    $("fetched-at").textContent = `마지막 조회: ${new Date(data.fetchedAt).toLocaleString("ko-KR")}${data.mock ? " (예시 데이터)" : ""}`;
  } catch (err) {
    out.innerHTML = `<div class="notice">${esc(err.message)}<br>잠시 후 다시 시도하거나 <a href="https://minwon24.police.go.kr" target="_blank" rel="noopener">경찰민원24</a>에서 확인해 주세요.</div>`;
  } finally {
    $("search-btn").disabled = false;
    // 모바일에서만 결과로 내려간다 (PC는 결과가 오른쪽에 바로 보임)
    if (window.matchMedia("(max-width: 959px)").matches) {
      out.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
}

function renderResults(data, opts = {}) {
  if (!opts.keepView) { view = "all"; }
  const out = $("results");
  const periodText = `최근 ${data.period.days}일`;
  let html = `<div class="summary">
      <h2>${esc(data.region)} · ${esc(data.typeName)} · ${data.count}건</h2>
      <p>${periodText} 경찰서·기관 보관 습득물${data.count > data.items.length ? ` · 비슷한 순서로 ${data.items.length}건까지 보여줘요` : ""}</p>
    </div>`;
  if (data.count) html += toolbarHtml(data);

  if (data.errors?.length) {
    html += `<div class="notice">${esc(data.errors.join(", "))} 정보를 잠시 불러오지 못했어요. 나머지 결과는 정상이에요. 잠시 후 다시 찾기를 눌러 주세요.</div>`;
  }
  if (data.truncated?.length) {
    html += `<div class="notice">결과가 많아 일부만 보여줘요. 지역을 고르거나 기간을 줄이면 더 정확해요.</div>`;
  }

  if (!data.count) {
    html += emptyState();
    out.innerHTML = html;
    return;
  }
  html += `<div class="list" id="list"></div><nav class="pager" id="pager" aria-label="페이지"></nav>`;
  out.innerHTML = html;
  page = 1;
  renderPage();
}

// ---------- 페이지 나누기 ----------
let page = 1;
const isPC = () => window.matchMedia("(min-width: 960px)").matches;
const pageSize = () => (isPC() ? 10 : 8);

// ---------- 놓칠 뻔한 물건 모아보기 + 정렬 ----------
let view = "all";      // all: 전체, widened: 다른 분류에서 찾은 물건만
let sortBy = "score";  // score: 비슷한 순, date: 최신순

function currentItems() {
  let items = lastData.items;
  if (view === "widened") items = items.filter((it) => it.otherCategory);
  else items = items.slice(0, 150);
  if (sortBy === "date") {
    items = [...items].sort((a, b) => (b.date || "").localeCompare(a.date || "") || b.score - a.score);
  }
  return items;
}

function toolbarHtml(data) {
  const n = data.widenedCount || 0;
  const miss = n
    ? `<div class="miss ${view === "widened" ? "on" : ""}">
         <p>${view === "widened"
           ? `<strong>다른 분류에 등록된 물건 ${n}건</strong>만 보고 있어요`
           : `일반 분류 검색이었다면 <strong>놓쳤을 물건 ${n}건</strong>을 더 찾았어요`}</p>
         <button type="button" class="btn" data-view="${view === "widened" ? "all" : "widened"}">
           ${view === "widened" ? "전체 보기" : "모아보기"}</button>
       </div>`
    : "";
  const sort = `<div class="sort" role="radiogroup" aria-label="정렬">
      <button type="button" role="radio" data-sort="score" aria-checked="${sortBy === "score"}">비슷한 순</button>
      <button type="button" role="radio" data-sort="date" aria-checked="${sortBy === "date"}">최신순</button>
    </div>`;
  return `<div class="toolbar">${miss}${sort}</div>`;
}

$("results").addEventListener("click", (e) => {
  const v = e.target.closest("[data-view]");
  const s = e.target.closest("[data-sort]");
  if (!v && !s) return;
  if (v) view = v.dataset.view;
  if (s) sortBy = s.dataset.sort;
  renderResults(lastData, { keepView: true });
});

function renderPage() {
  if (!lastData || !lastData.items.length) return;
  const items = currentItems();
  const size = pageSize();
  const pages = Math.ceil(items.length / size);
  page = Math.min(Math.max(page, 1), pages);
  $("list").innerHTML = items.slice((page - 1) * size, page * size).map(itemCard).join("");
  $("pager").innerHTML = pages > 1 ? pagerHtml(pages) : "";
}

function pagerHtml(pages) {
  // 번호는 최대 5개, 현재 페이지가 가운데 오도록
  let start = Math.max(1, page - 2);
  let end = Math.min(pages, start + 4);
  start = Math.max(1, end - 4);
  const btn = (p, label, extra = "") =>
    `<button type="button" data-page="${p}" ${extra}>${label}</button>`;
  let h = btn(page - 1, "&lt;", `aria-label="이전 페이지" ${page === 1 ? "disabled" : ""}`);
  if (start > 1) h += btn(1, "1") + (start > 2 ? `<span class="dots">…</span>` : "");
  for (let p = start; p <= end; p++) {
    h += btn(p, p, p === page ? `aria-current="page"` : "");
  }
  if (end < pages) h += (end < pages - 1 ? `<span class="dots">…</span>` : "") + btn(pages, pages);
  h += btn(page + 1, "&gt;", `aria-label="다음 페이지" ${page === pages ? "disabled" : ""}`);
  return h;
}

$("results").addEventListener("click", (e) => {
  const b = e.target.closest("[data-page]");
  if (!b || b.disabled) return;
  page = Number(b.dataset.page);
  renderPage();
  $("results").scrollIntoView({ behavior: "smooth", block: "start" });
});

// 화면 크기가 바뀌면 한 페이지 개수가 달라지므로 다시 그림
let lastSize = pageSize();
window.addEventListener("resize", () => {
  if (pageSize() !== lastSize) { lastSize = pageSize(); page = 1; renderPage(); }
});

function itemCard(it) {
  // 분류·이름으로 아이콘을 찾고, 단서가 없는 기타물품이면 찾고 있는 물건의 아이콘으로
  let icon = iconFor(it.category, it.name);
  if (icon === "📦" && it.otherCategory && lastData?.searchedType && lastData.searchedType !== "etc") {
    icon = ICON[lastData.searchedType];
  }
  const img = it.img
    ? `<img src="${esc(it.img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(document.createTextNode('${icon}'))">`
    : icon;
  const chips = [
    `<span class="chip gray">${esc(it.sourceLabel)}</span>`,
    it.otherCategory && view !== "widened" ? `<span class="chip warn">다른 분류로 등록됨</span>` : "",
    ...(it.reasons || []).filter((r) => r !== "분류 일치").map((r) => `<span class="chip ok">${esc(r)}</span>`),
  ].join("");
  return `<button class="item" data-source="${esc(it.source)}" data-id="${esc(it.id)}" data-sn="${esc(it.sn)}">
      <div class="thumb">${img}</div>
      <div>
        <h3>${esc(it.name)}</h3>
        <p class="meta">${esc(it.category)}${it.color ? ` · ${esc(it.color)}` : ""}</p>
        <p class="meta">${esc(it.date)} 습득${it.days !== null ? ` (${it.days}일 지남)` : ""} · ${esc(it.place)}</p>
        <div class="chips">${chips}</div>
      </div>
    </button>`;
}

function regionName(code) {
  return REGIONS.find(([c]) => c === code)?.[1] || code;
}

function emptyState() {
  const btns = [];
  if (state.color) btns.push(`<button class="btn" data-widen="color">색상 조건 빼고 다시 찾기</button>`);
  if (state.words) btns.push(`<button class="btn" data-widen="words">물건 이름 빼고 다시 찾기</button>`);
  if (state.days < 30) btns.push(`<button class="btn" data-widen="days">기간을 ${state.days < 7 ? "1주일" : "한 달"}로 넓히기</button>`);
  if (!state.widen) btns.push(`<button class="btn" data-widen="widen">다른 분류까지 넓혀 찾기</button>`);
  if (state.region) btns.push(`<button class="btn" data-widen="region">전국에서 찾기</button>`);
  return `<div class="empty">
      <h3>아직 맞는 물건이 없어요</h3>
      <p class="meta">조건을 조금 넓히면 찾을 수도 있어요. 습득물은 하루 한 번 새로 들어오니 내일 다시 확인해 보세요.</p>
      <div class="btns">${btns.join("")}</div>
    </div>`;
}

$("results").addEventListener("click", (e) => {
  const w = e.target.closest("[data-widen]");
  if (w) {
    const k = w.dataset.widen;
    if (k === "color") search({ color: "" });
    if (k === "words") search({ words: "" });
    if (k === "days") search({ days: state.days < 7 ? 7 : 30 });
    if (k === "widen") search({ widen: true });
    if (k === "region") search({ region: "" });
    return;
  }
  const it = e.target.closest(".item");
  if (it) openDetail(it.dataset.source, it.dataset.id, it.dataset.sn);
});

// ---------- 상세 ----------
async function openDetail(source, id, sn) {
  const dlg = $("detail");
  const body = $("detail-body");
  body.innerHTML = `<p class="loading">불러오는 중…</p>`;
  if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
  try {
    const r = await fetch(`/api/detail?${new URLSearchParams({ source, id, sn })}`);
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "상세 정보를 불러오지 못했어요.");
    const tel = (d.tel || "").replace(/[^0-9-]/g, "");
    const mapQuery = encodeURIComponent(d.storePlace || d.org || "");
    body.innerHTML = `
      ${d.img ? `<img class="detail-img" src="${esc(d.img)}" alt="습득물 사진" referrerpolicy="no-referrer">` : ""}
      <h2>${esc(d.name)}</h2>
      <div class="chips">
        <span class="chip gray">${esc(d.sourceLabel)}</span>
        ${d.status ? `<span class="chip ${d.status.includes("보관") ? "ok" : "gray"}">${esc(d.status)}</span>` : ""}
      </div>
      <dl class="dl">
        <dt>보관 장소</dt><dd>${esc(d.storePlace) || "-"}</dd>
        <dt>습득 일시</dt><dd>${esc(d.date)}${d.hour ? ` ${esc(d.hour)}시경` : ""}</dd>
        <dt>습득 장소</dt><dd>${esc(d.foundPlace) || "-"}</dd>
        <dt>분류</dt><dd>${esc(d.category)}${d.color ? ` · ${esc(d.color)}` : ""}</dd>
        <dt>관리번호</dt><dd>${esc(d.id)}</dd>
      </dl>
      ${d.days !== null ? `<p class="elapsed">습득한 지 <strong>${d.days}일</strong> 지났어요. 습득물은 공고 후 6개월이 지나면 주인이 권리를 잃을 수 있으니 빨리 문의하세요.</p>` : ""}
      ${d.notice ? `<p class="notice-text">${esc(d.notice)}</p>` : ""}
      <p class="meta">찾으러 갈 때: 신분증을 챙기고, 방문 전에 전화로 관리번호를 말해 보관 여부를 확인하세요.</p>
      <div class="actions">
        ${tel ? phoneButton(tel) : `<span class="btn" aria-disabled="true">전화번호 없음</span>`}
        <a class="btn" href="https://map.naver.com/p/search/${mapQuery}" target="_blank" rel="noopener">지도에서 보기</a>
      </div>`;
  } catch (err) {
    body.innerHTML = `<div class="notice">${esc(err.message)}</div>`;
  }
}
// 전화번호 버튼: 휴대폰(터치 화면)은 누르면 전화 연결, PC는 누르면 번호 복사
const isTouch = () => window.matchMedia("(pointer: coarse)").matches;
function phoneButton(tel) {
  if (isTouch()) {
    return `<a class="btn primary phone" href="tel:${tel}"><span class="phone-label">전화 걸기</span>${tel}</a>`;
  }
  return `<button type="button" class="btn primary phone" data-copy="${tel}"><span class="phone-label">보관 기관 전화번호</span>${tel}</button>`;
}
$("detail-body").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-copy]");
  if (!b) return;
  const tel = b.dataset.copy;
  try { await navigator.clipboard.writeText(tel); } catch (_) { /* 복사 권한이 없으면 번호만 보여줌 */ }
  const label = b.querySelector(".phone-label");
  label.textContent = "번호를 복사했어요";
  setTimeout(() => { label.textContent = "보관 기관 전화번호"; }, 1800);
});

$("detail-close").addEventListener("click", () => $("detail").close?.() ?? $("detail").removeAttribute("open"));

// ---------- 시작 ----------
renderTypes();
renderDays();
renderSelects();
