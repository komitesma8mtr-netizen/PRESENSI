// ===================== Data Module (Online Version) =====================
// Uses Google Sheets API via Apps Script

const KELAS_REGULER = [
        // Kelas X
        'X.1', 'X.2', 'X.3', 'X.4', 'X.5', 'X.6', 'X.7', 'X.8',
        // Kelas XI
        'XI. IKL 1', 'XI. IKL 2', 'XI. IKL 3', 'XI. IT 1', 'XI. IT 2', 'XI. HM', 'XI. SOS 1', 'XI. SOS 2', 'XI. SOS 3', 'XI. SOS 4',
        // Kelas XII
        'XII. IKL 1', 'XII. IKL 2', 'XII. IKL 3', 'XII. IT 1', 'XII. IT 2', 'XII. HM', 'XII. SOS 1', 'XII. SOS 2', 'XII. SOS 3'
    ];

const RUANGAN_KHUSUS = [
        'MUSHOLLA', 'LAPANGAN. DALAM', 'LAPANGAN. LUAR', 'PERPUSTAKAAN', 'LAB KOMPUTER', 'RUANG AGAMA HINDU', 'UPACARA BENDERA'
    ];

// Combined list for backward compatibility
const KELAS_LIST = [...KELAS_REGULER, ...RUANGAN_KHUSUS];

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
                    return { success: false,
