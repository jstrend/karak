# 미용실 예약 시스템 ✂️

현대적인 미용실 예약 관리 시스템입니다. Hono 프레임워크와 Cloudflare Pages를 활용하여 빠르고 효율적인 예약 관리를 제공합니다.

## 🌟 프로젝트 개요

- **프로젝트명**: 미용실 예약 시스템
- **목표**: 미용실의 예약을 효율적으로 관리하고, 고객이 쉽게 예약할 수 있는 웹 기반 시스템 제공
- **기술 스택**: Hono + TypeScript + Cloudflare D1 + TailwindCSS

## 🚀 주요 기능

### ✅ 완료된 기능
1. **예약 관리**
   - 날짜별, 시간별 예약 생성
   - 예약 상태 관리 (확정/완료/취소)
   - 중복 예약 방지
   - 실시간 예약 가능 시간 표시

2. **고객 관리**
   - 고객 정보 자동 저장
   - 전화번호 기반 고객 조회
   - 예약 이력 관리

3. **미용사 관리**
   - 미용사별 예약 스케줄 관리
   - 전문 분야 표시

4. **서비스 메뉴**
   - 다양한 서비스 옵션 (컷트, 펌, 염색, 클리닉 등)
   - 서비스별 소요 시간 및 가격 정보
   - 패키지 서비스 지원

5. **사용자 인터페이스**
   - 반응형 디자인 (모바일/태블릿/데스크톱)
   - 직관적인 예약 프로세스
   - 실시간 예약 현황 확인

## 🔗 URL 및 엔드포인트

### 개발 환경
- **로컬**: http://localhost:3000
- **샌드박스**: https://3000-i4cuql2ergotvxh7axrsz-2b54fc91.sandbox.novita.ai

### API 엔드포인트

#### 미용사 API
- `GET /api/stylists` - 모든 미용사 조회
- `POST /api/stylists` - 새 미용사 추가

#### 서비스 API
- `GET /api/services` - 모든 서비스 조회
- `POST /api/services` - 새 서비스 추가

#### 고객 API
- `GET /api/customers` - 모든 고객 조회
- `POST /api/customers` - 고객 생성/조회 (전화번호 기반)

#### 예약 API
- `GET /api/bookings?date=YYYY-MM-DD` - 날짜별 예약 조회
- `POST /api/bookings` - 새 예약 생성
- `PATCH /api/bookings/:id` - 예약 상태 변경
- `DELETE /api/bookings/:id` - 예약 삭제

## 📊 데이터 구조

### 데이터베이스 스키마 (Cloudflare D1)

**stylists (미용사)**
- id, name, phone, specialty, created_at

**services (서비스)**
- id, name, duration, price, description, created_at

**customers (고객)**
- id, name, phone, email, notes, created_at

**bookings (예약)**
- id, customer_id, stylist_id, service_id, booking_date, booking_time, status, notes, created_at

### 저장 서비스
- **Cloudflare D1**: SQLite 기반 관계형 데이터베이스
- **로컬 개발**: `.wrangler/state/v3/d1` 디렉토리에 로컬 SQLite DB

## 📖 사용 가이드

### 예약하기
1. 상단 네비게이션에서 "예약하기" 클릭
2. 고객명과 전화번호 입력
3. 예약 날짜 선택
4. 원하는 미용사 선택
5. 서비스 메뉴 선택 (가격과 소요시간 확인)
6. 예약 가능한 시간 슬롯 클릭
7. 선택사항으로 메모 입력
8. "예약하기" 버튼 클릭

### 예약 관리
1. 상단 네비게이션에서 "예약 목록" 클릭
2. 날짜를 선택하여 해당일 예약 조회
3. 각 예약 카드에서:
   - "완료" 버튼: 서비스 완료 처리
   - "취소" 버튼: 예약 취소 처리

### 샘플 데이터
- **미용사**: 김미영, 이수진, 박지현
- **서비스**: 컷트(25,000원), 펌(80,000원), 염색(100,000원) 등
- **영업시간**: 09:00 ~ 18:30 (30분 단위)

## 🛠️ 개발 및 배포

### 로컬 개발
```bash
# 의존성 설치
npm install

# 데이터베이스 마이그레이션
npm run db:migrate:local

# 시드 데이터 삽입
npm run db:seed

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
   - 관리자 로그인
   - 미용사별 개인 대시보드

2. **알림 기능**
   - SMS 예약 확인
   - 예약 전날 리마인더

3. **통계 및 리포트**
   - 일별/월별 매출 통계
   - 미용사별 예약 현황
   - 인기 서비스 분석

4. **고급 기능**
   - 대기 명단 관리
   - 단골 고객 할인 시스템
   - 리뷰 및 평점 시스템

5. **UI/UX 개선**
   - 달력 뷰 추가
   - 드래그 앤 드롭 예약 변경
   - 다국어 지원

### 추천 다음 단계
1. 관리자 인증 시스템 구축
2. 예약 알림 기능 추가 (SMS/Email)
3. 매출 통계 대시보드 개발
4. 모바일 앱 개발 고려

## 📦 배포 현황

- **플랫폼**: Cloudflare Pages
- **상태**: ✅ 개발 완료 (배포 대기)
- **마지막 업데이트**: 2026-01-20

## 📝 기술 세부사항

### 프론트엔드
- TailwindCSS (CDN)
- Font Awesome Icons
- Axios HTTP Client
- Vanilla JavaScript

### 백엔드
- Hono Framework
- Cloudflare Workers Runtime
- TypeScript

### 데이터베이스
- Cloudflare D1 (SQLite)
- 로컬 개발용 SQLite

---

**개발자 노트**: 이 프로젝트는 Cloudflare Pages의 Edge Computing을 활용하여 전 세계 어디서든 빠른 응답 속도를 제공합니다. D1 데이터베이스는 관계형 데이터를 안전하게 저장하며, 자동 백업 및 확장성을 제공합니다.
