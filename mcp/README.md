# podori sandbox MCP

한국어 안내 | [English](README.en.md)

`1.0.0`의 선택적 로컬 stdio 패키지입니다. 기존 네 스킬은 이 패키지 없이 그대로 사용할 수 있습니다.

## 지원 범위

동봉한 `synthetic-http-v1` 앱만 실행합니다. 하나의 컨테이너 안에서 취약본과 수정본을 서로 다른 loopback 포트로 실행합니다. 고정 드라이버는 같은 컨테이너 안에서 실제 HTTP 요청을 보냅니다.

- `authorization`: 합성 계정 alice의 소유 문서 조회와 bob 문서 조회를 비교합니다. 수정본은 타 계정 요청을 403으로 거절합니다.
- `input-validation`: 정상 수량 2와 잘못된 수량 -1을 비교합니다. 수정본은 -1을 400으로 거절하고 정상 수량을 유지합니다.

임의 저장소·이미지·경로·코드·셸·외부 대상은 입력할 수 없습니다. 운영 데이터, 실제 자격 증명, 공격 연쇄, 코드 실행 취약점 실증, 파괴·자원 고갈 시험은 지원하지 않습니다. 이 구현은 악성 코드 격리 환경이나 컨테이너 탈출 방어의 보장이 아닙니다.

## 준비

폐쇄망과 외부망에서 같은 준비된 구성으로 같은 검증을 수행합니다. Node·의존성·Docker·승인된 이미지와 선택한 런타임을 미리 준비하세요. 설치와 판본 갱신은 검증 실행과 분리합니다. MCP는 누락된 구성요소를 자동 다운로드하거나 다른 런타임으로 대체하지 않습니다.

승인된 로컬 Docker Unix socket, Linux ARM64 또는 AMD64 이미지, cgroup v2, 기본 seccomp와 CPU·메모리·PID 제한 지원이 필요합니다. Docker 호스트의 아키텍처에 맞춰 이미지를 선택하며 에뮬레이션으로 우회하지 않습니다. 원격 TCP/SSH endpoint는 거절합니다. Docker CLI에 넘기는 환경은 별도로 제한하며, 저장된 endpoint를 모든 실행에 명시합니다.

호스트 Node 지원 선언은 `>=24 <26`입니다. 게스트는 고정 Node 24.22.0을 사용합니다. 기본 런타임은 `runc`이며 `runsc`를 별도로 선택할 수 있습니다.

아래 명령은 연결된 준비 환경의 예시입니다. 폐쇄망에는 같은 lockfile의 의존성을 검증해 반입하고, 준비된 npm 캐시나 승인된 내부 레지스트리를 사용합니다.

```sh
npm ci --ignore-scripts --no-audit --no-fund --registry=https://registry.npmjs.org
npm run build
npm run typecheck
```

npm 캐시를 모두 준비한 환경에서는 `npm ci --offline --ignore-scripts --no-audit --no-fund`를 사용합니다. 필요한 항목이 없으면 설치를 중단하며 외부망으로 우회하지 않습니다.

의존성은 정확한 버전과 `package-lock.json`으로 고정합니다. 설치 훅은 실행하지 않습니다. 서버/클라이언트 SDK는 2.4.0, zod는 4.6.7, TypeScript는 7.0.2, `@types/node`는 24.19.2입니다. 별도 scanner·Inspector·telemetry 도구를 자동 설치하지 않습니다.

사용자가 승인한 다음 베이스 이미지가 실제 구성과 레이어를 포함한 상태로 로컬에 있어야 합니다. `prepare`는 base pull을 수행하지 않습니다.

```text
docker.io/library/node@sha256:a5f4366e834695d5f363b920c104953a535d3a9864d1bdf74566a0ebe01daee5
linux/arm64 manifest: sha256:156e9bc7a0a267cc6ca77b4283e32b123479342df684ce297455d7b95ff5a6b5
linux/amd64 manifest: sha256:ec857ea6bb60cb3d0fa4d97495590c5fe7d51be8572c307b55957eeb06569cf7
```

## gVisor 선택형 격리 실행

gVisor의 사용자 공간 커널은 앱의 시스템 콜을 처리해 호스트 커널 취약점의 직접 악용 경로를 줄입니다. 호스트 보안 패치를 대신하거나 모든 취약점의 차단을 보장하지는 않습니다. 보호 범위는 [gVisor 보안 모델](https://gvisor.dev/docs/architecture_guide/security/)을 참고합니다.

gVisor를 사용하려면 Linux Docker 호스트에 `runsc`를 설치하고 같은 이름의 런타임으로 등록합니다. 설치 방법은 [gVisor 공식 안내](https://gvisor.dev/docs/user_guide/install/)를 참고합니다. 배포본의 `runsc`와 `gvisor-bin/`은 함께 준비해야 합니다.

`runsc` 모드에서는 MCP도 Docker와 같은 네이티브 Linux 호스트에서 실행합니다. 호스트의 실제 PID와 cgroup을 읽을 수 있어야 합니다. macOS에서 사용할 때는 별도 Linux 환경에 이 구성을 준비합니다. 패키지는 Docker Desktop VM이나 기본 런타임 설정을 자동 변경하지 않습니다.

런타임 등록 설정의 해시와 플랫폼을 승인에 고정하고 실제 컨테이너 런타임을 확인합니다. gVisor 내부의 가상 `/proc`·cgroup과 호스트 통제를 구분합니다. 등록 설정 해시는 런타임 실행 파일의 무결성 증명은 아닙니다. 필요한 관측이 없으면 실행을 거절합니다.

## 신뢰된 호스트 운영자 절차

아래 명령은 MCP 도구가 아닙니다. 운영자는 대상·보고서 항목·시나리오·예산·만료를 검토한 뒤 직접 실행해야 합니다. 승인 파일과 state 디렉터리를 MCP 클라이언트가 수정할 수 있게 연결하지 마세요.

1. 저장소 밖에 state 디렉터리 경로를 선택합니다. 새 디렉터리의 부모는 미리 존재해야 합니다.
2. 승인된 Docker context의 Unix socket을 확인합니다.
3. 해당 endpoint로 fixture를 준비합니다.

```sh
STATE=/absolute/private/podori-state
ENDPOINT="$(docker context inspect --format '{{.Endpoints.docker.Host}}')"
node dist/host.js prepare "$STATE" "$ENDPOINT"
```

gVisor를 선택할 때는 마지막 인자에 `--runtime=runsc`를 추가합니다. 기본값은 `runc`이며 `--runtime=runc`로 명시할 수도 있습니다. 선택한 런타임이 없거나 설정이 바뀌면 중단하며 다른 런타임으로 자동 전환하지 않습니다.

0.6.0의 policy·승인 파일은 재사용하지 않습니다. 기존 버전으로 실험을 종료·정리한 뒤 새 state 디렉터리에서 준비와 승인을 진행하세요. 기존 기록을 자동 변환하거나 덮어쓰지 않습니다.

`prepare`는 디렉터리를 0700, 상태 파일을 0600으로 생성합니다. 이미 존재하는 state 디렉터리는 소유권과 모드를 검사합니다. 심볼릭 링크, 다중 hard link, 잘못된 경로, 과도한 파일 크기는 거절합니다. 기존 policy를 덮어쓰는 CLI 호출도 거절합니다.

빌드 context는 `fixture/`로 한정됩니다. 의존성을 설치하는 단계는 없습니다. 고정된 `RUN`은 읽기 전용 검사에 사용할 빈 파일을 UID/GID 1000·권한 0600으로 만듭니다. 애플리케이션 파일은 root 소유로 유지합니다. non-root 사용자와 고정된 독립 제한 프로세스로 실행하며, 빌드는 네트워크 없이 로컬 베이스를 사용합니다. 최종 이미지 식별자와 fixture 내용 해시를 policy에 고정합니다.

4. 보고서와 항목 ID, 등록된 시나리오, 24시간 이내의 UTC 만료를 지정합니다.

```sh
EXPIRY="$(node -p 'new Date(Date.now() + 600000).toISOString()')"
node dist/host.js approve "$STATE" report-1 auth-1 authorization "$EXPIRY"
```

입력 검증 항목은 `input-validation`을 지정합니다. 출력은 approval ID와 `capability-<UUID>.json` 파일명뿐입니다. 실제 일회용 capability는 해당 0600 파일에 저장합니다. 승인 도구나 `approved: true` 입력은 MCP에 없습니다.

5. 해당 state 경로를 로컬 MCP 클라이언트의 서버 실행 인자로 설정합니다.

```json
{
  "command": "node",
  "args": ["/absolute/path/podori/mcp/dist/server.js", "/absolute/private/podori-state"]
}
```

state 인자 없이 실행하면 환경 미구성 여부만 조회할 수 있습니다. STDOUT은 MCP 메시지 전용입니다. HTTP MCP listener와 공개 포트는 없습니다.

## 1.x 호환 계약

1.x에서는 문서에 명시한 도구 이름·입력 스키마·접근 토큰 요구사항과 증거 판정의 의미를 유지합니다. 실행 승인은 신뢰된 운영자가 MCP 밖에서 발급합니다. 문서의 계약을 위반한 입력은 보안 수정으로 더 엄격하게 거절할 수 있습니다.

호환되지 않는 도구·입력·승인 계약 변경은 새 주 버전으로 구분합니다. 내부 파일 구성, 진단 문구, 의존성 판본은 고정된 클라이언트 인터페이스가 아닙니다. 기존 상태를 자동 변환하지 않습니다.

## MCP 사용

전체 입력·도구 계약은 `../skills/podori-wreck/references/tool-contract.md`를 참조하세요.

| 순서 | 도구 | 동작 |
|---|---|---|
| 1 | `sandbox_environment` | 이미지·revision·예산과 호스트 통제 확인 |
| 2 | `sandbox_create` | `approvalId`, `claimToken`으로 일회용 승인 소비 |
| 3 | `sandbox_status` | `experimentId`, `accessToken`으로 준비 상태 확인 |
| 4 | `sandbox_run` | 접근 필드와 승인된 `scenario`로 비교 시작 |
| 5 | `sandbox_evidence` | 실제 HTTP 관측·해시·판정 조회 |
| 6 | `sandbox_reset` | 실제 앱 데이터를 복원하고 HTTP 응답으로 확인 |
| 7 | `sandbox_cancel` | 요청된 실험만 중단 |
| 8 | `sandbox_dispose` | 해당 소유 자원 제거, 증거 보존 |

생성 결과의 실험 토큰은 한 번만 반환합니다. 이후 접근에는 ID와 토큰이 모두 필요합니다. 서버는 토큰 해시만 저장합니다. 로그·공개 보고서·다른 에이전트에 토큰을 복사하지 마세요.

`run`의 즉시 응답은 `unverified`입니다. 완료 상태만으로 수정 성공을 주장하지 마세요. 증거의 정상 요청, 결함 요청, 전후 상태, 식별자와 해시를 확인해야 합니다. `not-reproduced`는 일반적인 안전성 보장이 아닙니다. 제외·거절·시간 초과·잘린 출력·환경 오류는 미검증입니다.

## 보고서 기준 종료

실행 전에 보고서의 필수 항목과 승인된 시나리오, 관측·검증 기준을 고정합니다. 필요한 관측과 자원 정리까지 확인하면 작업을 끝냅니다. 성공한 검토를 다시 수행하거나 시도 한도를 모두 소진할 필요는 없습니다.

실험의 `reproduced`·`not-reproduced`·`unverified` 판정과 요청한 작업의 완료 여부는 구분합니다. 보고서는 끝낸 일, 미확인 항목, 남은 작업과 필요한 조건을 설명합니다. 검증 작업의 완료가 대상 코드의 모든 보안 검사 통과를 뜻하지는 않습니다. 수정 성공은 결함별 근거와 정상 동작 근거가 모두 있을 때만 판단합니다.

별개의 새 주장과 선택적인 실험은 후속 목록에 남기며 자동 실행하지 않습니다. 승인·통제·전송·필수 증거가 부족하거나 정리를 확인할 수 없으면 해당 작업을 멈춥니다. 끝낸 범위와 미완료 항목, 알려진 자원 및 다음에 필요한 조건을 설명합니다. 호스트 셸이나 다른 backend로 우회하지 않습니다.

## 통제와 정리

- 컨테이너마다 network none, non-root 1000:1000, cap-drop ALL, no-new-privileges, read-only rootfs를 적용합니다.
- 호스트 bind mount, Docker socket, 사용자 자격 증명, 포트 publish는 없습니다.
- 컨테이너당 CPU 0.5, 메모리/스왑 합계 128 MiB, PID 64, `/tmp` tmpfs 4 MiB를 제한합니다. `runsc`의 PID 제한은 가상 게스트 프로세스 수가 아니라 호스트 태스크 기준입니다.
- 한 state 디렉터리에서 동시 실험 2개, 전체 기록 20개, 실험당 시도·reset 각 4회를 제한합니다.
- 비교/reset은 8초, 일반 Docker 호출은 10초, 출력은 합계 32 KiB로 제한합니다. 호스트 전용 빌드는 120초입니다.
- 독립된 고정 `/usr/bin/timeout`이 게스트를 45초 뒤 종료합니다. 제어부가 SIGKILL되어도 이 제한은 남습니다.
- state 기록은 생성 전에 저장합니다. 자원 이름과 controller/experiment 소유권 label을 확인한 뒤 정확한 container ID만 제거합니다.
- 취소·timeout은 진행 중 작업의 세대를 무효화합니다. 늦은 생성·관측을 기다린 뒤 다시 제거 여부를 확인합니다.
- 재시작은 같은 state의 소유 자원만 회수합니다. 불완전 시도는 `unverified`로 남습니다.
- 승인 만료 후 새 실행/reset은 거절하지만, 소유자의 상태·증거·취소·폐기는 허용합니다.
- 이미지·기존 컨테이너·네트워크·볼륨을 광범위하게 삭제하지 않습니다. fixture 이미지는 보존합니다.

Docker가 중단되면 제거를 확인할 수 없습니다. 제어부가 중단되면 종료된 컨테이너 객체는 재시작까지 남을 수 있습니다. state와 label을 보존한 상태로 복구하세요. 소유 자원이 있는데 state를 삭제하면 자동 복구의 근거를 잃습니다.

동시에 stale lock을 인수하지 못하도록 `server.guard`를 사용합니다. lock 획득 도중 호스트 프로세스가 종료되면 수동 확인이 필요할 수 있습니다. 운영자는 기록된 PID의 종료와 정확한 state 경로를 확인해야 합니다. MCP에는 lock 삭제나 승인 복구 도구가 없습니다.

## 시험

시험 산출물 경로는 저장소 밖에 지정해야 합니다. Docker 통합 시험은 실제 fixture 컨테이너를 생성하고 정확한 소유 자원만 정리합니다.

```sh
export PODORI_EVIDENCE_DIR=/absolute/private/podori-evidence
export PODORI_TEST_RUNTIME=runsc
npm run build
npm run typecheck
npm test
npm run test:integration
```

시험은 실제 SDK stdio Client, HTTP 요청, 격리 probe, 실험 간 loopback 분리, 초기화, 취소, 지연 완료, timeout, 프로세스 장애와 재시작을 포함합니다. 제어부가 없는 독립 deadline 시험은 실제 45초를 기다립니다. 기존 네 스킬은 각 패키지의 내부 링크·MCP 없는 독립 사용·doubt 비실행 경계를 확인합니다.

단위 정책 시험과 지연/오류 주입은 실제 격리 증거와 구분합니다. 운영 장애 주입은 시험 어댑터에만 있으며 MCP 입력에는 없습니다. egress probe는 예약된 `192.0.2.1`과 `2001:db8::1`만 사용합니다.

## 검증 한계

잠금 무결성과 실제 패키지 metadata/설치 훅 확인은 악성 코드 부재의 증명이 아닙니다. 서명·빌드 provenance의 독립 검증, 최신 CVE 데이터베이스, 다른 플랫폼 바이너리, 모든 전이 소스와 Node OS 레이어의 전체 감사는 별도 범위입니다. 과거 fixture revision이나 미실행 결과를 현재 소스의 성공 증거로 재사용하지 마세요.
