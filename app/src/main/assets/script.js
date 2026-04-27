/**
 * 雨晴 2FA 核心脚本
 * 扫码方案：原生 input[capture] + BarcodeDetector，彻底抛弃 html5-qrcode
 */

// 捕获致命错误，防止白屏无提示
window.onerror = function(message, source, lineno, colno, err) {
    alert("页面发生致命错误喵！\n\n信息：" + message + "\n\n行数：" + lineno + "\n\n堆栈：" + (err ? err.stack : '无喵'));
    return true; 
};
window.addEventListener("unhandledrejection", function(e) {
    alert("异步操作出错喵！\n\n" + (e.reason ? (e.reason.message || e.reason) : '不明错误'));
});

// --- 数据层 ---
let accounts = [];
try {
    const raw = localStorage.getItem('2fa_accounts');
    accounts = JSON.parse(raw || '[]');
    if (!Array.isArray(accounts)) accounts = [];
} catch (e) { accounts = []; }

// 批量管理状态
let isBatchMode = false;
let selectedIndices = new Set();

// --- UI 元素绑定 ---
const appShell       = document.querySelector('.app-shell');
const accountsList   = document.getElementById('accounts-list');
const addModal       = document.getElementById('add-modal');
const editModal      = document.getElementById('edit-modal');
const settingsModal  = document.getElementById('settings-modal');
const scannerOverlay = document.getElementById('scanner-overlay');
const toast          = document.getElementById('toast');
const cameraInput    = document.getElementById('camera-input');

// --- 渲染账号列表 ---
function renderAccounts(filter = '') {
    accountsList.innerHTML = '';
    const isSearching = filter.trim().length > 0;
    const filtered = accounts.filter(acc =>
        (acc.issuer + acc.label).toLowerCase().includes(filter.toLowerCase())
    );
    if (filtered.length === 0) {
        accountsList.innerHTML = '<div style="text-align:center;color:#ccc;margin-top:50px;">喵~ 还没有账号，点右下角 + 添加吧</div>';
        return;
    }
    filtered.forEach((acc) => {
        const realIndex = accounts.findIndex(a => a === acc);
        
        let timeStr = '';
        if (acc.createdAt) {
            const d = new Date(acc.createdAt);
            const yyyy = d.getFullYear();
            const MM = String(d.getMonth()+1).padStart(2,'0');
            const dd = String(d.getDate()).padStart(2,'0');
            const HH = String(d.getHours()).padStart(2,'0');
            const mm = String(d.getMinutes()).padStart(2,'0');
            const ss = String(d.getSeconds()).padStart(2,'0');
            timeStr = `<div style="font-size:10px; color:#aaa; margin-top:4px;">添加于 ${yyyy}-${MM}-${dd} ${HH}:${mm}:${ss}</div>`;
        }

        const card = document.createElement('div');
        card.className = 'account-card';

        let rightActionArea = '';
        if (isBatchMode) {
            // 批量模式：把右侧的操作按钮全部变成多选框框！
            const isChecked = selectedIndices.has(realIndex);
            const checkIcon = isChecked ? 
                `<svg viewBox="0 0 24 24" fill="#ff85a2" style="width:24px;height:24px;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="#fff"/><circle cx="12" cy="12" r="10" fill="#ff85a2"/><path d="M10 17l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="#fff"/></svg>` :
                `<svg viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="2" style="width:24px;height:24px;"><circle cx="12" cy="12" r="10"/></svg>`;
            rightActionArea = `<div style="position: absolute; top: 50%; right: 15px; transform: translateY(-50%); z-index: 10; pointer-events: none;">${checkIcon}</div>`;
            card.style.border = isChecked ? '2px solid #ff85a2' : '2px solid transparent';
            card.style.background = isChecked ? '#fff0f5' : '';
        } else {
            // 正常模式：渲染上下移动和编辑按钮喵！
            let moveBtns = '';
            if (!isSearching && accounts.length > 1) {
                const upOp = realIndex === 0 ? 'opacity:0.2;pointer-events:none;' : '';
                const dnOp = realIndex === accounts.length - 1 ? 'opacity:0.2;pointer-events:none;' : '';
                moveBtns = `
                    <button class="card-edit-btn" style="position:relative; top:0; right:0; padding:6px; ${upOp}" onclick="moveUp(event,${realIndex})">⬆️</button>
                    <button class="card-edit-btn" style="position:relative; top:0; right:0; padding:6px; ${dnOp}" onclick="moveDown(event,${realIndex})">⬇️</button>
                `;
            }
            rightActionArea = `
                <div style="position: absolute; top: 10px; right: 8px; display: flex; align-items: center; z-index: 10;">
                    ${moveBtns}
                    <button class="card-edit-btn" style="position:relative; top:0; right:0; padding:6px;" onclick="openEditModal(event,${realIndex})" title="编辑">✏️</button>
                </div>`;
        }
        card.innerHTML = `
            <div class="account-info">
                <div class="issuer">${acc.issuer || '未知'}</div>
                <div class="label">${acc.label || ''}</div>
                ${timeStr}
            </div>
            <div class="code-area" style="transition: opacity 0.2s; ${isBatchMode ? 'opacity: 0.3;' : ''}">
                <div class="totp-code" id="code-${realIndex}">------</div>
                <div class="progress-ring" id="progress-${realIndex}"></div>
            </div>
            ${rightActionArea}
        `;
        card.addEventListener('click', (e) => {
            if (e.target.closest('.card-edit-btn')) return;
            
            if (isBatchMode) {
                // 批量模式：点击卡片就是选择或取消！
                if (selectedIndices.has(realIndex)) {
                    selectedIndices.delete(realIndex);
                } else {
                    selectedIndices.add(realIndex);
                }
                updateBatchUI();
                renderAccounts(document.getElementById('search-input').value);
                return;
            }

            // 正常模式：点卡片复制密码！
            const codeEl = document.getElementById('code-' + realIndex);
            if (codeEl && codeEl.innerText !== '------' && codeEl.innerText !== 'Error') {
                copyToClipboard(codeEl.innerText);
                showToast('验证码已复制喵！');
            }
        });
        accountsList.appendChild(card);
    });
    updateCodes();
}

function updateCodes() {
    const period = 30;
    const now = Math.floor(Date.now() / 1000);
    const secs = period - (now % period);
    const width = (secs / period) * 100;
    accounts.forEach((acc, index) => {
        try {
            const totp = new window.OTPAuth.TOTP({
                secret: acc.secret.replace(/\s/g, '').toUpperCase(),
                digits: 6,
                period: period
            });
            const cEl = document.getElementById('code-' + index);
            const pEl = document.getElementById('progress-' + index);
            if (cEl) cEl.innerText = totp.generate();
            if (pEl) pEl.style.width = width + '%';
        } catch (e) {
            const cEl = document.getElementById('code-' + index);
            if (cEl) cEl.innerText = 'Error';
        }
    });
}

function saveData() {
    localStorage.setItem('2fa_accounts', JSON.stringify(accounts));
    renderAccounts(document.getElementById('search-input')?.value || '');
}

// --- 扫码核心：原生 input[capture] + BarcodeDetector ---

function openScanner() {
    if (addModal) addModal.style.display = 'none';
    // 防白屏绝技！不用 display: none 隐藏底座，而是把它变得透明并且剥夺可点权！
    if (appShell) {
        appShell.style.opacity = '0';
        appShell.style.pointerEvents = 'none';
    }
    scannerOverlay.style.setProperty('display', 'flex', 'important');
    document.body.style.overflow = 'hidden';
    
    cameraInput.value = '';
    cameraInput.click();
}

function closeScanner() {
    scannerOverlay.style.display = 'none';
    if (appShell) {
        appShell.style.opacity = '1';
        appShell.style.pointerEvents = 'auto';
    }
    document.body.style.overflow = 'auto';
    const statusEl = document.getElementById('scanner-status');
    if (statusEl) statusEl.innerText = '正在唤起相机...';
}

// 供安卓底层原生直接呼唤的兜底方法喵！只要系统说没拿到照片，就立刻结束卡死！
window.cancelScanner = function() {
    showToast('主人刚刚什么都没拍喵~');
    closeScanner();
};

// 处理拍照结果
cameraInput.addEventListener('change', async function(e) {
    const file = e.target.files[0];
    if (!file) {
        window.cancelScanner();
        return;
    }

    const statusEl = document.getElementById('scanner-status');
    if (statusEl) statusEl.innerText = '正在扫视照片角角落落喵...';

    try {
        if ('BarcodeDetector' in window) {
            const detector = new BarcodeDetector({ formats: ['qr_code'] });
            const bitmap = await createImageBitmap(file);
            const barcodes = await detector.detect(bitmap);
            
            if (barcodes.length > 0) {
                handleDecoded(barcodes[0].rawValue);
            } else {
                alert("喵呜？！雨晴看花了眼也没在这张照片里找到二维码喵！\n请主人重新对准带二维码的地方拍一张可以吗🐾");
                closeScanner();
            }
        } else {
            alert("喵！非常抱歉，主人的设备好像不支持本地的高级扫码眼喵，这就帮您退回主界面~ 请手动输入捏！");
            closeScanner();
        }
    } catch (err) {
        alert("识别照片时摔了一跤喵：\n" + err.message);
        closeScanner();
    }
    e.target.value = '';
});

function handleDecoded(decoded) {
    try {
        const parsed = window.OTPAuth.URI.parse(decoded);
        accounts.push({
            issuer: parsed.issuer || '未知',
            label: parsed.label || '',
            secret: parsed.secret.base32,
            createdAt: Date.now()
        });
        saveData();
        closeScanner();
        showToast('新账号添加成功喵！💖');
    } catch (e) {
        // 如果是乱七八糟的二维码，就退回去展示居中漂漂亮亮的小弹窗喵！
        closeScanner();
        const invalidModal = document.getElementById('invalid-qr-modal');
        const invalidContent = document.getElementById('invalid-qr-content');
        if (invalidModal && invalidContent) {
            invalidContent.innerText = decoded;
            invalidModal.style.display = 'flex';
        }
    }
}

// --- 事件绑定 ---
document.getElementById('scan-btn').addEventListener('click', openScanner);
document.getElementById('close-scanner-btn').addEventListener('click', closeScanner);
document.getElementById('settings-btn').addEventListener('click', () => { settingsModal.style.display = 'flex'; });
document.getElementById('close-settings').addEventListener('click', () => { settingsModal.style.display = 'none'; });
document.getElementById('add-fab').addEventListener('click', () => { addModal.style.display = 'flex'; });
document.getElementById('cancel-btn').addEventListener('click', () => { addModal.style.display = 'none'; });

document.getElementById('confirm-add-btn').addEventListener('click', () => {
    const s = document.getElementById('secret').value.trim();
    if (!s) return;
    accounts.push({
        issuer: document.getElementById('issuer').value.trim() || '手动',
        label: document.getElementById('label').value.trim(),
        secret: s,
        createdAt: Date.now()
    });
    saveData();
    addModal.style.display = 'none';
});

window.openEditModal = function(e, idx) {
    e.stopPropagation();
    const a = accounts[idx];
    document.getElementById('edit-index').value = idx;
    document.getElementById('edit-issuer').value = a.issuer;
    document.getElementById('edit-label').value = a.label;
    document.getElementById('edit-secret').value = a.secret || '';
    editModal.style.display = 'flex';
};

document.getElementById('cancel-edit-btn').addEventListener('click', () => editModal.style.display = 'none');
document.getElementById('confirm-edit-btn').addEventListener('click', () => {
    const i = parseInt(document.getElementById('edit-index').value, 10);
    const s = document.getElementById('edit-secret').value.trim();
    if (s) accounts[i].secret = s;
    accounts[i].issuer = document.getElementById('edit-issuer').value.trim();
    accounts[i].label = document.getElementById('edit-label').value.trim();
    saveData();
    editModal.style.display = 'none';
});

document.getElementById('delete-account-btn').addEventListener('click', () => {
    const i = parseInt(document.getElementById('edit-index').value, 10);
    if (confirm('主人确定要删除这个账号吗？不可恢复哦！')) {
        accounts.splice(i, 1);
        saveData();
        editModal.style.display = 'none';
        showToast('删除成功喵！');
    }
});

// 搜索防抖喵~
let searchDebounceTimer = null;
document.getElementById('search-input').addEventListener('input', (e) => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => renderAccounts(e.target.value), 200);
});

// 设置页功能
document.getElementById('export-btn')?.addEventListener('click', () => {
    const data = JSON.stringify(accounts, null, 2);
    if (window.AndroidBridge) {
        window.AndroidBridge.exportBackup(data);
    } else {
        const a = document.createElement('a');
        a.href = 'data:application/json,' + encodeURIComponent(data);
        a.download = 'yuqing2fa_backup.json';
        a.click();
    }
});

document.getElementById('import-trigger')?.addEventListener('click', () => {
    document.getElementById('import-file').click();
});

document.getElementById('import-file')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const imported = JSON.parse(ev.target.result);
            if (Array.isArray(imported) && imported.every(a => a && typeof a.secret === 'string')) {
                accounts = imported;
                saveData();
                showToast('导入成功喵！共' + imported.length + '个账号');
                settingsModal.style.display = 'none';
            } else {
                showToast('文件格式错误：缺少必要字段喵...');
            }
        } catch (e) {
            showToast('文件格式错误喵...');
        }
    };
    reader.onerror = () => showToast('文件读取失败喵...');
    reader.readAsText(file);
    e.target.value = '';
});

document.getElementById('clear-all-btn')?.addEventListener('click', () => {
    if (confirm('真的要清空全部账号吗？这不可逆哦喵！')) {
        accounts = [];
        saveData();
        showToast('已清空喵！');
        settingsModal.style.display = 'none';
    }
});

// --- 工具函数 ---
function showToast(msg) {
    toast.innerText = msg;
    toast.style.display = 'block';
    setTimeout(() => toast.style.display = 'none', 2000);
}

function copyToClipboard(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).catch(() => fallback(text));
    } else {
        fallback(text);
    }
}

function fallback(text) {
    const el = document.createElement('textarea');
    el.value = text;
    el.style.cssText = 'position:absolute;left:-9999px;';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
}

// --- 挪动卡片顺序的魔法喵！ ---
window.moveUp = function(e, idx) {
    e.stopPropagation();
    if (idx > 0) {
        const temp = accounts[idx];
        accounts[idx] = accounts[idx - 1];
        accounts[idx - 1] = temp;
        saveData();
    }
};

window.moveDown = function(e, idx) {
    e.stopPropagation();
    if (idx < accounts.length - 1) {
        const temp = accounts[idx];
        accounts[idx] = accounts[idx + 1];
        accounts[idx + 1] = temp;
        saveData();
    }
};

// --- 批量模式相关魔法喵！ ---
function toggleBatchMode() {
    isBatchMode = !isBatchMode;
    selectedIndices.clear();
    
    // 控制底部面板和悬浮添加按钮的显示隐藏喵！
    const batchBar = document.getElementById('batch-bar');
    const fabButton = document.getElementById('add-fab');
    if (isBatchMode) {
        batchBar.style.display = 'flex';
        if (fabButton) fabButton.style.display = 'none';
    } else {
        batchBar.style.display = 'none';
        if (fabButton) fabButton.style.display = 'block';
    }
    
    updateBatchUI();
    renderAccounts(document.getElementById('search-input')?.value || '');
}

function updateBatchUI() {
    if (!isBatchMode) return;
    const count = selectedIndices.size;
    const countEl = document.getElementById('batch-count');
    const delBtn = document.getElementById('batch-delete-confirm-btn');
    if (countEl) countEl.innerText = count.toString();
    
    if (count > 0) {
        delBtn.style.opacity = '1';
        delBtn.style.pointerEvents = 'auto';
        delBtn.innerText = `删除 (${count})`;
    } else {
        delBtn.style.opacity = '0.5';
        delBtn.style.pointerEvents = 'none';
        delBtn.innerText = '删除';
    }
}

document.getElementById('batch-mode-btn')?.addEventListener('click', toggleBatchMode);
document.getElementById('batch-close-btn')?.addEventListener('click', toggleBatchMode);

document.getElementById('batch-select-all-btn')?.addEventListener('click', () => {
    // 只有在搜索框里能搜出来的才算！
    const filter = (document.getElementById('search-input')?.value || '').toLowerCase();
    const isAllSelected = selectedIndices.size > 0 && selectedIndices.size === accounts.filter(acc => (acc.issuer + acc.label).toLowerCase().includes(filter)).length;
    
    selectedIndices.clear();
    if (!isAllSelected) {
        accounts.forEach((acc, i) => {
            if ((acc.issuer + acc.label).toLowerCase().includes(filter)) {
                selectedIndices.add(i);
            }
        });
    }
    updateBatchUI();
    renderAccounts(filter);
});

document.getElementById('batch-delete-confirm-btn')?.addEventListener('click', () => {
    const count = selectedIndices.size;
    if (count === 0) return;
    if (confirm(`喵呜！主人确定要彻底粉碎选中的这 ${count} 个账号吗？\n它们可是永远都回不来了哦！`)) {
        // 从大到小删，防止索引乱套喵！
        const indicesToDelete = Array.from(selectedIndices).sort((a, b) => b - a);
        indicesToDelete.forEach(idx => {
            accounts.splice(idx, 1);
        });
        saveData();
        toggleBatchMode();
        showToast(`嘭！成功清理了 ${count} 条数据喵！✨`);
    }
});

// 绑定扫码报错面板的杂活喵！
document.getElementById('close-invalid-btn')?.addEventListener('click', () => {
    document.getElementById('invalid-qr-modal').style.display = 'none';
});
document.getElementById('copy-invalid-btn')?.addEventListener('click', () => {
    const text = document.getElementById('invalid-qr-content').innerText;
    copyToClipboard(text);
    showToast('内容拿到了喵！💖');
    document.getElementById('invalid-qr-modal').style.display = 'none';
});

// 启动！
setInterval(updateCodes, 1000);
renderAccounts();
