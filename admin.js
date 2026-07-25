// ===================== Admin Module (Online Version) =====================

async function initAdminDashboard() {
    const adminPage = document.getElementById('adminPage');
    // Always re-render to ensure correct menus based on current user's role
    adminPage.innerHTML = renderAdminPage();

    const user = getCurrentUser();
    if (user) {
        const avatar = user.foto || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.nama)}&background=f43f5e&color=fff`;

        const adminName = document.getElementById('adminName');
        const adminAvatar = document.getElementById('adminAvatar');
        const settingsAvatar = document.getElementById('settingsAvatar');
        const adminDisplayName = document.getElementById('adminDisplayName');

        if (adminName) adminName.textContent = user.nama;
        if (adminAvatar) adminAvatar.src = avatar;
        if (settingsAvatar) settingsAvatar.src = avatar;
        if (adminDisplayName) adminDisplayName.value = user.nama;
    }

    // Load school profile (only if elements exist)
    const schoolName = document.getElementById('schoolName');
    if (schoolName) {
        try {
            const school = await getSchoolProfile();
            const principalName = document.getElementById('principalName');
            const principalNip = document.getElementById('principalNip');
            const schoolAddress = document.getElementById('schoolAddress');
            const tahunAjaran = document.getElementById('tahunAjaran');

            if (schoolName) schoolName.value = school.name || '';
            if (principalName) principalName.value = school.principal || '';
            if (principalNip) principalNip.value = school.principalNip || '';
            if (schoolAddress) schoolAddress.value = school.address || '';
            if (tahunAjaran) tahunAjaran.value = school.tahunAjaran || '';
        } catch (e) {
            console.error('Error loading school profile:', e);
        }
    }

    // Setup menu navigation
    setupAdminMenu();

    // Load dashboard data
    await updateDashboardStats();
    await loadRecentAbsensi();

    // Only load user list and monitoring if elements exist
    if (document.getElementById('userList')) {
        await loadUserList();
    }
    await updateMonitoring();

    // Check empty classes real-time
    await checkEmptyClassesRealtime();

    // Auto-refresh empty class notification every 5 minutes
    setInterval(checkEmptyClassesRealtime, 5 * 60 * 1000);

    // Load kelola kelas
    loadKelolaKelas();

    // Set default dates (only if elements exist)
    const emptyClassDate = document.getElementById('emptyClassDate');
    const reportMonth = document.getElementById('reportMonth');
    if (emptyClassDate) emptyClassDate.value = getTodayDate();
    if (reportMonth) reportMonth.value = getTodayDate().substring(0, 7);
}


function setupAdminMenu() {
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            menuItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            const menuId = item.dataset.menu;
            document.querySelectorAll('.menu-content').forEach(c => c.classList.remove('active'));
            document.getElementById('menu' + menuId.charAt(0).toUpperCase() + menuId.slice(1)).classList.add('active');
        });
    });
}

async function updateDashboardStats() {
    try {
        const users = await getUsers();
        const guruCount = users.filter(u => u.role === 'guru').length;
        const today = getTodayDate();
        const todayRecords = await getAttendance('', today);

        const hadirToday = new Set(todayRecords.filter(r => r.status === 'masuk').map(r => r.nip)).size;
        const izinToday = new Set(todayRecords.filter(r => r.status === 'izin').map(r => r.nip)).size;

        document.getElementById('totalGuru').textContent = guruCount;
        document.getElementById('totalHadir').textContent = hadirToday;
        document.getElementById('totalIzin').textContent = izinToday;
        document.getElementById('totalAbsen').textContent = Math.max(0, guruCount - hadirToday - izinToday);
    } catch (e) {
        console.error('Error updating stats:', e);
    }
}

async function loadRecentAbsensi() {
    const tbody = document.getElementById('recentAbsensi');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan=\"6\" style=\"text-align:center\"><i class=\"fas fa-spinner fa-spin\"></i> Memuat...</td></tr>';

    try {
        const records = await getAttendance('', '');
        const recent = records.slice(0, 10);

        tbody.innerHTML = recent.map(r => `
            <tr>
                <td>${formatDateTime(r.timestamp)}</td>
                <td>${r.nama}</td>
                <td>${r.mapel || '-'}</td>
                <td>${r.kelas}</td>
                <td>Jam ke-${r.jam}</td>
                <td><span class="riwayat-status ${r.status}">${r.status.toUpperCase()}</span></td>
            </tr>
        `).join('') || '<tr><td colspan="6" style="text-align:center">Belum ada data</td></tr>';
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--danger)">Gagal memuat data</td></tr>';
    }
}

async function loadUserList() {
    const tbody = document.getElementById('userList');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center"><i class="fas fa-spinner fa-spin"></i> Memuat...</td></tr>';

    try {
        const users = await getUsers();
        tbody.innerHTML = users.map(u => `
            <tr>
                <td>${u.nip}</td>
                <td>${u.nama}</td>
                <td>${u.mapel || '-'}</td>
                <td><span class="riwayat-status ${u.role === 'admin' ? 'izin' : 'masuk'}">${u.role.toUpperCase()}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-secondary btn-sm" onclick="editUser('${u.nip}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="deleteUser('${u.nip}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--danger)">Gagal memuat data</td></tr>';
    }
}

// User Management
async function addUser(e) {
    e.preventDefault();

    const btn = e.target.querySelector('button[type="submit"]');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
    btn.disabled = true;

    const newUser = {
        nip: document.getElementById('addNip').value.trim(),
        nama: document.getElementById('addNama').value.trim(),
        password: document.getElementById('addPassword').value,
        mapel: document.getElementById('addMapel').value.trim(),
        role: document.getElementById('addRole').value
    };

    try {
        const result = await addUserToSheet(newUser);
        if (result.success) {
            closeModal('addUserModal');
            document.getElementById('addUserForm').reset();
            await loadUserList();
            await updateDashboardStats();
            showAlert('Berhasil', 'User berhasil ditambahkan!', 'success');
        } else {
            showAlert('Error', result.message, 'danger');
        }
    } catch (e) {
        showAlert('Error', 'Gagal menambah user', 'danger');
    } finally {
        btn.innerHTML = '<i class="fas fa-save"></i> Simpan';
        btn.disabled = false;
    }
}

async function editUser(nip) {
    const users = await getUsers();
    const user = users.find(u => u.nip === nip);
    if (!user) return;

    document.getElementById('editNipOld').value = user.nip;
    document.getElementById('editNip').value = user.nip;
    document.getElementById('editNama').value = user.nama;
    document.getElementById('editPassword').value = '';
    document.getElementById('editMapel').value = user.mapel || '';
    document.getElementById('editRole').value = user.role;

    openModal('editUserModal');
}

async function updateUser(e) {
    e.preventDefault();

    const btn = e.target.querySelector('button[type="submit"]');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
    btn.disabled = true;

    const userData = {
        oldNip: document.getElementById('editNipOld').value,
        nip: document.getElementById('editNip').value.trim(),
        nama: document.getElementById('editNama').value.trim(),
        password: document.getElementById('editPassword').value || null,
        mapel: document.getElementById('editMapel').value.trim(),
        role: document.getElementById('editRole').value
    };

    try {
        const result = await updateUserInSheet(userData);
        if (result.success) {
            closeModal('editUserModal');
            await loadUserList();
            showAlert('Berhasil', 'User berhasil diupdate!', 'success');
        } else {
            showAlert('Error', result.message, 'danger');
        }
    } catch (e) {
        showAlert('Error', 'Gagal update user', 'danger');
    } finally {
        btn.innerHTML = '<i class="fas fa-save"></i> Update';
        btn.disabled = false;
    }
}

async function deleteUser(nip) {
    if (!confirm('Yakin ingin menghapus user ini?')) return;

    try {
        const result = await deleteUserFromSheet(nip);
        if (result.success) {
            await loadUserList();
            await updateDashboardStats();
            showAlert('Berhasil', 'User berhasil dihapus!', 'success');
        } else {
            showAlert('Error', result.message, 'danger');
        }
    } catch (e) {
        showAlert('Error', 'Gagal hapus user', 'danger');
    }
}

async function importUsers() {
    const fileInput = document.getElementById('importFile');
    const file = fileInput.files[0];

    if (!file) {
        showAlert('Perhatian', 'Pilih file CSV terlebih dahulu!', 'warning');
        return;
    }

    const reader = new FileReader();
    reader.onload = async function (e) {
        const text = e.target.result;
        const lines = text.split('\n');
        let added = 0;

        for (let idx = 0; idx < lines.length; idx++) {
            const line = lines[idx];
            if (idx === 0 || !line.trim()) continue;
            const [nip, nama, password, role, mapel] = line.split(',').map(s => s.trim());
            if (nip && nama && password) {
                const result = await addUserToSheet({ nip, nama, password, role: role || 'guru', mapel: mapel || '' });
                if (result.success) added++;
            }
        }

        closeModal('importUserModal');
        fileInput.value = '';
        await loadUserList();
        await updateDashboardStats();
        showAlert('Berhasil', `${added} user berhasil diimport!`, 'success');
    };
    reader.readAsText(file);
}

// Monitoring
async function updateMonitoring() {
    const jam = document.getElementById('monitorJam')?.value || '';
    const today = getTodayDate();

    const containerReguler = document.getElementById('monitoringGridReguler');
    const containerKhusus = document.getElementById('monitoringGridKhusus');
    if (!containerReguler && !containerKhusus) return;

    const loadingHtml = '<div style="grid-column:1/-1;text-align:center"><i class="fas fa-spinner fa-spin"></i> Memuat...</div>';
    if (containerReguler) containerReguler.innerHTML = loadingHtml;
    if (containerKhusus) containerKhusus.innerHTML = loadingHtml;

    try {
        const records = await getAttendance('', today);

        const renderCards = (kelasList) => kelasList.map(kelas => {
            const kelasRecords = records.filter(r => r.kelas === kelas && (jam === '' || r.jam == jam));
            const isFilled = kelasRecords.length > 0;
            const teacher = isFilled ? kelasRecords[0].nama : '';
            const mapel = isFilled ? (kelasRecords[0].mapel || '') : '';
            const keterangan = isFilled ? (kelasRecords[0].keterangan || '') : '';

            return `
                <div class="class-card glass ${isFilled ? 'filled' : 'empty'}">
                    <div class="class-name">${kelas}</div>
                    <div class="class-status">${isFilled ? 'Terisi' : 'Kosong'}</div>
                    ${teacher ? `<div class="class-teacher">${teacher.split(',')[0]}</div>` : ''}
                    ${mapel ? `<div class="class-mapel">${mapel}</div>` : ''}
                    ${keterangan ? `<div class="class-keterangan">${keterangan}</div>` : ''}
                </div>
            `;
        }).join('');

        if (containerReguler) containerReguler.innerHTML = renderCards(KELAS_REGULER);
        if (containerKhusus) containerKhusus.innerHTML = renderCards(RUANGAN_KHUSUS);
    } catch (e) {
        const errorHtml = '<div style="grid-column:1/-1;text-align:center;color:var(--danger)">Gagal memuat data</div>';
        if (containerReguler) containerReguler.innerHTML = errorHtml;
        if (containerKhusus) containerKhusus.innerHTML = errorHtml;
    }
}

function refreshMonitoring() {
    updateMonitoring();
    showAlert('Info', 'Data monitoring telah diperbarui.', 'success');
}

// Search
async function searchGuruFunc() {
    const searchInput = document.getElementById('searchGuru');
    const container = document.getElementById('searchResults');

    if (!searchInput || !container) {
        console.error('Search elements not found');
        return;
    }

    const query = searchInput.value.toLowerCase().trim();

    if (!query) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-search"></i><p>Ketik nama atau NIP untuk mencari</p></div>';
        return;
    }

    // Show loading
    container.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Mencari...</p></div>';

    try {
        const users = await getUsers();
        const results = users.filter(u => {
            if (u.role !== 'guru') return false;
            const nipStr = String(u.nip || '').toLowerCase();
            const namaStr = String(u.nama || '').toLowerCase();
            const mapelStr = String(u.mapel || '').toLowerCase();
            return namaStr.includes(query) || nipStr.includes(query) || mapelStr.includes(query);
        });

        if (results.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-user-slash"></i><p>Tidak ditemukan</p></div>';
            return;
        }

        container.innerHTML = results.map(u => `
            <div class="search-result-item glass">
                <img src="${u.foto || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.nama)}&background=16a34a&color=fff`}" alt="Avatar">
                <div class="result-info">
                    <h4>${u.nama}</h4>
                    <p>NIP: ${u.nip}</p>
                    <p class="mapel-info"><i class="fas fa-book"></i> ${u.mapel || '-'}</p>
                </div>
                <div class="result-actions">
                    <button class="btn btn-secondary btn-sm" onclick="viewGuruDetail('${u.nip}')">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
            </div>
        `).join('');
    } catch (e) {
        console.error('Search error:', e);
        container.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Gagal mencari. Coba lagi.</p></div>';
    }
}

// View guru detail (show today's attendance)
async function viewGuruDetail(nip) {
    try {
        const users = await getUsers();
        const guru = users.find(u => u.nip === nip);
        if (!guru) return;

        const today = getTodayDate();
        const records = await getAttendance(nip, today);

        let detailHtml = `
            <div class="guru-detail-card glass">
                <div class="guru-header">
                    <img src="${guru.foto || `https://ui-avatars.com/api/?name=${encodeURIComponent(guru.nama)}&background=16a34a&color=fff&size=100`}" alt="Avatar">
                    <div>
                        <h3>${guru.nama}</h3>
                        <p>NIP: ${guru.nip}</p>
                        <p class="mapel-info"><i class="fas fa-book"></i> ${guru.mapel || '-'}</p>
                    </div>
                </div>
                <div class="guru-attendance">
                    <h4><i class="fas fa-calendar-day"></i> Absensi Hari Ini</h4>
                    ${records.length > 0 ? records.map(r => `
                        <div class="attendance-item">
                            <span class="riwayat-status ${r.status}">${r.status.toUpperCase()}</span>
                            <span>${r.kelas} - Jam ke-${r.jam}</span>
                            <span class="time">${formatTime(r.timestamp)}</span>
                        </div>
                    `).join('') : '<p class="no-data">Belum ada absensi hari ini</p>'}
                </div>
            </div>
        `;

        const container = document.getElementById('searchResults');
        container.innerHTML = `
            <button class="btn btn-secondary mb-20" onclick="searchGuruFunc()">
                <i class="fas fa-arrow-left"></i> Kembali ke Hasil Pencarian
            </button>
            ${detailHtml}
        `;
    } catch (e) {
        console.error('Error viewing guru detail:', e);
    }
}

// Empty Classes
async function findEmptyClasses() {
    const date = document.getElementById('emptyClassDate').value;
    const jam = document.getElementById('emptyClassJam').value;

    if (!date || jam === '') {
        showAlert('Perhatian', 'Pilih tanggal dan jam terlebih dahulu!', 'warning');
        return;
    }

    const container = document.getElementById('emptyClassResults');
    container.innerHTML = '<div style="text-align:center"><i class="fas fa-spinner fa-spin"></i> Mencari...</div>';

    try {
        const records = await getAttendance('', date);
        const filtered = records.filter(r => r.jam == jam);
        const filledClasses = new Set(filtered.map(r => r.kelas));
        const emptyClasses = KELAS_LIST.filter(k => !filledClasses.has(k));

        container.innerHTML = emptyClasses.map(kelas => `
            <div class="class-card glass empty">
                <div class="class-name">${kelas}</div>
                <div class="class-status">Belum ada guru</div>
            </div>
        `).join('') || '<div class="card glass"><div class="card-body empty-state"><p>Semua kelas sudah terisi!</p></div></div>';
    } catch (e) {
        container.innerHTML = '<div style="text-align:center;color:var(--danger)">Gagal mencari</div>';
    }
}

// Get current teaching hour based on time
function getCurrentJam() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentTime = hours * 60 + minutes; // Time in minutes since midnight

    // Define teaching hours ranges (start and end in minutes)
    const jamRanges = [
        { jam: 0, start: 390, end: 449, label: 'Jam ke-0 (06:30 - 07:29)' },   // 06:30 - 07:29
        { jam: 1, start: 450, end: 490, label: 'Jam ke-1 (07:30 - 08:10)' },   // 07:30 - 08:10
        { jam: 2, start: 491, end: 530, label: 'Jam ke-2 (08:11 - 08:50)' },   // 08:11 - 08:50
        { jam: 3, start: 531, end: 570, label: 'Jam ke-3 (08:51 - 09:30)' },   // 08:51 - 09:30
        { jam: 4, start: 571, end: 610, label: 'Jam ke-4 (09:31 - 10:10)' },   // 09:31 - 10:10
        { jam: 5, start: 630, end: 670, label: 'Jam ke-5 (10:30 - 11:10)' },   // 10:30 - 11:10
        { jam: 6, start: 711, end: 710, label: 'Jam ke-6 (11:51 - 11:50)' },   // Corrected based on data.js
        { jam: 7, start: 711, end: 750, label: 'Jam ke-7 (11:51 - 12:30)' },   // 11:51 - 12:30
        { jam: 8, start: 780, end: 820, label: 'Jam ke-8 (13:00 - 13:40)' },   // 13:00 - 13:40
        { jam: 9, start: 821, end: 860, label: 'Jam ke-9 (13:41 - 14:20)' }    // 13:41 - 14:20
    ];

    const found = jamRanges.find(j => currentTime >= j.start && currentTime <= j.end);
    return found || null;
}

// Check empty classes in real-time and display notification
async function checkEmptyClassesRealtime() {
    const notificationPanel = document.getElementById('emptyClassNotification');
    const jamLabel = document.getElementById('currentJamLabel');
    const alertContainer = document.getElementById('emptyClassAlert');

    if (!notificationPanel || !jamLabel || !alertContainer) return;

    const currentJamInfo = getCurrentJam();

    // If outside teaching hours, hide notification
    if (!currentJamInfo) {
        notificationPanel.classList.add('hidden');
        return;
    }

    try {
        const today = getTodayDate();
        const records = await getAttendance('', today);
        const filtered = records.filter(r => r.jam == currentJamInfo.jam);
        const filledClasses = new Set(filtered.map(r => r.kelas));

        // Only check actual classroom (exclude special rooms for now, or include all)
        const emptyClasses = KELAS_LIST.filter(k => !filledClasses.has(k));

        // Update UI
        jamLabel.textContent = currentJamInfo.label;

        if (emptyClasses.length > 0) {
            notificationPanel.classList.remove('hidden');
            alertContainer.innerHTML = `
                <div class="empty-class-count">
                    <span class="count-number">${emptyClasses.length}</span>
                    <span class="count-label">Kelas Kosong</span>
                </div>
                <div class="empty-class-tags">
                    ${emptyClasses.slice(0, 10).map(k => `<span class="empty-tag">${k}</span>`).join('')}
                    ${emptyClasses.length > 10 ? `<span class="empty-tag more">+${emptyClasses.length - 10} lainnya</span>` : ''}
                </div>
            `;
        } else {
            // Show success message when all classes are filled
            notificationPanel.classList.remove('hidden');
            alertContainer.innerHTML = `
                <div class="all-filled-message">
                    <i class="fas fa-check-circle"></i>
                    <span>Semua kelas sudah terisi pada ${currentJamInfo.label}!</span>
                </div>
            `;
        }
    } catch (e) {
        console.error('Error checking empty classes:', e);
        notificationPanel.classList.add('hidden');
    }
}


// Reports
async function generateWeeklyReport() {
    const week = document.getElementById('reportWeek').value;
    if (!week) {
        showAlert('Perhatian', 'Pilih minggu terlebih dahulu!', 'warning');
        return;
    }
    await generateReport('Mingguan', week);
}

async function generateMonthlyReport() {
    const month = document.getElementById('reportMonth').value;
    if (!month) {
        showAlert('Perhatian', 'Pilih bulan terlebih dahulu!', 'warning');
        return;
    }
    await generateReport('Bulanan', month);
}

async function generateReport(type, period) {
    const school = await getSchoolProfile();
    const records = await getAttendance('', '');
    const filtered = records.filter(r => r.timestamp && r.timestamp.includes(period.replace('W', '-')));

    let content = `
        <html>
        <head><title>Laporan Absensi ${type}</title>
        <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1, h2 { text-align: center; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #000; padding: 8px; text-align: left; }
            th { background: #f0f0f0; }
            .header { text-align: center; margin-bottom: 20px; }
            .footer { margin-top: 40px; text-align: right; }
        </style>
        </head>
        <body>
            <div class="header">
                <h2>${school.name}</h2>
                <p>${school.address}</p>
                <h3>Laporan Absensi ${type} - ${period}</h3>
            </div>
            <table>
                <tr><th>No</th><th>Waktu</th><th>NIP</th><th>Nama</th><th>Mapel</th><th>Kelas</th><th>Jam</th><th>Status</th></tr>
                ${filtered.map((r, i) => `
                    <tr>
                        <td>${i + 1}</td>
                        <td>${formatDateTime(r.timestamp)}</td>
                        <td>${r.nip}</td>
                        <td>${r.nama}</td>
                        <td>${r.mapel || '-'}</td>
                        <td>${r.kelas}</td>
                        <td>Jam ke-${r.jam}</td>
                        <td>${r.status.toUpperCase()}</td>
                    </tr>
                `).join('')}
            </table>
            <div class="footer">
                <p>Kepala Sekolah,</p><br><br><br>
                <p><u>${school.principal}</u></p>
                <p>NIP. ${school.principalNip}</p>
            </div>
        </body>
        </html>
    `;

    const win = window.open('', '_blank');
    win.document.write(content);
    win.document.close();
    win.print();
}

// Settings
async function saveAdminProfile() {
    const user = getCurrentUser();
    const newName = document.getElementById('adminDisplayName').value.trim();

    const result = await updateUserInSheet({
        oldNip: user.nip,
        nip: user.nip,
        nama: newName,
        role: user.role
    });

    if (result.success) {
        user.nama = newName;
        localStorage.setItem('currentUser', JSON.stringify(user));
        document.getElementById('adminName').textContent = user.nama;
        showAlert('Berhasil', 'Profil admin berhasil disimpan!', 'success');
    } else {
        showAlert('Error', result.message, 'danger');
    }
}

function uploadAvatar(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = async function (e) {
            const user = getCurrentUser();
            const result = await updateUserInSheet({
                oldNip: user.nip,
                nip: user.nip,
                nama: user.nama,
                role: user.role,
                foto: e.target.result
            });

            if (result.success) {
                user.foto = e.target.result;
                localStorage.setItem('currentUser', JSON.stringify(user));
                document.getElementById('settingsAvatar').src = e.target.result;
                document.getElementById('adminAvatar').src = e.target.result;
            }
        };
        reader.readAsDataURL(input.files[0]);
    }
}

async function changePassword(e) {
    e.preventDefault();
    const oldPass = document.getElementById('oldPassword').value;
    const newPass = document.getElementById('newPassword').value;
    const confirmPass = document.getElementById('confirmPassword').value;

    if (newPass !== confirmPass) {
        showAlert('Error', 'Password baru dan konfirmasi tidak sama!', 'danger');
        return;
    }

    const user = getCurrentUser();
    const users = await getUsers();
    const found = users.find(u => u.nip === user.nip);

    if (!found || found.password !== oldPass) {
        showAlert('Error', 'Password lama salah!', 'danger');
        return;
    }

    const result = await updateUserInSheet({
        oldNip: user.nip,
        nip: user.nip,
        nama: user.nama,
        password: newPass,
        role: user.role
    });

    if (result.success) {
        document.getElementById('changePasswordForm').reset();
        showAlert('Berhasil', 'Password berhasil diubah!', 'success');
    } else {
        showAlert('Error', result.message, 'danger');
    }
}

async function saveTahunAjaran() {
    const tahun = document.getElementById('tahunAjaran').value.trim();
    const result = await apiSaveSettings({ tahunAjaran: tahun });
    if (result.success) {
        showAlert('Berhasil', 'Tahun ajaran berhasil disimpan!', 'success');
    } else {
        showAlert('Error', 'Gagal menyimpan', 'danger');
    }
}

async function saveSchoolProfileForm(e) {
    e.preventDefault();

    const profile = {
        name: document.getElementById('schoolName').value.trim(),
        principal: document.getElementById('principalName').value.trim(),
        principalNip: document.getElementById('principalNip').value.trim(),
        address: document.getElementById('schoolAddress').value.trim(),
        tahunAjaran: document.getElementById('tahunAjaran')?.value.trim() || ''
    };

    const result = await saveSchoolProfileData(profile);
    if (result.success) {
        showAlert('Berhasil', 'Profil sekolah berhasil disimpan!', 'success');
    } else {
        showAlert('Error', result.message || 'Gagal menyimpan', 'danger');
    }
}

// ===================== GPS Radius Settings =====================
let schoolMap = null;
let schoolMarker = null;
let radiusCircle = null;

function initGpsRadiusMap() {
    // Check if Leaflet library is loaded
    if (typeof L === 'undefined') {
        console.warn('Leaflet library not loaded');
        return;
    }

    // Check if map container exists and map not initialized
    const mapContainer = document.getElementById('schoolMap');
    if (!mapContainer || schoolMap) return;

    // Load saved settings
    const savedSettings = loadGpsSettings();
    const lat = savedSettings.latitude || -8.5833;
    const lng = savedSettings.longitude || 116.1167;
    const radius = savedSettings.maxRadius || 500;

    // Initialize map
    schoolMap = L.map('schoolMap').setView([lat, lng], 16);

    // Add tile layer (OpenStreetMap)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(schoolMap);

    // Add marker
    schoolMarker = L.marker([lat, lng], { draggable: true }).addTo(schoolMap);
    schoolMarker.bindPopup('Lokasi Sekolah').openPopup();

    // Add radius circle
    radiusCircle = L.circle([lat, lng], {
        color: '#16a34a',
        fillColor: '#16a34a',
        fillOpacity: 0.2,
        radius: radius
    }).addTo(schoolMap);

    // Update form values
    document.getElementById('schoolLat').value = lat;
    document.getElementById('schoolLng').value = lng;
    document.getElementById('schoolRadius').value = radius;
    document.getElementById('radiusSlider').value = Math.min(radius, 2000);
    document.getElementById('enableRadiusCheck').checked = savedSettings.enableRadiusCheck || false;
    updateRadiusStatus();

    // Map click event
    schoolMap.on('click', function (e) {
        const { lat, lng } = e.latlng;
        updateMapLocation(lat, lng);
    });

    // Marker drag event
    schoolMarker.on('dragend', function (e) {
        const { lat, lng } = e.target.getLatLng();
        updateMapLocation(lat, lng);
    });

    // Form input events
    document.getElementById('schoolLat').addEventListener('change', updateMapFromForm);
    document.getElementById('schoolLng').addEventListener('change', updateMapFromForm);
    document.getElementById('schoolRadius').addEventListener('change', updateRadiusFromInput);
}

function updateMapLocation(lat, lng) {
    schoolMarker.setLatLng([lat, lng]);
    radiusCircle.setLatLng([lat, lng]);
    document.getElementById('schoolLat').value = lat.toFixed(6);
    document.getElementById('schoolLng').value = lng.toFixed(6);
}

function updateMapFromForm() {
    const lat = parseFloat(document.getElementById('schoolLat').value) || 0;
    const lng = parseFloat(document.getElementById('schoolLng').value) || 0;
    if (lat && lng) {
        schoolMarker.setLatLng([lat, lng]);
        radiusCircle.setLatLng([lat, lng]);
        schoolMap.setView([lat, lng], 16);
    }
}

function updateRadiusFromSlider() {
    const radius = parseInt(document.getElementById('radiusSlider').value);
    document.getElementById('schoolRadius').value = radius;
    if (radiusCircle) {
        radiusCircle.setRadius(radius);
    }
}

function updateRadiusFromInput() {
    const radius = parseInt(document.getElementById('schoolRadius').value) || 500;
    document.getElementById('radiusSlider').value = Math.min(radius, 2000);
    if (radiusCircle) {
        radiusCircle.setRadius(radius);
    }
}

function toggleRadiusCheck() {
    updateRadiusStatus();
}

function updateRadiusStatus() {
    const enabled = document.getElementById('enableRadiusCheck').checked;
    document.getElementById('radiusStatus').textContent = enabled ? 'Aktif' : 'Nonaktif';
    document.getElementById('radiusStatus').style.color = enabled ? 'var(--success)' : 'var(--text-secondary)';
}

function getMyLocation() {
    if (!navigator.geolocation) {
        showAlert('Error', 'Browser tidak mendukung GPS', 'danger');
        return;
    }

    showAlert('Info', 'Mendeteksi lokasi...', 'info');

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            updateMapLocation(lat, lng);
            schoolMap.setView([lat, lng], 16);
            showAlert('Berhasil', 'Lokasi berhasil dideteksi!', 'success');
        },
        (error) => {
            showAlert('Error', 'Gagal mendapatkan lokasi. Pastikan GPS aktif.', 'danger');
        },
        { enableHighAccuracy: true }
    );
}

function saveGpsSettings() {
    const settings = {
        enableRadiusCheck: document.getElementById('enableRadiusCheck').checked,
        latitude: parseFloat(document.getElementById('schoolLat').value) || 0,
        longitude: parseFloat(document.getElementById('schoolLng').value) || 0,
        maxRadius: parseInt(document.getElementById('schoolRadius').value) || 500
    };

    // Save to localStorage
    localStorage.setItem('gpsSettings', JSON.stringify(settings));

    // Update gps.js SCHOOL_CONFIG
    if (typeof SCHOOL_CONFIG !== 'undefined') {
        SCHOOL_CONFIG.enableRadiusCheck = settings.enableRadiusCheck;
        SCHOOL_CONFIG.latitude = settings.latitude;
        SCHOOL_CONFIG.longitude = settings.longitude;
        SCHOOL_CONFIG.maxRadius = settings.maxRadius;
    }

    showAlert('Berhasil', 'Pengaturan GPS berhasil disimpan!', 'success');
}

function loadGpsSettings() {
    try {
        const saved = localStorage.getItem('gpsSettings');
        if (saved) {
            return JSON.parse(saved);
        }
    } catch (e) {
        console.error('Error loading GPS settings:', e);
    }
    return {
        enableRadiusCheck: false,
        latitude: -8.5833,
        longitude: 116.1167,
        maxRadius: 500
    };
}

// Initialize map when GPS radius menu is clicked
document.addEventListener('click', function (e) {
    if (e.target.closest('.menu-item[data-menu="gpsradius"]')) {
        setTimeout(initGpsRadiusMap, 100);
    }
    if (e.target.closest('.menu-item[data-menu="jadwal"]')) {
        setTimeout(loadJadwalPreview, 100);
        setTimeout(initJadwalDragDrop, 200);
    }
});

// ===================== Jadwal Pelajaran Upload =====================

function uploadJadwalFile(input) {
    if (!input.files || !input.files[0]) return;

    const file = input.files[0];

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
        showAlert('Error', 'Hanya file JPG, PNG, dan PDF yang diperbolehkan!', 'danger');
        input.value = '';
        return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        showAlert('Error', 'Ukuran file maksimal 5MB!', 'danger');
        input.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        const jadwalData = {
            type: file.type.startsWith('image/') ? 'image' : 'pdf',
            data: e.target.result,
            fileName: file.name,
            fileSize: file.size,
            uploadDate: new Date().toISOString()
        };

        try {
            localStorage.setItem('jadwalPelajaran', JSON.stringify(jadwalData));
            loadJadwalPreview();
            showAlert('Berhasil', 'Jadwal pelajaran berhasil diupload!', 'success');
        } catch (err) {
            if (err.name === 'QuotaExceededError' || err.code === 22) {
                showAlert('Error', 'Penyimpanan penuh! Untuk file besar, gunakan URL Google Drive.', 'danger');
            } else {
                showAlert('Error', 'Gagal menyimpan: ' + err.message, 'danger');
            }
        }
    };
    reader.readAsDataURL(file);
}

// Helper: Extract Google Drive file ID from various URL formats
function extractGoogleDriveFileId(url) {
    // Pattern 1: https://drive.google.com/file/d/FILE_ID/view?...
    let match = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match) return match[1];

    // Pattern 2: https://drive.google.com/open?id=FILE_ID
    match = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
    if (match) return match[1];

    // Pattern 3: ?id=FILE_ID in any Google Drive URL
    match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match && url.includes('google.com')) return match[1];

    // Pattern 4: /uc?export=...&id=FILE_ID
    match = url.match(/\/uc\?.*id=([a-zA-Z0-9_-]+)/);
    if (match) return match[1];

    return null;
}

// Helper: Convert Google Drive URL to various usable formats
function convertGoogleDriveUrl(url) {
    const fileId = extractGoogleDriveFileId(url);
    
    if (fileId) {
        return {
            // Direct image/file URL (works for images shared as "Anyone with link")
            directUrl: `https://drive.google.com/uc?export=view&id=${fileId}`,
            // Thumbnail URL (works as fallback, resized)
            thumbnailUrl: `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`,
            // Preview URL (for iframe, may be blocked)
            previewUrl: `https://drive.google.com/file/d/${fileId}/preview`,
            // Original URL for "open in new tab"
            originalUrl: url,
            fileId: fileId,
            isGoogleDrive: true
        };
    }

    // Check for Google Docs/Sheets/Slides
    let match = url.match(/docs\.google\.com\/(spreadsheets|document|presentation)\/d\/([a-zA-Z0-9_-]+)/);
    if (match) {
        const type = match[1];
        const id = match[2];
        return {
            directUrl: `https://docs.google.com/${type}/d/${id}/preview`,
            thumbnailUrl: null,
            previewUrl: `https://docs.google.com/${type}/d/${id}/preview`,
            originalUrl: url,
            fileId: id,
            isGoogleDrive: true,
            isGoogleDocs: true
        };
    }

    // Not a Google Drive URL
    return {
        directUrl: url,
        thumbnailUrl: null,
        previewUrl: url,
        originalUrl: url,
        fileId: null,
        isGoogleDrive: false
    };
}

function simpanJadwalUrl() {
    const urlInput = document.getElementById('jadwalUrlInput');
    if (!urlInput) return;

    const url = urlInput.value.trim();
    if (!url) {
        showAlert('Perhatian', 'Masukkan URL jadwal terlebih dahulu!', 'warning');
        return;
    }

    // Basic URL validation
    try {
        new URL(url);
    } catch (e) {
        showAlert('Error', 'URL tidak valid!', 'danger');
        return;
    }

    // Convert Google Drive URL
    const converted = convertGoogleDriveUrl(url);

    const jadwalData = {
        type: 'url',
        url: converted.directUrl,
        thumbnailUrl: converted.thumbnailUrl,
        previewUrl: converted.previewUrl,
        originalUrl: converted.originalUrl,
        fileId: converted.fileId,
        isGoogleDrive: converted.isGoogleDrive,
        isGoogleDocs: converted.isGoogleDocs || false,
        uploadDate: new Date().toISOString()
    };

    localStorage.setItem('jadwalPelajaran', JSON.stringify(jadwalData));
    loadJadwalPreview();
    urlInput.value = '';

    if (converted.isGoogleDrive) {
        showAlert('Berhasil', 'URL jadwal berhasil disimpan! Pastikan file Google Drive sudah di-share "Anyone with the link".', 'success');
    } else {
        showAlert('Berhasil', 'URL jadwal berhasil disimpan!', 'success');
    }
}

function loadJadwalPreview() {
    const container = document.getElementById('jadwalPreviewContainer');
    const fileInfo = document.getElementById('jadwalFileInfo');
    const previewContent = document.getElementById('jadwalPreviewContent');

    if (!container) return;

    try {
        const saved = localStorage.getItem('jadwalPelajaran');
        if (!saved) {
            container.classList.add('hidden');
            return;
        }

        const data = JSON.parse(saved);
        container.classList.remove('hidden');

        const uploadDate = new Date(data.uploadDate);
        const dateStr = uploadDate.toLocaleDateString('id-ID', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });

        // File info
        if (fileInfo) {
            if (data.type === 'url') {
                fileInfo.innerHTML = `
                    <i class="fas fa-link"></i>
                    <span><strong>Jadwal dari URL</strong></span>
                    <span class="jadwal-date">Diupload: ${dateStr}</span>
                `;
            } else if (data.type === 'pdf') {
                const sizeKB = (data.fileSize / 1024).toFixed(1);
                fileInfo.innerHTML = `
                    <i class="fas fa-file-pdf" style="color:#ef4444"></i>
                    <span><strong>${data.fileName}</strong> — ${sizeKB} KB</span>
                    <span class="jadwal-date">Diupload: ${dateStr}</span>
                `;
            } else {
                const sizeKB = (data.fileSize / 1024).toFixed(1);
                fileInfo.innerHTML = `
                    <i class="fas fa-file-image" style="color:var(--accent-primary)"></i>
                    <span><strong>${data.fileName}</strong> — ${sizeKB} KB</span>
                    <span class="jadwal-date">Diupload: ${dateStr}</span>
                `;
            }
        }

        // Preview content
        if (previewContent) {
            if (data.type === 'url') {
                const linkUrl = data.originalUrl || data.url;

                if (data.isGoogleDrive && !data.isGoogleDocs) {
                    // Google Drive file: display as image directly (not iframe, which gets blocked)
                    const directUrl = data.url;
                    const thumbUrl = data.thumbnailUrl || directUrl;
                    previewContent.innerHTML = `
                        <a href="${linkUrl}" target="_blank" class="jadwal-url-link">
                            <i class="fas fa-external-link-alt"></i> Buka Jadwal di Tab Baru
                        </a>
                        <div class="jadwal-preview">
                            <img src="${directUrl}" alt="Jadwal Pelajaran" 
                                 onerror="this.onerror=null; this.src='${thumbUrl}';"
                                 onclick="window.open('${linkUrl}', '_blank')" 
                                 style="cursor:pointer; width:100%; border-radius:8px;">
                        </div>
                    `;
                } else if (data.isGoogleDocs) {
                    // Google Docs/Sheets/Slides: iframe works for these
                    previewContent.innerHTML = `
                        <a href="${linkUrl}" target="_blank" class="jadwal-url-link">
                            <i class="fas fa-external-link-alt"></i> Buka Jadwal di Tab Baru
                        </a>
                        <iframe src="${data.previewUrl || data.url}" class="jadwal-iframe" frameborder="0" allowfullscreen></iframe>
                    `;
                } else {
                    // Non-Google URL: use iframe
                    previewContent.innerHTML = `
                        <a href="${linkUrl}" target="_blank" class="jadwal-url-link">
                            <i class="fas fa-external-link-alt"></i> Buka Jadwal di Tab Baru
                        </a>
                        <iframe src="${data.url}" class="jadwal-iframe" frameborder="0" allowfullscreen></iframe>
                    `;
                }
            } else if (data.type === 'pdf') {
                previewContent.innerHTML = `
                    <object data="${data.data}" type="application/pdf" class="jadwal-pdf-embed">
                        <p>Browser tidak mendukung preview PDF. <a href="${data.data}" download="${data.fileName}">Download PDF</a></p>
                    </object>
                `;
            } else {
                previewContent.innerHTML = `
                    <img src="${data.data}" alt="Jadwal Pelajaran" onclick="openJadwalFullscreen()" style="cursor:zoom-in">
                `;
            }
        }
    } catch (e) {
        console.error('Error loading jadwal preview:', e);
        container.classList.add('hidden');
    }
}

function deleteJadwalData() {
    if (!confirm('Yakin ingin menghapus jadwal pelajaran?')) return;

    localStorage.removeItem('jadwalPelajaran');
    loadJadwalPreview();
    showAlert('Berhasil', 'Jadwal pelajaran berhasil dihapus!', 'success');

    // Reset inputs
    const fileInput = document.getElementById('jadwalFileInput');
    const urlInput = document.getElementById('jadwalUrlInput');
    if (fileInput) fileInput.value = '';
    if (urlInput) urlInput.value = '';
}

function openJadwalFullscreen() {
    const saved = localStorage.getItem('jadwalPelajaran');
    if (!saved) return;

    const data = JSON.parse(saved);
    if (data.type !== 'image') return;

    const overlay = document.createElement('div');
    overlay.className = 'jadwal-fullscreen-overlay';
    overlay.innerHTML = `
        <button class="jadwal-fullscreen-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
        <img src="${data.data}" alt="Jadwal Pelajaran">
    `;
    overlay.addEventListener('click', function (e) {
        if (e.target === overlay) overlay.remove();
    });

    document.body.appendChild(overlay);
}

function initJadwalDragDrop() {
    const dropZone = document.getElementById('jadwalDropZone');
    if (!dropZone || dropZone.dataset.dragInit) return;
    dropZone.dataset.dragInit = 'true';

    ['dragenter', 'dragover'].forEach(evt => {
        dropZone.addEventListener(evt, function (e) {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('drag-over');
        });
    });

    ['dragleave', 'drop'].forEach(evt => {
        dropZone.addEventListener(evt, function (e) {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('drag-over');
        });
    });

    dropZone.addEventListener('drop', function (e) {
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const fileInput = document.getElementById('jadwalFileInput');
            fileInput.files = files;
            uploadJadwalFile(fileInput);
        }
    });
}


// ===================== Kelola Kelas =====================
function loadKelolaKelas() {
    const container = document.getElementById('kelasListGrid');
    const countEl = document.getElementById('totalKelasCount');
    if (!container) return;

    const allKelas = [...KELAS_REGULER, ...RUANGAN_KHUSUS];
    if (countEl) countEl.textContent = allKelas.length;

    container.innerHTML = allKelas.map((kelas, idx) => {
        const isKhusus = RUANGAN_KHUSUS.includes(kelas);
        return `
            <div class="kelas-list-item ${isKhusus ? 'khusus' : 'reguler'}">
                <span class="kelas-number">${idx + 1}</span>
                <span class="kelas-item-name">${kelas}</span>
                <button class="btn btn-danger btn-icon-sm" onclick="hapusKelas('${kelas.replace(/'/g, "\\'")}')"
                    title="Hapus ${kelas}">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
    }).join('');
}

function tambahKelasBaru() {
    const namaInput = document.getElementById('inputKelasBaruNama');
    const tipeSelect = document.getElementById('inputKelasBaruTipe');
    if (!namaInput || !tipeSelect) return;

    const nama = namaInput.value.trim();
    const tipe = tipeSelect.value;

    if (!nama) {
        showAlert('Perhatian', 'Masukkan nama kelas terlebih dahulu!', 'warning');
        return;
    }

    let result;
    if (tipe === 'khusus') {
        result = addRuanganKhusus(nama);
    } else {
        result = addKelasReguler(nama);
    }

    if (result.success) {
        showAlert('Berhasil', result.message, 'success');
        namaInput.value = '';
        loadKelolaKelas();
    } else {
        showAlert('Gagal', result.message, 'warning');
    }
}

function hapusKelas(nama) {
    if (!confirm(`Yakin ingin menghapus "${nama}"?`)) return;

    const result = deleteKelasItem(nama);
    if (result.success) {
        showAlert('Berhasil', result.message, 'success');
        loadKelolaKelas();
    } else {
        showAlert('Gagal', result.message, 'warning');
    }
}

function resetKelasList() {
    if (!confirm('Yakin ingin mereset daftar kelas ke pengaturan default? Semua perubahan akan hilang.')) return;
    resetKelasToDefault();
    showAlert('Berhasil', 'Daftar kelas berhasil direset ke default.', 'success');
    loadKelolaKelas();
}

function generateAllQRCodes() {
    const container = document.getElementById('qrCodeContainer');
    if (!container) return;

    const allKelas = [...KELAS_REGULER, ...RUANGAN_KHUSUS];

    container.innerHTML = '<div style="text-align:center"><i class="fas fa-spinner fa-spin"></i> Generating QR Codes...</div>';

    // Use a simple QR code generation via API
    const qrCards = allKelas.map(kelas => {
        const qrData = encodeURIComponent(kelas);
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${qrData}`;
        return `
            <div class="qr-card">
                <img src="${qrUrl}" alt="QR ${kelas}" class="qr-img">
                <div class="qr-label">${kelas}</div>
            </div>
        `;
    }).join('');

    container.innerHTML = qrCards;
}

function cetakAllQRCodes() {
    const container = document.getElementById('qrCodeContainer');
    if (!container || container.innerHTML.trim() === '') {
        showAlert('Info', 'Generate QR Code terlebih dahulu sebelum mencetak.', 'warning');
        return;
    }

    const allKelas = [...KELAS_REGULER, ...RUANGAN_KHUSUS];
    const printWindow = window.open('', '_blank');

    const qrHtml = allKelas.map(kelas => {
        const qrData = encodeURIComponent(kelas);
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${qrData}`;
        return `
            <div class="qr-print-item">
                <img src="${qrUrl}" alt="QR ${kelas}">
                <p>${kelas}</p>
            </div>
        `;
    }).join('');

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>QR Code Kelas - SMAN 8 Mataram</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                h1 { text-align: center; margin-bottom: 24px; }
                .qr-print-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 24px;
                    page-break-inside: auto;
                }
                .qr-print-item {
                    text-align: center;
                    padding: 16px;
                    border: 1px solid #ddd;
                    border-radius: 8px;
                    page-break-inside: avoid;
                }
                .qr-print-item img {
                    width: 150px;
                    height: 150px;
                }
                .qr-print-item p {
                    margin-top: 8px;
                    font-weight: bold;
                    font-size: 14px;
                }
                @media print {
                    body { padding: 0; }
                    .qr-print-grid { gap: 16px; }
                }
            </style>
        </head>
        <body>
            <h1>QR Code Kelas - SMAN 8 Mataram</h1>
            <div class="qr-print-grid">${qrHtml}</div>
            <script>setTimeout(() => { window.print(); }, 1500);<\/script>
        </body>
        </html>
    `);
    printWindow.document.close();
}
