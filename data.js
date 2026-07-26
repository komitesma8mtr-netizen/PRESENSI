// ===================== Data Module (Online Version) =====================
// Uses Google Sheets API via Apps Script

const DEFAULT_KELAS_REGULER = [
    // Kelas X
    'X.1', 'X.2', 'X.3', 'X.4', 'X.5', 'X.6', 'X.7', 'X.8','X.9','X.10','X.11',
    // Kelas XI
    'XI. SAINS 1', 'XI. SAINS 2', 'XI. SAINS 3', 'XI. SAINS 4', 'XI. SAINS 5', 'XI. SOSIAL 1', 'XI. SOSIAL 2', 'XI. SOSIAL 3', 'XI. SOSIAL 4', 'XI. SOSIAL 5', 'XI. SOSIAL 6',
    // Kelas XII
    'XII. MIPA 1', 'XII. MIPA 2', 'XII. MIPA 3', 'XII. MIPA 4', 'XII. IPS 1', 'XII. IPS 2', 'XII. IPS 3', 'XII. IPS 4', 'XII. IPS 5'
];

const DEFAULT_RUANGAN_KHUSUS = [
    'MUSHOLLA', 'LAB KIMIA', 'LAB BIOLOGI', 'PERPUSTAKAAN', 'LAB KOMPUTER', 'RUANG AGAMA HINDU'
];

// Dynamic kelas lists (loaded from localStorage or defaults)
let KELAS_REGULER = JSON.parse(localStorage.getItem('kelasReguler')) || [...DEFAULT_KELAS_REGULER];
let RUANGAN_KHUSUS = JSON.parse(localStorage.getItem('ruanganKhusus')) || [...DEFAULT_RUANGAN_KHUSUS];
let KELAS_LIST = [...KELAS_REGULER, ...RUANGAN_KHUSUS];

// ===================== Kelas Management Functions =====================
function refreshKelasList() {
    KELAS_LIST = [...KELAS_REGULER, ...RUANGAN_KHUSUS];
}

function saveKelasToStorage() {
    localStorage.setItem('kelasReguler', JSON.stringify(KELAS_REGULER));
    localStorage.setItem('ruanganKhusus', JSON.stringify(RUANGAN_KHUSUS));
    refreshKelasList();
}

function addKelasReguler(nama) {
    nama = nama.trim().toUpperCase();
    if (!nama) return { success: false, message: 'Nama kelas tidak boleh kosong!' };
    if (KELAS_LIST.includes(nama)) return { success: false, message: 'Kelas sudah ada!' };
    KELAS_REGULER.push(nama);
    saveKelasToStorage();
    return { success: true, message: 'Kelas berhasil ditambahkan!' };
}

function addRuanganKhusus(nama) {
    nama = nama.trim().toUpperCase();
    if (!nama) return { success: false, message: 'Nama ruangan tidak boleh kosong!' };
    if (KELAS_LIST.includes(nama)) return { success: false, message: 'Ruangan sudah ada!' };
    RUANGAN_KHUSUS.push(nama);
    saveKelasToStorage();
    return { success: true, message: 'Ruangan berhasil ditambahkan!' };
}

function deleteKelasItem(nama) {
    const idxReguler = KELAS_REGULER.indexOf(nama);
    const idxKhusus = RUANGAN_KHUSUS.indexOf(nama);
    if (idxReguler !== -1) {
        KELAS_REGULER.splice(idxReguler, 1);
    } else if (idxKhusus !== -1) {
        RUANGAN_KHUSUS.splice(idxKhusus, 1);
    } else {
        return { success: false, message: 'Kelas tidak ditemukan!' };
    }
    saveKelasToStorage();
    return { success: true, message: 'Kelas berhasil dihapus!' };
}

function resetKelasToDefault() {
    KELAS_REGULER = [...DEFAULT_KELAS_REGULER];
    RUANGAN_KHUSUS = [...DEFAULT_RUANGAN_KHUSUS];
    saveKelasToStorage();
}


const JAM_OPTIONS = [
    { value: 0, label: 'Jam ke-0 ' },
    { value: 1, label: 'Jam ke-1 ' },
    { value: 2, label: 'Jam ke-2 ' },
    { value: 3, label: 'Jam ke-3 ' },
    { value: 4, label: 'Jam ke-4 ' },
    { value: 5, label: 'Jam ke-5 ' },
    { value: 6, label: 'Jam ke-6 ' },
    { value: 7, label: 'Jam ke-7 ' },
    { value: 8, label: 'Jam ke-8 ' },
    { value: 9, label: 'Jam ke-9 ' }
];

// Cache for data
let usersCache = null;
let attendanceCache = null;
let settingsCache = null;

// ===================== Initialize =====================
function initData() {
    // API URL sudah di-hardcode di api.js
    // Tidak perlu menampilkan modal konfigurasi
    console.log('API initialized with URL:', API_URL);
}

// ===================== Users Functions =====================
async function getUsers() {
    if (usersCache) return usersCache;

    try {
        const result = await apiGetUsers();
        if (result.success) {
            usersCache = result.users;
            return usersCache;
        }
    } catch (e) {
        console.error('Error getting users:', e);
    }

    // Fallback to localStorage
    return JSON.parse(localStorage.getItem('users') || '[]');
}

async function saveUsers(users) {
    usersCache = users;
    // For online mode, use individual add/update/delete functions
}

async function addUserToSheet(userData) {
    try {
        const result = await apiAddUser(userData);
        if (result.success) {
            usersCache = null; // Clear cache
        }
        return result;
    } catch (e) {
        console.error('Error adding user:', e);
        return { success: false, message: e.toString() };
    }
}

async function updateUserInSheet(userData) {
    try {
        const result = await apiUpdateUser(userData);
        if (result.success) {
            usersCache = null;
        }
        return result;
    } catch (e) {
        console.error('Error updating user:', e);
        return { success: false, message: e.toString() };
    }
}

async function deleteUserFromSheet(nip) {
    try {
        const result = await apiDeleteUser(nip);
        if (result.success) {
            usersCache = null;
        }
        return result;
    } catch (e) {
        console.error('Error deleting user:', e);
        return { success: false, message: e.toString() };
    }
}

// ===================== Attendance Functions =====================
async function getAttendance(nip = '', date = '') {
    try {
        const result = nip ? await apiGetAttendance(nip, date) : await apiGetAllAttendance(date);
        if (result.success) {
            return result.records;
        }
    } catch (e) {
        console.error('Error getting attendance:', e);
    }
    return [];
}

async function addAttendanceRecord(record) {
    try {
        const result = await apiSubmitAttendance(record);
        return result;
    } catch (e) {
        console.error('Error submitting attendance:', e);
        return { success: false, message: e.toString() };
    }
}

// ===================== Settings Functions =====================
async function getSchoolProfile() {
    if (settingsCache) return settingsCache;

    try {
        const result = await apiGetSettings();
        if (result.success) {
            settingsCache = {
                name: result.settings.schoolName || '',
                principal: result.settings.principal || '',
                principalNip: result.settings.principalNip || '',
                address: result.settings.address || '',
                tahunAjaran: result.settings.tahunAjaran || '2025/2026'
            };
            return settingsCache;
        }
    } catch (e) {
        console.error('Error getting settings:', e);
    }

    return {
        name: 'SMA Negeri 8 Mataram',
        principal: 'Kepala Sekolah',
        principalNip: '',
        address: '',
        tahunAjaran: '2026/2027'
    };
}

async function saveSchoolProfileData(profile) {
    try {
        const settings = {
            schoolName: profile.name,
            principal: profile.principal,
            principalNip: profile.principalNip,
            address: profile.address,
            tahunAjaran: profile.tahunAjaran
        };
        const result = await apiSaveSettings(settings);
        if (result.success) {
            settingsCache = profile;
        }
        return result;
    } catch (e) {
        console.error('Error saving settings:', e);
        return { success: false, message: e.toString() };
    }
}

// ===================== Refresh Current User =====================
async function refreshCurrentUser() {
    const user = getCurrentUser();
    if (!user) return null;

    try {
        const users = await getUsers();
        const updatedUser = users.find(u => String(u.nip) === String(user.nip));
        if (updatedUser) {
            currentUser = {
                nip: updatedUser.nip,
                nama: updatedUser.nama,
                role: updatedUser.role,
                foto: updatedUser.foto || '',
                mapel: updatedUser.mapel || ''
            };
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            return currentUser;
        }
    } catch (e) {
        console.error('Error refreshing user:', e);
    }
    return null;
}

// ===================== Helper Functions =====================
function formatDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function formatTime(isoString) {
    const date = new Date(isoString);
    return date.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatDateTime(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getTodayDate() {
    return new Date().toISOString().split('T')[0];
}

function generateId() {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Initialize
initData();
