import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { sourceHandler } from '../lib/sources.js';
const staticFiles = { '/': ['index.html', 'text/html'], '/index.html': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'] };
createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  const source = path.match(/^\/api\/(metatft|academy|qq)$/)?.[1];
  if (source) {
    res.status = code => { res.statusCode = code; return res; };
    res.json = value => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(value)); };
    return sourceHandler(source)(req, res);
  }
  if (!staticFiles[path]) { res.writeHead(404); return res.end('Not found'); }
  const [file, type] = staticFiles[path];
  res.setHeader('Content-Type', `${type}; charset=utf-8`);
  res.end(await readFile(new URL(`../${file}`, import.meta.url)));
}).listen(3000, '127.0.0.1', () => console.log('http://localhost:3000'));
