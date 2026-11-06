import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname,resolve} from 'node:path';
const root=resolve('dist');const mime={'.html':'text/html','.js':'text/javascript','.cjs':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml'};
createServer(async(req,res)=>{const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=resolve(root,'.'+(path==='/'?'/index.html':path));if(!file.startsWith(root+'/')&&!file.startsWith(root+'\\')){res.writeHead(403);res.end();return;}try{const body=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; img-src 'self' blob: data:; worker-src 'self'; object-src 'none'"});res.end(body);}catch{res.writeHead(404);res.end('Not found');}}).listen(3001,'127.0.0.1',()=>console.log('http://127.0.0.1:3001'));
