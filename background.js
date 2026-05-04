const STORAGE_KEY = 'arc_sidebar_tree';

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// ── Helpers ──

function collectFolders(nodes, path = '') {
  const folders = [];
  for (const node of nodes) {
    if (node.type === 'folder') {
      const label = path ? `${path} / ${node.name}` : node.name;
      folders.push({ id: node.id, label });
      if (node.children) {
        folders.push(...collectFolders(node.children, label));
      }
    }
  }
  return folders;
}

function findNode(nodes, id) {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNode(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

function removeNode(nodes, id) {
  const idx = nodes.findIndex(n => n.id === id);
  if (idx !== -1) return nodes.splice(idx, 1)[0];
  for (const node of nodes) {
    if (node.children) {
      const removed = removeNode(node.children, id);
      if (removed) return removed;
    }
  }
  return null;
}

// ── Context Menu Build ──

async function rebuildContextMenu() {
  await chrome.contextMenus.removeAll();

  const result = await chrome.storage.local.get([STORAGE_KEY]);
  const tree = result[STORAGE_KEY] || [];
  const folders = collectFolders(tree);

  // ── Page/Link context menu: "Add to Arcsider" ──
  chrome.contextMenus.create({
    id: 'arc-sidebar-root',
    title: 'Add to Arcsider',
    contexts: ['page', 'link'],
  });

  chrome.contextMenus.create({
    id: 'add-to-root',
    parentId: 'arc-sidebar-root',
    title: '(Top level)',
    contexts: ['page', 'link'],
  });

  if (folders.length > 0) {
    chrome.contextMenus.create({
      id: 'page-separator',
      parentId: 'arc-sidebar-root',
      type: 'separator',
      contexts: ['page', 'link'],
    });

    for (const folder of folders) {
      chrome.contextMenus.create({
        id: `folder-${folder.id}`,
        parentId: 'arc-sidebar-root',
        title: folder.label,
        contexts: ['page', 'link'],
      });
    }
  }

  // ── Toolbar icon context menu ──
  chrome.contextMenus.create({
    id: 'action-new-folder',
    title: 'New folder',
    contexts: ['action'],
  });

  chrome.contextMenus.create({
    id: 'action-add-page',
    title: 'Add current page',
    contexts: ['action'],
  });

  if (folders.length > 0) {
    // Subfolder submenu
    chrome.contextMenus.create({
      id: 'action-subfolder-root',
      title: 'New subfolder in...',
      contexts: ['action'],
    });

    for (const folder of folders) {
      chrome.contextMenus.create({
        id: `action-subfolder-${folder.id}`,
        parentId: 'action-subfolder-root',
        title: folder.label,
        contexts: ['action'],
      });
    }

    // Delete submenu
    chrome.contextMenus.create({
      id: 'action-sep',
      type: 'separator',
      contexts: ['action'],
    });

    chrome.contextMenus.create({
      id: 'action-delete-root',
      title: 'Delete...',
      contexts: ['action'],
    });

    for (const folder of folders) {
      chrome.contextMenus.create({
        id: `action-delete-${folder.id}`,
        parentId: 'action-delete-root',
        title: folder.label,
        contexts: ['action'],
      });
    }
  }
}

// ── Context Menu Handlers ──

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const menuId = typeof info.menuItemId === 'string' ? info.menuItemId : '';
  const result = await chrome.storage.local.get([STORAGE_KEY]);
  const tree = result[STORAGE_KEY] || [];

  // ── Page/link: add to sidebar ──
  if (menuId === 'add-to-root' || menuId.startsWith('folder-')) {
    const url = info.linkUrl || info.pageUrl;
    const title = tab?.title || url;
    const newLink = { id: crypto.randomUUID(), type: 'link', title, url };

    if (menuId === 'add-to-root') {
      tree.push(newLink);
    } else {
      const folderId = menuId.replace('folder-', '');
      const folder = findNode(tree, folderId);
      if (folder) {
        if (!folder.children) folder.children = [];
        folder.children.push(newLink);
      } else {
        tree.push(newLink);
      }
    }
    await chrome.storage.local.set({ [STORAGE_KEY]: tree });
    return;
  }

  // ── Toolbar: new folder at root ──
  if (menuId === 'action-new-folder') {
    tree.push({
      id: crypto.randomUUID(),
      type: 'folder',
      name: 'New folder',
      children: [],
      expanded: true,
    });
    await chrome.storage.local.set({ [STORAGE_KEY]: tree });
    return;
  }

  // ── Toolbar: add current page to root ──
  if (menuId === 'action-add-page') {
    if (tab) {
      tree.push({
        id: crypto.randomUUID(),
        type: 'link',
        title: tab.title || tab.url,
        url: tab.url,
      });
      await chrome.storage.local.set({ [STORAGE_KEY]: tree });
    }
    return;
  }

  // ── Toolbar: new subfolder inside a folder ──
  if (menuId.startsWith('action-subfolder-')) {
    const folderId = menuId.replace('action-subfolder-', '');
    const folder = findNode(tree, folderId);
    if (folder) {
      if (!folder.children) folder.children = [];
      folder.children.push({
        id: crypto.randomUUID(),
        type: 'folder',
        name: 'New subfolder',
        children: [],
        expanded: true,
      });
      folder.expanded = true;
      await chrome.storage.local.set({ [STORAGE_KEY]: tree });
    }
    return;
  }

  // ── Toolbar: delete folder ──
  if (menuId.startsWith('action-delete-')) {
    const folderId = menuId.replace('action-delete-', '');
    removeNode(tree, folderId);
    await chrome.storage.local.set({ [STORAGE_KEY]: tree });
    return;
  }
});

// Rebuild menu when storage changes
chrome.storage.onChanged.addListener((changes) => {
  if (changes[STORAGE_KEY]) rebuildContextMenu();
});

// Build menu on startup
chrome.runtime.onInstalled.addListener(rebuildContextMenu);
chrome.runtime.onStartup.addListener(rebuildContextMenu);
