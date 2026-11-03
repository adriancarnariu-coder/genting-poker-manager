import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const files = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/model.js': ['model.js', 'text/javascript'], '/importer.js': ['importer.js', 'text/javascript'], '/store.js': ['store.js','text/javascript'], '/style.css': ['style.css', 'text/css'], '/vendor/xlsx.full.min.cjs':['vendor/xlsx.full.min.cjs','text/javascript'] };
for (const name of ['qualified-1a.xlsx','qualified-1b.xlsx','entries-1a.xls','reentries-1a.xlsx']) files['/samples/'+name]=['samples/'+name,'application/octet-stream'];
for (const name of ['upload.js','excel-worker.js']) files['/'+name]=[name,'text/javascript'];
const server = createServer(async (req, res) => {
  const file = files[new URL(req.url, 'http://localhost').pathname];
  if (!file || !['GET', 'HEAD'].includes(req.method)) { res.writeHead(404); return res.end('Not found'); }
  try {
    const body = await readFile(new URL(`./public/${file[0]}`, import.meta.url));
    res.writeHead(200, { 'Content-Type': `${file[1]}; charset=utf-8`, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache', 'Content-Security-Policy': "default-src 'self'; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'" });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch { res.writeHead(500); res.end('Unable to load application'); }
});
server.listen(Number(process.env.PORT || 3000), process.env.HOST || '127.0.0.1', () => console.log(`Genting Poker Manager running on port ${server.address().port}`));
