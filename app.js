(function () {
  'use strict';

  var Logic = window.PuniLogic;
  var Content = window.PuniContent;
  var root = document.getElementById('app');
  var STORAGE_KEY = 'puniura-history-v1';
  var PHOTO_MAX = 1024;
  var WORK_MAX = 320;
  var PAD_COLORS = ['216,90,48', '15,110,86'];

  var state = newState();

  function newState() {
    return { species: 'cat', name: '', photo: null, work: null, pads: [], answers: [], paw: 'unknown', features: null, result: null };
  }

  function loadHistory() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(saved) ? saved : [];
    } catch (e) {
      return [];
    }
  }

  function saveHistory(item) {
    try {
      var list = [item].concat(loadHistory()).slice(0, 30);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('履歴を保存できませんでした', e);
    }
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (key) {
      if (key === 'onclick') node.addEventListener('click', attrs[key]);
      else if (key === 'text') node.textContent = attrs[key];
      else node.setAttribute(key, attrs[key]);
    });
    (children || []).forEach(function (child) { if (child) node.appendChild(child); });
    return node;
  }

  function show(nodes) {
    root.replaceChildren.apply(root, nodes.filter(Boolean));
    window.scrollTo(0, 0);
  }

  function pawIcon(fill) {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('class', 'mascot');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('fill', fill);
    [[50, 66, 29, 24, 0], [17, 42, 10, 13, -22], [38, 22, 10, 14, -6], [62, 22, 10, 14, 6], [83, 42, 10, 13, 22]].forEach(function (p) {
      var shape = document.createElementNS(ns, 'ellipse');
      shape.setAttribute('cx', p[0]);
      shape.setAttribute('cy', p[1]);
      shape.setAttribute('rx', p[2]);
      shape.setAttribute('ry', p[3]);
      shape.setAttribute('transform', 'rotate(' + p[4] + ' ' + p[0] + ' ' + p[1] + ')');
      svg.appendChild(shape);
    });
    return svg;
  }

  function isStandalone() {
    return window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  }

  function todayLine(item) {
    var key = item.name + '|' + item.species + '|' + Logic.dayKey(new Date());
    var names = Object.keys(Content.auras);
    var aura = Content.auras[names[Logic.hash(key) % names.length]];
    var lucky = Content.lucky[Logic.hash(key + 'lucky') % Content.lucky.length];
    return '今日のオーラは' + aura.name + '。おすすめは「' + lucky + '」。';
  }

  function homeScreen() {
    var history = loadHistory();
    var latest = history[0];
    var input = el('input', { type: 'file', accept: 'image/*', hidden: 'hidden' });
    var nameField = el('input', { type: 'text', id: 'pet-name', maxlength: '12', placeholder: 'こむぎ', autocomplete: 'off' });
    var error = el('p', { class: 'error', role: 'alert' });
    nameField.value = state.name;

    function speciesButton(value, label) {
      return el('button', {
        class: state.species === value ? 'selected' : 'ghost',
        text: label,
        onclick: function () { state.name = nameField.value; state.species = value; homeScreen(); }
      });
    }

    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      if (!file) return;
      state.name = nameField.value.trim();
      loadPhoto(file).catch(function () {
        error.textContent = 'この写真は読み込めませんでした。別の写真を選んでください。';
      });
    });

    show([
      el('h1', { text: 'ぷにうら' }),
      el('p', { class: 'sub', text: '肉球でひらく、うちの子占い' }),
      pawIcon('#F5C4B3'),
      latest ? el('div', { class: 'card' }, [
        el('p', { text: (latest.name || 'うちの子') + 'へ' }),
        el('p', { class: 'hint', text: todayLine(latest) })
      ]) : null,
      el('div', { class: 'row' }, [speciesButton('cat', '猫'), speciesButton('dog', '犬')]),
      el('div', {}, [el('label', { for: 'pet-name', text: 'なまえ（なくてもOK）' }), nameField]),
      el('button', { text: '肉球の写真をえらぶ', onclick: function () { input.click(); } }),
      error,
      input,
      !isStandalone() ? el('p', { class: 'hint', text: 'iPhoneでは、共有ボタンから「ホーム画面に追加」を選ぶとアプリのように使えます。' }) : null,
      history.length ? el('h2', { text: 'これまでの占い' }) : null,
      history.length ? el('div', { class: 'history' }, history.slice(0, 8).map(function (item) {
        return el('button', {
          class: 'ghost',
          text: (item.name || 'うちの子') + '：' + Content.types[item.typeKey].name,
          onclick: function () { state = Object.assign(newState(), item, { photo: null }); resultScreen(false); }
        });
      })) : null,
      el('p', { class: 'notice', text: 'エンタメ占いです。健康の判定はしません。写真は端末の外に送られません。' })
    ]);
  }

  function loadPhoto(file) {
    var url = URL.createObjectURL(file);
    return new Promise(function (resolve, reject) {
      var image = new Image();
      image.onload = function () { resolve(image); };
      image.onerror = reject;
      image.src = url;
    }).then(function (image) {
      var scale = Math.min(1, PHOTO_MAX / Math.max(image.naturalWidth, image.naturalHeight));
      var photo = document.createElement('canvas');
      photo.width = Math.round(image.naturalWidth * scale);
      photo.height = Math.round(image.naturalHeight * scale);
      photo.getContext('2d').drawImage(image, 0, 0, photo.width, photo.height);
      URL.revokeObjectURL(url);
      preparePhoto(photo);
    }).catch(function (error) {
      URL.revokeObjectURL(url);
      throw error;
    });
  }

  function preparePhoto(photo) {
    var scale = Math.min(1, WORK_MAX / Math.max(photo.width, photo.height));
    var work = document.createElement('canvas');
    work.width = Math.round(photo.width * scale);
    work.height = Math.round(photo.height * scale);
    var context = work.getContext('2d', { willReadFrequently: true });
    context.drawImage(photo, 0, 0, work.width, work.height);
    var pixels = context.getImageData(0, 0, work.width, work.height).data;
    state.photo = photo;
    state.work = { width: work.width, height: work.height, scale: photo.width / work.width, lab: Logic.toLabBuffer(pixels, work.width, work.height) };
    state.pads = [];
    tapScreen();
  }

  function drawStage(canvas) {
    var context = canvas.getContext('2d');
    var work = state.work;
    context.drawImage(state.photo, 0, 0);
    var layer = document.createElement('canvas');
    layer.width = work.width;
    layer.height = work.height;
    var layerContext = layer.getContext('2d');
    var mask = layerContext.createImageData(work.width, work.height);
    state.pads.forEach(function (pad, index) {
      var rgb = PAD_COLORS[index === 0 ? 0 : 1].split(',').map(Number);
      pad.pixels.forEach(function (p) {
        mask.data[p * 4] = rgb[0];
        mask.data[p * 4 + 1] = rgb[1];
        mask.data[p * 4 + 2] = rgb[2];
        mask.data[p * 4 + 3] = 110;
      });
    });
    layerContext.putImageData(mask, 0, 0);
    context.imageSmoothingEnabled = true;
    context.drawImage(layer, 0, 0, canvas.width, canvas.height);
    var radius = Math.max(16, canvas.width * 0.03);
    state.pads.forEach(function (pad, index) {
      var x = pad.cx * work.scale, y = pad.cy * work.scale;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fillStyle = 'rgb(' + PAD_COLORS[index === 0 ? 0 : 1] + ')';
      context.fill();
      context.fillStyle = '#fff';
      context.font = '700 ' + Math.round(radius * 1.1) + 'px sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(String(index + 1), x, y);
    });
  }

  function tapScreen() {
    var canvas = el('canvas', { 'aria-label': '肉球の写真。肉球をタップして印をつけます' });
    canvas.width = state.photo.width;
    canvas.height = state.photo.height;
    var guide = el('p', { class: 'progress', role: 'status' });
    var next = el('button', { class: 'teal', text: '印をつけた' });
    var error = el('p', { class: 'error', role: 'alert' });

    function refresh() {
      drawStage(canvas);
      guide.textContent = state.pads.length === 0
        ? 'いちばん大きい肉球の真ん中をタップしてね'
        : '指の肉球をぜんぶタップしてね（いま ' + (state.pads.length - 1) + ' 個）';
      error.textContent = '';
    }

    canvas.addEventListener('click', function (event) {
      var box = canvas.getBoundingClientRect();
      var x = Math.floor(((event.clientX - box.left) / box.width) * state.work.width);
      var y = Math.floor(((event.clientY - box.top) / box.height) * state.work.height);
      var work = state.work;
      state.pads.push(Logic.growRegion(work.lab, work.width, work.height, x, y, state.pads.length === 0));
      refresh();
    });

    next.addEventListener('click', function () {
      if (state.pads.length < 3) {
        error.textContent = '大きい肉球と、指の肉球を2個以上タップしてね。';
        return;
      }
      state.features = Logic.summarize(state.pads[0], state.pads.slice(1));
      state.answers = [];
      state.paw = 'unknown';
      questionScreen(0);
    });

    show([
      el('h2', { text: '肉球をタップ' }),
      guide,
      el('div', { class: 'stage' }, [canvas]),
      next,
      el('div', { class: 'row' }, [
        el('button', { class: 'ghost', text: '1つもどす', onclick: function () { state.pads.pop(); refresh(); } }),
        el('button', { class: 'ghost', text: '写真を変える', onclick: homeScreen })
      ]),
      error
    ]);
    refresh();
  }

  function questionScreen(index) {
    var isPaw = index === Content.questions.length;
    var question = isPaw ? Content.pawQuestion : Content.questions[index];
    show([
      el('p', { class: 'progress', text: '肉球の精からの質問 ' + (index + 1) + ' / ' + (Content.questions.length + 1) }),
      el('h2', { text: question.text }),
      el('div', { class: 'history' }, question.options.map(function (option) {
        return el('button', {
          class: 'ghost',
          text: option[0],
          onclick: function () {
            if (isPaw) {
              state.paw = option[1];
              observeScreen();
            } else {
              state.answers[index] = option[1];
              questionScreen(index + 1);
            }
          }
        });
      }))
    ]);
  }

  function fact(label, value) {
    return el('div', { class: 'fact' }, [el('span', { text: label }), el('span', { text: value })]);
  }

  function observeScreen() {
    var f = state.features;
    show([
      el('h2', { text: '写真から見つけたこと' }),
      el('div', { class: 'card' }, [
        fact('指の肉球', f.toeCount + '個'),
        fact('指のひらき', Content.spreadLabels[f.spread]),
        fact('大きい肉球の形', Content.shapeLabels[f.shape])
      ]),
      el('p', { text: '肉球の色はどれが近い？' }),
      el('div', { class: 'chips' }, Object.keys(Content.colorLabels).map(function (key) {
        return el('button', {
          class: f.color === key ? 'selected' : 'ghost',
          text: Content.colorLabels[key],
          onclick: function () { f.color = key; observeScreen(); }
        });
      })),
      f.estimated ? el('p', { class: 'hint', text: '境目が分かりにくい肉球は、おおよその範囲で計りました。' }) : null,
      el('p', { class: 'hint', text: 'ここまでは写真の見た目の記録です。' }),
      el('button', { class: 'teal', text: '占いを見る', onclick: finish })
    ]);
  }

  function finish() {
    var item = {
      id: Date.now(),
      name: state.name,
      species: state.species,
      answers: state.answers,
      paw: state.paw,
      features: state.features,
      typeKey: Logic.decideType(state.answers, state.features),
      auraKey: Logic.decideAura(state.features),
      date: new Date().toISOString()
    };
    Object.assign(state, item);
    saveHistory(item);
    resultScreen(true);
  }

  function roundRect(context, x, y, width, height, radius) {
    context.beginPath();
    context.moveTo(x + radius, y);
    context.arcTo(x + width, y, x + width, y + height, radius);
    context.arcTo(x + width, y + height, x, y + height, radius);
    context.arcTo(x, y + height, x, y, radius);
    context.arcTo(x, y, x + width, y, radius);
    context.closePath();
  }

  function wrapText(context, text, x, y, maxWidth, lineHeight) {
    var line = '';
    Array.from(text).forEach(function (char) {
      if (context.measureText(line + char).width > maxWidth) {
        context.fillText(line, x, y);
        y += lineHeight;
        line = char;
      } else {
        line += char;
      }
    });
    if (line) context.fillText(line, x, y);
    return y + lineHeight;
  }

  function drawPhotoCircle(context, cx, cy, radius) {
    var photo = state.photo;
    context.save();
    context.beginPath();
    context.arc(cx, cy, radius, 0, Math.PI * 2);
    context.clip();
    var pad = state.pads[0], work = state.work;
    var focusX = pad ? pad.cx * work.scale : photo.width / 2;
    var focusY = pad ? pad.cy * work.scale * 0.85 : photo.height / 2;
    var size = Math.min(photo.width, photo.height);
    var sx = Math.max(0, Math.min(photo.width - size, focusX - size / 2));
    var sy = Math.max(0, Math.min(photo.height - size, focusY - size / 2));
    context.drawImage(photo, sx, sy, size, size, cx - radius, cy - radius, radius * 2, radius * 2);
    context.restore();
  }

  function drawPawMark(context, cx, cy, size, fill) {
    context.fillStyle = fill;
    [[0, 0.16, 0.29, 0.24, 0], [-0.33, -0.08, 0.1, 0.13, -0.38], [-0.12, -0.28, 0.1, 0.14, -0.1], [0.12, -0.28, 0.1, 0.14, 0.1], [0.33, -0.08, 0.1, 0.13, 0.38]].forEach(function (p) {
      context.beginPath();
      context.ellipse(cx + p[0] * size, cy + p[1] * size, p[2] * size, p[3] * size, p[4], 0, Math.PI * 2);
      context.fill();
    });
  }

  function makeCard() {
    var type = Content.types[state.typeKey];
    var aura = Content.auras[state.auraKey];
    var canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1350;
    var c = canvas.getContext('2d');
    var font = '"Hiragino Maru Gothic ProN", "Hiragino Sans", sans-serif';
    c.fillStyle = aura.color;
    c.fillRect(0, 0, 1080, 1350);
    c.fillStyle = '#FFFFFF';
    roundRect(c, 60, 60, 960, 1230, 48);
    c.fill();
    c.textAlign = 'center';
    c.textBaseline = 'alphabetic';
    c.fillStyle = '#993C1D';
    c.font = '700 44px ' + font;
    c.fillText((state.name || 'うちの子') + 'の肉球占い', 540, 160);
    c.fillStyle = aura.color;
    c.beginPath();
    c.arc(540, 390, 196, 0, Math.PI * 2);
    c.fill();
    if (state.photo) drawPhotoCircle(c, 540, 390, 172);
    else drawPawMark(c, 540, 390, 300, '#FFFFFF');
    c.fillStyle = '#26215C';
    c.font = '700 72px ' + font;
    c.fillText(type.name, 540, 690);
    c.fillStyle = '#534AB7';
    c.font = '700 40px ' + font;
    c.fillText('オーラ：' + aura.name, 540, 760);
    c.textAlign = 'left';
    c.fillStyle = '#2C2C2A';
    c.font = '34px ' + font;
    var y = wrapText(c, type[state.species], 120, 850, 840, 50) + 8;
    y = wrapText(c, aura.line, 120, y, 840, 50) + 8;
    y = wrapText(c, Content.shapeLines[state.features.shape], 120, y, 840, 50);
    var pawLine = Content.pawLines[state.paw];
    if (pawLine) wrapText(c, pawLine, 120, y + 8, 840, 50);
    c.textAlign = 'center';
    c.fillStyle = '#993C1D';
    c.font = '30px ' + font;
    c.fillText('占いの解釈です｜ぷにうら', 540, 1250);
    return canvas;
  }

  function canvasToBlob(canvas) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (blob) resolve(blob);
        else reject(new Error('画像を作れませんでした'));
      }, 'image/png');
    });
  }

  function imageOverlay(src) {
    var overlay = el('div', { class: 'overlay', role: 'dialog', 'aria-label': 'カード画像' }, [
      el('p', { text: '画像を長押しすると、写真に保存できます。' }),
      el('img', { src: src, alt: '占い結果カード' }),
      el('button', { class: 'ghost', text: 'とじる', onclick: function () { overlay.remove(); } })
    ]);
    document.body.appendChild(overlay);
  }

  function shareCard(canvas, error) {
    error.textContent = '';
    canvasToBlob(canvas).then(function (blob) {
      var file = new File([blob], 'puniura.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        return navigator.share({ files: [file] }).catch(function (e) {
          if (e.name !== 'AbortError') imageOverlay(canvas.toDataURL('image/png'));
        });
      }
      imageOverlay(canvas.toDataURL('image/png'));
    }).catch(function () {
      error.textContent = 'カードを作れませんでした。もう一度お試しください。';
    });
  }

  function resultScreen() {
    var card = makeCard();
    var error = el('p', { class: 'error', role: 'alert' });
    show([
      el('img', { class: 'result-image', src: card.toDataURL('image/png'), alt: Content.types[state.typeKey].name + 'の占い結果カード' }),
      el('div', { class: 'row' }, [
        el('button', { text: 'シェア', onclick: function () { shareCard(card, error); } }),
        el('button', { class: 'ghost', text: '画像で見る', onclick: function () { imageOverlay(card.toDataURL('image/png')); } })
      ]),
      error,
      el('button', { class: 'ghost', text: 'ホームへ', onclick: function () { state = newState(); homeScreen(); } }),
      el('p', { class: 'notice', text: '占いの解釈です。健康の判定はしません。' })
    ]);
  }

  window.PuniApp = { preparePhoto: preparePhoto, getState: function () { return state; } };

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function (e) { console.warn('オフライン機能を有効にできませんでした', e); });
  }
  homeScreen();
})();
