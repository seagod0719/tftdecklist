# TFT 덱 리스트

기존 Vercel 정적 페이지 + Node 서버리스 API 구조를 유지합니다. 설치할 런타임 의존성은 없습니다.

## 실행 및 검증

Node.js 22 이상에서 `npm run dev` 실행 후 http://localhost:3000 접속.

- `npm test`: 팀코드, 유닛 별칭, 소환물 제외, 잘못된 데이터, QQ/Academy 파싱 검사
- `npm run test:live`: 세 원본에 실제 요청해 덱과 팀코드 응답 검사 (네트워크 필요)

Vercel에서는 저장소 루트를 Root Directory로 사용합니다. Framework는 Other, 별도 빌드 명령/출력 디렉터리는 필요하지 않습니다. `/api/metatft`, `/api/academy`, `/api/qq`가 서버에서 원본을 요청하므로 브라우저 CORS 우회 프록시는 필요하지 않습니다. 커밋/푸시 및 운영 배포는 이 변경에 포함하지 않았습니다.

## 이번 변경

- 세 사이트의 덱을 각각 SS/S/A 열에 표시하고 사이트별 실패/재시도를 독립 처리합니다.
- MetaTFT의 세트별 한국어 lookup에서 `apiName`, `characterName`, `assetNames`를 연결합니다. 문자열에서 `DA_`, 숫자 등을 삭제해 식별자를 훼손하지 않습니다.
- 원본 MetaTFT 공개 클라이언트의 팀 플래너 형식에 맞춰 `02` + 유닛별 3자리 16진수 코드 10칸 + `TFTSet18` 등의 세트 키를 생성합니다. 세트 번호는 덱 응답에서 읽습니다.
- 소환물은 코드에서 제외합니다. 알 수 없는 유닛이나 10개 초과 구성은 사유를 표시하고 복사를 비활성화합니다. 임의 누락/잘림으로 잘못된 팀을 복사하지 않습니다.
- 팀코드는 구성 유닛만 담습니다. 아이템, 배치, 별 등급은 담지 않습니다. 게임 클라이언트에서의 실제 가져오기는 별도 확인이 필요합니다.
- 원격 데이터를 HTML로 삽입하거나 JavaScript로 실행하지 않습니다.
- Vercel CDN은 정상 응답을 5분 캐시하고 최대 추가 10분 동안 갱신 전 응답을 사용할 수 있습니다. 실패 응답은 캐시하지 않습니다.

## 데이터 소스와 차이

- [MetaTFT](https://www.metatft.com/comps): `comps_data?queue=1100`의 `cluster_details` 및 `data.metatft.com/lookups/{set}_latest_ko_kr.json`. 현재 티어는 원시 평균으로 S < 4.25 / A < 4.50을 산정합니다. 원본 화면의 랭크·기간 필터 및 증강/차원문 보정을 재현하지 않았으므로 완전히 동일한 순위가 아닙니다. 이 사실을 화면에도 표시합니다.
- [TFT Academy](https://tftacademy.com/tierlist/comps): SvelteKit `__data.json` 참조 테이블의 공개 가이드만 사용합니다. 원본 티어와 `displayIndex` 순서 유지.
- [LOL QQ](https://lol.qq.com/tft/#/index): 공개 `tft-mode-registry.js`에서 현재 시즌을 읽고 해당 시즌 채널 6의 `lineup_detail_total.json`을 사용합니다. 공개 상태 5, 원본 `quality`와 `sortID` 유지. 중첩 JSON의 실제 개행도 처리합니다.
- lookup 메타데이터는 응답의 `lookupMetadata`에 포함합니다. 원본이 세트 전환 또는 PBE 데이터를 게시하면 코드 매핑 변경을 확인해야 합니다.

## 남은 사이트 기능

유닛 통계 및 팀 빌더의 자체 구현은 아직 포함하지 않았습니다. 두 메뉴는 원본 사이트로 연결합니다. 덱 배치도는 후속 작업입니다. 기존 3열 레이아웃을 유지했습니다.

## 유물·상징 및 목록 표시

- 덱은 사이트 전체가 아니라 **사이트별 SS, S, A 각각 최대 10개** 표시합니다. 서버는 전체 데이터를 보존합니다.
- 팀코드 문자열 입력칸을 제거하고 평균 등수 옆에 작은 복사 버튼을 배치했습니다. 평균 정보가 없는 소스는 덱 제목 옆에 버튼을 표시합니다.
- 유닛 이름과 프로필을 함께 표시합니다. TFTable의 공개 세트별 이미지 경로를 사용하며 이미지가 없는 소환물 등은 이름을 유지합니다.
- `/api/items`는 [TFTable 유물·상징 페이지](https://tftable.cc/item-tierlist)의 `__NEXT_DATA__`를 JSON으로 파싱합니다. 두 탭은 하나의 데이터셋을 공유하며 내부 `#artifacts`, `#emblems` 메뉴로 표시합니다.
- 원본 기본 그룹 보기의 OP/Good/Normal/Essential/Unplayable 분류, 전용 증강 제외, 추천 조합 최대 3개를 따릅니다. 강도는 `-item_strength`입니다. OP 기준은 유물 >0.6, 상징 >0.5이며 Good은 0.3 이상, Normal은 0.1 이상입니다. Essential과 일반 티어에는 같은 상징이 중복될 수 있습니다.
- 유물·상징은 전체 아이템을 표시합니다. 덱의 SS/S/A 10개 제한과는 별개입니다. 한국어 아이템/유닛명은 MetaTFT lookup으로 보강하며 덱 이름이 없으면 원본 식별자를 표시합니다.
