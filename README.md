# 미용실 예약 시스템 ✂️

1인 미용실을 위한 간편한 온라인 예약 관리 시스템입니다. Hono 프레임워크와 Cloudflare Pages를 활용하여 빠르고 효율적인 예약 관리를 제공합니다.

## 🌟 프로젝트 개요

- **프로젝트명**: 미용실 예약 시스템
- **목표**: 1인 미용실의 예약을 효율적으로 관리하고, 고객이 쉽게 예약할 수 있는 웹 기반 시스템 제공
- **기술 스택**: Hono + TypeScript + Cloudflare D1 + TailwindCSS

## 🚀 주요 기능

### ✅ 완료된 기능

1. **3단계 예약 프로세스**
   - **1단계**: 성별 선택 → 서비스 선택 → 날짜 선택
   - **2단계**: 예약 가능한 시간 선택 (예약 충돌 자동 검사)
   - **3단계**: 고객 정보 입력 및 예약 완료

2. **서비스 메뉴**
   - **남자 커트**: 15,000원 (30분 소요)
   - **여자 커트**: 18,000원 (30분 소요)
   - **펌**: 30,000원~ (2시간 소요)

3. **지능형 시간 관리**
   - 서비스 소요 시간에 따른 예약 가능 시간 자동 계산
   - 시간 충돌 방지 (예: 펌 2시간 소요 시 해당 시간대 자동 차단)
   - 영업 시간 내 예약 제한 (10:30 ~ 19:00)

4. **고객 관리**
   - 전화번호 기반 고객 자동 조회
   - 성별 정보 저장
   - 예약 이력 관리

5. **예약 관리**
   - 날짜별 예약 목록 조회
   - 예약 상태 변경 (확정/완료/취소)
   - 예약별 메모 기능

6. **반응형 UI**
   - 모바일, 태블릿, 데스크톱 모두 지원
   - 직관적인 단계별 예약 프로세스
   - 실시간 예약 현황 표시

## 🔗 URL 및 엔드포인트

### 개발 환경
- **로컬**: http://localhost:3000
- **샌드박스**: https://3000-i4cuql2ergotvxh7axrsz-2b54fc91.sandbox.novita.ai

### API 엔드포인트

#### 서비스 API
- `GET /api/services` - 모든 서비스 조회
- `GET /api/services/by-gender?gender=male|female` - 성별별 서비스 조회

#### 고객 API
- `POST /api/customers` - 고객 생성/조회 (전화번호 기반)

#### 예약 API
- `GET /api/bookings/available-times?date=YYYY-MM-DD` - 예약 가능 시간 조회
- `GET /api/bookings?date=YYYY-MM-DD` - 날짜별 예약 조회
- `POST /api/bookings` - 새 예약 생성
- `PATCH /api/bookings/:id` - 예약 상태 변경
- `DELETE /api/bookings/:id` - 예약 삭제

## 📊 데이터 구조

### 데이터베이스 스키마 (Cloudflare D1)

**stylists (미용사)**
- id, name, phone, created_at
- 1인 미용실이므로 원장 1명만 등록

**services (서비스)**
- id, name, duration, price_min, price_max, gender, description, created_at
- gender: 'male', 'female', null (모두 가능)
- price_max: null이면 "가격부터~" 표시

**customers (고객)**
- id, name, phone, gender, email, notes, created_at

**bookings (예약)**
- id, customer_id, stylist_id, service_id, booking_date, booking_time, status, notes, created_at

### 저장 서비스
- **Cloudflare D1**: SQLite 기반 관계형 데이터베이스
- **로컬 개발**: `.wrangler/state/v3/d1` 디렉토리에 로컬 SQLite DB

## 📖 사용 가이드

### 예약하기 (3단계 프로세스)

**1단계: 서비스 선택**
1. 성별 선택 (남성/여성)
2. 표시된 서비스 중 원하는 서비스 선택
   - 남자 커트: 15,000원 (30분)
   - 여자 커트: 18,000원 (30분)
   - 펌: 30,000원~ (2시간)
3. 예약 날짜 선택
4. "다음 단계" 클릭

**2단계: 시간 선택**
1. 예약 가능한 시간 슬롯 확인
   - 회색: 예약 불가 (이미 예약됨 또는 시간 부족)
   - 흰색: 예약 가능
2. 원하는 시간 클릭
3. "다음 단계" 클릭

**3단계: 정보 입력**
1. 이름과 전화번호 입력
2. 선택사항으로 메모 입력
3. "예약 완료" 클릭

### 예약 관리
1. 상단 네비게이션에서 "예약 목록" 클릭
2. 날짜를 선택하여 해당일 예약 조회
3. 각 예약 카드에서:
   - "완료" 버튼: 서비스 완료 처리
   - "취소" 버튼: 예약 취소 처리

### 시간 충돌 방지 로직
- 30분 서비스: 시작 시간만 예약 불가
- 2시간 서비스: 시작부터 종료까지 모든 시간 예약 불가
- 예: 17:00에 펌 예약 시 → 17:00~19:00 모두 예약 불가
- 영업시간: 10:30 시작, 19:00 종료 (마지막 서비스는 종료 시간 전에 완료되어야 함)

## 🛠️ 개발 및 배포

### 로컬 개발
```bash
# 의존성 설치
npm install

# 데이터베이스 초기화
npm run db:reset

# 빌드
npm run build

# 개발 서버 시작 (PM2)
fuser -k 3000/tcp 2>/dev/null || true
pm2 start ecosystem.config.cjs

# 서버 테스트
curl http://localhost:3000
```

### 프로덕션 배포 (Cloudflare Pages)
```bash
# 1. Cloudflare API 설정
# setup_cloudflare_api_key 도구 실행

# 2. 프로덕션 D1 데이터베이스 생성
npx wrangler d1 create webapp-production
# database_id를 wrangler.jsonc에 업데이트

# 3. 프로덕션 마이그레이션
npx wrangler d1 migrations apply webapp-production

# 4. 빌드 및 배포
npm run deploy
```

## 🎯 향후 개발 계획

### 미구현 기능
1. **인증 시스템**
   - 원장 전용 관리자 로그인
   - 예약 수정/삭제 권한 관리

2. **알림 기능**
   - SMS 예약 확인
   - 예약 전날 리마인더
   - 카카오톡 알림

3. **통계 및 리포트**
   - 일별/월별 매출 통계
   - 서비스별 인기도 분석
   - 단골 고객 관리

4. **고급 기능**
   - 정기 예약 (매주 같은 시간)
   - 대기 명단 관리
   - 고객 리뷰 시스템
   - 포인트 적립 시스템

5. **UI/UX 개선**
   - 달력 뷰 추가
   - 예약 변경 기능
   - 다국어 지원
   - 다크 모드

### 추천 다음 단계
1. SMS 알림 기능 추가 (Twilio 등)
2. 관리자 대시보드 개발
3. 매출 통계 기능
4. 고객 리뷰 시스템

## 📦 배포 현황

- **플랫폼**: Cloudflare Pages (배포 준비 완료)
- **상태**: ✅ 개발 완료
- **마지막 업데이트**: 2026-01-20

## 📝 기술 세부사항

### 프론트엔드
- TailwindCSS (CDN) - 반응형 디자인
- Font Awesome Icons - 아이콘
- Axios - HTTP 클라이언트
- Vanilla JavaScript - 프레임워크 없이 순수 JS

### 백엔드
- Hono Framework - 경량 웹 프레임워크
- Cloudflare Workers Runtime - 엣지 컴퓨팅
- TypeScript - 타입 안정성

### 데이터베이스
- Cloudflare D1 (SQLite) - 관계형 데이터베이스
- 자동 백업 및 확장성 지원

### 예약 충돌 방지 알고리즘
```javascript
// 시간을 분 단위로 변환하여 비교
// 새 예약과 기존 예약의 시간 범위가 겹치는지 확인
// 겹치면 예약 불가 처리
```

---

**개발자 노트**: 
- 1인 미용실 운영에 최적화된 시스템입니다.
- 서비스 소요 시간을 고려한 지능형 시간 관리로 예약 충돌을 방지합니다.
- Cloudflare Edge Network를 통해 전 세계 어디서든 빠른 응답 속도를 제공합니다.
- 추가 개발 없이 바로 사용 가능한 상태입니다.
