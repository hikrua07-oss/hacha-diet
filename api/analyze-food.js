const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Vercel サーバーレス関数
 * 食べたもののテキストを受け取り、GeminiにPFC・カロリーを計算させて返す
 */
module.exports = async function handler(req, res) {
    // CORS ヘッダー設定
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'POSTメソッドのみ対応しています。' });
    }

    try {
        const { foodText } = req.body;

        if (!foodText) {
            return res.status(400).json({ error: '食事の内容が入力されていません。' });
        }

        // Gemini APIの準備
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        // AIへの命令文
        const prompt = `あなたは優秀な管理栄養士です。
以下の「ユーザーが食べた食事内容」を分析し、推定される「総カロリー(kcal)」、「タンパク質(g)」、「脂質(g)」、「糖質(g)」を計算してください。
必ず以下のJSON形式のみを出力してください。余計な文章やマークダウン記法（\`\`\`json など）は絶対に含めないでください。

【ユーザーが食べた食事内容】
${foodText}

【出力形式（例）】
{"cal": 350, "p": 12, "f": 8, "c": 55}`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const cleanedText = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();

        let aiData;
        try {
            aiData = JSON.parse(cleanedText);
        } catch (e) {
            throw new Error('AIが正しい形式で回答しませんでした。');
        }

        return res.status(200).json(aiData);

    } catch (error) {
        console.error('APIエラー:', error.message);
        return res.status(500).json({ error: 'AIの解析中にエラーが発生しました。: ' + error.message });
    }
};
