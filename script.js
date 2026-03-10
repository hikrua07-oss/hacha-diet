/**
 * るんるんダイエット管理システム（裏側のロジック）
 * ローカルストレージを使用してデータを保存・管理します。
 */

class DietApp {
    constructor() {
        // デフォルト設定
        this.defaultProfile = {
            startDate: '2026-04-01',
            targetDate: '2027-04-01',
            startWeight: 75.0,
            targetWeight: 55.0,
            dailyCalorieTarget: 1800,
            macrosTarget: { p: 80, f: 50, c: 250 } // PFC推奨グラム
        };

        // アプリケーションの状態を初期化
        this.state = {
            profile: this.loadData('diet_profile') || this.defaultProfile,
            todayLog: this.loadData('diet_today_log') || this.createEmptyLog(),
            logs: this.loadData('diet_logs') || []
        };

        // 一時的なAI計算結果を保持
        this.currentAiMacros = { cal: 0, p: 0, f: 0, c: 0 };

        // 日付が変わっていたら前日のログを保存して新しいログを作成
        this.checkDateRollover();

        this.init();
    }

    /**
     * 初期化処理: 画面表示の更新とイベントリスナーの設定
     */
    init() {
        this.updateDashboard();
        this.setupEventListeners();
        this.updateQuickWeightStatus();
    }

    /** 空の1日分のログを作成 */
    createEmptyLog() {
        return {
            date: new Date().toISOString().split('T')[0],
            weight: null,
            calories: 0,
            macros: { p: 0, f: 0, c: 0 },
            steps: 0,
            exerciseMin: 0,
            meals: [],
            exercises: [] // 運動記録の履歴
        };
    }

    /**
     * 日付の切り替わりを検出し、前日のログを履歴に移動する
     * アプリ起動時に自動で呼ばれる
     */
    checkDateRollover() {
        const today = new Date().toISOString().split('T')[0];
        if (this.state.todayLog.date && this.state.todayLog.date !== today) {
            // 前日のログに何らかのデータがある場合、履歴に保存
            const oldLog = this.state.todayLog;
            if (oldLog.calories > 0 || oldLog.weight !== null || oldLog.steps > 0) {
                this.state.logs.push(oldLog);
                this.saveData('diet_logs', this.state.logs);
            }
            // 新しい日のログを作成（体重は前日の値を引き継ぐ）
            const lastWeight = oldLog.weight;
            this.state.todayLog = this.createEmptyLog();
            if (lastWeight) {
                this.state.todayLog.weight = lastWeight;
            }
            this.saveData('diet_today_log', this.state.todayLog);
            console.log(`📅 日付が変わりました (${oldLog.date} → ${today})。新しいログを作成しました。`);
        }
    }

    /* === データ保存・読み込み (Local Storage) === */
    saveData(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    }

    loadData(key) {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    }

    /* === UI更新処理 === */
    updateDashboard() {
        this.updateDateCalculations();
        this.updateWeightSection();
        this.updateCalorieSection();
        this.updateExerciseSection();
        this.renderWeightChart();
        this.updateMealHistory();
    }

    /** 日数計算とヘッダー更新 */
    updateDateCalculations() {
        // 目標までの残り日数
        const targetDate = new Date(this.state.profile.targetDate);
        const today = new Date();
        const diffTime = targetDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        const daysElement = document.querySelector('.highlight-days');
        if (daysElement) daysElement.textContent = diffDays > 0 ? diffDays : 0;
    }

    /** 体重カードの数値とプログレスバー更新 */
    updateWeightSection() {
        const { startWeight, targetWeight, startDate, targetDate } = this.state.profile;
        const currentWeight = this.state.todayLog.weight || startWeight;

        // --- 現在の体重を表示 ---
        const weightSpan = document.querySelector('.weight-main .number');
        if (weightSpan) weightSpan.textContent = currentWeight.toFixed(1);

        // --- 最終目標の計算と表示 ---
        const totalProgress = startWeight - currentWeight;
        const totalTarget = startWeight - targetWeight;
        const totalPercent = Math.max(0, Math.min(100, (totalProgress / totalTarget) * 100));

        const totalFill = document.querySelector('.total-fill');
        if (totalFill) totalFill.style.width = `${totalPercent}%`;

        const finalTargetEl = document.getElementById('finalTargetWeight');
        if (finalTargetEl) finalTargetEl.textContent = `${targetWeight.toFixed(1)} kg`;

        const finalRemainingEl = document.getElementById('finalRemaining');
        if (finalRemainingEl) {
            const remaining = Math.max(0, currentWeight - targetWeight);
            finalRemainingEl.textContent = `あと ${remaining.toFixed(1)} kg`;
        }

        // --- 今月の目標を動的に計算 ---
        const start = new Date(startDate);
        const end = new Date(targetDate);
        const now = new Date();
        const totalMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
        const elapsedMonths = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()) + 1;
        const monthlyDrop = totalTarget / Math.max(totalMonths, 1);
        const monthlyTargetWeight = Math.max(targetWeight, startWeight - (monthlyDrop * elapsedMonths));

        const monthlyTargetEl = document.getElementById('monthlyTargetWeight');
        if (monthlyTargetEl) monthlyTargetEl.textContent = `${monthlyTargetWeight.toFixed(1)} kg`;

        const monthlyRemainingEl = document.getElementById('monthlyRemaining');
        if (monthlyRemainingEl) {
            const monthlyRemaining = Math.max(0, currentWeight - monthlyTargetWeight);
            monthlyRemainingEl.textContent = `あと ${monthlyRemaining.toFixed(1)} kg`;
        }

        // 今月のプログレスバー計算
        const lastMonthTarget = startWeight - (monthlyDrop * Math.max(0, elapsedMonths - 1));
        const monthlyProgress = lastMonthTarget - currentWeight;
        const monthlyGoalRange = lastMonthTarget - monthlyTargetWeight;
        const monthlyPercent = Math.max(0, Math.min(100, (monthlyProgress / Math.max(monthlyGoalRange, 0.1)) * 100));

        const monthlyFill = document.querySelector('.monthly-fill');
        if (monthlyFill) monthlyFill.style.width = `${monthlyPercent}%`;

        // --- ステータスバッジの更新 ---
        const badge = document.getElementById('statusBadge');
        if (badge) {
            if (currentWeight <= monthlyTargetWeight) {
                badge.textContent = '達成！';
                badge.className = 'badge success';
            } else if (currentWeight <= lastMonthTarget) {
                badge.textContent = '順調';
                badge.className = 'badge success';
            } else {
                badge.textContent = '要注意';
                badge.className = 'badge warning';
            }
        }

        // --- クイック体重入力の状態を更新 ---
        this.updateQuickWeightStatus();
    }

    /** クイック体重入力エリアの状態表示を更新 */
    updateQuickWeightStatus() {
        const statusEl = document.getElementById('quickWeightStatus');
        const inputEl = document.getElementById('quickWeight');
        if (!statusEl) return;

        if (this.state.todayLog.weight !== null) {
            statusEl.textContent = `✅ 本日の記録: ${this.state.todayLog.weight.toFixed(1)} kg`;
            statusEl.className = 'quick-weight-status recorded';
            if (inputEl) inputEl.placeholder = this.state.todayLog.weight.toFixed(1);
        } else {
            statusEl.textContent = '';
            statusEl.className = 'quick-weight-status';
        }
    }

    /** クイック体重記録を保存 */
    saveQuickWeight() {
        const inputEl = document.getElementById('quickWeight');
        const statusEl = document.getElementById('quickWeightStatus');
        const btn = document.getElementById('quickWeightBtn');
        if (!inputEl) return;

        const weight = parseFloat(inputEl.value);
        if (isNaN(weight) || weight <= 0 || weight > 500) {
            if (statusEl) {
                statusEl.textContent = '⚠️ 有効な体重を入力してください';
                statusEl.className = 'quick-weight-status';
                statusEl.style.color = '#ef4444';
                setTimeout(() => { statusEl.style.color = ''; }, 2000);
            }
            return;
        }

        // 体重を保存
        this.state.todayLog.weight = weight;
        this.saveData('diet_today_log', this.state.todayLog);

        // ボタンに成功を示す一時演出
        if (btn) {
            btn.textContent = '✓';
            btn.style.background = 'linear-gradient(135deg, #059669, #047857)';
            setTimeout(() => {
                btn.textContent = '記録';
                btn.style.background = '';
            }, 1500);
        }

        // 入力をクリア
        inputEl.value = '';

        // ダッシュボード全体を更新
        this.updateDashboard();
    }

    /** 設定モーダルに現在の値をセット */
    openSettingsModal() {
        const p = this.state.profile;
        document.getElementById('settingStartWeight').value = p.startWeight || '';
        document.getElementById('settingTargetWeight').value = p.targetWeight || '';
        document.getElementById('settingStartDate').value = p.startDate || '';
        document.getElementById('settingTargetDate').value = p.targetDate || '';
        document.getElementById('settingCalorieTarget').value = p.dailyCalorieTarget || '';
        document.getElementById('settingTargetP').value = p.macrosTarget?.p || '';
        document.getElementById('settingTargetF').value = p.macrosTarget?.f || '';
        document.getElementById('settingTargetC').value = p.macrosTarget?.c || '';
    }

    /** 設定を保存 */
    saveSettings() {
        const startWeight = parseFloat(document.getElementById('settingStartWeight').value);
        const targetWeight = parseFloat(document.getElementById('settingTargetWeight').value);
        const startDate = document.getElementById('settingStartDate').value;
        const targetDate = document.getElementById('settingTargetDate').value;
        const calorieTarget = parseInt(document.getElementById('settingCalorieTarget').value);
        const targetP = parseInt(document.getElementById('settingTargetP').value);
        const targetF = parseInt(document.getElementById('settingTargetF').value);
        const targetC = parseInt(document.getElementById('settingTargetC').value);

        // 各フィールドを個別に更新（入力されている項目のみ）
        if (!isNaN(startWeight) && startWeight > 0) this.state.profile.startWeight = startWeight;
        if (!isNaN(targetWeight) && targetWeight > 0) this.state.profile.targetWeight = targetWeight;
        if (startDate) this.state.profile.startDate = startDate;
        if (targetDate) this.state.profile.targetDate = targetDate;
        if (!isNaN(calorieTarget) && calorieTarget > 0) this.state.profile.dailyCalorieTarget = calorieTarget;
        if (!isNaN(targetP) && targetP > 0) this.state.profile.macrosTarget.p = targetP;
        if (!isNaN(targetF) && targetF > 0) this.state.profile.macrosTarget.f = targetF;
        if (!isNaN(targetC) && targetC > 0) this.state.profile.macrosTarget.c = targetC;

        // プロフィールを保存
        this.saveData('diet_profile', this.state.profile);

        // ダッシュボードを更新
        this.updateDashboard();

        alert('設定を保存しました！ ⚙️');
    }

    /** カロリー＆PFCカードの更新 */
    updateCalorieSection() {
        const target = this.state.profile.dailyCalorieTarget;
        const targetMacros = this.state.profile.macrosTarget;
        const current = this.state.todayLog;

        // --- カロリー表示の更新 ---
        const mainCal = document.getElementById('currentCalories');
        if (mainCal) {
            mainCal.textContent = current.calories.toLocaleString();
            if (current.calories > target) {
                mainCal.classList.add('warning-text');
                document.querySelector('.calorie-card')?.classList.add('warning-state');
            } else {
                mainCal.classList.remove('warning-text');
                document.querySelector('.calorie-card')?.classList.remove('warning-state');
            }
        }

        // カロリー目標値の表示
        const targetCalText = document.getElementById('targetCaloriesText');
        if (targetCalText) targetCalText.textContent = `/ ${target.toLocaleString()} kcal`;

        // 警告アイコンの表示切替
        const warningIcon = document.getElementById('calorieWarningIcon');
        if (warningIcon) {
            warningIcon.style.display = current.calories > target ? 'inline' : 'none';
        }

        // --- PFC数値の動的更新 ---
        const updateValue = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = Math.round(val);
        };
        updateValue('currentP', current.macros.p);
        updateValue('targetP', targetMacros.p);
        updateValue('currentF', current.macros.f);
        updateValue('targetF', targetMacros.f);
        updateValue('currentC', current.macros.c);
        updateValue('targetC', targetMacros.c);

        // 脂質の数値が超過した場合の警告表示
        const macroValueF = document.getElementById('macroValueF');
        if (macroValueF) {
            if (current.macros.f > targetMacros.f) {
                macroValueF.classList.add('warning-text');
            } else {
                macroValueF.classList.remove('warning-text');
            }
        }

        // PFCプログレスバーの幅更新
        this.updateMacroBar('.macro-p', current.macros.p, targetMacros.p);
        this.updateMacroBar('.macro-f', current.macros.f, targetMacros.f);
        this.updateMacroBar('.macro-c', current.macros.c, targetMacros.c);

        // ステータスメッセージの更新
        this.updateStatusMessage();
    }

    /** 個別マクロ栄養素のバー幅更新 */
    updateMacroBar(selector, currentVal, targetVal) {
        const bar = document.querySelector(selector);
        if (bar) {
            const percent = Math.min(100, Math.max(0, (currentVal / targetVal) * 100));
            bar.style.width = `${percent}%`;
            // 超過した場合は赤くする
            if (currentVal > targetVal) {
                bar.classList.add('warning-fill');
            } else {
                bar.classList.remove('warning-fill');
            }
        }
    }

    /** ステータスメッセージを動的に更新 */
    updateStatusMessage() {
        const msgEl = document.getElementById('statusMessage');
        if (!msgEl) return;

        const current = this.state.todayLog;
        const targetMacros = this.state.profile.macrosTarget;
        const targetCal = this.state.profile.dailyCalorieTarget;

        // デフォルトスタイルをリセット
        msgEl.className = 'status-message';

        if (current.calories === 0 && current.macros.p === 0) {
            // まだ何も記録していない
            msgEl.textContent = '今日はまだ記録がありません。食事を記録しましょう！ 🍽️';
            msgEl.classList.add('status-info');
            return;
        }

        const overItems = [];
        if (current.calories > targetCal) overItems.push('カロリー');
        if (current.macros.f > targetMacros.f) overItems.push('脂質');
        if (current.macros.c > targetMacros.c) overItems.push('糖質');

        const shortItems = [];
        if (current.macros.p < targetMacros.p * 0.7) shortItems.push('タンパク質');

        if (overItems.length > 0) {
            const advice = shortItems.length > 0
                ? `補うべきは${shortItems.join('と')}！`
                : '残りの食事で調整しましょう！';
            msgEl.textContent = `${overItems.join('と')}がオーバー気味です。${advice}`;
        } else {
            msgEl.textContent = 'バランス良く食べられています！ 👍';
            msgEl.classList.add('status-good');
        }
    }

    updateExerciseSection() {
        // 既存データの互換性保持（古いデータにexerciseMin/exercisesがない場合）
        if (typeof this.state.todayLog.exerciseMin !== 'number' || isNaN(this.state.todayLog.exerciseMin)) {
            this.state.todayLog.exerciseMin = 0;
        }
        if (!Array.isArray(this.state.todayLog.exercises)) {
            this.state.todayLog.exercises = [];
        }

        // 歩数表示
        const stepsEl = document.getElementById('stepsDisplay');
        if (stepsEl) {
            stepsEl.innerHTML = `${this.state.todayLog.steps.toLocaleString()}<small>歩</small>`;
        }
        // 運動時間表示
        const minEl = document.getElementById('exerciseMinDisplay');
        if (minEl) {
            minEl.innerHTML = `${this.state.todayLog.exerciseMin}<small>分</small>`;
        }
        // 運動履歴表示
        this.updateExerciseHistory();
    }

    /** 体重推移グラフを描画 */
    renderWeightChart() {
        const canvas = document.getElementById('weightChart');
        const emptyMsg = document.getElementById('chartEmpty');
        const periodLabel = document.getElementById('chartPeriod');
        if (!canvas) return;

        // 既存のチャートを破棄
        if (this.weightChart) this.weightChart.destroy();

        // データ収集（履歴 + 今日）
        const dataPoints = [];
        const labels = [];

        this.state.logs.forEach(log => {
            if (log.weight) {
                labels.push(this.formatDateLabel(log.date));
                dataPoints.push(log.weight);
            }
        });

        const todayWeight = this.state.todayLog.weight;
        if (todayWeight) {
            labels.push('今日');
            dataPoints.push(todayWeight);
        }

        // データがない場合はプレースホルダー表示
        if (dataPoints.length === 0) {
            if (emptyMsg) emptyMsg.style.display = 'block';
            canvas.style.display = 'none';
            if (periodLabel) periodLabel.textContent = 'データなし';
            return;
        }

        if (emptyMsg) emptyMsg.style.display = 'none';
        canvas.style.display = 'block';
        if (periodLabel) periodLabel.textContent = `${dataPoints.length}件の記録`;

        const ctx = canvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 200);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.15)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');

        this.weightChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: '体重',
                        data: dataPoints,
                        borderColor: '#3b82f6',
                        backgroundColor: gradient,
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: '#3b82f6',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: dataPoints.length > 20 ? 2 : 4,
                        borderWidth: 2.5,
                    },
                    {
                        label: '最終目標',
                        data: Array(labels.length).fill(this.state.profile.targetWeight),
                        borderColor: 'rgba(16, 185, 129, 0.5)',
                        borderDash: [6, 4],
                        pointRadius: 0,
                        borderWidth: 1.5,
                        fill: false,
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { intersect: false, mode: 'index' },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(30, 41, 59, 0.9)',
                        titleFont: { size: 12 },
                        bodyFont: { size: 13, weight: '600' },
                        padding: 10,
                        cornerRadius: 8,
                        callbacks: {
                            label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)} kg`
                        }
                    }
                },
                scales: {
                    y: {
                        grid: { color: 'rgba(0,0,0,0.04)' },
                        ticks: { font: { size: 11 }, callback: v => v + 'kg' },
                        suggestedMin: this.state.profile.targetWeight - 2,
                    },
                    x: {
                        grid: { display: false },
                        ticks: { font: { size: 10 }, maxRotation: 0 }
                    }
                }
            }
        });
    }

    /** 日付ラベルをM/D形式に変換 */
    formatDateLabel(dateStr) {
        const parts = dateStr.split('-');
        return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
    }

    /** 食事履歴一覧を更新 */
    updateMealHistory() {
        const mealList = document.getElementById('mealList');
        const mealHistory = document.getElementById('mealHistory');
        if (!mealList) return;

        const meals = this.state.todayLog.meals || [];

        if (meals.length === 0) {
            mealList.innerHTML = '<p class="no-meals">まだ食事の記録がありません</p>';
            return;
        }

        mealList.innerHTML = meals.map((meal, i) => `
            <div class="meal-item">
                <div class="meal-item-top">
                    <span class="meal-time">${meal.time || ''}</span>
                    <span class="meal-cal">${meal.cal} kcal</span>
                </div>
                <div class="meal-text">${meal.text}</div>
                <div class="meal-pfc">
                    <span class="pfc-tag tag-p">P ${meal.p}g</span>
                    <span class="pfc-tag tag-f">F ${meal.f}g</span>
                    <span class="pfc-tag tag-c">C ${meal.c}g</span>
                </div>
            </div>
        `).join('');
    }

    /* === アクション/イベント === */
    setupEventListeners() {
        // AIボタン
        const aiBtn = document.querySelector('.ai-btn');
        if (aiBtn) {
            aiBtn.addEventListener('click', () => {
                this.requestAIsuggestion();
            });
        }

        // モーダル開閉
        const modal = document.getElementById('inputModal');
        const openModalBtn = document.getElementById('openAddModalBtn');
        const closeModalBtn = document.getElementById('closeModalBtn');

        if (openModalBtn && modal) {
            openModalBtn.addEventListener('click', (e) => {
                e.preventDefault();
                // プレースホルダーとして現在の値、または空を入れる
                document.getElementById('inputWeight').value = this.state.todayLog.weight || this.state.profile.startWeight;
                document.getElementById('inputFood').value = '';
                document.getElementById('inputSteps').value = '';

                // AI計算リセット
                this.currentAiMacros = { cal: 0, p: 0, f: 0, c: 0 };
                document.getElementById('aiCalcResult').style.display = 'none';

                modal.classList.add('active');
            });
        }

        if (closeModalBtn && modal) {
            closeModalBtn.addEventListener('click', () => {
                modal.classList.remove('active');
            });
        }

        // フォーム送信（記録保存）
        const recordForm = document.getElementById('recordForm');
        if (recordForm) {
            recordForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveDailyRecord();
                modal.classList.remove('active');
            });
        }

        // AI食事計算ボタン
        const calcFoodBtn = document.getElementById('calcFoodBtn');
        if (calcFoodBtn) {
            calcFoodBtn.addEventListener('click', () => {
                this.simulateAIFoodCalculation();
            });
        }

        // AI夕食提案ボタン
        const aiSuggestBtn = document.getElementById('aiSuggestBtn');
        if (aiSuggestBtn) {
            aiSuggestBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.requestAISuggestion();
            });
        }

        // 運動記録モーダル
        const exerciseModal = document.getElementById('exerciseModal');
        const openExBtn = document.getElementById('openExerciseModalBtn');
        const closeExBtn = document.getElementById('closeExerciseModalBtn');

        if (openExBtn && exerciseModal) {
            openExBtn.addEventListener('click', () => {
                document.getElementById('exerciseDuration').value = '';
                document.getElementById('exerciseMemo').value = '';
                exerciseModal.classList.add('active');
            });
        }
        if (closeExBtn && exerciseModal) {
            closeExBtn.addEventListener('click', () => {
                exerciseModal.classList.remove('active');
            });
        }

        // 運動種類チップ選択
        const typeSelector = document.getElementById('exerciseTypeSelector');
        if (typeSelector) {
            typeSelector.addEventListener('click', (e) => {
                const chip = e.target.closest('.type-chip');
                if (!chip) return;
                typeSelector.querySelectorAll('.type-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
            });
        }

        // 運動フォーム送信
        const exerciseForm = document.getElementById('exerciseForm');
        if (exerciseForm) {
            exerciseForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveExerciseRecord();
                exerciseModal.classList.remove('active');
            });
        }

        // --- クイック体重記録 ---
        const quickWeightBtn = document.getElementById('quickWeightBtn');
        if (quickWeightBtn) {
            quickWeightBtn.addEventListener('click', () => {
                this.saveQuickWeight();
            });
        }

        // クイック体重入力欄でEnterで保存
        const quickWeightInput = document.getElementById('quickWeight');
        if (quickWeightInput) {
            quickWeightInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.saveQuickWeight();
                }
            });
        }

        // --- 設定モーダル ---
        const settingsModal = document.getElementById('settingsModal');
        const openSettingsBtn = document.getElementById('openSettingsBtn');
        const closeSettingsBtn = document.getElementById('closeSettingsBtn');

        if (openSettingsBtn && settingsModal) {
            openSettingsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.openSettingsModal();
                settingsModal.classList.add('active');
            });
        }

        if (closeSettingsBtn && settingsModal) {
            closeSettingsBtn.addEventListener('click', () => {
                settingsModal.classList.remove('active');
            });
        }

        // 設定フォーム送信
        const settingsForm = document.getElementById('settingsForm');
        if (settingsForm) {
            settingsForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveSettings();
                settingsModal.classList.remove('active');
            });
        }
    }

    /** バックエンド（ローカルAIサーバー）を経由してGeminiからカロリーを計算する */
    async simulateAIFoodCalculation() {
        const foodText = document.getElementById('inputFood').value.trim();
        if (!foodText) {
            alert('「何を食べましたか？」を入力してください！👀');
            return;
        }

        // ぐるぐるローディングの代わりボタンテキスト変更
        const btn = document.getElementById('calcFoodBtn');
        btn.textContent = '計算中...';
        btn.disabled = true;
        document.getElementById('aiCalcResult').style.display = 'none';

        try {
            // サーバー（中継役）にリクエストを送る（相対パスで自動的に同じサーバーに繋がる）
            const response = await fetch('/api/analyze-food', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ foodText: foodText })
            });

            if (!response.ok) {
                throw new Error('AIの解析に失敗しました。サーバーが立ち上がっているか確認してください。');
            }

            const data = await response.json();

            // 返ってきたデータを一時保存（数値が存在しない場合は0にする）
            this.currentAiMacros = {
                cal: data.cal || 0,
                p: data.p || 0,
                f: data.f || 0,
                c: data.c || 0
            };

            // 画面に反映（input要素なので .value を使用）
            document.getElementById('calcCal').value = this.currentAiMacros.cal;
            document.getElementById('calcP').value = this.currentAiMacros.p;
            document.getElementById('calcF').value = this.currentAiMacros.f;
            document.getElementById('calcC').value = this.currentAiMacros.c;

            document.getElementById('aiCalcResult').style.display = 'block';

        } catch (error) {
            console.error('AIリクエストエラー:', error);
            alert(`エラー: ${error.message}\n(※バックエンドサーバーが起動しているか確認してください)`);
        } finally {
            btn.textContent = '計算';
            btn.disabled = false;
        }
    }

    /** 入力されたデータをシステムに保存し、画面を更新する */
    saveDailyRecord() {
        const weightInput = parseFloat(document.getElementById('inputWeight').value);
        const stepsInput = parseInt(document.getElementById('inputSteps').value) || 0;

        // 画面上のAI計算結果（ユーザーが手動調整した可能性のある値）を取得
        const cal = parseFloat(document.getElementById('calcCal').value) || 0;
        const p = parseFloat(document.getElementById('calcP').value) || 0;
        const f = parseFloat(document.getElementById('calcF').value) || 0;
        const c = parseFloat(document.getElementById('calcC').value) || 0;

        // もし食事が入力されているのに計算ボタンを押していなかった時のチェック
        const foodText = document.getElementById('inputFood').value.trim();
        if (foodText && cal === 0) {
            alert('「計算」ボタンを押してカロリーを出してから保存してください！');
            return;
        }

        // 今日のログを更新（加算ベースのものと上書きベースのもの）
        if (!isNaN(weightInput)) this.state.todayLog.weight = weightInput;
        this.state.todayLog.calories += cal;
        this.state.todayLog.steps += stepsInput;
        this.state.todayLog.macros.p += p;
        this.state.todayLog.macros.f += f;
        this.state.todayLog.macros.c += c;

        // 食事内容を履歴に保存
        if (foodText && cal > 0) {
            if (!this.state.todayLog.meals) this.state.todayLog.meals = [];
            this.state.todayLog.meals.push({
                text: foodText,
                cal: Math.round(cal),
                p: Math.round(p),
                f: Math.round(f),
                c: Math.round(c),
                time: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
            });
        }

        // ローカルストレージに保存
        this.saveData('diet_today_log', this.state.todayLog);

        // 画面の更新
        this.updateDashboard();

        // 成功を伝える簡単なアラート (将来的にはトースト通知等にする)
        alert('記録を保存しました！✨');
    }

    /** 運動記録を保存 */
    saveExerciseRecord() {
        const duration = parseInt(document.getElementById('exerciseDuration').value) || 0;
        const memo = document.getElementById('exerciseMemo').value.trim();
        const activeChip = document.querySelector('#exerciseTypeSelector .type-chip.active');
        const exerciseType = activeChip ? activeChip.dataset.type : 'その他';

        if (duration <= 0) {
            alert('運動時間を入力してください！');
            return;
        }

        // 運動時間を加算
        this.state.todayLog.exerciseMin += duration;

        // 運動履歴に保存
        if (!this.state.todayLog.exercises) this.state.todayLog.exercises = [];
        this.state.todayLog.exercises.push({
            type: exerciseType,
            duration: duration,
            memo: memo,
            time: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
        });

        this.saveData('diet_today_log', this.state.todayLog);
        this.updateDashboard();
        alert('運動を記録しました！💪');
    }

    /** 運動履歴一覧を更新 */
    updateExerciseHistory() {
        const historyEl = document.getElementById('exerciseHistory');
        const listEl = document.getElementById('exerciseList');
        if (!historyEl || !listEl) return;

        const exercises = this.state.todayLog.exercises || [];

        if (exercises.length === 0) {
            historyEl.style.display = 'none';
            return;
        }

        historyEl.style.display = 'block';
        listEl.innerHTML = exercises.map(ex => `
            <div class="meal-item">
                <div class="meal-item-top">
                    <span class="meal-time">${ex.time || ''}</span>
                    <span class="meal-cal">${ex.duration}分</span>
                </div>
                <div class="meal-text">${ex.type}${ex.memo ? ' — ' + ex.memo : ''}</div>
            </div>
        `).join('');
    }

    /** AIに夏飯提案をリクエスト */
    async requestAISuggestion() {
        const btn = document.getElementById('aiSuggestBtn');
        const resultDiv = document.getElementById('aiSuggestionResult');
        const textDiv = document.getElementById('aiSuggestionText');

        if (!btn || !resultDiv || !textDiv) return;

        // ローディング状態
        btn.textContent = 'AIが考え中...';
        btn.disabled = true;
        resultDiv.style.display = 'none';

        // 現在のPFC状況を取得
        const current = this.state.todayLog;
        const target = this.state.profile;

        const context = `今日ここまでの摂取:
- カロリー: ${current.calories} / ${target.dailyCalorieTarget} kcal
- タンパク質: ${Math.round(current.macros.p)} / ${target.macrosTarget.p} g
- 脂質: ${Math.round(current.macros.f)} / ${target.macrosTarget.f} g
- 糖質: ${Math.round(current.macros.c)} / ${target.macrosTarget.c} g
残りのカロリー枠: ${Math.max(0, target.dailyCalorieTarget - current.calories)} kcal`;

        try {
            const response = await fetch('/api/analyze-food', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    foodText: `以下の栄養状況を踏まえて、不足している栄養素を補い、超過しているものを抑えた「おすすめの夜ご飯メニュー」を1つ提案してください。
JSONではなく、日本語の文章で以下の形式で回答してください。
「メニュー名」と「理由（短く）」と「推定カロリー」を含めてください。

${context}`
                })
            });

            if (!response.ok) throw new Error('サーバーエラー');

            // AI提案用のAPIエンドポイントがまだJSON返却のみの場合のフォールバック
            const data = await response.json();
            let suggestionHtml = '';

            if (typeof data === 'string') {
                suggestionHtml = data;
            } else if (data.suggestion) {
                suggestionHtml = data.suggestion;
            } else {
                // JSONデータをメニュー提案として整形
                const remaining = {
                    cal: Math.max(0, target.dailyCalorieTarget - current.calories),
                    p: Math.max(0, target.macrosTarget.p - current.macros.p),
                    f: Math.max(0, target.macrosTarget.f - current.macros.f),
                    c: Math.max(0, target.macrosTarget.c - current.macros.c)
                };
                suggestionHtml = `
                    <strong>おすすめ: タンパク質中心の食事</strong><br>
                    <span class="suggestion-desc">
                        残りのカロリー枠は <strong>${remaining.cal} kcal</strong>。<br>
                        タンパク質をあと <strong>${Math.round(remaining.p)}g</strong> 摂りたいところ。<br>
                        → 鶏むね肉のサラダ、豆腐ステーキ、焼き魚定食などがおすすめです！
                    </span>
                `;
            }

            textDiv.innerHTML = suggestionHtml;
            resultDiv.style.display = 'block';

        } catch (error) {
            console.error('AI提案エラー:', error);
            // オフラインでも基本的な提案を表示
            const remaining = {
                cal: Math.max(0, target.dailyCalorieTarget - current.calories),
                p: Math.max(0, Math.round(target.macrosTarget.p - current.macros.p)),
            };
            textDiv.innerHTML = `
                <strong>おすすめ: タンパク質重視の食事</strong><br>
                <span class="suggestion-desc">
                    残りカロリー: <strong>${remaining.cal} kcal</strong>、
                    タンパク質あと: <strong>${remaining.p}g</strong><br>
                    → 鶏むね・豆腐・卵などでタンパク質を補いましょう！
                </span>
            `;
            resultDiv.style.display = 'block';
        } finally {
            btn.textContent = 'AIに最適な夜ご飯を提案してもらう';
            btn.disabled = false;
        }
    }
}

// アプリケーション起動
document.addEventListener('DOMContentLoaded', () => {
    window.app = new DietApp();
});
