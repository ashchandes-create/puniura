// 肉球の計測と占い判定。DOMに依存しない。根拠は docs/evidence.md
(function () {
  'use strict';

  function srgbToLinear(v) {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }

  function labF(t) {
    return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  }

  function rgbToLab(r, g, b) {
    var lr = srgbToLinear(r), lg = srgbToLinear(g), lb = srgbToLinear(b);
    var x = (0.4124 * lr + 0.3576 * lg + 0.1805 * lb) / 0.95047;
    var y = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
    var z = (0.0193 * lr + 0.1192 * lg + 0.9505 * lb) / 1.08883;
    var fx = labF(x), fy = labF(y), fz = labF(z);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  }

  function toLabBuffer(rgba, w, h) {
    var lab = new Float32Array(w * h * 3);
    for (var i = 0, n = w * h; i < n; i++) {
      var c = rgbToLab(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]);
      lab[i * 3] = c[0];
      lab[i * 3 + 1] = c[1];
      lab[i * 3 + 2] = c[2];
    }
    return lab;
  }

  function seedColor(lab, w, h, sx, sy) {
    var sum = [0, 0, 0], count = 0;
    for (var y = Math.max(0, sy - 2); y <= Math.min(h - 1, sy + 2); y++) {
      for (var x = Math.max(0, sx - 2); x <= Math.min(w - 1, sx + 2); x++) {
        var i = (y * w + x) * 3;
        sum[0] += lab[i];
        sum[1] += lab[i + 1];
        sum[2] += lab[i + 2];
        count++;
      }
    }
    return [sum[0] / count, sum[1] / count, sum[2] / count];
  }

  function flood(lab, w, h, sx, sy, seed, tolerance, maxArea) {
    var seen = new Uint8Array(w * h);
    var stack = [sy * w + sx];
    var pixels = [];
    var limit = tolerance * tolerance;
    seen[stack[0]] = 1;
    while (stack.length) {
      var p = stack.pop();
      pixels.push(p);
      if (pixels.length > maxArea) return null;
      var x = p % w, y = (p - x) / w;
      var next = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
      for (var k = 0; k < 4; k++) {
        var q = next[k];
        if (q < 0 || seen[q]) continue;
        seen[q] = 1;
        var i = q * 3;
        var dl = lab[i] - seed[0], da = lab[i + 1] - seed[1], db = lab[i + 2] - seed[2];
        if (dl * dl + da * da + db * db <= limit) stack.push(q);
      }
    }
    return pixels;
  }

  function circlePixels(w, h, cx, cy, radius) {
    var pixels = [];
    for (var y = Math.max(0, cy - radius); y <= Math.min(h - 1, cy + radius); y++) {
      for (var x = Math.max(0, cx - radius); x <= Math.min(w - 1, cx + radius); x++) {
        var dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy <= radius * radius) pixels.push(y * w + x);
      }
    }
    return pixels;
  }

  // 許容差を広げ、面積が急に増えたら毛並みへの漏れとみなして手前で止める
  function growRegion(lab, w, h, sx, sy, isMain) {
    var total = w * h;
    var maxArea = Math.floor(total * (isMain ? 0.3 : 0.1));
    var minArea = Math.max(12, Math.floor(total * (isMain ? 0.01 : 0.002)));
    var seed = seedColor(lab, w, h, sx, sy);
    var steps = [8, 12, 16, 20, 26, 32];
    var best = null;
    for (var i = 0; i < steps.length; i++) {
      var pixels = flood(lab, w, h, sx, sy, seed, steps[i], maxArea);
      if (!pixels) break;
      if (best && best.length >= minArea && pixels.length > best.length * 2.4) break;
      best = pixels;
    }
    var fallback = false;
    if (!best || best.length < minArea) {
      fallback = true;
      best = circlePixels(w, h, sx, sy, Math.round(Math.max(w, h) * (isMain ? 0.12 : 0.05)));
    }
    return measure(lab, w, best, fallback);
  }

  function measure(lab, w, pixels, fallback) {
    var n = pixels.length, sumX = 0, sumY = 0, sumL = 0, sumA = 0, sumB = 0, sumLL = 0;
    pixels.forEach(function (p) {
      var x = p % w, y = (p - x) / w, i = p * 3;
      sumX += x;
      sumY += y;
      sumL += lab[i];
      sumA += lab[i + 1];
      sumB += lab[i + 2];
      sumLL += lab[i] * lab[i];
    });
    var cx = sumX / n, cy = sumY / n, meanL = sumL / n;
    var xx = 0, yy = 0, xy = 0;
    pixels.forEach(function (p) {
      var x = p % w, y = (p - x) / w;
      xx += (x - cx) * (x - cx);
      yy += (y - cy) * (y - cy);
      xy += (x - cx) * (y - cy);
    });
    xx /= n;
    yy /= n;
    xy /= n;
    var mid = (xx + yy) / 2;
    var root = Math.sqrt(Math.max(0, (xx - yy) * (xx - yy) / 4 + xy * xy));
    var major = mid + root, minor = Math.max(0, mid - root);
    return {
      pixels: pixels,
      area: n,
      cx: cx,
      cy: cy,
      L: meanL,
      a: sumA / n,
      b: sumB / n,
      stdL: Math.sqrt(Math.max(0, sumLL / n - meanL * meanL)),
      axisRatio: major > 0 ? Math.sqrt(minor / major) : 1,
      fallback: fallback
    };
  }

  function spreadAngle(main, toes) {
    if (toes.length < 2) return 0;
    var angles = toes.map(function (t) {
      return (Math.atan2(t.cy - main.cy, t.cx - main.cx) * 180) / Math.PI;
    }).sort(function (a, b) { return a - b; });
    var largestGap = 360 + angles[0] - angles[angles.length - 1];
    for (var i = 1; i < angles.length; i++) {
      largestGap = Math.max(largestGap, angles[i] - angles[i - 1]);
    }
    return 360 - largestGap;
  }

  function classifyColor(main, toes) {
    var pads = [main].concat(toes);
    var values = pads.map(function (p) { return p.L; });
    var spread = Math.max.apply(null, values) - Math.min.apply(null, values);
    if (main.stdL > 16 || spread > 22) return 'madara';
    if (main.L < 36) return 'kuro';
    if (main.L < 55) return 'cocoa';
    return main.a >= 12 ? 'pink' : 'beige';
  }

  function summarize(main, toes) {
    var angle = spreadAngle(main, toes);
    var toeArea = toes.reduce(function (s, t) { return s + t.area; }, 0) / Math.max(1, toes.length);
    return {
      toeCount: toes.length,
      color: classifyColor(main, toes),
      spreadDeg: Math.round(angle),
      spread: angle < 75 ? 'narrow' : angle < 115 ? 'normal' : 'wide',
      shape: main.axisRatio >= 0.8 ? 'round' : 'oval',
      toeRatio: Math.round((toeArea / main.area) * 100) / 100,
      estimated: [main].concat(toes).some(function (p) { return p.fallback; })
    };
  }

  // 質問3軸（活発さ・人なつこさ・度胸）。同点のときだけ肉球の実測で決める
  function decideType(answers, features) {
    function axis(i, j, tie) {
      var sum = answers[i] + answers[j];
      if (sum !== 0) return sum > 0 ? '1' : '0';
      return tie ? '1' : '0';
    }
    return axis(0, 1, features.spread === 'wide') +
      axis(2, 3, features.shape === 'round') +
      axis(4, 5, features.toeRatio > 0.2);
  }

  function decideAura(features) {
    return features.toeCount >= 5 ? 'hoshi' : features.color;
  }

  function hash(text) {
    var value = 2166136261;
    for (var i = 0; i < text.length; i++) {
      value ^= text.charCodeAt(i);
      value = Math.imul(value, 16777619);
    }
    return value >>> 0;
  }

  function dayKey(date) {
    return date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate();
  }

  window.PuniLogic = {
    toLabBuffer: toLabBuffer,
    growRegion: growRegion,
    summarize: summarize,
    decideType: decideType,
    decideAura: decideAura,
    hash: hash,
    dayKey: dayKey
  };
})();
