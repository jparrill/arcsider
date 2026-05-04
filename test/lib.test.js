const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeUrl, faviconUrl, bareHost, urlKey,
  findNode, findParent, removeNode, isDescendant, setAllExpanded,
} = require('../lib.js');

// ── normalizeUrl ──

describe('normalizeUrl', () => {
  it('prepends https:// when missing', () => {
    assert.equal(normalizeUrl('google.com'), 'https://google.com');
  });

  it('leaves http:// URLs unchanged', () => {
    assert.equal(normalizeUrl('http://example.com'), 'http://example.com');
  });

  it('leaves https:// URLs unchanged', () => {
    assert.equal(normalizeUrl('https://example.com'), 'https://example.com');
  });

  it('returns falsy values as-is', () => {
    assert.equal(normalizeUrl(''), '');
    assert.equal(normalizeUrl(null), null);
    assert.equal(normalizeUrl(undefined), undefined);
  });
});

// ── faviconUrl ──

describe('faviconUrl', () => {
  it('returns google favicon service URL', () => {
    assert.equal(
      faviconUrl('https://github.com/org/repo'),
      'https://www.google.com/s2/favicons?domain=github.com&sz=32'
    );
  });

  it('returns null for invalid URLs', () => {
    assert.equal(faviconUrl('not-a-url'), null);
  });
});

// ── bareHost ──

describe('bareHost', () => {
  it('strips www. prefix', () => {
    assert.equal(bareHost('www.google.com'), 'google.com');
  });

  it('leaves non-www hosts unchanged', () => {
    assert.equal(bareHost('github.com'), 'github.com');
  });
});

// ── urlKey ──

describe('urlKey', () => {
  it('returns origin + pathname without trailing slash', () => {
    assert.equal(urlKey('https://github.com/org/repo/'), 'https://github.com/org/repo');
  });

  it('strips query params and hash', () => {
    assert.equal(
      urlKey('https://github.com/org/repo?tab=files#diff'),
      'https://github.com/org/repo'
    );
  });

  it('differentiates different paths on same domain', () => {
    const a = urlKey('https://github.com/org/repo/pull/123');
    const b = urlKey('https://github.com/org/repo/pull/456');
    assert.notEqual(a, b);
  });

  it('returns raw string for invalid URLs', () => {
    assert.equal(urlKey('not-a-url'), 'not-a-url');
  });
});

// ── Tree helpers ──

function makeTree() {
  return [
    {
      id: 'f1', type: 'folder', name: 'Work', expanded: true,
      children: [
        { id: 'l1', type: 'link', title: 'Jira', url: 'https://jira.example.com' },
        {
          id: 'f2', type: 'folder', name: 'PRs', expanded: false,
          children: [
            { id: 'l2', type: 'link', title: 'PR #1', url: 'https://github.com/pull/1' },
          ],
        },
      ],
    },
    { id: 'l3', type: 'link', title: 'Google', url: 'https://google.com' },
  ];
}

describe('findNode', () => {
  it('finds root-level node', () => {
    assert.equal(findNode(makeTree(), 'l3').title, 'Google');
  });

  it('finds deeply nested node', () => {
    assert.equal(findNode(makeTree(), 'l2').title, 'PR #1');
  });

  it('returns null for missing id', () => {
    assert.equal(findNode(makeTree(), 'nope'), null);
  });
});

describe('findParent', () => {
  it('returns null for root-level node', () => {
    assert.equal(findParent(makeTree(), 'f1'), null);
  });

  it('returns parent folder', () => {
    const parent = findParent(makeTree(), 'l2');
    assert.equal(parent.id, 'f2');
  });

  it('returns undefined for missing id', () => {
    assert.equal(findParent(makeTree(), 'nope'), undefined);
  });
});

describe('removeNode', () => {
  it('removes root-level node', () => {
    const tree = makeTree();
    const removed = removeNode(tree, 'l3');
    assert.equal(removed.title, 'Google');
    assert.equal(tree.length, 1);
  });

  it('removes nested node', () => {
    const tree = makeTree();
    const removed = removeNode(tree, 'l2');
    assert.equal(removed.title, 'PR #1');
    assert.equal(tree[0].children[1].children.length, 0);
  });

  it('returns null for missing id', () => {
    assert.equal(removeNode(makeTree(), 'nope'), null);
  });
});

describe('isDescendant', () => {
  it('returns true for direct child', () => {
    const tree = makeTree();
    assert.equal(isDescendant(tree[0], 'l1'), true);
  });

  it('returns true for deep descendant', () => {
    const tree = makeTree();
    assert.equal(isDescendant(tree[0], 'l2'), true);
  });

  it('returns false for non-descendant', () => {
    const tree = makeTree();
    assert.equal(isDescendant(tree[0], 'l3'), false);
  });

  it('returns false for node without children', () => {
    assert.equal(isDescendant({ id: 'x', type: 'link' }, 'y'), false);
  });
});

describe('setAllExpanded', () => {
  it('collapses all folders', () => {
    const tree = makeTree();
    setAllExpanded(tree, false);
    assert.equal(tree[0].expanded, false);
    assert.equal(tree[0].children[1].expanded, false);
  });

  it('expands all folders', () => {
    const tree = makeTree();
    setAllExpanded(tree, false);
    setAllExpanded(tree, true);
    assert.equal(tree[0].expanded, true);
    assert.equal(tree[0].children[1].expanded, true);
  });

  it('does not affect links', () => {
    const tree = makeTree();
    setAllExpanded(tree, false);
    assert.equal(tree[1].expanded, undefined);
  });
});
