// 在 nav/static/admin.js 中创建
document.addEventListener('DOMContentLoaded', function() {
  // 创建拖拽排序区域
  const sortableSection = document.createElement('div');
  sortableSection.className = 'sortable-section';
  sortableSection.innerHTML = `
    <div class="flex items-center justify-between mb-6">
      <div>
        <h3 class="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-1">✨ 拖拽排序书签</h3>
        <p class="text-blue-100 text-sm">拖动卡片柄调整顺序，保存后前台立即生效</p>
      </div>
      <button id="saveOrderBtn" class="px-6 py-3 rounded-xl font-semibold shadow-lg flex items-center space-x-2">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
        <span>保存排序</span>
      </button>
    </div>
    <div id="sortableContainer" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 min-h-[400px]"></div>
  `;
  
  // 插入到书签列表标签页
  const configTab = document.getElementById('config');
  configTab.insertBefore(sortableSection, configTab.firstChild);
  
  let allSites = [];
  
  // 加载所有书签
  async function loadSites() {
    try {
      const res = await fetch('/api/config?pageSize=1000');
      const data = await res.json();
      if (data.code === 200) {
        allSites = data.data;
        renderCards();
        initDragDrop();
      }
    } catch (err) {
      showMessage('加载失败: ' + err.message, 'error');
    }
  }
  
  function renderCards() {
    const container = document.getElementById('sortableContainer');
    container.innerHTML = allSites.map((site, index) => {
      const logo = site.logo ? 
        `<img src="${site.logo}" alt="${site.name}" class="w-16 h-16 rounded-2xl object-cover shadow-xl">` :
        `<div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl shadow-xl">${site.name.charAt(0)}</div>`;
      
      return `
        <div class="sortable-card group" draggable="true" data-id="${site.id}" data-index="${index}">
          <div class="flex items-start space-x-4">
            <div class="drag-handle" title="拖拽排序">
              <svg class="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16"></path>
              </svg>
            </div>
            <div class="flex-1">
              <h4 class="font-bold text-xl text-gray-900 mb-2 truncate">${site.name}</h4>
              <span class="inline-flex px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-blue-500 to-purple-500 text-white">${site.catelog}</span>
              <p class="text-sm text-gray-600 mt-2 line-clamp-2">${site.desc || '优质网站'}</p>
              <div class="flex items-center justify-between mt-3 pt-2 border-t">
                <span class="text-xs text-gray-500 truncate">${site.url.replace(/^https?:\/\//, '')}</span>
                <a href="${site.url}" target="_blank" class="text-blue-500 hover:text-blue-700 text-sm font-medium">🌐 访问</a>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }
  
  let draggedElement = null;
  
  function initDragDrop() {
    document.querySelectorAll('.sortable-card').forEach(card => {
      card.addEventListener('dragstart', e => {
        draggedElement = card;
        card.classList.add('dragging');
      });
      
      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        document.querySelectorAll('.sortable-card').forEach(c => c.classList.remove('drag-over'));
      });
      
      card.addEventListener('dragover', e => e.preventDefault());
      card.addEventListener('dragenter', () => card.classList.add('drag-over'));
      card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
      
      card.addEventListener('drop', function(e) {
        e.preventDefault();
        if (draggedElement !== this) {
          const container = document.getElementById('sortableContainer');
          container.insertBefore(draggedElement, this);
          
          // 更新数据顺序
          const cards = Array.from(container.querySelectorAll('.sortable-card'));
          allSites = cards.map(card => allSites.find(site => site.id == card.dataset.id));
          
          // 更新索引
          cards.forEach((card, index) => card.dataset.index = index);
        }
        this.classList.remove('drag-over');
      });
    });
  }
  
  // 保存排序
  document.addEventListener('click', e => {
    if (e.target.closest('#saveOrderBtn')) {
      const container = document.getElementById('sortableContainer');
      const orderMap = {};
      Array.from(container.children).forEach((card, index) => {
        orderMap[card.dataset.id] = index;
      });
      
      fetch('/api/config/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: orderMap })
      })
      .then(res => res.json())
      .then(data => {
        if (data.code === 200) {
          showMessage('🎉 排序保存成功！', 'success');
        } else {
          showMessage('保存失败: ' + data.message, 'error');
        }
      })
      .catch(() => showMessage('网络错误', 'error'));
    }
  });
  
  function showMessage(msg, type) {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = msg;
    messageDiv.className = type;
    messageDiv.style.display = 'block';
    setTimeout(() => messageDiv.style.display = 'none', 4000);
  }
  
  // 启动
  loadSites();
});
