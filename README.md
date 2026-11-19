# 다시찾기

분류가 다르게 등록된 습득물까지 넓혀 찾아주는 분실물 검색 웹앱 (공공데이터 활용 웹앱 개발 프로젝트 3)

## 데이터
- 경찰청_습득물정보 조회 서비스 (경찰서 보관)
- 경찰청_포털기관 습득물정보 조회 서비스 (지하철·공항·상점 등 보관)
- 공공데이터포털, 하루 1회 갱신

## 내 컴퓨터에서 실행
1. 이 폴더에 `.env` 파일을 만들고 아래처럼 적는다 (`.env.example` 참고)
   ```
   SERVICE_KEY=공공데이터포털_인증키
   GEMINI_API_KEY=            (문장 검색을 쓸 때만, 비워도 됨)
   ```
2. 이 폴더에서 `node dev-server.mjs`
3. 브라우저에서 http://localhost:3000

예시 데이터로만 화면을 보고 싶으면 PowerShell에서 `$env:MOCK="1"; node dev-server.mjs`

## Vercel 배포
1. GitHub에 올린다 (`.env`는 올리지 않는다. `.gitignore`에 들어 있음)
2. Vercel에서 프로젝트를 가져오고 Settings → Environment Variables에 `SERVICE_KEY`(필요하면 `GEMINI_API_KEY`)를 넣는다
3. Deploy

## 구조
- `index.html`, `style.css`, `script.js`: 화면
- `api/search.js`: 습득물 검색 (관련 분류까지 넓혀 찾고 특징 일치순 정렬)
- `api/detail.js`: 습득물 상세
- `api/parse.js`: 문장을 검색 조건으로 바꾸기 (Gemini, 선택)
- `api/_lib.js`: 분류 사전, 지역 코드, 점수 계산, API 호출
- `api/_mock.js`: 예시 데이터
- `dev-server.mjs`: Vercel 없이 내 컴퓨터에서 실행하는 서버
