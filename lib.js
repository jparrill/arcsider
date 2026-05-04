// Pure utility functions — no DOM or chrome.* dependencies.
// Loaded as a <script> in the browser and as CommonJS in tests.

function normalizeUrl(url) {
  if (!url) return url;
  if (!/^https?:\/\//i.test(url)) return `https://${url}`;
  return url;
}

function faviconUrl(url) {
  try {
    const hostname = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
  } catch {
    return null;
  }
}

function bareHost(hostname) {
  return hostname.replace(/^www\./, '');
}

function urlKey(raw) {
  try {
    const u = new URL(raw);
    return (u.origin + u.pathname).replace(/\/+$/, '');
  } catch { return raw; }
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

function findParent(nodes, id, parent = null) {
  for (const node of nodes) {
    if (node.id === id) return parent;
    if (node.children) {
      const found = findParent(node.children, id, node);
      if (found !== undefined) return found;
    }
  }
  return undefined;
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

function isDescendant(folder, targetId) {
  if (!folder.children) return false;
  for (const child of folder.children) {
    if (child.id === targetId) return true;
    if (child.type === 'folder' && isDescendant(child, targetId)) return true;
  }
  return false;
}

function setAllExpanded(nodes, expanded) {
  for (const node of nodes) {
    if (node.type === 'folder') {
      node.expanded = expanded;
      if (node.children) setAllExpanded(node.children, expanded);
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { normalizeUrl, faviconUrl, bareHost, urlKey, findNode, findParent, removeNode, isDescendant, setAllExpanded };
}
