# 변경 이력

## 미출시

- 권고 조회를 로컬 스냅샷 전용으로 변경, 갱신은 작업 밖의 별도 유지보수로 분리
- 실제 악용 근거로 CISA KEV 추가
- MCP 안내서에 운영체제별 권장 런타임 추가
- `sandbox_environment`에 Docker 데몬의 rootless·userns 여부 기록

### English

- Advisory checks use only the approved local snapshot. Refresh is separate maintenance outside the task.
- CISA KEV supplies known-exploitation evidence.
- The MCP guide lists the recommended runtime for each operating system.
- `sandbox_environment` records the Docker daemon rootless and userns state.

## 1.0.0

- 다섯 독립 스킬과 선택형 MCP의 1.x 호환 범위 명시
- MCP 원본 입력 검증으로 추가 필드·null·잘못된 자료형 차단
- 필수 테스트 ID와 실제 테스트러너 결과의 대조 강화
- 전체 스킬 패키지의 구성·내부 참조·판본 정합 회귀 검사
- 기업 소스 발췌와 합성 Next.js 샘플에 대한 읽기 전용 모델 평가 결과를 README에 공개

### English

- The five independent skills and optional MCP define their 1.x compatibility contracts.
- Raw MCP input validation rejects extra fields, null, and invalid types before tool actions.
- Required test identities match actual native test results.
- Regression tests verify every skill package, internal reference, and version marker.
- The README publishes read-only model evaluations on an enterprise source excerpt and a synthetic Next.js sample.

## 0.9.0

- 보안·전자정부 보안·함정 스킬의 실제 프로젝트 테스트 기반 검증
- 필수 테스트·assertion·명령·입력 식별자 고정과 실제 실행 결과에 따른 판정
- 필수 테스트 누락·건너뜀·미실행·시간 초과·오래된 근거의 통과 처리 금지
- 변경 관련 테스트 우선 실행, 최종 후보의 필수 검증, 유효한 결과만 재사용
- 중복 검토 지침 축소와 조건부 참조, 기존 승인·격리·작업 한도 유지
- 의심 스킬의 읽기 전용 범위와 샌드박스의 승인된 합성 앱 실행 범위 유지

### English

- The security, eGovFrame, and trap skills use actual project tests for verification.
- Required tests, assertions, commands, and input identities remain fixed before changes.
- Missing, skipped, or unexecuted required tests, timeouts, and stale evidence cannot pass.
- Affected tests precede broader checks, and the final candidate requires every mandatory check.
- Concise conditional references preserve approvals, isolation, and existing work limits.
- Doubt remains read-only, and sandbox execution remains limited to the approved synthetic app.

## 0.8.0

- 다섯 독립 스킬의 조건부 참조와 일반 기능 개발·보안 점검 절차 분리
- 작업 전체 수정·재검토 최대 두 차례, 회귀·위임·재개 시 동일 예산 유지
- 정상 동작과 보안 조건의 동시 검증, 통과 후 즉시 종료와 필수 결함 미해결 시 중단
- 승인된 공식 API·제품 공급자 공지의 사전 조회와 검토 근거 고정
- 폐쇄망 반입 근거, 조회 실패·오래된 자료·미완전 범위의 명시
- 특정 에이전트·추가 MCP 의존 없이 조건부 문서 로딩과 실행환경 격리 구분

### English

- Conditional references and separate feature-development and security-assessment procedures across five independent skills.
- At most two task-wide repair/review rounds with shared budgets across regressions, delegation, and resumption.
- Security and normal-use checks remain together, with immediate completion or an explicit unresolved blocker.
- Approved official API and vendor advisory preparation precedes the frozen review evidence.
- Imported offline evidence retains explicit query failures, stale records, and coverage gaps.
- Conditional document loads remain separate from context isolation and host enforcement without a mandatory agent or additional MCP.

## 0.7.0

- CVSS v4.0 심각도 분류, 점수 근거와 미평가 상태 기록
- 선택형 gVisor(`runsc`) 런타임과 Linux ARM64·AMD64 네이티브 플랫폼 선택
- 런타임 등록 설정·플랫폼·이미지·fixture를 연결한 policy·승인·증거
- gVisor 게스트 관측과 호스트 cgroup·프로세스 통제의 구분, 기존 자원 한도 유지
- 전체 스킬과 선택형 MCP의 폐쇄망·외부망 공통 원칙 명시
- Agent Skills 규격 메타데이터, 독립 설치 전제와 네트워크 경계 안내
- policy·승인 schema 2 적용, 이전 상태의 자동 변환 없이 새 준비와 승인 요구

### English

- CVSS v4.0 severity, score evidence, and an explicit unrated state.
- Optional gVisor (`runsc`) with native Linux ARM64 and AMD64 platform selection.
- Policies, approvals, and evidence bind runtime registration, platform, image, and fixture identity.
- gVisor guest observations remain separate from host cgroup and process controls.
- Existing resource limits remain unchanged.
- Every skill and the optional MCP share the connected and isolated operation principle.
- Agent Skills metadata and explicit prerequisites for standalone packages and network boundaries.
- Policy and approval schema 2 requires new preparation and approval without automatic migration.

## 0.6.0

- 기본 작업 예산 30분·필수 항목별 최초 포함 최대 2회, 보고서 갱신·위임·재개 시 예산 유지
- 동일 실패의 근거 없는 반복과 이전 실패 상태로 돌아가는 수정 순환 중단
- 보안 조건·정상 동작 동시 검증, 유효한 기존 근거 재사용과 변경 영향 범위 재검증
- 소스와 연결된 의존성·빌드·설치·실행 경로로 읽기 전용 조사 범위 고정
- 보고서에 시도·입력 식별자·검증 결과·중단 이유·실측 예산 기록
- 지침 수준 예산과 호스트의 강제 제어 구분, 미측정 토큰 절감량 주장 금지
- 다섯 스킬과 선택적 MCP의 버전 통일, 태그 기준 전체 폴더 갱신 안내

### English

- Default work budget: 30 minutes and two attempts per required item, inclusive of the first attempt.
- Shared budgets persist across report updates, delegation, and task resumption.
- Repeated failures without new evidence and recurring failure states stop the task.
- Security and normal-use criteria remain fixed together.
- Valid evidence is reusable only while relevant inputs, authority, and validity remain unchanged.
- Read-only investigations stay within source-linked dependency, build, install, and runtime paths.
- Reports record attempts, input identities, actual results, stop reasons, and measured budgets.
- Instruction limits remain distinct from host enforcement and unmeasured token savings.
- Five skills and the optional MCP share one version and tag-based update guidance.

## 0.5.0

- 수정 전에 보고서의 확정 항목·완료 기준·필수 검증을 고정하는 종료 계약
- 최초 발견과 수정 후 검증 분리, 필수 항목이 모두 검증되면 즉시 완료 반환
- 기존 항목의 수정 미흡과 이번 변경의 회귀만 현재 작업에 포함
- 별개 결함·선택적 개선은 후속 목록으로 분리, 승인·검증이 막히면 미완료 결과 반환
- 읽기 전용 평가·함정 구현·샌드박스 검증의 완료 의미와 권한 경계 구분
- 한영 README의 소개 이미지를 최상단에 유지하고 샌드박스 검증 기능 통합

### 샌드박스 검증

- `podori-wreck`: 취약점 보고서 기반 샌드박스 재현·수정 전후 비교·정상 기능 회귀 검증
- 승인된 복제본과 합성 데이터, 외부 통신 차단, 격리·자원 제한을 실행 조건으로 지정
- 운영·외부 대상 시험, 자율 탐색·연쇄 확대, 임의 명령 실행, 코드 실행 취약점 실증, 파괴·자원 고갈 시험 제외
- 실행 조건 미충족 시 실행 거절, 제외·실패 항목의 미검증 판정 유지
- [MCP 안내](mcp/README.md)와 한영 README에 범위·완료 조건 반영

선택적 TypeScript stdio MCP와 `podori-wreck`의 첫 구현 대상은 동봉한 합성 HTTP 앱으로 제한합니다. 기존 네 스킬은 MCP 없이 독립적으로 사용합니다. 문서 검사와 실제 실행 검증은 구분합니다.

## 0.3.0

- 독립 스킬 `podori-egov`: 기존 보안 절차와 eGovFrame 버전별 규칙·코드 사례
- 공통 기준과 3.x·4.x·5.x 자료 분리, 실행환경·공통컴포넌트·의존성별 적용 조건
- 출처 링크를 열지 않아도 수행할 수 있는 검사·수정·검증 지침
- 기존 보안 절차의 중복 문장 축소, 승인·독립 검증·보고서·컨벤션 조건 유지
- 네 독립 스킬 버전 통일, 한영 README 갱신

## 0.2.0

- 보안 보고서와 프로젝트 컨벤션을 먼저 정리한 뒤, 확정된 항목에 연결해 수정하는 절차
- 코드·설정·문서에 근거한 컨벤션 추출, 예외 기록, 수정 후 컨벤션 검증
- 독립 검증, 미검토 영역 추적, 확정·추가 검증·기각 판정
- 수정 전후 보안 회귀 테스트와 정상 기능 검증, 익숙하지 않은 코드의 격리 실행 기준
- 보고서·컨벤션 템플릿, 한영 README 갱신, 세 독립 스킬 버전 통일

## 0.1.0

- 독립 스킬 3종: 보안 `podori`, 의심 `podori-doubt`, 함정 `podori-trap`
- 공격 경로 중심의 코드 보안 → 의존성 검증 → 선택형 함정 순으로 안내. 선행 실행·자동 호출 없이 개별 사용
- 반복 지시 축소, 기능별 로컬 참조, 필수 외부 조회·다운로드 제거
- 오프라인 근거와 미검증 판정, 의심 아티팩트 비실행, 승인 범위 내 레지스트리·클러스터 추적
- 숨겨진 미끼 이벤트·즉시 관찰 등록·정상 동작 보호·운영 예산
- 한영 README와 소개 이미지, 함정 요청 처리 흐름도

버전은 지침 패키지 기준이며 실제 앱의 배포나 보안 효과를 뜻하지 않습니다.
