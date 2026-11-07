import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = process.env.VELXIO_WEB_ROOT || path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist')
const PORT = Number(process.env.VELXIO_WEB_PORT || 3080)
const API_TARGET = process.env.VELXIO_API_TARGET || 'http://127.0.0.1:8001'
const ALLOWED_FRAME_ANCESTORS = [
  "'self'",
  'https://kananosatemproject.qzz.io',
  'https://velxio.kananosa.com',
  'https://100.125.89.83:8080',
  'http://100.125.89.83:8080',
  'http://127.0.0.1:5173',
  'http://localhost:5173',
].join(' ')

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': `frame-ancestors ${ALLOWED_FRAME_ANCESTORS}`,
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
}

const buckets = new Map()

function clientIp(req) {
  const forwarded = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded) return forwarded.split(',')[0].trim()
  return req.socket.remoteAddress || 'unknown'
}

function rateLimit(req, res, name, limit, windowMs) {
  const key = `${name}:${clientIp(req)}`
  const now = Date.now()
  const current = buckets.get(key)
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    if (buckets.size > 5000) {
      for (const [bucketKey, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(bucketKey)
    }
    return true
  }
  if (current.count >= limit) {
    res.writeHead(429, {
      ...SECURITY_HEADERS,
      'Content-Type': 'application/json; charset=utf-8',
      'Retry-After': String(Math.ceil((current.resetAt - now) / 1000)),
    })
    res.end(JSON.stringify({ detail: '请求过于频繁，请稍后再试' }))
    return false
  }
  current.count += 1
  return true
}

function setHeaders(res) {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(key, value)
}

function sendFile(res, filePath) {
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Not found')
      return
    }
    const ext = path.extname(filePath).toLowerCase()
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': stat.size,
    })
    fs.createReadStream(filePath).pipe(res)
  })
}

function proxy(req, res) {
  const target = new URL(req.url || '/', API_TARGET)
  const upstream = http.request(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port,
      method: req.method,
      path: target.pathname + target.search,
      headers: { ...req.headers, host: target.host },
    },
    (upstreamRes) => {
      const headers = { ...upstreamRes.headers, ...SECURITY_HEADERS }
      res.writeHead(upstreamRes.statusCode || 502, headers)
      upstreamRes.pipe(res)
    },
  )
  upstream.on('error', (error) => {
    if (!res.headersSent) {
      res.writeHead(502, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' })
    }
    res.end(`Velxio API unavailable: ${error.message}`)
  })
  req.pipe(upstream)
}

const server = http.createServer((req, res) => {
  setHeaders(res)
  let pathname
  try {
    pathname = decodeURIComponent((req.url || '/').split('?')[0])
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Bad request')
    return
  }

  if (pathname.startsWith('/api/')) {
    if (!rateLimit(req, res, 'api', 120, 60_000)) return
    if (
      (pathname === '/api/compile/' ||
        pathname === '/api/compile' ||
        pathname === '/api/compile/start') &&
      !rateLimit(req, res, 'compile', 10, 60_000)
    ) {
      return
    }
    if (pathname.startsWith('/api/libraries') && !rateLimit(req, res, 'libraries', 10, 60_000)) {
      return
    }
    if (pathname.startsWith('/api/flash') && !rateLimit(req, res, 'flash', 3, 60_000)) {
      return
    }
    proxy(req, res)
    return
  }

  const requested = path.resolve(ROOT, `.${pathname}`)
  if (
    requested !== ROOT &&
    requested.startsWith(ROOT + path.sep) &&
    fs.existsSync(requested) &&
    fs.statSync(requested).isFile()
  ) {
    sendFile(res, requested)
    return
  }
  sendFile(res, path.join(ROOT, 'index.html'))
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Velxio web listening on http://127.0.0.1:${PORT}`)
})
