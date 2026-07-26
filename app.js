// ===================== Main App Controller (Online Version) =====================

// ===================== Network Detection =====================
function showOfflineOverlay() {
    const overlay = document.getElementById('offlineOverlay');
    if (overlay) overlay.classList.remove('hidden');
}

function hideOfflineOverlay() {
    const overlay = document.getElementById('offlineOverlay');
    if (overlay) overlay.classList.add('hidden');
}

function checkConnection() {
    if (navigator.onLine) {
        hideOfflineOverlay();
        // Re-initialize if we were offline
        initAuth();
    } else {
        showOfflineOverlay();
    }
}

// Listen for online/offline events
window.addEventListener('offline', showOfflineOverlay);
window.addEventListener('online', function () {
    hideOfflineOverlay();
    // Re-initialize when back online
    initAuth();
});

// ===================== Theme Toggle (Dark/Light Mode) =====================
function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    // Smooth transition
    document.body.style.transition = 'background 0.4s ease, color 0.4s ease';

    if (newTheme === 'dark') {
        html.setAttribute('data-theme', 'dark');
    } else {
        html.removeAttribute('data-theme');
    }

    localStorage.setItem('theme', newTheme);
}

function applySavedTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    }
}

// Apply theme immediately (before DOMContentLoaded to avoid flash)
applySavedTheme();

document.addEventListener('DOMContentLoaded', function () {
    // Check network status first
    if (!navigator.onLine) {
        showOfflineOverlay();
        return;
    }

    // Initialize data and check API
    initData();

    // Initialize authentication
    initAuth();

    // Render modals
    renderModals();
});

// ===================== API Configuration =====================
async function saveApiConfig() {
    const url = document.getElementById('configApiUrl').value.trim();

    if (!url || !url.startsWith('https://script.google.com')) {
        showAlert('Error', 'Masukkan URL Google Apps Script yang valid!', 'danger');
        return;
    }

    setAPIUrl(url);
    closeModal('configModal');

    // Try to initialize sheets
    showAlert('Info', 'Menginisialisasi database...', 'info');

    try {
        const result = await apiInitSheets();
        if (result.success) {
            showAlert('Berhasil', 'Koneksi berhasil! Silakan login.', 'success');
        } else {
            showAlert('Warning', 'Koneksi tersambung. ' + (result.message || ''), 'warning');
        }
    } catch (e) {
        showAlert('Info', 'URL disimpan. Silakan login untuk test koneksi.', 'info');
    }
}

// ===================== Page Navigation =====================
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(pageId).classList.add('active');
}

// ===================== Guru Dashboard =====================
async function initGuruDashboard() {
    const guruPage = document.getElementById('guruPage');
    guruPage.innerHTML = renderGuruPage();

    // Initialize GPS
    initGPS();

    // Initialize attendance form
    initAttendance();

    // Setup tab navigation
    setupGuruTabs();

    // Load riwayat
    loadRiwayatAbsensi();

    // Refresh user data dari server untuk memastikan mapel up-to-date
    try {
        const updatedUser = await refreshCurrentUser();
        if (updatedUser) {
            // Update tampilan mapel di navbar
            const guruMapelEl = document.getElementById('guruMapel');
            if (guruMapelEl) {
                guruMapelEl.textContent = updatedUser.mapel || '-';
            }
            // Update nama juga jika berubah
            const guruNameEl = document.getElementById('guruName');
            if (guruNameEl) {
                guruNameEl.textContent = updatedUser.nama;
            }
            console.log('Mapel guru:', updatedUser.mapel);
        }
    } catch (error) {
        console.error('Error refreshing user:', error);
    }
}

function setupGuruTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const tabId = btn.dataset.tab;
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById('tab' + tabId.charAt(0).toUpperCase() + tabId.slice(1)).classList.add('active');

            if (tabId === 'riwayat') {
                loadRiwayatAbsensi();
            } else if (tabId === 'jadwal') {
                loadGuruJadwal();
            }
        });
    });
}

async function loadGuruJadwal() {
    const container = document.getElementById('guruJadwalContent');
    if (!container) return;

    // Show loading
    container.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Memuat jadwal pelajaran...</p>
        </div>
    `;

    let data = null;

    // Try to load from server first
    try {
        const result = await apiGetSettings();
        if (result.success && result.settings.jadwalPelajaran) {
            const serverData = result.settings.jadwalPelajaran;
            if (serverData && serverData.trim() !== '') {
                data = JSON.parse(serverData);
                // Cache to localStorage
                localStorage.setItem('jadwalPelajaran', serverData);
            }
        }
    } catch (e) {
        console.error('Error loading jadwal from server:', e);
    }

    // Fallback to localStorage if server failed
    if (!data) {
        try {
            const saved = localStorage.getItem('jadwalPelajaran');
            if (saved) {
                data = JSON.parse(saved);
            }
        } catch (e) {
            console.error('Error loading jadwal from localStorage:', e);
        }
    }

    // No jadwal found
    if (!data) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-calendar-times"></i>
                <p>Belum ada jadwal pelajaran yang diupload.</p>
            </div>
        `;
        return;
    }

    // Render jadwal based on type
    try {
        renderGuruJadwalContent(container, data);
    } catch (e) {
        console.error('Error rendering guru jadwal:', e);
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Gagal memuat jadwal pelajaran.</p>
            </div>
        `;
    }
}

function renderGuruJadwalContent(container, data) {
    if (data.type === 'image') {
        container.innerHTML = `
            <div class="guru-jadwal-preview">
                <img src="${data.data}" alt="Jadwal Pelajaran" onclick="openJadwalFullscreen()">
            </div>
            <div class="guru-jadwal-actions">
                <a href="${data.data}" target="_blank" download="${data.fileName || 'jadwal.jpg'}" class="btn btn-secondary btn-full">
                    <i class="fas fa-external-link-alt"></i> Buka di Tab Baru
                </a>
            </div>
        `;
    } else if (data.type === 'pdf') {
        container.innerHTML = `
            <div class="guru-jadwal-preview">
                <object data="${data.data}" type="application/pdf" class="guru-jadwal-pdf">
                    <p>Browser tidak mendukung preview PDF.</p>
                </object>
            </div>
            <div class="guru-jadwal-actions">
                <a href="${data.data}" target="_blank" class="btn btn-secondary btn-full">
                    <i class="fas fa-external-link-alt"></i> Buka di Tab Baru
                </a>
            </div>
        `;
    } else if (data.type === 'url') {
        const linkUrl = data.originalUrl || data.url;

        if (data.isGoogleDrive && !data.isGoogleDocs) {
            const directUrl = data.url;
            const thumbUrl = data.thumbnailUrl || directUrl;
            container.innerHTML = `
                <div class="guru-jadwal-preview">
                    <img src="${directUrl}" alt="Jadwal Pelajaran" 
                         onerror="this.onerror=null; this.src='${thumbUrl}';"
                         onclick="window.open('${linkUrl}', '_blank')"
                         style="cursor:pointer; width:100%; border-radius:8px;">
                </div>
                <div class="guru-jadwal-actions">
                    <a href="${linkUrl}" target="_blank" class="btn btn-secondary btn-full">
                        <i class="fas fa-external-link-alt"></i> Buka Jadwal di Tab Baru
                    </a>
                </div>
            `;
        } else if (data.isGoogleDocs) {
            container.innerHTML = `
                <div class="guru-jadwal-preview">
                    <iframe src="${data.previewUrl || data.url}" class="guru-jadwal-iframe" frameborder="0" allowfullscreen></iframe>
                </div>
                <div class="guru-jadwal-actions">
                    <a href="${linkUrl}" target="_blank" class="btn btn-secondary btn-full">
                        <i class="fas fa-external-link-alt"></i> Buka Jadwal di Tab Baru
                    </a>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="guru-jadwal-preview">
                    <iframe src="${data.url}" class="guru-jadwal-iframe" frameborder="0" allowfullscreen></iframe>
                </div>
                <div class="guru-jadwal-actions">
                    <a href="${linkUrl}" target="_blank" class="btn btn-secondary btn-full">
                        <i class="fas fa-external-link-alt"></i> Buka Jadwal di Tab Baru
                    </a>
                </div>
            `;
        }
    } else {
        // Legacy format
        const imgSrc = data.image || data.data;
        if (imgSrc) {
            container.innerHTML = `
                <div class="guru-jadwal-preview">
                    <img src="${imgSrc}" alt="Jadwal Pelajaran" onclick="openJadwalFullscreen()">
                </div>
                <div class="guru-jadwal-actions">
                    <a href="${imgSrc}" target="_blank" class="btn btn-secondary btn-full">
                        <i class="fas fa-external-link-alt"></i> Buka di Tab Baru
                    </a>
                </div>
            `;
        }
    }
}

// ===================== Modal Functions =====================
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
}

// Close modal on outside click
document.addEventListener('click', function (e) {
    if (e.target.classList.contains('modal') && e.target.id !== 'configModal') {
        e.target.classList.remove('active');
    }
});

// ===================== Alert Function =====================
function showAlert(title, message, type = 'info') {
    const alertModal = document.getElementById('alertModal');
    const alertIcon = document.getElementById('alertIcon');
    const alertTitle = document.getElementById('alertTitle');
    const alertMessage = document.getElementById('alertMessage');

    let iconClass = 'fa-info-circle';
    let iconColor = 'var(--accent-primary)';

    switch (type) {
        case 'success':
            iconClass = 'fa-check-circle';
            iconColor = 'var(--success)';
            break;
        case 'warning':
            iconClass = 'fa-exclamation-triangle';
            iconColor = 'var(--warning)';
            break;
        case 'danger':
            iconClass = 'fa-times-circle';
            iconColor = 'var(--danger)';
            break;
    }

    alertIcon.innerHTML = `<i class="fas ${iconClass}" style="color: ${iconColor}"></i>`;
    alertTitle.textContent = title;
    alertMessage.textContent = message;

    openModal('alertModal');
}

// ===================== Checkbox Helper Functions =====================
function selectAllKelas(name) {
    const checkboxes = document.querySelectorAll(`input[name="${name}"]`);
    checkboxes.forEach(cb => cb.checked = true);
}

function deselectAllKelas(name) {
    const checkboxes = document.querySelectorAll(`input[name="${name}"]`);
    checkboxes.forEach(cb => cb.checked = false);
}

function selectAllJam() {
    const checkboxes = document.querySelectorAll('input[name="jamMengajar"]');
    checkboxes.forEach(cb => cb.checked = true);
}

function deselectAllJam() {
    const checkboxes = document.querySelectorAll('input[name="jamMengajar"]');
    checkboxes.forEach(cb => cb.checked = false);
}

