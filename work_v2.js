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
                  50: '#f3f5f9', 100: '#e1e7f1', 200: '#c3d0e3', 300: '#9cb3d1',
                  400: '#6c8fba', 500: '#416d9d', 600: '#305580', 700: '#254267',
                  800: '#1d3552', 900: '#192e45', 950: '#101e2d',
                },
                secondary: {
                  50: '#fdf8f3', 100: '#f6ede1', 200: '#ead6ba', 300: '#dfc19a',
                  400: '#d2aa79', 500: '#b88d58', 600: '#a17546', 700: '#835b36',
                  800: '#6b492c', 900: '#5a3e26', 950: '#2f1f13',
                },
                accent: {
                  50: '#f2faf6', 100: '#d9f0e5', 200: '#b4dfcb', 300: '#89caa9',
                  400: '#61b48a', 500: '#3c976d', 600: '#2e7755', 700: '#265c44',
                  800: '#204b38', 900: '#1b3e30', 950: '#0e221b',
                },
                dark: {
                  bg: '#0f172a',
                  card: '#1e293b',
                  border: '#334155',
                  text: '#f1f5f9',
                  muted: '#94a3b8'
                }
              },
              fontFamily: {
                sans: ['Noto Sans SC', 'sans-serif'],
              },
              backdropBlur: {
                xs: '2px',
              }
            }
          }
        }
      </script>
      <style>
        :root {
          --glass-bg: rgba(255, 255, 255, 0.7);
          --glass-border: rgba(255, 255, 255, 0.3);
        }
        .dark {
          --glass-bg: rgba(15, 23, 42, 0.7);
          --glass-border: rgba(255, 255, 255, 0.1);
        }
        
        .glass-effect {
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          background-color: var(--glass-bg);
          border-color: var(--glass-border);
        }

        /* 自定义滚动条 */
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb {
          background: #c3d0e3;
          border-radius: 10px;
        }
        .dark ::-webkit-scrollbar-thumb { background: #334155; }
        ::-webkit-scrollbar-thumb:hover { background: #416d9d; }

        /* 卡片效果 */
        .site-card {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .view-grid .site-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px -8px rgba(0, 0, 0, 0.15);
        }
        .dark .site-card:hover {
          box-shadow: 0 12px 24px -8px rgba(0, 0, 0, 0.4);
        }

        /* 动画 */
        @keyframes heartbeat {
          0% { transform: scale(1); }
          14% { transform: scale(1.3); }
          28% { transform: scale(1); }
          42% { transform: scale(1.3); }
          70% { transform: scale(1); }
        }
        .animate-heartbeat { animation: heartbeat 0.8s ease-in-out; }

        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in { animation: slideIn 0.3s ease-out forwards; }

        @keyframes modalFadeIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-modal { animation: modalFadeIn 0.2s ease-out forwards; }

        /* 列表视图样式 */
        .view-list #sitesGrid {
          grid-template-columns: 1fr !important;
        }
        .view-list .site-card {
          display: flex;
          flex-direction: row;
          align-items: center;
          padding: 0.5rem 1rem;
        }
        .view-list .site-card .card-body {
          display: flex;
          flex: 1;
          align-items: center;
          justify-content: space-between;
        }
        .view-list .site-card .card-desc { display: none; }
        .view-list .site-card .card-footer { border: none; padding: 0; margin: 0; }

        /* 复选框样式 */
        .card-checkbox {
          opacity: 0;
          transition: opacity 0.2s;
        }
        .site-card:hover .card-checkbox, 
        .site-card.selected .card-checkbox {
          opacity: 1;
        }

        /* 深色模式适配 */
        .dark body { background-color: #0f172a; color: #f1f5f9; }
        .dark .bg-white { background-color: #1e293b; }
        .dark .text-gray-900 { color: #f8fafc; }
        .dark .text-gray-800 { color: #f1f5f9; }
        .dark .text-gray-700 { color: #e2e8f0; }
        .dark .text-gray-600 { color: #cbd5e1; }
        .dark .text-gray-500 { color: #94a3b8; }
        .dark .border-gray-100, .dark .border-primary-100 { border-color: #334155; }
        .dark .hover\:bg-gray-100:hover { background-color: #334155; }
        .dark .bg-secondary-50 { background-color: #0f172a; }
        .dark .bg-secondary-100 { background-color: #334155; color: #cbd5e1; }
      </style>
    </head>
    <body class="bg-secondary-50 dark:bg-dark-bg font-sans text-gray-800 dark:text-gray-200 transition-colors duration-300">
      <script>
        (function() {
          const theme = localStorage.getItem('theme') || 'light';
          if (theme === 'dark') document.documentElement.classList.add('dark');
        })();
      </script>
      <!-- 顶部工具栏 -->
      <nav class="fixed top-0 left-0 right-0 z-[60] glass-effect border-b h-16 flex items-center px-4 justify-between lg:pl-68">
        <div class="flex items-center gap-4">
          <button id="mobileSidebarBtn" class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 lg:hidden">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
          </button>
          <div class="hidden sm:flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-1.5 border border-transparent focus-within:border-primary-400 focus-within:bg-white dark:focus-within:bg-gray-900 transition-all">
            <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            <input id="topSearchInput" type="text" placeholder="搜索 (按 / 聚焦)" class="bg-transparent border-none focus:ring-0 text-sm ml-2 w-48 md:w-64">
          </div>
        </div>
        
        <div class="flex items-center gap-2 md:gap-4">
          <button id="viewToggleBtn" class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400" title="切换视图">
            <svg id="gridViewIcon" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>
            <svg id="listViewIcon" class="w-5 h-5 hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
          </button>
          <button id="themeToggleBtn" class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400" title="切换主题 (T)">
            <svg id="sunIcon" class="w-5 h-5 hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M16.243 17.657l.707.707M7.757 6.364l.707.707M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            <svg id="moonIcon" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>
          </button>
          <div class="relative">
            <button id="favoritesBtn" class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400" title="我的收藏 (F)">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
              <span id="favCountBadge" class="absolute top-1 right-1 bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full hidden">0</span>
            </button>
          </div>
          <button id="historyBtn" class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400" title="历史记录 (H)">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </button>
          <button id="helpBtn" class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400" title="帮助 (?)">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </button>
        </div>
      </nav>

      <!-- 侧边栏导航 -->
      <aside id="sidebar" class="fixed left-0 top-0 h-full w-64 bg-white dark:bg-dark-card border-r dark:border-dark-border z-50 overflow-y-auto transform -translate-x-full lg:translate-x-0 transition-transform duration-300">
        <div class="p-6">
          <div class="flex items-center justify-between mb-8 pt-16 lg:pt-0">
            <h2 class="text-2xl font-bold text-primary-600 tracking-tight dark:text-primary-400">星漫旅站</h2>
            <button id="closeSidebar" class="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 lg:hidden">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
          
          <div class="mb-6">
            <div class="relative">
              <input id="searchInput" type="text" placeholder="搜索书签..." class="w-full pl-10 pr-4 py-2 border border-primary-100 dark:border-dark-border rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-900 transition text-sm">
              <svg class="h-4 w-4 text-gray-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              <div class="absolute right-3 top-2.5 hidden sm:block">
                <kbd class="px-1.5 py-0.5 text-[10px] font-semibold text-gray-500 bg-gray-100 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600">/</kbd>
              </div>
            </div>
          </div>
          
          <div>
            <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 px-3">分类导航</h3>
            <div class="space-y-1">
              <a href="?" class="flex items-center px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${catalogExists ? 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800' : 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 font-medium'}">
                <svg class="h-5 w-5 mr-3 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
                全部
              </a>
              ${catalogLinkMarkup}
            </div>
          </div>
          
          <div class="mt-8 pt-6 border-t dark:border-dark-border">
            ${submissionEnabled ? `
            <button id="addSiteBtnSidebar" class="w-full flex items-center justify-center px-4 py-2.5 bg-accent-500 text-white rounded-xl hover:bg-accent-600 transition shadow-lg shadow-accent-500/20 text-sm font-medium">
              <svg class="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
              添加新书签
            </button>` : ''}
            
            <div class="mt-4 space-y-1">
              <a href="https://blog.110995.xyz/" target="_blank" class="flex items-center px-3 py-2 text-sm text-gray-500 hover:text-primary-500 transition duration-300">
                <svg class="h-4 w-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
                访问博客
              </a>
              <a href="/admin" target="_blank" class="flex items-center px-3 py-2 text-sm text-gray-500 hover:text-primary-500 transition duration-300">
                <svg class="h-4 w-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                后台管理
              </a>
            </div>
          </div>
        </div>
      </aside>
      
      <!-- 主内容区 -->
      <main class="main-content lg:ml-64 min-h-screen transition-all duration-300 pt-16">
        <!-- 顶部横幅 -->
        <header class="bg-primary-700 dark:bg-gray-900/50 text-white py-12 px-6 md:px-10 relative overflow-hidden">
          <div class="absolute inset-0 bg-gradient-to-br from-primary-600/20 to-accent-500/20 pointer-events-none"></div>
          <div class="max-w-5xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-8 relative z-10">
            <div class="flex-1 text-center md:text-left">
              <span class="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-md px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary-200">
                <span class="w-2 h-2 rounded-full bg-accent-400 animate-pulse"></span>
                精选 · 真实 · 有温度
              </span>
              <h1 class="mt-6 text-4xl md:text-5xl font-extrabold tracking-tight leading-tight">星漫旅站书签</h1>
              <p class="mt-4 text-base md:text-lg text-secondary-100/80 leading-relaxed max-w-2xl">
                从效率工具到灵感站点，我们亲自挑选、亲手标注，只为帮助你更快找到值得信赖的优质资源。
              </p>
            </div>
            <div class="w-full md:w-auto flex justify-center md:justify-end">
              <div class="rounded-3xl bg-white/10 backdrop-blur-xl px-8 py-6 shadow-2xl border border-white/10 text-left md:text-right group hover:bg-white/15 transition-all duration-300">
                <p class="text-[10px] uppercase font-bold tracking-[0.2em] text-secondary-200/60">Current Overview</p>
                <p class="mt-4 text-4xl font-black text-white group-hover:scale-110 transition-transform origin-left md:origin-right inline-block">${totalSites}</p>
                <p class="text-sm font-medium text-secondary-100/90 mt-1">条书签 · ${catalogs.length} 个分类</p>
                <div class="mt-4 h-1 w-12 bg-accent-400 rounded-full md:ml-auto"></div>
              </div>
            </div>
          </div>
        </header>
        
        <!-- 网站列表 -->
        <section class="max-w-7xl mx-auto px-4 sm:px-6 py-10">
          <!-- 批量操作栏 -->
          <div id="batchActionBar" class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-white dark:bg-dark-card border dark:border-dark-border px-6 py-3 rounded-2xl shadow-2xl items-center gap-6 hidden animate-slide-up flex">
            <span class="text-sm font-medium whitespace-nowrap"><span id="selectedCount" class="text-primary-600 font-bold mr-1">0</span> 项已选择</span>
            <div class="h-6 w-px bg-gray-200 dark:bg-dark-border"></div>
            <div class="flex items-center gap-3">
              <button id="batchCopyBtn" class="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary-50 dark:bg-primary-900/20 text-primary-600 rounded-lg hover:bg-primary-100 transition">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
                复制链接
              </button>
              <button id="batchExportBtn" class="flex items-center gap-2 px-3 py-1.5 text-sm bg-accent-50 dark:bg-accent-900/20 text-accent-600 rounded-lg hover:bg-accent-100 transition">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                导出 TXT
              </button>
              <button id="batchClearBtn" class="text-sm text-gray-500 hover:text-red-500 px-2 py-1">取消</button>
            </div>
          </div>

          <div class="flex items-center justify-between mb-8">
            <div class="flex items-center gap-4">
               <h2 class="text-2xl font-bold text-gray-900 dark:text-white" data-role="list-heading" data-default="${headingDefaultAttr}" data-active="${headingActiveAttr}">
                ${headingText}
              </h2>
            </div>
            <div class="hidden md:block">
              <div class="bg-white dark:bg-dark-card border dark:border-dark-border rounded-xl px-4 py-3 shadow-sm flex items-center gap-3 group">
                <div class="w-8 h-8 rounded-full bg-accent-100 dark:bg-accent-900/30 flex items-center justify-center text-accent-600 group-hover:rotate-12 transition-transform">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                </div>
                <div id="hitokoto" class="text-sm font-medium text-gray-600 dark:text-gray-400">
                  <a href="#" target="_blank" id="hitokoto_text" class="hover:text-primary-600 transition-colors">疏影横斜水清浅，暗香浮动月黄昏。</a>
                </div>
                <script>
                  fetch('https://v1.hitokoto.cn')
                    .then(r => r.json())
                    .then(d => {
                      const el = document.getElementById('hitokoto_text');
                      el.href = 'https://hitokoto.cn/?uuid=' + d.uuid;
                      el.innerText = d.hitokoto;
                    }).catch(console.error);
                </script>
              </div>
            </div>
          </div>
          
          <div id="viewContainer" class="view-grid">
            <div id="sitesGrid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
              return `
                <div class="site-card group relative bg-white dark:bg-dark-card border border-primary-100/60 dark:border-dark-border rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden" data-id="${site.id}" data-name="${safeDataName}" data-url="${dataUrlAttr}" data-catalog="${safeDataCatalog}">
                  <div class="absolute top-3 left-3 z-10 card-checkbox">
                    <input type="checkbox" class="site-checkbox w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500 dark:bg-gray-800" data-id="${site.id}">
                  </div>
                  
                  <button class="fav-btn absolute top-3 right-3 z-10 p-1.5 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-sm opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500" data-id="${site.id}" title="收藏 (S)">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                  </button>

                  <div class="p-5 card-body relative">
                    <a href="${hrefValue}" ${hasValidUrl ? 'onclick="recordHistory(\''+safeName+'\', \''+dataUrlAttr+'\')"' : ''} ${hasValidUrl ? 'target="_blank" rel="noopener noreferrer"' : ''} class="block">
                      <div class="flex items-start">
                        <div class="flex-shrink-0 mr-4 relative">
                          ${
                            logoUrl
                              ? `<img src="${escapeHTML(logoUrl)}" alt="${safeName}" class="w-12 h-12 rounded-xl object-cover bg-gray-100 dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700">`
                              : `<div class="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-bold text-xl shadow-lg">${cardInitial}</div>`
                          }
                        </div>
                        <div class="flex-1 min-w-0 pt-0.5">
                          <h3 class="text-base font-bold text-gray-900 dark:text-white truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors" title="${safeName}">${safeName}</h3>
                          <div class="flex items-center gap-2 mt-1.5">
                            <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 uppercase tracking-wider">
                              ${safeCatalog}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <p class="mt-4 text-sm text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2 card-desc" title="${safeDesc}">${safeDesc}</p>
                    </a>
                    
                    <div class="mt-5 pt-4 border-t dark:border-dark-border flex items-center justify-between card-footer">
                      <div class="flex items-center text-[11px] text-gray-400 truncate max-w-[120px] dark:text-gray-500">
                        <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.826L10.242 9.172a4 4 0 015.656 0l4 4a4 4 0 01-5.656 5.656l-1.102-1.102"/></svg>
                        ${safeDisplayUrl}
                      </div>
                      <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button class="qr-btn p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-primary-500 transition-colors" data-url="${dataUrlAttr}" data-name="${safeName}" title="二维码 (Q)">
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m0 11v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M16.243 17.657l.707.707M7.757 6.364l.707.707M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                        </button>
                        <button class="copy-btn p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-primary-500 transition-colors" data-url="${dataUrlAttr}" title="复制链接 (C)">
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
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
        
        <!-- Toast 容器 -->
        <div id="toastContainer" class="fixed top-20 right-4 z-[100] flex flex-col gap-3 pointer-events-none"></div>

        <!-- 收藏管理模态框 -->
        <div id="favoritesModal" class="fixed inset-0 z-[70] flex items-center justify-center hidden">
          <div class="absolute inset-0 bg-black/40 backdrop-blur-sm modal-overlay"></div>
          <div class="bg-white dark:bg-dark-card w-full max-w-2xl mx-4 rounded-3xl shadow-2xl relative z-10 animate-modal overflow-hidden max-h-[80vh] flex flex-col">
            <div class="p-6 border-b dark:border-dark-border flex items-center justify-between">
              <h2 class="text-xl font-bold flex items-center gap-2">
                <svg class="w-6 h-6 text-red-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                我的收藏
              </h2>
              <div class="flex items-center gap-3">
                <button id="clearFavsBtn" class="text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-1.5 rounded-lg transition">清空所有</button>
                <button class="close-modal p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            </div>
            <div id="favoritesList" class="p-6 overflow-y-auto flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <!-- 收藏列表 -->
            </div>
            <div id="emptyFavs" class="hidden p-20 text-center flex-1 flex flex-col items-center justify-center">
              <div class="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 mb-4">
                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
              </div>
              <p class="text-gray-500">暂无收藏内容</p>
            </div>
          </div>
        </div>

        <!-- 历史记录模态框 -->
        <div id="historyModal" class="fixed inset-0 z-[70] flex items-center justify-center hidden">
          <div class="absolute inset-0 bg-black/40 backdrop-blur-sm modal-overlay"></div>
          <div class="bg-white dark:bg-dark-card w-full max-w-xl mx-4 rounded-3xl shadow-2xl relative z-10 animate-modal overflow-hidden max-h-[80vh] flex flex-col">
            <div class="p-6 border-b dark:border-dark-border flex items-center justify-between">
              <h2 class="text-xl font-bold flex items-center gap-2">
                <svg class="w-6 h-6 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                访问历史
              </h2>
              <div class="flex items-center gap-3">
                <button id="clearHistoryBtn" class="text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-1.5 rounded-lg transition">清空历史</button>
                <button class="close-modal p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            </div>
            <div id="historyList" class="p-4 overflow-y-auto flex-1 space-y-2">
              <!-- 历史记录列表 -->
            </div>
          </div>
        </div>

        <!-- 二维码模态框 -->
        <div id="qrModal" class="fixed inset-0 z-[70] flex items-center justify-center hidden">
          <div class="absolute inset-0 bg-black/40 backdrop-blur-sm modal-overlay"></div>
          <div class="bg-white dark:bg-dark-card w-full max-w-xs mx-4 rounded-3xl shadow-2xl relative z-10 animate-modal overflow-hidden p-8 text-center">
            <button class="close-modal absolute top-4 right-4 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
            <h3 id="qrName" class="text-lg font-bold mb-6 truncate dark:text-white"></h3>
            <div id="qrContent" class="bg-white p-4 rounded-2xl shadow-inner inline-block relative">
              <div id="qrLoading" class="absolute inset-0 flex items-center justify-center bg-white rounded-2xl z-10">
                <svg class="w-8 h-8 text-primary-500 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              </div>
              <img id="qrImage" src="" alt="QR Code" class="w-48 h-48">
            </div>
            <p class="text-xs text-gray-400 mt-6">使用手机扫描二维码访问</p>
            <a id="downloadQrBtn" href="" download="qrcode.png" class="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-bold hover:bg-primary-700 transition">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
              下载 PNG
            </a>
          </div>
        </div>

        <!-- 帮助模态框 -->
        <div id="helpModal" class="fixed inset-0 z-[70] flex items-center justify-center hidden">
          <div class="absolute inset-0 bg-black/40 backdrop-blur-sm modal-overlay"></div>
          <div class="bg-white dark:bg-dark-card w-full max-w-md mx-4 rounded-3xl shadow-2xl relative z-10 animate-modal p-8 overflow-hidden">
            <div class="flex items-center justify-between mb-8">
              <h2 class="text-xl font-bold flex items-center gap-2">
                <svg class="w-6 h-6 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                键盘快捷键
              </h2>
              <button class="close-modal p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div class="space-y-4">
              <div class="flex justify-between items-center"><span class="text-sm font-medium">聚焦搜索</span><kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-md text-xs font-bold border"> / </kbd></div>
              <div class="flex justify-between items-center"><span class="text-sm font-medium">切换主题</span><kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-md text-xs font-bold border"> T </kbd></div>
              <div class="flex justify-between items-center"><span class="text-sm font-medium">打开收藏</span><kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-md text-xs font-bold border"> F </kbd></div>
              <div class="flex justify-between items-center"><span class="text-sm font-medium">历史记录</span><kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-md text-xs font-bold border"> H </kbd></div>
              <div class="flex justify-between items-center"><span class="text-sm font-medium">帮助面板</span><kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-md text-xs font-bold border"> ? </kbd></div>
              <div class="flex justify-between items-center"><span class="text-sm font-medium">返回顶部</span><kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-md text-xs font-bold border"> Home </kbd></div>
              <div class="flex justify-between items-center"><span class="text-sm font-medium">关闭弹窗</span><kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-md text-xs font-bold border"> Esc </kbd></div>
            </div>
            <p class="mt-8 text-xs text-center text-gray-400">效率源于习惯，捷径始于指尖</p>
          </div>
        </div>

        <!-- 页脚 -->
        <footer class="bg-white dark:bg-dark-card py-8 px-6 mt-12 border-t dark:border-dark-border transition-colors">
          <div class="max-w-5xl mx-auto text-center">
            <p class="text-gray-500">© ${new Date().getFullYear()} 星漫旅站 | 愿你在此找到方向</p>
            <div class="mt-4 flex justify-center space-x-6">
              <a href="https://page.110995.xyz/" target="_blank" class="text-gray-400 hover:text-primary-500 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </a>
            </div>
          </div>
        </footer>
      </main>
      
      <!-- 返回顶部按钮 -->
      <button id="backToTop" class="fixed bottom-8 right-8 p-3 rounded-full bg-accent-500 text-white shadow-lg opacity-0 invisible transition-all duration-300 hover:bg-accent-600">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 11l7-7 7 7M5 19l7-7 7 7" />
        </svg>
      </button>
      
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
        // --- 核心工具类 ---
        const Toast = {
          show(message, type = 'info') {
            const container = document.getElementById('toastContainer');
            if (!container) return;
            const toast = document.createElement('div');
            toast.className = `animate-slide-in flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl bg-white dark:bg-dark-card border dark:border-dark-border pointer-events-auto min-w-[240px]`;
            const colors = { success: 'text-green-500', error: 'text-red-500', warning: 'text-yellow-500', info: 'text-blue-500' };
            toast.innerHTML = `<div class="w-2 h-2 rounded-full bg-current ${colors[type] || 'text-blue-500'}"></div><p class="text-sm font-medium text-gray-700 dark:text-gray-200">${message}</p>`;
            container.appendChild(toast);
            setTimeout(() => {
              toast.style.opacity = '0'; toast.style.transform = 'translateX(20px)'; toast.style.transition = 'all 0.3s ease';
              setTimeout(() => toast.remove(), 300);
            }, 3000);
          }
        };

        const Storage = {
          get(key, defaultValue = []) { try { return JSON.parse(localStorage.getItem(key)) || defaultValue; } catch { return defaultValue; } },
          set(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
        };

        const Favorites = {
          list: Storage.get('favorites'),
          toggle(site) {
            const index = this.list.findIndex(item => item.id == site.id);
            if (index > -1) { this.list.splice(index, 1); Toast.show('已取消收藏', 'info'); }
            else { this.list.push(site); Toast.show('已添加收藏', 'success'); }
            Storage.set('favorites', this.list); this.updateUI();
          },
          updateUI() {
            const badge = document.getElementById('favCountBadge');
            if (badge) { badge.innerText = this.list.length; badge.classList.toggle('hidden', this.list.length === 0); }
            document.querySelectorAll('.fav-btn').forEach(btn => {
              const isFav = this.list.some(item => item.id == btn.dataset.id);
              btn.classList.toggle('text-red-500', isFav); btn.classList.toggle('text-gray-400', !isFav);
              btn.classList.toggle('opacity-100', isFav);
            });
            const listEl = document.getElementById('favoritesList');
            if (listEl) {
              if (this.list.length === 0) { listEl.innerHTML = ''; document.getElementById('emptyFavs')?.classList.remove('hidden'); }
              else {
                document.getElementById('emptyFavs')?.classList.add('hidden');
                listEl.innerHTML = this.list.map(site => `
                  <div class="flex items-center justify-between p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border dark:border-dark-border group text-left">
                    <div class="flex items-center gap-3 overflow-hidden">
                      <div class="w-10 h-10 rounded-lg bg-primary-600 flex-shrink-0 flex items-center justify-center text-white font-bold">${(site.name || '站').charAt(0)}</div>
                      <div class="overflow-hidden">
                        <p class="text-sm font-bold truncate dark:text-white">${site.name}</p>
                        <p class="text-[10px] text-gray-400 truncate">${site.url}</p>
                      </div>
                    </div>
                    <div class="flex items-center gap-1">
                      <a href="${site.url}" target="_blank" class="p-2 text-primary-500 hover:bg-white dark:hover:bg-gray-700 rounded-lg transition"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg></a>
                      <button onclick='Favorites.toggle(${JSON.stringify(site).replace(/'/g, "&#39;")})' class="p-2 text-red-500 hover:bg-white dark:hover:bg-gray-700 rounded-lg transition"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19 13H5v-2h14v2z"/></svg></button>
                    </div>
                  </div>
                `).join('');
              }
            }
          }
        };

        const History = {
          list: Storage.get('history'),
          add(name, url) {
            this.list = [{ name, url, time: Date.now() }, ...this.list.filter(i => i.url !== url)].slice(0, 50);
            Storage.set('history', this.list); this.updateUI();
          },
          updateUI() {
            const listEl = document.getElementById('historyList');
            if (listEl) {
              if (this.list.length === 0) listEl.innerHTML = '<p class="text-center text-gray-400 py-10 text-sm">暂无历史记录</p>';
              else listEl.innerHTML = this.list.map(item => `
                <div class="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition group text-left">
                  <div class="overflow-hidden pr-4">
                    <p class="text-sm font-medium truncate dark:text-gray-200">${item.name}</p>
                    <p class="text-[10px] text-gray-400 truncate">${new Date(item.time).toLocaleString()}</p>
                  </div>
                  <a href="${item.url}" target="_blank" class="p-2 text-gray-400 hover:text-primary-500 transition opacity-0 group-hover:opacity-100"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg></a>
                </div>
              `).join('');
            }
          }
        };

        const Theme = {
          current: localStorage.getItem('theme') || 'light',
          init() { this.apply(this.current); },
          toggle() { this.current = this.current === 'light' ? 'dark' : 'light'; this.apply(this.current); localStorage.setItem('theme', this.current); Toast.show(`已切换至${this.current === 'dark'?'深色':'浅色'}模式`, 'info'); },
          apply(t) {
            const isDark = t === 'dark'; document.documentElement.classList.toggle('dark', isDark);
            document.getElementById('sunIcon')?.classList.toggle('hidden', !isDark);
            document.getElementById('moonIcon')?.classList.toggle('hidden', isDark);
          }
        };

        const View = {
          current: Storage.get('view', 'grid'),
          init() { this.apply(this.current); },
          toggle() { this.current = this.current === 'grid' ? 'list' : 'grid'; this.apply(this.current); Storage.set('view', this.current); },
          apply(v) {
            const c = document.getElementById('viewContainer'); if(c) c.className = `view-${v}`;
            document.getElementById('gridViewIcon')?.classList.toggle('hidden', v === 'grid');
            document.getElementById('listViewIcon')?.classList.toggle('hidden', v === 'list');
          }
        };

        const QR = {
          show(name, url) {
            const modal = document.getElementById('qrModal');
            const img = document.getElementById('qrImage');
            const loading = document.getElementById('qrLoading');
            if (document.getElementById('qrName')) document.getElementById('qrName').innerText = name;
            if (loading) loading.classList.remove('hidden');
            if (img) {
              img.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
              if (document.getElementById('downloadQrBtn')) document.getElementById('downloadQrBtn').href = img.src;
              img.onload = () => loading && loading.classList.add('hidden');
            }
            modal?.classList.remove('hidden');
          }
        };

        const Batch = {
          selected: new Set(),
          toggle(id) { if(this.selected.has(id)) this.selected.delete(id); else this.selected.add(id); this.updateUI(); },
          updateUI() {
            const c = this.selected.size;
            document.getElementById('batchActionBar')?.classList.toggle('hidden', c === 0);
            if (document.getElementById('selectedCount')) document.getElementById('selectedCount').innerText = c;
            document.querySelectorAll('.site-card').forEach(card => {
              const isSel = this.selected.has(card.dataset.id);
              card.classList.toggle('ring-2', isSel); card.classList.toggle('ring-primary-500', isSel);
              const cb = card.querySelector('.site-checkbox'); if (cb) cb.checked = isSel;
            });
          },
          clear() { this.selected.clear(); this.updateUI(); },
          copy() {
            const urls = Array.from(this.selected).map(id => document.querySelector(`.site-card[data-id="${id}"]`)?.dataset.url).filter(Boolean).join('\n');
            navigator.clipboard.writeText(urls).then(() => { Toast.show(`已复制 ${this.selected.size} 条链接`, 'success'); this.clear(); });
          },
          export() {
            const content = Array.from(this.selected).map(id => {
              const card = document.querySelector(`.site-card[data-id="${id}"]`);
              return card ? `${card.dataset.name}: ${card.dataset.url}` : null;
            }).filter(Boolean).join('\n');
            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `bookmarks.txt`; a.click(); URL.revokeObjectURL(url);
            Toast.show(`已导出 ${this.selected.size} 条书签`, 'success'); this.clear();
          }
        };

        window.recordHistory = (name, url) => History.add(name, url);

        document.addEventListener('DOMContentLoaded', () => {
          Theme.init(); View.init(); Favorites.updateUI(); History.updateUI();

          const modals = {
            fav: document.getElementById('favoritesModal'),
            history: document.getElementById('historyModal'),
            qr: document.getElementById('qrModal'),
            help: document.getElementById('helpModal'),
            add: document.getElementById('addSiteModal')
          };
          const openM = (id) => { if(modals[id]) { modals[id].classList.remove('hidden'); document.body.style.overflow = 'hidden'; } };
          const closeAll = () => { Object.values(modals).forEach(m => m && m.classList.add('hidden')); document.body.style.overflow = ''; };

          document.getElementById('mobileSidebarBtn')?.addEventListener('click', () => document.getElementById('sidebar').classList.toggle('translate-x-0'));
          document.getElementById('closeSidebar')?.addEventListener('click', () => document.getElementById('sidebar').classList.remove('translate-x-0'));
          document.getElementById('themeToggleBtn')?.addEventListener('click', () => Theme.toggle());
          document.getElementById('viewToggleBtn')?.addEventListener('click', () => View.toggle());
          document.getElementById('favoritesBtn')?.addEventListener('click', () => openM('fav'));
          document.getElementById('historyBtn')?.addEventListener('click', () => openM('history'));
          document.getElementById('helpBtn')?.addEventListener('click', () => openM('help'));
          
          document.getElementById('clearFavsBtn')?.addEventListener('click', () => { if(confirm('清空所有收藏？')){ Favorites.list=[]; Storage.set('favorites',[]); Favorites.updateUI(); Toast.show('已清空','warning'); } });
          document.getElementById('clearHistoryBtn')?.addEventListener('click', () => { History.list=[]; Storage.set('history',[]); History.updateUI(); Toast.show('已清空历史','warning'); });

          document.addEventListener('click', e => {
            const t = e.target;
            if (t.classList.contains('close-modal') || t.classList.contains('modal-overlay') || t.closest('.close-modal')) closeAll();
            const copyBtn = t.closest('.copy-btn');
            if (copyBtn) { navigator.clipboard.writeText(copyBtn.dataset.url).then(() => Toast.show('链接已复制', 'success')); }
            const favBtn = t.closest('.fav-btn');
            if (favBtn) { const card = favBtn.closest('.site-card'); Favorites.toggle({ id: favBtn.dataset.id, name: card.dataset.name, url: card.dataset.url }); }
            const qrBtn = t.closest('.qr-btn');
            if (qrBtn) QR.show(qrBtn.dataset.name, qrBtn.dataset.url);
            const checkbox = t.closest('.site-checkbox');
            if (checkbox) Batch.toggle(checkbox.dataset.id);
          });

          const setupSearch = (id) => {
            document.getElementById(id)?.addEventListener('input', e => {
              const kw = e.target.value.toLowerCase().trim();
              let count = 0;
              document.querySelectorAll('.site-card').forEach(card => {
                const match = card.dataset.name.toLowerCase().includes(kw) || card.dataset.url.toLowerCase().includes(kw) || card.dataset.catalog.toLowerCase().includes(kw);
                card.classList.toggle('hidden', !match);
                if (match) count++;
              });
              const h = document.querySelector('[data-role="list-heading"]');
              if (h) h.innerText = kw ? `搜索结果 · ${count} 个网站` : h.dataset.default;
            });
          };
          setupSearch('searchInput'); setupSearch('topSearchInput');

          document.getElementById('batchCopyBtn')?.addEventListener('click', () => Batch.copy());
          document.getElementById('batchExportBtn')?.addEventListener('click', () => Batch.export());
          document.getElementById('batchClearBtn')?.addEventListener('click', () => Batch.clear());

          document.addEventListener('keydown', e => {
            if (['INPUT','TEXTAREA'].includes(e.target.tagName)) { if(e.key==='Escape') e.target.blur(); return; }
            const k = e.key.toLowerCase();
            if (k === '/') { e.preventDefault(); (document.getElementById('topSearchInput') || document.getElementById('searchInput')).focus(); }
            else if (k === 't') Theme.toggle();
            else if (k === 'f') openM('fav');
            else if (k === 'h') openM('history');
            else if (k === '?') openM('help');
            else if (k === 'q') { const h = document.querySelector('.site-card:hover'); if(h) QR.show(h.dataset.name, h.dataset.url); }
            else if (k === 'c') { const h = document.querySelector('.site-card:hover'); if(h) navigator.clipboard.writeText(h.dataset.url).then(() => Toast.show('已复制','success')); }
            else if (k === 's') { const h = document.querySelector('.site-card:hover'); if(h) Favorites.toggle({ id: h.dataset.id, name: h.dataset.name, url: h.dataset.url }); }
            else if (e.key === 'Escape') closeAll();
            else if (e.key === 'Home') window.scrollTo({ top: 0, behavior: 'smooth' });
          });

          const backToTop = document.getElementById('backToTop');
          if (backToTop) {
            window.addEventListener('scroll', () => {
              const show = window.scrollY > 500;
              backToTop.classList.toggle('opacity-0', !show);
              backToTop.classList.toggle('invisible', !show);
              backToTop.classList.toggle('opacity-100', show);
              backToTop.classList.toggle('visible', show);
            });
            backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
          }

          const addBtn = document.getElementById('addSiteBtnSidebar');
          if (addBtn) addBtn.addEventListener('click', () => openM('add'));
          
          document.getElementById('fetchFaviconBtn')?.addEventListener('click', async (e) => {
            const url = document.getElementById('addSiteUrl').value.trim();
            if (!url) { Toast.show('请先输入网址', 'warning'); return; }
            const btn = e.currentTarget;
            btn.disabled = true; btn.innerText = '获取中...';
            try {
              const res = await fetch('/api/favicon?url=' + encodeURIComponent(url));
              const data = await res.json();
              if (data.code === 200 && data.favicon) {
                document.getElementById('addSiteLogo').value = data.favicon;
                Toast.show('图标获取成功', 'success');
              } else Toast.show('未找到图标', 'info');
            } catch { Toast.show('获取失败', 'error'); }
            finally { btn.disabled = false; btn.innerText = '自动获取图标'; }
          });

          document.getElementById('addSiteForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = {
              name: document.getElementById('addSiteName').value,
              url: document.getElementById('addSiteUrl').value,
              logo: document.getElementById('addSiteLogo').value,
              desc: document.getElementById('addSiteDesc').value,
              catelog: document.getElementById('addSiteCatelog').value
            };
            try {
              const res = await fetch('/api/config/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
              const data = await res.json();
              if (data.code === 201) { Toast.show('提交成功，等待审核', 'success'); closeAll(); e.target.reset(); }
              else Toast.show(data.message || '提交失败', 'error');
            } catch { Toast.show('网络错误', 'error'); }
          });
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
