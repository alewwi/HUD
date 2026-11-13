// Маленький сервер для стендов: стенды грузят модули и manifest.json, а браузер
// не даёт делать это из file://. Запуск: node tests/tools/serve.mjs [стенд.html]
// (или двойной клик по tests/tools/stand.cmd). Отдаёт папку расширения на
// http://127.0.0.1:8765/ и открывает стенд в браузере.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';

const КОРЕНЬ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ПОРТ = Number(process.env.PORT) || 8765;
const СТЕНД = process.argv[2] || 'seasons-stand.html';
const ТИПЫ = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
};

const сервер = http.createServer((req, res) => {
  let путь;
  try { путь = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400).end(); return; }
  if (путь === '/') { res.writeHead(302, { Location: '/tests/tools/' + СТЕНД }).end(); return; }
  const файл = path.join(КОРЕНЬ, путь);
  if (!файл.startsWith(КОРЕНЬ)) { res.writeHead(403).end(); return; }
  fs.readFile(файл, (ошибка, данные) => {
    if (ошибка) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('нет файла: ' + путь); return; }
    res.writeHead(200, { 'Content-Type': ТИПЫ[path.extname(файл).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(данные);
  });
});

сервер.on('error', (e) => {
  if (e.code === 'EADDRINUSE') { console.log('Сервер уже запущен, открываю стенд.'); открыть(); setTimeout(() => process.exit(0), 500); }
  else { console.error(e); process.exit(1); }
});
сервер.listen(ПОРТ, '127.0.0.1', () => {
  console.log(`Стенды: http://127.0.0.1:${ПОРТ}/tests/tools/${СТЕНД}\nЗакрой это окно, чтобы остановить сервер.`);
  открыть();
});

function открыть() {
  if (process.env.NO_OPEN) return;
  const адрес = `http://127.0.0.1:${ПОРТ}/tests/tools/${СТЕНД}`;
  const команда = process.platform === 'win32' ? `start "" "${адрес}"` : process.platform === 'darwin' ? `open "${адрес}"` : `xdg-open "${адрес}"`;
  exec(команда);
}
