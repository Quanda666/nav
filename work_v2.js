// 添加到 worker.js 文件顶部（第1行后）
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
/**
 * 备用随机 SVG 图标 - 优化设计
 */
export const fallbackSVGIcons = [
  `<svg width="80" height="80" viewBox="0 0 24 24" fill="url(#gradient1)" xmlns="http://www.w3.org/2000/svg">
     <defs>
       <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
         <stop offset="0%" stop-color="#7209b7" />
         <stop offset="100%" stop-color="#4cc9f0" />
       </linearGradient>
     </defs>
     <path d="M12 2L2 12h3v8h6v-6h2v6h6v-8h3L12 2z"/>
   </svg>`,
  `<svg width="80" height="80" viewBox="0 0 24 24" fill="url(#gradient2)" xmlns="http://www.w3.org/2000/svg">
     <defs>
       <linearGradient id="gradient2" x1="0%" y1="0%" x2="100%" y2="100%">
         <stop offset="0%" stop-color="#4361ee" />
         <stop offset="100%" stop-color="#4cc9f0" />
       </linearGradient>
     </defs>
     <circle cx="12" cy="12" r="10"/>
     <path d="M12 7v5l3.5 3.5 1.42-1.42L14 11.58V7h-2z" fill="#fff"/>
   </svg>`,
  `<svg width="80" height="80" viewBox="0 0 24 24" fill="url(#gradient3)" xmlns="http://www.w3.org/2000/svg">
     <defs>
       <linearGradient id="gradient3" x1="0%" y1="0%" x2="100%" y2="100%">
         <stop offset="0%" stop-color="#7209b7" />
         <stop offset="100%" stop-color="#4361ee" />
       </linearGradient>
     </defs>
     <path d="M12 .587l3.668 7.431L24 9.172l-6 5.843 1.416 8.252L12 19.771l-7.416 3.496L6 15.015 0 9.172l8.332-1.154z"/>
   </svg>`,
];



function getRandomSVG() {
  return fallbackSVGIcons[Math.floor(Math.random() * fallbackSVGIcons.length)];
}

/**
 * 渲染单个网站卡片（优化版）
 */
function renderSiteCard(site) {
  const logoHTML = site.logo
    ? `<img src="${site.logo}" alt="${site.name}"/>`
    : getRandomSVG();

  return `
    <div class="channel-card" data-id="${site.id}">
      <div class="channel-number">${site.id}</div>
      <h3 class="channel-title">${site.name || '未命名'}</h3>
      <span class="channel-tag">${site.catelog}</span>
      <div class="logo-wrapper">${logoHTML}</div>
      <p class="channel-desc">${site.desc || '暂无描述'}</p>
      <a href="${site.url}" target="_blank" class="channel-link">${site.url}</a>
      <button class="copy-btn" data-url="${site.url}" title="复制链接">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
      </button>
      <div class="copy-success">已复制!</div>
    </div>
  `;
}

function escapeHTML(input) {
  if (input === null || input === undefined) {
    return '';
  }
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeUrl(url) {
  if (!url) {
    return '';
  }
  const trimmed = String(url).trim();
  try {
    const direct = new URL(trimmed);
    if (direct.protocol === 'http:' || direct.protocol === 'https:') {
      return direct.href;
    }
  } catch (error) {
    try {
      const fallback = new URL(`https://${trimmed}`);
      if (fallback.protocol === 'http:' || fallback.protocol === 'https:') {
        return fallback.href;
      }
    } catch (e) {
      return '';
    }
  }
  return '';
}

function normalizeSortOrder(value) {
  if (value === undefined || value === null || value === '') {
    return 9999;
  }
  const parsed = Number(value);
  if (Number.isFinite(parsed)) {
    const clamped = Math.max(-2147483648, Math.min(2147483647, Math.round(parsed)));
    return clamped;
  }
  return 9999;
}

function isSubmissionEnabled(env) {
  const flag = env.ENABLE_PUBLIC_SUBMISSION;
  if (flag === undefined || flag === null) {
    return true;
  }
  const normalized = String(flag).trim().toLowerCase();
  return normalized === 'true';
}

const SESSION_COOKIE_NAME = 'nav_admin_session';
const SESSION_PREFIX = 'session:';
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12小时会话

function parseCookies(cookieHeader = '') {
  return cookieHeader
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce((acc, pair) => {
      const separatorIndex = pair.indexOf('=');
      if (separatorIndex === -1) {
        acc[pair] = '';
      } else {
        const key = pair.slice(0, separatorIndex).trim();
        const value = pair.slice(separatorIndex + 1).trim();
        acc[key] = value;
      }
      return acc;
    }, {});
}

function buildSessionCookie(token, options = {}) {
  const { maxAge = SESSION_TTL_SECONDS } = options;
  const segments = [
    `${SESSION_COOKIE_NAME}=${token}`,
    'Path=/',
    `Max-Age=${maxAge}`,
    'HttpOnly',
    'SameSite=Strict',
    'Secure',
  ];
  return segments.join('; ');
}

async function createAdminSession(env) {
  const token = crypto.randomUUID();
  await env.NAV_AUTH.put(`${SESSION_PREFIX}${token}`, JSON.stringify({ createdAt: Date.now() }), {
    expirationTtl: SESSION_TTL_SECONDS,
  });
  return token;
}

async function refreshAdminSession(env, token, payload) {
  await env.NAV_AUTH.put(`${SESSION_PREFIX}${token}`, payload, { expirationTtl: SESSION_TTL_SECONDS });
}

async function destroyAdminSession(env, token) {
  if (!token) return;
  await env.NAV_AUTH.delete(`${SESSION_PREFIX}${token}`);
}

async function validateAdminSession(request, env) {
  const cookies = parseCookies(request.headers.get('Cookie') || '');
  const token = cookies[SESSION_COOKIE_NAME];
  if (!token) {
    return { authenticated: false };
  }
  const sessionKey = `${SESSION_PREFIX}${token}`;
  const payload = await env.NAV_AUTH.get(sessionKey);
  if (!payload) {
    return { authenticated: false };
  }
  // 会话有效，刷新TTL
  await refreshAdminSession(env, token, payload);
  return { authenticated: true, token };
}

async function isAdminAuthenticated(request, env) {
  const { authenticated } = await validateAdminSession(request, env);
  return authenticated;
}

  
  /**
   * 处理 API 请求
   */
  const api = {
    async handleRequest(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname.replace('/api', ''); // 去掉 "/api" 前缀
        const method = request.method;
        const id = url.pathname.split('/').pop(); // 获取最后一个路径段，作为 id (例如 /api/config/1)
        try {
            // 🔥 新增：一键获取favicon API
            if (path === '/favicon' && method === 'GET') {
  const siteUrl = url.searchParams.get('url');
  if (!siteUrl) {
    return this.errorResponse('URL parameter is required', 400);
  }
  const favicon = await getFavicon(siteUrl);
  return new Response(JSON.stringify({
    code: 200,
    favicon: favicon || ''
  }), { headers: { 'Content-Type': 'application/json' } });
}
            if (path === '/config') {
                switch (method) {
                    case 'GET':
                        return await this.getConfig(request, env, ctx, url);
                    case 'POST':
                        if (!(await isAdminAuthenticated(request, env))) {
                            return this.errorResponse('Unauthorized', 401);
                        }
                        return await this.createConfig(request, env, ctx);
                    default:
                        return this.errorResponse('Method Not Allowed', 405)
                }
            }
            if (path === '/config/submit' && method === 'POST') {
              if (!isSubmissionEnabled(env)) {
                return this.errorResponse('Public submission disabled', 403);
              }
              return await this.submitConfig(request, env, ctx);
           }
           if (path === '/categories' && method === 'GET') {
              if (!(await isAdminAuthenticated(request, env))) {
                  return this.errorResponse('Unauthorized', 401);
              }
              return await this.getCategories(request, env, ctx);
           }
            if (path.startsWith('/categories/')) {
                if (!(await isAdminAuthenticated(request, env))) {
                    return this.errorResponse('Unauthorized', 401);
                }
                const categoryName = decodeURIComponent(path.replace('/categories/', ''));
                switch (method) {
                    case 'PUT':
                        return await this.updateCategoryOrder(request, env, ctx, categoryName);
                    default:
                        return this.errorResponse('Method Not Allowed', 405);
                }
            }
            if (path === `/config/${id}` && /^\d+$/.test(id)) {
                switch (method) {
                    case 'PUT':
                        if (!(await isAdminAuthenticated(request, env))) {
                            return this.errorResponse('Unauthorized', 401);
                        }
                        return await this.updateConfig(request, env, ctx, id);
                    case 'DELETE':
                        if (!(await isAdminAuthenticated(request, env))) {
                            return this.errorResponse('Unauthorized', 401);
                        }
                        return await this.deleteConfig(request, env, ctx, id);
                    default:
                        return this.errorResponse('Method Not Allowed', 405)
                }
            }
              if (path.startsWith('/pending/') && /^\d+$/.test(id)) {
                switch (method) {
                    case 'PUT':
                        if (!(await isAdminAuthenticated(request, env))) {
                            return this.errorResponse('Unauthorized', 401);
                        }
                        return await this.approvePendingConfig(request, env, ctx, id);
                    case 'DELETE':
                        if (!(await isAdminAuthenticated(request, env))) {
                            return this.errorResponse('Unauthorized', 401);
                        }
                        return await this.rejectPendingConfig(request, env, ctx, id);
                    default:
                        return this.errorResponse('Method Not Allowed', 405)
                }
            }
            if (path === '/config/import' && method === 'POST') {
                if (!(await isAdminAuthenticated(request, env))) {
                    return this.errorResponse('Unauthorized', 401);
                }
                return await this.importConfig(request, env, ctx);
            }
            if (path === '/config/export' && method === 'GET') {
                if (!(await isAdminAuthenticated(request, env))) {
                    return this.errorResponse('Unauthorized', 401);
                }
                return await this.exportConfig(request, env, ctx);
            }
            if (path === '/pending' && method === 'GET') {
              if (!(await isAdminAuthenticated(request, env))) {
                  return this.errorResponse('Unauthorized', 401);
              }
              return await this.getPendingConfig(request, env, ctx, url);
            }
            return this.errorResponse('Not Found', 404);
        } catch (error) {
            return this.errorResponse(`Internal Server Error: ${error.message}`, 500);
        }
    },
      async getConfig(request, env, ctx, url) {
              const catalog = url.searchParams.get('catalog');
              const page = parseInt(url.searchParams.get('page') || '1', 10);
              const pageSize = parseInt(url.searchParams.get('pageSize') || '10', 10);
              const keyword = url.searchParams.get('keyword');
              const offset = (page - 1) * pageSize;
                            try {
                  //- [优化] 调整了SQL查询语句，增加了 sort_order 排序
                  let query = `SELECT * FROM sites ORDER BY sort_order ASC, create_time DESC LIMIT ? OFFSET ?`;
                  let countQuery = `SELECT COUNT(*) as total FROM sites`;
                  let queryBindParams = [pageSize, offset];
                  let countQueryParams = [];
  
                  if (catalog) {
                      query = `SELECT * FROM sites WHERE catelog = ? ORDER BY sort_order ASC, create_time DESC LIMIT ? OFFSET ?`;
                      countQuery = `SELECT COUNT(*) as total FROM sites WHERE catelog = ?`
                      queryBindParams = [catalog, pageSize, offset];
                      countQueryParams = [catalog];
                  }
  
                  if (keyword) {
                      const likeKeyword = `%${keyword}%`;
                      query = `SELECT * FROM sites WHERE name LIKE ? OR url LIKE ? OR catelog LIKE ? ORDER BY sort_order ASC, create_time DESC LIMIT ? OFFSET ?`;
                      countQuery = `SELECT COUNT(*) as total FROM sites WHERE name LIKE ? OR url LIKE ? OR catelog LIKE ?`;
                      queryBindParams = [likeKeyword, likeKeyword, likeKeyword, pageSize, offset];
                      countQueryParams = [likeKeyword, likeKeyword, likeKeyword];
  
                      if (catalog) {
                          query = `SELECT * FROM sites WHERE catelog = ? AND (name LIKE ? OR url LIKE ? OR catelog LIKE ?) ORDER BY sort_order ASC, create_time DESC LIMIT ? OFFSET ?`;
                          countQuery = `SELECT COUNT(*) as total FROM sites WHERE catelog = ? AND (name LIKE ? OR url LIKE ? OR catelog LIKE ?)`;
                          queryBindParams = [catalog, likeKeyword, likeKeyword, likeKeyword, pageSize, offset];
                          countQueryParams = [catalog, likeKeyword, likeKeyword, likeKeyword];
                      }
                  }
  
                  const { results } = await env.NAV_DB.prepare(query).bind(...queryBindParams).all();
                  const countResult = await env.NAV_DB.prepare(countQuery).bind(...countQueryParams).first();
                  const total = countResult ? countResult.total : 0;
  
                return new Response(
                  JSON.stringify({
                      code: 200,
                      data: results,
                      total,
                      page,
                      pageSize
                  }),
                  { headers: { 'Content-Type': 'application/json' } }
              );
              
              } catch (e) {
                  return this.errorResponse(`Failed to fetch config data: ${e.message}`, 500)
              }
          },
      async getPendingConfig(request, env, ctx, url) {
            const page = parseInt(url.searchParams.get('page') || '1', 10);
            const pageSize = parseInt(url.searchParams.get('pageSize') || '10', 10);
            const offset = (page - 1) * pageSize;
            try {
                const { results } = await env.NAV_DB.prepare(`
                        SELECT * FROM pending_sites ORDER BY create_time DESC LIMIT ? OFFSET ?
                    `).bind(pageSize, offset).all();
                  const countResult = await env.NAV_DB.prepare(`
                      SELECT COUNT(*) as total FROM pending_sites
                      `).first();
                const total = countResult ? countResult.total : 0;
                  return new Response(
                      JSON.stringify({
                        code: 200,
                        data: results,
                          total,
                        page,
                        pageSize
                      }),
                      {headers: {'Content-Type': 'application/json'}}
                  );
            } catch (e) {
                return this.errorResponse(`Failed to fetch pending config data: ${e.message}`, 500);
            }
        },
        async approvePendingConfig(request, env, ctx, id) {
            try {
                const { results } = await env.NAV_DB.prepare('SELECT * FROM pending_sites WHERE id = ?').bind(id).all();
                if(results.length === 0) {
                    return this.errorResponse('Pending config not found', 404);
                }
                 const config = results[0];
                 //- [优化] 批准时，插入的数据也包含了 sort_order 的默认值
                await env.NAV_DB.prepare(`
                    INSERT INTO sites (name, url, logo, desc, catelog, sort_order)
                    VALUES (?, ?, ?, ?, ?, 9999) 
              `).bind(config.name, config.url, config.logo, config.desc, config.catelog).run();
                await env.NAV_DB.prepare('DELETE FROM pending_sites WHERE id = ?').bind(id).run();
  
                 return new Response(JSON.stringify({
                    code: 200,
                    message: 'Pending config approved successfully'
                }),{
                    headers: {
                        'Content-Type': 'application/json'
                    }
                })
            }catch(e) {
                return this.errorResponse(`Failed to approve pending config : ${e.message}`, 500);
            }
        },
        async rejectPendingConfig(request, env, ctx, id) {
            try{
                await env.NAV_DB.prepare('DELETE FROM pending_sites WHERE id = ?').bind(id).run();
                return new Response(JSON.stringify({
                    code: 200,
                    message: 'Pending config rejected successfully',
                }), {headers: {'Content-Type': 'application/json'}});
            } catch(e) {
                return this.errorResponse(`Failed to reject pending config: ${e.message}`, 500);
            }
        },
        async submitConfig(request, env, ctx) {
          try {
          if (!isSubmissionEnabled(env)) {
            return this.errorResponse('Public submission disabled', 403);
          }
          
          const config = await request.json();
          const { name, url, logo, desc, catelog } = config;
          
          const sanitizedName = (name || '').trim();
          const sanitizedUrl = (url || '').trim();
          const sanitizedCatelog = (catelog || '').trim();
          let sanitizedLogo = (logo || '').trim() || null;
          const sanitizedDesc = (desc || '').trim() || null;
        
          if (!sanitizedName || !sanitizedUrl || !sanitizedCatelog ) {
            return this.errorResponse('Name, URL and Catelog are required', 400);
          }
        
          // 🔥 新增：自动获取favicon
          if (!sanitizedLogo && sanitizedUrl) {
            sanitizedLogo = await getFavicon(sanitizedUrl);
          }
        
          await env.NAV_DB.prepare(`
            INSERT INTO pending_sites (name, url, logo, desc, catelog)
            VALUES (?, ?, ?, ?, ?)
          `).bind(sanitizedName, sanitizedUrl, sanitizedLogo, sanitizedDesc, sanitizedCatelog).run();
        
          return new Response(JSON.stringify({
            code: 201,
            message: 'Config submitted successfully, waiting for admin approve',
            favicon: sanitizedLogo  // 🔥 新增返回favicon
          }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          })
          } catch(e) {
          return this.errorResponse(`Failed to submit config: ${e.message}`, 500);
          }
        },
      
      
      async createConfig(request, env, ctx) {
        try {
        const config = await request.json();
        const { name, url, logo, desc, catelog, sort_order } = config;
        
        const sanitizedName = (name || '').trim();
        const sanitizedUrl = (url || '').trim();
        const sanitizedCatelog = (catelog || '').trim();
        let sanitizedLogo = (logo || '').trim() || null;  // 🔥 改为let
        const sanitizedDesc = (desc || '').trim() || null;
        const sortOrderValue = normalizeSortOrder(sort_order);
      
        if (!sanitizedName || !sanitizedUrl || !sanitizedCatelog ) {
          return this.errorResponse('Name, URL and Catelog are required', 400);
        }
      
        // 🔥 新增：自动获取favicon
        if (!sanitizedLogo && sanitizedUrl) {
          sanitizedLogo = await getFavicon(sanitizedUrl);
        }
      
        const insert = await env.NAV_DB.prepare(`
          INSERT INTO sites (name, url, logo, desc, catelog, sort_order)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(sanitizedName, sanitizedUrl, sanitizedLogo, sanitizedDesc, sanitizedCatelog, sortOrderValue).run();
      
        return new Response(JSON.stringify({
          code: 201,
          message: 'Config created successfully',
          favicon: sanitizedLogo,  // 🔥 新增返回favicon
          insert
        }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        })
        } catch(e) {
        return this.errorResponse(`Failed to create config: ${e.message}`, 500);
        }
      },
  
        async updateConfig(request, env, ctx, id) {
          try {
              const config = await request.json();
              //- [新增] 从请求体中获取 sort_order
              const { name, url, logo, desc, catelog, sort_order } = config;
              const sanitizedName = (name || '').trim();
              const sanitizedUrl = (url || '').trim();
              const sanitizedCatelog = (catelog || '').trim();
              const sanitizedLogo = (logo || '').trim() || null;
              const sanitizedDesc = (desc || '').trim() || null;
              const sortOrderValue = normalizeSortOrder(sort_order);
  
            if (!sanitizedName || !sanitizedUrl || !sanitizedCatelog) {
              return this.errorResponse('Name, URL and Catelog are required', 400);
            }
            //- [优化] UPDATE 语句增加了 sort_order 字段
            const update = await env.NAV_DB.prepare(`
                UPDATE sites
                SET name = ?, url = ?, logo = ?, desc = ?, catelog = ?, sort_order = ?, update_time = CURRENT_TIMESTAMP
                WHERE id = ?
            `).bind(sanitizedName, sanitizedUrl, sanitizedLogo, sanitizedDesc, sanitizedCatelog, sortOrderValue, id).run();
            return new Response(JSON.stringify({
                code: 200,
                message: 'Config updated successfully',
                update
            }), { headers: { 'Content-Type': 'application/json' }});
          } catch (e) {
              return this.errorResponse(`Failed to update config: ${e.message}`, 500);
          }
      },
  
      async deleteConfig(request, env, ctx, id) {
          try{
              const del = await env.NAV_DB.prepare('DELETE FROM sites WHERE id = ?').bind(id).run();
              return new Response(JSON.stringify({
                  code: 200,
                  message: 'Config deleted successfully',
                  del
              }), {headers: {'Content-Type': 'application/json'}});
          } catch(e) {
            return this.errorResponse(`Failed to delete config: ${e.message}`, 500);
          }
      },
      async importConfig(request, env, ctx) {
        try {
          const jsonData = await request.json();
          let sitesToImport = [];

          // [优化] 智能判断导入的JSON文件格式
          // 1. 如果 jsonData 本身就是数组 (新的、正确的导出格式)
          if (Array.isArray(jsonData)) {
            sitesToImport = jsonData;
          } 
          // 2. 如果 jsonData 是一个对象，且包含一个名为 'data' 的数组 (兼容旧的导出格式)
          else if (jsonData && typeof jsonData === 'object' && Array.isArray(jsonData.data)) {
            sitesToImport = jsonData.data;
          } 
          // 3. 如果两种都不是，则格式无效
          else {
            return this.errorResponse('Invalid JSON data. Must be an array of site configurations, or an object with a "data" key containing the array.', 400);
          }
          
          if (sitesToImport.length === 0) {
            return new Response(JSON.stringify({
              code: 200,
              message: 'Import successful, but no data was found in the file.'
            }), { headers: {'Content-Type': 'application/json'} });
          }

          const insertStatements = sitesToImport.map(item => {
                const sanitizedName = (item.name || '').trim() || null;
                const sanitizedUrl = (item.url || '').trim() || null;
                const sanitizedLogo = (item.logo || '').trim() || null;
                const sanitizedDesc = (item.desc || '').trim() || null;
                const sanitizedCatelog = (item.catelog || '').trim() || null;
                const sortOrderValue = normalizeSortOrder(item.sort_order);
                return env.NAV_DB.prepare(`
                        INSERT INTO sites (name, url, logo, desc, catelog, sort_order)
                        VALUES (?, ?, ?, ?, ?, ?)
                  `).bind(sanitizedName, sanitizedUrl, sanitizedLogo, sanitizedDesc, sanitizedCatelog, sortOrderValue);
            })
  
          // 使用 D1 的 batch 操作，效率更高
          await env.NAV_DB.batch(insertStatements);
  
          return new Response(JSON.stringify({
              code: 201,
              message: `Config imported successfully. ${sitesToImport.length} items added.`
          }), {
              status: 201,
              headers: {'Content-Type': 'application/json'}
          });
        } catch (error) {
          return this.errorResponse(`Failed to import config : ${error.message}`, 500);
        }
      },
  
async exportConfig(request, env, ctx) {
        try{
          // [优化] 导出的数据将不再被包裹在 {code, data} 对象中
          const { results } = await env.NAV_DB.prepare('SELECT * FROM sites ORDER BY sort_order ASC, create_time DESC').all();
          
          // JSON.stringify 的第二和第三个参数用于“美化”输出的JSON，
          // null 表示不替换任何值，2 表示使用2个空格进行缩进。
          // 这使得导出的文件非常易于阅读和手动编辑。
          const pureJsonData = JSON.stringify(results, null, 2); 

          return new Response(pureJsonData, {
              headers: {
                'Content-Type': 'application/json; charset=utf-8',
                // 确保浏览器将其作为文件下载
                'Content-Disposition': 'attachment; filename="config.json"'
              }
          });
        } catch(e) {
          return this.errorResponse(`Failed to export config: ${e.message}`, 500)
        }
      },
      async getCategories(request, env, ctx) {
          try {
              const categoryOrderMap = new Map();
              try {
                  const { results: orderRows } = await env.NAV_DB.prepare('SELECT catelog, sort_order FROM category_orders').all();
                  orderRows.forEach(row => {
                      categoryOrderMap.set(row.catelog, normalizeSortOrder(row.sort_order));
                  });
              } catch (error) {
                  if (!/no such table/i.test(error.message || '')) {
                      throw error;
                  }
              }

              const { results } = await env.NAV_DB.prepare(`
                SELECT catelog, COUNT(*) AS site_count, MIN(sort_order) AS min_site_sort
                FROM sites
                GROUP BY catelog
              `).all();

              const data = results.map(row => ({
                  catelog: row.catelog,
                  site_count: row.site_count,
                  sort_order: categoryOrderMap.has(row.catelog)
                    ? categoryOrderMap.get(row.catelog)
                    : normalizeSortOrder(row.min_site_sort),
                  explicit: categoryOrderMap.has(row.catelog),
                  min_site_sort: row.min_site_sort === null ? 9999 : normalizeSortOrder(row.min_site_sort)
              }));

              data.sort((a, b) => {
                  if (a.sort_order !== b.sort_order) {
                      return a.sort_order - b.sort_order;
                  }
                  if (a.min_site_sort !== b.min_site_sort) {
                      return a.min_site_sort - b.min_site_sort;
                  }
                  return a.catelog.localeCompare(b.catelog, 'zh-Hans-CN', { sensitivity: 'base' });
              });

              return new Response(JSON.stringify({
                  code: 200,
                  data
              }), { headers: { 'Content-Type': 'application/json' } });
          } catch (e) {
              return this.errorResponse(`Failed to fetch categories: ${e.message}`, 500);
          }
      },
      async updateCategoryOrder(request, env, ctx, categoryName) {
          try {
              const body = await request.json();
              if (!categoryName) {
                  return this.errorResponse('Category name is required', 400);
              }

              const normalizedCategory = categoryName.trim();
              if (!normalizedCategory) {
                  return this.errorResponse('Category name is required', 400);
              }

              if (body && body.reset) {
                  await env.NAV_DB.prepare('DELETE FROM category_orders WHERE catelog = ?')
                      .bind(normalizedCategory)
                      .run();
                  return new Response(JSON.stringify({
                      code: 200,
                      message: 'Category order reset successfully'
                  }), { headers: { 'Content-Type': 'application/json' } });
              }

              const sortOrderValue = normalizeSortOrder(body ? body.sort_order : undefined);
              await env.NAV_DB.prepare(`
                INSERT INTO category_orders (catelog, sort_order)
                VALUES (?, ?)
                ON CONFLICT(catelog) DO UPDATE SET sort_order = excluded.sort_order
              `).bind(normalizedCategory, sortOrderValue).run();

              return new Response(JSON.stringify({
                  code: 200,
                  message: 'Category order updated successfully'
              }), { headers: { 'Content-Type': 'application/json' } });
          } catch (e) {
              return this.errorResponse(`Failed to update category order: ${e.message}`, 500);
          }
      },
       errorResponse(message, status) {
          return new Response(JSON.stringify({code: status, message: message}), {
              status: status,
              headers: { 'Content-Type': 'application/json' },
          });
      }
    };
  
  
  /**
   * 处理后台管理页面请求
   */
  const admin = {
  async handleRequest(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/admin/logout') {
      if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
      }
      const { token } = await validateAdminSession(request, env);
      if (token) {
        await destroyAdminSession(env, token);
      }
      return new Response(null, {
        status: 302,
        headers: {
          Location: '/admin',
          'Set-Cookie': buildSessionCookie('', { maxAge: 0 }),
        },
      });
    }

    if (url.pathname === '/admin') {
      if (request.method === 'POST') {
        const formData = await request.formData();
        const name = (formData.get('name') || '').trim();
        const password = (formData.get('password') || '').trim();

        const storedUsername = await env.NAV_AUTH.get('admin_username');
        const storedPassword = await env.NAV_AUTH.get('admin_password');

        const isValid =
          storedUsername &&
          storedPassword &&
          name === storedUsername &&
          password === storedPassword;

        if (isValid) {
          const token = await createAdminSession(env);
          return new Response(null, {
            status: 302,
            headers: {
              Location: '/admin',
              'Set-Cookie': buildSessionCookie(token),
            },
          });
        }

        return this.renderLoginPage('账号或密码错误，请重试。');
      }

      const session = await validateAdminSession(request, env);
      if (session.authenticated) {
        return this.renderAdminPage();
      }

      return this.renderLoginPage();
    }
    
    if (url.pathname.startsWith('/static')) {
      return this.handleStatic(request, env, ctx);
    }
    
    return new Response('页面不存在', {status: 404});
  },
     async handleStatic(request, env, ctx) {
        const url = new URL(request.url);
        const filePath = url.pathname.replace('/static/', '');
  
        let contentType = 'text/plain';
        if (filePath.endsWith('.css')) {
           contentType = 'text/css';
        } else if (filePath.endsWith('.js')) {
           contentType = 'application/javascript';
        }
  
        try {
            const fileContent = await this.getFileContent(filePath)
            return new Response(fileContent, {
              headers: { 'Content-Type': contentType }
            });
        } catch (e) {
           return new Response('Not Found', {status: 404});
        }
  
      },
    async getFileContent(filePath) {
        const fileContents = {
           'admin.html': `<!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>书签管理页面</title>
      <link rel="stylesheet" href="/static/admin.css">
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&display=swap" rel="stylesheet">
    </head>
    <body>
      <div class="container">
          <header class="admin-header">
            <div>
              <h1>书签管理</h1>
              <p class="admin-subtitle">管理后台仅限受信任的管理员使用，请妥善保管账号</p>
            </div>
            <form method="post" action="/admin/logout">
              <button type="submit" class="logout-btn">退出登录</button>
            </form>
          </header>
      
          <div class="import-export">
            <input type="file" id="importFile" accept=".json" style="display:none;">
            <button id="importBtn">导入</button>
            <button id="exportBtn">导出</button>
          </div>
      
          <!-- [优化] 添加区域HTML结构，并新增排序输入框 -->
          <div class="add-new">
  <input type="text" id="addName" placeholder="Name" required>
  <input type="text" id="addUrl" placeholder="URL" required>
  
  <!-- 🔥 Logo输入框 + 获取按钮 -->
  <div style="flex: 1 1 150px; min-width: 150px; display: flex; flex-direction: column;">
    <input type="text" id="addLogo" placeholder="Logo(optional)">
    <button type="button" id="fetchAdminFaviconBtn" style="margin-top: 4px; padding: 6px 8px; font-size: 0.8rem; background: #6c63ff; color: white; border: none; border-radius: 4px; cursor: pointer;">获取图标</button>
  </div>
  
  <input type="text" id="addDesc" placeholder="Description(optional)">
  <input type="text" id="addCatelog" placeholder="Catelog" required>
  <input type="number" id="addSortOrder" placeholder="排序 (数字小靠前)">
  <button id="addBtn">添加</button>
</div>
<div id="adminFaviconStatus" style="display: none; padding: 0.5rem; border-radius: 0.25rem; margin-bottom: 1rem; font-size: 0.85rem;"></div>

          <div id="message" style="display: none;padding:1rem;border-radius: 0.5rem;margin-bottom: 1rem;"></div>
         <div class="tab-wrapper">
              <div class="tab-buttons">
                 <button class="tab-button active" data-tab="config">书签列表</button>
                 <button class="tab-button" data-tab="pending">待审核列表</button>
                 <button class="tab-button" data-tab="categories">分类排序</button>
              </div>
               <div id="config" class="tab-content active">
                    <div class="table-wrapper">
                        <table id="configTable">
                            <thead>
                                <tr>
                                  <th>ID</th>
                                  <th>Name</th>
                                  <th>URL</th>
                                  <th>Logo</th>
                                  <th>Description</th>
                                  <th>Catelog</th>
                                  <th>排序</th> <!-- [新增] 表格头增加排序 -->
                                  <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="configTableBody">
                              <!-- data render by js -->
                            </tbody>
                        </table>
                        <div class="pagination">
                              <button id="prevPage" disabled>上一页</button>
                              <span id="currentPage">1</span>/<span id="totalPages">1</span>
                              <button id="nextPage" disabled>下一页</button>
                        </div>
                   </div>
                </div>
               <div id="pending" class="tab-content">
                 <div class="table-wrapper">
                   <table id="pendingTable">
                      <thead>
                        <tr>
                            <th>ID</th>
                             <th>Name</th>
                             <th>URL</th>
                            <th>Logo</th>
                            <th>Description</th>
                            <th>Catelog</th>
                            <th>Actions</th>
                        </tr>
                        </thead>
                        <tbody id="pendingTableBody">
                       <!-- data render by js -->
                        </tbody>
                    </table>
                     <div class="pagination">
                      <button id="pendingPrevPage" disabled>上一页</button>
                       <span id="pendingCurrentPage">1</span>/<span id="pendingTotalPages">1</span>
                      <button id="pendingNextPage" disabled>下一页</button>
                    </div>
               </div>
              </div>
              <div id="categories" class="tab-content">
                <div class="table-wrapper">
                  <div class="category-toolbar">
                    <p class="category-hint">设置分类排序值（数字越小越靠前），留空表示使用默认顺序。</p>
                    <button id="refreshCategories" type="button">刷新</button>
                  </div>
                  <table id="categoryTable">
                    <thead>
                      <tr>
                        <th>分类</th>
                        <th>书签数量</th>
                        <th>排序值</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody id="categoryTableBody">
                      <tr><td colspan="4">加载中...</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
      </div>
      <script src="/static/admin.js"></script>
    </body>
    </html>`,
            'admin.css': `body {
        font-family: 'Noto Sans SC', sans-serif;
        margin: 0;
        padding: 10px; /* [优化] 移动端边距 */
        background-color: #f8f9fa;
        color: #212529;
    }
    .modal {
        display: none;
        position: fixed;
        z-index: 1000;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        overflow: auto;
        background-color: rgba(0, 0, 0, 0.5); /* 半透明背景 */
    }
    .modal-content {
        background-color: #fff;
        margin: 10% auto;
        padding: 20px;
        border: 1px solid #dee2e6;
        width: 80%; /* [优化] 调整宽度以适应移动端 */
        max-width: 600px;
        border-radius: 8px;
        position: relative;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .modal-close {
        color: #6c757d;
        position: absolute;
        right: 10px;
        top: 0;
        font-size: 28px;
        font-weight: bold;
        cursor: pointer;
        transition: color 0.2s;
    }
    
    .modal-close:hover,
    .modal-close:focus {
        color: #343a40; /* 悬停时颜色加深 */
        text-decoration: none;
        cursor: pointer;
    }
    .modal-content form {
        display: flex;
        flex-direction: column;
    }
    
    .modal-content form label {
        margin-bottom: 5px;
        font-weight: 500; /* 字重 */
        color: #495057; /* 标签颜色 */
    }
    .modal-content form input {
        margin-bottom: 10px;
        padding: 10px;
        border: 1px solid #ced4da; /* 输入框边框 */
        border-radius: 4px;
        font-size: 1rem;
        outline: none;
        transition: border-color 0.2s;
    }
    .modal-content form input:focus {
        border-color: #80bdff; /* 焦点边框颜色 */
        box-shadow:0 0 0 0.2rem rgba(0,123,255,.25);
    }
    .modal-content form input:focus {
        border-color: #80bdff; /* 焦点边框颜色 */
        box-shadow: 0 0 0 0.2rem rgba(0,123,255,.25);
    }
    .modal-content button[type='submit'] {
        margin-top: 10px;
        background-color: #007bff; /* 提交按钮颜色 */
        color: #fff;
        border: none;
        padding: 10px 15px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 1rem;
        transition: background-color 0.3s;
    }
    
    .modal-content button[type='submit']:hover {
        background-color: #0056b3; /* 悬停时颜色加深 */
    }
.container {
        max-width: 1200px;
        margin: 0 auto; /* [优化] 移动端居中 */
        background-color: #fff;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
    }
    .admin-header {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-bottom: 24px;
    }
    @media (min-width: 768px) {
        .admin-header {
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
        }
    }
    h1 {
        font-size: 1.75rem;
        margin: 0;
        color: #343a40;
    }
    .admin-subtitle {
        margin: 4px 0 0;
        color: #6c757d;
        font-size: 0.95rem;
    }
    .logout-btn {
        background-color: #f8f9fa;
        color: #495057;
        border: 1px solid #ced4da;
        padding: 8px 14px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.95rem;
        transition: background-color 0.2s, color 0.2s, box-shadow 0.2s;
    }
    .logout-btn:hover {
        background-color: #e9ecef;
        color: #212529;
        box-shadow: 0 3px 10px rgba(0,0,0,0.08);
    }
    .tab-wrapper {
        margin-top: 20px;
    }
    .tab-buttons {
        display: flex;
        margin-bottom: 10px;
        flex-wrap: wrap; /* [优化] 移动端换行 */
    }
    .tab-button {
        background-color: #e9ecef;
        border: 1px solid #dee2e6;
        padding: 10px 15px;
        border-radius: 4px 4px 0 0;
        cursor: pointer;
        color: #495057; /* tab按钮文字颜色 */
        transition: background-color 0.2s, color 0.2s;
    }
    .tab-button.active {
        background-color: #fff;
        border-bottom: 1px solid #fff;
        color: #212529; /* 选中tab颜色 */
    }
    .tab-button:hover {
        background-color: #f0f0f0;
    }
    .tab-content {
        display: none;
        border: 1px solid #dee2e6;
        padding: 10px;
        border-top: none;
    }
    .tab-content.active {
        display: block;
    }
    
    .import-export {
        display: flex;
        gap: 10px;
        margin-bottom: 20px;
        justify-content: flex-end;
        flex-wrap: wrap; /* [优化] 移动端换行 */
    }
    
 /* [优化] 添加区域适配移动端 */
    .add-new {
        display: flex;
        gap: 10px;
        margin-bottom: 20px;
        flex-wrap: wrap; /* 核心：允许换行 */
    }
    .add-new > input {
        flex: 1 1 150px; /* 弹性布局，基础宽度150px，允许伸缩 */
        min-width: 150px; /* 最小宽度 */
    }
    .add-new > button {
        flex-basis: 100%; /* 在移动端，按钮占据一整行 */
    }
    input[type="text"] {
        padding: 10px;
        border: 1px solid #ced4da;
        border-radius: 4px;
        font-size: 1rem;
        outline: none;
        margin-bottom: 5px;
         transition: border-color 0.2s;
    }
       @media (min-width: 768px) {
        .add-new > button {
            flex-basis: auto; /* 在桌面端，按钮恢复自动宽度 */
        }
    }
    input[type="text"], input[type="number"] {
        padding: 10px;
        border: 1px solid #ced4da;
        border-radius: 4px;
        font-size: 1rem;
        outline: none;
        margin-bottom: 5px;
         transition: border-color 0.2s;
    }
    input[type="text"]:focus, input[type="number"]:focus {
        border-color: #80bdff;
        box-shadow: 0 0 0 0.2rem rgba(0,123,255,.25);
    }
    button {
        background-color: #6c63ff; /* 主色调 */
        color: #fff;
        border: none;
        padding: 10px 15px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 1rem;
        transition: background-color 0.3s;
    }
    button:hover {
        background-color: #534dc4;
    }
    /* [优化] 保证表格在小屏幕上可以横向滚动 */
    .table-wrapper {
        overflow-x: auto;
    }
    table {
        width: 100%;
        min-width: 800px; /* 设置一个最小宽度，当屏幕小于此值时出现滚动条 */
        border-collapse: collapse;
        margin-bottom: 20px;
    }
    th, td {
        border: 1px solid #dee2e6;
        padding: 10px;
        text-align: left;
        color: #495057; /* 表格文字颜色 */
    }
    th {
        background-color: #f2f2f2;
        font-weight: 600;
    }
    tr:nth-child(even) {
        background-color: #f9f9f9;
    }
    .category-toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        gap: 10px;
        flex-wrap: wrap;
    }
    .category-hint {
        margin: 0;
        font-size: 0.85rem;
        color: #6c757d;
    }
    #refreshCategories {
        background-color: #f8f9fa;
        color: #495057;
        border: 1px solid #ced4da;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.9rem;
        transition: background-color 0.2s;
    }
    #refreshCategories:hover {
        background-color: #e9ecef;
    }
    .category-sort-input {
        width: 100%;
        padding: 6px 8px;
        border: 1px solid #ced4da;
        border-radius: 4px;
    }
    .category-sort-input:focus {
        border-color: #80bdff;
        box-shadow: 0 0 0 0.2rem rgba(0,123,255,.25);
        outline: none;
    }
    .category-actions {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
    }
    .category-actions button {
        padding: 5px 10px;
        font-size: 0.85rem;
    }
    .category-actions button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
    
    .actions {
        display: flex;
        gap: 5px;
    }
    .actions button {
        padding: 5px 8px;
        font-size: 0.8rem;
    }
    .edit-btn {
        background-color: #17a2b8; /* 编辑按钮颜色 */
    }
    
    .del-btn {
        background-color: #dc3545; /* 删除按钮颜色 */
    }
    .pagination {
        text-align: center;
        margin-top: 20px;
    }
    .pagination button {
        margin: 0 5px;
        background-color: #e9ecef; /* 分页按钮颜色 */
        color: #495057;
        border: 1px solid #ced4da;
    }
    .pagination button:hover {
        background-color: #dee2e6;
    }
    
    .success {
        background-color: #28a745;
        color: #fff;
    }
    .error {
        background-color: #dc3545;
        color: #fff;
    }

    /* 🔥 新增：后台favicon状态样式 */
    #adminFaviconStatus {
      transition: all 0.3s ease;
    }
    .status-loading {
      background-color: #fff3cd !important;
      color: #856404 !important;
      border: 1px solid #ffeaa7 !important;
      padding: 0.5rem;
      border-radius: 0.25rem;
      margin-bottom: 1rem;
      font-size: 0.85rem;
    }
    .status-success {
      background-color: #d4edda !important;
      color: #155724 !important;
      border: 1px solid #c3e6cb !important;
      padding: 0.5rem;
      border-radius: 0.25rem;
      margin-bottom: 1rem;
      font-size: 0.85rem;
    }
    .status-error {
      background-color: #f8d7da !important;
      color: #721c24 !important;
      border: 1px solid #f5c6cb !important;
      padding: 0.5rem;
      border-radius: 0.25rem;
      margin-bottom: 1rem;
      font-size: 0.85rem;
    }
      `,
          'admin.js': `
          const configTableBody = document.getElementById('configTableBody');
          const prevPageBtn = document.getElementById('prevPage');
          const nextPageBtn = document.getElementById('nextPage');
          const currentPageSpan = document.getElementById('currentPage');
          const totalPagesSpan = document.getElementById('totalPages');
          
          const pendingTableBody = document.getElementById('pendingTableBody');
            const pendingPrevPageBtn = document.getElementById('pendingPrevPage');
            const pendingNextPageBtn = document.getElementById('pendingNextPage');
            const pendingCurrentPageSpan = document.getElementById('pendingCurrentPage');
            const pendingTotalPagesSpan = document.getElementById('pendingTotalPages');
          
          const messageDiv = document.getElementById('message');
          const categoryTableBody = document.getElementById('categoryTableBody');
          const refreshCategoriesBtn = document.getElementById('refreshCategories');
          
          var escapeHTML = function(value) {
            var result = '';
            if (value !== null && value !== undefined) {
              result = String(value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
            }
            return result;
          };
          
          var normalizeUrl = function(value) {
            var trimmed = String(value || '').trim();
            var normalized = '';
            if (/^https?:\\/\\//i.test(trimmed)) {
              normalized = trimmed;
            } else if (/^[\\w.-]+\\.[\\w.-]+/.test(trimmed)) {
              normalized = 'https://' + trimmed;
            }
            return normalized;
          };
          
          const addBtn = document.getElementById('addBtn');
          const addName = document.getElementById('addName');
          const addUrl = document.getElementById('addUrl');
          const addLogo = document.getElementById('addLogo');
          const addDesc = document.getElementById('addDesc');
          const addCatelog = document.getElementById('addCatelog');
          const addSortOrder = document.getElementById('addSortOrder'); // [新增] 获取排序输入框
          
          const importBtn = document.getElementById('importBtn');
          const importFile = document.getElementById('importFile');
          const exportBtn = document.getElementById('exportBtn');
          
           const tabButtons = document.querySelectorAll('.tab-button');
            const tabContents = document.querySelectorAll('.tab-content');
          
            tabButtons.forEach(button => {
                button.addEventListener('click', () => {
                const tab = button.dataset.tab;
                tabButtons.forEach(b => b.classList.remove('active'));
                 button.classList.add('active');
                tabContents.forEach(content => {
                   content.classList.remove('active');
                    if(content.id === tab) {
                       content.classList.add('active');
                     }
                  })
                if (tab === 'categories') {
                  fetchCategories();
                }
            });
          });

          if (refreshCategoriesBtn) {
            refreshCategoriesBtn.addEventListener('click', () => {
              fetchCategories();
            });
          }

          
          // 添加搜索框
          const searchInput = document.createElement('input');
          searchInput.type = 'text';
          searchInput.placeholder = '搜索书签(名称，URL，分类)';
          searchInput.id = 'searchInput';
          searchInput.style.marginBottom = '10px';
          document.querySelector('.add-new').parentNode.insertBefore(searchInput, document.querySelector('.add-new'));
          
          
          let currentPage = 1;
          let pageSize = 10;
          let totalItems = 0;
          let allConfigs = []; // 保存所有配置数据
          let currentSearchKeyword = ''; // 保存当前搜索关键词
          
          let pendingCurrentPage = 1;
            let pendingPageSize = 10;
            let pendingTotalItems = 0;
            let allPendingConfigs = []; // 保存所有待审核配置数据
          let categoriesData = []; // 保存分类排序数据
          
          // 创建编辑模态框
          const editModal = document.createElement('div');
          editModal.className = 'modal';
          editModal.style.display = 'none';
          editModal.innerHTML = \`
            <div class="modal-content">
              <span class="modal-close">×</span>
              <h2>编辑站点</h2>
              <form id="editForm">
                <input type="hidden" id="editId">
                <label for="editName">名称:</label>
                <input type="text" id="editName" required><br>
                <label for="editUrl">URL:</label>
                <input type="text" id="editUrl" required><br>
                <label for="editLogo">Logo(可选):</label>
                <input type="text" id="editLogo"><br>
                <label for="editDesc">描述(可选):</label>
                <input type="text" id="editDesc"><br>
                <label for="editCatelog">分类:</label>
                <input type="text" id="editCatelog" required><br>
                <label for="editSortOrder">排序:</label> <!-- [新增] -->
                <input type="number" id="editSortOrder"><br> <!-- [新增] -->
                <button type="submit">保存</button>
              </form>
            </div>
          \`;
          document.body.appendChild(editModal);
          
          const modalClose = editModal.querySelector('.modal-close');
          modalClose.addEventListener('click', () => {
            editModal.style.display = 'none';
          });
          
          const editForm = document.getElementById('editForm');
          editForm.addEventListener('submit', function (e) {
            e.preventDefault();
            const id = document.getElementById('editId').value;
            const name = document.getElementById('editName').value;
            const url = document.getElementById('editUrl').value;
            const logo = document.getElementById('editLogo').value;
            const desc = document.getElementById('editDesc').value;
            const catelog = document.getElementById('editCatelog').value;
                const sort_order = document.getElementById('editSortOrder').value; // [新增]
            const payload = {
                name: name.trim(),
                url: url.trim(),
                logo: logo.trim(),
                desc: desc.trim(),
                catelog: catelog.trim()
            };
            if (sort_order !== '') {
                payload.sort_order = Number(sort_order);
            }
            fetch(\`/api/config/\${id}\`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(payload)
            }).then(res => res.json())
              .then(data => {
                if (data.code === 200) {
                  showMessage('修改成功', 'success');
                  fetchConfigs();
                  editModal.style.display = 'none'; // 关闭弹窗
                } else {
                  showMessage(data.message, 'error');
                }
              }).catch(err => {
                showMessage('网络错误', 'error');
              })
          });
          
          
          function fetchConfigs(page = currentPage, keyword = currentSearchKeyword) {
              let url = \`/api/config?page=\${page}&pageSize=\${pageSize}\`;
              if(keyword) {
                  url = \`/api/config?page=\${page}&pageSize=\${pageSize}&keyword=\${keyword}\`
              }
              fetch(url)
                  .then(res => res.json())
                  .then(data => {
                      if (data.code === 200) {
                          totalItems = data.total;
                          currentPage = data.page;
                                                 totalPagesSpan.innerText = Math.ceil(totalItems / pageSize);
                          currentPageSpan.innerText = currentPage;
                          allConfigs = data.data; // 保存所有数据
                          renderConfig(allConfigs);
                          updatePaginationButtons();
                      } else {
                          showMessage(data.message, 'error');
                      }
                  }).catch(err => {
                  showMessage('网络错误', 'error');
              })
          }
          function renderConfig(configs) {
          configTableBody.innerHTML = '';
           if (configs.length === 0) {
                configTableBody.innerHTML = '<tr><td colspan="7">没有配置数据</td></tr>';
                return
            }
          configs.forEach(config => {
              const row = document.createElement('tr');
              const safeName = escapeHTML(config.name || '');
              const normalizedUrl = normalizeUrl(config.url);
              const displayUrl = config.url ? escapeHTML(config.url) : '未提供';
              const urlCell = normalizedUrl
                ? \`<a href="\${escapeHTML(normalizedUrl)}" target="_blank" rel="noopener noreferrer">\${escapeHTML(normalizedUrl)}</a>\`
                : displayUrl;
              const normalizedLogo = normalizeUrl(config.logo);
              const logoCell = normalizedLogo
                ? \`<img src="\${escapeHTML(normalizedLogo)}" alt="\${safeName}" style="width:30px;" />\`
                : 'N/A';
              const descCell = config.desc ? escapeHTML(config.desc) : 'N/A';
              const catelogCell = escapeHTML(config.catelog || '');
              const sortValue = config.sort_order === 9999 || config.sort_order === null || config.sort_order === undefined
                ? '默认'
                : escapeHTML(config.sort_order);
               row.innerHTML = \`
                 <td>\${config.id}</td>
                  <td>\${safeName}</td>
                  <td>\${urlCell}</td>
                  <td>\${logoCell}</td>
                  <td>\${descCell}</td>
                  <td>\${catelogCell}</td>
                 <td>\${sortValue}</td> <!-- [新增] 显示排序值 -->
                  <td class="actions">
                    <button class="edit-btn" data-id="\${config.id}">编辑</button>
                    <button class="del-btn" data-id="\${config.id}">删除</button>
                  </td>
               \`;
              configTableBody.appendChild(row);
          });
            bindActionEvents();
          }
          
          function bindActionEvents() {
           document.querySelectorAll('.edit-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const id = this.dataset.id;
                    handleEdit(id);
                })
           });
          
          document.querySelectorAll('.del-btn').forEach(btn => {
               btn.addEventListener('click', function() {
                  const id = this.dataset.id;
                   handleDelete(id)
               })
          })
         }

          function fetchCategories() {
            if (!categoryTableBody) {
              return;
            }
            categoryTableBody.innerHTML = '<tr><td colspan="4">加载中...</td></tr>';
            fetch('/api/categories')
              .then(res => res.json())
              .then(data => {
                if (data.code === 200) {
                  categoriesData = data.data || [];
                  renderCategories(categoriesData);
                } else {
                  showMessage(data.message || '加载分类失败', 'error');
                  categoryTableBody.innerHTML = '<tr><td colspan="4">加载失败</td></tr>';
                }
              }).catch(() => {
                showMessage('网络错误', 'error');
                categoryTableBody.innerHTML = '<tr><td colspan="4">加载失败</td></tr>';
              });
          }

          function renderCategories(categories) {
            if (!categoryTableBody) {
              return;
            }
            categoryTableBody.innerHTML = '';
            if (!categories || categories.length === 0) {
              categoryTableBody.innerHTML = '<tr><td colspan="4">暂无分类数据</td></tr>';
              return;
            }

            categories.forEach(item => {
              const row = document.createElement('tr');

              const nameCell = document.createElement('td');
              nameCell.textContent = item.catelog;
              row.appendChild(nameCell);

              const countCell = document.createElement('td');
              countCell.textContent = item.site_count;
              row.appendChild(countCell);

              const sortCell = document.createElement('td');
              const input = document.createElement('input');
              input.type = 'number';
              input.className = 'category-sort-input';
              if (item.explicit) {
                input.value = item.sort_order;
              } else {
                input.placeholder = item.sort_order;
              }
              input.setAttribute('data-category', item.catelog);
              sortCell.appendChild(input);

              const hint = document.createElement('small');
              hint.textContent = '当前默认值：' + item.sort_order;
              hint.style.display = 'block';
              hint.style.marginTop = '4px';
              hint.style.fontSize = '0.75rem';
              hint.style.color = '#6c757d';
              sortCell.appendChild(hint);
              row.appendChild(sortCell);

              const actionCell = document.createElement('td');
              actionCell.className = 'category-actions';

              const saveBtn = document.createElement('button');
              saveBtn.className = 'category-save-btn';
              saveBtn.textContent = '保存';
              saveBtn.setAttribute('data-category', item.catelog);
              actionCell.appendChild(saveBtn);

              const resetBtn = document.createElement('button');
              resetBtn.className = 'category-reset-btn';
              resetBtn.textContent = '重置';
              resetBtn.setAttribute('data-category', item.catelog);
              if (!item.explicit) {
                resetBtn.disabled = true;
              }
              actionCell.appendChild(resetBtn);

              row.appendChild(actionCell);
              categoryTableBody.appendChild(row);
            });

            bindCategoryEvents();
          }

          function bindCategoryEvents() {
            if (!categoryTableBody) {
              return;
            }
            categoryTableBody.querySelectorAll('.category-save-btn').forEach(btn => {
              btn.addEventListener('click', function() {
                const category = this.getAttribute('data-category');
                const input = this.closest('tr').querySelector('.category-sort-input');
                if (!category || !input) {
                  return;
                }
                const rawValue = input.value.trim();
                if (rawValue === '') {
                  showMessage('请输入排序值，或使用“重置”恢复默认。', 'error');
                  return;
                }
                const sortValue = Number(rawValue);
                if (!Number.isFinite(sortValue)) {
                  showMessage('排序值必须为数字', 'error');
                  return;
                }
                fetch('/api/categories/' + encodeURIComponent(category), {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ sort_order: sortValue })
                }).then(res => res.json())
                  .then(data => {
                    if (data.code === 200) {
                      showMessage('分类排序已更新', 'success');
                      fetchCategories();
                    } else {
                      showMessage(data.message || '更新失败', 'error');
                    }
                  }).catch(() => {
                    showMessage('网络错误', 'error');
                  });
              });
            });

            categoryTableBody.querySelectorAll('.category-reset-btn').forEach(btn => {
              btn.addEventListener('click', function() {
                if (this.disabled) {
                  return;
                }
                const category = this.getAttribute('data-category');
                if (!category) {
                  return;
                }
                if (!confirm('确定恢复该分类的默认排序吗？')) {
                  return;
                }
                fetch('/api/categories/' + encodeURIComponent(category), {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ reset: true })
                }).then(res => res.json())
                  .then(data => {
                    if (data.code === 200) {
                      showMessage('已重置分类排序', 'success');
                      fetchCategories();
                    } else {
                      showMessage(data.message || '重置失败', 'error');
                    }
                  }).catch(() => {
                    showMessage('网络错误', 'error');
                  });
              });
            });
          }

    // [优化] 点击编辑时，获取并填充排序字段
          function handleEdit(id) {
            fetch(\`/api/config?page=1&pageSize=1000\`) // A simple way to get all configs to find the one to edit
            .then(res => res.json())
            .then(data => {
                const configToEdit = data.data.find(c => c.id == id);
                if (!configToEdit) {
                    showMessage('找不到要编辑的数据', 'error');
                    return;
                }
                document.getElementById('editId').value = configToEdit.id;
                document.getElementById('editName').value = configToEdit.name;
                document.getElementById('editUrl').value = configToEdit.url;
                document.getElementById('editLogo').value = configToEdit.logo || '';
                document.getElementById('editDesc').value = configToEdit.desc || '';
                document.getElementById('editCatelog').value = configToEdit.catelog;
                document.getElementById('editSortOrder').value = configToEdit.sort_order === 9999 ? '' : configToEdit.sort_order; // [新增]
                editModal.style.display = 'block';
            });
          }
          function handleDelete(id) {
            if(!confirm('确认删除？')) return;
             fetch(\`/api/config/\${id}\`, {
                  method: 'DELETE'
              }).then(res => res.json())
                 .then(data => {
                     if (data.code === 200) {
                         showMessage('删除成功', 'success');
                         fetchConfigs();
                     } else {
                         showMessage(data.message, 'error');
                     }
                 }).catch(err => {
                      showMessage('网络错误', 'error');
                 })
          }
          function showMessage(message, type) {
            messageDiv.innerText = message;
            messageDiv.className = type;
            messageDiv.style.display = 'block';
            setTimeout(() => {
                messageDiv.style.display = 'none';
            }, 3000);
          }
          
          function updatePaginationButtons() {
            prevPageBtn.disabled = currentPage === 1;
             nextPageBtn.disabled = currentPage >= Math.ceil(totalItems/pageSize)
          }
          
          prevPageBtn.addEventListener('click', () => {
          if(currentPage > 1) {
              fetchConfigs(currentPage -1);
          }
          });
          nextPageBtn.addEventListener('click', () => {
            if (currentPage < Math.ceil(totalItems/pageSize)) {
              fetchConfigs(currentPage + 1);
            }
          });
          // 🔥 后台手动获取favicon功能
const fetchAdminFaviconBtn = document.getElementById('fetchAdminFaviconBtn');
const adminFaviconStatus = document.getElementById('adminFaviconStatus');
if (fetchAdminFaviconBtn) {
  fetchAdminFaviconBtn.addEventListener('click', function() {
    const addUrl = document.getElementById('addUrl');
    const addLogo = document.getElementById('addLogo');
    const btn = fetchAdminFaviconBtn;
    
    const siteUrl = addUrl.value.trim();
    if (!siteUrl) {
      showMessage('请先输入URL', 'error');
      return;
    }
    
    // 显示加载状态
    btn.disabled = true;
    btn.textContent = '获取中...';
    btn.style.background = '#999';
    if (adminFaviconStatus) {
      adminFaviconStatus.style.display = 'block';
      adminFaviconStatus.textContent = '正在获取网站图标...';
      adminFaviconStatus.className = 'status-loading';
    }
    
    fetch('/api/favicon?url=' + encodeURIComponent(siteUrl))
      .then(function(response) {
        if (!response.ok) {
          throw new Error('HTTP ' + response.status);
        }
        return response.json();
      })
      .then(function(data) {
        console.log('Admin Favicon API响应:', data);
        if (data.code === 200 && data.favicon) {
          addLogo.value = data.favicon;
          if (adminFaviconStatus) {
            adminFaviconStatus.textContent = '✅ 图标获取成功！';
            adminFaviconStatus.className = 'status-success';
          }
        } else {
          if (adminFaviconStatus) {
            adminFaviconStatus.textContent = '未找到合适的图标';
            adminFaviconStatus.className = 'status-error';
          }
        }
      })
      .catch(function(error) {
        console.error('获取favicon失败:', error);
        if (adminFaviconStatus) {
          adminFaviconStatus.textContent = '网络错误，请重试';
          adminFaviconStatus.className = 'status-error';
        }
      })
      .finally(function() {
        // 恢复按钮状态
        setTimeout(function() {
          btn.disabled = false;
          btn.textContent = '获取图标';
          btn.style.background = '#6c63ff';
          if (adminFaviconStatus) {
            adminFaviconStatus.style.display = 'none';
          }
        }, 2000);
      });
  });
}

          addBtn.addEventListener('click', () => {
            const name = addName.value;
            const url = addUrl.value;
            const logo = addLogo.value;
            const desc = addDesc.value;
             const catelog = addCatelog.value;
          const sort_order = addSortOrder.value; // [新增]             
            if(!name ||    !url || !catelog) {
              showMessage('名称,URL,分类 必填', 'error');
              return;
          }
          const payload = {
             name: name.trim(),
             url: url.trim(),
             logo: logo.trim(),
             desc: desc.trim(),
             catelog: catelog.trim()
          };
          if (sort_order !== '') {
             payload.sort_order = Number(sort_order);
          }
          fetch('/api/config', {        method: 'POST',
          headers: {
              'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
          }).then(res => res.json())
          .then(data => {
             if(data.code === 201) {
                 showMessage('添加成功', 'success');
                addName.value = '';
                addUrl.value = '';
                addLogo.value = '';
                addDesc.value = '';
                 addCatelog.value = '';
        addSortOrder.value = ''; // [新增]                 
                 fetchConfigs();
             }else {
                showMessage(data.message, 'error');
             }
          }).catch(err => {
            showMessage('网络错误', 'error');
          })
          });
          
          importBtn.addEventListener('click', () => {
          importFile.click();
          });
          importFile.addEventListener('change', function(e) {
          const file = e.target.files[0];
          if (file) {
           const reader = new FileReader();
          reader.onload = function(event) {
             try {
                 const jsonData = JSON.parse(event.target.result);
                   fetch('/api/config/import', {
                       method: 'POST',
                        headers: {
                          'Content-Type': 'application/json'
                        },
                       body: JSON.stringify(jsonData)
                  }).then(res => res.json())
                     .then(data => {
                          if(data.code === 201) {
                             showMessage('导入成功', 'success');
                              fetchConfigs();
                          } else {
                             showMessage(data.message, 'error');
                          }
                     }).catch(err => {
                           showMessage('网络错误', 'error');
                  })
          
             } catch (error) {
                   showMessage('JSON格式不正确', 'error');
             }
          }
           reader.readAsText(file);
          }
          })
          exportBtn.addEventListener('click', () => {
          fetch('/api/config/export')
          .then(res => res.blob())
          .then(blob => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'config.json';
          document.body.appendChild(a);
          a.click();
           window.URL.revokeObjectURL(url);
           document.body.removeChild(a);
          }).catch(err => {
          showMessage('网络错误', 'error');
          })
          })
          
          // 搜索功能
          searchInput.addEventListener('input', () => {
              currentSearchKeyword = searchInput.value.trim();
              currentPage = 1; // 搜索时重置为第一页
              fetchConfigs(currentPage,currentSearchKeyword);
          });
          
          
          function fetchPendingConfigs(page = pendingCurrentPage) {
                  fetch(\`/api/pending?page=\${page}&pageSize=\${pendingPageSize}\`)
                      .then(res => res.json())
                      .then(data => {
                        if (data.code === 200) {
                               pendingTotalItems = data.total;
                               pendingCurrentPage = data.page;
                               pendingTotalPagesSpan.innerText = Math.ceil(pendingTotalItems/ pendingPageSize);
                                pendingCurrentPageSpan.innerText = pendingCurrentPage;
                               allPendingConfigs = data.data;
                                 renderPendingConfig(allPendingConfigs);
                                updatePendingPaginationButtons();
                        } else {
                            showMessage(data.message, 'error');
                        }
                      }).catch(err => {
                      showMessage('网络错误', 'error');
                   })
          }
          
            function renderPendingConfig(configs) {
                  pendingTableBody.innerHTML = '';
                  if(configs.length === 0) {
                      pendingTableBody.innerHTML = '<tr><td colspan="7">没有待审核数据</td></tr>';
                      return
                  }
                configs.forEach(config => {
                    const row = document.createElement('tr');
                    const safeName = escapeHTML(config.name || '');
                    const normalizedUrl = normalizeUrl(config.url);
                    const urlCell = normalizedUrl
                      ? \`<a href="\${escapeHTML(normalizedUrl)}" target="_blank" rel="noopener noreferrer">\${escapeHTML(normalizedUrl)}</a>\`
                      : (config.url ? escapeHTML(config.url) : '未提供');
                    const normalizedLogo = normalizeUrl(config.logo);
                    const logoCell = normalizedLogo
                      ? \`<img src="\${escapeHTML(normalizedLogo)}" alt="\${safeName}" style="width:30px;" />\`
                      : 'N/A';
                    const descCell = config.desc ? escapeHTML(config.desc) : 'N/A';
                    const catelogCell = escapeHTML(config.catelog || '');
                    row.innerHTML = \`
                      <td>\${config.id}</td>
                       <td>\${safeName}</td>
                       <td>\${urlCell}</td>
                       <td>\${logoCell}</td>
                       <td>\${descCell}</td>
                       <td>\${catelogCell}</td>
                        <td class="actions">
                            <button class="approve-btn" data-id="\${config.id}">批准</button>
                          <button class="reject-btn" data-id="\${config.id}">拒绝</button>
                        </td>
                      \`;
                    pendingTableBody.appendChild(row);
                });
                bindPendingActionEvents();
            }
           function bindPendingActionEvents() {
               document.querySelectorAll('.approve-btn').forEach(btn => {
                   btn.addEventListener('click', function() {
                       const id = this.dataset.id;
                       handleApprove(id);
                   })
               });
              document.querySelectorAll('.reject-btn').forEach(btn => {
                    btn.addEventListener('click', function() {
                         const id = this.dataset.id;
                         handleReject(id);
                     })
              })
           }
          
          function handleApprove(id) {
             if (!confirm('确定批准吗？')) return;
             fetch(\`/api/pending/\${id}\`, {
                   method: 'PUT',
                 }).then(res => res.json())
               .then(data => {
                    if (data.code === 200) {
                        showMessage('批准成功', 'success');
                        fetchPendingConfigs();
                         fetchConfigs();
                    } else {
                         showMessage(data.message, 'error')
                     }
                }).catch(err => {
                      showMessage('网络错误', 'error');
                  })
          }
           function handleReject(id) {
               if (!confirm('确定拒绝吗？')) return;
              fetch(\`/api/pending/\${id}\`, {
                     method: 'DELETE'
                }).then(res => res.json())
                   .then(data => {
                     if(data.code === 200) {
                         showMessage('拒绝成功', 'success');
                        fetchPendingConfigs();
                    } else {
                       showMessage(data.message, 'error');
                   }
                  }).catch(err => {
                        showMessage('网络错误', 'error');
                })
           }
          function updatePendingPaginationButtons() {
              pendingPrevPageBtn.disabled = pendingCurrentPage === 1;
               pendingNextPageBtn.disabled = pendingCurrentPage >= Math.ceil(pendingTotalItems/ pendingPageSize)
           }
          
           pendingPrevPageBtn.addEventListener('click', () => {
               if (pendingCurrentPage > 1) {
                   fetchPendingConfigs(pendingCurrentPage - 1);
               }
           });
            pendingNextPageBtn.addEventListener('click', () => {
               if (pendingCurrentPage < Math.ceil(pendingTotalItems/pendingPageSize)) {
                   fetchPendingConfigs(pendingCurrentPage + 1)
               }
            });
          
          fetchConfigs();
          fetchPendingConfigs();
          if (categoryTableBody) {
            fetchCategories();
          }
          `
    }
    return fileContents[filePath]
    },
  
    async renderAdminPage() {
    const html = await this.getFileContent('admin.html');
    return new Response(html, {
        headers: {'Content-Type': 'text/html; charset=utf-8'}
    });
    },
  
    async renderLoginPage(message = '') {
      const hasError = Boolean(message);
      const safeMessage = hasError ? escapeHTML(message) : '';
      const html = `<!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>管理员登录</title>
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap" rel="stylesheet">
        <style>
          /* [优化] 全局重置与现代CSS最佳实践 */
          *, *::before, *::after {
            box-sizing: border-box;
          }
          
          html, body {
            height: 100%; /* 确保flex容器能撑满整个屏幕 */
            margin: 0;
            padding: 0;
            font-family: 'Noto Sans SC', sans-serif;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }

          /* [优化] 主体布局，确保在任何设备上都完美居中 */
          body {
            display: flex;
            justify-content: center;
            align-items: center;
            background-color: #f8f9fa;
            padding: 1rem; /* 为小屏幕提供安全边距 */
          }

          /* [优化] 登录容器样式 */
          .login-container {
            background-color: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08), 0 4px 12px rgba(15, 23, 42, 0.05);
            width: 100%;
            max-width: 380px;
            animation: fadeIn 0.5s ease-out;
          }
          
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(-10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          .login-title {
            font-size: 1.75rem; /* 稍大一点更醒目 */
            font-weight: 700;
            text-align: center;
            margin: 0 0 1.5rem 0;
            color: #333;
          }

          .form-group {
            margin-bottom: 1.25rem;
          }

          label {
            display: block;
            margin-bottom: 0.5rem;
            font-weight: 500;
            color: #555;
          }

          input[type="text"], input[type="password"] {
            width: 100%;
            padding: 0.875rem 1rem; /* 调整内边距，手感更好 */
            border: 1px solid #ddd;
            border-radius: 6px; /* 稍大的圆角 */
            font-size: 1rem;
            transition: border-color 0.2s, box-shadow 0.2s;
          }

          input:focus {
            border-color: #7209b7;
            outline: none;
            box-shadow: 0 0 0 3px rgba(114, 9, 183, 0.15);
          }

          button {
            width: 100%;
            padding: 0.875rem;
            background-color: #7209b7;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 1rem;
            font-weight: 500;
            cursor: pointer;
            transition: background-color 0.2s, transform 0.1s;
          }

          button:hover {
            background-color: #5a067c;
          }
          
          button:active {
            transform: scale(0.98);
          }

          .error-message {
            color: #dc3545;
            font-size: 0.875rem;
            margin-top: 0.5rem;
            text-align: center;
            display: none;
          }

          .back-link {
            display: block;
            text-align: center;
            margin-top: 1.5rem;
            color: #7209b7;
            text-decoration: none;
            font-size: 0.875rem;
          }

          .back-link:hover {
            text-decoration: underline;
          }
        </style>
      </head>
      <body>
        <div class="login-container">
          <h1 class="login-title">管理员登录</h1>
          <form method="post" action="/admin" novalidate>
            <div class="form-group">
              <label for="username">用户名</label>
              <input type="text" id="username" name="name" required autocomplete="username">
            </div>
            <div class="form-group">
              <label for="password">密码</label>
              <input type="password" id="password" name="password" required autocomplete="current-password">
            </div>
            ${hasError ? `<div class="error-message" style="display:block;">${safeMessage}</div>` : `<div class="error-message">用户名或密码错误</div>`}
            <button type="submit">登 录</button>
          </form>
          <a href="/" class="back-link">返回首页</a>
        </div>
      </body>
      </html>`;
      
      return new Response(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }
  };
  
  
  /**
   * 优化后的主逻辑：处理请求，返回优化后的 HTML
   */
  async function handleRequest(request, env, ctx) {
    const url = new URL(request.url);
    const catalog = url.searchParams.get('catalog');

    let sites = [];
    try {
      const { results } = await env.NAV_DB.prepare('SELECT * FROM sites ORDER BY sort_order ASC, create_time DESC').all();
      sites = results;
    } catch (e) {
      return new Response(`Failed to fetch data: ${e.message}`, { status: 500 });
    }

    if (!sites || sites.length === 0) {
      return new Response('No site configuration found.', { status: 404 });
    }

    const totalSites = sites.length;
    // 获取所有分类
    const categoryMinSort = new Map();
    const categorySet = new Set();
    sites.forEach((site) => {
      const categoryName = (site.catelog || '').trim() || '未分类';
      categorySet.add(categoryName);
      const rawSort = Number(site.sort_order);
      const normalized = Number.isFinite(rawSort) ? rawSort : 9999;
      if (!categoryMinSort.has(categoryName) || normalized < categoryMinSort.get(categoryName)) {
        categoryMinSort.set(categoryName, normalized);
      }
    });

    const categoryOrderMap = new Map();
    try {
      const { results: orderRows } = await env.NAV_DB.prepare('SELECT catelog, sort_order FROM category_orders').all();
      orderRows.forEach(row => {
        categoryOrderMap.set(row.catelog, normalizeSortOrder(row.sort_order));
      });
    } catch (error) {
      if (!/no such table/i.test(error.message || '')) {
        return new Response(`Failed to fetch category orders: ${error.message}`, { status: 500 });
      }
    }

    const catalogsWithMeta = Array.from(categorySet).map((name) => {
      const fallbackSort = categoryMinSort.has(name) ? normalizeSortOrder(categoryMinSort.get(name)) : 9999;
      const order = categoryOrderMap.has(name) ? categoryOrderMap.get(name) : fallbackSort;
      return {
        name,
        order,
        fallback: fallbackSort,
      };
    });

    catalogsWithMeta.sort((a, b) => {
      if (a.order !== b.order) {
        return a.order - b.order;
      }
      if (a.fallback !== b.fallback) {
        return a.fallback - b.fallback;
      }
      return a.name.localeCompare(b.name, 'zh-Hans-CN', { sensitivity: 'base' });
    });

    const catalogs = catalogsWithMeta.map(item => item.name);
    
    // 根据 URL 参数筛选站点
    const requestedCatalog = (catalog || '').trim();
    const catalogExists = Boolean(requestedCatalog && catalogs.includes(requestedCatalog));
    const currentCatalog = catalogExists ? requestedCatalog : catalogs[0];
    const currentSites = catalogExists
      ? sites.filter((s) => {
          const catValue = (s.catelog || '').trim() || '未分类';
          return catValue === currentCatalog;
        })
      : sites;
    const catalogLinkMarkup = catalogs.map((cat) => {
      const safeCat = escapeHTML(cat);
      const encodedCat = encodeURIComponent(cat);
      const isActive = catalogExists && cat === currentCatalog;
      const linkClass = isActive ? 'bg-secondary-100 text-primary-700' : 'hover:bg-gray-100';
      const iconClass = isActive ? 'text-primary-600' : 'text-gray-400';
      return `
        <a href="?catalog=${encodedCat}" class="flex items-center px-3 py-2 rounded-lg ${linkClass} w-full">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 ${iconClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          ${safeCat}
        </a>
      `;
    }).join('');

    const datalistOptions = catalogs.map((cat) => `<option value="${escapeHTML(cat)}">`).join('');
    const headingPlainText = catalogExists
      ? `${currentCatalog} · ${currentSites.length} 个网站`
      : `全部收藏 · ${sites.length} 个网站`;
    const headingText = escapeHTML(headingPlainText);
    const headingDefaultAttr = escapeHTML(headingPlainText);
    const headingActiveAttr = catalogExists ? escapeHTML(currentCatalog) : '';
    const submissionEnabled = isSubmissionEnabled(env);

    // 优化后的 HTML
    const html = `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8"/>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>星漫旅站 - 精品网址导航</title>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&display=swap" rel="stylesheet"/>
      <link rel="icon" href="https://img.12388888.xyz/file/logo/ktVNDfcM.png" type="image/png"/>
      <script src="https://cdn.tailwindcss.com"></script>
      <script>
        tailwind.config = {
          darkMode: 'class',
          theme: {
            extend: {
              colors: {
                primary: {
                  50: '#f3f5f9',
                  100: '#e1e7f1',
                  200: '#c3d0e3',
                  300: '#9cb3d1',
                  400: '#6c8fba',
                  500: '#416d9d',
                  600: '#305580',
                  700: '#254267',
                  800: '#1d3552',
                  900: '#192e45',
                  950: '#101e2d',
                },
                secondary: {
                  50: '#fdf8f3',
                  100: '#f6ede1',
                  200: '#ead6ba',
                  300: '#dfc19a',
                  400: '#d2aa79',
                  500: '#b88d58',
                  600: '#a17546',
                  700: '#835b36',
                  800: '#6b492c',
                  900: '#5a3e26',
                  950: '#2f1f13',
                },
                accent: {
                  50: '#f2faf6',
                  100: '#d9f0e5',
                  200: '#b4dfcb',
                  300: '#89caa9',
                  400: '#61b48a',
                  500: '#3c976d',
                  600: '#2e7755',
                  700: '#265c44',
                  800: '#204b38',
                  900: '#1b3e30',
                  950: '#0e221b',
                },
              },
              fontFamily: {
                sans: ['Noto Sans SC', 'sans-serif'],
              },
            }
          }
        }
      </script>
      <style>
        /* 自定义滚动条 */
        ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .light ::-webkit-scrollbar-track {
          background: #edf1f7;
        }
        .dark ::-webkit-scrollbar-track {
          background: #1d3552;
        }
        .light ::-webkit-scrollbar-thumb {
          background: #c3d0e3;
        }
        .dark ::-webkit-scrollbar-thumb {
          background: #416d9d;
        }
        ::-webkit-scrollbar-thumb {
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #416d9d;
        }
        
        /* 卡片悬停效果 */
        .site-card {
          transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
        }
        .site-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1);
        }
        .dark .site-card:hover {
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
        }
        
        /* 复制成功提示动画 */
        @keyframes fadeInOut {
          0% { opacity: 0; transform: translateY(10px); }
          20% { opacity: 1; transform: translateY(0); }
          80% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-10px); }
        }
        .copy-success-animation {
          animation: fadeInOut 2s ease forwards;
        }

        /* 骨架屏动画 */
        @keyframes shimmer {
          0% { background-position: -1000px 0; }
          100% { background-position: 1000px 0; }
        }
        .skeleton {
          background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
          background-size: 1000px 100%;
          animation: shimmer 2s infinite;
        }
        .dark .skeleton {
          background: linear-gradient(90deg, #2a3f5f 25%, #3a4f6f 50%, #2a3f5f 75%);
          background-size: 1000px 100%;
        }

        /* 心跳动画 */
        @keyframes heartbeat {
          0%, 100% { transform: scale(1); }
          25% { transform: scale(1.2); }
          50% { transform: scale(1); }
          75% { transform: scale(1.1); }
        }
        .heart-beat {
          animation: heartbeat 0.3s ease-in-out;
        }

        /* 滑入动画 */
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .slide-in {
          animation: slideIn 0.3s ease-out;
        }

        /* 淡入动画 */
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .fade-in {
          animation: fadeIn 0.5s ease-out;
        }

        /* 脉冲动画 */
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .animate-pulse-slow {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        /* QR码弹窗 */
        .qr-modal {
          backdrop-filter: blur(4px);
        }

        /* Toast提示 */
        .toast {
          animation: slideInRight 0.3s ease-out;
        }
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes slideOutRight {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(100%);
            opacity: 0;
          }
        }
        .toast.hide {
          animation: slideOutRight 0.3s ease-out forwards;
        }

        /* 快捷键提示 */
        .kbd {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 24px;
          height: 24px;
          padding: 0 6px;
          font-size: 12px;
          font-weight: 500;
          line-height: 1;
          color: #495057;
          background-color: #f8f9fa;
          border: 1px solid #dee2e6;
          border-radius: 4px;
          box-shadow: 0 2px 0 #dee2e6;
        }
        .dark .kbd {
          color: #e9ecef;
          background-color: #495057;
          border-color: #6c757d;
          box-shadow: 0 2px 0 #6c757d;
        }

        /* 选中状态 */
        .site-card.selected {
          ring: 2px;
          ring-color: #3c976d;
          box-shadow: 0 0 0 3px rgba(60, 151, 109, 0.2);
        }
        
        /* 移动端侧边栏 */
        @media (max-width: 768px) {
          .mobile-sidebar {
            transform: translateX(-100%);
            transition: transform 0.3s ease;
          }
          .mobile-sidebar.open {
            transform: translateX(0);
          }
          .mobile-overlay {
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.3s ease;
          }
          .mobile-overlay.open {
            opacity: 1;
            pointer-events: auto;
          }
        }
        
        /* 多行文本截断 */
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        
        /* 侧边栏控制 */
        #sidebar-toggle {
          display: none;
        }
        
        @media (min-width: 769px) {
          #sidebar-toggle:checked ~ .sidebar {
            margin-left: -16rem;
          }
          #sidebar-toggle:checked ~ .main-content {
            margin-left: 0;
          }
        }
      </style>
    </head>
    <body class="bg-secondary-50 font-sans text-gray-800 transition-colors duration-300">
      <!-- 侧边栏开关 -->
      <input type="checkbox" id="sidebar-toggle" class="hidden">

      <!-- 顶部工具栏 -->
      <div class="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 transition-colors duration-300">
        <div class="flex items-center justify-between px-4 py-2">
          <!-- 移动端菜单按钮 -->
          <button id="sidebarToggle" class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 lg:hidden">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <!-- 侧边栏开关 (桌面端) -->
          <label for="sidebar-toggle" class="hidden lg:flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </label>

          <!-- 工具按钮组 -->
          <div class="flex items-center gap-2">
            <!-- 主题切换按钮 -->
            <button id="themeToggle" class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" title="切换主题 (T)">
              <svg id="sunIcon" class="h-5 w-5 text-gray-600 dark:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <svg id="moonIcon" class="h-5 w-5 text-yellow-400 hidden dark:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            </button>

            <!-- 收藏列表按钮 -->
            <button id="favoritesToggle" class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors relative" title="我的收藏 (F)">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              <span id="favoriteCount" class="hidden absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center"></span>
            </button>

            <!-- 历史记录按钮 -->
            <button id="historyToggle" class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" title="访问历史 (H)">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>

            <!-- 帮助按钮 -->
            <button id="helpToggle" class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" title="快捷键帮助 (?)">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- 移动端遮罩层 - 只在移动端显示 -->
      <div id="mobileOverlay" class="fixed inset-0 bg-black bg-opacity-50 z-40 mobile-overlay lg:hidden"></div>
      
      <!-- 侧边栏导航 -->
      <aside id="sidebar" class="sidebar fixed left-0 top-12 h-[calc(100vh-3rem)] w-64 bg-white dark:bg-gray-800 shadow-lg border-r border-gray-200 dark:border-gray-700 z-40 overflow-y-auto mobile-sidebar lg:transform-none transition-all duration-300">
        <div class="p-6 pt-4">
          <h2 class="text-xl font-bold text-primary-600 dark:text-primary-400 tracking-tight mb-6">星漫旅站</h2>

          <div class="mb-6">
            <div class="relative">
              <input id="searchInput" type="text" placeholder="搜索书签... (/)" class="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-400 transition">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          <div>
            <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">分类导航</h3>
            <div class="space-y-1">
              <a href="?" class="flex items-center px-3 py-2 rounded-lg ${catalogExists ? 'hover:bg-gray-100 dark:hover:bg-gray-700' : 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'} w-full transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 ${catalogExists ? 'text-gray-400' : 'text-primary-600 dark:text-primary-400'}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                全部
              </a>
              ${catalogLinkMarkup}
            </div>
          </div>

          <div class="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            ${submissionEnabled ? `
            <button id="addSiteBtnSidebar" class="w-full flex items-center justify-center px-4 py-2 bg-accent-500 text-white rounded-lg hover:bg-accent-600 transition duration-300 shadow-sm hover:shadow-md">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              添加新书签
            </button>` : `
            <div class="w-full px-4 py-3 text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg">
              访客书签提交功能已关闭
            </div>`}

            <a href="https://blog.110995.xyz/" target="_blank" class="mt-4 flex items-center px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-primary-500 dark:hover:text-primary-400 transition duration-300">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              访问博客
            </a>

            <a href="/admin" target="_blank" class="mt-4 flex items-center px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-primary-500 dark:hover:text-primary-400 transition duration-300">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              后台管理
            </a>
          </div>
        </div>
      </aside>

      <!-- 主内容区 -->
      <main class="main-content lg:ml-64 min-h-screen pt-12 transition-all duration-300 bg-secondary-50 dark:bg-gray-900 transition-colors">
        <!-- 顶部横幅 -->
        <header class="bg-gradient-to-r from-primary-700 to-primary-600 dark:from-gray-800 dark:to-gray-700 text-white py-10 px-6 md:px-10 border-b border-gray-200 dark:border-gray-700 shadow-lg">
          <div class="max-w-5xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div class="flex-1 text-center md:text-left">
              <span class="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-sm px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-white/80">
                精选 · 真实 · 有温度
              </span>
              <h1 class="mt-4 text-3xl md:text-4xl font-semibold tracking-tight">星漫旅站书签</h1>
              <p class="mt-3 text-sm md:text-base text-white/80 leading-relaxed">
                从效率工具到灵感站点，我们亲自挑选、亲手标注，只为帮助你更快找到值得信赖的优质资源。
              </p>
            </div>
            <div class="w-full md:w-auto flex justify-center md:justify-end">
              <div class="rounded-2xl bg-white/10 backdrop-blur-md px-6 py-5 shadow-lg border border-white/10 text-left md:text-right">
                <p class="text-xs uppercase tracking-[0.28em] text-white/60">Current Overview</p>
                <p class="mt-3 text-2xl font-semibold">${totalSites}</p>
                <p class="text-sm text-white/80">条书签 · ${catalogs.length} 个分类</p>
                <p class="mt-2 text-xs text-white/60">每日人工维护，确保链接状态可用、内容可靠。</p>
              </div>
            </div>
          </div>
        </header>
        
        <!-- 网站列表 -->
        <section class="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <!-- 当前分类/搜索提示 -->
          <div class="flex items-center justify-between mb-6">
            <div class="flex items-center gap-3">
              <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100" data-role="list-heading" data-default="${headingDefaultAttr}" data-active="${headingActiveAttr}">
                ${headingText}
              </h2>
              <span class="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300" id="visibleCount">${currentSites.length} 个显示</span>
            </div>
            <div class="flex items-center gap-3">
              <!-- 视图切换 -->
              <div class="hidden sm:flex items-center bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                <button id="gridView" class="p-2 rounded-l-lg bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400" title="网格视图">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>
                <button id="listView" class="p-2 rounded-r-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400" title="列表视图">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              </div>
              <!-- 批量操作栏 -->
              <div id="batchActions" class="hidden items-center gap-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 shadow-sm">
                <span class="text-sm text-gray-600 dark:text-gray-400">已选 <span id="selectedCount">0</span> 项</span>
                <button id="batchCopy" class="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300">批量复制</button>
                <span class="text-gray-300 dark:text-gray-600">|</span>
                <button id="batchExport" class="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300">导出</button>
                <span class="text-gray-300 dark:text-gray-600">|</span>
                <button id="batchClear" class="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300">清空</button>
              </div>
            </div>
          </div>

          <!-- Hitokoto -->
          <div class="mb-6 hidden md:flex items-center justify-center p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <div class="text-center">
              <p class="text-gray-600 dark:text-gray-400 text-sm italic" id="hitokotoText">"疏影横斜水清浅，暗香浮动月黄昏。"</p>
              <a href="https://hitokoto.cn/" target="_blank" class="text-xs text-gray-400 dark:text-gray-500 mt-1 hover:text-primary-500 dark:hover:text-primary-400">— Hitokoto</a>
            </div>
          </div>

          <!-- 网站卡片网格 -->
          <div class="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/50 backdrop-blur-sm p-4 sm:p-6 shadow-sm">
            <div id="sitesGrid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              ${currentSites.map((site) => {
              const rawName = site.name || '未命名';
              const rawCatalog = site.catelog || '未分类';
              const rawDesc = site.desc || '暂无描述';
              const normalizedUrl = sanitizeUrl(site.url);
              const hrefValue = escapeHTML(normalizedUrl || '#');
              const displayUrlText = normalizedUrl || site.url || '';
              const safeDisplayUrl = displayUrlText ? escapeHTML(displayUrlText) : '未提供链接';
              const dataUrlAttr = escapeHTML(normalizedUrl || '');
              const logoUrl = sanitizeUrl(site.logo);
              const cardInitial = escapeHTML((rawName.trim().charAt(0) || '站').toUpperCase());
              const safeName = escapeHTML(rawName);
              const safeCatalog = escapeHTML(rawCatalog);
              const safeDesc = escapeHTML(rawDesc);
              const safeDataName = escapeHTML(site.name || '');
              const safeDataCatalog = escapeHTML(site.catelog || '');
              const hasValidUrl = Boolean(normalizedUrl);
              const siteId = `site-${site.id}`;
              return `
                <div class="site-card group bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 overflow-hidden" data-id="${site.id}" data-name="${safeDataName}" data-url="${dataUrlAttr}" data-catalog="${safeDataCatalog}">
                  <div class="p-5">
                    <div class="flex items-start">
                      <!-- 选择框 -->
                      <div class="flex-shrink-0 pt-1">
                        <input type="checkbox" class="site-checkbox w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500" data-id="${site.id}">
                      </div>

                      <a href="${hrefValue}" ${hasValidUrl ? 'target="_blank" rel="noopener noreferrer"' : ''} class="flex-1 block" data-site-link="${siteId}">
                        <div class="flex items-start">
                          <div class="flex-shrink-0 mr-4 relative">
                            ${
                              logoUrl
                                ? `<img src="${escapeHTML(logoUrl)}" alt="${safeName}" class="w-12 h-12 rounded-xl object-cover bg-gray-100 dark:bg-gray-700 ring-2 ring-gray-100 dark:ring-gray-700 group-hover:ring-primary-200 dark:group-hover:ring-primary-800 transition-all">`
                                : `<div class="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-bold text-lg shadow-inner group-hover:shadow-lg transition-all">${cardInitial}</div>`
                            }
                          </div>
                          <div class="flex-1 min-w-0">
                            <div class="flex items-start justify-between gap-2">
                              <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors" title="${safeName}">${safeName}</h3>
                              <!-- 收藏按钮 -->
                              <button class="favorite-btn flex-shrink-0 text-gray-400 hover:text-red-500 transition-colors" data-id="${site.id}" data-name="${safeName}" data-url="${dataUrlAttr}" title="收藏 (S)">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                </svg>
                              </button>
                            </div>
                            <span class="inline-flex items-center px-2 py-0.5 mt-1.5 rounded-full text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
                              ${safeCatalog}
                            </span>
                          </div>
                        </div>

                        <p class="mt-2.5 text-sm text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-2" title="${safeDesc}">${safeDesc}</p>
                      </a>
                    </div>

                    <div class="mt-3 flex items-center justify-between border-t border-gray-100 dark:border-gray-700 pt-3">
                      <span class="text-xs text-gray-500 dark:text-gray-500 truncate max-w-[140px]" title="${safeDisplayUrl}">${safeDisplayUrl}</span>
                      <div class="flex items-center gap-1">
                        <!-- QR码按钮 -->
                        ${hasValidUrl ? `
                        <button class="qr-btn p-1.5 rounded-lg text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors" data-url="${dataUrlAttr}" data-name="${safeName}" title="生成二维码 (Q)">
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                          </svg>
                        </button>` : ''}

                        <!-- 复制按钮 -->
                        <button class="copy-btn relative flex items-center px-2 py-1.5 ${hasValidUrl ? 'text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20' : 'text-gray-300 cursor-not-allowed'} rounded-lg text-xs font-medium transition-colors" data-url="${dataUrlAttr}" ${hasValidUrl ? '' : 'disabled'} title="复制链接 (C)">
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
            </div>
          </div>
        </section>
        
        <!-- 页脚 -->
        <footer class="bg-white dark:bg-gray-800 py-8 px-6 mt-12 border-t border-gray-200 dark:border-gray-700">
          <div class="max-w-5xl mx-auto text-center">
            <p class="text-gray-600 dark:text-gray-400">© ${new Date().getFullYear()} 星漫旅站 | 愿你在此找到方向</p>
            <div class="mt-4 flex justify-center space-x-6">
              <a href="https://page.110995.xyz/" target="_blank" class="text-gray-400 hover:text-primary-500 dark:hover:text-primary-400 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </a>
            </div>
          </div>
        </footer>
      </main>

      <!-- 返回顶部按钮 -->
      <button id="backToTop" class="fixed bottom-8 right-8 p-3 rounded-full bg-accent-500 text-white shadow-lg opacity-0 invisible transition-all duration-300 hover:bg-accent-600 z-40">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 11l7-7 7 7M5 19l7-7 7 7" />
        </svg>
      </button>

      <!-- Toast 容器 -->
      <div id="toastContainer" class="fixed top-20 right-4 z-50 flex flex-col gap-2"></div>

      <!-- 收藏模态框 -->
      <div id="favoritesModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm opacity-0 invisible transition-all duration-300">
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden transform scale-95 transition-all duration-300">
          <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">我的收藏</h2>
            <button id="closeFavorites" class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div id="favoritesList" class="p-4 overflow-y-auto max-h-[60vh]">
            <p class="text-center text-gray-500 dark:text-gray-400 py-8">暂无收藏的书签</p>
          </div>
          <div class="p-4 border-t border-gray-200 dark:border-gray-700">
            <button id="clearFavorites" class="w-full py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">清空所有收藏</button>
          </div>
        </div>
      </div>

      <!-- 历史记录模态框 -->
      <div id="historyModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm opacity-0 invisible transition-all duration-300">
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden transform scale-95 transition-all duration-300">
          <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">访问历史</h2>
            <button id="closeHistory" class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div id="historyList" class="p-4 overflow-y-auto max-h-[60vh]">
            <p class="text-center text-gray-500 dark:text-gray-400 py-8">暂无访问记录</p>
          </div>
          <div class="p-4 border-t border-gray-200 dark:border-gray-700">
            <button id="clearHistory" class="w-full py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">清空历史记录</button>
          </div>
        </div>
      </div>

      <!-- QR码模态框 -->
      <div id="qrModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm opacity-0 invisible transition-all duration-300">
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm mx-4 transform scale-95 transition-all duration-300 p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">二维码</h3>
            <button id="closeQrModal" class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div id="qrCodeContainer" class="flex justify-center mb-4">
            <div class="w-48 h-48 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
              <svg class="animate-spin h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          </div>
          <p id="qrUrlText" class="text-center text-sm text-gray-600 dark:text-gray-400 break-all mb-4"></p>
          <button id="downloadQr" class="w-full py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">下载二维码</button>
        </div>
      </div>

      <!-- 帮助模态框 -->
      <div id="helpModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm opacity-0 invisible transition-all duration-300">
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] overflow-hidden transform scale-95 transition-all duration-300">
          <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">快捷键帮助</h2>
            <button id="closeHelpModal" class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class="p-6 overflow-y-auto max-h-[60vh]">
            <div class="space-y-4">
              <div class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <span class="text-gray-700 dark:text-gray-300">搜索书签</span>
                <kbd>/</kbd>
              </div>
              <div class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <span class="text-gray-700 dark:text-gray-300">切换主题</span>
                <kbd>T</kbd>
              </div>
              <div class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <span class="text-gray-700 dark:text-gray-300">我的收藏</span>
                <kbd>F</kbd>
              </div>
              <div class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <span class="text-gray-700 dark:text-gray-300">访问历史</span>
                <kbd>H</kbd>
              </div>
              <div class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <span class="text-gray-700 dark:text-gray-300">打开帮助</span>
                <kbd>?</kbd>
              </div>
              <div class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <span class="text-gray-700 dark:text-gray-300">返回顶部</span>
                <kbd class="flex gap-1"><span>Home</span></kbd>
              </div>
              <div class="flex items-center justify-between py-2">
                <span class="text-gray-700 dark:text-gray-300">关闭模态框</span>
                <kbd>Esc</kbd>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      ${submissionEnabled ? `
      <!-- 添加网站模态框 -->
      <div id="addSiteModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 opacity-0 invisible transition-all duration-300">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 transform translate-y-8 transition-all duration-300">
          <div class="p-6">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-xl font-semibold text-gray-900">添加新书签</h2>
              <button id="closeModal" class="text-gray-400 hover:text-gray-500">
                <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form id="addSiteForm" class="space-y-4">
              <div>
                <label for="addSiteName" class="block text-sm font-medium text-gray-700">名称</label>
                <input type="text" id="addSiteName" required class="mt-1 block w-full px-3 py-2 border border-primary-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400">
              </div>
              
              <div>
                <label for="addSiteUrl" class="block text-sm font-medium text-gray-700">网址</label>
                <input type="text" id="addSiteUrl" required class="mt-1 block w-full px-3 py-2 border border-primary-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400">
              </div>
              
              <div>
  <label for="addSiteLogo" class="block text-sm font-medium text-gray-700">Logo (可选)</label>
  <input type="text" id="addSiteLogo" class="mt-1 block w-full px-3 py-2 border border-primary-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400">
  <!-- 🔥 新增：手动获取favicon按钮 -->
  <button type="button" id="fetchFaviconBtn" class="mt-2 w-full flex items-center justify-center px-4 py-2 bg-primary-500 text-white rounded-md text-sm font-medium hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
    <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
    自动获取图标
  </button>
  <div id="faviconStatus" class="mt-1 text-xs text-gray-500 hidden"></div>
</div>

              
              <div>
                <label for="addSiteDesc" class="block text-sm font-medium text-gray-700">描述 (可选)</label>
                <textarea id="addSiteDesc" rows="2" class="mt-1 block w-full px-3 py-2 border border-primary-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400"></textarea>
              </div>
              
              <div>
                <label for="addSiteCatelog" class="block text-sm font-medium text-gray-700">分类</label>
                <input type="text" id="addSiteCatelog" required class="mt-1 block w-full px-3 py-2 border border-primary-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400" list="catalogList">
                <datalist id="catalogList">
                  ${datalistOptions}
                </datalist>
              </div>
              
              <div class="flex justify-end pt-4">
                <button type="button" id="cancelAddSite" class="bg-white py-2 px-4 border border-primary-100 rounded-md shadow-sm text-sm font-medium text-primary-600 hover:bg-secondary-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-200 mr-3">
                  取消
                </button>
                <button type="submit" class="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-accent-500 hover:bg-accent-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-400">
                  提交
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      ` : ''}
      
      <script>
        document.addEventListener('DOMContentLoaded', function() {
          // 侧边栏控制
          const sidebar = document.getElementById('sidebar');
          const mobileOverlay = document.getElementById('mobileOverlay');
          const sidebarToggle = document.getElementById('sidebarToggle');
          const sidebarToggleCheckbox = document.getElementById('sidebar-toggle');

          function openSidebar() {
            sidebar.classList.add('open');
            mobileOverlay.classList.add('open');
            document.body.style.overflow = 'hidden';
          }

          function closeSidebarMenu() {
            sidebar.classList.remove('open');
            mobileOverlay.classList.remove('open');
            document.body.style.overflow = '';
          }

          if (sidebarToggle) {
            sidebarToggle.addEventListener('click', openSidebar);
          }

          if (mobileOverlay) {
            mobileOverlay.addEventListener('click', closeSidebarMenu);
          }
          
          // 复制链接功能
          document.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
              e.preventDefault();
              e.stopPropagation();
              const url = this.getAttribute('data-url');
              if (!url) {
                return;
              }
              navigator.clipboard.writeText(url).then(() => {
                const successMsg = this.querySelector('.copy-success');
                successMsg.classList.remove('hidden');
                successMsg.classList.add('copy-success-animation');
                setTimeout(() => {
                  successMsg.classList.add('hidden');
                  successMsg.classList.remove('copy-success-animation');
                }, 2000);
              }).catch(err => {
                console.error('复制失败:', err);
                // 备用复制方法
                const textarea = document.createElement('textarea');
                textarea.value = url;
                textarea.style.position = 'fixed';
                document.body.appendChild(textarea);
                textarea.focus();
                textarea.select();
                try {
                  document.execCommand('copy');
                  const successMsg = this.querySelector('.copy-success');
                  successMsg.classList.remove('hidden');
                  successMsg.classList.add('copy-success-animation');
                  setTimeout(() => {
                    successMsg.classList.add('hidden');
                    successMsg.classList.remove('copy-success-animation');
                  }, 2000);
                } catch (e) {
                  console.error('备用复制也失败了:', e);
                  alert('复制失败，请手动复制');
                }
                document.body.removeChild(textarea);
              });
            });
          });
          
          // 返回顶部按钮
          const backToTop = document.getElementById('backToTop');
          
          window.addEventListener('scroll', function() {
            if (window.pageYOffset > 300) {
              backToTop.classList.remove('opacity-0', 'invisible');
            } else {
              backToTop.classList.add('opacity-0', 'invisible');
            }
          });
          
          if (backToTop) {
            backToTop.addEventListener('click', function() {
              window.scrollTo({
                top: 0,
                behavior: 'smooth'
              });
            });
          }
          
          // 添加网站模态框
          const addSiteModal = document.getElementById('addSiteModal');
          const addSiteBtnSidebar = document.getElementById('addSiteBtnSidebar');
          const closeModalBtn = document.getElementById('closeModal');
          const cancelAddSite = document.getElementById('cancelAddSite');
          const addSiteForm = document.getElementById('addSiteForm');
          
          function openModal() {
            if (addSiteModal) {
              addSiteModal.classList.remove('opacity-0', 'invisible');
              const modalContent = addSiteModal.querySelector('.max-w-md');
              if (modalContent) modalContent.classList.remove('translate-y-8');
              document.body.style.overflow = 'hidden';
            }
          }
          
          function closeModal() {
            if (addSiteModal) {
              addSiteModal.classList.add('opacity-0', 'invisible');
              const modalContent = addSiteModal.querySelector('.max-w-md');
              if (modalContent) modalContent.classList.add('translate-y-8');
              document.body.style.overflow = '';
            }
          }
          
          if (addSiteBtnSidebar) {
            addSiteBtnSidebar.addEventListener('click', function(e) {
              e.preventDefault();
              e.stopPropagation();
              openModal();
            });
          }
          
          if (closeModalBtn) {
            closeModalBtn.addEventListener('click', function() {
              closeModal();
            });
          }
          
          if (cancelAddSite) {
            cancelAddSite.addEventListener('click', closeModal);
          }
          
          if (addSiteModal) {
            addSiteModal.addEventListener('click', function(e) {
              if (e.target === addSiteModal) {
                closeModal();
              }
            });
          }
          // 🔥 新增：手动获取favicon功能
const fetchFaviconBtn = document.getElementById('fetchFaviconBtn');
const faviconStatus = document.getElementById('faviconStatus');
if (fetchFaviconBtn) {
  fetchFaviconBtn.addEventListener('click', function(e) {
    e.preventDefault();
    
    const urlInput = document.getElementById('addSiteUrl');
    const logoInput = document.getElementById('addSiteLogo');
    const btn = fetchFaviconBtn;
    
    const siteUrl = urlInput.value.trim();
    if (!siteUrl) {
      alert('请先输入网址');
      return;
    }
    
    // 显示加载状态
    btn.disabled = true;
    btn.innerHTML = '<svg class="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>获取中...';
    if (faviconStatus) {
      faviconStatus.classList.remove('hidden');
      faviconStatus.textContent = '正在获取网站图标...';
      faviconStatus.className = 'mt-1 text-xs text-gray-500';
    }
    
    // 调用后端API（对接原有的getFavicon功能）
    fetch('/api/favicon?url=' + encodeURIComponent(siteUrl))
      .then(function(response) {
        if (!response.ok) {
          throw new Error('HTTP ' + response.status);
        }
        return response.json();
      })
      .then(function(data) {
        console.log('Favicon API响应:', data);
        if (data.code === 200 && data.favicon) {
          logoInput.value = data.favicon;
          if (faviconStatus) {
            faviconStatus.textContent = '✅ 图标获取成功！';
            faviconStatus.className = 'mt-1 text-xs text-green-600';
          }
        } else {
          if (faviconStatus) {
            faviconStatus.textContent = '未找到合适的图标';
            faviconStatus.className = 'mt-1 text-xs text-red-500';
          }
        }
      })
      .catch(function(error) {
        console.error('获取favicon失败:', error);
        if (faviconStatus) {
          faviconStatus.textContent = '网络错误，请重试';
          faviconStatus.className = 'mt-1 text-xs text-red-500';
        }
      })
      .finally(function() {
        // 恢复按钮状态
        setTimeout(function() {
          btn.disabled = false;
          btn.innerHTML = '<svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>自动获取图标';
          if (faviconStatus) {
            faviconStatus.classList.add('hidden');
          }
        }, 2000);
      });
  });
}

          // 表单提交处理
          if (addSiteForm) {
            addSiteForm.addEventListener('submit', function(e) {
              e.preventDefault();
              
              const name = document.getElementById('addSiteName').value;
              const url = document.getElementById('addSiteUrl').value;
              const logo = document.getElementById('addSiteLogo').value;
              const desc = document.getElementById('addSiteDesc').value;
              const catelog = document.getElementById('addSiteCatelog').value;
              
              fetch('/api/config/submit', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, url, logo, desc, catelog })
              })
              .then(res => res.json())
              .then(data => {
                if (data.code === 201) {
                  // 显示成功消息
                  const successDiv = document.createElement('div');
                  successDiv.className = 'fixed top-4 right-4 bg-accent-500 text-white px-4 py-2 rounded shadow-lg z-50 animate-fade-in';
                  successDiv.textContent = '提交成功，等待管理员审核';
                  document.body.appendChild(successDiv);
                  
                  setTimeout(() => {
                    successDiv.classList.add('opacity-0');
                    setTimeout(() => {
                      if (document.body.contains(successDiv)) {
                        document.body.removeChild(successDiv);
                      }
                    }, 300);
                  }, 2500);
                  
                  closeModal();
                  addSiteForm.reset();
                } else {
                  alert(data.message || '提交失败');
                }
              })
              .catch(err => {
                console.error('网络错误:', err);
                alert('网络错误，请稍后重试');
              });
            });
          }
          
          // 搜索功能
          const searchInput = document.getElementById('searchInput');
          const sitesGrid = document.getElementById('sitesGrid');
          const siteCards = document.querySelectorAll('.site-card');
          
          if (searchInput && sitesGrid) {
            searchInput.addEventListener('input', function() {
              const keyword = this.value.toLowerCase().trim();
              
              siteCards.forEach(card => {
                const name = (card.getAttribute('data-name') || '').toLowerCase();
                const url = (card.getAttribute('data-url') || '').toLowerCase();
                const catalogValue = (card.getAttribute('data-catalog') || '').toLowerCase();
                
                if (name.includes(keyword) || url.includes(keyword) || catalogValue.includes(keyword)) {
                  card.classList.remove('hidden');
                } else {
                  card.classList.add('hidden');
                }
              });
              
              // 搜索结果提示
              const visibleCards = sitesGrid.querySelectorAll('.site-card:not(.hidden)');
              const countHeading = document.querySelector('[data-role="list-heading"]');
              if (countHeading) {
                const defaultText = countHeading.dataset.default || '';
                const activeCatalogText = countHeading.dataset.active || '';
                if (keyword) {
                  countHeading.textContent = '搜索结果 · ' + visibleCards.length + ' 个网站';
                } else if (activeCatalogText) {
                  countHeading.textContent = activeCatalogText + ' · ' + visibleCards.length + ' 个网站';
                } else {
                  const totalText = defaultText.includes('全部收藏') ? defaultText.replace(/\\d+ 个网站/, visibleCards.length + ' 个网站') : '全部收藏 · ' + visibleCards.length + ' 个网站';
                  countHeading.textContent = totalText;
                }
              }
            });
          }

          // ========== 新增功能 ==========

          // 主题切换功能
          const themeToggle = document.getElementById('themeToggle');
          const body = document.body;
          const savedTheme = localStorage.getItem('theme') || 'light';

          function setTheme(theme) {
            if (theme === 'dark') {
              body.classList.add('dark');
              body.classList.remove('light');
              localStorage.setItem('theme', 'dark');
            } else {
              body.classList.add('light');
              body.classList.remove('dark');
              localStorage.setItem('theme', 'light');
            }
          }
          setTheme(savedTheme);

          if (themeToggle) {
            themeToggle.addEventListener('click', function() {
              const currentTheme = localStorage.getItem('theme') || 'light';
              setTheme(currentTheme === 'light' ? 'dark' : 'light');
              showToast('主题已切换', 'success');
            });
          }

          // 收藏功能
          let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
          const favoriteCount = document.getElementById('favoriteCount');
          const favoritesToggle = document.getElementById('favoritesToggle');
          const favoritesModal = document.getElementById('favoritesModal');
          const favoritesList = document.getElementById('favoritesList');
          const closeFavorites = document.getElementById('closeFavorites');
          const clearFavorites = document.getElementById('clearFavorites');

          function updateFavoriteCount() {
            if (favorites.length > 0) {
              favoriteCount.textContent = favorites.length;
              favoriteCount.classList.remove('hidden');
            } else {
              favoriteCount.classList.add('hidden');
            }
          }
          updateFavoriteCount();

          function updateFavoriteButtons() {
            document.querySelectorAll('.favorite-btn').forEach(btn => {
              const id = btn.dataset.id;
              const isFavorite = favorites.some(f => f.id === id);
              const svg = btn.querySelector('svg');
              if (isFavorite) {
                svg.classList.add('fill-red-500', 'text-red-500');
              } else {
                svg.classList.remove('fill-red-500', 'text-red-500');
              }
            });
          }
          updateFavoriteButtons();

          function saveFavorite(id, name, url) {
            const existing = favorites.find(f => f.id === id);
            if (existing) {
              favorites = favorites.filter(f => f.id !== id);
              showToast('已取消收藏', 'info');
            } else {
              favorites.push({ id, name, url, timestamp: Date.now() });
              showToast('已添加到收藏', 'success');
            }
            localStorage.setItem('favorites', JSON.stringify(favorites));
            updateFavoriteCount();
            updateFavoriteButtons();
            renderFavorites();
          }

          function renderFavorites() {
            if (favorites.length === 0) {
              favoritesList.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 py-8">暂无收藏的书签</p>';
              return;
            }
            favoritesList.innerHTML = favorites.map(f => `
              <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg mb-2">
                <a href="${escapeHTML(f.url)}" target="_blank" rel="noopener noreferrer" class="flex-1 truncate">
                  <p class="text-sm font-medium text-gray-900 dark:text-gray-100">${escapeHTML(f.name)}</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400 truncate">${escapeHTML(f.url)}</p>
                </a>
                <button class="remove-favorite-btn ml-2 text-red-500 hover:text-red-700" data-id="${f.id}" title="移除">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            `).join('');

            // 绑定删除事件
            favoritesList.querySelectorAll('.remove-favorite-btn').forEach(btn => {
              btn.addEventListener('click', function() {
                const id = this.dataset.id;
                favorites = favorites.filter(f => f.id !== id);
                localStorage.setItem('favorites', JSON.stringify(favorites));
                updateFavoriteCount();
                updateFavoriteButtons();
                renderFavorites();
                showToast('已移除收藏', 'info');
              });
            });
          }

          document.querySelectorAll('.favorite-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
              e.preventDefault();
              e.stopPropagation();
              const id = this.dataset.id;
              const name = this.dataset.name;
              const url = this.dataset.url;
              saveFavorite(id, name, url);
              this.querySelector('svg').classList.add('heart-beat');
              setTimeout(() => {
                this.querySelector('svg').classList.remove('heart-beat');
              }, 300);
            });
          });

          function openFavoritesModal() {
            favoritesModal.classList.remove('opacity-0', 'invisible');
            favoritesModal.querySelector('.transform').classList.remove('scale-95');
            document.body.style.overflow = 'hidden';
            renderFavorites();
          }

          function closeFavoritesModal() {
            favoritesModal.classList.add('opacity-0', 'invisible');
            favoritesModal.querySelector('.transform').classList.add('scale-95');
            document.body.style.overflow = '';
          }

          if (favoritesToggle) favoritesToggle.addEventListener('click', openFavoritesModal);
          if (closeFavorites) closeFavorites.addEventListener('click', closeFavoritesModal);
          if (favoritesModal) favoritesModal.addEventListener('click', function(e) {
            if (e.target === favoritesModal) closeFavoritesModal();
          });
          if (clearFavorites) clearFavorites.addEventListener('click', function() {
            if (confirm('确定清空所有收藏吗？')) {
              favorites = [];
              localStorage.setItem('favorites', JSON.stringify(favorites));
              updateFavoriteCount();
              updateFavoriteButtons();
              renderFavorites();
              showToast('已清空所有收藏', 'info');
            }
          });

          // 历史记录功能
          let visitHistory = JSON.parse(localStorage.getItem('visitHistory') || '[]');
          const historyToggle = document.getElementById('historyToggle');
          const historyModal = document.getElementById('historyModal');
          const historyList = document.getElementById('historyList');
          const closeHistory = document.getElementById('closeHistory');
          const clearHistory = document.getElementById('clearHistory');

          function addToHistory(id, name, url) {
            visitHistory = visitHistory.filter(h => h.id !== id);
            visitHistory.unshift({ id, name, url, timestamp: Date.now() });
            visitHistory = visitHistory.slice(0, 50);
            localStorage.setItem('visitHistory', JSON.stringify(visitHistory));
          }

          function renderHistory() {
            if (visitHistory.length === 0) {
              historyList.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 py-8">暂无访问记录</p>';
              return;
            }
            historyList.innerHTML = visitHistory.map(h => {
              const date = new Date(h.timestamp).toLocaleString('zh-CN');
              return `
                <div class="flex items-start p-3 bg-gray-50 dark:bg-gray-700 rounded-lg mb-2">
                  <a href="${escapeHTML(h.url)}" target="_blank" rel="noopener noreferrer" class="flex-1" data-history-link="${h.id}">
                    <p class="text-sm font-medium text-gray-900 dark:text-gray-100">${escapeHTML(h.name)}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400 truncate mb-1">${escapeHTML(h.url)}</p>
                    <p class="text-xs text-gray-400">${date}</p>
                  </a>
                </div>
              `;
            }).join('');
          }

          function openHistoryModal() {
            historyModal.classList.remove('opacity-0', 'invisible');
            historyModal.querySelector('.transform').classList.remove('scale-95');
            document.body.style.overflow = 'hidden';
            renderHistory();
          }

          function closeHistoryModal() {
            historyModal.classList.add('opacity-0', 'invisible');
            historyModal.querySelector('.transform').classList.add('scale-95');
            document.body.style.overflow = '';
          }

          if (historyToggle) historyToggle.addEventListener('click', openHistoryModal);
          if (closeHistory) closeHistory.addEventListener('click', closeHistoryModal);
          if (historyModal) historyModal.addEventListener('click', function(e) {
            if (e.target === historyModal) closeHistoryModal();
          });
          if (clearHistory) clearHistory.addEventListener('click', function() {
            if (confirm('确定清空所有历史记录吗？')) {
              visitHistory = [];
              localStorage.setItem('visitHistory', JSON.stringify(visitHistory));
              renderHistory();
              showToast('已清空历史记录', 'info');
            }
          });

          // 记录点击历史
          document.querySelectorAll('[data-site-link]').forEach(link => {
            link.addEventListener('click', function() {
              const card = this.closest('.site-card');
              const id = card.dataset.id;
              const name = card.dataset.name;
              const url = card.dataset.url;
              if (url) {
                addToHistory(id, name, url);
              }
            });
          });

          // QR码功能
          const qrModal = document.getElementById('qrModal');
          const qrCodeContainer = document.getElementById('qrCodeContainer');
          const qrUrlText = document.getElementById('qrUrlText');
          const closeQrModal = document.getElementById('closeQrModal');
          const downloadQr = document.getElementById('downloadQr');
          let currentQrUrl = '';

          function openQrModal(url, name) {
            currentQrUrl = url;
            qrUrlText.textContent = url;
            qrCodeContainer.innerHTML = '<div class="w-48 h-48 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center"><svg class="animate-spin h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>';
            qrModal.classList.remove('opacity-0', 'invisible');
            qrModal.querySelector('.transform').classList.remove('scale-95');
            document.body.style.overflow = 'hidden';

            // 使用 QR Server API 生成二维码
            const apiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
            const img = new Image();
            img.onload = function() {
              qrCodeContainer.innerHTML = `<img src="${apiUrl}" alt="${escapeHTML(name)} QR Code" class="rounded-lg">`;
            };
            img.onerror = function() {
              qrCodeContainer.innerHTML = '<p class="text-red-500 text-sm">二维码生成失败</p>';
            };
            img.src = apiUrl;
          }

          function closeQrModalFn() {
            qrModal.classList.add('opacity-0', 'invisible');
            qrModal.querySelector('.transform').classList.add('scale-95');
            document.body.style.overflow = '';
          }

          if (document.querySelectorAll('.qr-btn').length > 0) {
            document.querySelectorAll('.qr-btn').forEach(btn => {
              btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const url = this.dataset.url;
                const name = this.dataset.name;
                openQrModal(url, name);
              });
            });
          }

          if (closeQrModal) closeQrModal.addEventListener('click', closeQrModalFn);
          if (qrModal) qrModal.addEventListener('click', function(e) {
            if (e.target === qrModal) closeQrModalFn();
          });

          if (downloadQr) downloadQr.addEventListener('click', function() {
            const img = qrCodeContainer.querySelector('img');
            if (img) {
              const link = document.createElement('a');
              link.href = img.src;
              link.download = 'qrcode.png';
              link.click();
              showToast('二维码已下载', 'success');
            }
          });

          // Toast 提示
          function showToast(message, type = 'info') {
            const container = document.getElementById('toastContainer');
            const toast = document.createElement('div');
            const colors = {
              success: 'bg-green-500',
              error: 'bg-red-500',
              info: 'bg-blue-500',
              warning: 'bg-yellow-500'
            };
            toast.className = `toast ${colors[type]} text-white px-4 py-3 rounded-lg shadow-lg max-w-sm`;
            toast.innerHTML = `<div class="flex items-center"><span class="flex-1">${escapeHTML(message)}</span></div>`;
            container.appendChild(toast);

            setTimeout(() => {
              toast.classList.add('hide');
              setTimeout(() => {
                if (container.contains(toast)) {
                  container.removeChild(toast);
                }
              }, 300);
            }, 3000);
          }

          // 帮助模态框
          const helpModal = document.getElementById('helpModal');
          const helpToggle = document.getElementById('helpToggle');
          const closeHelpModal = document.getElementById('closeHelpModal');

          function openHelpModal() {
            helpModal.classList.remove('opacity-0', 'invisible');
            helpModal.querySelector('.transform').classList.remove('scale-95');
            document.body.style.overflow = 'hidden';
          }

          function closeHelpModalFn() {
            helpModal.classList.add('opacity-0', 'invisible');
            helpModal.querySelector('.transform').classList.add('scale-95');
            document.body.style.overflow = '';
          }

          if (helpToggle) helpToggle.addEventListener('click', openHelpModal);
          if (closeHelpModal) closeHelpModal.addEventListener('click', closeHelpModalFn);
          if (helpModal) helpModal.addEventListener('click', function(e) {
            if (e.target === helpModal) closeHelpModalFn();
          });

          // 快捷键支持
          document.addEventListener('keydown', function(e) {
            // ESC 关闭所有模态框
            if (e.key === 'Escape') {
              closeFavoritesModal();
              closeHistoryModal();
              closeQrModalFn();
              closeHelpModalFn();
              if (typeof closeModal === 'function') closeModal();
            }

            // 如果在输入框中，不触发快捷键
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
              return;
            }

            // / 聚焦搜索
            if (e.key === '/') {
              e.preventDefault();
              const searchInput = document.getElementById('searchInput');
              if (searchInput) {
                searchInput.focus();
                searchInput.select();
              }
            }

            // T 切换主题
            if (e.key === 't' || e.key === 'T') {
              e.preventDefault();
              if (themeToggle) themeToggle.click();
            }

            // F 打开收藏
            if (e.key === 'f' || e.key === 'F') {
              e.preventDefault();
              if (favoritesToggle) favoritesToggle.click();
            }

            // H 打开历史
            if (e.key === 'h' || e.key === 'H') {
              e.preventDefault();
              if (historyToggle) historyToggle.click();
            }

            // ? 打开帮助
            if (e.key === '?') {
              e.preventDefault();
              openHelpModal();
            }

            // Home 返回顶部
            if (e.key === 'Home') {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          });

          // 批量选择功能
          const batchActions = document.getElementById('batchActions');
          const selectedCount = document.getElementById('selectedCount');
          const siteCheckboxes = document.querySelectorAll('.site-checkbox');
          const selectedSites = new Set();

          siteCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', function() {
              const id = this.dataset.id;
              if (this.checked) {
                selectedSites.add(id);
              } else {
                selectedSites.delete(id);
              }
              updateBatchActions();
            });
          });

          function updateBatchActions() {
            if (selectedSites.size > 0) {
              batchActions.classList.remove('hidden');
              batchActions.classList.add('flex');
              selectedCount.textContent = selectedSites.size;
            } else {
              batchActions.classList.add('hidden');
              batchActions.classList.remove('flex');
            }
          }

          // 批量复制
          const batchCopy = document.getElementById('batchCopy');
          if (batchCopy) {
            batchCopy.addEventListener('click', function() {
              const urls = [];
              document.querySelectorAll('.site-checkbox:checked').forEach(cb => {
                const card = cb.closest('.site-card');
                const url = card.dataset.url;
                if (url) urls.push(url);
              });
              if (urls.length > 0) {
                navigator.clipboard.writeText(urls.join('\\n')).then(() => {
                  showToast(`已复制 ${urls.length} 个链接`, 'success');
                }).catch(() => {
                  showToast('复制失败', 'error');
                });
              }
            });
          }

          // 批量导出
          const batchExport = document.getElementById('batchExport');
          if (batchExport) {
            batchExport.addEventListener('click', function() {
              const sites = [];
              document.querySelectorAll('.site-checkbox:checked').forEach(cb => {
                const card = cb.closest('.site-card');
                sites.push({
                  name: card.dataset.name,
                  url: card.dataset.url
                });
              });
              if (sites.length > 0) {
                const content = sites.map(s => `${s.name} - ${s.url}`).join('\\n');
                const blob = new Blob([content], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'bookmarks.txt';
                a.click();
                URL.revokeObjectURL(url);
                showToast(`已导出 ${sites.length} 个书签`, 'success');
              }
            });
          }

          // 清空选择
          const batchClear = document.getElementById('batchClear');
          if (batchClear) {
            batchClear.addEventListener('click', function() {
              siteCheckboxes.forEach(cb => cb.checked = false);
              selectedSites.clear();
              updateBatchActions();
            });
          }

          // 视图切换
          const gridView = document.getElementById('gridView');
          const listView = document.getElementById('listView');
          if (gridView && listView) {
            gridView.addEventListener('click', function() {
              sitesGrid.classList.remove('grid-cols-1');
              sitesGrid.classList.add('sm:grid-cols-2', 'lg:grid-cols-3', 'xl:grid-cols-4');
              this.classList.add('bg-primary-100', 'dark:bg-primary-900/30', 'text-primary-600', 'dark:text-primary-400');
              this.classList.remove('hover:bg-gray-100', 'text-gray-500');
              listView.classList.remove('bg-primary-100', 'dark:bg-primary-900/30', 'text-primary-600', 'dark:text-primary-400');
              listView.classList.add('hover:bg-gray-100', 'dark:hover:bg-gray-700', 'text-gray-500', 'dark:text-gray-400');
            });

            listView.addEventListener('click', function() {
              sitesGrid.classList.remove('sm:grid-cols-2', 'lg:grid-cols-3', 'xl:grid-cols-4');
              sitesGrid.classList.add('grid-cols-1');
              this.classList.add('bg-primary-100', 'dark:bg-primary-900/30', 'text-primary-600', 'dark:text-primary-400');
              this.classList.remove('hover:bg-gray-100', 'dark:hover:bg-gray-700', 'text-gray-500', 'dark:text-gray-400');
              gridView.classList.remove('bg-primary-100', 'dark:bg-primary-900/30', 'text-primary-600', 'dark:text-primary-400');
              gridView.classList.add('hover:bg-gray-100', 'text-gray-500');
            });
          }

          // Hitokoto
          const hitokotoText = document.getElementById('hitokotoText');
          if (hitokotoText) {
            fetch('https://v1.hitokoto.cn')
              .then(response => response.json())
              .then(data => {
                hitokotoText.textContent = '"' + data.hitokoto + '"';
              })
              .catch(() => {});
          }

          // 更新可见数量
          function updateVisibleCount() {
            const visible = document.querySelectorAll('.site-card:not(.hidden)').length;
            const visibleCountEl = document.getElementById('visibleCount');
            if (visibleCountEl) {
              visibleCountEl.textContent = visible + ' 个显示';
            }
          }

          // 在搜索时更新可见数量
          const searchInputEl = document.getElementById('searchInput');
          if (searchInputEl) {
            searchInputEl.addEventListener('input', updateVisibleCount);
          }
          updateVisibleCount();

        });
      </script>
    </body>
    </html>
    `;

    return new Response(html, {
      headers: { 'content-type': 'text/html; charset=utf-8' }
    });
}


// 导出主模块
export default {
async fetch(request, env, ctx) {
  const url = new URL(request.url);
  
  if (url.pathname.startsWith('/api')) {
    return api.handleRequest(request, env, ctx);
  } else if (url.pathname === '/admin' || url.pathname.startsWith('/static')) {
    return admin.handleRequest(request, env, ctx);
  } else {
    return handleRequest(request, env, ctx);
  }
},
};
