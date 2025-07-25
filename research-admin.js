let researches = [];
let researchDisplayCounter = 0;

const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby-QTyfdSXqxmqVNoql7uRkoRZuGCHlZOJA-atzZT4ZEnIiLE_92v6dEm6iR3hBOzkp/exec';
const PENDING_RESEARCH_SHEET_NAME = 'UploadedImagesData';

const statusMessageDiv = document.getElementById('status-message');
const researchGrid = document.getElementById('researchGrid');
const noDataMessage = document.getElementById('noDataMessage');
const totalCountSpan = document.getElementById('totalCount');
const pendingCountSpan = document.getElementById('pendingCount');
const approvedCountSpan = document.getElementById('approvedCount');
const rejectedCountSpan = document.getElementById('rejectedCount');
const loadingSpinner = document.getElementById('loading-spinner');

function showMessage(element, msg, type) {
    element.textContent = msg;
    element.className = `message ${type}`;
    element.classList.remove('hidden');
}

function hideMessage(element) {
    element.classList.add('hidden');
    element.textContent = '';
}

function showLoadingSpinner(show) {
    if (show) loadingSpinner.classList.remove('hidden');
    else loadingSpinner.classList.add('hidden');
}

function updateStatistics() {
    const total = researches.length;
    const pending = researches.filter(r => r.Status === 'Pending' || !r.Status).length;
    const approved = researches.filter(r => r.Status === 'Approved').length;
    const rejected = researches.filter(r => r.Status === 'Rejected').length;

    totalCountSpan.textContent = total;
    pendingCountSpan.textContent = pending;
    approvedCountSpan.textContent = approved;
    rejectedCountSpan.textContent = rejected;

    if (total === 0 && researchGrid.children.length === 0) {
        noDataMessage.classList.remove('hidden');
    } else {
        noDataMessage.classList.add('hidden');
    }
}

async function loadResearchDataFromGoogleSheet() {
    showMessage(statusMessageDiv, 'กำลังดึงข้อมูลจาก Google Sheet...', 'info');
    showLoadingSpinner(true);
    try {
        const response = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?sheet=${PENDING_RESEARCH_SHEET_NAME}`);
        const data = await response.json();

        researches = [];
        researchGrid.innerHTML = '';
        researchDisplayCounter = 0;
        noDataMessage.classList.add('hidden');

        if (data.status === 'success' && Array.isArray(data.data)) {
            if (data.data.length === 0) {
                showMessage(statusMessageDiv, 'ไม่พบข้อมูลงานวิจัยที่รอดำเนินการ', 'info');
                noDataMessage.classList.remove('hidden');
            } else {
                data.data.forEach(item => {
                    if (item.Id) addResearchToGrid(item);
                });
                showMessage(statusMessageDiv, 'โหลดข้อมูลสำเร็จ!', 'success');
            }
        } else {
            showMessage(statusMessageDiv, 'รูปแบบข้อมูลไม่ถูกต้องจาก Google Sheet', 'error');
        }
    } catch (error) {
        console.error('Error loading data:', error);
        showMessage(statusMessageDiv, 'เกิดข้อผิดพลาดในการโหลดข้อมูล', 'error');
    } finally {
        updateStatistics();
        showLoadingSpinner(false);
        setTimeout(() => hideMessage(statusMessageDiv), 3000);
    }
}

async function updateResearchStatus(id, newStatus) {
    const cardElement = document.getElementById(`card-${id}`);
    if (!cardElement) return;

    showMessage(statusMessageDiv, `กำลังอัปเดตสถานะ ID: ${id} เป็น ${newStatus}...`, 'info');
    showLoadingSpinner(true);

    try {
        const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'updateStatus',
                id: id,
                status: newStatus
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('HTTP Error updating status:', response.status, errorText);
            showMessage(statusMessageDiv, `ข้อผิดพลาด HTTP ในการอัปเดตสถานะ: ${response.status}`, 'error');
            return;
        }

        const result = await response.json();

        if (result.status === 'success') {
            const researchIndex = researches.findIndex(r => String(r.Id) === String(id));
            if (researchIndex !== -1) researches[researchIndex].Status = newStatus;

            cardElement.classList.remove('status-approved', 'status-pending', 'status-rejected');
            cardElement.querySelector('.font-semibold').textContent = newStatus;

            if (newStatus === 'Approved') cardElement.classList.add('status-approved');
            else if (newStatus === 'Pending') cardElement.classList.add('status-pending');
            else if (newStatus === 'Rejected') cardElement.classList.add('status-rejected');

            showMessage(statusMessageDiv, result.message, 'success');
        } else {
            console.error('Failed to update status:', result.message);
            showMessage(statusMessageDiv, `อัปเดตสถานะล้มเหลว: ${result.message}`, 'error');
        }
    } catch (error) {
        console.error('Error updating status:', error);
        showMessage(statusMessageDiv, 'เกิดข้อผิดพลาดในการเชื่อมต่อเพื่ออัปเดตสถานะ', 'error');
    } finally {
        updateStatistics();
        showLoadingSpinner(false);
        setTimeout(() => hideMessage(statusMessageDiv), 3000);
    }
}

async function deleteResearch(id) {
    if (!confirm(`คุณแน่ใจหรือไม่ที่ต้องการลบงานวิจัย ID: ${id} นี้? การดำเนินการนี้ไม่สามารถย้อนกลับได้`)) return;

    showMessage(statusMessageDiv, `กำลังลบงานวิจัย ID: ${id}...`, 'info');
    showLoadingSpinner(true);

    try {
        const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete', id: id })
        });

        const result = await response.json();

        if (result.status === 'success') {
            const cardElement = document.getElementById(`card-${id}`);
            if (cardElement) cardElement.remove();
            researches = researches.filter(r => String(r.Id) !== String(id));
            showMessage(statusMessageDiv, result.message, 'success');
        } else {
            showMessage(statusMessageDiv, `ลบงานวิจัยล้มเหลว: ${result.message}`, 'error');
        }
    } catch (error) {
        console.error('Error deleting research:', error);
        showMessage(statusMessageDiv, 'เกิดข้อผิดพลาดในการลบ', 'error');
    } finally {
        updateStatistics();
        showLoadingSpinner(false);
        setTimeout(() => hideMessage(statusMessageDiv), 3000);
    }
}

async function exportResults() {
    showMessage(statusMessageDiv, 'กำลังส่งออกข้อมูลที่ได้รับอนุมัติ...', 'info');
    showLoadingSpinner(true);

    const approvedDataToExport = researches.filter(r => r.Status === 'Approved' && (!r.passe || r.passe !== 'pass'));

    if (approvedDataToExport.length === 0) {
        showMessage(statusMessageDiv, 'ไม่มีรายการที่พร้อมส่งออก (ต้องเป็น Approved และยังไม่ส่ง)', 'info');
        showLoadingSpinner(false);
        return;
    }

    try {
        const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'exportApprovedWithPass',
                data: approvedDataToExport.map(r => r.Id)
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('HTTP Error during export:', response.status, errorText);
            showMessage(statusMessageDiv, `เกิดข้อผิดพลาด HTTP: ${response.status}`, 'error');
            showLoadingSpinner(false);
            return;
        }

        const result = await response.json();

        if (result.status === 'success' && Array.isArray(result.data)) {
            const exportedIds = result.data.map(row => row[PENDING_HEADERS_MAP.Id] || row[4]); // หรือ ดึง index ตามที่เหมาะสม
            // ลบไพ่ที่ส่งออกแล้วในหน้า frontend
            exportedIds.forEach(id => {
                const card = document.getElementById(`card-${id}`);
                if (card) card.remove();
                researches = researches.filter(r => String(r.Id) !== String(id));
            });

            showMessage(statusMessageDiv, `ส่งออกสำเร็จ ${exportedIds.length} รายการ`, 'success');
        } else {
            showMessage(statusMessageDiv, `การส่งออกล้มเหลว: ${result.message || 'ไม่ทราบสาเหตุ'}`, 'error');
        }
    } catch (error) {
        console.error('Error during export:', error);
        showMessage(statusMessageDiv, 'เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error');
    } finally {
        updateStatistics();
        showLoadingSpinner(false);
        setTimeout(() => hideMessage(statusMessageDiv), 4000);
    }
}

function addResearchToGrid(researchData) {
    if (!researchData.Id || document.getElementById(`card-${researchData.Id}`)) return;
    if (researches.some(r => r.Id === researchData.Id)) return;

    researches.push(researchData);
    researchDisplayCounter++;
    const card = createResearchCard(researchData, researchDisplayCounter);
    researchGrid.appendChild(card);
}

function createResearchCard(researchData, displayId) {
    const card = document.createElement('div');
    card.className = 'research-card bg-white rounded-xl shadow-lg overflow-hidden border-2 border-gray-200';
    card.id = `card-${researchData.Id}`;

    let approvedChecked = researchData.Status === 'Approved' ? 'checked' : '';
    let pendingChecked = (researchData.Status === 'Pending' || !researchData.Status) ? 'checked' : '';
    let rejectedChecked = researchData.Status === 'Rejected' ? 'checked' : '';

    if (researchData.Status === 'Approved') card.classList.add('status-approved');
    else if (researchData.Status === 'Pending' || !researchData.Status) card.classList.add('status-pending');
    else if (researchData.Status === 'Rejected') card.classList.add('status-rejected');

    let imageUrl = (researchData.ImageUrl || researchData['Image URL'] || '').trim();
    if (!imageUrl) {
        imageUrl = 'https://placehold.co/400x300/F3F4F6/9CA3AF?text=No+Image';
    }

    let researchFileLinksHtml = '';
    if (researchData['Research File URLs']) {
        try {
            let fileUrls = researchData['Research File URLs'];
            if (typeof fileUrls === 'string') {
                try {
                    fileUrls = JSON.parse(fileUrls);
                } catch (e) {
                    fileUrls = [fileUrls];
                }
            }
            if (Array.isArray(fileUrls) && fileUrls.length > 0) {
                researchFileLinksHtml = '<div class="mt-2 text-sm text-gray-600">';
                fileUrls.forEach((url, index) => {
                    researchFileLinksHtml += `<a href="${url}" target="_blank" class="block text-blue-600 hover:underline">ไฟล์งานวิจัย #${index + 1}</a>`;
                });
                researchFileLinksHtml += '</div>';
            }
        } catch (e) {
            console.error("Error parsing Research File URLs:", researchData['Research File URLs'], e);
            researchFileLinksHtml = `<div class="mt-2 text-sm text-red-600">URL ไฟล์งานวิจัยไม่ถูกต้อง</div>`;
        }
    }

    card.innerHTML = `
        <div class="relative">
            <img
                src="${imageUrl}"
                alt="Research Cover ${researchData.Title || researchData.Id}"
                class="w-full h-64 object-cover"
                onerror="this.onerror=null; this.src='https://placehold.co/400x300/F3F4F6/9CA3AF?text=Image+Error';"
            >
            <div class="absolute top-3 right-3 bg-white rounded-full px-2 py-1 text-sm font-medium text-gray-600">#${displayId}</div>
            <div class="absolute bottom-3 left-3 bg-white rounded-lg px-3 py-1 text-xs font-semibold text-gray-700 shadow-md">ID: ${researchData.Id}</div>
        </div>
        <div class="p-4">
            <h3 class="text-lg font-bold text-gray-800 mb-2 truncate" title="${researchData.Title || 'ไม่ระบุชื่อเรื่อง'}">${researchData.Title || 'ไม่ระบุชื่อเรื่อง'}</h3>
            <div class="text-sm space-y-1">
                <p><span class="card-detail-label">ผู้ใช้:</span> ${researchData.Username || 'ไม่ระบุ'}</p>
                <p><span class="card-detail-label">หมวดหมู่:</span> ${researchData.Category || 'ไม่ระบุ'}</p>
                <p><span class="card-detail-label">ปีที่ตีพิมพ์:</span> ${researchData.Year || 'ไม่ระบุ'}</p>
                <p><span class="card-detail-label">ผู้แต่ง:</span> ${researchData.Authors || 'ไม่ระบุ'}</p>
                <p><span class="card-detail-label">บทคัดย่อ:</span> <span class="truncate" title="${researchData.Abstract || 'ไม่ระบุ'}">${researchData.Abstract || 'ไม่ระบุ'}</span></p>
                <p><span class="card-detail-label">สถานะปัจจุบัน:</span> <span class="font-semibold">${researchData.Status || 'Pending'}</span></p>
            </div>
            ${researchFileLinksHtml}
            <div class="mt-4 flex justify-around space-x-2">
                <label class="flex items-center cursor-pointer group">
                    <input type="radio" name="status-${researchData.Id}" value="Approved" class="checkbox-approved w-5 h-5" onchange="updateResearchStatus('${researchData.Id}', 'Approved')" ${approvedChecked}>
                    <span class="ml-2 text-green-700 font-medium group-hover:text-green-800">✓ อนุมัติ</span>
                </label>
                <label class="flex items-center cursor-pointer group">
                    <input type="radio" name="status-${researchData.Id}" value="Rejected" class="checkbox-rejected w-5 h-5" onchange="updateResearchStatus('${researchData.Id}', 'Rejected')" ${rejectedChecked}>
                    <span class="ml-2 text-red-700 font-medium group-hover:text-red-800">✗ ไม่อนุมัติ</span>
                </label>
                <label class="flex items-center cursor-pointer group">
                    <input type="radio" name="status-${researchData.Id}" value="Pending" class="checkbox-pending w-5 h-5" onchange="updateResearchStatus('${researchData.Id}', 'Pending')" ${pendingChecked}>
                    <span class="ml-2 text-amber-700 font-medium group-hover:text-amber-800">รอ</span>
                </label>
            </div>
            <button onclick="deleteResearch('${researchData.Id}')" class="w-full mt-3 text-gray-500 hover:text-red-600 text-sm font-medium transition-colors duration-200">
                ลบงานวิจัยนี้
            </button>
        </div>
    `;
    return card;
}

window.addEventListener('DOMContentLoaded', () => {
    loadResearchDataFromGoogleSheet();
});
