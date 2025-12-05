// サンプルデータ
const SAMPLE_DATA = {
    eventTitle: '第2回赤坂マーケティング交流会',
    eventDate: '2026-01-21',
    eventType: 'networking',
    eventDetails: `マーケティング関連のビジネスパーソン向けのネットワーキングイベント。
定員50名、会場は都心のカンファレンスルーム。
プロ人材による登壇ピッチセッションあり。
立食形式で交流タイムを設ける予定。`
};

// DOM要素の取得
const formSection = document.getElementById('form-section');
const tasksSection = document.getElementById('tasks-section');
const guideSection = document.getElementById('guide-section');
const eventForm = document.getElementById('event-form');
const trySampleBtn = document.getElementById('try-sample-btn');
const eventTitleInput = document.getElementById('event-title');
const eventDateInput = document.getElementById('event-date');
const eventTypeSelect = document.getElementById('event-type');
const eventDetailsTextarea = document.getElementById('event-details');
const detailsLength = document.getElementById('details-length');
const generateBtn = document.getElementById('generate-btn');
const loadingDiv = document.getElementById('loading');
const tasksLoadingDiv = document.getElementById('tasks-loading');
const regenerateBtn = document.getElementById('regenerate-btn');
const exportBtn = document.getElementById('export-btn');
const resetBtn = document.getElementById('reset-btn');
const tasksTimeline = document.getElementById('tasks-timeline');
const tasksList = document.getElementById('tasks-list');

// 文字数カウント
eventDetailsTextarea.addEventListener('input', () => {
    detailsLength.textContent = eventDetailsTextarea.value.length;
});

// お試しボタン
trySampleBtn.addEventListener('click', () => {
    eventTitleInput.value = SAMPLE_DATA.eventTitle;
    eventDateInput.value = SAMPLE_DATA.eventDate;
    eventTypeSelect.value = SAMPLE_DATA.eventType;
    eventDetailsTextarea.value = SAMPLE_DATA.eventDetails;
    detailsLength.textContent = SAMPLE_DATA.eventDetails.length;
    
    eventTitleInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    eventTitleInput.focus();
});

// プログレスバーを初期化する関数
function initializeProgress(isRegenerating = false) {
    const progressCircle = document.querySelector(isRegenerating 
        ? '#tasks-loading .progress-ring-circle' 
        : '#loading .progress-ring-circle');
    
    if (progressCircle) {
        const circumference = 2 * Math.PI * 54;
        progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
        progressCircle.style.strokeDashoffset = circumference;
    }
}

// プログレスバーを更新する関数
function updateProgress(percent, isRegenerating = false) {
    const progressCircle = document.querySelector(isRegenerating 
        ? '#tasks-loading .progress-ring-circle' 
        : '#loading .progress-ring-circle');
    const progressPercent = document.querySelector(isRegenerating 
        ? '#tasks-loading .progress-percent' 
        : '#loading .progress-percent');
    
    if (progressCircle && progressPercent) {
        const circumference = 2 * Math.PI * 54;
        const offset = circumference - (percent / 100) * circumference;
        progressCircle.style.strokeDashoffset = offset;
        progressPercent.textContent = Math.min(Math.floor(percent), 100);
    }
}

// プログレスアニメーションを開始
function startProgressAnimation(isRegenerating = false) {
    initializeProgress(isRegenerating);
    updateProgress(0, isRegenerating);
    
    let progress = 0;
    const targetProgress = 95;
    const duration = 25000;
    const interval = 50;
    const increment = (targetProgress / duration) * interval;
    
    const progressInterval = setInterval(() => {
        progress += increment;
        if (progress < targetProgress) {
            updateProgress(progress, isRegenerating);
        } else {
            updateProgress(targetProgress, isRegenerating);
            clearInterval(progressInterval);
        }
    }, interval);
    
    return progressInterval;
}

// タスクリスト生成（共通関数）
async function generateTasksFromForm(isRegenerating = false) {
    const formData = {
        eventTitle: eventTitleInput.value.trim(),
        eventDate: eventDateInput.value,
        eventType: eventTypeSelect.value,
        eventDetails: eventDetailsTextarea.value.trim()
    };
    
    if (!formData.eventTitle || !formData.eventDate || !formData.eventDetails) {
        alert('イベント名、開催日、詳細を入力してください。');
        return null;
    }
    
    // ローディング表示
    let progressInterval;
    if (isRegenerating) {
        if (tasksLoadingDiv) {
            tasksLoadingDiv.classList.add('active');
            setTimeout(() => {
                progressInterval = startProgressAnimation(true);
            }, 100);
        }
        if (regenerateBtn) {
            regenerateBtn.disabled = true;
            regenerateBtn.textContent = '🔄 再生成中...';
        }
    } else {
        generateBtn.disabled = true;
        generateBtn.textContent = '✨ 生成中...';
        if (regenerateBtn) regenerateBtn.disabled = true;
        if (loadingDiv) {
            loadingDiv.style.display = 'block';
            setTimeout(() => {
                progressInterval = startProgressAnimation(false);
            }, 100);
        }
    }
    
    try {
        let tasks;
        try {
            tasks = await generateTasksWithAI(formData);
            if (progressInterval) clearInterval(progressInterval);
            updateProgress(100, isRegenerating);
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (apiError) {
            console.warn('バックエンドAPIエラー、テンプレートベースにフォールバック:', apiError);
            if (progressInterval) clearInterval(progressInterval);
            updateProgress(100, isRegenerating);
            await new Promise(resolve => setTimeout(resolve, 500));
            tasks = generateTasksTemplate(formData);
        }
        
        displayTasks(tasks, formData);
        window.lastFormData = formData;
        
        if (!isRegenerating) {
            tasksSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    } catch (error) {
        console.error('タスク生成エラー:', error);
        if (progressInterval) clearInterval(progressInterval);
        alert('タスクリストの生成に失敗しました。\n\nエラー: ' + error.message);
        
        const tasks = generateTasksTemplate(formData);
        displayTasks(tasks, formData);
    } finally {
        if (isRegenerating) {
            if (tasksLoadingDiv) {
                tasksLoadingDiv.classList.remove('active');
            }
            if (regenerateBtn) {
                regenerateBtn.disabled = false;
                regenerateBtn.textContent = '🔄 再生成';
            }
        } else {
            if (loadingDiv) loadingDiv.style.display = 'none';
            generateBtn.disabled = false;
            generateBtn.textContent = '✨ タスクリストを生成する';
            if (regenerateBtn) regenerateBtn.disabled = false;
        }
    }
}

// バックエンドAPIを使用したタスク生成
async function generateTasksWithAI(formData) {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const API_URL = isLocalhost 
        ? 'http://localhost:3000/api/generate'
        : '/api/generate';
    
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            eventTitle: formData.eventTitle,
            eventDate: formData.eventDate,
            eventType: formData.eventType,
            eventDetails: formData.eventDetails
        })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || `API Error: ${response.status}`);
    }

    const data = await response.json();
    return data.tasks;
}

// テンプレートベースのタスク生成（フォールバック）
function generateTasksTemplate(formData) {
    const eventDate = new Date(formData.eventDate);
    const tasks = [
        {
            category: '集客・広報',
            items: [
                {
                    name: 'メール文案作成',
                    dueDate: formatDate(addDays(eventDate, -60)),
                    status: 'pending',
                    subtasks: [
                        '招待状送付（メール）',
                        'リマインド通知配信（参加確定者向け）'
                    ]
                },
                {
                    name: '既存への声かけ',
                    dueDate: formatDate(addDays(eventDate, -60)),
                    status: 'pending'
                },
                {
                    name: '顧問への声かけ',
                    dueDate: formatDate(addDays(eventDate, -40)),
                    status: 'pending'
                }
            ]
        },
        {
            category: '当日運営準備',
            items: [
                {
                    name: '受付フロー設計＆台本作成',
                    dueDate: formatDate(addDays(eventDate, -43)),
                    status: 'pending'
                },
                {
                    name: '名札・備品搬入リスト作成',
                    dueDate: formatDate(addDays(eventDate, -14)),
                    status: 'pending'
                },
                {
                    name: '受付・誘導担当の役割分担',
                    dueDate: formatDate(addDays(eventDate, -14)),
                    status: 'pending'
                },
                {
                    name: '音響／マイクチェック',
                    dueDate: formatDate(addDays(eventDate, -14)),
                    status: 'pending'
                },
                {
                    name: 'プログラム進行リハーサル',
                    dueDate: formatDate(addDays(eventDate, -14)),
                    status: 'pending'
                }
            ]
        },
        {
            category: 'イベント実行',
            items: [
                {
                    name: '受付開始',
                    dueDate: formatDate(eventDate),
                    status: 'pending',
                    time: '18:30～'
                },
                {
                    name: '開会挨拶・趣旨説明',
                    dueDate: formatDate(eventDate),
                    status: 'pending',
                    time: '19:00'
                },
                {
                    name: 'プロ人材ピッチ',
                    dueDate: formatDate(eventDate),
                    status: 'pending',
                    time: '19:10～19:30'
                },
                {
                    name: '立食交流タイム',
                    dueDate: formatDate(eventDate),
                    status: 'pending',
                    time: '19:30～21:00'
                },
                {
                    name: 'クロージング・次回告知',
                    dueDate: formatDate(eventDate),
                    status: 'pending',
                    time: '21:00'
                },
                {
                    name: '片付け・撤収',
                    dueDate: formatDate(eventDate),
                    status: 'pending',
                    time: '21:00～21:30'
                }
            ]
        },
        {
            category: 'フォローアップ',
            items: [
                {
                    name: '参加者アンケート配信',
                    dueDate: formatDate(addDays(eventDate, 1)),
                    status: 'pending'
                },
                {
                    name: '獲得アポ件数の集計',
                    dueDate: formatDate(eventDate),
                    status: 'pending'
                },
                {
                    name: 'リードフォローリスト作成',
                    dueDate: formatDate(eventDate),
                    status: 'pending'
                },
                {
                    name: '成果報告レポート作成',
                    dueDate: formatDate(eventDate),
                    status: 'pending'
                },
                {
                    name: '次回振り返りMTG設定',
                    dueDate: formatDate(eventDate),
                    status: 'pending'
                }
            ]
        }
    ];
    
    return tasks;
}

// 日付処理関数
function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatDateDisplay(dateString) {
    const date = new Date(dateString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    const weekday = weekdays[date.getDay()];
    return `${month}月${day}日(${weekday})`;
}

// タスクを表示
function displayTasks(tasks, formData) {
    tasksTimeline.innerHTML = '';
    tasksList.innerHTML = '';
    
    // タイムライン表示
    const timelineHTML = tasks.map((category, catIndex) => {
        const items = category.items;
        if (items.length === 0) return '';
        
        const firstDate = items[0].dueDate;
        return `
            <div class="timeline-item">
                <div class="timeline-marker"></div>
                <div class="timeline-content">
                    <div class="timeline-date">${formatDateDisplay(firstDate)}</div>
                    <div class="timeline-category">${category.category}</div>
                </div>
            </div>
        `;
    }).join('');
    
    tasksTimeline.innerHTML = `<div class="timeline">${timelineHTML}</div>`;
    
    // タスクリスト表示
    const listHTML = tasks.map((category, catIndex) => {
        const itemsHTML = category.items.map((item, itemIndex) => {
            const taskId = `task-${catIndex}-${itemIndex}`;
            const subtasksHTML = item.subtasks ? item.subtasks.map((subtask, subIndex) => 
                `<div class="subtask-item">・${subtask}</div>`
            ).join('') : '';
            
            return `
                <div class="task-item" data-task-id="${taskId}">
                    <div class="task-header">
                        <div class="task-name">${item.name}</div>
                        <button class="task-status ${item.status}" data-task-id="${taskId}" data-status="${item.status}">
                            ${getStatusLabel(item.status)}
                        </button>
                    </div>
                    <div class="task-meta">
                        <div class="task-date">
                            📅 ${formatDateDisplay(item.dueDate)}
                            ${item.time ? ` ${item.time}` : ''}
                        </div>
                    </div>
                    ${subtasksHTML ? `<div class="task-subtasks">${subtasksHTML}</div>` : ''}
                </div>
            `;
        }).join('');
        
        return `
            <div class="task-category">
                <div class="category-header">
                    <div class="category-title">${category.category}</div>
                </div>
                ${itemsHTML}
            </div>
        `;
    }).join('');
    
    tasksList.innerHTML = listHTML;
    
    // ステータス変更イベントリスナーを追加
    document.querySelectorAll('.task-status').forEach(btn => {
        btn.addEventListener('click', () => {
            const taskId = btn.dataset.taskId;
            const currentStatus = btn.dataset.status;
            const nextStatus = getNextStatus(currentStatus);
            
            btn.dataset.status = nextStatus;
            btn.className = `task-status ${nextStatus}`;
            btn.textContent = getStatusLabel(nextStatus);
            
            // データも更新
            updateTaskStatus(taskId, nextStatus);
        });
    });
    
    formSection.style.display = 'none';
    guideSection.style.display = 'none';
    tasksSection.style.display = 'block';
    
    window.currentTasks = tasks;
    window.currentFormData = formData;
}

function getStatusLabel(status) {
    const labels = {
        'pending': '未着手',
        'progress': '進行中',
        'completed': '完了'
    };
    return labels[status] || '未着手';
}

function getNextStatus(currentStatus) {
    const statuses = ['pending', 'progress', 'completed'];
    const currentIndex = statuses.indexOf(currentStatus);
    const nextIndex = (currentIndex + 1) % statuses.length;
    return statuses[nextIndex];
}

function updateTaskStatus(taskId, newStatus) {
    if (!window.currentTasks) return;
    
    const [catIndex, itemIndex] = taskId.split('-').slice(1).map(Number);
    if (window.currentTasks[catIndex] && window.currentTasks[catIndex].items[itemIndex]) {
        window.currentTasks[catIndex].items[itemIndex].status = newStatus;
    }
}

// フォーム送信
eventForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    generateTasksFromForm(false);
});

// 再生成ボタン
if (regenerateBtn) {
    regenerateBtn.addEventListener('click', async () => {
        regenerateBtn.disabled = true;
        regenerateBtn.textContent = '🔄 再生成中...';
        
        if (tasksLoadingDiv) {
            tasksLoadingDiv.classList.add('active');
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (window.lastFormData) {
            generateTasksFromForm(true);
        } else {
            generateTasksFromForm(true);
        }
    });
}

// CSV出力ボタン
if (exportBtn) {
    exportBtn.addEventListener('click', () => {
        if (!window.currentTasks) {
            alert('タスクリストが生成されていません。');
            return;
        }
        
        const csv = generateCSV(window.currentTasks, window.currentFormData);
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `${window.currentFormData.eventTitle}_タスクリスト.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        exportBtn.textContent = '✓ 出力しました';
        setTimeout(() => {
            exportBtn.textContent = '📋 CSV出力';
        }, 2000);
    });
}

// CSV生成
function generateCSV(tasks, formData) {
    let csv = `イベント名,${formData.eventTitle}\n`;
    csv += `開催日,${formData.eventDate}\n`;
    csv += `イベント種別,${formData.eventType}\n\n`;
    csv += `カテゴリ,タスク名,期限日,状態,サブタスク\n`;
    
    tasks.forEach(category => {
        category.items.forEach(item => {
            const subtasks = item.subtasks ? item.subtasks.join('; ') : '';
            csv += `${category.category},${item.name},${item.dueDate},${getStatusLabel(item.status)},${subtasks}\n`;
        });
    });
    
    return csv;
}

// リセットボタン
if (resetBtn) {
    resetBtn.addEventListener('click', () => {
        eventForm.reset();
        detailsLength.textContent = '0';
        
        formSection.style.display = 'block';
        guideSection.style.display = 'block';
        tasksSection.style.display = 'none';
        
        window.currentTasks = null;
        window.currentFormData = null;
        window.lastFormData = null;
        
        formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
}

// ページ読み込み時にプログレスバーを初期化
window.addEventListener('DOMContentLoaded', () => {
    initializeProgress(false);
    initializeProgress(true);
    
    // デフォルトで今日の日付を設定
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 60);
    eventDateInput.value = formatDate(tomorrow);
});

