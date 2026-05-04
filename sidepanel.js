const STORAGE_KEY = 'arc_sidebar_tree';
const PINNED_KEY = 'arc_sidebar_pinned';
let tree = [];
let pinnedIds = [];
let draggedId = null;
let dragSource = null; // 'tree', 'pinned', 'tab'

const treeEl = document.getElementById('tree');
const pinnedGridEl = document.getElementById('pinned-grid');
const openTabsEl = document.getElementById('open-tabs');
const contextMenu = document.getElementById('context-menu');
let contextTarget = null;

// ── Data helpers ──
// Pure functions (normalizeUrl, faviconUrl, bareHost, urlKey, findNode,
// findParent, removeNode, isDescendant, setAllExpanded) live in lib.js.

function generateId() {
  return crypto.randomUUID();
}

function getList(parentId) {
  if (!parentId) return tree;
  const parent = findNode(tree, parentId);
  return parent?.children || tree;
}

// ── Tab focus ──

async function focusOrOpen(url) {
  const normalized = normalizeUrl(url);
  const targetKey = urlKey(normalized);
  const tabs = await chrome.tabs.query({});

  const match = tabs.find(t => urlKey(t.url) === targetKey);

  if (match) {
    await chrome.tabs.update(match.id, { active: true });
    await chrome.windows.update(match.windowId, { focused: true });
  } else {
    chrome.tabs.create({ url: normalized });
  }
}

// ── Persistence ──

function save() {
  chrome.storage.local.set({ [STORAGE_KEY]: tree, [PINNED_KEY]: pinnedIds });
}

async function load() {
  return new Promise(resolve => {
    chrome.storage.local.get([STORAGE_KEY, PINNED_KEY], result => {
      tree = result[STORAGE_KEY] || [];
      pinnedIds = result[PINNED_KEY] || [];
      // Clean stale pinned IDs
      pinnedIds = pinnedIds.filter(id => findNode(tree, id));
      resolve();
    });
  });
}

// ── Rendering ──

function render() {
  renderPinnedGrid();
  renderTree();
  renderOpenTabs();
}

function renderTree() {
  treeEl.innerHTML = '';
  if (tree.length === 0) {
    treeEl.innerHTML = `
      <div class="empty-state">
        <p>No links yet</p>
        <p class="hint">Click + to add the current tab<br>or create a folder to organize links</p>
      </div>`;
    return;
  }
  tree.forEach(node => treeEl.appendChild(renderNode(node, 0)));
}

// ── Pinned Grid ──

function renderPinnedGrid() {
  pinnedGridEl.innerHTML = '';
  for (const id of pinnedIds) {
    const node = findNode(tree, id);
    if (!node || node.type !== 'link') continue;

    const item = document.createElement('div');
    item.className = 'pinned-item';
    item.dataset.id = node.id;
    item.draggable = true;

    const fav = faviconUrl(node.url);
    item.innerHTML = `
      <img src="${fav || ''}" alt="">
      <span class="pinned-tooltip">${node.title}</span>
    `;

    item.addEventListener('click', () => focusOrOpen(node.url));
    item.addEventListener('contextmenu', e => {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY, node.id);
    });

    item.addEventListener('dragstart', e => {
      draggedId = node.id;
      dragSource = 'pinned';
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    item.addEventListener('dragend', () => {
      draggedId = null;
      dragSource = null;
      item.classList.remove('dragging');
    });

    pinnedGridEl.appendChild(item);
  }
}

// ── Open Tabs ──

async function renderOpenTabs() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  openTabsEl.innerHTML = '';

  for (const tab of tabs) {
    if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://')) continue;

    const row = document.createElement('div');
    row.className = 'tab-row';
    if (tab.active) row.classList.add('active');
    row.draggable = true;
    row.dataset.tabId = tab.id;

    const fav = tab.favIconUrl || faviconUrl(tab.url) || '';
    row.innerHTML = `
      <span class="icon"><img src="${fav}" alt=""></span>
      <span class="label">${tab.title || tab.url}</span>
    `;

    row.addEventListener('click', () => {
      chrome.tabs.update(tab.id, { active: true });
      chrome.windows.update(tab.windowId, { focused: true });
    });

    row.addEventListener('dragstart', e => {
      draggedId = `tab-${tab.id}`;
      dragSource = 'tab';
      row.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', JSON.stringify({
        title: tab.title || tab.url,
        url: tab.url,
      }));
    });

    row.addEventListener('dragend', () => {
      draggedId = null;
      dragSource = null;
      row.classList.remove('dragging');
      clearDropIndicators();
    });

    openTabsEl.appendChild(row);
  }
}

function renderNode(node, depth) {
  const container = document.createElement('div');
  container.className = 'node';
  container.dataset.id = node.id;

  const row = document.createElement('div');
  row.className = 'node-row';
  row.style.paddingLeft = `${10 + depth * 16}px`;
  row.draggable = true;
  row.dataset.id = node.id;

  // Chevron
  const chevron = document.createElement('span');
  chevron.className = 'chevron';
  if (node.type === 'folder') {
    chevron.classList.toggle('expanded', node.expanded !== false);
    chevron.innerHTML = '<svg width="10" height="10" viewBox="0 0 10 10"><path d="M3 1l4 4-4 4" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>';
  } else {
    chevron.classList.add('hidden');
  }
  row.appendChild(chevron);

  // Icon
  const icon = document.createElement('span');
  icon.className = 'icon';
  if (node.type === 'folder') {
    icon.classList.add('folder-icon');
    icon.innerHTML = '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M1 3.5A1.5 1.5 0 012.5 2h3.379a1.5 1.5 0 011.06.44l1.122 1.12A.5.5 0 008.415 3.7H13.5A1.5 1.5 0 0115 5.2v7.3a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 12.5v-9z"/></svg>';
  } else {
    const fav = faviconUrl(node.url);
    if (fav) {
      icon.innerHTML = `<img src="${fav}" alt="">`;
    } else {
      icon.innerHTML = '<svg viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="6" fill="#555"/></svg>';
    }
  }
  row.appendChild(icon);

  // Label
  const label = document.createElement('span');
  label.className = 'label';
  label.textContent = node.type === 'folder' ? node.name : node.title;
  row.appendChild(label);

  // Events
  row.addEventListener('click', e => {
    if (node.type === 'folder') {
      node.expanded = node.expanded === false ? true : !node.expanded;
      save();
      render();
    } else if (node.url) {
      focusOrOpen(node.url);
    }
  });

  row.addEventListener('contextmenu', e => {
    e.preventDefault();
    showContextMenu(e.clientX, e.clientY, node.id);
  });

  // Drag events
  row.addEventListener('dragstart', e => {
    draggedId = node.id;
    dragSource = 'tree';
    row.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });

  row.addEventListener('dragend', () => {
    draggedId = null;
    dragSource = null;
    row.classList.remove('dragging');
    clearDropIndicators();
  });

  row.addEventListener('dragover', e => {
    e.preventDefault();
    if (!draggedId) return;
    if (dragSource !== 'tab' && draggedId === node.id) return;
    e.dataTransfer.dropEffect = 'move';
    clearDropIndicators();

    const rect = row.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const third = rect.height / 3;

    if (node.type === 'folder' && y > third && y < third * 2) {
      row.classList.add('drop-inside');
    } else if (y < rect.height / 2) {
      row.classList.add('drop-above');
    } else {
      row.classList.add('drop-below');
    }
  });

  row.addEventListener('dragleave', () => {
    row.classList.remove('drop-above', 'drop-below', 'drop-inside');
  });

  row.addEventListener('drop', e => {
    e.preventDefault();
    clearDropIndicators();

    // Handle tab drop → create new link
    if (dragSource === 'tab') {
      let tabData;
      try { tabData = JSON.parse(e.dataTransfer.getData('text/plain')); } catch { return; }
      const newLink = { id: generateId(), type: 'link', title: tabData.title, url: tabData.url };

      const rect = row.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const third = rect.height / 3;

      if (node.type === 'folder' && y > third && y < third * 2) {
        if (!node.children) node.children = [];
        node.children.push(newLink);
        node.expanded = true;
      } else {
        const parent = findParent(tree, node.id);
        const list = parent ? parent.children : tree;
        const idx = list.findIndex(n => n.id === node.id);
        if (y < rect.height / 2) {
          list.splice(idx, 0, newLink);
        } else {
          list.splice(idx + 1, 0, newLink);
        }
      }
      save();
      render();
      return;
    }

    if (!draggedId || draggedId === node.id) return;

    // Prevent dropping a folder into its own descendant
    const draggedNode = findNode(tree, draggedId);
    if (draggedNode?.type === 'folder' && isDescendant(draggedNode, node.id)) return;

    const removed = removeNode(tree, draggedId);
    if (!removed) return;

    const rect = row.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const third = rect.height / 3;

    if (node.type === 'folder' && y > third && y < third * 2) {
      if (!node.children) node.children = [];
      node.children.push(removed);
      node.expanded = true;
    } else {
      const parent = findParent(tree, node.id);
      const list = parent ? parent.children : tree;
      const idx = list.findIndex(n => n.id === node.id);
      if (y < rect.height / 2) {
        list.splice(idx, 0, removed);
      } else {
        list.splice(idx + 1, 0, removed);
      }
    }

    save();
    render();
  });

  container.appendChild(row);

  // Children
  if (node.type === 'folder' && node.children) {
    const childrenEl = document.createElement('div');
    childrenEl.className = `node-children${node.expanded === false ? ' collapsed' : ''}`;
    node.children.forEach(child => childrenEl.appendChild(renderNode(child, depth + 1)));
    container.appendChild(childrenEl);
  }

  return container;
}

function clearDropIndicators() {
  document.querySelectorAll('.drop-above, .drop-below, .drop-inside').forEach(el => {
    el.classList.remove('drop-above', 'drop-below', 'drop-inside');
  });
}

// ── Context Menu ──

function showContextMenu(x, y, nodeId) {
  contextTarget = nodeId;
  const node = findNode(tree, nodeId);
  const isPinned = pinnedIds.includes(nodeId);

  contextMenu.querySelector('[data-action="pin"]').style.display =
    node?.type === 'link' && !isPinned ? 'block' : 'none';
  contextMenu.querySelector('[data-action="unpin"]').style.display =
    node?.type === 'link' && isPinned ? 'block' : 'none';
  contextMenu.querySelector('[data-action="edit-link"]').style.display =
    node?.type === 'link' ? 'block' : 'none';
  contextMenu.querySelector('[data-action="edit-folder"]').style.display =
    node?.type === 'folder' ? 'block' : 'none';
  contextMenu.querySelector('[data-action="add-subfolder"]').style.display =
    node?.type === 'folder' ? 'block' : 'none';
  contextMenu.querySelector('[data-action="add-link"]').style.display =
    node?.type === 'folder' ? 'block' : 'none';

  contextMenu.style.left = `${x}px`;
  contextMenu.style.top = `${y}px`;
  contextMenu.classList.remove('hidden');

  const rect = contextMenu.getBoundingClientRect();
  if (rect.bottom > window.innerHeight) {
    contextMenu.style.top = `${window.innerHeight - rect.height - 4}px`;
  }
  if (rect.right > window.innerWidth) {
    contextMenu.style.left = `${window.innerWidth - rect.width - 4}px`;
  }
}

function hideContextMenu() {
  contextMenu.classList.add('hidden');
  contextTarget = null;
}

document.addEventListener('click', e => {
  if (!contextMenu.contains(e.target)) hideContextMenu();
});

contextMenu.addEventListener('click', async e => {
  const action = e.target.dataset.action;
  if (!action || !contextTarget) return;

  const node = findNode(tree, contextTarget);
  if (!node) { hideContextMenu(); return; }

  switch (action) {
    case 'pin':
      if (node.type === 'link' && !pinnedIds.includes(node.id)) {
        pinnedIds.push(node.id);
        save();
        render();
      }
      hideContextMenu();
      break;

    case 'unpin':
      pinnedIds = pinnedIds.filter(id => id !== node.id);
      save();
      render();
      hideContextMenu();
      break;

    case 'edit-link':
      hideContextMenu();
      showEditLinkForm(node);
      return;

    case 'edit-folder':
      hideContextMenu();
      startInlineEdit(contextTarget, 'name');
      break;

    case 'add-subfolder':
      if (node.type === 'folder') {
        if (!node.children) node.children = [];
        const newFolder = { id: generateId(), type: 'folder', name: 'New folder', children: [], expanded: true };
        node.children.push(newFolder);
        node.expanded = true;
        save();
        render();
        startInlineEdit(newFolder.id);
      }
      hideContextMenu();
      break;

    case 'add-link':
      if (node.type === 'folder') {
        hideContextMenu();
        showAddLinkForm(node);
        return;
      }
      hideContextMenu();
      break;

    case 'delete':
      pinnedIds = pinnedIds.filter(id => id !== contextTarget);
      removeNode(tree, contextTarget);
      save();
      render();
      hideContextMenu();
      break;
  }
});

function startInlineEdit(nodeId, field = 'name') {
  const row = document.querySelector(`.node-row[data-id="${nodeId}"]`);
  if (!row) return;
  const label = row.querySelector('.label');
  const node = findNode(tree, nodeId);
  if (!label || !node) return;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'label-input';

  if (field === 'url' && node.type === 'link') {
    input.value = node.url || '';
    input.placeholder = 'https://...';
  } else {
    input.value = node.type === 'folder' ? node.name : node.title;
  }

  const finish = () => {
    const val = input.value.trim();
    if (val) {
      if (field === 'url' && node.type === 'link') {
        node.url = normalizeUrl(val);
      } else if (node.type === 'folder') {
        node.name = val;
      } else {
        node.title = val;
      }
      save();
    }
    render();
  };

  input.addEventListener('blur', finish);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') finish();
    if (e.key === 'Escape') render();
  });

  label.replaceWith(input);
  input.focus();
  input.select();
}

// ── Header buttons ──

document.getElementById('btn-add-folder').addEventListener('click', () => {
  const newFolder = { id: generateId(), type: 'folder', name: 'New folder', children: [], expanded: true };
  tree.push(newFolder);
  save();
  render();
  startInlineEdit(newFolder.id);
});

document.getElementById('btn-add-link').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    tree.push({
      id: generateId(),
      type: 'link',
      title: tab.title || tab.url,
      url: tab.url,
    });
    save();
    render();
  }
});

// ── Fold all ──

document.getElementById('btn-fold-all').addEventListener('click', () => {
  const anyExpanded = tree.some(function check(n) {
    return n.type === 'folder' && (n.expanded !== false || (n.children || []).some(check));
  });
  setAllExpanded(tree, !anyExpanded);
  save();
  render();
});

// ── Export / Import ──

document.getElementById('btn-export').addEventListener('click', () => {
  const data = { tree, pinnedIds };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'arcsider-backup.json';
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('btn-import').addEventListener('click', () => {
  document.getElementById('import-file').click();
});

document.getElementById('import-file').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (Array.isArray(imported)) {
        tree = imported;
        pinnedIds = [];
      } else if (imported.tree) {
        tree = imported.tree;
        pinnedIds = imported.pinnedIds || [];
      } else {
        throw new Error('Invalid format');
      }
      save();
      render();
    } catch {
      alert('Invalid Arcsider JSON file');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});

// ── Import from Arc Browser ──

function parseArcSidebar(arcData) {
  const containers = arcData.sidebar?.containers || [];

  const items = {};
  const spaces = [];
  for (const c of containers) {
    if (c?.items) {
      for (const item of c.items) {
        if (item?.id) items[item.id] = item;
      }
    }
    if (c?.spaces) {
      for (const s of c.spaces) {
        if (s?.title) spaces.push(s);
      }
    }
  }

  return { items, spaces };
}

function convertArcNode(itemId, items, depth = 0) {
  const item = items[itemId];
  if (!item) return null;

  const childrenIds = item.childrenIds || [];
  const tabData = item.data?.tab || {};
  const title = item.title || tabData.savedTitle || 'Untitled';
  const url = tabData.savedURL || '';

  if (childrenIds.length > 0) {
    const children = [];
    for (const cid of childrenIds) {
      if (typeof cid === 'string') {
        const child = convertArcNode(cid, items, depth + 1);
        if (child) children.push(child);
      }
    }
    return { id: generateId(), type: 'folder', name: title, expanded: depth < 2, children };
  } else if (url) {
    return { id: generateId(), type: 'link', title, url };
  }
  return null;
}

function convertArcSpace(space, items, pinnedOnly) {
  const containerIds = space.containerIDs || [];
  const result = [];
  const arcPinnedIds = [];
  let section = null;

  for (const cid of containerIds) {
    if (cid === 'pinned') { section = 'pinned'; continue; }
    if (cid === 'unpinned') { section = 'unpinned'; continue; }
    if (pinnedOnly && section !== 'pinned') continue;

    const container = items[cid];
    if (!container) continue;
    for (const childId of (container.childrenIds || [])) {
      if (typeof childId === 'string') {
        const node = convertArcNode(childId, items);
        if (node) {
          result.push(node);
          if (section === 'pinned' && node.type === 'link') {
            arcPinnedIds.push(node.id);
          }
        }
      }
    }
  }
  return { items: result, arcPinnedIds };
}

function showArcImportForm(arcData) {
  const { items, spaces } = parseArcSidebar(arcData);

  let overlay = document.getElementById('form-overlay');
  if (overlay) overlay.remove();

  const spaceOptions = spaces.map(s =>
    `<label class="form-checkbox"><input type="checkbox" value="${s.title}" checked> ${s.title}</label>`
  ).join('');

  overlay = document.createElement('div');
  overlay.id = 'form-overlay';
  overlay.className = 'form-overlay';
  overlay.innerHTML = `
    <div class="form-dialog">
      <div class="form-title">Import from Arc Browser</div>
      <label class="form-label">Spaces to import</label>
      <div class="form-checkboxes">${spaceOptions}</div>
      <label class="form-checkbox" style="margin-top:8px">
        <input type="checkbox" id="arc-pinned-only"> Pinned only
      </label>
      <label class="form-checkbox">
        <input type="checkbox" id="arc-auto-pin" checked> Auto-pin Arc's pinned links
      </label>
      <label class="form-checkbox">
        <input type="checkbox" id="arc-replace"> Replace current data
      </label>
      <div class="form-buttons">
        <button id="form-cancel" class="form-btn form-btn-cancel">Cancel</button>
        <button id="form-save" class="form-btn form-btn-save">Import</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();

  document.getElementById('form-cancel').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  document.getElementById('form-save').addEventListener('click', () => {
    const selectedSpaces = [...overlay.querySelectorAll('.form-checkboxes input:checked')]
      .map(cb => cb.value);
    const pinnedOnly = document.getElementById('arc-pinned-only').checked;
    const autoPin = document.getElementById('arc-auto-pin').checked;
    const replace = document.getElementById('arc-replace').checked;

    const selectedData = [];
    let allArcPinnedIds = [];
    for (const space of spaces) {
      if (!selectedSpaces.includes(space.title)) continue;
      const { items: spaceItems, arcPinnedIds: spacePinned } = convertArcSpace(space, items, pinnedOnly);
      if (spaceItems.length === 0) continue;
      selectedData.push({ title: space.title, items: spaceItems });
      allArcPinnedIds.push(...spacePinned);
    }

    let imported;
    if (selectedData.length === 1) {
      imported = selectedData[0].items;
    } else {
      imported = selectedData.map(s => ({
        id: generateId(),
        type: 'folder',
        name: s.title,
        expanded: true,
        children: s.items,
      }));
    }

    if (replace) {
      tree = imported;
      pinnedIds = autoPin ? allArcPinnedIds : [];
    } else {
      tree.push(...imported);
      if (autoPin) pinnedIds.push(...allArcPinnedIds);
    }

    save();
    render();
    close();
  });
}

document.getElementById('btn-import-arc').addEventListener('click', () => {
  let overlay = document.getElementById('form-overlay');
  if (overlay) overlay.remove();

  const arcPath = '~/Library/Application Support/Arc/StorableSidebar.json';

  overlay = document.createElement('div');
  overlay.id = 'form-overlay';
  overlay.className = 'form-overlay';
  overlay.innerHTML = `
    <div class="form-dialog">
      <div class="form-title">Import from Arc Browser</div>
      <p class="form-hint">In the Finder dialog, press <strong>Cmd+Shift+G</strong> and paste the path below:</p>
      <div class="form-path-row">
        <code class="form-path">${arcPath}</code>
        <button id="arc-copy-path" class="form-btn form-btn-cancel" style="padding:4px 8px;font-size:12px">Copy</button>
      </div>
      <div class="form-buttons" style="margin-top:12px">
        <button id="form-cancel" class="form-btn form-btn-cancel">Cancel</button>
        <button id="arc-select-file" class="form-btn form-btn-save">Select file</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  document.getElementById('form-cancel').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  document.getElementById('arc-copy-path').addEventListener('click', () => {
    navigator.clipboard.writeText(arcPath);
    document.getElementById('arc-copy-path').textContent = 'Copied!';
    setTimeout(() => { document.getElementById('arc-copy-path').textContent = 'Copy'; }, 1500);
  });

  document.getElementById('arc-select-file').addEventListener('click', () => {
    close();
    document.getElementById('import-arc-file').click();
  });
});

document.getElementById('import-arc-file').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const arcData = JSON.parse(reader.result);
      if (!arcData.sidebar?.containers) throw new Error('Not an Arc sidebar file');
      showArcImportForm(arcData);
    } catch (err) {
      alert('Invalid Arc StorableSidebar.json file');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});

// ── Drop on empty tree area ──

treeEl.addEventListener('dragover', e => {
  if (!draggedId) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
});

treeEl.addEventListener('drop', e => {
  if (!draggedId) return;
  if (e.target !== treeEl) return;
  e.preventDefault();

  if (dragSource === 'tab') {
    let tabData;
    try { tabData = JSON.parse(e.dataTransfer.getData('text/plain')); } catch { return; }
    tree.push({ id: generateId(), type: 'link', title: tabData.title, url: tabData.url });
    save();
    render();
    return;
  }

  const removed = removeNode(tree, draggedId);
  if (removed) {
    tree.push(removed);
    save();
    render();
  }
});

// ── Tab change listeners ──

chrome.tabs.onUpdated.addListener(() => renderOpenTabs());
chrome.tabs.onRemoved.addListener(() => renderOpenTabs());
chrome.tabs.onActivated.addListener(() => renderOpenTabs());

// ── Edit Link Form ──

function showEditLinkForm(node) {
  let overlay = document.getElementById('form-overlay');
  if (overlay) overlay.remove();

  overlay = document.createElement('div');
  overlay.id = 'form-overlay';
  overlay.className = 'form-overlay';
  overlay.innerHTML = `
    <div class="form-dialog">
      <div class="form-title">Edit link</div>
      <label class="form-label">Name</label>
      <input type="text" id="form-edit-name" class="form-input" value="${node.title.replace(/"/g, '&quot;')}">
      <label class="form-label">URL</label>
      <input type="text" id="form-edit-url" class="form-input" value="${(node.url || '').replace(/"/g, '&quot;')}">
      <div class="form-buttons">
        <button id="form-cancel" class="form-btn form-btn-cancel">Cancel</button>
        <button id="form-save" class="form-btn form-btn-save">Save</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const nameInput = document.getElementById('form-edit-name');
  const urlInput = document.getElementById('form-edit-url');
  nameInput.focus();
  nameInput.select();

  const close = () => overlay.remove();

  const submit = () => {
    const name = nameInput.value.trim();
    const url = normalizeUrl(urlInput.value.trim());
    if (!name || !url) return;
    node.title = name;
    node.url = url;
    save();
    render();
    close();
  };

  document.getElementById('form-cancel').addEventListener('click', close);
  document.getElementById('form-save').addEventListener('click', submit);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  nameInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') urlInput.focus();
    if (e.key === 'Escape') close();
  });
  urlInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') submit();
    if (e.key === 'Escape') close();
  });
}

// ── Add Link Form ──

function showAddLinkForm(parentNode) {
  let overlay = document.getElementById('form-overlay');
  if (overlay) overlay.remove();

  overlay = document.createElement('div');
  overlay.id = 'form-overlay';
  overlay.className = 'form-overlay';
  overlay.innerHTML = `
    <div class="form-dialog">
      <div class="form-title">Add link to "${parentNode.name}"</div>
      <input type="text" id="form-link-name" class="form-input" placeholder="Name" autofocus>
      <input type="text" id="form-link-url" class="form-input" placeholder="https://...">
      <div class="form-buttons">
        <button id="form-cancel" class="form-btn form-btn-cancel">Cancel</button>
        <button id="form-save" class="form-btn form-btn-save">Add</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const nameInput = document.getElementById('form-link-name');
  const urlInput = document.getElementById('form-link-url');

  // Pre-fill with current tab
  chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
    if (tab && !nameInput.value) {
      nameInput.value = tab.title || '';
      urlInput.value = tab.url || '';
      nameInput.select();
    }
  });

  const close = () => overlay.remove();

  const submit = () => {
    const name = nameInput.value.trim();
    const url = normalizeUrl(urlInput.value.trim());
    if (!name || !url) return;
    if (!parentNode.children) parentNode.children = [];
    parentNode.children.push({
      id: generateId(),
      type: 'link',
      title: name,
      url,
    });
    parentNode.expanded = true;
    save();
    render();
    close();
  };

  document.getElementById('form-cancel').addEventListener('click', close);
  document.getElementById('form-save').addEventListener('click', submit);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
  nameInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') urlInput.focus();
    if (e.key === 'Escape') close();
  });
  urlInput.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
}

// ── Init ──

load().then(render);
