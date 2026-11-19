// GET /api/detail?source=police&id=F2026...&sn=1
import { ENDPOINTS, callApi, daysSince, cached } from "./_lib.js";
import { mockDetail } from "./_mock.js";

export default async function handler(req, res) {
  try {
    const { source, id, sn = "1" } = req.query || {};
    if (!ENDPOINTS[source] || !id) {
      res.status(400).json({ error: "잘못된 요청입니다." });
      return;
    }
    let item;
    if (process.env.MOCK === "1") {
      item = mockDetail(source, id);
    } else {
      const r = await cached(`detail|${source}|${id}|${sn}`, 30 * 60 * 1000, () =>
        callApi(ENDPOINTS[source].detail, { ATC_ID: id, FD_SN: String(sn) })
      );
      item = r.items[0];
    }
    if (!item) {
      res.status(404).json({ error: "상세 정보를 찾지 못했습니다." });
      return;
    }
    const img = item.fdFilePathImg && !/no_img/i.test(item.fdFilePathImg) ? item.fdFilePathImg : null;
    res.status(200).json({
      id, source, sourceLabel: ENDPOINTS[source].label,
      name: item.fdPrdtNm || item.prdtClNm || "",
      category: item.prdtClNm || "",
      color: item.clrNm || "",
      date: item.fdYmd || "",
      hour: item.fdHor || "",
      days: daysSince(item.fdYmd),
      foundPlace: item.fdPlace || "",
      storePlace: item.depPlace || item.orgNm || "",
      org: item.orgNm || "",
      tel: item.tel || item.orgTel || "",
      status: item.csteSteNm || "",
      notice: (item.uniq || item.fdSbjt || "").replace(/^내용\s*[:：]?\s*/, ""),
      img,
      raw: item,
    });
  } catch (e) {
    res.status(502).json({ error: "상세 정보를 불러오지 못했습니다.", details: [String(e.message || e)] });
  }
}
