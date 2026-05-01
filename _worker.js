// Cloudflare Pages Worker - 旭儿导航
export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const path = url.pathname;
        const kv = env.NAV_KV;

        // 路由分发
        if (path === '/admin') return handleAdmin(request, kv);
        if (path === '/logout') return handleLogout(request, kv);
        if (path.startsWith('/post/')) return handlePost(request, kv);
        if (path.startsWith('/api/upload')) return handleUpload(request, kv);
        if (path.startsWith('/api/image/')) return handleImage(request, kv);
        if (path.startsWith('/api/')) return handleApi(request, kv);
        return handleHome(request, kv);
    }
};

// ==================== 首页 ====================
async function handleHome(request, kv) {
    const url = new URL(request.url);
    const currentTab = url.searchParams.get('tab') || 'blog';
    const searchQuery = url.searchParams.get('q') || '';
    const currentTag = url.searchParams.get('tag') || '';
    const currentCat = url.searchParams.get('c') || '';
    
    let sites = [], posts = [];
    try {
        const sitesData = await kv.get('sites');
        if (sitesData) sites = JSON.parse(sitesData);
        const postsData = await kv.get('blog_posts');
        if (postsData) posts = JSON.parse(postsData);
    } catch(e) { }

    sites.sort((a, b) => (a.sort_order || 9999) - (b.sort_order || 9999));

    const viewsMap = new Map();
    for (const post of posts) {
        const views = await kv.get(`views:${post.id}`);
        if (views) viewsMap.set(post.id, parseInt(views));
    }
    
    const catMap = new Map();
    sites.forEach(s => {
        const cat = s.catelog || '未分类';
        catMap.set(cat, (catMap.get(cat) || 0) + 1);
    });
    const categories = Array.from(catMap.keys()).sort((a, b) => a.localeCompare(b, 'zh-CN'));
    const filteredSites = currentCat ? sites.filter(s => (s.catelog || '未分类') === currentCat) : sites;
    
    let catNavHtml = categories.map(cat => {
        const activeClass = currentCat === cat ? 'background:#667eea;color:white;font-weight:600' : '';
        return `<a href="/?tab=bookmark&c=${encodeURIComponent(cat)}" style="display:block;padding:10px 12px;margin:4px 0;border-radius:8px;text-decoration:none;color:#4a5568;${activeClass}">📁 ${escapeHtml(cat)} <span style="float:right;color:#a0aec0;font-size:12px">${catMap.get(cat)}</span></a>`;
    }).join('');
    
    let cardsHtml = filteredSites.map(s => {
        const name = escapeHtml(s.name || '未命名');
        const url_clean = s.url && s.url.startsWith('http') ? s.url : 'https://' + (s.url || '');
        const logo_clean = s.logo || '';
        const desc = escapeHtml(s.desc || '暂无描述');
        const cat = escapeHtml(s.catelog || '未分类');
        const initial = (s.name && s.name[0]) || '站';
        return `<div class="site-card"><a href="${url_clean}" target="_blank" style="text-decoration:none;color:inherit;display:block"><div style="display:flex;align-items:center;margin-bottom:12px">${logo_clean ? `<img src="${logo_clean}" style="width:44px;height:44px;border-radius:10px;object-fit:cover;margin-right:14px">` : `<div style="width:44px;height:44px;border-radius:10px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:18px;margin-right:14px">${initial}</div>`}<div style="flex:1"><h3 style="font-size:16px;font-weight:600;color:#2d3748;margin-bottom:4px">${name}</h3><span style="font-size:11px;color:#a0aec0;background:#f7fafc;padding:2px 8px;border-radius:12px">${cat}</span></div></div><p style="font-size:13px;color:#718096;margin-bottom:12px;line-height:1.4">${desc}</p><div style="display:flex;justify-content:space-between"><span style="font-size:11px;color:#a0aec0">${url_clean.replace(/^https?:\/\//, '').substring(0,30)}</span><button class="copy-btn" data-url="${url_clean}" style="background:#edf2f7;border:none;padding:5px 14px;border-radius:20px;font-size:11px;cursor:pointer">复制</button></div></a></div>`;
    }).join('');
    if (!cardsHtml) cardsHtml = '<div style="text-align:center;padding:60px">暂无书签</div>';
    
    let blogPosts = posts.filter(p => p.status === 'published');
    if (searchQuery) {
        blogPosts = blogPosts.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()) || (p.content && p.content.toLowerCase().includes(searchQuery.toLowerCase())));
    }
    if (currentTag) {
        blogPosts = blogPosts.filter(p => p.tags && p.tags.includes(currentTag));
    }
    blogPosts.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return new Date(b.createdAt) - new Date(a.createdAt);
    });
    
    const recentPosts = blogPosts.slice(0, 10);
    
    const tagMap = new Map();
    posts.forEach(post => {
        if (post.tags && post.status === 'published') {
            post.tags.forEach(tag => tagMap.set(tag, (tagMap.get(tag) || 0) + 1));
        }
    });
    const tagCloudHtml = Array.from(tagMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([tag, count]) => {
        const size = Math.min(24, 12 + count * 2);
        return `<a href="/?tab=blog&tag=${encodeURIComponent(tag)}" style="display:inline-block;margin:4px;padding:4px 12px;background:#f0f0f0;border-radius:20px;text-decoration:none;color:#667eea;font-size:${size}px">#${escapeHtml(tag)} (${count})</a>`;
    }).join('');
    
    let blogListHtml = recentPosts.map(post => {
        const views = viewsMap.get(post.id) || 0;
        const excerptText = (post.excerpt || (post.content || '')).replace(/<[^>]*>/g, '').substring(0, 100);
        return `<div class="blog-card" onclick="location.href='/post/${post.id}'"><div style="display:flex;justify-content:space-between;gap:16px"><div style="flex:1"><h3 style="font-size:18px;margin-bottom:8px;color:#2d3748">${escapeHtml(post.title)}${post.pinned ? ' <span style="background:#fef3c7;color:#92400e;padding:2px 6px;border-radius:12px;font-size:11px;">📌置顶</span>' : ''}</h3><div style="display:flex;gap:16px;margin:8px 0;font-size:12px;color:#a0aec0"><span>📅 ${new Date(post.createdAt).toLocaleDateString()}</span><span>🏷️ ${escapeHtml(post.category || '未分类')}</span><span>👁️ ${views}阅读</span>${post.tags && post.tags.length ? `<span>🏷️ ${post.tags.map(t => '#' + escapeHtml(t)).join(' ')}</span>` : ''}</div><p style="color:#718096;line-height:1.5">${escapeHtml(excerptText)}...</p></div>${post.coverImage ? `<img src="${escapeHtml(post.coverImage)}" style="width:100px;height:80px;object-fit:cover;border-radius:8px">` : ''}</div></div>`;
    }).join('');
    if (!blogListHtml) blogListHtml = '<div style="text-align:center;padding:60px">暂无文章</div>';
    
    const hotPosts = [...posts.filter(p => p.status === 'published')].sort((a, b) => (viewsMap.get(b.id) || 0) - (viewsMap.get(a.id) || 0)).slice(0, 5);
    const hotPostsHtml = hotPosts.map(p => `<a href="/post/${p.id}" style="display:block;padding:8px 12px;margin:4px 0;border-radius:8px;text-decoration:none;color:#4a5568;font-size:13px;background:#f8fafc">🔥 ${escapeHtml(p.title.length > 20 ? p.title.substring(0,20)+'...' : p.title)} <span style="float:right;color:#a0aec0">${viewsMap.get(p.id) || 0}阅</span></a>`).join('');
    
    const siteTitle = await kv.get('site_title') || '旭儿导航';
    const siteSubtitle = await kv.get('site_subtitle') || '精选网站 · 优质博客';
    const logo = await kv.get('site_logo') || '';
    const logoLink = await kv.get('site_logo_link') || '';
    const headerBg = await kv.get('header_bg') || '';
    const cnLink = await kv.get('cn_link') || '';
    
    let logoHtml = '';
    if (logo) {
        logoHtml = logoLink ? `<a href="${escapeHtml(logoLink)}" target="_blank"><img src="${escapeHtml(logo)}" style="max-width:200px;max-height:240px"></a>` : `<img src="${escapeHtml(logo)}" style="max-width:200px;max-height:240px">`;
    } else {
        logoHtml = `<div style="font-size:28px;font-weight:bold;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent">${escapeHtml(siteTitle)}</div>`;
    }
    
    const titleName = currentTab === 'blog' ? (searchQuery ? `搜索: ${escapeHtml(searchQuery)}` : '博客文章') : (currentCat ? `${escapeHtml(currentCat)} · ${filteredSites.length}个网站` : `全部收藏 · ${sites.length}个网站`);
    
    return new Response(`<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>${escapeHtml(siteTitle)}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui;background:#f7fafc}.sidebar{position:fixed;left:0;top:0;width:280px;height:100vh;background:white;box-shadow:2px 0 12px rgba(0,0,0,0.05);overflow-y:auto}.sidebar-header{padding:20px;text-align:center;border-bottom:1px solid #e2e8f0}.sidebar-nav{padding:20px}.main{margin-left:280px}.header{position:relative;background:linear-gradient(135deg,#667eea,#764ba2);color:white;padding:50px 40px;text-align:left}.header-content{position:relative;z-index:2}.header h1{font-size:42px;margin-bottom:12px;display:inline-block;margin-right:20px}.cn-btn{display:inline-block;background:rgba(255,255,255,0.2);color:white;padding:8px 20px;border-radius:30px;text-decoration:none;font-size:16px;vertical-align:middle}.cn-btn:hover{background:rgba(255,255,255,0.3)}.content{max-width:1300px;margin:0 auto;padding:35px 30px}.content-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:25px}.tab-buttons{display:flex;gap:10px}.tab-btn{padding:8px 20px;border:none;border-radius:30px;cursor:pointer}.tab-btn.active{background:#667eea;color:white}.tab-btn:not(.active){background:#e2e8f0}.sites-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:24px}.site-card,.blog-card{background:white;border-radius:12px;padding:16px;margin-bottom:20px;cursor:pointer}.site-card:hover,.blog-card:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(0,0,0,0.1)}.search-box{margin-bottom:20px}.search-box input{width:100%;padding:12px 16px;border:1px solid #ddd;border-radius:30px}.tag-cloud{margin-bottom:20px;padding:15px;background:#f8fafc;border-radius:12px}.dark-mode-toggle{position:fixed;bottom:20px;right:20px;background:#667eea;color:white;border:none;width:50px;height:50px;border-radius:50%;cursor:pointer}.mobile-toggle{display:none;position:fixed;top:15px;left:15px;z-index:101;background:white;border:none;padding:10px;border-radius:10px;cursor:pointer}@media (max-width:768px){.sidebar{transform:translateX(-100%)}.sidebar.open{transform:translateX(0)}.main{margin-left:0}.mobile-toggle{display:block}.header h1{font-size:28px}}
</style></head>
<body><button class="mobile-toggle" id="mobileToggle">☰</button><div class="sidebar" id="sidebar"><div class="sidebar-header">${logoHtml}</div><div class="sidebar-nav"><a href="/?tab=blog" style="display:block;padding:10px;background:#e2e8f0;border-radius:8px;text-align:center;margin-bottom:15px;text-decoration:none;color:#667eea;font-weight:600">📝 博客列表</a><div style="font-weight:600;margin:15px 0 10px">📁 书签分类</div>${catNavHtml}<div style="font-weight:600;margin:20px 0 10px">🔥 热门文章</div>${hotPostsHtml}<div style="margin-top:20px;padding-top:15px;border-top:1px solid #e2e8f0"><a href="/admin" style="display:block;padding:10px;background:#edf2f7;border-radius:8px;text-align:center;text-decoration:none">⚙️ 后台管理</a></div></div></div><div class="main"><div class="header">${headerBg ? `<img style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover" src="${escapeHtml(headerBg)}">` : ''}<div class="header-content"><h1>${escapeHtml(siteTitle)}</h1>${cnLink ? `<a href="${escapeHtml(cnLink)}" class="cn-btn" target="_blank">🇨🇳 国内线路</a>` : ''}<p>${escapeHtml(siteSubtitle)}</p><div>📅 ${new Date().toLocaleDateString('zh-CN')}</div></div></div><div class="content"><div class="content-header"><h2>${titleName}</h2><div class="tab-buttons"><button class="tab-btn ${currentTab === 'blog' ? 'active' : ''}" data-tab="blog">📝 博客</button><button class="tab-btn ${currentTab === 'bookmark' ? 'active' : ''}" data-tab="bookmark">🔖 书签</button></div></div><div id="blog-view" style="display:${currentTab === 'blog' ? 'block' : 'none'}"><div class="search-box"><form id="searchForm" onsubmit="event.preventDefault();let u=new URL(location.href);u.searchParams.set('q',this.q.value);location.href=u"><input type="text" name="q" placeholder="🔍 搜索文章..." value="${escapeHtml(searchQuery)}"></form></div>${tagCloudHtml ? `<div class="tag-cloud"><strong>🏷️ 热门标签：</strong> ${tagCloudHtml}</div>` : ''}${blogListHtml}</div><div id="bookmark-view" style="display:${currentTab === 'bookmark' ? 'block' : 'none'}"><div class="sites-grid">${cardsHtml}</div></div></div></div><button class="dark-mode-toggle" id="darkModeToggle">🌙</button><button class="go-top" id="goTop">↑</button><script>document.getElementById('mobileToggle').onclick=()=>document.getElementById('sidebar').classList.toggle('open');document.querySelectorAll('.copy-btn').forEach(btn=>btn.onclick=e=>{e.preventDefault();navigator.clipboard.writeText(btn.dataset.url);btn.textContent='✓';setTimeout(()=>btn.textContent='复制',1000)});document.querySelectorAll('.tab-btn').forEach(btn=>btn.onclick=()=>{let u=new URL(location.href);u.searchParams.set('tab',btn.dataset.tab);u.searchParams.delete('c');u.searchParams.delete('q');u.searchParams.delete('tag');location.href=u});const darkToggle=document.getElementById('darkModeToggle');if(localStorage.getItem('darkMode')==='true')document.body.classList.add('dark');darkToggle.onclick=()=>{document.body.classList.toggle('dark');localStorage.setItem('darkMode',document.body.classList.contains('dark'));darkToggle.textContent=document.body.classList.contains('dark')?'☀️':'🌙'};const goTop=document.getElementById('goTop');window.onscroll=()=>goTop.style.display=window.scrollY>300?'block':'none';goTop.onclick=()=>window.scrollTo({top:0,behavior:'smooth'});</script></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

// ==================== 后台管理（简化版，确保能部署）====================
async function handleAdmin(request, kv) {
    const cookie = request.headers.get('Cookie') || '';
    const match = cookie.match(/admin_token=([^;]+)/);
    let isLoggedIn = false;
    if (match) {
        const session = await kv.get(`session:${match[1]}`);
        isLoggedIn = session !== null;
    }
    
    if (request.method === 'POST') {
        const form = await request.formData();
        const password = form.get('password');
        const adminPass = await kv.get('admin_password') || 'admin123';
        if (password === adminPass) {
            const token = crypto.randomUUID();
            await kv.put(`session:${token}`, 'active', { expirationTtl: 86400 });
            return new Response(null, { status: 302, headers: { 'Location': '/admin', 'Set-Cookie': `admin_token=${token}; Path=/; HttpOnly; Max-Age=86400` } });
        }
        return new Response('密码错误，<a href="/admin">返回</a>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    
    if (!isLoggedIn) {
        return new Response(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>管理员登录</title><style>body{font-family:system-ui;background:linear-gradient(135deg,#667eea,#764ba2);min-height:100vh;display:flex;justify-content:center;align-items:center}.box{background:#fff;padding:40px;border-radius:20px;width:320px;text-align:center}input,button{width:100%;padding:12px;margin:10px 0;border-radius:8px;border:1px solid #ddd}button{background:#667eea;color:#fff;border:none;cursor:pointer}</style></head><body><div class="box"><h2>🔐 管理员登录</h2><form method="post"><input type="password" name="password" placeholder="请输入密码" required><button type="submit">登录</button></form></div></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    
    let sites = [], posts = [];
    try {
        const sitesData = await kv.get('sites');
        if (sitesData) sites = JSON.parse(sitesData);
        const postsData = await kv.get('blog_posts');
        if (postsData) posts = JSON.parse(postsData);
    } catch(e) { }
    
    const siteTitle = await kv.get('site_title') || '';
    const siteSubtitle = await kv.get('site_subtitle') || '';
    const cnLink = await kv.get('cn_link') || '';
    
    return new Response(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>管理后台</title><style>
body{font-family:system-ui;background:#f0f2f5;padding:20px}.container{max-width:1200px;margin:0 auto}.card{background:white;border-radius:12px;padding:20px;margin-bottom:20px}.header{background:#667eea;color:white;padding:20px;border-radius:12px;margin-bottom:20px;display:flex;justify-content:space-between}button{padding:8px 16px;border:none;border-radius:6px;cursor:pointer}.btn-primary{background:#667eea;color:white}.btn-danger{background:#e53e3e;color:white}table{width:100%;border-collapse:collapse}th,td{padding:10px;text-align:left;border-bottom:1px solid #ddd}.form-group{margin-bottom:12px}.form-group input{width:100%;padding:8px;border:1px solid #ddd;border-radius:6px}
</style></head>
<body><div class="container"><div class="header"><h1>管理后台</h1><a href="/logout" style="color:white">退出登录</a></div>
<div class="card"><h3>📝 文章管理</h3><div><input type="text" id="postTitle" placeholder="标题"><textarea id="postContent" rows="4" placeholder="内容"></textarea><button id="publishBtn" class="btn-primary">发布文章</button></div><div id="postsList"></div></div>
<div class="card"><h3>🔖 书签管理</h3><div><input type="text" id="siteName" placeholder="名称"><input type="url" id="siteUrl" placeholder="网址"><input type="text" id="siteCat" placeholder="分类"><button id="addBookmarkBtn" class="btn-primary">添加</button></div><div id="sitesList"></div></div>
<div class="card"><h3>⚙️ 站点设置</h3><div class="form-group"><label>站点标题</label><input type="text" id="siteTitle" value="${escapeHtml(siteTitle)}"></div><div class="form-group"><label>站点副标题</label><input type="text" id="siteSubtitle" value="${escapeHtml(siteSubtitle)}"></div><div class="form-group"><label>国内线路链接</label><input type="url" id="cnLink" value="${escapeHtml(cnLink)}"></div><button id="saveSettingsBtn" class="btn-primary">保存设置</button></div></div>
<script>
const postsData = ${JSON.stringify(posts)};
const sitesData = ${JSON.stringify(sites)};
function escape(str){if(!str)return '';return String(str).replace(/[&<>]/g,function(m){if(m==='&')return'&amp;';if(m==='<')return'&lt;';if(m==='>')return'&gt;';return m;});}
function renderPosts(){document.getElementById('postsList').innerHTML = '<ul>' + postsData.map(p => '<li><strong>' + escape(p.title) + '</strong> - <button onclick="deletePost(' + p.id + ')">删除</button></li>').join('') + '</ul>';}
function renderSites(){document.getElementById('sitesList').innerHTML = '<ul>' + sitesData.map(s => '<li><strong>' + escape(s.name) + '</strong> - ' + escape(s.url) + ' - <button onclick="deleteSite(' + s.id + ')">删除</button></li>').join('') + '</ul>';}
async function publishPost(){let title=document.getElementById('postTitle').value;let content=document.getElementById('postContent').value;if(!title||!content){alert('请填写标题和内容');return;}let r=await fetch('/api/blog',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title,content})});if(r.ok)location.reload();}
async function addBookmark(){let name=document.getElementById('siteName').value;let url=document.getElementById('siteUrl').value;let catelog=document.getElementById('siteCat').value;if(!name||!url||!catelog){alert('请填写完整');return;}let r=await fetch('/api/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,url,catelog})});if(r.ok)location.reload();}
async function deletePost(id){if(confirm('确定删除？')){await fetch('/api/blog/'+id,{method:'DELETE'});location.reload();}}
async function deleteSite(id){if(confirm('确定删除？')){await fetch('/api/config/'+id,{method:'DELETE'});location.reload();}}
async function saveSettings(){let data={title:document.getElementById('siteTitle').value,subtitle:document.getElementById('siteSubtitle').value,cnLink:document.getElementById('cnLink').value};await fetch('/api/site-info',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});alert('保存成功');location.reload();}
document.getElementById('publishBtn').onclick=publishPost;
document.getElementById('addBookmarkBtn').onclick=addBookmark;
document.getElementById('saveSettingsBtn').onclick=saveSettings;
renderPosts();renderSites();
</script></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

// ==================== 文章详情页 ====================
async function handlePost(request, kv) {
    const url = new URL(request.url);
    const id = parseInt(url.pathname.split('/')[2]);
    if (isNaN(id)) return new Response('文章不存在', { status: 404 });
    let posts = [];
    try { const data = await kv.get('blog_posts'); if (data) posts = JSON.parse(data); } catch(e) { }
    const post = posts.find(p => p.id === id);
    if (!post || post.status !== 'published') return new Response('文章不存在', { status: 404 });
    let views = 0;
    try {
        const v = await kv.get(`views:${id}`);
        if (v) views = parseInt(v);
        views++;
        await kv.put(`views:${id}`, views.toString());
    } catch(e) { }
    return new Response(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${escapeHtml(post.title)} - 旭儿导航</title><style>body{font-family:system-ui;background:#f5f7fa;padding:20px}.container{max-width:800px;margin:0 auto}.article{background:white;border-radius:20px;padding:40px}h1{font-size:28px}.meta{color:#888;margin:15px 0}.content{line-height:1.8}.back-btn{display:inline-block;margin-top:30px;background:#667eea;color:white;padding:10px 20px;border-radius:30px;text-decoration:none}</style></head><body><div class="container"><div class="article"><h1>${escapeHtml(post.title)}</h1><div class="meta">📅 ${new Date(post.createdAt).toLocaleDateString()} | 👁️ ${views}阅读</div><div class="content">${post.content.replace(/\n/g, '<br>')}</div><a href="/" class="back-btn">← 返回首页</a></div></div></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

// ==================== API ====================
async function handleApi(request, kv) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // GET /api/config
    if (request.method === 'GET' && path === '/api/config') {
        let sites = [];
        try { const data = await kv.get('sites'); if (data) sites = JSON.parse(data); } catch(e) { }
        return new Response(JSON.stringify({ code: 200, data: sites }), { headers: { 'Content-Type': 'application/json' } });
    }
    // POST /api/config
    if (request.method === 'POST' && path === '/api/config') {
        const body = await request.json();
        let sites = [];
        try { const data = await kv.get('sites'); if (data) sites = JSON.parse(data); } catch(e) { }
        const newId = sites.length ? Math.max(...sites.map(s => s.id)) + 1 : 1;
        sites.push({ id: newId, name: body.name, url: body.url, catelog: body.catelog });
        await kv.put('sites', JSON.stringify(sites));
        return new Response(JSON.stringify({ code: 201 }), { headers: { 'Content-Type': 'application/json' } });
    }
    // DELETE /api/config/:id
    if (request.method === 'DELETE' && path.startsWith('/api/config/')) {
        const id = parseInt(path.split('/')[3]);
        let sites = [];
        try { const data = await kv.get('sites'); if (data) sites = JSON.parse(data); } catch(e) { }
        await kv.put('sites', JSON.stringify(sites.filter(s => s.id !== id)));
        return new Response(JSON.stringify({ code: 200 }), { headers: { 'Content-Type': 'application/json' } });
    }
    // GET /api/blog
    if (request.method === 'GET' && path === '/api/blog') {
        let posts = [];
        try { const data = await kv.get('blog_posts'); if (data) posts = JSON.parse(data); } catch(e) { }
        return new Response(JSON.stringify({ code: 200, data: posts }), { headers: { 'Content-Type': 'application/json' } });
    }
    // POST /api/blog
    if (request.method === 'POST' && path === '/api/blog') {
        const body = await request.json();
        let posts = [];
        try { const data = await kv.get('blog_posts'); if (data) posts = JSON.parse(data); } catch(e) { }
        const newPost = { id: Date.now(), title: body.title, content: body.content, category: body.category || '未分类', status: 'published', createdAt: new Date().toISOString() };
        posts.push(newPost);
        await kv.put('blog_posts', JSON.stringify(posts));
        return new Response(JSON.stringify({ code: 201 }), { headers: { 'Content-Type': 'application/json' } });
    }
    // DELETE /api/blog/:id
    if (request.method === 'DELETE' && path.startsWith('/api/blog/')) {
        const id = parseInt(path.split('/')[3]);
        let posts = [];
        try { const data = await kv.get('blog_posts'); if (data) posts = JSON.parse(data); } catch(e) { }
        await kv.put('blog_posts', JSON.stringify(posts.filter(p => p.id !== id)));
        return new Response(JSON.stringify({ code: 200 }), { headers: { 'Content-Type': 'application/json' } });
    }
    // GET /api/site-info
    if (request.method === 'GET' && path === '/api/site-info') {
        const title = await kv.get('site_title') || '';
        const subtitle = await kv.get('site_subtitle') || '';
        const cnLink = await kv.get('cn_link') || '';
        return new Response(JSON.stringify({ title, subtitle, cnLink }), { headers: { 'Content-Type': 'application/json' } });
    }
    // POST /api/site-info
    if (request.method === 'POST' && path === '/api/site-info') {
        const body = await request.json();
        if (body.title !== undefined) await kv.put('site_title', body.title);
        if (body.subtitle !== undefined) await kv.put('site_subtitle', body.subtitle);
        if (body.cnLink !== undefined) await kv.put('cn_link', body.cnLink);
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ code: 404 }), { status: 404 });
}

async function handleUpload(request, kv) {
    return new Response(JSON.stringify({ code: 400, message: '上传功能暂未开放' }), { headers: { 'Content-Type': 'application/json' } });
}

async function handleImage(request, kv) {
    return new Response('Not found', { status: 404 });
}

async function handleLogout(request, kv) {
    const cookie = request.headers.get('Cookie') || '';
    const match = cookie.match(/admin_token=([^;]+)/);
    if (match) await kv.delete(`session:${match[1]}`);
    return new Response(null, { status: 302, headers: { 'Location': '/', 'Set-Cookie': 'admin_token=; Path=/; HttpOnly; Max-Age=0' } });
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;');
}
