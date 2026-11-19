// MOCK=1 일 때 쓰는 가짜 데이터 (실제 응답 형식을 흉내 냄). 화면 확인용.
import { CATEGORY_NAMES, ymd } from "./_lib.js";

const day = (n) => {
  const d = new Date(Date.now() - n * 86400000);
  const s = ymd(d);
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
};

const RAW = [
  ["police", "F2026111200000101", "PRG000", "전자기기 > 무선이어폰", "화이트(흰)", "에어팟 프로", "서면지구대", 1],
  ["portal", "V0007742L11120004", "PRZ000", "기타물품 > 기타", "화이트(흰)", "흰색 이어폰 케이스(키링)", "부산교통공사 서면역", 1],
  ["police", "F2026111100000222", "PRG000", "전자기기 > 무선이어폰", "블랙(검정)", "갤럭시 버즈", "부산진경찰서", 2],
  ["portal", "V0007742L11100009", "PRG000", "전자기기 > 기타용품", "화이트(흰)", "무선 이어폰 한쪽", "롯데백화점 부산본점", 3],
  ["police", "F2026111000000330", "PRH000", "지갑 > 남성용 지갑", "블랙(검정)", "검정 반지갑", "남포지구대", 3],
  ["portal", "V0007742L11090001", "PRZ000", "기타물품 > 기타", "브라운(갈)", "갈색 카드지갑", "다이소(서면점)", 4],
  ["police", "F2026110900000417", "PRH000", "지갑 > 여성용 지갑", "핑크(분홍)", "분홍 장지갑", "해운대지구대", 4],
  ["portal", "V0007742L11080003", "PRP000", "카드 > 신용(체크)카드", "블루(파랑)", "삼성카드", "부산김해경전철주식회사", 5],
  ["police", "F2026110800000521", "PRJ000", "휴대폰 > 아이폰", "블랙(검정)", "아이폰 15", "청학파출소", 5],
  ["portal", "V0007742L11070002", "PRA000", "가방 > 기타가방", "블랙(검정)", "검정 백팩", "부산교통공사 연산역", 6],
  ["police", "F2026110600000612", "PRF000", "자동차 > 자동차열쇠", "블랙(검정)", "현대차 스마트키", "사상지구대", 7],
  ["portal", "V0007742L11050005", "PRZ000", "기타물품 > 기타", "그레이(회)", "회색 파우치(안에 이어폰)", "홈플러스 센텀시티점", 8],
];

export function mockList(source, cat) {
  return RAW.filter((r) => r[0] === source && r[2] === cat).map((r) => ({
    atcId: r[1], fdSn: "1", prdtClNm: r[3], clrNm: r[4], fdPrdtNm: r[5],
    fdSbjt: `${r[5]}(${r[4]}색)을 습득하여 보관하고 있습니다.`,
    depPlace: r[6], fdYmd: day(r[7]),
    fdFilePathImg: "https://www.lost112.go.kr/lostnfs/images/sub/img02_no_img.gif",
  }));
}

export function mockDetail(source, id) {
  const r = RAW.find((x) => x[1] === id) || RAW[0];
  return {
    atcId: r[1], fdSn: "1", fdPrdtNm: r[5], prdtClNm: r[3], clrNm: r[4],
    fdYmd: day(r[7]), fdHor: "15", fdPlace: "서면역 3번 출구 근처", depPlace: r[6],
    csteSteNm: "보관중", orgNm: r[6], tel: "051-000-0000",
    uniq: `${r[6]}에서는 [${day(r[7])}] [${r[5]}]을 습득/보관 하였습니다. 분실하신 분께서는 본인을 증명할 수 있는 서류를 지참하시어 방문하시기 바랍니다.`,
    fdFilePathImg: "https://www.lost112.go.kr/lostnfs/images/sub/img02_no_img.gif",
  };
}

export { CATEGORY_NAMES };
