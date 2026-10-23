// Gota · Figma library builder, a development plugin (copied to dist/figma/ by
// `node scripts/native.mjs figma`, with the icons in ui.html). In the open file it builds, or brings
// up to date, one page per category and one component set per icon, with two variant properties:
// Style (Outline, Fill) and Weight (Light, Regular, Bold). Each variant is a 24 × 24 component
// holding one vector, "Icon": the icon's outline, checked against its drawing when it was written.
// Running it again redraws every vector in place, so components keep their keys and instances in
// other files keep their overrides; a set whose icon left Gota is reported, never deleted.
// Figma's sandbox: plain ES2017 (no optional chaining, no object spread).

var KEY = 'gota';
var STYLES = [
  ['outline', 'Outline'],
  ['fill', 'Fill'],
];
var WEIGHTS = ['Light', 'Regular', 'Bold'];
var SIZE = 24;
var GAP = 16;
var PAD = 16;
var PER_ROW = 8;
var SET_W = PAD * 2 + SIZE * WEIGHTS.length + GAP * (WEIGHTS.length - 1);
var SET_H = PAD * 2 + SIZE * STYLES.length + GAP * (STYLES.length - 1);
var INK = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];

// Where each variant sits in its set: a row per style, a column per weight
var SLOTS = {};
STYLES.forEach(function (style, row) {
  WEIGHTS.forEach(function (weight, col) {
    SLOTS[variantName(style[1], weight)] = [PAD + col * (SIZE + GAP), PAD + row * (SIZE + GAP)];
  });
});

function variantName(style, weight) {
  return 'Style=' + style + ', Weight=' + weight;
}

function breathe() {
  return new Promise(function (resolve) {
    setTimeout(resolve, 0);
  });
}

async function pageFor(category) {
  var pages = figma.root.children;
  for (var i = 0; i < pages.length; i++) {
    if (pages[i].getSharedPluginData(KEY, 'category') === category.id) {
      await pages[i].loadAsync();
      pages[i].name = category.label;
      return pages[i];
    }
  }
  var page = figma.createPage();
  page.name = category.label;
  page.setSharedPluginData(KEY, 'category', category.id);
  return page;
}

// The vector is set at the component's origin first: whether Figma keeps the path's own coordinates
// or moves the node to the path's corner, the drawing lands where it is on the 24 grid
function draw(component, d) {
  var vector = null;
  for (var i = 0; i < component.children.length; i++) {
    var child = component.children[i];
    if (child.type === 'VECTOR' && child.name === 'Icon') vector = child;
  }
  if (!vector) {
    vector = figma.createVector();
    vector.name = 'Icon';
    component.appendChild(vector);
    vector.fills = INK;
    vector.strokes = [];
    vector.constraints = { horizontal: 'SCALE', vertical: 'SCALE' };
  }
  vector.x = 0;
  vector.y = 0;
  vector.vectorPaths = [{ windingRule: 'NONZERO', data: d }];
}

function variant(page, name, d) {
  var component = figma.createComponent();
  component.name = name;
  component.resizeWithoutConstraints(SIZE, SIZE);
  component.fills = [];
  component.clipsContent = false;
  page.appendChild(component);
  draw(component, d);
  return component;
}

function build(page, sets, icon, index, stats) {
  var set = sets[icon.name] || null;
  var have = {};
  if (set) {
    set.children.forEach(function (child) {
      have[child.name] = child;
    });
  }
  var made = [];
  STYLES.forEach(function (style) {
    WEIGHTS.forEach(function (weight, w) {
      var name = variantName(style[1], weight);
      var d = icon.paths[style[0]][w];
      if (have[name]) draw(have[name], d);
      else made.push(variant(page, name, d));
    });
  });
  if (set) {
    made.forEach(function (component) {
      set.appendChild(component);
    });
    stats.updated++;
  } else {
    set = figma.combineAsVariants(made, page);
    set.setSharedPluginData(KEY, 'icon', icon.name);
    stats.created++;
  }
  set.name = icon.name;
  set.description = icon.description;
  set.children.forEach(function (child) {
    var slot = SLOTS[child.name];
    if (slot) {
      child.x = slot[0];
      child.y = slot[1];
    }
  });
  set.resizeWithoutConstraints(SET_W, SET_H);
  set.x = (index % PER_ROW) * (SET_W + GAP * 2);
  set.y = Math.floor(index / PER_ROW) * (SET_H + GAP * 4);
}

async function run(data) {
  var start = Date.now();
  var stats = { created: 0, updated: 0, gone: [] };
  var total = 0;
  data.categories.forEach(function (category) {
    total += category.icons.length;
  });
  var done = 0;
  for (var c = 0; c < data.categories.length; c++) {
    var category = data.categories[c];
    var page = await pageFor(category);
    var sets = {};
    page.children.forEach(function (node) {
      if (node.type === 'COMPONENT_SET') sets[node.getSharedPluginData(KEY, 'icon') || node.name] = node;
    });
    var wanted = {};
    for (var i = 0; i < category.icons.length; i++) {
      var icon = category.icons[i];
      wanted[icon.name] = true;
      build(page, sets, icon, i, stats);
      done++;
      if (done % 12 === 0 || done === total) {
        figma.ui.postMessage({ type: 'progress', done: done, total: total, label: category.label });
        await breathe();
      }
    }
    Object.keys(sets).forEach(function (name) {
      if (!wanted[name]) stats.gone.push(category.label + ' / ' + name);
    });
  }
  stats.seconds = Math.round((Date.now() - start) / 1000);
  return stats;
}

figma.showUI(__html__, { width: 320, height: 260, themeColors: true });
figma.ui.onmessage = async function (msg) {
  if (msg.type === 'close') return figma.closePlugin();
  if (msg.type !== 'build') return;
  try {
    var stats = await run(msg.data);
    figma.ui.postMessage({ type: 'done', stats: stats });
    figma.notify('Gota: ' + stats.created + ' new, ' + stats.updated + ' updated');
  } catch (error) {
    figma.ui.postMessage({ type: 'error', message: String((error && error.message) || error) });
  }
};
