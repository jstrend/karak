import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Bindings = {
  DB: D1Database;
}

const app = new Hono<{ Bindings: Bindings }>()

// CORS 설정
app.use('/api/*', cors())

// ============================================
// 미용사 API
// ============================================

// 모든 미용사 조회
app.get('/api/stylists', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM stylists ORDER BY id'
  ).all()
  return c.json(results)
})

// 미용사 생성
app.post('/api/stylists', async (c) => {
  const { name, phone, specialty } = await c.req.json()
  const result = await c.env.DB.prepare(
    'INSERT INTO stylists (name, phone, specialty) VALUES (?, ?, ?)'
  ).bind(name, phone, specialty).run()
  return c.json({ id: result.meta.last_row_id, name, phone, specialty })
})

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

// 서비스 생성
app.post('/api/services', async (c) => {
  const { name, duration, price, description } = await c.req.json()
  const result = await c.env.DB.prepare(
    'INSERT INTO services (name, duration, price, description) VALUES (?, ?, ?, ?)'
  ).bind(name, duration, price, description).run()
  return c.json({ id: result.meta.last_row_id, name, duration, price, description })
})

// ============================================
// 고객 API
// ============================================

// 모든 고객 조회
app.get('/api/customers', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM customers ORDER BY id DESC'
  ).all()
  return c.json(results)
})

// 고객 생성 또는 조회
app.post('/api/customers', async (c) => {
  const { name, phone, email, notes } = await c.req.json()
  
  // 전화번호로 기존 고객 찾기
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM customers WHERE phone = ?'
  ).bind(phone).all()
  
  if (results && results.length > 0) {
    return c.json(results[0])
  }
  
  // 새 고객 생성
  const result = await c.env.DB.prepare(
    'INSERT INTO customers (name, phone, email, notes) VALUES (?, ?, ?, ?)'
  ).bind(name, phone, email || null, notes || null).run()
  
  return c.json({ id: result.meta.last_row_id, name, phone, email, notes })
})

// ============================================
// 예약 API
// ============================================

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
      s.name as stylist_name,
      sv.name as service_name,
      sv.duration,
      sv.price
    FROM bookings b
    JOIN customers c ON b.customer_id = c.id
    JOIN stylists s ON b.stylist_id = s.id
    JOIN services sv ON b.service_id = sv.id
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
  const { customer_id, stylist_id, service_id, booking_date, booking_time, notes } = await c.req.json()
  
  // 중복 예약 확인
  const { results: existing } = await c.env.DB.prepare(
    'SELECT * FROM bookings WHERE stylist_id = ? AND booking_date = ? AND booking_time = ? AND status != ?'
  ).bind(stylist_id, booking_date, booking_time, 'cancelled').all()
  
  if (existing && existing.length > 0) {
    return c.json({ error: '해당 시간에 이미 예약이 있습니다.' }, 400)
  }
  
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
        .time-slot {
            transition: all 0.2s;
        }
        .time-slot:hover {
            transform: translateY(-2px);
        }
        .time-slot.booked {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .modal {
            display: none;
        }
        .modal.active {
            display: flex;
        }
    </style>
</head>
<body class="bg-gray-50">
    <!-- 네비게이션 -->
    <nav class="bg-white shadow-sm border-b">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between h-16">
                <div class="flex items-center">
                    <i class="fas fa-cut text-pink-600 text-2xl mr-3"></i>
                    <h1 class="text-2xl font-bold text-gray-900">미용실 예약 시스템</h1>
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

    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <!-- 예약하기 탭 -->
        <div id="booking-tab" class="tab-content">
            <div class="bg-white rounded-lg shadow-md p-6">
                <h2 class="text-2xl font-bold text-gray-900 mb-6">
                    <i class="fas fa-calendar-plus text-pink-600 mr-2"></i>
                    새 예약
                </h2>
                
                <!-- 예약 폼 -->
                <form id="booking-form" class="space-y-6">
                    <!-- 고객 정보 -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">
                                <i class="fas fa-user mr-1"></i>고객명
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
                    </div>

                    <!-- 날짜 선택 -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">
                            <i class="fas fa-calendar mr-1"></i>예약 날짜
                        </label>
                        <input type="date" id="booking-date" required
                            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent">
                    </div>

                    <!-- 미용사 선택 -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">
                            <i class="fas fa-user-tie mr-1"></i>미용사 선택
                        </label>
                        <select id="stylist-select" required
                            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent">
                            <option value="">선택하세요</option>
                        </select>
                    </div>

                    <!-- 서비스 선택 -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">
                            <i class="fas fa-cut mr-1"></i>서비스 선택
                        </label>
                        <select id="service-select" required
                            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent">
                            <option value="">선택하세요</option>
                        </select>
                        <div id="service-info" class="mt-2 text-sm text-gray-600"></div>
                    </div>

                    <!-- 시간 선택 -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-3">
                            <i class="fas fa-clock mr-1"></i>예약 시간
                        </label>
                        <div id="time-slots" class="grid grid-cols-4 md:grid-cols-6 gap-2">
                            <!-- 시간 슬롯이 여기에 동적으로 추가됩니다 -->
                        </div>
                    </div>

                    <!-- 메모 -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">
                            <i class="fas fa-comment mr-1"></i>메모 (선택사항)
                        </label>
                        <textarea id="booking-notes" rows="3"
                            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                            placeholder="추가 요청사항이 있으시면 입력해주세요"></textarea>
                    </div>

                    <!-- 제출 버튼 -->
                    <button type="submit"
                        class="w-full bg-pink-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-pink-700 transition duration-200">
                        <i class="fas fa-check mr-2"></i>예약하기
                    </button>
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
        let stylists = [];
        let services = [];
        let bookings = [];
        let selectedTime = null;

        // 페이지 로드 시 초기화
        document.addEventListener('DOMContentLoaded', async () => {
            await loadData();
            setupEventListeners();
            
            // 오늘 날짜 설정
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('booking-date').value = today;
            document.getElementById('booking-date').min = today;
            document.getElementById('filter-date').value = today;
        });

        // 데이터 로드
        async function loadData() {
            try {
                const [stylistsRes, servicesRes] = await Promise.all([
                    axios.get('/api/stylists'),
                    axios.get('/api/services')
                ]);
                
                stylists = stylistsRes.data;
                services = servicesRes.data;
                
                renderStylists();
                renderServices();
            } catch (error) {
                console.error('데이터 로드 실패:', error);
                alert('데이터를 불러오는데 실패했습니다.');
            }
        }

        // 미용사 목록 렌더링
        function renderStylists() {
            const select = document.getElementById('stylist-select');
            select.innerHTML = '<option value="">선택하세요</option>';
            stylists.forEach(stylist => {
                select.innerHTML += \`<option value="\${stylist.id}">\${stylist.name} - \${stylist.specialty}</option>\`;
            });
        }

        // 서비스 목록 렌더링
        function renderServices() {
            const select = document.getElementById('service-select');
            select.innerHTML = '<option value="">선택하세요</option>';
            services.forEach(service => {
                select.innerHTML += \`<option value="\${service.id}">\${service.name} - \${service.price.toLocaleString()}원</option>\`;
            });
        }

        // 이벤트 리스너 설정
        function setupEventListeners() {
            document.getElementById('booking-date').addEventListener('change', updateTimeSlots);
            document.getElementById('stylist-select').addEventListener('change', updateTimeSlots);
            document.getElementById('service-select').addEventListener('change', showServiceInfo);
            document.getElementById('booking-form').addEventListener('submit', handleBookingSubmit);
            document.getElementById('filter-date').addEventListener('change', loadBookingsList);
        }

        // 서비스 정보 표시
        function showServiceInfo() {
            const serviceId = document.getElementById('service-select').value;
            const infoDiv = document.getElementById('service-info');
            
            if (!serviceId) {
                infoDiv.innerHTML = '';
                return;
            }
            
            const service = services.find(s => s.id == serviceId);
            if (service) {
                infoDiv.innerHTML = \`
                    <i class="fas fa-info-circle text-pink-600 mr-1"></i>
                    소요시간: \${service.duration}분 | 가격: \${service.price.toLocaleString()}원
                \`;
            }
        }

        // 시간 슬롯 업데이트
        async function updateTimeSlots() {
            const date = document.getElementById('booking-date').value;
            const stylistId = document.getElementById('stylist-select').value;
            
            if (!date || !stylistId) return;
            
            try {
                const response = await axios.get(\`/api/bookings?date=\${date}\`);
                const dayBookings = response.data.filter(b => b.stylist_id == stylistId);
                
                renderTimeSlots(dayBookings);
            } catch (error) {
                console.error('예약 조회 실패:', error);
            }
        }

        // 시간 슬롯 렌더링
        function renderTimeSlots(dayBookings) {
            const container = document.getElementById('time-slots');
            container.innerHTML = '';
            
            const times = [];
            for (let hour = 9; hour <= 18; hour++) {
                times.push(\`\${hour.toString().padStart(2, '0')}:00\`);
                if (hour < 18) times.push(\`\${hour.toString().padStart(2, '0')}:30\`);
            }
            
            times.forEach(time => {
                const isBooked = dayBookings.some(b => b.booking_time === time && b.status === 'confirmed');
                const button = document.createElement('button');
                button.type = 'button';
                button.className = \`time-slot px-4 py-2 border rounded-lg text-sm font-medium \${
                    isBooked 
                        ? 'booked bg-gray-100 text-gray-400 border-gray-200' 
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-pink-50 hover:border-pink-500'
                }\`;
                button.textContent = time;
                button.disabled = isBooked;
                
                if (!isBooked) {
                    button.addEventListener('click', () => selectTime(time, button));
                }
                
                container.appendChild(button);
            });
        }

        // 시간 선택
        function selectTime(time, button) {
            document.querySelectorAll('.time-slot').forEach(btn => {
                btn.classList.remove('bg-pink-500', 'text-white', 'border-pink-500');
                if (!btn.disabled) {
                    btn.classList.add('bg-white', 'text-gray-700', 'border-gray-300');
                }
            });
            
            button.classList.remove('bg-white', 'text-gray-700', 'border-gray-300');
            button.classList.add('bg-pink-500', 'text-white', 'border-pink-500');
            selectedTime = time;
        }

        // 예약 제출
        async function handleBookingSubmit(e) {
            e.preventDefault();
            
            if (!selectedTime) {
                alert('예약 시간을 선택해주세요.');
                return;
            }
            
            const customerName = document.getElementById('customer-name').value;
            const customerPhone = document.getElementById('customer-phone').value;
            const bookingDate = document.getElementById('booking-date').value;
            const stylistId = document.getElementById('stylist-select').value;
            const serviceId = document.getElementById('service-select').value;
            const notes = document.getElementById('booking-notes').value;
            
            try {
                // 고객 생성 또는 조회
                const customerRes = await axios.post('/api/customers', {
                    name: customerName,
                    phone: customerPhone
                });
                const customerId = customerRes.data.id;
                
                // 예약 생성
                await axios.post('/api/bookings', {
                    customer_id: customerId,
                    stylist_id: parseInt(stylistId),
                    service_id: parseInt(serviceId),
                    booking_date: bookingDate,
                    booking_time: selectedTime,
                    notes: notes || null
                });
                
                alert('예약이 완료되었습니다!');
                document.getElementById('booking-form').reset();
                selectedTime = null;
                updateTimeSlots();
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
            
            container.innerHTML = bookings.map(booking => \`
                <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                    <div class="flex justify-between items-start">
                        <div class="flex-1">
                            <div class="flex items-center mb-2">
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
                                    <i class="fas fa-user-tie text-pink-600 mr-1"></i>
                                    \${booking.stylist_name}
                                </div>
                                <div>
                                    <i class="fas fa-cut text-pink-600 mr-1"></i>
                                    \${booking.service_name}
                                </div>
                                <div>
                                    <i class="fas fa-won-sign text-pink-600 mr-1"></i>
                                    \${booking.price.toLocaleString()}원
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
            \`).join('');
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
