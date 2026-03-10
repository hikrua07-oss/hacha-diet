/**
 * Service Worker - Hacha Diet PWA
 * オフラインキャッシュとバックグラウンド同期を管理する
 */

const CACHE_NAME = 'hacha-diet-v1';
const STATIC_CACHE_NAME = 'hacha-diet-static-v1';

// キャッシュする静的ファイル一覧
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/manifest.json',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap',
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js'
];

/**
 * インストールイベント: 静的ファイルをキャッシュに保存
 */
self.addEventListener('install', (event) => {
    console.log('[SW] インストール中...');
    event.waitUntil(
        caches.open(STATIC_CACHE_NAME)
            .then((cache) => {
                console.log('[SW] 静的ファイルをキャッシュに保存');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting()) // 即座にアクティブ化
    );
});

/**
 * アクティベートイベント: 古いキャッシュを削除
 */
self.addEventListener('activate', (event) => {
    console.log('[SW] アクティベート');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== STATIC_CACHE_NAME && name !== CACHE_NAME)
                    .map((name) => {
                        console.log(`[SW] 古いキャッシュを削除: ${name}`);
                        return caches.delete(name);
                    })
            );
        }).then(() => self.clients.claim()) // すべてのタブに即座に適用
    );
});

/**
 * フェッチイベント: リクエストの処理戦略
 * - API リクエスト: ネットワーク優先 → 失敗時はエラー返却
 * - 静的ファイル: キャッシュ優先 → なければネットワーク
 */
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // API リクエストはネットワーク優先（キャッシュしない）
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(request)
                .catch(() => {
                    return new Response(
                        JSON.stringify({ error: 'オフラインのため、AI機能は利用できません。' }),
                        {
                            status: 503,
                            headers: { 'Content-Type': 'application/json' }
                        }
                    );
                })
        );
        return;
    }

    // 静的ファイル: キャッシュ優先 → ネットワークフォールバック
    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
                // キャッシュがあればそれを返しつつ、バックグラウンドで更新
                event.waitUntil(
                    fetch(request)
                        .then((networkResponse) => {
                            if (networkResponse && networkResponse.status === 200) {
                                caches.open(STATIC_CACHE_NAME).then((cache) => {
                                    cache.put(request, networkResponse);
                                });
                            }
                        })
                        .catch(() => { /* ネットワーク障害時は無視 */ })
                );
                return cachedResponse;
            }

            // キャッシュにない場合はネットワークから取得してキャッシュ
            return fetch(request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseToCache = networkResponse.clone();
                    caches.open(STATIC_CACHE_NAME).then((cache) => {
                        cache.put(request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // オフラインでHTMLリクエストの場合はキャッシュのindex.htmlを返す
                if (request.headers.get('accept')?.includes('text/html')) {
                    return caches.match('/index.html');
                }
                return new Response('オフラインです', { status: 503 });
            });
        })
    );
});
