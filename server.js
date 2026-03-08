const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

const app = express();
const port = 3000;

// ミドルウェアの設定
app.use(cors()); // フロントエンドからの通信を許可
app.use(express.json()); // JSON形式のデータを受け取れるようにする

// HTMLファイルなどを配信（スマホからもアクセスできるようにする）
app.use(express.static(__dirname));

// Gemini APIの準備（新しい @google/genai パッケージを使用）
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY || 'dummy_key' });

/**
 * 食べたもののテキストを受け取り、カロリーとPFCバランスを返すAPI
 */
app.post('/api/analyze-food', async (req, res) => {
    try {
        const { foodText } = req.body;

        if (!foodText) {
            return res.status(400).json({ error: '食事の内容が入力されていません。' });
        }

        if (!process.env.GOOGLE_GEMINI_API_KEY) {
            return res.status(500).json({ error: 'サーバーにAPIキーが設定されていません。' });
        }

        // AIへの命令文（プロンプト）
        const prompt = `あなたは優秀な管理栄養士です。
以下の「ユーザーが食べた食事内容」を分析し、推定される「総カロリー(kcal)」、「タンパク質(g)」、「脂質(g)」、「糖質(g)」を計算してください。
必ず以下のJSON形式（データフォーマット）のみを出力してください。余計な文章やマークダウン記法（\`\`\`json など）は絶対に含めないでください。

【ユーザーが食べた食事内容】
${foodText}

【出力形式（例）】
{"cal": 350, "p": 12, "f": 8, "c": 55}`;

        console.log('AIへリクエスト送信中...', foodText);

        // AIにプロンプトを送って結果を受け取る（最新SDK）
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        const responseText = response.text.trim();
        console.log('AIの返答:', responseText);

        // JSONのパース（不要な文字を省く）
        const cleanedText = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
        let aiData;
        try {
            aiData = JSON.parse(cleanedText);
        } catch (e) {
            console.error('JSONパースエラー:', e, 'Text:', cleanedText);
            throw new Error('AIが正しい形式で回答しませんでした。');
        }

        // クライアント（フロントエンド）に返す
        res.json(aiData);

    } catch (error) {
        console.error('Gemini APIエラー:', error.message);
        res.status(500).json({ error: 'AIの解析中にエラーが発生しました。: ' + error.message });
    }
});

// サーバー起動
app.listen(port, () => {
    console.log(`✅ サーバーが起動しました！ http://localhost:${port}`);
    console.log('フロントエンドと連携する準備が完了しました。');
});
