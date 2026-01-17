**최신 수정일자: 2025.12.21**

# 입력/출력 설정 UX 가이드 (포트 기반 + 컨텍스트 표준)

입력/출력을 “포트” 단위로 모델링하고, 표준 컨텍스트·결과 스펙·템플릿/바인딩·타입 검증·실행 엔진 정책까지 한 번에 정의한 UX/아키텍처 가이드입니다. 워크플로우 편집기(노드 설정 모달 + 그래프) 기준으로 작성했습니다. CTO 시점에서 운영/호환성/보안까지 포함한 결정 사항을 정리합니다.

## 목표
- 반복 입력 최소화: 이전 노드 결과를 손쉽게 끌어다 쓰기
- 예측 가능한 결과: 설정 즉시 미리보기 제공으로 실행 전 안심
- 오류 방지: 타입/필수 여부를 UI 단계에서 검증
- 확장성: 새 노드나 새로운 파라미터 타입이 추가돼도 폼/바인딩 로직을 재사용

## 핵심 UX 원칙
- **명확한 데이터 소스 선택**: "이전 노드 출력" vs "직접 입력" vs "선택지(옵션)" + 변수/환경/시크릿 탭
- **즉시 피드백**: 값 입력/바인딩 시 실시간 유효성 표시, 미리보기 업데이트
- **추상화 수준 유지**: 사용자는 JSON 경로나 내부 스키마를 모르게 하고, 사람이 읽기 쉬운 라벨/툴팁 제공
- **안전한 기본값**: 필수 입력은 기본 템플릿/샘플 값 제공, 공란 방치 금지

## 포트(Port) 기반 I/O 모델
포트는 “연결 가능한 단위”로, 각 포트가 타입/스키마를 가진다.
- 입력 포트 예시: `in:main`, `in:config`, `in:items[]`, `in:trigger`
- 출력 포트 예시: `out:main`, `out:error`, `out:items[]`, `out:raw`
- 스키마 메타데이터:
  - `inputs: [{ key, label, schema, required, accepts: [...] }]`
  - `outputs: [{ key, label, schema }]`
- 장점: 다중 출력(성공/실패/스트림) 표현, 시각적 라우팅 일관성, 타입 호환성 검증 단순화
- 호환성 규칙:
  - 연결 시 `out.schema` ⊆ `in.accepts` 또는 JSON Schema 호환 여부로 판단
  - `accepts`가 비어 있으면 `schema`로 직접 비교, 존재하면 화이트리스트 우선
  - `items[]` 포트는 `ioMode="items"`를 강제, 단일 객체를 연결할 경우 자동 래핑 옵션 제공(`autoWrap: true`)
- UX 반영:
  - 그래프 상 포트별 색상/아이콘으로 타입 표현 (예: object/array/error/trigger)
  - 호환 안 되는 연결 시 즉시 시각 경고 + 툴팁에 기대 타입/실제 타입 표시

## 데이터 소스 유형 (입력)
1. **이전 노드 출력 사용** (파라미터 선택 UI)
   - 드롭다운: "어떤 노드의 어떤 필드?"를 노드 이름/타입/스텝 순서로 그룹화해 선택
   - 필드 피커: 트리/자동완성으로 JSON 경로를 선택하도록 지원 (`result.output.data` 등)
   - 프리뷰: 선택한 필드의 샘플 값을 우측에 표시 (직전 실행 결과 or 모의 데이터)
   - **구현 완료**: 이전 노드 출력 변수를 선택할 수 있는 UI 추가
     - `field_path`, `execution_id` 같은 파라미터에서 이전 노드 출력 변수 선택 가능
     - 드롭다운 목록과 확장 버튼을 통한 직관적인 변수 선택 (`parameter-form-generator.js`)
     - 클릭 시 자동으로 파라미터 필드에 값 삽입 (예: `outdata.output.execution_id`)
     - 이전 노드 출력에서 변수를 쉽게 선택하여 다음 노드에 전달 가능
     - 구현 위치: `UI/src/pages/workflow/utils/parameter-form-generator.js`, `UI/src/pages/workflow/modals/node-settings-modal.js`

## 출력 미리보기 시스템

### 스키마 기반 자동 생성

노드 설정 모달에서 출력 미리보기는 `output_schema`를 기반으로 자동 생성됩니다:

- **필드명 기반 예시 값**: 필드명과 타입을 분석하여 의미있는 예시 값 생성
  - 경로 관련 (`path`, `file`, `folder`) → `"C:\\example\\path\\file.ext"`
  - ID 관련 (`id`, `execution`) → `"20250101-120000-abc123"` (string) 또는 `12345` (number)
  - 성공/상태 (`success`, `found`, `touched`) → `true`
  - 개수/총계 (`count`, `total`) → `10`
  - 시간 관련 (`time`, `wait`, `elapsed`) → `5`

- **실제 파라미터 값 우선**: `nodeData`에 실제 값이 있으면 스키마 기반 예시 값 대신 실제 값을 사용

- **자동 업데이트**: 파라미터 변경 시 출력 미리보기가 자동으로 업데이트됩니다 (300ms debounce)
  - 모든 파라미터 입력 필드(`edit-node-` 접두사)에 이벤트 리스너 자동 설정
  - 노드 타입 변경, 상세 노드 타입 변경 시에도 자동 업데이트
2. **사용자 직접 입력**
   - 타입별 위젯: text/number/boolean/date/file/token/secret 등
   - 플레이스홀더/예시 값 제공, required 표기 + 인라인 검증
   - 멀티라인/코드 편집(예: JSON) 시 포맷 검증과 미리보기 제공
   - **구현 완료**: 파라미터 폼에서 직접 입력 가능 (`parameter-form-generator.js`)
3. **선택지 제공 (옵션/프리셋)**
   - select/radio/button group으로 사전 정의된 옵션 제공
   - 옵션 설명/샘플 결과를 함께 표시해 선택 도움
   - **구현 완료**: `nodes_config.py`의 `options` 필드로 드롭다운 제공
4. **혼합 모드**
   - 기본값은 이전 노드 출력, 없으면 사용자 입력 fallback
   - 템플릿 문자열 지원: `Hello, {{prev.node.output.name}}` 형태
   - **현재 상태**: 템플릿 문자열은 미구현, 이전 노드 출력 변수 선택은 구현됨

## 출력 프리뷰/정규화
- 노드 설정 모달 하단에 "예상 출력" 영역 제공
- 입력값/바인딩 변경 시 즉시 프리뷰 갱신 (모의 실행 or 정규화된 스키마 기반)
- 성공/실패 케이스 토글로 에러 시 응답 형태도 보여줌
- 미리보기 데이터 우선순위: 최근 실행 결과 > 모의 데이터(노드 제공) > 기본 스키마 기반 샘플
- 프리뷰 엔진은 Result Envelope를 그대로 사용하여 UI 일관성 확보

## 컨텍스트(Workflow Context) 표준
노드 실행 함수 시그니처에 포함되는 공통 컨텍스트:
```ts
type NodeRunContext = {
  runId: string
  workflowId: string
  nodeId: string
  attempt: number
  env: Record<string, string>
  secretsRef?: string
  variables: Record<string, any>
  previous: Record<string, NodeResult>
  logger: { info(...): void; warn(...): void; error(...): void }
}
```
- 모든 노드에서 동일한 컨텍스트 키 제공 → 디버깅/재현/감사 로그 용이
- `previous`는 앞선 노드 결과 캐시, 포트/경로 기반 접근 지원
- 확장 필드는 `meta` 아래에만 추가(충돌 방지), 컨텍스트 키는 버전 없이 안정적으로 유지
- Logger는 runId/workflowId/nodeId/attempt를 자동 prefix하여 추적성 확보

## UI 흐름 제안 (노드 설정 모달 기준)
1. **입력 섹션**
   - 상단: 데이터 소스 선택 탭 (이전 노드 / 직접 입력 / 옵션)
   - 중단: 타입별 위젯 + 필드 피커 + 유효성 메시지
   - 하단: 현재 설정에 대한 미리보기 카드
2. **출력 섹션**
   - 예상 응답 구조를 트리 뷰로 표시, 핵심 필드에 하이라이트
   - 샘플 데이터 보기/숨기기 토글
3. **검증/경고**
   - 필수값 미입력, 타입 불일치, 존재하지 않는 바인딩 경로는 즉시 붉은 라벨로 표시
   - 저장 시 최종 검증 후 오류 목록을 한눈에 표시

## 설계/구현 체크리스트
- **스키마 정의**: 각 노드 파라미터에 `name`, `label`, `type`, `required`, `default`, `options`, `description`, `example`, `source`(manual|previous|mixed) 메타데이터 포함
- **필드 피커**: 워크플로우 컨텍스트에서 사용 가능한 이전 노드들의 출력 트리를 제공, 검색 지원
- **템플릿 엔진**: `{{nodeId.path}}` 형태의 문자열 치환 지원, 미리보기에서 즉시 평가 (존재하지 않으면 경고)
- **모의 데이터**: 최근 실행 결과가 없으면 노드별 샘플 값을 제공해 프리뷰 가능
- **정규화 규칙**: 모든 노드 출력은 Result Envelope로 강제 `{ status, output, error, meta }`
- **검증 로직**: 타입/필수 검증 + 바인딩 경로 검증을 프론트에서 선검증, 백엔드에서 재검증
- **오류 표현**: 인라인 메시지 + 상단 배너 요약; 실패 시 어떤 필드가 문제인지 명확히 표시
- **호환성 레이어**: 포트 타입 불일치 시 auto-coerce 가능 여부 표시, 불가 시 연결 차단

## UX 컴포넌트 아이디어
- 소스 선택 탭: `이전 노드 출력 / 직접 입력 / 프리셋`
- 필드 피커: 트리 + 검색 + 최근 선택 목록
- 템플릿 편집기: 토큰 삽입 버튼, 미리보기 패널 나란히 배치
- 프리뷰 카드: 성공/에러 토글, JSON 뷰어 + 하이라이트
- 검증 알림: 필드 단위 배지 + 상단 요약

## Result Envelope 스펙(고정)
```json
{
  "status": "success|error|skipped",
  "output": { "data": {}, "items": [], "raw": null },
  "error": { "code": "E_TIMEOUT", "message": "...", "details": {} },
  "meta": { "startedAt": "...", "endedAt": "...", "durationMs": 123, "traceId": "..." }
}
```
- `output`는 항상 존재(비어 있어도 `{}`), 실패 시에도 동일 구조 → UI 일관 렌더
- `status`/`error` 고정 필드 + 확장 필드는 `meta`에 수용
- `traceId`/`runId`/`nodeId`는 메타에 포함, 프론트 로그와 연계
- `skipped` 상태는 의존 노드 실패나 조건부 미실행을 명시

## 데이터 모드: single vs items
- `ioMode: "single" | "items"`를 노드 스키마에 선언
- `items` 모드 노드는 map/filter/reduce처럼 각 아이템 처리
- 변환 노드 기본 제공: “To Items”, “Merge Items”, “Pick First”
- `items` 모드 노드 실패 시: 기본값은 해당 아이템만 실패 처리하고 계속 진행, 옵션으로 전체 실패 전파 가능(`failFast: true/false`)
- 스트리밍 지원 시 `out:items[]`는 지연 평가 가능, UI는 점진 렌더

## 바인딩 표현식: 2트랙
- 기본(템플릿): `{{nodeA.output.data.user.name}}` - **미구현**
- 고급(JSONPath/JMESPath): `$.output.data.users[?status=='ACTIVE'].id` - **미구현**
- **현재 구현**: 이전 노드 출력 변수 선택 UI (드롭다운 방식)
  - `outdata.output.execution_id` 같은 경로 문자열 직접 입력
  - 드롭다운으로 이전 노드 출력 변수 선택 가능
  - 구현 위치: `UI/src/pages/workflow/utils/parameter-form-generator.js`
- 평가 규칙:
  - 템플릿은 값이 없을 경우 기본값 필터 지원 `| default:"..."` - **미구현**
  - JSONPath/JMESPath는 결과가 없으면 `null` 반환, 에러는 즉시 경고 - **미구현**
  - 보안: 시크릿/PII 경로는 프리뷰에서 마스킹, 실제 실행 시에만 언마스킹 - **미구현**

## 타입 시스템: JSON Schema + coercion
- 입력/출력 스키마를 JSON Schema로 정의, 프론트/백엔드 동일 검증
- `coerce: "none" | "safe" | "aggressive"` 정책
  - safe 예: `"123"→123`, `"true"→true`
- 스키마 버전 관리: 노드별 `schemaVersion` 필드, 마이그레이션 함수와 함께 배포
- 프론트는 스키마로 위젯 자동 매핑(text/number/boolean/object/array/date/time/secret/ref)

## 실행 엔진 원칙
- 그래프는 DAG, 실행 계획은 위상정렬
- 변경 없는 노드는 캐시 결과 재사용(옵션)
- “변경된 노드부터 downstream 재실행” 지원
- 재시도: `retry: { maxAttempts, backoffMs, retryOnCodes }`
- 실행 캐시 키: (workflowId, nodeId, inputHash, version). 포트 타입/스키마 변경 시 캐시 무효화.
- 병렬 실행: 독립 노드 동시 실행, 포트 의존성 충돌 시 직렬화
- 실패 정책: 노드별 onError와 별개로 워크플로우 전역 정책 허용(전역 stop/continue)

## 에러 라우팅/분기
- 기본 출력: `out:success`, `out:error`
- 노드 옵션: `onError: "stop" | "continue" | "routeToErrorPort"`
- 실패 경로를 시각적으로 분기해 UX를 명확히
- 에러도 Result Envelope를 따름 → UI에서 동일 뷰어 재사용
- 조건 분기 노드는 포트 기반으로 분기(`out:true`, `out:false`, `out:default`)

## 시크릿/토큰 참조 표준
- 파라미터는 시크릿 값 저장 금지, 참조만 저장:
  - `{"type":"secretRef","key":"OPENAI_API_KEY"}`
- 실행 시 vault/env/키체인에서 resolve
- 프리뷰 시 항상 마스킹, 외부 호출 OFF 상태 유지
- 감사 로그에 secret 값은 기록하지 않고 key/ref만 기록

## 프리뷰 엔진 정책
- **현재 구현**: 스키마 기반 예시 데이터 생성 (dry-run/mock 미구현)
- 기본은 스키마 기반 샘플 데이터 생성, 네트워크 호출 없음
- 실제 실행 결과가 있으면 우선 사용 (최근 실행 결과)
- PII/시크릿 마스킹은 미구현 (향후 구현 예정)
- 리소스 제한: 미구현 (향후 구현 예정)
- 프리뷰 실패 시 graceful fallback: 스키마 기반 기본값 제공 (구현됨)

## 변수/상수 레이어
- 데이터 소스 탭 확장: 이전 노드 / 직접 입력 / 프리셋 / 변수 / 환경 / 시크릿
- `workflow.variables`, `env`, `secrets`, `run` 메타를 바인딩 가능
- 런타임/프리뷰에서 동일한 평가 규칙 적용, 접근 권한(시크릿)은 프리뷰 제한

## 노드 패키징/버전 호환성
- 노드 정의에 버전 포함:
  - `nodeType`, `nodeVersion`, `migrations`(v1→v2 변환 함수)
- 노드 스펙 변경 시 기존 워크플로우를 안전히 마이그레이션
- 노드/포트 스키마 변경 시 마이그레이션 실행 → 호환 불가하면 차단/경고
- 마켓플레이스/오픈소스 배포 시 `engineVersion` 요구사항 명시

## 최소 스펙 코드 예시 (TypeScript)
```ts
// node.spec.ts
export const HttpRequestNode = {
  type: "http.request",
  version: 1,
  schemaVersion: 1,
  ioMode: "single",
  inputs: [
    { key: "url", label: "URL", schema: { type: "string", format: "uri" }, required: true },
    { key: "method", label: "Method", schema: { type: "string", enum: ["GET","POST"] }, required: true, default: "GET" },
    { key: "body", label: "Body", schema: { type: "object" }, required: false }
  ],
  outputs: [
    { key: "success", label: "Success", schema: { type: "object" } },
    { key: "error", label: "Error", schema: { type: "object" } }
  ],
  ui: { icon: "globe", group: "network" },
  retry: { maxAttempts: 3, backoffMs: 500, retryOnCodes: ["E_TIMEOUT", "E_429"] },
  onError: "routeToErrorPort"
} as const
```

## 단계별 적용 가이드

### ✅ 구현 완료
1. **이전 노드 출력 변수 선택**: 드롭다운 방식으로 이전 노드 출력 변수 선택 가능
   - 구현 위치: `UI/src/pages/workflow/utils/parameter-form-generator.js`
   - 사용 예: `execution_id`, `field_path` 같은 파라미터에서 사용
2. **출력 미리보기**: 스키마 기반 출력 미리보기 자동 생성
   - 구현 위치: `UI/src/pages/workflow/config/node-preview-generator.js`
   - 파라미터 변경 시 자동 업데이트 (300ms debounce)
3. **입력 미리보기**: 이전 노드 출력 스키마 기반 입력 미리보기 생성
   - "이전 노드에서 가져오기" 버튼으로 자동 생성
   - 구현 위치: `UI/src/pages/workflow/modals/node-settings-modal.js`

### ⏳ 향후 구현 필요
1. 파라미터 메타데이터에 `source` 필드를 추가하여 입력 방식(이전 노드/직접/프리셋)을 정의
2. 워크플로우 컨텍스트(그래프)에서 이전 노드 출력 트리를 수집하는 헬퍼 제공 (일부 구현됨)
3. 노드 설정 모달에서 소스 선택 탭 → 필드 피커/위젯 렌더 → 즉시 검증
4. 템플릿 문자열 지원 시, 입력 변경마다 프리뷰 엔진으로 결과 평가 및 오류 표시
5. 저장 시 최종 검증 → 오류가 있으면 필드로 스크롤/포커스 이동
6. 실행 전 프리뷰를 제공하여 사용자가 실제 실행 없이 결과 형태를 확인할 수 있게 함 (스키마 기반은 구현됨)

## 예시 템플릿 패턴
- 순수 바인딩: `{{previousNode.output.url}}`
- 기본값 포함: `{{previousNode.output.name | default:"홍길동"}}`
- 문자열 혼합: `https://api.service.com/users/{{userNode.output.id}}`

## 운영/테스트
- 최근 실행 결과가 없을 때를 위한 샘플 데이터 경로 확보
- 필수 필드 누락, 잘못된 경로, 타입 불일치에 대한 QA 케이스 추가
- 접근성: 키보드 내비게이션, 스크린리더 레이블, 명확한 대비 색상 적용
