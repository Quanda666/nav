
/**
 * 拾光集书签导航站 - Cloudflare Worker V2 (Optimized)
 * 功能：多功能书签导航、访客投稿、后台管理、系统设置、点击统计、本地收藏、访问历史等。
 * 存储：Cloudflare D1 (数据库), Cloudflare KV (会话与配置)
 */

// --- 基础工具函数 ---

const getFavicon = async (url) => {
  if (!url) return '';
  try {
    let domain = new URL(url.startsWith('http') ? url : 'https://' + url).hostname;
    let faviconUrls = [
      `https://www.faviconextractor.com/favicon/${domain}?larger=true`,
      `https://favicon.im/${domain}?larger=true`,
      `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
      `https://${domain}/favicon.ico`,
    ];
    for (let faviconUrl of faviconUrls) {
      try {
        let response = await fetch(faviconUrl, { 
          cf: { cacheEverything: true },
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        if (response.ok && response.headers.get('content-type')?.startsWith('image/')) {
          return faviconUrl;
        }
      } catch (e) { continue; }
    }
    return '';
  } catch { return ''; }
};

function escapeHTML(input) {
  if (input === null || input === undefined) return '';
  return String(input).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function sanitizeUrl(url) {
  if (!url) return '';
  const trimmed = String(url).trim();
  try {
    const direct = new URL(trimmed);
    if (direct.protocol === 'http:' || direct.protocol === 'https:') return direct.href;
  } catch {
    try {
      const fallback = new URL(`https://${trimmed}`);
      if (fallback.protocol === 'http:' || fallback.protocol === 'https:') return fallback.href;
    } catch { return ''; }
  }
  return '';
}

function normalizeSortOrder(value) {
  if (value === undefined || value === null || value === '') return 9999;
  const parsed = Number(value);
  if (Number.isFinite(parsed)) return Math.max(-2147483648, Math.min(2147483647, Math.round(parsed)));
  return 9999;
}

function isSubmissionEnabled(env) {
  const flag = env.ENABLE_PUBLIC_SUBMISSION;
  if (flag === undefined || flag === null) return true;
  const normalized = String(flag).trim().toLowerCase();
  return normalized === 'true';
}

// --- 会话管理 ---

const SESSION_COOKIE_NAME = 'nav_admin_session';
const SESSION_PREFIX = 'session:';
const SESSION_TTL_SECONDS = 60 * 60 * 24; // 24小时

function parseCookies(cookieHeader = '') {
  return cookieHeader.split(';').map(item => item.trim()).filter(Boolean).reduce((acc, pair) => {
    const sep = pair.indexOf('=');
    if (sep === -1) acc[pair] = '';
    else acc[pair.slice(0, sep).trim()] = pair.slice(sep + 1).trim();
    return acc;
  }, {});
}

function buildSessionCookie(token, options = {}) {
  const { maxAge = SESSION_TTL_SECONDS } = options;
  const segments = [`${SESSION_COOKIE_NAME}=${token}`, 'Path=/', `Max-Age=${maxAge}`, 'HttpOnly', 'SameSite=Strict', 'Secure'];
  return segments.join('; ');
}

async function createAdminSession(env) {
  const token = crypto.randomUUID();
  await env.NAV_AUTH.put(`${SESSION_PREFIX}${token}`, JSON.stringify({ createdAt: Date.now() }), { expirationTtl: SESSION_TTL_SECONDS });
  return token;
}

async function validateAdminSession(request, env) {
  const cookies = parseCookies(request.headers.get('Cookie') || '');
  const token = cookies[SESSION_COOKIE_NAME];
  if (!token) return { authenticated: false };
  const payload = await env.NAV_AUTH.get(`${SESSION_PREFIX}${token}`);
  if (!payload) return { authenticated: false };
  return { authenticated: true, token };
}

async function isAdminAuthenticated(request, env) {
  const { authenticated } = await validateAdminSession(request, env);
  return authenticated;
}

// --- API 处理逻辑 ---

const api = {
  async handleRequest(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace('/api', '');
    const method = request.method;
    const id = url.pathname.split('/').pop();
    
    try {
      if (path === '/favicon' && method === 'GET') {
        const siteUrl = url.searchParams.get('url');
        if (!siteUrl) return this.errorResponse('URL required', 400);
        const favicon = await getFavicon(siteUrl);
        return new Response(JSON.stringify({ code: 200, favicon }), { headers: { 'Content-Type': 'application/json' } });
      }

      if (path === '/config') {
        if (method === 'GET') return await this.getConfig(request, env, ctx, url);
        if (method === 'POST') {
          if (!(await isAdminAuthenticated(request, env))) return this.errorResponse('Unauthorized', 401);
          return await this.createConfig(request, env, ctx);
        }
      }

      if (path === '/config/submit' && method === 'POST') {
        if (!isSubmissionEnabled(env)) return this.errorResponse('Public submission disabled', 403);
        return await this.submitConfig(request, env, ctx);
      }

      if (path.startsWith('/click/') && method === 'POST') {
        await env.NAV_DB.prepare('UPDATE sites SET hits = hits + 1 WHERE id = ?').bind(id).run();
        return new Response(JSON.stringify({ code: 200 }), { headers: { 'Content-Type': 'application/json' } });
      }

      if (path === '/categories' && method === 'GET') {
        const { results: orders } = await env.NAV_DB.prepare('SELECT * FROM category_orders').all();
        const { results: meta } = await env.NAV_DB.prepare('SELECT * FROM category_metadata').all();
        const { results: sites } = await env.NAV_DB.prepare('SELECT catelog, COUNT(*) as site_count, MIN(sort_order) as min_site_sort FROM sites GROUP BY catelog').all();
        
        const orderMap = new Map(orders.map(o => [o.catelog, o.sort_order]));
        const metaMap = new Map(meta.map(m => [m.catelog, m]));
        
        const data = sites.map(row => ({
          catelog: row.catelog,
          site_count: row.site_count,
          sort_order: orderMap.get(row.catelog) ?? normalizeSortOrder(row.min_site_sort),
          explicit: orderMap.has(row.catelog),
          icon: metaMap.get(row.catelog)?.icon || '',
          description: metaMap.get(row.catelog)?.description || ''
        }));
        data.sort((a, b) => a.sort_order - b.sort_order || a.catelog.localeCompare(b.catelog));
        return new Response(JSON.stringify({ code: 200, data }), { headers: { 'Content-Type': 'application/json' } });
      }

      if (path.startsWith('/categories/') && method === 'PUT') {
        if (!(await isAdminAuthenticated(request, env))) return this.errorResponse('Unauthorized', 401);
        const categoryName = decodeURIComponent(path.replace('/categories/', ''));
        const body = await request.json();
        if (body.reset) {
          await env.NAV_DB.prepare('DELETE FROM category_orders WHERE catelog = ?').bind(categoryName).run();
        } else {
          await env.NAV_DB.prepare('INSERT INTO category_orders (catelog, sort_order) VALUES (?, ?) ON CONFLICT(catelog) DO UPDATE SET sort_order = excluded.sort_order').bind(categoryName, normalizeSortOrder(body.sort_order)).run();
        }
        return new Response(JSON.stringify({ code: 200, message: 'Updated' }), { headers: { 'Content-Type': 'application/json' } });
      }

      if (path === `/config/${id}` && /^\d+$/.test(id)) {
        if (!(await isAdminAuthenticated(request, env))) return this.errorResponse('Unauthorized', 401);
        if (method === 'PUT') return await this.updateConfig(request, env, ctx, id);
        if (method === 'DELETE') {
          await env.NAV_DB.prepare('DELETE FROM sites WHERE id = ?').bind(id).run();
          return new Response(JSON.stringify({ code: 200, message: 'Deleted' }), { headers: { 'Content-Type': 'application/json' } });
        }
      }

      if (path === '/pending' && method === 'GET') {
        if (!(await isAdminAuthenticated(request, env))) return this.errorResponse('Unauthorized', 401);
        const { results } = await env.NAV_DB.prepare('SELECT * FROM pending_sites ORDER BY create_time DESC').all();
        return new Response(JSON.stringify({ code: 200, data: results }), { headers: { 'Content-Type': 'application/json' } });
      }

      if (path.startsWith('/pending/') && /^\d+$/.test(id)) {
        if (!(await isAdminAuthenticated(request, env))) return this.errorResponse('Unauthorized', 401);
        if (method === 'PUT') {
          const config = await env.NAV_DB.prepare('SELECT * FROM pending_sites WHERE id = ?').bind(id).first();
          if (!config) return this.errorResponse('Not found', 404);
          await env.NAV_DB.prepare('INSERT INTO sites (name, url, logo, desc, catelog, sort_order) VALUES (?, ?, ?, ?, ?, 9999)').bind(config.name, config.url, config.logo, config.desc, config.catelog).run();
          await env.NAV_DB.prepare('DELETE FROM pending_sites WHERE id = ?').bind(id).run();
          return new Response(JSON.stringify({ code: 200, message: 'Approved' }), { headers: { 'Content-Type': 'application/json' } });
        }
        if (method === 'DELETE') {
          await env.NAV_DB.prepare('DELETE FROM pending_sites WHERE id = ?').bind(id).run();
          return new Response(JSON.stringify({ code: 200, message: 'Rejected' }), { headers: { 'Content-Type': 'application/json' } });
        }
      }

      if (path === '/settings') {
        if (method === 'GET') {
          const { results } = await env.NAV_DB.prepare('SELECT * FROM settings').all();
          const data = Object.fromEntries(results.map(r => [r.key, r.value]));
          return new Response(JSON.stringify({ code: 200, data }), { headers: { 'Content-Type': 'application/json' } });
        }
        if (method === 'POST') {
          if (!(await isAdminAuthenticated(request, env))) return this.errorResponse('Unauthorized', 401);
          const body = await request.json();
          const stmts = Object.entries(body).map(([k, v]) => env.NAV_DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(k, String(v)));
          await env.NAV_DB.batch(stmts);
          return new Response(JSON.stringify({ code: 200, message: 'Settings updated' }), { headers: { 'Content-Type': 'application/json' } });
        }
      }

      if (path === '/categories/metadata' && method === 'PUT') {
        if (!(await isAdminAuthenticated(request, env))) return this.errorResponse('Unauthorized', 401);
        const { catelog, icon, description } = await request.json();
        await env.NAV_DB.prepare('INSERT INTO category_metadata (catelog, icon, description) VALUES (?, ?, ?) ON CONFLICT(catelog) DO UPDATE SET icon = excluded.icon, description = excluded.description').bind(catelog, icon, description).run();
        return new Response(JSON.stringify({ code: 200, message: 'Category updated' }), { headers: { 'Content-Type': 'application/json' } });
      }

      if (path === '/stats' && method === 'GET') {
        if (!(await isAdminAuthenticated(request, env))) return this.errorResponse('Unauthorized', 401);
        const siteCount = await env.NAV_DB.prepare('SELECT COUNT(*) as c FROM sites').first('c');
        const pendingCount = await env.NAV_DB.prepare('SELECT COUNT(*) as c FROM pending_sites').first('c');
        const totalHits = await env.NAV_DB.prepare('SELECT SUM(hits) as c FROM sites').first('c');
        const categoryCount = await env.NAV_DB.prepare('SELECT COUNT(DISTINCT catelog) as c FROM sites').first('c');
        return new Response(JSON.stringify({ code: 200, data: { siteCount, pendingCount, totalHits: totalHits || 0, categoryCount } }), { headers: { 'Content-Type': 'application/json' } });
      }

      if (path === '/config/import' && method === 'POST') {
        if (!(await isAdminAuthenticated(request, env))) return this.errorResponse('Unauthorized', 401);
        const data = await request.json();
        const sites = Array.isArray(data) ? data : data.data;
        const stmts = sites.map(s => env.NAV_DB.prepare('INSERT INTO sites (name, url, logo, desc, catelog, sort_order) VALUES (?, ?, ?, ?, ?, ?)').bind(s.name, s.url, s.logo, s.desc, s.catelog, normalizeSortOrder(s.sort_order)));
        await env.NAV_DB.batch(stmts);
        return new Response(JSON.stringify({ code: 201, message: `Imported ${sites.length} items` }), { status: 201, headers: { 'Content-Type': 'application/json' } });
      }

      if (path === '/config/export' && method === 'GET') {
        if (!(await isAdminAuthenticated(request, env))) return this.errorResponse('Unauthorized', 401);
        const { results } = await env.NAV_DB.prepare('SELECT * FROM sites ORDER BY sort_order ASC').all();
        return new Response(JSON.stringify(results, null, 2), { headers: { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="config.json"' } });
      }

      return this.errorResponse('Not Found', 404);
    } catch (e) {
      return this.errorResponse(e.message, 500);
    }
  },

  async getConfig(request, env, ctx, url) {
    const cat = url.searchParams.get('catalog') || url.searchParams.get('cat');
    const q = url.searchParams.get('keyword') || url.searchParams.get('q');
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '40');
    const offset = (page - 1) * pageSize;
    
    let query = `SELECT * FROM sites WHERE 1=1`;
    let countQuery = `SELECT COUNT(*) as total FROM sites WHERE 1=1`;
    let params = [];
    
    if (cat) {
      query += ` AND catelog = ?`;
      countQuery += ` AND catelog = ?`;
      params.push(cat);
    }
    if (q) {
      const lk = `%${q}%`;
      query += ` AND (name LIKE ? OR url LIKE ? OR desc LIKE ? OR catelog LIKE ?)`;
      countQuery += ` AND (name LIKE ? OR url LIKE ? OR desc LIKE ? OR catelog LIKE ?)`;
      params.push(lk, lk, lk, lk);
    }
    
    query += ` ORDER BY sort_order ASC, create_time DESC LIMIT ? OFFSET ?`;
    const { results } = await env.NAV_DB.prepare(query).bind(...params, pageSize, offset).all();
    const { total } = await env.NAV_DB.prepare(countQuery).bind(...params).first();
    return new Response(JSON.stringify({ code: 200, data: results, total, page, pageSize }), { headers: { 'Content-Type': 'application/json' } });
  },

  async createConfig(request, env, ctx) {
    const { name, url, logo, desc, catelog, sort_order } = await request.json();
    let finalLogo = logo || await getFavicon(url);
    await env.NAV_DB.prepare('INSERT INTO sites (name, url, logo, desc, catelog, sort_order) VALUES (?, ?, ?, ?, ?, ?)').bind(name, url, finalLogo, desc, catelog, normalizeSortOrder(sort_order)).run();
    return new Response(JSON.stringify({ code: 201, message: 'Created', favicon: finalLogo }), { status: 201, headers: { 'Content-Type': 'application/json' } });
  },

  async updateConfig(request, env, ctx, id) {
    const { name, url, logo, desc, catelog, sort_order } = await request.json();
    await env.NAV_DB.prepare('UPDATE sites SET name = ?, url = ?, logo = ?, desc = ?, catelog = ?, sort_order = ?, update_time = CURRENT_TIMESTAMP WHERE id = ?').bind(name, url, logo, desc, catelog, normalizeSortOrder(sort_order), id).run();
    return new Response(JSON.stringify({ code: 200, message: 'Updated' }), { headers: { 'Content-Type': 'application/json' } });
  },

  async submitConfig(request, env, ctx) {
    const { name, url, logo, desc, catelog } = await request.json();
    let finalLogo = logo || await getFavicon(url);
    await env.NAV_DB.prepare('INSERT INTO pending_sites (name, url, logo, desc, catelog) VALUES (?, ?, ?, ?, ?)').bind(name, url, finalLogo, desc, catelog).run();
    return new Response(JSON.stringify({ code: 201, message: 'Submitted', favicon: finalLogo }), { status: 201, headers: { 'Content-Type': 'application/json' } });
  },

  errorResponse(msg, status) {
    return new Response(JSON.stringify({ code: status, message: msg }), { status, headers: { 'Content-Type': 'application/json' } });
  }
};

// --- 后台管理 Handler ---

const admin = {
  async handleRequest(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/admin/logout' && request.method === 'POST') {
      const { token } = await validateAdminSession(request, env);
      if (token) await destroyAdminSession(env, token);
      return new Response(null, { status: 302, headers: { Location: '/admin', 'Set-Cookie': buildSessionCookie('', { maxAge: 0 }) } });
    }
    if (url.pathname === '/admin') {
      if (request.method === 'POST') {
        const fd = await request.formData();
        const u = fd.get('name'), p = fd.get('password');
        const su = await env.NAV_AUTH.get('admin_username') || env.NAV_ADMIN_USERNAME;
        const sp = await env.NAV_AUTH.get('admin_password') || env.NAV_ADMIN_PASSWORD;
        if (u === su && p === sp) {
          const t = await createAdminSession(env);
          return new Response(null, { status: 302, headers: { Location: '/admin', 'Set-Cookie': buildSessionCookie(t) } });
        }
        return this.renderLoginPage('账号或密码错误');
      }
      const { authenticated } = await validateAdminSession(request, env);
      return authenticated ? this.renderAdminPage() : this.renderLoginPage();
    }
    return new Response('Not Found', { status: 404 });
  },

  renderLoginPage(msg = '') {
    return new Response(`<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>管理员登录</title><script src="https://cdn.tailwindcss.com"></script><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&display=swap" rel="stylesheet"><style>body{font-family:'Plus Jakarta Sans',sans-serif;}</style></head><body class="bg-slate-50 flex items-center justify-center min-h-screen p-6"><div class="max-w-md w-full p-10 bg-white rounded-3xl shadow-2xl shadow-slate-200 border border-slate-100"><div class="text-center mb-10"><div class="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white mx-auto mb-6 shadow-xl shadow-indigo-200"><svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg></div><h1 class="text-3xl font-black text-slate-900 tracking-tight">后台管理</h1><p class="text-slate-500 mt-2 font-medium">请登录以管理您的书签站点</p></div>${msg ? `<div class="bg-red-50 text-red-600 p-4 rounded-2xl mb-6 text-sm font-bold text-center border border-red-100">${msg}</div>` : ''}<form method="POST" class="space-y-6"><div><label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 px-1">用户名</label><input type="text" name="name" required class="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all font-medium"></div><div><label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 px-1">密码</label><input type="password" name="password" required class="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all font-medium"></div><button type="submit" class="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-[0.98]">立即登录</button></form></div></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  },

  renderAdminPage() {
    return new Response(`<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>拾光集后台管理</title><script src="https://cdn.tailwindcss.com"></script><script src="https://unpkg.com/lucide@latest"></script><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet"><style>body{font-family:'Plus Jakarta Sans',sans-serif;} .tab-content{display:none;} .tab-content.active{display:block;} .nav-active{background:rgba(79,70,229,0.1); color:#4f46e5; border-right:3px solid #4f46e5; font-weight:700;}</style></head><body class="bg-[#f8fafc] text-slate-900"><div class="flex h-screen overflow-hidden"><aside class="w-72 bg-white border-r border-slate-100 flex flex-col z-50"><div class="p-8 mb-6"><div class="flex items-center gap-3"><div class="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100"><i data-lucide="command" class="w-6 h-6"></i></div><span class="text-xl font-extrabold tracking-tight">拾光后台</span></div></div><nav class="flex-1 px-4 space-y-2"><button onclick="showTab('dashboard')" class="nav-btn w-full text-left px-5 py-3.5 rounded-2xl flex items-center gap-4 transition-all text-slate-500 hover:bg-slate-50" data-tab="dashboard"><i data-lucide="layout-grid" class="w-5 h-5"></i> 仪表盘</button><button onclick="showTab('sites')" class="nav-btn w-full text-left px-5 py-3.5 rounded-2xl flex items-center gap-4 transition-all text-slate-500 hover:bg-slate-50" data-tab="sites"><i data-lucide="link" class="w-5 h-5"></i> 书签管理</button><button onclick="showTab('pending')" class="nav-btn w-full text-left px-5 py-3.5 rounded-2xl flex items-center gap-4 transition-all text-slate-500 hover:bg-slate-50" data-tab="pending"><i data-lucide="clock" class="w-5 h-5"></i> 待审核项</button><button onclick="showTab('categories')" class="nav-btn w-full text-left px-5 py-3.5 rounded-2xl flex items-center gap-4 transition-all text-slate-500 hover:bg-slate-50" data-tab="categories"><i data-lucide="folder" class="w-5 h-5"></i> 分类管理</button><button onclick="showTab('settings')" class="nav-btn w-full text-left px-5 py-3.5 rounded-2xl flex items-center gap-4 transition-all text-slate-500 hover:bg-slate-50" data-tab="settings"><i data-lucide="settings" class="w-5 h-5"></i> 系统设置</button></nav><div class="p-6 border-t border-slate-50"><form method="POST" action="/admin/logout"><button type="submit" class="w-full py-3.5 bg-slate-50 text-slate-600 rounded-2xl font-bold hover:bg-red-50 hover:text-red-600 transition-all flex items-center justify-center gap-3"><i data-lucide="log-out" class="w-4 h-4"></i> 退出登录</button></form></div></aside><main class="flex-1 overflow-y-auto bg-slate-50/30 p-10"><div id="dashboard" class="tab-content"><h2 class="text-3xl font-black mb-8 tracking-tight">概览</h2><div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8" id="stats-grid"></div><div class="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-8"><div class="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm"><h3 class="text-xl font-bold mb-6 flex items-center gap-3"><i data-lucide="activity" class="text-indigo-500"></i> 最近活动</h3><div id="recent-activity" class="space-y-4 text-sm text-slate-500">加载中...</div></div><div class="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm"><h3 class="text-xl font-bold mb-6 flex items-center gap-3"><i data-lucide="info" class="text-indigo-500"></i> 系统说明</h3><p class="text-sm text-slate-500 leading-relaxed">欢迎来到拾光集后台管理系统。在这里，您可以管理所有书签链接，审核访客提交的建议，并自定义您的站点外观。</p></div></div></div><div id="sites" class="tab-content"><div class="flex justify-between items-center mb-8"><h2 class="text-3xl font-black tracking-tight">书签管理</h2><div class="flex gap-3"><button onclick="exportData()" class="bg-white text-slate-600 px-6 py-3 rounded-2xl font-bold border border-slate-100 shadow-sm hover:bg-slate-50 transition-all flex items-center gap-2"><i data-lucide="download" class="w-4 h-4"></i> 导出</button><button onclick="openModal('site')" class="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2"><i data-lucide="plus" class="w-4 h-4"></i> 添加书签</button></div></div><div class="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden"><div class="p-6 border-b border-slate-50 flex gap-4"><div class="relative flex-1"><i data-lucide="search" class="absolute left-4 top-3.5 w-4 h-4 text-slate-400"></i><input type="text" id="site-search" placeholder="搜索书签名称或关键词..." class="w-full pl-12 pr-4 py-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all" oninput="searchSites(this.value)"></div></div><div class="overflow-x-auto"><table class="w-full text-left text-sm font-medium"><thead class="bg-slate-50/50 border-b border-slate-100 text-slate-400 font-black uppercase tracking-widest text-[10px]"><tr><th class="px-8 py-5">站点名称</th><th class="px-8 py-5">分类</th><th class="px-8 py-5 text-center">点击数</th><th class="px-8 py-5 text-right">操作</th></tr></thead><tbody id="sites-table-body" class="divide-y divide-slate-50"></tbody></table></div><div class="p-6 bg-slate-50/50 border-t border-slate-100 flex justify-center gap-2" id="pagination"></div></div></div><div id="pending" class="tab-content"><h2 class="text-3xl font-black mb-8 tracking-tight">审核中心</h2><div class="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden"><table class="w-full text-left text-sm font-medium"><thead class="bg-slate-50/50 border-b border-slate-100 text-slate-400 font-black uppercase tracking-widest text-[10px]"><tr><th class="px-8 py-5">站点</th><th class="px-8 py-5">分类</th><th class="px-8 py-5">提交时间</th><th class="px-8 py-5 text-right">操作</th></tr></thead><tbody id="pending-table-body" class="divide-y divide-slate-50"></tbody></table></div></div><div id="categories" class="tab-content"><h2 class="text-3xl font-black mb-8 tracking-tight">分类与排序</h2><div class="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden"><table class="w-full text-left text-sm font-medium"><thead class="bg-slate-50/50 border-b border-slate-100 text-slate-400 font-black uppercase tracking-widest text-[10px]"><tr><th class="px-8 py-5">分类名称</th><th class="px-8 py-5">图标</th><th class="px-8 py-5">站点数</th><th class="px-8 py-5">显示顺序</th><th class="px-8 py-5 text-right">操作</th></tr></thead><tbody id="categories-table-body" class="divide-y divide-slate-50"></tbody></table></div></div><div id="settings" class="tab-content"><h2 class="text-3xl font-black mb-8 tracking-tight">系统配置</h2><form id="settings-form" class="max-w-4xl bg-white p-10 rounded-3xl border border-slate-100 shadow-sm space-y-8"></form></div></main></div><div id="modal" class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center hidden z-[100]"><div class="bg-white w-full max-w-xl rounded-3xl shadow-2xl p-10 transform transition-all"><div class="flex justify-between items-center mb-8"><h3 id="modal-title" class="text-2xl font-black tracking-tight">添加站点</h3><button onclick="closeModal()" class="p-2 hover:bg-slate-100 rounded-xl transition-all"><i data-lucide="x"></i></button></div><form id="modal-form" class="space-y-5"></form><div class="mt-10 flex justify-end gap-3"><button onclick="closeModal()" class="px-6 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-2xl transition-all">取消</button><button id="modal-save" class="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95">保存更改</button></div></div></div><script>
    let currentTab = 'dashboard';
    const showTab = (tab) => {
      document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('nav-active'));
      document.getElementById(tab).classList.add('active');
      const btn = document.querySelector(\`[data-tab="\${tab}"]\`);
      if(btn) btn.classList.add('nav-active');
      currentTab = tab;
      if (tab === 'dashboard') loadStats();
      if (tab === 'sites') loadSites();
      if (tab === 'pending') loadPending();
      if (tab === 'categories') loadCategories();
      if (tab === 'settings') loadSettings();
    };
    const loadStats = async () => {
      const res = await fetch('/api/stats');
      const { data } = await res.json();
      const stats = [
        { label: '总书签', val: data.siteCount, color: 'text-indigo-600', icon: 'link' },
        { label: '累计点击', val: data.totalHits, color: 'text-emerald-600', icon: 'mouse-pointer-2' },
        { label: '分类数', val: data.categoryCount, color: 'text-purple-600', icon: 'folder' },
        { label: '待审核', val: data.pendingCount, color: 'text-orange-600', icon: 'clock' },
      ];
      document.getElementById('stats-grid').innerHTML = stats.map(s => \`
        <div class="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all group">
          <div class="flex items-center justify-between mb-4">
             <div class="p-3 bg-slate-50 rounded-2xl group-hover:scale-110 transition-all \${s.color}"><i data-lucide="\${s.icon}"></i></div>
             <span class="text-[10px] font-black uppercase tracking-widest text-slate-300">\${s.label}</span>
          </div>
          <p class="text-4xl font-black tracking-tight text-slate-900">\${s.val}</p>
        </div>
      \`).join('');
      lucide.createIcons();
    };
    const loadSites = async (page = 1, q = '') => {
      const res = await fetch(\`/api/config?page=\${page}&pageSize=15&keyword=\${encodeURIComponent(q)}\`);
      const data = await res.json();
      document.getElementById('sites-table-body').innerHTML = data.data.map(s => \`
        <tr class="hover:bg-slate-50/50 transition-all">
          <td class="px-8 py-5">
            <div class="flex items-center gap-4">
              <div class="w-10 h-10 rounded-xl bg-slate-100 flex-shrink-0 overflow-hidden border border-slate-100 flex items-center justify-center font-bold text-slate-400">\${s.logo ? \`<img src="\${s.logo}" class="w-full h-full object-cover">\` : s.name[0]}</div>
              <div class="min-w-0">
                <p class="font-black text-slate-800 truncate">\${s.name}</p>
                <p class="text-[10px] text-slate-400 truncate font-mono">\${s.url}</p>
              </div>
            </div>
          </td>
          <td class="px-8 py-5"><span class="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold uppercase tracking-wider">\${s.catelog}</span></td>
          <td class="px-8 py-5 text-center font-mono font-bold text-slate-400">\${s.hits}</td>
          <td class="px-8 py-5 text-right">
            <div class="flex justify-end gap-2">
              <button onclick='editSite(\${JSON.stringify(s)})' class="p-2.5 bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"><i data-lucide="edit-3" class="w-4 h-4"></i></button>
              <button onclick="deleteSite(\${s.id})" class="p-2.5 bg-slate-50 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </div>
          </td>
        </tr>
      \`).join('');
      const pag = document.getElementById('pagination');
      pag.innerHTML = '';
      const totalPages = Math.ceil(data.total / 15);
      if(totalPages > 1) {
          for(let i=1; i<=totalPages; i++) pag.innerHTML += \`<button onclick="loadSites(\${i}, '\${q}')" class="w-10 h-10 rounded-xl font-bold transition-all \${i===page?'bg-indigo-600 text-white shadow-lg shadow-indigo-100':'bg-white text-slate-400 hover:bg-slate-50 border border-slate-100'}">\${i}</button>\`;
      }
      lucide.createIcons();
    };
    const loadPending = async () => {
      const res = await fetch('/api/pending');
      const data = await res.json();
      document.getElementById('pending-table-body').innerHTML = data.data.map(s => \`
        <tr class="hover:bg-slate-50/50">
          <td class="px-8 py-5">
            <p class="font-black text-slate-800">\${s.name}</p>
            <p class="text-[10px] text-slate-400 font-mono">\${s.url}</p>
          </td>
          <td class="px-8 py-5"><span class="px-3 py-1 bg-slate-100 text-slate-500 rounded-lg text-xs font-bold">\${s.catelog}</span></td>
          <td class="px-8 py-5 text-slate-400 text-xs font-medium">\${new Date(s.create_time).toLocaleString()}</td>
          <td class="px-8 py-5 text-right">
            <div class="flex justify-end gap-2">
              <button onclick="approveSite(\${s.id})" class="px-5 py-2.5 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-black hover:bg-emerald-100 transition-all">批准</button>
              <button onclick="rejectSite(\${s.id})" class="px-5 py-2.5 bg-red-50 text-red-600 rounded-xl text-xs font-black hover:bg-red-100 transition-all">驳回</button>
            </div>
          </td>
        </tr>
      \`).join('');
    };
    const loadCategories = async () => {
      const res = await fetch('/api/categories');
      const data = await res.json();
      document.getElementById('categories-table-body').innerHTML = data.data.map(c => \`
        <tr class="hover:bg-slate-50/50 transition-all">
          <td class="px-8 py-5 font-black text-slate-800 text-base">\${c.catelog}</td>
          <td class="px-8 py-5"><div class="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-xl">\${c.icon || '—'}</div></td>
          <td class="px-8 py-5 text-slate-400 font-bold">\${c.site_count}</td>
          <td class="px-8 py-5"><input type="number" value="\${c.sort_order}" class="w-24 px-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold" onchange="updateCatOrder('\${c.catelog}', this.value)"></td>
          <td class="px-8 py-5 text-right"><button onclick='editCat(\${JSON.stringify(c)})' class="text-indigo-600 hover:underline font-black text-xs uppercase tracking-widest">配置详情</button></td>
        </tr>
      \`).join('');
    };
    const loadSettings = async () => {
      const res = await fetch('/api/settings');
      const { data } = await res.json();
      const fields = [
        { label: '站点标题', key: 'site_title', placeholder: '拾光集书签' },
        { label: '站点副标题', key: 'site_subtitle', placeholder: '精选 · 真实 · 有温度' },
        { label: '站点 Logo URL', key: 'site_logo' },
        { label: 'Favicon URL', key: 'site_favicon' },
        { label: '横幅背景图 URL', key: 'hero_bg' },
        { label: '首页描述内容', key: 'hero_desc', type: 'textarea' },
        { label: '页脚 HTML', key: 'footer_html', type: 'textarea' },
        { label: '后台用户名', key: 'admin_username' },
        { label: '后台密码', key: 'admin_password', type: 'password' },
      ];
      document.getElementById('settings-form').innerHTML = \`
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
          \${fields.map(f => \`
            <div class="\${f.type==='textarea'?'md:col-span-2':''}">
              <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3 px-1">\${f.label}</label>
              \${f.type === 'textarea' 
                ? \`<textarea name="\${f.key}" class="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all font-medium h-32">\${data[f.key] || ''}</textarea>\`
                : \`<input type="\${f.type || 'text'}" name="\${f.key}" value="\${data[f.key] || ''}" class="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all font-medium">\`
              }
            </div>
          \`).join('')}
        </div>
        <div class="pt-6"><button type="submit" class="bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:scale-[1.02] transition-all active:scale-[0.98]">保存所有系统设置</button></div>
      \`;
    };
    document.getElementById('settings-form').onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target), data = Object.fromEntries(fd.entries());
      const res = await fetch('/api/settings', { method: 'POST', body: JSON.stringify(data) });
      if (res.ok) alert('设置已更新');
    };
    const openModal = (type, data = null) => {
      const form = document.getElementById('modal-form'), title = document.getElementById('modal-title');
      document.getElementById('modal').classList.remove('hidden');
      if (type === 'site') {
        title.innerText = data ? '编辑书签' : '添加新书签';
        form.innerHTML = \`
          <input type="hidden" name="id" value="\${data?.id || ''}">
          <div class="grid grid-cols-2 gap-4">
            <div class="col-span-2"><label class="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2 px-1">显示名称</label><input type="text" name="name" value="\${data?.name || ''}" class="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500" required></div>
            <div class="col-span-2"><label class="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2 px-1">链接 URL</label><input type="text" name="url" value="\${data?.url || ''}" class="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500" required></div>
            <div class="col-span-2"><label class="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2 px-1">Logo URL</label><div class="flex gap-2"><input type="text" name="logo" id="logo-input" value="\${data?.logo || ''}" class="flex-1 px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500"><button type="button" onclick="autoLogo()" class="px-4 bg-slate-100 text-xs font-bold rounded-2xl hover:bg-slate-200 transition-all">自动获取</button></div></div>
            <div class="col-span-2"><label class="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2 px-1">描述信息</label><textarea name="desc" class="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 h-24">\${data?.desc || ''}</textarea></div>
            <div><label class="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2 px-1">所属分类</label><input type="text" name="catelog" value="\${data?.catelog || ''}" class="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500" required></div>
            <div><label class="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2 px-1">排序权重</label><input type="number" name="sort_order" value="\${data?.sort_order || 9999}" class="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500"></div>
          </div>
        \`;
        document.getElementById('modal-save').onclick = saveSite;
      } else if (type === 'cat') {
        title.innerText = '配置分类详情';
        form.innerHTML = \`
          <input type="hidden" name="catelog" value="\${data.catelog}">
          <div class="p-6 bg-indigo-50 rounded-2xl mb-6 flex items-center gap-4"><div class="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-2xl shadow-sm">\${data.icon || '📁'}</div><div><p class="text-indigo-600 font-black">\${data.catelog}</p><p class="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">目前共有 \${data.site_count} 个站点</p></div></div>
          <div><label class="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2 px-1">分类图标 (Emoji 或 图标库代码)</label><input type="text" name="icon" value="\${data.icon || ''}" class="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500"></div>
          <div><label class="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2 px-1">分类介绍</label><textarea name="description" class="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 h-24">\${data.description || ''}</textarea></div>
        \`;
        document.getElementById('modal-save').onclick = saveCat;
      }
    };
    const closeModal = () => document.getElementById('modal').classList.add('hidden');
    const autoLogo = async () => {
      const u = document.querySelector('input[name="url"]').value, btn = document.querySelector('button[onclick="autoLogo()"]');
      if(!u) return alert('请先输入 URL');
      btn.innerText = '获取中...'; btn.disabled = true;
      const res = await fetch('/api/favicon?url=' + encodeURIComponent(u));
      const data = await res.json();
      if(data.favicon) document.getElementById('logo-input').value = data.favicon;
      btn.innerText = '自动获取'; btn.disabled = false;
    };
    const saveSite = async () => {
      const fd = new FormData(document.getElementById('modal-form')), data = Object.fromEntries(fd.entries());
      const res = await fetch(data.id ? \`/api/config/\${data.id}\` : '/api/config', { method: data.id ? 'PUT' : 'POST', body: JSON.stringify(data) });
      if(res.ok) { closeModal(); loadSites(); }
    };
    const saveCat = async () => {
      const fd = new FormData(document.getElementById('modal-form')), data = Object.fromEntries(fd.entries());
      const res = await fetch('/api/categories/metadata', { method: 'PUT', body: JSON.stringify(data) });
      if(res.ok) { closeModal(); loadCategories(); }
    };
    const deleteSite = async (id) => { if(confirm('确定要删除吗？不可撤销。')) { await fetch(\`/api/config/\${id}\`, { method: 'DELETE' }); loadSites(); } };
    const updateCatOrder = async (name, val) => { await fetch(\`/api/categories/\${encodeURIComponent(name)}\`, { method: 'PUT', body: JSON.stringify({ sort_order: parseInt(val) }) }); loadCategories(); };
    const approveSite = async (id) => { await fetch(\`/api/pending/\${id}\`, { method: 'PUT' }); loadPending(); };
    const rejectSite = async (id) => { if(confirm('确定驳回吗？')) { await fetch(\`/api/pending/\${id}\`, { method: 'DELETE' }); loadPending(); } };
    const editSite = (data) => openModal('site', data);
    const editCat = (data) => openModal('cat', data);
    const searchSites = (val) => { loadSites(1, val); };
    const exportData = () => window.location.href = '/api/config/export';

    showTab('dashboard');
    lucide.createIcons();
  </script></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
};

// --- 前端 Handler ---

async function handleRequest(request, env, ctx) {
  const url = new URL(request.url);
  const catalog = url.searchParams.get('catalog') || url.searchParams.get('cat');
  const q = url.searchParams.get('keyword') || url.searchParams.get('q');
  
  const [sitesRes, catsRes, settingsRes] = await Promise.all([
    api.getConfig(request, env, ctx, url),
    api.getCategories(request, env, ctx),
    api.getSettings(request, env, ctx)
  ]);
  
  const { data: sites, total } = await sitesRes.json();
  const { data: categories } = await catsRes.json();
  const { data: settings } = await settingsRes.json();
  
  const siteTitle = settings.site_title || '拾光集书签';
  const siteSubtitle = settings.site_subtitle || '精选 · 真实 · 有温度';
  const siteLogo = settings.site_logo || '';
  const heroDesc = settings.hero_desc || '从效率工具到灵感站点，我们亲自挑选、亲手标注，只为帮助你更快找到值得信赖的优质资源。';
  const heroBg = settings.hero_bg || '';
  
  const catalogLinkMarkup = categories.map(c => `
    <a href="?cat=${encodeURIComponent(c.catelog)}" class="flex items-center px-4 py-3 rounded-2xl transition-all duration-300 ${catalog === c.catelog ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100 font-bold' : 'text-slate-500 hover:bg-slate-50'} group">
      <span class="mr-3 text-lg group-hover:scale-110 transition-transform">${c.icon || '📁'}</span>
      <span class="flex-1 truncate">${escapeHTML(c.catelog)}</span>
      <span class="text-[10px] opacity-40 font-mono">${c.site_count}</span>
    </a>
  `).join('');

  const sitesGridMarkup = sites.map(s => `
    <div class="site-card group bg-white rounded-3xl p-6 border border-slate-100 hover:border-indigo-100 hover:shadow-2xl hover:shadow-indigo-100/30 transition-all duration-500 relative flex flex-col h-full" data-id="${s.id}" data-name="${escapeHTML(s.name)}" data-url="${escapeHTML(s.url)}">
      <div class="flex items-start gap-4 mb-5">
        <div class="w-14 h-14 rounded-2xl overflow-hidden bg-slate-50 flex-shrink-0 border border-slate-100 group-hover:scale-105 transition-transform duration-500 flex items-center justify-center">
          ${s.logo ? `<img src="${escapeHTML(s.logo)}" class="w-full h-full object-cover">` : `<div class="w-full h-full bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white font-black text-xl">${escapeHTML(s.name[0])}</div>`}
        </div>
        <div class="flex-1 min-w-0">
          <h3 class="font-black text-slate-900 truncate group-hover:text-indigo-600 transition-colors tracking-tight">${escapeHTML(s.name)}</h3>
          <span class="inline-block mt-1.5 text-[10px] font-black uppercase tracking-widest text-indigo-500 bg-indigo-50 px-2.5 py-1 rounded-lg">${escapeHTML(s.catelog)}</span>
        </div>
      </div>
      <p class="text-sm text-slate-500 leading-relaxed line-clamp-2 mb-6 flex-1 opacity-80">${escapeHTML(s.desc || '这个站点还没有描述，博主正在加紧补全中...')}</p>
      <div class="flex items-center justify-between mt-auto pt-5 border-t border-slate-50">
        <div class="flex items-center text-[10px] text-slate-400 font-bold truncate max-w-[120px] font-mono">
          <i data-lucide="link" class="w-3 h-3 mr-1.5 opacity-40"></i> ${escapeHTML(new URL(sanitizeUrl(s.url)).hostname)}
        </div>
        <div class="flex gap-1.5">
          <button onclick="Favorites.toggle({id:'${s.id}', name:'${escapeHTML(s.name)}', url:'${escapeHTML(s.url)}', logo:'${escapeHTML(s.logo)}', catelog:'${escapeHTML(s.catelog)}'})" class="fav-btn p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all" data-id="${s.id}"><i data-lucide="heart" class="w-4 h-4"></i></button>
          <button onclick="showQR('${escapeHTML(s.url)}', '${escapeHTML(s.name)}')" class="p-2.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"><i data-lucide="qr-code" class="w-4 h-4"></i></button>
          <a href="${escapeHTML(sanitizeUrl(s.url))}" target="_blank" onclick="trackClick(${s.id})" class="p-2.5 bg-slate-900 text-white rounded-xl hover:bg-indigo-600 transition-all shadow-lg shadow-slate-200 active:scale-90"><i data-lucide="external-link" class="w-4 h-4"></i></a>
        </div>
      </div>
    </div>
  `).join('');

  const html = `<!DOCTYPE html>
  <html lang="zh-CN">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${siteTitle}</title>
    <meta name="description" content="${heroDesc}">
    <link rel="icon" href="${settings.site_favicon || ''}">
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
      body { font-family: 'Plus Jakarta Sans', sans-serif; }
      .sidebar-scroll::-webkit-scrollbar { width: 3px; }
      .sidebar-scroll::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      .hero-gradient { background: ${heroBg ? `url('${heroBg}')` : 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)'}; background-size: cover; background-position: center; }
      @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
      .float-animation { animation: float 6s ease-in-out infinite; }
      .dark-mode { background-color: #0f172a; color: #f1f5f9; }
    </style>
  </head>
  <body class="bg-[#f8fafc] text-slate-900 transition-colors duration-500">
    <!-- 侧边栏 -->
    <aside id="sidebar" class="fixed left-0 top-0 h-full w-80 bg-white border-r border-slate-100 z-[100] transform -translate-x-full lg:translate-x-0 transition-transform duration-500 flex flex-col shadow-2xl lg:shadow-none">
      <div class="p-8">
        <div class="flex items-center justify-between mb-10">
          <div class="flex items-center gap-3">
            ${siteLogo ? `<img src="${siteLogo}" class="h-10">` : `<div class="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100 font-bold">集</div>`}
            <span class="text-2xl font-black tracking-tight">${siteTitle}</span>
          </div>
          <button onclick="toggleSidebar()" class="lg:hidden p-2 text-slate-400 hover:bg-slate-50 rounded-xl"><i data-lucide="x"></i></button>
        </div>
        
        <div class="relative mb-10">
          <i data-lucide="search" class="absolute left-4 top-3.5 w-4 h-4 text-slate-400"></i>
          <input type="text" id="mainSearch" placeholder="搜索书签资源..." class="w-full bg-slate-50 border-none rounded-2xl pl-12 pr-4 py-3.5 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all shadow-inner" value="${q || ''}">
        </div>

        <nav class="space-y-1.5 sidebar-scroll overflow-y-auto flex-1 pr-1">
          <p class="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-4 px-4">分类目录</p>
          <a href="/" class="flex items-center px-4 py-3 rounded-2xl transition-all duration-300 ${!catalog ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100 font-bold' : 'text-slate-500 hover:bg-slate-50'}">
            <i data-lucide="layout-grid" class="mr-3 w-5 h-5"></i>
            <span class="flex-1">全部站点</span>
          </a>
          ${catalogLinkMarkup}
        </nav>
      </div>

      <div class="p-8 mt-auto border-t border-slate-50">
        <div class="bg-indigo-50 rounded-3xl p-6 relative overflow-hidden group">
          <div class="relative z-10">
            <p class="text-xs font-black text-indigo-500 uppercase tracking-[0.15em] mb-2">想要投稿？</p>
            <p class="text-xs text-indigo-400 mb-4 font-medium leading-relaxed">欢迎提交优质链接，审核通过后即可展示在此。</p>
            <button onclick="openSubmit()" class="w-full py-3 bg-white text-indigo-600 rounded-2xl text-xs font-black hover:bg-indigo-600 hover:text-white transition-all shadow-sm">立即提交发现</button>
          </div>
          <i data-lucide="sparkles" class="absolute -right-4 -bottom-4 w-20 h-20 text-indigo-100 rotate-12 group-hover:scale-110 transition-transform"></i>
        </div>
      </div>
    </aside>

    <!-- 顶部工具栏 -->
    <header class="fixed top-0 left-0 right-0 lg:left-80 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-100 h-20 flex items-center px-8 justify-between">
       <button onclick="toggleSidebar()" class="lg:hidden p-2 text-slate-500 hover:bg-slate-50 rounded-xl transition-all"><i data-lucide="menu"></i></button>
       
       <div class="hidden md:flex items-center gap-6">
          <div id="hitokoto" class="text-xs font-bold text-slate-400 flex items-center gap-2">
             <i data-lucide="quote" class="w-3 h-3 text-indigo-400"></i>
             <span id="hitokoto_text" class="cursor-pointer hover:text-indigo-600 transition-colors">书山有路勤为径，学海无涯苦作舟。</span>
          </div>
       </div>

       <div class="flex items-center gap-3">
          <button onclick="Favorites.show()" class="relative p-3 text-slate-400 hover:bg-slate-50 hover:text-indigo-600 rounded-2xl transition-all" title="我的收藏">
             <i data-lucide="heart" class="w-5 h-5"></i>
             <span id="favBadge" class="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full hidden border-2 border-white"></span>
          </button>
          <button onclick="History.show()" class="p-3 text-slate-400 hover:bg-slate-50 hover:text-indigo-600 rounded-2xl transition-all" title="访问历史"><i data-lucide="history" class="w-5 h-5"></i></button>
          <button id="themeToggle" onclick="toggleTheme()" class="p-3 text-slate-400 hover:bg-slate-50 hover:text-indigo-600 rounded-2xl transition-all"><i data-lucide="sun" class="w-5 h-5"></i></button>
          <a href="/admin" class="p-3 text-slate-400 hover:bg-slate-50 hover:text-indigo-600 rounded-2xl transition-all" title="后台管理"><i data-lucide="user-cog" class="w-5 h-5"></i></a>
       </div>
    </header>

    <main class="lg:ml-80 pt-20 min-h-screen">
      <!-- Hero -->
      <section class="p-8 md:p-12 lg:p-16">
        <div class="hero-gradient relative rounded-[40px] p-10 md:p-20 overflow-hidden shadow-2xl shadow-indigo-100">
           <div class="absolute inset-0 bg-slate-900/40"></div>
           <div class="relative z-10 max-w-4xl">
              <span class="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 backdrop-blur-md text-white rounded-full text-[10px] font-black tracking-[0.25em] uppercase mb-8 border border-white/10">
                 <span class="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                 ${siteSubtitle}
              </span>
              <h1 class="text-4xl md:text-7xl font-black text-white mb-8 tracking-tighter leading-tight">${siteTitle}</h1>
              <p class="text-lg md:text-xl text-white/80 leading-relaxed max-w-2xl font-medium">${heroDesc}</p>
           </div>
           <!-- Decorative element -->
           <div class="absolute right-0 bottom-0 p-10 hidden xl:block float-animation">
              <div class="bg-white/10 backdrop-blur-3xl p-8 rounded-[40px] border border-white/10">
                 <p class="text-[10px] font-black text-white/40 uppercase tracking-widest mb-4 text-center">当前资源数</p>
                 <p class="text-6xl font-black text-white text-center">${total}</p>
              </div>
           </div>
        </div>
      </section>

      <!-- Content -->
      <section class="px-8 md:px-16 pb-20">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <h2 class="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              ${catalog || '精选资源库'}
              <span class="text-sm font-bold text-slate-300 bg-slate-100 px-3 py-1 rounded-full">${total}</span>
            </h2>
            <p class="text-slate-400 text-sm mt-2 font-medium">亲自挑选并验证的优质内容，定期更新。</p>
          </div>
          <div class="flex items-center gap-4 self-end md:self-auto">
             <div class="flex bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm">
                <button onclick="changeView('grid')" class="p-2.5 bg-slate-50 text-indigo-600 rounded-xl transition-all shadow-sm"><i data-lucide="layout-grid" class="w-5 h-5"></i></button>
                <button onclick="changeView('list')" class="p-2.5 text-slate-400 hover:text-slate-600 transition-all"><i data-lucide="list" class="w-5 h-5"></i></button>
             </div>
          </div>
        </div>

        <div id="sites-grid" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-8">
          ${sitesGridMarkup}
        </div>
        
        ${total > sites.length ? `
          <div class="mt-20 flex justify-center">
            <button onclick="loadMore()" class="px-10 py-4 bg-white border border-slate-100 rounded-2xl font-black text-slate-900 hover:bg-indigo-600 hover:text-white transition-all shadow-xl shadow-slate-200 hover:shadow-indigo-200 active:scale-95">探索更多发现</button>
          </div>
        ` : ''}
      </section>
      
      <footer class="p-16 border-t border-slate-50 bg-white/50 text-center">
        ${settings.footer_html || `<div class="flex flex-col items-center gap-6"><div class="flex items-center gap-2"><div class="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white"><i data-lucide="command" class="w-4 h-4"></i></div><span class="text-lg font-black tracking-tight">${siteTitle}</span></div><p class="text-slate-400 text-xs font-bold uppercase tracking-widest leading-loose">© ${new Date().getFullYear()} ${siteTitle} <br/> 探索更有趣、更高价值的互联网世界</p></div>`}
      </footer>
    </main>

    <!-- Modals -->
    <div id="qrModal" class="fixed inset-0 z-[110] flex items-center justify-center hidden">
        <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onclick="closeQR()"></div>
        <div class="bg-white w-full max-w-xs mx-4 rounded-[40px] shadow-2xl relative z-10 p-10 text-center animate-in fade-in zoom-in duration-300">
            <h3 id="qrName" class="text-xl font-black mb-8 truncate">站点名称</h3>
            <div class="bg-slate-50 p-6 rounded-[30px] inline-block mb-8 border border-slate-100">
               <img id="qrImage" src="" class="w-40 h-40">
            </div>
            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">扫描二维码，在移动设备中打开</p>
        </div>
    </div>

    <div id="submitModal" class="fixed inset-0 z-[110] flex items-center justify-center hidden">
        <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onclick="closeSubmit()"></div>
        <div class="bg-white w-full max-w-lg mx-4 rounded-[40px] shadow-2xl relative z-10 p-12 animate-in slide-in-from-bottom duration-500">
            <div class="flex justify-between items-center mb-10">
               <h3 class="text-3xl font-black tracking-tighter">提交新书签</h3>
               <button onclick="closeSubmit()" class="p-2 hover:bg-slate-50 rounded-xl transition-all"><i data-lucide="x"></i></button>
            </div>
            <form id="submitForm" class="space-y-6">
                <div><label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">显示名称</label><input type="text" name="name" required class="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-bold"></div>
                <div><label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">书签 URL</label><input type="text" name="url" required class="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-bold"></div>
                <div><label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">所属分类</label><input type="text" name="catelog" required class="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-bold"></div>
                <div><label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">简要描述</label><textarea name="desc" class="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-bold h-24"></textarea></div>
                <button type="submit" class="w-full py-5 bg-indigo-600 text-white rounded-3xl font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all hover:scale-[1.02] active:scale-[0.98]">提交发现，等待审核</button>
            </form>
        </div>
    </div>

    <!-- 侧栏弹窗：收藏 & 历史 -->
    <div id="sideModal" class="fixed inset-y-0 right-0 w-full max-w-sm bg-white border-l border-slate-100 z-[120] transform translate-x-full transition-transform duration-500 flex flex-col shadow-2xl">
       <div class="p-8 border-b border-slate-50 flex items-center justify-between">
          <h3 id="sideModalTitle" class="text-2xl font-black tracking-tight flex items-center gap-3">标题</h3>
          <button onclick="closeSideModal()" class="p-2 hover:bg-slate-50 rounded-xl transition-all"><i data-lucide="x"></i></button>
       </div>
       <div id="sideModalContent" class="flex-1 overflow-y-auto p-6 space-y-4"></div>
       <div id="sideModalFooter" class="p-8 border-t border-slate-50"></div>
    </div>

    <script>
      lucide.createIcons();
      const trackClick = (id) => fetch('/api/click/' + id, { method: 'POST' });
      const copyLink = (url) => { navigator.clipboard.writeText(url); alert('链接已成功复制到剪贴板'); };
      const openSubmit = () => document.getElementById('submitModal').classList.remove('hidden');
      const closeSubmit = () => document.getElementById('submitModal').classList.add('hidden');
      const toggleSidebar = () => document.getElementById('sidebar').classList.toggle('-translate-x-full');
      const showQR = (url, name) => {
        document.getElementById('qrName').innerText = name;
        document.getElementById('qrImage').src = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(url);
        document.getElementById('qrModal').classList.remove('hidden');
      };
      const closeQR = () => document.getElementById('qrModal').classList.add('hidden');
      
      const Favorites = {
        data: JSON.parse(localStorage.getItem('favs') || '[]'),
        save() { localStorage.setItem('favs', JSON.stringify(this.data)); this.updateBadge(); },
        toggle(site) {
          const idx = this.data.findIndex(s => s.id == site.id);
          if(idx > -1) { this.data.splice(idx, 1); } else { this.data.push(site); }
          this.save(); this.updateUI();
        },
        updateBadge() {
           const badge = document.getElementById('favBadge');
           if(this.data.length > 0) badge.classList.remove('hidden'); else badge.classList.add('hidden');
        },
        updateUI() {
           document.querySelectorAll('.fav-btn').forEach(btn => {
              const id = btn.dataset.id;
              if(this.data.some(s => s.id == id)) btn.classList.add('text-red-500'); else btn.classList.remove('text-red-500');
           });
        },
        show() {
           const content = document.getElementById('sideModalContent');
           document.getElementById('sideModalTitle').innerHTML = '<i data-lucide="heart" class="text-red-500"></i> 我的收藏';
           content.innerHTML = this.data.length ? this.data.map(s => \`
              <div class="p-4 bg-slate-50 rounded-2xl flex items-center gap-4 group">
                 <div class="w-12 h-12 rounded-xl bg-white flex-shrink-0 overflow-hidden border border-slate-100">\${s.logo ? \`<img src="\${s.logo}" class="w-full h-full object-cover">\` : \`<div class="w-full h-full bg-slate-200 flex items-center justify-center font-bold">\${s.name[0]}</div>\`}</div>
                 <div class="flex-1 min-w-0">
                    <p class="font-black text-sm truncate">\${s.name}</p>
                    <a href="\${s.url}" target="_blank" class="text-[10px] text-indigo-500 font-bold hover:underline">访问站点</a>
                 </div>
                 <button onclick="Favorites.toggle({id:'\${s.id}'}); Favorites.show()" class="text-slate-200 hover:text-red-500"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
              </div>
           \`).join('') : '<div class="h-64 flex flex-col items-center justify-center text-slate-300 gap-4"><i data-lucide="heart" class="w-12 h-12 opacity-20"></i><p class="text-xs font-bold uppercase tracking-widest">暂无收藏内容</p></div>';
           document.getElementById('sideModalFooter').innerHTML = '';
           openSideModal();
           lucide.createIcons();
        }
      };

      const History = {
        data: JSON.parse(localStorage.getItem('history') || '[]'),
        add(site) {
          const idx = this.data.findIndex(s => s.url == site.url);
          if(idx > -1) this.data.splice(idx, 1);
          this.data.unshift({ ...site, time: Date.now() });
          this.data = this.data.slice(0, 50);
          localStorage.setItem('history', JSON.stringify(this.data));
        },
        show() {
           const content = document.getElementById('sideModalContent');
           document.getElementById('sideModalTitle').innerHTML = '<i data-lucide="history" class="text-indigo-500"></i> 访问历史';
           content.innerHTML = this.data.length ? this.data.map(s => \`
              <div class="flex items-center gap-4 group border-b border-slate-50 pb-4">
                 <div class="flex-1 min-w-0">
                    <p class="font-bold text-sm truncate">\${s.name}</p>
                    <p class="text-[10px] text-slate-300 font-medium">\${new Date(s.time).toLocaleString()}</p>
                 </div>
                 <a href="\${s.url}" target="_blank" class="p-2 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-lg transition-all"><i data-lucide="external-link" class="w-4 h-4"></i></a>
              </div>
           \`).join('') : '<div class="h-64 flex flex-col items-center justify-center text-slate-300 gap-4"><i data-lucide="history" class="w-12 h-12 opacity-20"></i><p class="text-xs font-bold uppercase tracking-widest">暂无历史记录</p></div>';
           document.getElementById('sideModalFooter').innerHTML = '<button onclick="History.clear()" class="w-full py-4 text-xs font-black text-slate-400 uppercase tracking-widest hover:text-red-500 transition-colors">清空所有历史</button>';
           openSideModal();
           lucide.createIcons();
        },
        clear() { this.data = []; localStorage.setItem('history', '[]'); this.show(); }
      };

      const openSideModal = () => document.getElementById('sideModal').classList.remove('translate-x-full');
      const closeSideModal = () => document.getElementById('sideModal').classList.add('translate-x-full');

      document.getElementById('submitForm').onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target), data = Object.fromEntries(fd.entries());
        const res = await fetch('/api/config/submit', { method: 'POST', body: JSON.stringify(data) });
        if(res.ok) { alert('提交成功！请耐心等待博主审核。'); closeSubmit(); e.target.reset(); }
      };

      document.getElementById('mainSearch').onkeypress = (e) => {
        if(e.key === 'Enter') window.location.href = '?q=' + encodeURIComponent(e.target.value);
      };

      fetch('https://v1.hitokoto.cn')
        .then(r => r.json())
        .then(d => {
           document.getElementById('hitokoto_text').innerText = d.hitokoto;
        });

      Favorites.updateBadge();
      Favorites.updateUI();

      window.recordHistory = (name, url) => History.add({name, url});
      window.trackClick = (id) => fetch('/api/click/' + id, {method:'POST'});
    </script>
  </body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api')) return api.handleRequest(request, env, ctx);
    if (url.pathname.startsWith('/admin')) return admin.handleRequest(request, env, ctx);
    return handleRequest(request, env, ctx);
  }
};
