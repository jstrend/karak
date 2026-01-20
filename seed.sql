-- 기본 미용사 데이터
INSERT OR IGNORE INTO stylists (id, name, phone, specialty) VALUES 
  (1, '김미영', '010-1234-5678', '컷트/펌'),
  (2, '이수진', '010-2345-6789', '염색/탈색'),
  (3, '박지현', '010-3456-7890', '컷트/클리닉');

-- 기본 서비스 메뉴
INSERT OR IGNORE INTO services (id, name, duration, price, description) VALUES 
  (1, '컷트', 60, 25000, '기본 헤어컷'),
  (2, '펌', 120, 80000, '일반 펌'),
  (3, '염색', 150, 100000, '전체 염색'),
  (4, '탈색', 180, 120000, '전체 탈색'),
  (5, '클리닉', 90, 50000, '두피 및 모발 케어'),
  (6, '컷트+펌', 150, 95000, '컷트와 펌 패키지'),
  (7, '컷트+염색', 180, 110000, '컷트와 염색 패키지');

-- 샘플 고객 데이터
INSERT OR IGNORE INTO customers (id, name, phone, email) VALUES 
  (1, '홍길동', '010-1111-2222', 'hong@example.com'),
  (2, '김영희', '010-3333-4444', 'kim@example.com'),
  (3, '이철수', '010-5555-6666', 'lee@example.com');

-- 샘플 예약 데이터
INSERT OR IGNORE INTO bookings (customer_id, stylist_id, service_id, booking_date, booking_time, status) VALUES 
  (1, 1, 1, '2026-01-21', '10:00', 'confirmed'),
  (2, 2, 3, '2026-01-21', '14:00', 'confirmed'),
  (3, 1, 5, '2026-01-22', '11:00', 'confirmed');
