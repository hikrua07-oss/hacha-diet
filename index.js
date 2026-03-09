const express = require('express');
const path = require('path');
const app = express();

// 静的ファイルの配信
app.use(express.static(path.join(__dirname)));

// 全てのリクエストをindex.htmlに送る（SPA的なルーティング）
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ポート設定（ローカル実行用）
const port = process.env.PORT || 3000;
if (require.main === module) {
    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
}

module.exports = app;
