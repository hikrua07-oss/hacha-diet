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

        this.init();
    }

    /**
     * 初期化処理: 画面表示の更新とイベントリスナーの設定
     */
    init() {
        // まずテストデータで上書き（開発中のみ）
        this.state.todayLog = {
            weight: 65.2,
            calories: 2100,
            macros: { p: 55, f: 85, c: 220 },
            steps: 5230,
            exerciseCode: 15
        };
        this.saveData('diet_today_log', this.state.todayLog);

        this.updateDashboard();
        this.setupEventListeners();
    }

    /** 空の1日分のログを作成 */
    createEmptyLog() {
        return {
            date: new Date().toISOString().split('T')[0],
            weight: null,
            calories: 0,
            macros: { p: 0, f: 0, c: 0 },
            steps: 0,
            exerciseMin: 0
        };
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
        const { startWeight, targetWeight } = this.state.profile;
        const currentWeight = this.state.todayLog.weight || startWeight;

        // --- 画面要素への反映 ---
        const weightSpan = document.querySelector('.weight-main .number');
        if (weightSpan) weightSpan.textContent = currentWeight.toFixed(1);

        // 最終目標 (1年後)の計算
        const totalProgress = startWeight - currentWeight;
        const totalTarget = startWeight - targetWeight;
        const totalPercent = Math.max(0, Math.min(100, (totalProgress / totalTarget) * 100));

        const totalFill = document.querySelector('.total-fill');
        if (totalFill) totalFill.style.width = `${totalPercent}%`;

        // 今月の目標計算 (毎月約0.8kg減らすと仮定)
        // 本来は日付と比較して動的に変わるが、モックとして固定値を計算
        const expectedMonthlyDrop = totalTarget / 12;
        const monthlyTargetWeight = currentWeight - expectedMonthlyDrop;

        // 今月のプログレスバーも仮の進捗で埋める（例として65%を使用）
        const monthlyFill = document.querySelector('.monthly-fill');
        if (monthlyFill) monthlyFill.style.width = '65%';
    }

    /** カロリー＆PFCカードの更新 */
    updateCalorieSection() {
        const target = this.state.profile.dailyCalorieTarget;
        const targetMacros = this.state.profile.macrosTarget;
        const current = this.state.todayLog;

        const mainCal = document.querySelector('.metric-main');
        if (mainCal) {
            mainCal.textContent = current.calories.toLocaleString();
            // カロリー超過ならクラスを付与
            if (current.calories > target) {
                mainCal.classList.add('warning-text');
                document.querySelector('.calorie-card').classList.add('warning-state');
            } else {
                mainCal.classList.remove('warning-text');
                document.querySelector('.calorie-card').classList.remove('warning-state');
            }
        }

        // PFCグラフの幅更新
        this.updateMacroBar('.macro-p', current.macros.p, targetMacros.p);
        this.updateMacroBar('.macro-f', current.macros.f, targetMacros.f);
        this.updateMacroBar('.macro-c', current.macros.c, targetMacros.c);
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

    updateExerciseSection() {
        const stepsElement = document.querySelector('.activity-item:first-child .activity-value');
        if (stepsElement) {
            stepsElement.innerHTML = `${this.state.todayLog.steps.toLocaleString()}<small>歩</small>`;
        }
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

            // 画面に反映
            document.getElementById('calcCal').textContent = this.currentAiMacros.cal;
            document.getElementById('calcP').textContent = this.currentAiMacros.p;
            document.getElementById('calcF').textContent = this.currentAiMacros.f;
            document.getElementById('calcC').textContent = this.currentAiMacros.c;

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

        // 計算済みのAIマクロ栄養素を取得
        const { cal, p, f, c } = this.currentAiMacros;

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

        // ローカルストレージに保存
        this.saveData('diet_today_log', this.state.todayLog);

        // 画面の更新
        this.updateDashboard();

        // 成功を伝える簡単なアラート (将来的にはトースト通知等にする)
        alert('記録を保存しました！✨');
    }

    /** AI（Gemini等）に提案をリクエストする（シミュレーション） */
    requestAIsuggestion() {
        // フロントエンドに直接APIキーを持たせない設計にするため、
        // 今後バックエンド（Serverless Functionなど）にリクエストを送る形になります。
        alert('【AI提案リクエスト】\n現在、脂質(85g)が目標(50g)を大幅に超えています！\nバックエンドを通じて、タンパク質中心のメニューをAIに取得します... (将来的にはGemini API連携を実装)');
    }
}

// アプリケーション起動
document.addEventListener('DOMContentLoaded', () => {
    window.app = new DietApp();
});
