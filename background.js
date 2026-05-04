const STORAGE_KEY = 'arc_sidebar_tree';

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// ── Context Menu ──

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const menuId = info.menuItemId;

  // Open side panel first
  await chrome.sidePanel.open({ windowId: tab.windowId });

  if (menuId === 'add-page') {
    const url = info.linkUrl || info.pageUrl;
    const title = tab?.title || url;
    chrome.runtime.sendMessage({ action: 'show-add-form', type: 'link', title, url });
  } else if (menuId === 'add-folder') {
    chrome.runtime.sendMessage({ action: 'show-add-form', type: 'folder' });
  }
});

function buildMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'arcsider-root',
      title: 'Add to Arcsider',
      contexts: ['page', 'link'],
    });

    chrome.contextMenus.create({
      id: 'add-page',
      parentId: 'arcsider-root',
      title: 'Add current page...',
      contexts: ['page', 'link'],
    });

    chrome.contextMenus.create({
      id: 'add-folder',
      parentId: 'arcsider-root',
      title: 'Add folder...',
      contexts: ['page', 'link'],
    });
  });
}

chrome.runtime.onInstalled.addListener(buildMenu);
chrome.runtime.onStartup.addListener(buildMenu);
