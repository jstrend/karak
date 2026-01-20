import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Bindings = {
  DB: D1Database;
}

const app = new Hono<{ Bindings: Bindings }>()

// CORS 설정
app.use('/api/*', cors())

// ============================================
// 서비스 API
// ============================================

// 모든 서비스 조회
app.get('/api/services', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM services ORDER BY id'
  ).all()
  return c.json(results)
})

// 성별별 서비스 조회
app.get('/api/services/by-gender', async (c) => {
  const gender = c.req.query('gender')
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM services WHERE gender = ? OR gender IS NULL ORDER BY id'
  ).bind(gender).all()
  return c.json(results)
})

// ============================================
// 고객 API
// ============================================

// 고객 생성 또는 조회
app.post('/api/customers', async (c) => {
  const { name, phone, gender, email, notes } = await c.req.json()
  
  // 전화번호로 기존 고객 찾기
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM customers WHERE phone = ?'
  ).bind(phone).all()
  
  if (results && results.length > 0) {
    return c.json(results[0])
  }
  
  // 새 고객 생성
  const result = await c.env.DB.prepare(
    'INSERT INTO customers (name, phone, gender, email, notes) VALUES (?, ?, ?, ?, ?)'
  ).bind(name, phone, gender || null, email || null, notes || null).run()
  
  return c.json({ id: result.meta.last_row_id, name, phone, gender, email, notes })
})

// ============================================
// 예약 API
// ============================================

// 날짜별 예약된 시간 조회
app.get('/api/bookings/available-times', async (c) => {
  const date = c.req.query('date')
  
  if (!date) {
    return c.json({ error: '날짜를 입력해주세요.' }, 400)
  }
  
  // 해당 날짜의 모든 예약 조회
  const { results } = await c.env.DB.prepare(`
    SELECT 
      b.booking_time,
      b.status,
      s.duration
    FROM bookings b
    JOIN services s ON b.service_id = s.id
    WHERE b.booking_date = ? AND b.status = 'confirmed'
    ORDER BY b.booking_time
  `).bind(date).all()
  
  return c.json(results)
})

// 날짜별 예약 조회
app.get('/api/bookings', async (c) => {
  const date = c.req.query('date')
  
  let query = `
    SELECT 
      b.id,
      b.booking_date,
      b.booking_time,
      b.status,
      b.notes,
      b.created_at,
      c.name as customer_name,
      c.phone as customer_phone,
      c.gender as customer_gender,
      s.name as service_name,
      s.duration,
      s.price_min,
      s.price_max
    FROM bookings b
    JOIN customers c ON b.customer_id = c.id
    JOIN services s ON b.service_id = s.id
  `
  
  if (date) {
    query += ' WHERE b.booking_date = ? ORDER BY b.booking_time'
    const { results } = await c.env.DB.prepare(query).bind(date).all()
    return c.json(results)
  } else {
    query += ' ORDER BY b.booking_date DESC, b.booking_time DESC LIMIT 50'
    const { results } = await c.env.DB.prepare(query).all()
    return c.json(results)
  }
})

// 예약 생성
app.post('/api/bookings', async (c) => {
  const { customer_id, service_id, booking_date, booking_time, notes } = await c.req.json()
  
  // 시간 충돌 확인 (서비스 소요 시간 고려)
  const { results: service } = await c.env.DB.prepare(
    'SELECT duration FROM services WHERE id = ?'
  ).bind(service_id).all()
  
  if (!service || service.length === 0) {
    return c.json({ error: '서비스를 찾을 수 없습니다.' }, 400)
  }
  
  const duration = service[0].duration
  
  // 해당 날짜의 모든 예약 확인
  const { results: existing } = await c.env.DB.prepare(`
    SELECT b.booking_time, s.duration
    FROM bookings b
    JOIN services s ON b.service_id = s.id
    WHERE b.booking_date = ? AND b.status = 'confirmed'
  `).bind(booking_date).all()
  
  // 시간 충돌 검사
  const [requestHour, requestMin] = booking_time.split(':').map(Number)
  const requestStartMinutes = requestHour * 60 + requestMin
  const requestEndMinutes = requestStartMinutes + duration
  
  for (const booking of existing) {
    const [bookHour, bookMin] = booking.booking_time.split(':').map(Number)
    const bookStartMinutes = bookHour * 60 + bookMin
    const bookEndMinutes = bookStartMinutes + booking.duration
    
    // 시간 겹침 검사
    if (
      (requestStartMinutes >= bookStartMinutes && requestStartMinutes < bookEndMinutes) ||
      (requestEndMinutes > bookStartMinutes && requestEndMinutes <= bookEndMinutes) ||
      (requestStartMinutes <= bookStartMinutes && requestEndMinutes >= bookEndMinutes)
    ) {
      return c.json({ error: '해당 시간에 이미 예약이 있습니다.' }, 400)
    }
  }
  
  // 원장 ID는 항상 1
  const stylist_id = 1
  
  const result = await c.env.DB.prepare(
    'INSERT INTO bookings (customer_id, stylist_id, service_id, booking_date, booking_time, notes) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(customer_id, stylist_id, service_id, booking_date, booking_time, notes || null).run()
  
  return c.json({ 
    id: result.meta.last_row_id, 
    customer_id, 
    stylist_id, 
    service_id, 
    booking_date, 
    booking_time,
    status: 'confirmed'
  })
})

// 예약 상태 변경
app.patch('/api/bookings/:id', async (c) => {
  const id = c.req.param('id')
  const { status } = await c.req.json()
  
  await c.env.DB.prepare(
    'UPDATE bookings SET status = ? WHERE id = ?'
  ).bind(status, id).run()
  
  return c.json({ id, status })
})

// 예약 삭제
app.delete('/api/bookings/:id', async (c) => {
  const id = c.req.param('id')
  
  await c.env.DB.prepare(
    'DELETE FROM bookings WHERE id = ?'
  ).bind(id).run()
  
  return c.json({ success: true })
})

// ============================================
// 프론트엔드 페이지
// ============================================

app.get('/', (c) => {
  return c.html(`
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>미용실 예약 시스템</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    <style>
        .step {
            display: none;
        }
        .step.active {
            display: block;
        }
        .time-slot {
            transition: all 0.2s;
        }
        .time-slot:hover:not(:disabled) {
            transform: translateY(-2px);
        }
        .time-slot:disabled {
            opacity: 0.3;
            cursor: not-allowed;
        }
        .time-slot.selected {
            background-color: #ec4899;
            color: white;
            border-color: #ec4899;
        }
    </style>
</head>
<body class="bg-gray-50">
    <!-- 네비게이션 -->
    <nav class="bg-white shadow-sm border-b">
        <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between h-16">
                <div class="flex items-center">
                    <i class="fas fa-cut text-pink-600 text-2xl mr-3"></i>
                    <h1 class="text-2xl font-bold text-gray-900">미용실 예약</h1>
                </div>
                <div class="flex items-center space-x-4">
                    <button onclick="showTab('booking')" class="tab-btn px-4 py-2 text-gray-700 hover:text-pink-600">
                        <i class="fas fa-calendar-check mr-2"></i>예약하기
                    </button>
                    <button onclick="showTab('list')" class="tab-btn px-4 py-2 text-gray-700 hover:text-pink-600">
                        <i class="fas fa-list mr-2"></i>예약 목록
                    </button>
                </div>
            </div>
        </div>
    </nav>

    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <!-- 예약하기 탭 -->
        <div id="booking-tab" class="tab-content">
            <div class="bg-white rounded-lg shadow-md p-6">
                <!-- 진행 표시기 -->
                <div class="mb-8">
                    <div class="flex items-center justify-between">
                        <div class="flex-1">
                            <div class="flex items-center">
                                <div id="step1-indicator" class="step-indicator active w-10 h-10 rounded-full bg-pink-600 text-white flex items-center justify-center font-bold">
                                    1
                                </div>
                                <div class="flex-1 h-1 bg-gray-200 mx-2"></div>
                            </div>
                            <div class="text-sm mt-2 text-gray-600">날짜 선택</div>
                        </div>
                        <div class="flex-1">
                            <div class="flex items-center">
                                <div id="step2-indicator" class="step-indicator w-10 h-10 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center font-bold">
                                    2
                                </div>
                                <div class="flex-1 h-1 bg-gray-200 mx-2"></div>
                            </div>
                            <div class="text-sm mt-2 text-gray-600">시간 선택</div>
                        </div>
                        <div class="flex-1">
                            <div class="flex items-center">
                                <div id="step3-indicator" class="step-indicator w-10 h-10 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center font-bold">
                                    3
                                </div>
                            </div>
                            <div class="text-sm mt-2 text-gray-600">정보 입력</div>
                        </div>
                    </div>
                </div>

                <form id="booking-form">
                    <!-- Step 1: 날짜 및 서비스 선택 -->
                    <div id="step1" class="step active">
                        <h2 class="text-2xl font-bold text-gray-900 mb-6">
                            <i class="fas fa-calendar text-pink-600 mr-2"></i>
                            날짜 및 서비스 선택
                        </h2>
                        
                        <div class="space-y-6">
                            <!-- 성별 선택 -->
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-3">
                                    <i class="fas fa-user mr-1"></i>성별
                                </label>
                                <div class="grid grid-cols-2 gap-4">
                                    <button type="button" onclick="selectGender('male')" 
                                        class="gender-btn border-2 border-gray-300 rounded-lg p-4 hover:border-pink-500 transition">
                                        <i class="fas fa-mars text-blue-500 text-2xl mb-2"></i>
                                        <div class="font-semibold">남성</div>
                                    </button>
                                    <button type="button" onclick="selectGender('female')" 
                                        class="gender-btn border-2 border-gray-300 rounded-lg p-4 hover:border-pink-500 transition">
                                        <i class="fas fa-venus text-pink-500 text-2xl mb-2"></i>
                                        <div class="font-semibold">여성</div>
                                    </button>
                                </div>
                            </div>

                            <!-- 서비스 선택 -->
                            <div id="service-selection" style="display: none;">
                                <label class="block text-sm font-medium text-gray-700 mb-3">
                                    <i class="fas fa-cut mr-1"></i>서비스 선택
                                </label>
                                <div id="service-buttons" class="space-y-3">
                                    <!-- 서비스 버튼들이 여기에 동적으로 추가됩니다 -->
                                </div>
                            </div>

                            <!-- 날짜 선택 -->
                            <div id="date-selection" style="display: none;">
                                <label class="block text-sm font-medium text-gray-700 mb-3">
                                    <i class="fas fa-calendar mr-1"></i>예약 날짜
                                </label>
                                <input type="date" id="booking-date" required
                                    class="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent">
                            </div>

                            <button type="button" onclick="goToStep2()" id="step1-next-btn" disabled
                                class="w-full bg-pink-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-pink-700 transition duration-200 disabled:bg-gray-300 disabled:cursor-not-allowed">
                                다음 단계
                                <i class="fas fa-arrow-right ml-2"></i>
                            </button>
                        </div>
                    </div>

                    <!-- Step 2: 시간 선택 -->
                    <div id="step2" class="step">
                        <h2 class="text-2xl font-bold text-gray-900 mb-6">
                            <i class="fas fa-clock text-pink-600 mr-2"></i>
                            시간 선택
                        </h2>
                        
                        <div id="selected-info" class="bg-pink-50 border border-pink-200 rounded-lg p-4 mb-6">
                            <!-- 선택된 정보가 여기 표시됩니다 -->
                        </div>

                        <div id="time-slots" class="grid grid-cols-3 md:grid-cols-4 gap-3 mb-6">
                            <!-- 시간 슬롯이 여기에 동적으로 추가됩니다 -->
                        </div>

                        <div class="flex space-x-3">
                            <button type="button" onclick="goToStep1()"
                                class="flex-1 bg-gray-500 text-white py-3 px-6 rounded-lg font-semibold hover:bg-gray-600 transition duration-200">
                                <i class="fas fa-arrow-left mr-2"></i>이전
                            </button>
                            <button type="button" onclick="goToStep3()" id="step2-next-btn" disabled
                                class="flex-1 bg-pink-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-pink-700 transition duration-200 disabled:bg-gray-300 disabled:cursor-not-allowed">
                                다음 단계
                                <i class="fas fa-arrow-right ml-2"></i>
                            </button>
                        </div>
                    </div>

                    <!-- Step 3: 고객 정보 입력 -->
                    <div id="step3" class="step">
                        <h2 class="text-2xl font-bold text-gray-900 mb-6">
                            <i class="fas fa-user-edit text-pink-600 mr-2"></i>
                            고객 정보 입력
                        </h2>
                        
                        <div id="booking-summary" class="bg-pink-50 border border-pink-200 rounded-lg p-4 mb-6">
                            <!-- 예약 요약이 여기 표시됩니다 -->
                        </div>

                        <div class="space-y-4 mb-6">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">
                                    <i class="fas fa-user mr-1"></i>이름
                                </label>
                                <input type="text" id="customer-name" required
                                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                                    placeholder="홍길동">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">
                                    <i class="fas fa-phone mr-1"></i>전화번호
                                </label>
                                <input type="tel" id="customer-phone" required
                                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                                    placeholder="010-0000-0000">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">
                                    <i class="fas fa-comment mr-1"></i>메모 (선택사항)
                                </label>
                                <textarea id="booking-notes" rows="3"
                                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                                    placeholder="추가 요청사항이 있으시면 입력해주세요"></textarea>
                            </div>
                        </div>

                        <div class="flex space-x-3">
                            <button type="button" onclick="goToStep2()"
                                class="flex-1 bg-gray-500 text-white py-3 px-6 rounded-lg font-semibold hover:bg-gray-600 transition duration-200">
                                <i class="fas fa-arrow-left mr-2"></i>이전
                            </button>
                            <button type="submit"
                                class="flex-1 bg-pink-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-pink-700 transition duration-200">
                                <i class="fas fa-check mr-2"></i>예약 완료
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>

        <!-- 예약 목록 탭 -->
        <div id="list-tab" class="tab-content hidden">
            <div class="bg-white rounded-lg shadow-md p-6">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-bold text-gray-900">
                        <i class="fas fa-list text-pink-600 mr-2"></i>
                        예약 목록
                    </h2>
                    <input type="date" id="filter-date"
                        class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent">
                </div>
                
                <div id="bookings-list" class="space-y-4">
                    <!-- 예약 목록이 여기에 동적으로 추가됩니다 -->
                </div>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
    <script>
        let currentStep = 1;
        let selectedGender = null;
        let selectedService = null;
        let selectedDate = null;
        let selectedTime = null;
        let services = [];

        // 페이지 로드 시 초기화
        document.addEventListener('DOMContentLoaded', async () => {
            await loadServices();
            
            // 오늘 날짜 설정
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('booking-date').value = today;
            document.getElementById('booking-date').min = today;
            document.getElementById('filter-date').value = today;
            
            // 날짜 변경 이벤트
            document.getElementById('booking-date').addEventListener('change', (e) => {
                selectedDate = e.target.value;
                checkStep1Complete();
            });
            
            // 예약 폼 제출
            document.getElementById('booking-form').addEventListener('submit', handleBookingSubmit);
            
            // 필터 날짜 변경
            document.getElementById('filter-date').addEventListener('change', loadBookingsList);
        });

        // 서비스 로드
        async function loadServices() {
            try {
                const response = await axios.get('/api/services');
                services = response.data;
            } catch (error) {
                console.error('서비스 로드 실패:', error);
                alert('서비스를 불러오는데 실패했습니다.');
            }
        }

        // 성별 선택
        function selectGender(gender) {
            selectedGender = gender;
            
            // UI 업데이트
            document.querySelectorAll('.gender-btn').forEach(btn => {
                btn.classList.remove('border-pink-500', 'bg-pink-50');
            });
            event.target.closest('.gender-btn').classList.add('border-pink-500', 'bg-pink-50');
            
            // 서비스 목록 표시
            renderServiceButtons();
            document.getElementById('service-selection').style.display = 'block';
        }

        // 서비스 버튼 렌더링
        function renderServiceButtons() {
            const container = document.getElementById('service-buttons');
            const filteredServices = services.filter(s => 
                s.gender === selectedGender || s.gender === null
            );
            
            container.innerHTML = filteredServices.map(service => {
                const priceText = service.price_max 
                    ? \`\${service.price_min.toLocaleString()}원\`
                    : \`\${service.price_min.toLocaleString()}원~\`;
                
                return \`
                    <button type="button" onclick="selectService(\${service.id})" 
                        class="service-btn w-full border-2 border-gray-300 rounded-lg p-4 text-left hover:border-pink-500 transition"
                        data-service-id="\${service.id}">
                        <div class="flex justify-between items-start">
                            <div class="flex-1">
                                <div class="font-bold text-lg mb-1">\${service.name}</div>
                                <div class="text-sm text-gray-600">\${service.description}</div>
                            </div>
                            <div class="text-right ml-4">
                                <div class="font-semibold text-pink-600">\${priceText}</div>
                                <div class="text-sm text-gray-500">\${service.duration}분</div>
                            </div>
                        </div>
                    </button>
                \`;
            }).join('');
        }

        // 서비스 선택
        function selectService(serviceId) {
            selectedService = services.find(s => s.id === serviceId);
            
            // UI 업데이트
            document.querySelectorAll('.service-btn').forEach(btn => {
                btn.classList.remove('border-pink-500', 'bg-pink-50');
            });
            event.target.closest('.service-btn').classList.add('border-pink-500', 'bg-pink-50');
            
            // 날짜 선택 표시
            document.getElementById('date-selection').style.display = 'block';
            checkStep1Complete();
        }

        // Step 1 완료 체크
        function checkStep1Complete() {
            const btn = document.getElementById('step1-next-btn');
            if (selectedGender && selectedService && selectedDate) {
                btn.disabled = false;
            } else {
                btn.disabled = true;
            }
        }

        // Step 2로 이동
        async function goToStep2() {
            currentStep = 2;
            showStep(2);
            
            // 선택된 정보 표시
            const priceText = selectedService.price_max 
                ? \`\${selectedService.price_min.toLocaleString()}원\`
                : \`\${selectedService.price_min.toLocaleString()}원~\`;
            
            document.getElementById('selected-info').innerHTML = \`
                <div class="font-semibold text-lg mb-2">선택하신 내용</div>
                <div class="grid grid-cols-2 gap-2 text-sm">
                    <div><i class="fas fa-calendar mr-1"></i> \${selectedDate}</div>
                    <div><i class="fas fa-cut mr-1"></i> \${selectedService.name}</div>
                    <div><i class="fas fa-clock mr-1"></i> \${selectedService.duration}분</div>
                    <div><i class="fas fa-won-sign mr-1"></i> \${priceText}</div>
                </div>
            \`;
            
            // 예약 가능 시간 로드
            await loadAvailableTimes();
        }

        // 예약 가능 시간 로드
        async function loadAvailableTimes() {
            try {
                const response = await axios.get(\`/api/bookings/available-times?date=\${selectedDate}\`);
                const bookedTimes = response.data;
                
                renderTimeSlots(bookedTimes);
            } catch (error) {
                console.error('시간 조회 실패:', error);
                alert('시간을 불러오는데 실패했습니다.');
            }
        }

        // 시간 슬롯 렌더링
        function renderTimeSlots(bookedTimes) {
            const container = document.getElementById('time-slots');
            container.innerHTML = '';
            
            const times = [];
            for (let hour = 9; hour <= 18; hour++) {
                times.push(\`\${hour.toString().padStart(2, '0')}:00\`);
                if (hour < 18) times.push(\`\${hour.toString().padStart(2, '0')}:30\`);
            }
            
            times.forEach(time => {
                const isAvailable = checkTimeAvailable(time, bookedTimes);
                const button = document.createElement('button');
                button.type = 'button';
                button.className = \`time-slot px-4 py-3 border-2 rounded-lg font-semibold \${
                    isAvailable 
                        ? 'border-gray-300 bg-white text-gray-700 hover:border-pink-500' 
                        : 'border-gray-200 bg-gray-100 text-gray-400'
                }\`;
                button.textContent = time;
                button.disabled = !isAvailable;
                
                if (isAvailable) {
                    button.addEventListener('click', () => selectTime(time));
                }
                
                container.appendChild(button);
            });
        }

        // 시간 사용 가능 여부 확인
        function checkTimeAvailable(time, bookedTimes) {
            const [hour, min] = time.split(':').map(Number);
            const timeInMinutes = hour * 60 + min;
            const endTimeInMinutes = timeInMinutes + selectedService.duration;
            
            // 영업 시간 체크 (18:30 이전에 끝나야 함)
            if (endTimeInMinutes > 18 * 60 + 30) {
                return false;
            }
            
            for (const booked of bookedTimes) {
                const [bHour, bMin] = booked.booking_time.split(':').map(Number);
                const bStart = bHour * 60 + bMin;
                const bEnd = bStart + booked.duration;
                
                // 겹치는지 확인
                if (
                    (timeInMinutes >= bStart && timeInMinutes < bEnd) ||
                    (endTimeInMinutes > bStart && endTimeInMinutes <= bEnd) ||
                    (timeInMinutes <= bStart && endTimeInMinutes >= bEnd)
                ) {
                    return false;
                }
            }
            
            return true;
        }

        // 시간 선택
        function selectTime(time) {
            selectedTime = time;
            
            // UI 업데이트
            document.querySelectorAll('.time-slot').forEach(btn => {
                btn.classList.remove('selected', 'bg-pink-500', 'text-white', 'border-pink-500');
                if (!btn.disabled) {
                    btn.classList.add('border-gray-300', 'bg-white', 'text-gray-700');
                }
            });
            
            event.target.classList.remove('border-gray-300', 'bg-white', 'text-gray-700');
            event.target.classList.add('selected');
            
            document.getElementById('step2-next-btn').disabled = false;
        }

        // Step 3로 이동
        function goToStep3() {
            currentStep = 3;
            showStep(3);
            
            // 예약 요약 표시
            const priceText = selectedService.price_max 
                ? \`\${selectedService.price_min.toLocaleString()}원\`
                : \`\${selectedService.price_min.toLocaleString()}원~\`;
            
            document.getElementById('booking-summary').innerHTML = \`
                <div class="font-semibold text-lg mb-3">예약 내용 확인</div>
                <div class="space-y-2 text-sm">
                    <div class="flex justify-between">
                        <span class="text-gray-600">날짜</span>
                        <span class="font-semibold">\${selectedDate}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600">시간</span>
                        <span class="font-semibold">\${selectedTime}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600">서비스</span>
                        <span class="font-semibold">\${selectedService.name}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600">소요시간</span>
                        <span class="font-semibold">\${selectedService.duration}분</span>
                    </div>
                    <div class="flex justify-between border-t pt-2 mt-2">
                        <span class="text-gray-600">가격</span>
                        <span class="font-bold text-pink-600">\${priceText}</span>
                    </div>
                </div>
            \`;
        }

        // Step 1로 돌아가기
        function goToStep1() {
            currentStep = 1;
            showStep(1);
        }

        // Step 표시
        function showStep(step) {
            document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
            document.getElementById(\`step\${step}\`).classList.add('active');
            
            // 진행 표시기 업데이트
            for (let i = 1; i <= 3; i++) {
                const indicator = document.getElementById(\`step\${i}-indicator\`);
                if (i <= step) {
                    indicator.classList.add('bg-pink-600', 'text-white');
                    indicator.classList.remove('bg-gray-200', 'text-gray-600');
                } else {
                    indicator.classList.remove('bg-pink-600', 'text-white');
                    indicator.classList.add('bg-gray-200', 'text-gray-600');
                }
            }
        }

        // 예약 제출
        async function handleBookingSubmit(e) {
            e.preventDefault();
            
            const customerName = document.getElementById('customer-name').value;
            const customerPhone = document.getElementById('customer-phone').value;
            const notes = document.getElementById('booking-notes').value;
            
            try {
                // 고객 생성 또는 조회
                const customerRes = await axios.post('/api/customers', {
                    name: customerName,
                    phone: customerPhone,
                    gender: selectedGender
                });
                const customerId = customerRes.data.id;
                
                // 예약 생성
                await axios.post('/api/bookings', {
                    customer_id: customerId,
                    service_id: selectedService.id,
                    booking_date: selectedDate,
                    booking_time: selectedTime,
                    notes: notes || null
                });
                
                alert('예약이 완료되었습니다!');
                
                // 폼 리셋
                document.getElementById('booking-form').reset();
                selectedGender = null;
                selectedService = null;
                selectedDate = null;
                selectedTime = null;
                currentStep = 1;
                showStep(1);
                document.getElementById('service-selection').style.display = 'none';
                document.getElementById('date-selection').style.display = 'none';
                document.querySelectorAll('.gender-btn, .service-btn').forEach(btn => {
                    btn.classList.remove('border-pink-500', 'bg-pink-50');
                });
            } catch (error) {
                console.error('예약 실패:', error);
                alert(error.response?.data?.error || '예약에 실패했습니다.');
            }
        }

        // 탭 전환
        function showTab(tab) {
            document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
            document.getElementById(\`\${tab}-tab\`).classList.remove('hidden');
            
            if (tab === 'list') {
                loadBookingsList();
            }
        }

        // 예약 목록 로드
        async function loadBookingsList() {
            const date = document.getElementById('filter-date').value;
            
            try {
                const response = await axios.get(\`/api/bookings?date=\${date}\`);
                renderBookingsList(response.data);
            } catch (error) {
                console.error('예약 목록 로드 실패:', error);
            }
        }

        // 예약 목록 렌더링
        function renderBookingsList(bookings) {
            const container = document.getElementById('bookings-list');
            
            if (bookings.length === 0) {
                container.innerHTML = '<p class="text-gray-500 text-center py-8">예약이 없습니다.</p>';
                return;
            }
            
            container.innerHTML = bookings.map(booking => {
                const priceText = booking.price_max 
                    ? \`\${booking.price_min.toLocaleString()}원\`
                    : \`\${booking.price_min.toLocaleString()}원~\`;
                
                const genderIcon = booking.customer_gender === 'male' 
                    ? '<i class="fas fa-mars text-blue-500 mr-1"></i>'
                    : '<i class="fas fa-venus text-pink-500 mr-1"></i>';
                
                return \`
                <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                    <div class="flex justify-between items-start">
                        <div class="flex-1">
                            <div class="flex items-center mb-2">
                                \${genderIcon}
                                <span class="text-lg font-semibold text-gray-900">\${booking.customer_name}</span>
                                <span class="ml-3 text-sm text-gray-600">
                                    <i class="fas fa-phone mr-1"></i>\${booking.customer_phone}
                                </span>
                            </div>
                            <div class="grid grid-cols-2 gap-2 text-sm text-gray-600">
                                <div>
                                    <i class="fas fa-clock text-pink-600 mr-1"></i>
                                    \${booking.booking_date} \${booking.booking_time}
                                </div>
                                <div>
                                    <i class="fas fa-cut text-pink-600 mr-1"></i>
                                    \${booking.service_name} (\${booking.duration}분)
                                </div>
                                <div>
                                    <i class="fas fa-won-sign text-pink-600 mr-1"></i>
                                    \${priceText}
                                </div>
                            </div>
                            \${booking.notes ? \`<div class="mt-2 text-sm text-gray-500"><i class="fas fa-comment mr-1"></i>\${booking.notes}</div>\` : ''}
                        </div>
                        <div class="flex space-x-2">
                            \${booking.status === 'confirmed' ? \`
                                <button onclick="updateBookingStatus(\${booking.id}, 'completed')" 
                                    class="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm">
                                    <i class="fas fa-check mr-1"></i>완료
                                </button>
                                <button onclick="updateBookingStatus(\${booking.id}, 'cancelled')" 
                                    class="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm">
                                    <i class="fas fa-times mr-1"></i>취소
                                </button>
                            \` : \`
                                <span class="px-3 py-1 bg-gray-100 text-gray-600 rounded text-sm">
                                    \${booking.status === 'completed' ? '완료됨' : '취소됨'}
                                </span>
                            \`}
                        </div>
                    </div>
                </div>
            \`;
            }).join('');
        }

        // 예약 상태 변경
        async function updateBookingStatus(id, status) {
            if (!confirm(\`예약을 \${status === 'completed' ? '완료' : '취소'}하시겠습니까?\`)) {
                return;
            }
            
            try {
                await axios.patch(\`/api/bookings/\${id}\`, { status });
                loadBookingsList();
            } catch (error) {
                console.error('상태 변경 실패:', error);
                alert('상태 변경에 실패했습니다.');
            }
        }
    </script>
</body>
</html>
  `)
})

export default app
