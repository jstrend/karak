-- 기존 데이터 삭제
DELETE FROM bookings;
DELETE FROM customers;
DELETE FROM services;
DELETE FROM stylists;

-- 원장 (1명)
INSERT INTO stylists (id, name, phone) VALUES 
  (1, '원장', '010-0000-0000');

-- 서비스 메뉴 (커트 성별별, 펌 3만원~)
INSERT INTO services (id, name, duration, price_min, price_max, gender, description) VALUES 
  (1, '남자 커트', 30, 15000, 15000, 'male', '남성 헤어컷 (30분 소요)'),
  (2, '여자 커트', 30, 18000, 18000, 'female', '여성 헤어컷 (30분 소요)'),
  (3, '펌', 120, 30000, NULL, NULL, '펌 시술 (2시간 소요, 3만원부터)');

-- 샘플 고객 데이터
INSERT INTO customers (id, name, phone, gender) VALUES 
  (1, '홍길동', '010-1111-2222', 'male'),
  (2, '김영희', '010-3333-4444', 'female'),
  (3, '이철수', '010-5555-6666', 'male');

-- 샘플 예약 데이터
INSERT INTO bookings (customer_id, stylist_id, service_id, booking_date, booking_time, status) VALUES 
  (1, 1, 1, '2026-01-21', '10:00', 'confirmed'),
  (2, 1, 2, '2026-01-21', '14:00', 'confirmed'),
  (3, 1, 3, '2026-01-22', '11:00', 'confirmed');
