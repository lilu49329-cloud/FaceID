const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const loader = document.getElementById('ai-loader');
const facePreview = document.getElementById('face-preview');
const resultName = document.getElementById('result-name');
const resultRole = document.getElementById('result-role');
const resultGender = document.getElementById('result-gender');
const resultStatus = document.getElementById('result-status');

// Controls
const btnToggle = document.getElementById('btn-toggle');
const btnAdd = document.getElementById('btn-add');
const btnSave = document.getElementById('btn-save');
const btnCancel = document.getElementById('btn-cancel');
const btnClearAll = document.getElementById('btn-clear-all');
const btnExport = document.getElementById('btn-export');
const btnClearAttendance = document.getElementById('btn-clear-attendance');
const modal = document.getElementById('modal');
const inputName = document.getElementById('input-name');
const inputStudentId = document.getElementById('input-student-id');
const selectGender = document.getElementById('select-gender');
const inputFileId = document.getElementById('input-file-id');
const idPhotoDisplay = document.getElementById('id-photo-display');
const selectSubject = document.getElementById('select-subject');
const selectRole = document.getElementById('select-role');

// Stats and Lists
const statTotal = document.getElementById('stat-total-faces');
const statPresent = document.getElementById('stat-present');
const statLate = document.getElementById('stat-late');
const logShort = document.getElementById('attendance-log-short');
const logFull = document.getElementById('attendance-log-full');
const dbListBody = document.getElementById('db-list-body');
const gradingListBody = document.getElementById('grading-list-body');
const btnRefreshGrading = document.getElementById('btn-refresh-grading');

// App State
let isRecognitionMode = true;
let labeledFaceDescriptors = [];
let faceMatcher = null;
let currentDescriptor = null;
let logData = [];
let lastCheckIn = {};

// Sử dụng jsDelivr CDN - nhanh hơn GitHub raw
const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';
const FALLBACK_MODEL_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';
const API_URL = ''; // Để trống vì chạy cùng origin (localhost:3000)

// Helper: Loại bỏ dấu Tiếng Việt để tạo Email chuẩn ASCII
function removeVietnameseTones(str) {
    if (!str) return "";
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
    str = str.replace(/đ/g, "d");
    str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
    str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
    str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
    str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
    str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
    str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
    str = str.replace(/Đ/g, "D");
    // Remove combining diacritical marks
    str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return str;
}

// Element để hiển thị tiến trình
const initialLoader = document.getElementById('initial-loader');

function updateLoadingStatus(message, progress = 0) {
    if (initialLoader) {
        const statusText = initialLoader.querySelector('p');
        if (statusText) {
            statusText.innerHTML = `${message}<br><small style="opacity: 0.7">${progress}% hoàn thành</small>`;
        }
    }
}

// --- KHỞI TẠO HỆ THỐNG ---
async function loadSingleModel(loadFn, modelUrl, name, onProgress) {
    try {
        await loadFn(modelUrl);
        onProgress();
        return true;
    } catch (err) {
        console.warn(`Lỗi tải ${name} từ CDN chính, thử fallback...`);
        try {
            await loadFn(FALLBACK_MODEL_URL);
            onProgress();
            return true;
        } catch (fallbackErr) {
            throw new Error(`Không thể tải mô hình ${name}`);
        }
    }
}

async function init() {
    try {
        let loadedCount = 0;
        const totalModels = 4;
        const modelNames = ['SSD MobileNet', 'Face Landmark', 'Face Recognition', 'Age Gender'];

        const onProgress = (name) => {
            loadedCount++;
            const percent = Math.round((loadedCount / totalModels) * 100);
            updateLoadingStatus(`Đang tải: ${name}...`, percent);
        };

        updateLoadingStatus('Đang kết nối CDN...', 0);

        // Tải tuần tự để hiển thị tiến trình rõ hơn (và giảm tải băng thông)
        updateLoadingStatus(`Đang tải: ${modelNames[0]}...`, 0);
        await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
        onProgress(modelNames[0]);

        // Tải thêm TinyFaceDetector để dự phòng
        updateLoadingStatus('Đang tải: Tiny Face Detector...', 20);
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);

        updateLoadingStatus(`Đang tải: ${modelNames[1]}...`, 40);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        onProgress(modelNames[1]);

        updateLoadingStatus(`Đang tải: ${modelNames[2]}...`, 60);
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        onProgress(modelNames[2]);

        updateLoadingStatus(`Đang tải: ${modelNames[3]}...`, 80);
        await faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL);
        onProgress(modelNames[3]);

        updateLoadingStatus('Đang khởi tạo hệ thống...', 100);

        console.log('✅ AI Models Ready');
        await loadDataFromServer();
        await loadAttendanceFromServer();

        // Ẩn loader
        if (initialLoader) {
            initialLoader.style.opacity = '0';
            setTimeout(() => initialLoader.style.display = 'none', 300);
        }

        // startVideo(); // Không bật camera ngay khi init nữa
        initTabs();

        // Nạp môn học đã lưu từ localStorage (nếu có)
        const savedSubject = localStorage.getItem('currentSubject');
        if (savedSubject) {
            selectSubject.value = savedSubject;
        }
    } catch (err) {
        console.error('AI Load Error:', err);
        updateLoadingStatus('❌ Lỗi tải AI! Vui lòng refresh trang.', 0);
    }
}

let videoStream = null;
function startVideo() {
    navigator.mediaDevices.getUserMedia({ video: {} })
        .then(stream => {
            videoStream = stream;
            video.srcObject = stream;
            loader.style.display = 'none';
        })
        .catch(err => alert('Không camera!'));
}

function stopVideo() {
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
        video.srcObject = null;
    }
}

function initTabs() {
    const navItems = document.querySelectorAll('.nav-item');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const currentPageTitle = document.getElementById('current-page-title');

    const tabTitles = {
        'tab-monitor': 'Giám sát Camera',
        'tab-database': 'Dữ liệu Sinh viên',
        'tab-grading': 'Điểm Chuyên cần',
        'tab-reports': 'Báo cáo Chuyên cần'
    };

    // Để hàm có thể gọi từ bên ngoài (Global)
    window.switchTab = function (tabId) {
        // Tắt/Bật camera dựa trên tab và vai trò
        if (tabId === 'tab-monitor' && currentUserRole !== 'Giảng viên') {
            startVideo();
        } else {
            stopVideo();
        }

        // TỰ ĐỘNG ẨN/HIỆN PHẦN CHUNG (Tận dụng CSS Class để tránh lỗi khoảng trắng)
        const appContainer = document.querySelector('.app-container');

        if (tabId === 'tab-profile') {
            if (appContainer) appContainer.classList.add('hide-sidebar');
        } else {
            if (appContainer) appContainer.classList.remove('hide-sidebar');
        }

        // Update nav items
        navItems.forEach(n => n.classList.remove('active'));
        tabBtns.forEach(t => t.classList.remove('active'));
        tabContents.forEach(t => t.classList.remove('active'));

        // Find and activate matching elements
        navItems.forEach(n => {
            if (n.dataset.tab === tabId) n.classList.add('active');
        });
        tabBtns.forEach(t => {
            if (t.dataset.tab === tabId) t.classList.add('active');
        });

        const tabContent = document.getElementById(tabId);
        if (tabContent) tabContent.classList.add('active');

        // Update breadcrumb
        if (currentPageTitle) {
            currentPageTitle.textContent = tabTitles[tabId] || "Trang cá nhân";
        }
        
        // --- MOBILE TWEAK: Tự động đóng Menu khi đã chọn Tab ---
        if (window.innerWidth <= 768) {
            const sidebar = document.querySelector('.sidebar');
            if (sidebar && !sidebar.classList.contains('collapsed')) {
                window.toggleSidebar(); // Đóng lại thông qua hàm chung
            }
        }
    }

    // Add click handlers for sidebar nav
    navItems.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Add click handlers for tab bar
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Sidebar Toggle Logic - GLOBAL & FAILSAFE
    window.toggleSidebar = function () {
        const sidebar = document.querySelector('.sidebar');
        const appContainer = document.querySelector('.app-container');
        const toggleBtn = document.getElementById('sidebar-toggle');

        if (sidebar && appContainer) {
            console.log("Global Toggle Executed!");
            sidebar.classList.toggle('collapsed');
            appContainer.classList.toggle('sidebar-collapsed');

            if (sidebar.classList.contains('collapsed')) {
                if (toggleBtn) toggleBtn.title = "Mở rộng menu";
            } else {
                if (toggleBtn) toggleBtn.title = "Thu gọn menu";
            }
        }
    };

    // Mặc định cho thu gọn ngay từ đầu để giống Ảnh 2
    const initSidebar = document.querySelector('.sidebar');
    const initContainer = document.querySelector('.app-container');
    if (initSidebar && initContainer) {
        initSidebar.classList.add('collapsed');
        initContainer.classList.add('sidebar-collapsed');
    }


    // Initialize datetime display
    updateDateTime();
    setInterval(updateDateTime, 1000);
}

function updateDateTime() {
    const now = new Date();
    const dateEl = document.getElementById('header-date');
    const timeEl = document.getElementById('header-time');

    if (dateEl) {
        dateEl.textContent = now.toLocaleDateString('vi-VN', {
            weekday: 'long',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    if (timeEl) {
        timeEl.textContent = now.toLocaleTimeString('vi-VN');
    }
}

let recognitionId = null;
let idleFrames = 0;
const cameraCard = document.querySelector('.camera-card');

async function startRecognitionLoop() {
    if (video.paused || video.ended || video.videoWidth === 0) {
        recognitionId = setTimeout(startRecognitionLoop, 500);
        return;
    }

    const displaySize = { width: video.videoWidth, height: video.videoHeight };
    faceapi.matchDimensions(overlay, displaySize);

    // Dùng TinyFaceDetector để quét SIÊU NHANH cho camera
    const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptor()
        .withAgeAndGender();

    const ctx = overlay.getContext('2d');
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    let nextDelay = 30; // Giảm xuống 30ms để đạt FPS cao hơn

    if (detection) {
        idleFrames = 0;
        cameraCard.classList.remove('resting');

        const resized = faceapi.resizeResults(detection, displaySize);
        faceapi.draw.drawDetections(overlay, resized);
        updateAnalysisUI(detection);
        currentDescriptor = detection.descriptor;
        btnAdd.disabled = false;
        showFacePreview(video, detection.detection.box);
        if (isRecognitionMode) doRecognition(detection.descriptor);
    } else {
        idleFrames++;
        btnAdd.disabled = true;
        resultName.innerText = "ĐANG QUÉT...";
        resetAnalysisUI();

        if (idleFrames > 30) {
            cameraCard.classList.add('resting');
            nextDelay = 500; // Nghỉ nhanh hơn
        } else {
            nextDelay = 50;
        }
    }

    recognitionId = setTimeout(startRecognitionLoop, nextDelay);
}

video.addEventListener('play', () => {
    if (recognitionId) clearTimeout(recognitionId);
    startRecognitionLoop();
});

function updateAnalysisUI(det) {
    resultGender.innerText = det.gender === 'male' ? 'Nam' : 'Nữ';
    const status = getAttendanceStatus();
    resultStatus.innerText = status;
    resultStatus.style.color = status === "Đến muộn" ? "var(--danger)" : "var(--success)";
}

function getAttendanceStatus() {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    let isLate = false;
    if (h < 12) { if (h > 8 || (h === 8 && m > 0)) isLate = true; }
    else { if (h > 13 || (h === 13 && m > 0)) isLate = true; }
    return isLate ? "Đến muộn" : "Đến sớm";
}

function resetAnalysisUI() {
    resultGender.innerText = "-";
    resultStatus.innerText = "-";
    resultRole.innerText = "-";
    resultRole.className = "badge-role";
}

async function showFacePreview(videoSource, box) {
    const canvas = document.createElement('canvas');
    canvas.width = 112; canvas.height = 112;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoSource, box.x, box.y, box.width, box.height, 0, 0, 112, 112);
    facePreview.innerHTML = "";
    facePreview.appendChild(canvas);
}

let lastSpokenTime = 0;
function speak(status) {
    if (Date.now() - lastSpokenTime < 5000) return;
    window.speechSynthesis.cancel();
    const msg = new SpeechSynthesisUtterance();
    msg.lang = 'vi-VN';

    if (status === 'success') msg.text = "Điểm danh thành công";
    else if (status === 'fail') msg.text = "Điểm danh thất bại";
    else if (status === 'welcome') msg.text = "Xin chào giảng viên";

    window.speechSynthesis.speak(msg);
    lastSpokenTime = Date.now();
}

function doRecognition(descriptor) {
    if (!faceMatcher) return;
    const match = faceMatcher.findBestMatch(descriptor);
    if (match.label !== 'unknown' && match.distance < 0.6) {
        const person = labeledFaceDescriptors.find(d => d.label === match.label);

        // KIỂM TRA BẢO MẬT: Nếu là Sinh viên đăng nhập, chỉ cho phép điểm danh CHÍNH CHỦ
        if (currentUserRole === 'Sinh viên' && person.label !== currentUserName) {
            resultName.innerText = "SAI TÀI KHOẢN";
            resultName.style.color = "var(--danger)";
            resultRole.innerText = person.label;
            resultRole.className = "badge-role role-sv";

            // Thông báo lỗi nếu nỗ lực điểm danh hộ
            if (!lastCheckIn['security-alert'] || (Date.now() - lastCheckIn['security-alert'] > 5000)) {
                console.warn(`Cảnh báo: Tài khoản ${currentUserName} đang nỗ lực điểm danh bằng mặt của ${person.label}`);
                lastCheckIn['security-alert'] = Date.now();
            }
            return;
        }

        resultName.innerText = person.label;
        resultName.style.color = "";
        resultRole.innerText = person.role;
        resultRole.className = `badge-role ${person.role === 'Giảng viên' ? 'role-gv' : 'role-sv'}`;

        if (person.role === 'Giảng viên') {
            // Giảng viên không điểm danh, chỉ chào hỏi nhận diện
            if (!lastCheckIn[person.label] || (Date.now() - lastCheckIn[person.label] > 60000)) {
                speak('welcome');
                lastCheckIn[person.label] = Date.now();
            }
        } else {
            addAttendanceLog(person.label, person.student_id, person.role, resultStatus.innerText);
        }
    } else {
        resultName.innerText = "KHÔNG XÁC ĐỊNH";
        resultRole.innerText = "-";
        // Chỉ nói thất bại nếu có mặt người nhưng không khớp
        speak('fail');
    }
}

// --- LOGIC GIAO TIẾP VỚI SQL BACKEND ---

async function loadDataFromServer() {
    try {
        const response = await fetch('/api/students');
        if (!response.ok) throw new Error("Server chưa sẵn sàng");
        const data = await response.json();

        labeledFaceDescriptors = data.map(item => ({
            label: item.label,
            student_id: item.student_id,
            gender: item.gender,
            role: item.role,
            password: item.password,
            descriptors: item.descriptors.map(d => new Float32Array(d))
        }));

        updateFaceMatcher();
        renderDatabaseList();
        updateStats();
    } catch (err) {
        console.warn('Không tải được danh sách sinh viên. Có thể server chưa chạy.');
    }
}

async function loadAttendanceFromServer() {
    try {
        const response = await fetch('/api/attendance');
        if (!response.ok) return;
        const data = await response.json();
        logData = data.map(l => ({
            name: l.student_name,
            student_id: l.student_id,
            role: l.role,
            time: l.time,
            date: l.date,
            subject: l.subject,
            period: l.period,
            status: l.status
        }));
        renderAttendanceLogs();
        renderGradingTable();
        updateStats();
    } catch (err) {
        console.warn('Chưa có dữ liệu chuyên cần hoặc server lỗi.');
    }
}

async function saveStudentToServer(name, student_id, gender, role, descriptor) {
    const plainDescriptor = descriptor ? Array.from(descriptor) : null;

    // Tìm sinh viên cũ dựa trên MSV (Student ID)
    let existing = labeledFaceDescriptors.find(d => d.student_id === student_id);
    let descriptorsToSave = [];

    if (existing) {
        // Lấy lại danh sách mẫu mặt cũ đã lưu
        descriptorsToSave = existing.descriptors.map(d => Array.from(d));
    }

    // Nếu bạn vừa nạp thêm một ảnh mới (descriptor ko null), hãy thêm nó vào bộ nhớ
    if (plainDescriptor) {
        // Giới hạn ví dụ mỗi sinh viên chỉ lưu tối đa 5 mẫu mặt cho nhẹ database
        if (descriptorsToSave.length >= 5) descriptorsToSave.shift(); // Gỡ mẫu cũ nhất
        descriptorsToSave.push(plainDescriptor);
    }

    // Kiểm tra an toàn: Nếu cả cũ cả mới đều ko có mặt
    if (descriptorsToSave.length === 0) {
        alert("Chưa có bất kỳ mẫu khuôn mặt nào cho hồ sơ này!");
        return;
    }

    try {
        const response = await fetch('/api/students', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, student_id, gender, role, descriptors: descriptorsToSave })
        });

        if (response.ok) {
            await loadDataFromServer();
            return true; // Trả về true để phía gọi biết đã thành công
        }
    } catch (err) {
        console.error(err);
        return false;
    }
    return false;
}

const PTIT_PERIODS = {
    "Ca 1": { start: "07:00", end: "09:15" },
    "Ca 2": { start: "09:25", end: "11:40" },
    "Ca 3": { start: "12:20", end: "14:35" },
    "Ca 4": { start: "14:45", end: "17:00" },
    "Ca 5": { start: "18:00", end: "20:15" }
};

function getAttendanceStatus(selectedPeriod) {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const period = PTIT_PERIODS[selectedPeriod];

    if (!period) return "Hợp lệ"; // Nếu chọn khác ca 1-5

    const [startH, startM] = period.start.split(':').map(Number);
    const [endH, endM] = period.end.split(':').map(Number);
    const startTime = startH * 60 + startM;
    const endTime = endH * 60 + endM;

    // Kiểm tra xem có đang trong khung giờ của Ca đó không
    if (currentTime < startTime - 15 || currentTime > endTime) {
        return "SAI CA HỌC";
    }

    // Nếu muộn quá 15 phút tính từ lúc bắt đầu ca
    if (currentTime > startTime + 15) {
        return "Đến muộn";
    }

    return "Đúng giờ";
}

let isProcessingAttendance = false;

async function addAttendanceLog(name, student_id, role, status) {
    if (isProcessingAttendance) return;

    // 1. Lấy Ca học và Môn học (Phòng hờ trường hợp NULL)
    const selectedPeriod = document.getElementById('select-period')?.value || "Ca 1";
    const subject = document.getElementById('select-subject')?.value || "Môn học";
    const safeStudentId = student_id || "B21DVCN104"; // Mặc định nếu chưa có mã
    const date = new Date().toLocaleDateString('vi-VN');

    // 2. Kiểm tra Ca học PTIT
    let finalStatus = status; // Mặc định dùng từ UI
    if (role === 'Sinh viên') {
        const ptitStatus = getAttendanceStatus(selectedPeriod);
        if (ptitStatus === "SAI CA HỌC") {
            resultName.innerText = "SAI CA HỌC";
            resultName.style.color = "var(--danger)";
            return;
        }
        finalStatus = ptitStatus; // Ghi đè trạng thái dựa trên giờ thực tế
    }

    // 3. Kiểm tra trùng lặp (1 lần / ngày / môn / ca)
    const alreadyDone = logData.find(l => (l.student_id === safeStudentId) && l.subject === subject && l.date === date && l.period === selectedPeriod);

    if (alreadyDone) {
        resultName.innerText = "ĐÃ ĐIỂM DANH";
        resultName.style.color = "var(--primary)";
        return;
    }

    isProcessingAttendance = true;
    const time = new Date().toLocaleTimeString('vi-VN');

    try {
        const response = await fetch('/api/attendance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                student_id: safeStudentId,
                role,
                time,
                date,
                subject,
                period: selectedPeriod,
                status: finalStatus
            })
        });

        if (response.ok) {
            // PHẢN HỒI TỨC THÌ
            resultName.innerText = "THÀNH CÔNG";
            resultName.style.color = "var(--success)";
            showToast(`Điểm danh thành công: ${name}`, 'success');
            speak('success');

            // Tải lại dữ liệu ngầm (không bắt người dùng chờ)
            loadAttendanceFromServer();
        } else {
            const errData = await response.json();
            resultName.innerText = errData.message || "THẤT BẠI";
            resultName.style.color = "var(--danger)";
            showToast(errData.message || 'Điểm danh thất bại!', 'error');
            speak('error');
        }
    } catch (err) {
        console.error('Error logging attendance:', err);
        resultName.innerText = "LỖI KẾT NỐI";
        resultName.style.color = "var(--danger)";
    } finally {
        isProcessingAttendance = false;
    }
}

async function deleteStudentFromServer(name) {
    if (!confirm(`Xóa sinh viên ${name}?`)) return;

    try {
        const response = await fetch(`/api/students/${encodeURIComponent(name)}`, {
            method: 'DELETE'
        });
        if (response.ok) {
            await loadDataFromServer();
        }
    } catch (err) {
        alert('Lỗi khi xóa!');
    }
}

async function clearAllData() {
    if (!confirm("Xóa toàn bộ dữ liệu trong SQL?")) return;

    try {
        const response = await fetch('/api/clear-all', { method: 'DELETE' });
        if (response.ok) {
            labeledFaceDescriptors = [];
            logData = [];
            faceMatcher = null;
            renderDatabaseList();
            renderAttendanceLogs();
            updateStats();
        }
    } catch (err) {
        alert('Lỗi khi dọn dẹp!');
    }
}

// --- RENDERING & UTILS ---

// Thông báo Toast
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = (type === 'success' ? '✅ ' : '❌ ') + message;

    container.appendChild(toast);

    // Tự động xóa sau 3 giây
    setTimeout(() => {
        toast.classList.add('toast-out');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function updateFaceMatcher() {
    if (labeledFaceDescriptors.length > 0) {
        const descs = labeledFaceDescriptors.map(item => new faceapi.LabeledFaceDescriptors(item.label, item.descriptors));
        faceMatcher = new faceapi.FaceMatcher(descs, 0.6);
    } else {
        faceMatcher = null;
    }
}

function renderAttendanceLogs() {
    // 1. SECURITY FILTER: Sinh viên chỉ thấy log của chính mình
    let filteredLogs = logData;
    if (currentUserRole === 'Sinh viên' && currentStudentId) {
        filteredLogs = logData.filter(log => log.student_id === currentStudentId);
    }

    // 2. DAY RESET FILTER: Chỉ hiện các bản ghi của NGÀY HÔM NAY trên thanh Giám sát/Dashboard
    const today = new Date().toLocaleDateString('vi-VN');
    const todayLogs = filteredLogs.filter(log => log.date === today);

    // Chỉ hiện 15 bản ghi mới nhất của ngày hôm nay ở tab giám sát
    const shortList = todayLogs.slice(0, 15);
    logShort.innerHTML = shortList.map(log => `
        <tr>
            <td><strong>${log.name}</strong></td>
            <td><span class="badge-role ${log.role === 'Giảng viên' ? 'role-gv' : 'role-sv'}">${log.role}</span></td>
            <td>${log.time}</td>
        </tr>
    `).join('');

    // Báo cáo đầy đủ vẫn giữ nguyên lịch sử để tra cứu
    logFull.innerHTML = filteredLogs.map(log => `
        <tr>
            <td>${log.date} ${log.time}</td>
            <td>${log.period || '-'}</td>
            <td><strong>${log.name}</strong></td>
            <td>${log.role}</td>
            <td>${log.subject}</td>
            <td style="color: ${log.status === 'Đến muộn' ? 'var(--danger)' : 'var(--success)'}">${log.status}</td>
        </tr>
    `).join('');
}

function renderDatabaseList() {
    // SECURITY FILTER: Ẩn danh sách nếu là sinh viên
    if (currentUserRole === 'Sinh viên') {
        document.getElementById('tab-database').style.display = 'none';
        return;
    }

    dbListBody.innerHTML = labeledFaceDescriptors.map((item, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>
                <strong>${item.label}</strong><br>
                <small style="color: #666">${item.student_id || 'Chưa có mã'}</small>
            </td>
            <td>${item.gender || '-'}</td>
            <td><span class="badge-role ${item.role === 'Giảng viên' ? 'role-gv' : 'role-sv'}">${item.role}</span></td>
            <td>${item.descriptors.length} mẫu</td>
            <td>
                <button class="btn btn-primary btn-sm" onclick="editStudent('${item.student_id}')">Sửa</button>
                <button class="btn btn-danger btn-sm" onclick="deleteStudentFromServer('${item.label}')">Xóa</button>
            </td>
        </tr>
    `).join('');
}

window.editStudent = function (studentId) {
    const student = labeledFaceDescriptors.find(s => s.student_id === studentId);
    if (!student) return;

    // Điền dữ liệu vào Modal
    inputName.value = student.label;
    inputStudentId.value = student.student_id;
    selectGender.value = student.gender || 'Nam';
    selectRole.value = student.role;

    // Reset phần ảnh thẻ (người dùng sẽ nạp ảnh mới nếu muốn đổi mặt)
    idPhotoDisplay.innerHTML = `<span class="upload-hint">SỬA HỒ SƠ SINH VIÊN: ${student.label}</span>`;
    modal.querySelector('h2').innerText = 'SỬA HỒ SƠ SINH VIÊN';
    fileDescriptor = null;

    // Hiển thị modal
    modal.style.display = 'flex';
};

function renderGradingTable() {
    if (!gradingListBody) return;

    // 1. Xác định tổng số buổi học đã diễn ra cho từng môn (theo Ngày + Ca học)
    const sessionsStats = {};
    logData.forEach(l => {
        const key = `${l.subject}|${l.period}`;
        if (!sessionsStats[key]) sessionsStats[key] = new Set();
        sessionsStats[key].add(l.date);
    });

    const totalSessions = {};
    for (let key in sessionsStats) {
        totalSessions[key] = sessionsStats[key].size;
    }

    // 2. Lấy danh sách sinh viên
    let allStudents = labeledFaceDescriptors.filter(d => d.role === 'Sinh viên');

    // SECURITY FILTER: Nếu là sinh viên, chỉ lấy profile của chính mình
    if (currentUserRole === 'Sinh viên' && currentStudentId) {
        allStudents = allStudents.filter(s => s.student_id === currentStudentId);
    }

    const summary = [];

    // Gom danh sách các cặp (Môn học|Ca học) đã từng diễn ra
    const activeSessions = Object.keys(totalSessions);

    // 3. Tính toán độc quyền (Exclusive)
    allStudents.forEach(stu => {
        activeSessions.forEach(sessionKey => {
            const [sub, period] = sessionKey.split('|');
            // Lọc log của sinh viên cụ thể này
            const stuLogs = logData.filter(l => (l.student_id === stu.student_id) && l.subject === sub && l.period === period);

            // XỬ LÝ ĐỘC QUYỀN: 1 trong 3 trạng thái
            const onTimeCount = stuLogs.filter(l => l.status === 'Đúng giờ').length;
            const lateCount = stuLogs.filter(l => l.status === 'Đến muộn').length;
            const totalTaught = totalSessions[sessionKey];
            const absentCount = totalTaught - (onTimeCount + lateCount);

            // Công thức PTIT: 10 - (Vắng * 2) - (Muộn * 0.5)
            let score = 10 - (absentCount * 2) - (lateCount * 0.5);
            if (score < 0) score = 0;

            summary.push({
                name: stu.label,
                subject: `${sub} (${period})`,
                onTime: onTimeCount,
                late: lateCount,
                absent: absentCount,
                total: totalTaught,
                score: score
            });
        });
    });

    gradingListBody.innerHTML = summary.map(s => `
        <tr>
            <td><strong>${s.name}</strong></td>
            <td>${s.subject}</td>
            <td><span class="badge-role" style="background:#2ec4b6; color:white">${s.onTime}/${s.total}</span></td>
            <td><span class="badge-role" style="background:${s.late > 0 ? '#f59e0b' : '#ccc'}; color:white">${s.late}</span></td>
            <td><span class="badge-role" style="background:${s.absent > 0 ? '#ef4444' : '#ccc'}; color:white">${s.absent}</span></td>
            <td><strong style="color:var(--ptit-red); font-size: 1.1em">${s.score.toFixed(1)}</strong></td>
        </tr>
    `).join('');

    if (summary.length === 0) {
        gradingListBody.innerHTML = `<tr><td colspan="6" style="text-align:center">Chưa có dữ liệu học tập</td></tr>`;
    }
}

function updateStats() {
    // Nếu là sinh viên, stats sẽ theo cá nhân
    let currentLogs = logData;
    if (currentUserRole === 'Sinh viên' && currentStudentId) {
        currentLogs = logData.filter(l => l.student_id === currentStudentId);
    }

    // 1. Tổng số sinh viên có trong hệ thống
    const studentList = labeledFaceDescriptors.filter(d => d.role === 'Sinh viên');
    statTotal.innerText = studentList.length;

    // 2. Lọc danh sách điểm danh hôm nay
    const today = new Date().toLocaleDateString('vi-VN');
    const todayLogs = currentLogs.filter(l => l.date === today && l.role === 'Sinh viên');

    // Đếm số lượng sinh viên duy nhất đã hiện diện trong ngày hôm nay
    const uniquePresent = new Set(todayLogs.map(l => l.student_id)).size;

    // Đếm tổng số lần bị ghi nhận là muộn trong ngày
    const totalLate = todayLogs.filter(l => l.status === "Đến muộn").length;

    // 3. Cập nhật giao diện (Top bar)
    if (statPresent) statPresent.innerText = uniquePresent;
    if (statLate) statLate.innerText = totalLate;

    // 4. Cập nhật Sidebar (nếu có)
    const sidebarPresent = document.getElementById('sidebar-stat-present');
    const sidebarLate = document.getElementById('sidebar-stat-late');
    if (sidebarPresent) sidebarPresent.innerText = uniquePresent;
    if (sidebarLate) sidebarLate.innerText = totalLate;
}

// --- EVENT LISTENERS ---

btnToggle.addEventListener('click', () => {
    isRecognitionMode = !isRecognitionMode;
    btnToggle.innerText = isRecognitionMode ? "CHẾ ĐỘ: ĐIỂM DANH" : "CHẾ ĐỘ: THÊM MỚI";
    btnToggle.classList.toggle('btn-primary');
    btnToggle.classList.toggle('btn-success');
});

btnAdd.addEventListener('click', () => {
    modal.querySelector('h2').innerText = 'THÊM HỒ SƠ SINH VIÊN';
    modal.style.display = 'flex';
});
const btnAddStudentDirect = document.getElementById('btn-add-student');
if (btnAddStudentDirect) btnAddStudentDirect.addEventListener('click', () => {
    modal.querySelector('h2').innerText = 'THÊM HỒ SƠ SINH VIÊN';
    modal.style.display = 'flex';
});
btnCancel.addEventListener('click', () => modal.style.display = 'none');

// Xử lý tải ảnh thẻ và lấy mẫu khuôn mặt
let fileDescriptor = null;

if (inputFileId) {
    inputFileId.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Reset descriptor cũ
        fileDescriptor = null;

        // 1. Hiển thị preview ngay lập tức
        const reader = new FileReader();
        reader.onload = (event) => {
            idPhotoDisplay.innerHTML = `<img src="${event.target.result}" style="width:100%; height:100%; object-fit:cover;" alt="Preview">`;
            // Thêm loader overlay sau khi đã vẽ ảnh
            const loaderDiv = document.createElement('div');
            loaderDiv.className = 'loader-overlay';
            loaderDiv.id = 'photo-ai-loader';
            loaderDiv.style.background = 'rgba(255,255,255,0.7)';
            loaderDiv.innerHTML = '<div class="spinner-sm"></div><p style="font-size:10px; color:#333; margin-top:5px">AI đang quét...</p>';
            idPhotoDisplay.appendChild(loaderDiv);
        };
        reader.readAsDataURL(file);

        // 2. Xử lý AI lấy Descriptor
        try {
            const img = await faceapi.bufferToImage(file);

            // Thử bằng SSD MobileNet trước (chính xác hơn)
            let detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();

            // Nếu SSD không tìm thấy, thử bằng Tiny Face Detector (nhanh và linh hoạt hơn)
            if (!detection) {
                console.log("SSD failed, trying TinyFaceDetector...");
                detection = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();
            }

            // Xóa loader sau khi quét xong
            const existingLoader = document.getElementById('photo-ai-loader');
            if (existingLoader) existingLoader.remove();

            if (detection) {
                fileDescriptor = detection.descriptor;
                const successMsg = document.createElement('div');
                successMsg.style.cssText = "position:absolute; bottom:0; left:0; width:100%; background:rgba(46,196,182,0.9); color:white; font-size:10px; padding:2px; text-align:center";
                successMsg.innerText = "✓ Đã lấy mẫu mặt";
                idPhotoDisplay.appendChild(successMsg);
                console.log("Face found in photo!");
            } else {
                alert("Không tìm thấy khuôn mặt trong ảnh! Vui lòng chọn ảnh khác rõ nét, chính diện và không bị che khuất.");
                idPhotoDisplay.innerHTML = `<span class="upload-hint" style="color:var(--danger)">Lỗi nhận diện</span>`;
                fileDescriptor = null;
            }
        } catch (err) {
            const existingLoader = document.getElementById('photo-ai-loader');
            if (existingLoader) existingLoader.remove();
            console.error("AI Photo Error:", err);
            alert("Lỗi khi xử lý ảnh! Hệ thống chưa sẵn sàng hoặc file không đúng định dạng.");
            fileDescriptor = null;
        }
    });
}

btnSave.addEventListener('click', async () => {
    const name = inputName.value.trim();
    const studentId = inputStudentId.value.trim();
    const gender = selectGender.value;
    const role = selectRole.value;

    // Tìm xem sinh viên này đã có trong máy chủ chưa dựa trên Mã SV
    const existing = labeledFaceDescriptors.find(s => s.student_id === studentId);

    // Ưu tiên dùng ảnh thẻ mới nạp, nếu không có thì lấy mẫu khuôn mặt cũ đã có
    const descriptorToUse = fileDescriptor || (existing && existing.descriptors.length > 0 ? existing.descriptors[0] : null);

    if (name && studentId && descriptorToUse) {
        // Gọi hàm lưu và kiểm tra kết quả
        const success = await saveStudentToServer(name, studentId, gender, role, fileDescriptor || (existing ? null : null));

        if (success) {
            alert(`Đã cập nhật hồ sơ: ${name} thành công!`);
            modal.style.display = 'none';
            inputName.value = "";
            inputStudentId.value = "";
            fileDescriptor = null;
            idPhotoDisplay.innerHTML = `<span class="upload-hint">Chưa có ảnh thẻ</span>`;
        } else {
            alert('Lỗi khi lưu hồ sơ. Vui lòng kiểm tra lại kết nối!');
        }
    } else {
        if (!descriptorToUse) {
            alert("Vui lòng tải ảnh thẻ sinh viên!");
        } else if (!name || !studentId) {
            alert("Vui lòng nhập đầy đủ Mã sinh viên và Họ tên!");
        }
    }
});

btnClearAll.addEventListener('click', clearAllData);
if (btnRefreshGrading) btnRefreshGrading.addEventListener('click', loadAttendanceFromServer);

// Lưu môn học vào localStorage khi thay đổi
selectSubject.addEventListener('change', () => {
    localStorage.setItem('currentSubject', selectSubject.value);
});

// --- DEMO CLOUD LOGIN & ROLE SYSTEM ---
let currentUserRole = null;
let currentUserName = null;
let currentStudentId = null;
let otpTimerInterval = null;

// Hàm đếm ngược OTP
function startOTPCountdown(durationInSeconds) {
    if (otpTimerInterval) clearInterval(otpTimerInterval);
    
    let timer = durationInSeconds;
    const timerDisplay = document.getElementById('timer-val');
    
    otpTimerInterval = setInterval(() => {
        const minutes = Math.floor(timer / 60);
        const seconds = timer % 60;
        
        if (timerDisplay) {
            timerDisplay.textContent = `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
        }
        
        if (--timer < 0) {
            clearInterval(otpTimerInterval);
            if (timerDisplay) timerDisplay.textContent = "HẾT HẠN";
            showToast("Mã OTP của bạn đã hết hạn!", "error");
        }
    }, 1000);
}

// Hiển thị form đăng nhập chính
window.showMainLogin = function () {
    document.getElementById('login-main').style.display = 'block';
    document.getElementById('login-student').style.display = 'none';
    document.getElementById('login-teacher').style.display = 'none';
};

// Hiển thị form đăng nhập sinh viên
window.showStudentLogin = function () {
    document.getElementById('login-main').style.display = 'none';
    document.getElementById('login-student').style.display = 'block';
    document.getElementById('login-teacher').style.display = 'none';
};

// Hiển thị form đăng nhập giảng viên
window.showTeacherLogin = function () {
    document.getElementById('login-main').style.display = 'none';
    document.getElementById('login-student').style.display = 'none';
    document.getElementById('login-teacher').style.display = 'block';
};

// Điểm danh nhanh - không cần đăng nhập
window.quickAttend = function () {
    currentUserRole = 'Khách';
    currentUserName = 'Điểm danh nhanh';
    loginAs('Khách');
};

// Đăng nhập sinh viên
window.loginStudent = function (event) {
    event.preventDefault();
    const studentId = document.getElementById('student-id').value;
    const password = document.getElementById('student-password').value;

    // 1. Kiểm tra xem studentId có tồn tại trong dữ liệu hệ thống không
    const studentEntry = labeledFaceDescriptors.find(s => s.student_id === studentId);

    if (!studentEntry) {
        alert('Mã sinh viên này chưa có trong hồ sơ hệ thống!');
        return;
    }

    // 2. Kiểm tra mật khẩu (Sử dụng mật khẩu thực từ Database)
    const validPassword = studentEntry.password || studentId || '123456';
    if (password === validPassword) {
        currentUserName = studentEntry.label;
        currentStudentId = studentId;
        loginAs('Sinh viên', studentEntry.label);
    } else {
        alert('Mật khẩu không đúng!');
    }
};

// Chức năng Quên mật khẩu
window.forgotPassword = function () {
    const studentIdInput = document.getElementById('student-id').value.trim();

    if (!studentIdInput) {
        alert("Vui lòng nhập Mã sinh viên để nhận lại mật khẩu!");
        document.getElementById('student-id').focus();
        return;
    }

    // 1. Tìm thông tin sinh viên trong bộ nhớ để lấy Họ tên
    const studentEntry = labeledFaceDescriptors.find(s => s.student_id === studentIdInput);

    let studentEmail = "";
    if (studentEntry && studentEntry.label) {
        // Cấu trúc PTIT: Tên + Chữ cái đầu của Họ và Đệm + . + MSV
        // Ví dụ: Nguyễn Thị Ly -> lynt.B21DVCN104@student.ptit.edu.vn
        const fullName = studentEntry.label.trim().toLowerCase();
        const parts = fullName.split(/\s+/);

        if (parts.length >= 2) {
            const firstName = removeVietnameseTones(parts.pop()); // Lấy tên chính và bỏ dấu
            const initials = parts.map(p => removeVietnameseTones(p.charAt(0))).join(''); // Lấy chữ cái đầu và bỏ dấu
            studentEmail = `${firstName}${initials}.${studentIdInput.toLowerCase()}@stu.ptit.edu.vn`;
        } else {
            // Trường hợp tên chỉ có 1 từ
            studentEmail = `${removeVietnameseTones(parts[0])}.${studentIdInput.toLowerCase()}@stu.ptit.edu.vn`;
        }
    } else {
        // Nếu không tìm thấy MSV này trong database (chưa đăng ký khuôn mặt)
        alert(`Mã sinh viên ${studentIdInput} chưa có trong hệ thống dữ liệu. Vui lòng liên hệ Admin để đăng ký hồ sơ.`);
        return;
    }

    const confirmSend = confirm(`Hệ thống sẽ gửi mã xác nhận đến email học viện của bạn:\n${studentEmail}\n\nBạn có muốn tiếp tục?`);

    if (confirmSend) {
        const btn = document.getElementById('btn-forgot-password');
        const oldText = btn.innerText;
        btn.innerText = "Đang gửi mail...";
        btn.style.pointerEvents = "none";
        btn.style.opacity = "0.7";

        // Gửi yêu cầu thật lên server
        fetch('/api/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: studentEmail,
                studentName: studentEntry.label,
                studentId: studentIdInput
            })
        })
            .then(async response => {
                const data = await response.json();
                if (response.ok) {
                    // Hiện giao diện OTP và bắt đầu đếm ngược
                    document.getElementById('otp-overlay').style.display = 'flex';
                    document.getElementById('otp-hint').innerText = `Mã xác thực đã được gửi đến: ${studentEmail}`;
                    
                    // Bắt đầu đếm ngược 15 phút (900 giây)
                    startOTPCountdown(900);

                    // Xóa dữ liệu cũ trong các ô OTP
                    const boxes = document.querySelectorAll('.otp-box');
                    boxes.forEach(box => box.value = "");
                    if (boxes[0]) boxes[0].focus();

                    showToast(`Đã gửi mã OTP đến ${studentIdInput}`, 'success');
                } else {
                    alert(`Lỗi: ${data.message || 'Không thể gửi email'}`);
                }
            })
            .catch(err => {
                console.error("Mail API Error:", err);
                alert("Lỗi kết nối máy chủ! Hãy đảm bảo Server đang chạy.");
            })
            .finally(() => {
                btn.innerText = oldText;
                btn.style.pointerEvents = "auto";
                btn.style.opacity = "1";
            });
    }
};

// Hàm đóng giao diện OTP
window.closeOTP = function () {
    document.getElementById('otp-overlay').style.display = 'none';
    if (otpTimerInterval) clearInterval(otpTimerInterval);
};

// Xử lý sự kiện cho các ô nhập OTP (tự động nhảy ô)
document.addEventListener('DOMContentLoaded', () => {
    const boxes = document.querySelectorAll('.otp-box');
    boxes.forEach((box, index) => {
        box.addEventListener('input', (e) => {
            if (e.target.value.length === 1 && index < boxes.length - 1) {
                boxes[index + 1].focus();
            }
        });

        box.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && e.target.value === '' && index > 0) {
                boxes[index - 1].focus();
            }
        });
    });
});

// Hàm xác thực OTP
window.verifyOTP = function () {
    const studentId = document.getElementById('student-id').value.trim();
    const btn = document.getElementById('btn-verify-otp');

    // Gom mã từ 6 ô
    const boxes = document.querySelectorAll('.otp-box');
    let otp = "";
    boxes.forEach(box => otp += box.value);

    if (otp.length !== 6) {
        alert("Vui lòng nhập đủ 6 số mã OTP!");
        return;
    }

    btn.innerText = "Đang kiểm tra...";
    btn.disabled = true;

    fetch('/api/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, otp })
    })
        .then(async response => {
            const data = await response.json();
            if (response.ok) {
                alert(`Xác thực thành công!\nMật khẩu tạm thời của bạn là: ${data.tempPassword}\n(Hệ thống khuyên bạn nên đổi mật khẩu sau khi đăng nhập)`);

                // Tự động điền mật khẩu mới vào ô đăng nhập
                const passwordInput = document.getElementById('student-password');
                if (passwordInput) {
                    passwordInput.value = data.tempPassword;
                    passwordInput.setAttribute('type', 'text'); // Hiển thị rõ mật khẩu mới khôi phục
                }

                closeOTP();
                if (otpTimerInterval) clearInterval(otpTimerInterval);
                showToast("Đã khôi phục mật khẩu thành công!", "success");
            } else {
                alert(data.message || "Mã OTP không đúng!");
            }
        })
        .catch(err => {
            console.error("OTP Verify Error:", err);
            alert("Lỗi kết nối máy chủ!");
        })
        .finally(() => {
            btn.innerText = "XÁC NHẬN MÃ";
            btn.disabled = false;
        });
};

// Đăng nhập giảng viên
window.loginTeacher = function (event) {
    event.preventDefault();
    const username = document.getElementById('teacher-username').value;
    const password = document.getElementById('teacher-password').value;

    // Demo: tài khoản mặc định
    if ((username === 'admin' && password === 'admin') ||
        (username === 'gv' && password === '123456') ||
        password === 'ptit2026') {
        currentStudentId = username.toUpperCase();
        loginAs('Giảng viên', "TS. Nguyễn Công Sơn");
    } else {
        alert('Tên đăng nhập hoặc mật khẩu không đúng!');
    }
};

// Đăng xuất
window.logout = function () {
    if (confirm('Bạn có chắc muốn đăng xuất khỏi hệ thống?')) {
        // Tắt camera trước khi đăng xuất
        stopVideo();

        // Reset trạng thái
        currentUserRole = null;
        currentUserName = null;

        // Reload trang
        location.reload();
    }
};

window.loginAs = function (role, username) {
    currentUserRole = role;
    currentUserName = username || (role === 'Giảng viên' ? "Nguyễn Công Sơn" : "Khách");

    // Đóng màn hình đăng nhập, hiện màn hình chính
    const loginOverlay = document.getElementById('login-overlay');
    const appContainer = document.querySelector('.app-container');
    if (loginOverlay) loginOverlay.style.display = 'none';
    if (appContainer) appContainer.style.display = 'flex';

    console.log(`Đăng nhập thành công: ${role}, Tài khoản: ${currentUserName}`);

    // Cập nhật thông tin Header
    const userAvatar = document.getElementById('user-avatar');
    const userNameElement = document.getElementById('user-name');
    const userRoleDisplay = document.getElementById('user-role-display');
    const dropName = document.getElementById('drop-name');
    const dropId = document.getElementById('drop-id');

    if (role === 'Khách') {
        if (userAvatar) userAvatar.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M15 8v8H5V8h10m1-2H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4V7c0-.55-.45-1-1-1z"/></svg>';
        if (userNameElement) userNameElement.textContent = 'Chế độ nhanh';
        if (userRoleDisplay) userRoleDisplay.textContent = 'Điểm danh Camera';
        if (dropName) dropName.textContent = 'Khách';
        if (dropId) dropId.textContent = '-';
    } else {
        if (userAvatar) userAvatar.textContent = (role === 'Sinh viên' ? 'SV' : 'GV');
        if (userNameElement) userNameElement.textContent = currentUserName;
        if (userRoleDisplay) userRoleDisplay.textContent = (role === 'Sinh viên' ? 'Sinh viên PTIT' : 'Quản trị viên');
        if (dropName) dropName.textContent = currentUserName;
        if (dropId) dropId.textContent = (role === 'Sinh viên' ? currentStudentId : (currentStudentId || "GV001"));
    }

    // 1. XỬ LÝ PHÂN QUYỀN MENU
    const navItems = document.querySelectorAll('.nav-item');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const logCard = document.querySelector('.log-card');
    const btnAdd = document.getElementById('btn-add');

    if (role === 'Khách') {
        navItems.forEach(item => {
            item.style.display = (item.dataset.tab === 'tab-monitor') ? 'flex' : 'none';
        });
        if (window.switchTab) window.switchTab('tab-monitor');
    }
    else if (role === 'Sinh viên') {
        navItems.forEach(item => {
            const tab = item.dataset.tab;
            item.style.display = (tab === 'tab-database' || tab === 'tab-grading') ? 'none' : 'flex';
        });
        tabBtns.forEach(btn => {
            const tab = btn.dataset.tab;
            btn.style.display = (tab === 'tab-database' || tab === 'tab-grading') ? 'none' : 'inline-block';
        });
        if (logCard) logCard.style.display = 'none';
        if (btnAdd) btnAdd.style.display = 'none';
        setTimeout(() => { if (window.switchTab) window.switchTab('tab-monitor'); }, 100);
    }
    else {
        navItems.forEach(item => item.style.display = 'flex');
        tabBtns.forEach(btn => btn.style.display = 'inline-block');
        if (logCard) logCard.style.display = '';
        if (btnAdd) btnAdd.style.display = '';
        setTimeout(() => { if (window.switchTab) window.switchTab('tab-database'); }, 100);
    }

    // 2. CẬP NHẬT TRANG CÁ NHÂN
    const elName = document.getElementById('prof-name');
    const elIdText = document.getElementById('prof-id-text');
    const elIdVal = document.getElementById('prof-id-val');
    const elAvatar = document.getElementById('prof-avatar-img');
    const elEmail = document.getElementById('prof-email-val');

    // Đổi label "MSV" / "Mã GV" tùy vai trò
    const elIdLabel = document.getElementById('prof-id-label');

    if (role === 'Sinh viên') {
        if (elIdLabel) elIdLabel.innerText = '🆔 MSV:';
        const student = labeledFaceDescriptors.find(s => s.label === currentUserName);
        if (student) {
            if (elName) elName.innerText = student.label;
            if (elIdText) elIdText.innerText = `Sinh viên @${student.student_id.toUpperCase()}`;
            if (elIdVal) elIdVal.innerText = student.student_id;

            // Tính toán mô phỏng GPA và Tín chỉ dựa trên Mã Sinh Viên (để giữ cố định cho mỗi ng)
            const hash = student.student_id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
            const gpa = (2.8 + (hash % 12) / 10).toFixed(2); // Ranom từ 2.8 đến 3.9
            const credits = 90 + (hash % 60); // Random từ 90 đến 149

            // Tính toán tỷ lệ Chuyên cần thực tế từ CSDL điểm danh
            let attendanceRate = 100;
            if (typeof logData !== 'undefined') {
                const myLogs = logData.filter(log => log.name === student.label);
                if (myLogs.length > 0) {
                    const onTimeLogs = myLogs.filter(log => log.status.toLowerCase() === 'đúng giờ').length;
                    attendanceRate = Math.round((onTimeLogs / myLogs.length) * 100);
                } else {
                    // Chưa điểm danh buổi nào
                    attendanceRate = 0;
                }
            }

            if (document.getElementById('prof-stat-1')) {
                document.getElementById('prof-stat-1').innerText = gpa;
                document.getElementById('prof-stat-label-1').innerText = "GPA";
                document.getElementById('prof-stat-2').innerText = `${credits}/150`;
                document.getElementById('prof-stat-label-2').innerText = "Tín chỉ";
                document.getElementById('prof-stat-3').innerText = `${attendanceRate}%`;
                document.getElementById('prof-stat-label-3').innerText = "Chuyên cần";
            }
            if (elAvatar) elAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(student.label)}&background=b5272d&color=fff&size=200`;
            if (elEmail) {
                // Tạo email chuẩn PTIT: Tên + Chữ cái đầu (Họ, đệm) . MSV @stu.ptit.edu.vn
                const fullName = student.label.trim().toLowerCase();
                const parts = fullName.split(/\s+/);
                let emailPrefix = "";
                if (parts.length >= 2) {
                    const firstName = removeVietnameseTones(parts.pop());
                    const initials = parts.map(p => removeVietnameseTones(p.charAt(0))).join('');
                    emailPrefix = `${firstName}${initials}`;
                } else {
                    emailPrefix = removeVietnameseTones(parts[0]);
                }
                elEmail.innerText = `${emailPrefix}.${student.student_id.toLowerCase()}@stu.ptit.edu.vn`;
            }
        }
    }
    else if (role === 'Giảng viên') {
        if (elIdLabel) elIdLabel.innerText = '🆔 MGV:';
        if (elName) elName.innerText = "TS. Nguyễn Công Sơn";
        if (elIdText) elIdText.innerText = "Giảng viên - Faculty of IT";
        if (elIdVal) elIdVal.innerText = "GV001";
        if (document.getElementById('prof-stat-1')) {
            document.getElementById('prof-stat-1').innerText = "12";
            document.getElementById('prof-stat-label-1').innerText = "Môn dạy";
            document.getElementById('prof-stat-2').innerText = "450";
            document.getElementById('prof-stat-label-2').innerText = "Sinh viên";
            document.getElementById('prof-stat-3').innerText = "15";
            document.getElementById('prof-stat-label-3').innerText = "Lớp học";
        }
        if (elAvatar) elAvatar.src = `https://ui-avatars.com/api/?name=Nguyen+Son&background=1a365d&color=fff&size=200`;
        if (elEmail) elEmail.innerText = "sonnc@ptit.edu.vn";
    }

    // 3. HIỂN THỊ BẠN CÙNG LỚP (Chỉ dành cho Sinh viên)
    const friendsCard = document.getElementById('prof-friends-card');
    if (role === 'Sinh viên') {
        if (friendsCard) friendsCard.style.display = 'block';
        const friendsList = document.getElementById('prof-friends-list');
        if (friendsList && typeof labeledFaceDescriptors !== 'undefined') {
            const classmates = labeledFaceDescriptors.filter(s => s.label !== currentUserName).slice(0, 4);
            if (classmates.length > 0) {
                friendsList.innerHTML = classmates.map((friend, idx) => `
                    <div class="friend-item" style="display: flex; align-items: center; gap: 12px; margin-bottom: 15px; background: #fff; padding: 10px; border-radius: 10px; border: 1px solid #f1f5f9;">
                        <div style="width: 45px; height: 45px; border-radius: 50%; background: ${['#b5272d', '#1e293b', '#10b981', '#f59e0b'][idx % 4]}; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.9rem;">
                            ${friend.label.split(' ').pop().charAt(0)}
                        </div>
                        <div>
                            <p style="margin: 0; font-size: 0.95rem; font-weight: 600; color: #1e293b;">${friend.label}</p>
                            <small style="color: #64748b;">Bạn cùng lớp</small>
                        </div>
                    </div>
                `).join('');
            } else {
                friendsList.innerHTML = '<p style="color: #64748b; font-size: 0.85rem;">Bạn là người duy nhất trong lớp.</p>';
            }
        }

    } else {
        // Giảng viên / Khách: Ẩn phần bạn bè cùng lớp
        if (friendsCard) friendsCard.style.display = 'none';
    }

    // 4. KHÔI PHỤC DỮ LIỆU ĐÃ LƯU (Per-user persistence)
    const storageKey = `profile_${role}_${currentUserName}`;
    const savedData = JSON.parse(localStorage.getItem(storageKey) || '{}');
    const elHometownVal = document.getElementById('prof-hometown-val');
    const elGenderVal = document.getElementById('prof-gender-val');

    if (elHometownVal) {
        if (savedData.hometown) elHometownVal.innerText = savedData.hometown;
        document.getElementById('edit-hometown').value = elHometownVal.innerText;
    }
    if (elGenderVal) {
        if (savedData.gender) elGenderVal.innerText = savedData.gender;
        document.getElementById('edit-gender').value = elGenderVal.innerText === '-' ? 'Nam' : elGenderVal.innerText;
    }

    renderAttendanceLogs();
};

// CÁC HÀM XỬ LÝ CHỈNH SỬA HỒ SƠ SINH VIÊN
window.toggleEditProfile = function () {
    const editArea = document.getElementById('edit-profile-fields');
    const btn = document.getElementById('btn-edit-prof');
    if (editArea.style.display === 'none') {
        editArea.style.display = 'block';
        btn.innerText = 'Hủy bỏ';
    } else {
        editArea.style.display = 'none';
        btn.innerText = 'Chỉnh sửa';
    }
};

window.saveProfileInfo = function () {
    const hometown = document.getElementById('edit-hometown').value;
    const gender = document.getElementById('edit-gender').value;

    // Cập nhật lên giao diện
    const elHometownVal = document.getElementById('prof-hometown-val');
    const elGenderVal = document.getElementById('prof-gender-val');

    if (elHometownVal) elHometownVal.innerText = hometown;
    if (elGenderVal) elGenderVal.innerText = gender;

    // Lưu vào localStorage theo key duy nhất của user
    if (typeof currentUserRole !== 'undefined' && typeof currentUserName !== 'undefined') {
        const storageKey = `profile_${currentUserRole}_${currentUserName}`;
        localStorage.setItem(storageKey, JSON.stringify({ hometown, gender }));
    }

    // Đóng form
    window.toggleEditProfile();
    showToast("Đã cập nhật thông tin cá nhân!", "success");
};


// Hàm đổi mật khẩu
window.changePassword = function () {
    const oldPass = document.getElementById('old-pass').value;
    const newPass = document.getElementById('new-pass').value;
    const confirmPass = document.getElementById('confirm-pass').value;
    const studentId = document.getElementById('prof-id').innerText.replace('MSV: ', '');

    if (!oldPass || !newPass || !confirmPass) {
        alert("Vui lòng nhập đầy đủ thông tin!");
        return;
    }

    if (newPass !== confirmPass) {
        alert("Mật khẩu mới không khớp!");
        return;
    }

    if (newPass.length < 6) {
        alert("Mật khẩu mới phải có ít nhất 6 ký tự!");
        return;
    }

    fetch('/api/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, oldPassword: oldPass, newPassword: newPass })
    })
        .then(async res => {
            const data = await res.json();
            if (res.ok) {
                alert("Đổi mật khẩu thành công!");
                document.getElementById('old-pass').value = '';
                document.getElementById('new-pass').value = '';
                document.getElementById('confirm-pass').value = '';
                showToast("Mật khẩu đã được cập nhật!", "success");
            } else {
                alert(data.message || "Lỗi khi đổi mật khẩu");
            }
        })
        .catch(err => alert("Lỗi kết nối máy chủ!"));
};

// Không chèn thêm nút đăng xuất vào sidebar nữa vì đã có trên header
const sidebarFooter = document.querySelector('.sidebar-footer');
if (sidebarFooter && !sidebarFooter.innerHTML.includes('©')) {
    sidebarFooter.innerHTML = `<p>© 2026 PTIT - Học viện BCVT</p>`;
}

// Xóa sạch dữ liệu điểm danh
if (btnClearAttendance) {
    btnClearAttendance.addEventListener('click', async () => {
        // BẢO MẬT: Phải là Giảng viên mới được dọn dẹp
        if (currentUserRole !== 'Giảng viên') {
            alert("Bạn không có quyền thực hiện hành động này!");
            return;
        }

        if (!confirm("Bạn có chắc chắn muốn XÓA TOÀN BỘ dữ liệu điểm danh? (Danh sách sinh viên vẫn được giữ nguyên)")) return;

        try {
            const response = await fetch('/api/attendance', { method: 'DELETE' });
            if (response.ok) {
                logData = [];
                await loadAttendanceFromServer();
                alert("Đã dọn dẹp sạch bảng điểm danh!");
            }
        } catch (err) {
            alert("Lỗi khi xóa dữ liệu điểm danh!");
        }
    });
}

// Xử lý ẩn/hiện mật khẩu
const togglePassword = document.getElementById('toggle-password');
const studentPasswordInput = document.getElementById('student-password');

if (togglePassword && studentPasswordInput) {
    togglePassword.addEventListener('click', function (e) {
        // Ngăn chặn các sự kiện mặc định nếu có
        e.preventDefault();

        const isPassword = studentPasswordInput.getAttribute('type') === 'password';
        studentPasswordInput.setAttribute('type', isPassword ? 'text' : 'password');

        // Thay đổi icon SVG (Mắt mở / Mắt gạch chéo)
        if (isPassword) {
            // Hiển thị icon Mắt mở
            this.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
            </svg>`;
        } else {
            // Hiển thị icon Mắt gạch chéo (Mặc định)
            this.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.28 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
            </svg>`;
        }

        console.log("Password visibility toggled:", !isPassword);
    });
}

// Chỉnh sửa lại hàm render log để lọc nếu là sinh viên (giả định demo)
const originalRenderAttendanceLogs = renderAttendanceLogs;
renderAttendanceLogs = function () {
    originalRenderAttendanceLogs();

    // Nếu là sinh viên, chúng ta có thể giả lập lọc (ở đây chỉ là demo giao diện)
    if (currentUserRole === 'Sinh viên' && logData.length > 0) {
        // Trong thực tế sẽ lọc theo tên đăng nhập, ở đây we just show a hint
        console.log("Sinh viên đang xem báo cáo...");
    }
};

// Xuất báo cáo CSV
function exportAttendanceToCSV() {
    if (logData.length === 0) {
        alert("Không có dữ liệu để xuất!");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // BOM cho Tiếng Việt
    csvContent += "Thời gian,Ca học,Họ và tên,Vai trò,Môn học,Trạng thái\n";

    logData.forEach(log => {
        const row = [
            `"${log.date} ${log.time}"`,
            `"${log.period || '-'}"`,
            `"${log.name}"`,
            `"${log.role}"`,
            `"${log.subject}"`,
            `"${log.status}"`
        ].join(",");
        csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `BaoCao_DiemDanh_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

if (btnExport) {
    btnExport.addEventListener('click', exportAttendanceToCSV);
}

init();

// --- LOGIC CHO PROFILE DROPDOWN ---
const headerUserClickable = document.getElementById('header-user-clickable');
const profileDropdown = document.getElementById('profile-dropdown');

if (headerUserClickable && profileDropdown) {
    headerUserClickable.addEventListener('click', (e) => {
        e.stopPropagation();
        profileDropdown.classList.toggle('active');
    });

    // Đóng dropdown khi click ra ngoài
    window.addEventListener('click', () => {
        if (profileDropdown.classList.contains('active')) {
            profileDropdown.classList.remove('active');
        }
    });

    // Ngăn chặn click bên trong dropdown làm đóng nó
    profileDropdown.addEventListener('click', (e) => {
        e.stopPropagation();
    });
}

// Hàm cập nhật thông tin dropdown khi đăng nhập
function updateDropdownInfo() {
    const dropName = document.getElementById('drop-name');
    const dropId = document.getElementById('drop-id');

    if (dropName) dropName.textContent = currentUserName || 'Người dùng';
    if (dropId) dropId.textContent = currentStudentId || 'PTIT001';
}

// Hook vào hàm updateUserInfo hiện có (nếu có) hoặc gọi thủ công
const originalUpdateUserInfo = window.updateUserInfo || function () { };
window.updateUserInfo = function () {
    // Cập nhật student id từ input nếu là sv đăng nhập
    if (currentUserRole === 'Sinh viên') {
        currentStudentId = document.getElementById('student-id')?.value || 'PTIT001';
    } else {
        currentStudentId = 'ADMIN';
    }

    // Gọi lọc hiển thị trang cá nhân
    updateProfileTabInfo();

    // Gọi logic gốc
    if (typeof originalUpdateUserInfo === 'function') originalUpdateUserInfo();
    // Cập nhật thêm dropdown
    updateDropdownInfo();
};

function updateProfileTabInfo() {
    const profName = document.getElementById('prof-name');
    const profId = document.getElementById('prof-id-text');
    if (profName) profName.textContent = currentUserName || 'Sinh viên PTIT';
    if (profId) profId.textContent = `Sinh viên @${currentStudentId || 'student_id'}`;
}


