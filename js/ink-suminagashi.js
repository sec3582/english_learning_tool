/*
 * js/ink-suminagashi.js
 * 冷調 Suminagashi 墨流背景 — 獨立的 p5.js instance-mode sketch
 * 供沉浸式文本小說夜模式使用（index.html 已載入）。
 * 規格來源：docs/VISUAL_SPEC.md §3.1（通則）與 §2.1（冷調系統色相）
 *
 * 核心規則：
 *   - 色相鎖定在冷調系統（青灰／靛藍，約 195–225 度），不使用 VISUAL_SPEC
 *     暖調系統（教會／政客場景）的琥珀／赭石色相。
 *   - 墨滴由 Perlin noise（p.noise）驅動做緩慢漂移，緩動曲線是 easeOutCubic，
 *     沒有任何 overshoot／彈跳——「像液體，不是像按鈕」。
 *   - 至少一滴墨完整暈開的時間落在 25–40 秒之間（本檔案讓所有墨滴都遵守
 *     這個節奏，而不只是其中一滴，展示效果更完整）。
 *
 * 2026-07 修訂（使用者回饋：墨暈看起來像「好幾個同心圓」，不夠有機）：
 *   - drawBloom 改成用不規則、隨 noise 擾動並隨時間持續變形的閉合多邊形
 *     （經過 quadratic 中點平滑處理），取代原本 6 層完全同心的 p.ellipse()。
 *   - 每滴墨新增 alphaPeak / edgeAmp / edgeFreq / driftSpeedMul 四個獨立
 *     隨機參數，讓多滴墨同時可見時不會像「同一組圓整齊呼吸」。
 *   - 透明度梯度改用原生 canvas 2D API 的 createRadialGradient 做真正的
 *     連續漸層，一次 fill 取代原本 6 次 ellipse 疊繪。
 *   - 粒子數量調整為手機 3 / 平板 4 / 桌機 5（原本桌機 8，依使用者這次
 *     明確指示調降），初始位置隨機範圍放寬到接近整個畫面，並加入最小
 *     間距檢查避免多滴墨一開始就疊在同一點。
 *
 * 2026-07 修訂（使用者回饋：漸層外圍消退太快，邊緣像硬邊剪影）：
 *   - createRadialGradient 色標從 0/0.55/1（alpha 0.85/0.35/0）改為
 *     0/0.45/1（alpha = alphaNow*0.4 / alphaNow*0.1 / 0），讓最後 40–50%
 *     半徑都落在接近透明的漸變區間，而不是在邊緣才急速消退。
 *   - alphaPeak 隨機區間整體壓低，從 0.4–0.75 改為 0.28–0.55，讓墨點整體
 *     變暗，感覺更像「水中的光」而不是「塗上去的色塊」。
 *
 * 2026-07 修訂（模糊輔助，使用者回饋邊緣仍看得出輪廓線）：
 *   - drawBloom 在 ctx.fill() 前套用 ctx.filter = 'blur(Npx)'，fill 完立刻
 *     還原成 'none'，避免影響同一個 canvas 之後的其他繪製。
 *   - blur 半徑依裝置寬度分級（比照 vertexCountForWidth 的模式）：
 *     <1024px（行動裝置／平板）用 5px，桌機維持 8px——canvas 的 blur
 *     filter 在行動裝置上，搭配本來就有的全螢幕重繪＋多個 radial
 *     gradient fill，運算成本較高，因此在小螢幕上調降半徑。
 *
 * 行動裝置效能取捨（見檔案內對應註解）：
 *   1. pixelDensity 依裝置寬度封頂（小螢幕鎖 1，其餘鎖 min(devicePixelRatio, 2)）。
 *   2. 粒子（墨滴）數量依螢幕寬度分級：<600px → 3 滴／<1024px → 4 滴／其餘 → 5 滴。
 *   3. 分頁不在前景時（visibilitychange → hidden）呼叫 noLoop()，恢復時 loop()。
 *   4. 尊重 prefers-reduced-motion：符合時只畫一次靜態墨跡構圖並 noLoop()，
 *      完全不進入動畫迴圈。
 *   5. 漂移方向每 8 影格才重新取樣一次 noise，其餘影格用 lerp 插值近似，
 *      避免每一影格都重新計算完整路徑；frameRate 鎖定在 30fps（墨流本來
 *      就該慢，不需要 60fps 的即時感）。
 *   6. 新增的不規則輪廓多邊形頂點數依裝置寬度分級封頂：<1024px → 16 點，
 *      其餘（桌機）→ 28 點，避免每滴墨每影格都算太多三角函數與 noise。
 *   7. drawBloom 的 blur 濾鏡半徑依裝置寬度分級：<1024px → 5px，
 *      其餘（桌機）→ 8px，控制行動裝置上 canvas filter 的運算成本。
 */

(function () {
  'use strict';

  const prefersReducedMotion =
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const sketch = (p) => {
    let drops = [];
    let voidColor; // 對應 --cold-void (#14171a) 的 RGB 色彩物件
    let vertexCount; // 不規則墨暈輪廓的取樣點數，依裝置寬度分級（見上方註解 6）
    let blurRadius; // 模糊輔助的 blur 半徑（px），依裝置寬度分級

    // 冷調系統色相範圍：青灰（約 195°）到靛藍（約 225°），
    // --cold-accent (#5c7686) 換算後約落在 203° 附近，用來校準這個範圍。
    const HUE_MIN = 195;
    const HUE_MAX = 225;

    function particleCountForWidth(w) {
      if (w < 600) return 3; // 手機：降低粒子數量以節省運算
      if (w < 1024) return 4; // 平板
      return 5; // 桌機（依使用者回饋由 8 調降為 5）
    }

    function vertexCountForWidth(w) {
      // 行動裝置（含平板）14–18 點；桌機 24–32 點（見上方註解 6）
      return w < 1024 ? 16 : 28;
    }

    function blurRadiusForWidth(w) {
      // ctx.filter 的 blur 運算在部分行動裝置上比較吃效能，尤其是搭配
      // 已經存在的全螢幕重繪＋多個 radial gradient fill。比照
      // vertexCountForWidth 的分級模式：行動裝置（含平板）用較小的
      // 4–5px，桌機維持使用者要求的 8px（2026-07 修訂，模糊輔助）。
      return w < 1024 ? 5 : 8;
    }

    // HSB（0-360, 0-100, 0-100）轉 RGB（0-255）—— 手動換算，避免依賴 p5
    // 目前 colorMode 狀態去萃取顏色值時可能產生的模式混淆，且比呼叫
    // p.color()/p.red() 等 API 更省成本（每滴墨每影格只算一次）。
    function hsbToRgb(h, s, v) {
      s /= 100;
      v /= 100;
      const c = v * s;
      const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
      const m = v - c;
      let r, g, b;
      if (h < 60) {
        r = c; g = x; b = 0;
      } else if (h < 120) {
        r = x; g = c; b = 0;
      } else if (h < 180) {
        r = 0; g = c; b = x;
      } else if (h < 240) {
        r = 0; g = x; b = c;
      } else if (h < 300) {
        r = x; g = 0; b = c;
      } else {
        r = c; g = 0; b = x;
      }
      return [
        Math.round((r + m) * 255),
        Math.round((g + m) * 255),
        Math.round((b + m) * 255),
      ];
    }

    // 找一個新墨滴的初始位置，跟現有墨滴保持最小間距（最多重試 6 次），
    // 避免多滴墨一開始就完全疊在同一點——允許些微重疊，但不要完全重合。
    function pickInitialPosition(existing, w, h) {
      const minDist = Math.min(w, h) * 0.18;
      let candidate = null;
      for (let attempt = 0; attempt < 6; attempt++) {
        const x = p.random(w * 0.08, w * 0.92);
        const y = p.random(h * 0.08, h * 0.92);
        const tooClose = existing.some(
          (d) => p.dist(d.x, d.y, x, y) < minDist
        );
        candidate = { x, y };
        if (!tooClose) return candidate;
      }
      return candidate; // 6 次都太近，就接受最後一次的結果（微重疊，非完全重合）
    }

    function makeDrop(noiseSeed, existing) {
      const w = p.width;
      const h = p.height;
      const pos = pickInitialPosition(existing || [], w, h);
      return {
        x: pos.x,
        y: pos.y,
        hue: p.random(HUE_MIN, HUE_MAX),
        maxRadius: p.random(w, h) * p.random(0.14, 0.24),
        birth: p.millis(),
        // 單滴墨完整暈開時間：25–40 秒（VISUAL_SPEC §3.1）
        bloomMs: p.random(25, 40) * 1000,
        noiseSeed: noiseSeed,
        driftX: 0,
        driftY: 0,
        targetDriftX: 0,
        targetDriftY: 0,
        // 每滴墨獨立的外觀／行為參數，避免多滴墨看起來像同一組圓整齊呼吸
        // alphaPeak 區間依使用者回饋整體壓低過（原 0.4–0.75 → 0.28–0.55），
        // 讓墨點感覺更像「水中的光」而不是「塗上去的色塊」（2026-07 修訂）。
        // Phase 5g P1（背景與玻璃可感知度評審）：0.28–0.55 在實際頁面
        // （卡片林立、視線被卡片吸走）幾乎不可見，微幅回調到 0.35–0.65 ──
        // 不回到最初的 0.4–0.75，只是把上一輪的下修拉回一半，色相/去飽和/
        // blur 都不動，只調亮度。
        alphaPeak: p.random(0.35, 0.65),
        edgeAmp: p.random(20, 50),
        edgeFreq: p.random(0.2, 0.45),
        driftSpeedMul: p.random(0.7, 1.3),
      };
    }

    // 緩動：easeOutCubic —— 前期擴散較快、後期趨緩並長時間停留，
    // 沒有 overshoot，符合「像液體」的要求。
    function easeOutBloom(t) {
      const c = Math.min(Math.max(t, 0), 1);
      return 1 - Math.pow(1 - c, 3);
    }

    // 畫單滴墨：不規則、持續隨時間變形的閉合形狀 + 原生 canvas 漸層填色。
    // 用 quadratic 中點平滑處理讓多邊形看起來是柔邊墨漬，而不是有稜角的多邊形。
    function drawBloom(d, radius, growth, timeSlow) {
      if (radius < 1) return;
      const ctx = p.drawingContext;
      const cx = d.x + d.driftX;
      const cy = d.y + d.driftY;

      // 早期暈開（radius 還很小）時把邊緣擾動幅度按比例縮小，避免半徑
      // 被雜訊拉成負值或形狀在還很小的時候就過度扭曲。
      const perturbScale = Math.min(1, radius / 40);

      const pts = new Array(vertexCount);
      for (let i = 0; i < vertexCount; i++) {
        const theta = (i / vertexCount) * Math.PI * 2;
        const nx = Math.cos(theta) * d.edgeFreq;
        const ny = Math.sin(theta) * d.edgeFreq;
        const nVal = p.noise(
          d.noiseSeed + nx,
          d.noiseSeed * 0.5 + ny,
          timeSlow
        );
        const perturb = (nVal - 0.5) * 2 * d.edgeAmp * perturbScale;
        const r = Math.max(radius + perturb, radius * 0.25, 2);
        pts[i] = { x: cx + Math.cos(theta) * r, y: cy + Math.sin(theta) * r };
      }

      const [rr, gg, bb] = hsbToRgb(d.hue, 22, 78);
      const alphaNow = d.alphaPeak * growth;

      // 漸層消退範圍加大（2026-07 修訂，使用者回饋邊緣太清晰、像剪影）：
      // 0% 中心不再是最亮的 0.85，降到 0.35–0.45 這個量級；45% 中段降到
      // 0.10 量級；讓最後 40–50% 半徑都落在接近透明的漸變區間，而不是
      // 在邊緣才急速消退，讓墨暈讀起來像光暈／水中暈開，而不是硬邊剪影。
      //
      // Phase 5g P1（背景與玻璃可感知度評審）：中心係數 0.4→0.55 微幅提高
      // 可見度；45% 中段係數只跟著微調 0.1→0.12（刻意保持克制，不按同比例
      // 放大到 ~0.14），維持中心到中段的平滑斜率，避免拉開差距後邊緣重新
      // 讀出清晰輪廓／同心圓。
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.15);
      grad.addColorStop(0, `rgba(${rr},${gg},${bb},${(alphaNow * 0.55).toFixed(3)})`);
      grad.addColorStop(0.45, `rgba(${rr},${gg},${bb},${(alphaNow * 0.12).toFixed(3)})`);
      grad.addColorStop(1, `rgba(${rr},${gg},${bb},0)`);

      ctx.beginPath();
      const last = pts[pts.length - 1];
      const first = pts[0];
      ctx.moveTo((first.x + last.x) / 2, (first.y + last.y) / 2);
      for (let i = 0; i < pts.length; i++) {
        const cur = pts[i];
        const next = pts[(i + 1) % pts.length];
        const midx = (cur.x + next.x) / 2;
        const midy = (cur.y + next.y) / 2;
        ctx.quadraticCurveTo(cur.x, cur.y, midx, midy);
      }
      ctx.closePath();
      ctx.fillStyle = grad;

      // 模糊輔助（2026-07 修訂，使用者回饋邊緣仍看得出輪廓線）：
      // fill 前套用 blur 濾鏡，讓邊緣「消失」進背景，像手電筒照霧那樣
      // 只有中心亮、往外自然散去，沒有可辨識的形狀邊界。fill 完立刻把
      // filter 還原成 'none'，避免影響同一個 canvas 之後的其他繪製
      // （下一滴墨、或未來可能加入的其他圖層）。
      ctx.filter = `blur(${blurRadius}px)`;
      ctx.fill();
      ctx.filter = 'none';
    }

    function drawStaticComposition() {
      // prefers-reduced-motion：只畫一次靜態構圖，之後 noLoop()，不再更新。
      p.background(voidColor);
      drops.forEach((d) => {
        drawBloom(d, d.maxRadius * 0.82, d.alphaPeak, 0);
      });
    }

    p.setup = function () {
      const w = window.innerWidth;
      const h = window.innerHeight;

      // 行動裝置效能考量 1：pixelDensity 封頂，避免高 DPI 裝置運算暴增。
      const dpr = window.devicePixelRatio || 1;
      p.pixelDensity(w < 600 ? 1 : Math.min(dpr, 2));

      const canvas = p.createCanvas(w, h);
      canvas.id('ink-layer'); // 沿用 theme-perfume-night.css 既有的 #ink-layer 定位樣式
      const stage = document.getElementById('night-stage');
      if (stage) {
        canvas.parent(stage);
      }

      p.colorMode(p.RGB, 255);
      voidColor = p.color(20, 23, 26); // --cold-void #14171a
      p.colorMode(p.HSB, 360, 100, 100, 1);
      p.noStroke();
      p.frameRate(30); // 墨流是慢的，不需要 60fps

      vertexCount = vertexCountForWidth(w);
      blurRadius = blurRadiusForWidth(w);

      const count = particleCountForWidth(w);
      for (let i = 0; i < count; i++) {
        drops.push(makeDrop(i * 37.7, drops));
      }

      if (prefersReducedMotion) {
        drawStaticComposition();
        p.noLoop();
      }
    };

    p.draw = function () {
      p.background(voidColor);

      const now = p.millis();

      for (let i = 0; i < drops.length; i++) {
        const d = drops[i];

        // 行動裝置效能考量 2：漂移目標每 8 影格才重新取樣一次 noise，
        // 其餘影格用 lerp 插值——避免每影格都重算完整路徑。
        if (p.frameCount % 8 === 0) {
          const n1 = p.noise(d.noiseSeed, now * 0.00006);
          const n2 = p.noise(d.noiseSeed + 100, now * 0.00006);
          d.targetDriftX = (n1 - 0.5) * 40;
          d.targetDriftY = (n2 - 0.5) * 40;
        }
        // 每滴墨的漂移插值速度不同（driftSpeedMul），避免所有墨滴同步移動
        const driftLerpAmt = 0.05 * d.driftSpeedMul;
        d.driftX = p.lerp(d.driftX, d.targetDriftX, driftLerpAmt);
        d.driftY = p.lerp(d.driftY, d.targetDriftY, driftLerpAmt);

        const age = now - d.birth;
        const t = easeOutBloom(age / d.bloomMs);
        const radius = d.maxRadius * t;
        const growth = 0.4 + 0.6 * t; // 暈開越完整，墨色越沉（乘上各自的 alphaPeak）

        // 邊緣噪點的時間維度：讓輪廓持續、緩慢地變形（呼吸感），
        // 而不是固定花紋隨半徑等比放大。乘上 driftSpeedMul 讓每滴墨的
        // 「呼吸」節奏也略有差異。
        const timeSlow = now * 0.00004 * d.driftSpeedMul + d.noiseSeed;

        drawBloom(d, radius, growth, timeSlow);

        // 完整暈開一段時間後，讓這滴墨在新位置以新的 25–40 秒節奏重新開始，
        // 維持墨流背景持續、緩慢、不間斷的存在感。
        if (age > d.bloomMs * 1.4) {
          drops[i] = makeDrop(d.noiseSeed, drops);
        }
      }
    };

    p.windowResized = function () {
      p.resizeCanvas(window.innerWidth, window.innerHeight);
      vertexCount = vertexCountForWidth(window.innerWidth);
      blurRadius = blurRadiusForWidth(window.innerWidth);
    };
  };

  window.addEventListener('DOMContentLoaded', () => {
    const p5Instance = new p5(sketch);

    // 行動裝置效能考量 3：分頁不在前景時暫停繪製，恢復時繼續。
    // prefers-reduced-motion 模式本來就已經是 noLoop() 的靜態畫面，不需要
    // 再被這個監聽器切換（切換也不會有副作用，只是多一次 no-op loop/noLoop）。
    document.addEventListener('visibilitychange', () => {
      if (prefersReducedMotion) return;
      if (document.hidden) {
        p5Instance.noLoop();
      } else {
        p5Instance.loop();
      }
    });
  });
})();
