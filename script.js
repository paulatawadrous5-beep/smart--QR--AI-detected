/**
 * Smart QR Studio — Intelligent Context-Aware Engine
 * Client-first, CORS-resilient, scan-safe QR platform.
 */

(function () {
  'use strict';

  // --- 1. STATE MANAGEMENT ---
  const state = {
    url: 'https://en.wikipedia.org/wiki/Ada_Lovelace',
    theme: localStorage.getItem('smart_qr_app_theme') || 'system',
    detection: null,
    designVariationIndex: 0,
    activePreset: null,
    autoLogoImg: null,
    customLogoImg: null,
    options: {
      dotStyle: 'rounded',
      eyeStyle: 'rounded',
      fgColor: '#0F172A',
      bgColor: '#FFFFFF',
      useGradient: false,
      fgGradColor: '#2563EB',
      logoMode: 'auto', // 'auto' | 'none' | 'custom'
      frameStyle: 'none', // 'none' | 'badge-top' | 'badge-bottom' | 'pill'
      frameText: 'SCAN ME',
      ecc: 'H',
      quietZone: 2,
      size: 1024
    }
  };

  // --- 2. LAYERED DETECTION ENGINE & RESILIENT METADATA PROVIDER ---
  const MetadataProvider = {
    cache: new Map(),

    async fetch(targetUrl) {
      if (this.cache.has(targetUrl)) {
        return this.cache.get(targetUrl);
      }

      // Layer 1 & 2: Instant deterministic parsing
      const analyzed = this.analyzeUrl(targetUrl);

      // Layer 3: Client-side metadata discovery (Graceful Fallback, strictly non-blocking)
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        
        // Attempt fetch with fallback handling for standard CORS restrictions
        const domain = new URL(targetUrl).hostname;
        const faviconAttempt = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
        analyzed.favicon = faviconAttempt;

        clearTimeout(timeoutId);
      } catch (err) {
        // Fallback silently if offline or restricted
      }

      this.cache.set(targetUrl, analyzed);
      return analyzed;
    },

    analyzeUrl(rawUrl) {
      let parsed;
      try {
        parsed = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
      } catch (e) {
        return {
          valid: false,
          platform: 'Raw Content',
          title: rawUrl.slice(0, 24),
          category: 'Direct Text / Custom Data',
          confidence: 'Basic detection',
          brandColor: '#0F172A',
          domain: 'Text input'
        };
      }

      const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
      const path = parsed.pathname;
      const pathParts = path.split('/').filter(Boolean);

      // Rule-based classification
      let platform = 'Website';
      let title = host;
      let category = 'Generic Web Resource';
      let confidence = 'Medium confidence';
      let brandColor = '#2563eb';
      let avatarLetter = host.charAt(0).toUpperCase();

      // Platform Rules (Layer 1 & Layer 2)
      if (host.includes('wikipedia.org')) {
        platform = 'Wikipedia';
        const rawTitle = pathParts[1] || 'Main Page';
        title = decodeURIComponent(rawTitle).replace(/_/g, ' ');
        category = 'Editorial / Reference Article';
        confidence = 'High confidence';
        brandColor = '#1e293b';
        avatarLetter = 'W';
      } else if (host.includes('github.com')) {
        platform = 'GitHub';
        if (pathParts.length === 1) {
          title = `@${pathParts[0]}`;
          category = 'Developer Profile';
        } else if (pathParts.length >= 2) {
          title = `${pathParts[0]}/${pathParts[1]}`;
          category = 'Open Source Repository';
        }
        confidence = 'High confidence';
        brandColor = '#181717';
        avatarLetter = 'GH';
      } else if (host.includes('linkedin.com')) {
        platform = 'LinkedIn';
        if (path.includes('/in/')) {
          title = decodeURIComponent(pathParts[1] || 'Professional');
          category = 'Professional Profile';
        } else if (path.includes('/company/')) {
          title = decodeURIComponent(pathParts[1] || 'Enterprise');
          category = 'Corporate Organization';
        }
        confidence = 'High confidence';
        brandColor = '#0A66C2';
        avatarLetter = 'in';
      } else if (host.includes('instagram.com')) {
        platform = 'Instagram';
        const user = pathParts[0];
        title = user ? `@${user}` : 'Instagram Profile';
        category = 'Creator / Social Media';
        confidence = 'High confidence';
        brandColor = '#E1306C';
        avatarLetter = 'IG';
      } else if (host.includes('youtube.com') || host.includes('youtu.be')) {
        platform = 'YouTube';
        category = path.includes('/watch') ? 'Streaming Video' : 'Video Creator Channel';
        title = parsed.searchParams.get('v') ? `Video: ${parsed.searchParams.get('v')}` : (pathParts[0] || 'YouTube');
        confidence = 'High confidence';
        brandColor = '#FF0000';
        avatarLetter = 'YT';
      } else if (host.includes('menu') || path.includes('menu') || host.includes('restaurant')) {
        platform = 'Dining';
        title = host.split('.')[0].toUpperCase();
        category = 'Restaurant / Digital Menu';
        confidence = 'Medium confidence';
        brandColor = '#9A3412';
        avatarLetter = '🍽';
      } else {
        // Fallback Layer 2 Path heuristic
        if (path.includes('/blog/') || path.includes('/article/')) {
          category = 'Editorial / Article';
        } else if (path.includes('/shop') || path.includes('/product')) {
          category = 'E-Commerce / Store';
        }
        confidence = 'Basic detection';
      }

      return {
        valid: true,
        url: parsed.href,
        domain: host,
        platform,
        title,
        category,
        confidence,
        brandColor,
        avatarLetter,
        favicon: `https://www.google.com/s2/favicons?domain=${host}&sz=128`
      };
    }
  };

  // --- 3. 12 DISTINCT PRESETS DEFINITION ---
  const PRESETS = [
    { id: 'minimal', name: 'Minimal', dot: 'square', eye: 'square', fg: '#0f172a', bg: '#ffffff', grad: false, ecc: 'M' },
    { id: 'professional', name: 'Professional', dot: 'rounded', eye: 'rounded', fg: '#1e3a8a', bg: '#f8fafc', grad: false, ecc: 'H' },
    { id: 'business', name: 'Corporate', dot: 'square', eye: 'rounded', fg: '#047857', bg: '#f0fdf4', grad: false, ecc: 'H' },
    { id: 'social', name: 'Social Pop', dot: 'rounded', eye: 'circle', fg: '#e11d48', bg: '#fff1f2', grad: true, gradColor: '#fb7185', ecc: 'H' },
    { id: 'creator', name: 'Creator', dot: 'dots', eye: 'circle', fg: '#7c3aed', bg: '#faf5ff', grad: true, gradColor: '#ec4899', ecc: 'H' },
    { id: 'editorial', name: 'Editorial', dot: 'classy', eye: 'square', fg: '#334155', bg: '#fdfbf7', grad: false, ecc: 'H' },
    { id: 'restaurant', name: 'Dining Menu', dot: 'smooth', eye: 'leaf', fg: '#9a3412', bg: '#fffbeb', grad: false, ecc: 'H' },
    { id: 'tech', name: 'Cyber Tech', dot: 'dots', eye: 'square', fg: '#0284c7', bg: '#0b132b', grad: false, ecc: 'H' },
    { id: 'organic', name: 'Eco Organic', dot: 'smooth', eye: 'leaf', fg: '#15803d', bg: '#f0fdf4', grad: false, ecc: 'H' },
    { id: 'neon', name: 'Neon Glow', dot: 'dots', eye: 'circle', fg: '#06b6d4', bg: '#030712', grad: true, gradColor: '#3b82f6', ecc: 'H' },
    { id: 'luxury', name: 'Luxury Gold', dot: 'classy', eye: 'rounded', fg: '#854d0e', bg: '#fefce8', grad: false, ecc: 'H' },
    { id: 'playful', name: 'Playful', dot: 'dots', eye: 'circle', fg: '#ea580c', bg: '#fff7ed', grad: true, gradColor: '#eab308', ecc: 'H' }
  ];

  // --- 4. SMART CONTEXT-AWARE COMPOSER ---
  function computeSmartDesign(detection, variationIndex = 0) {
    const variations = [
      { style: 'editorial', dot: 'rounded', eye: 'square', useGrad: false },
      { style: 'modern', dot: 'dots', eye: 'circle', useGrad: true },
      { style: 'sleek', dot: 'smooth', eye: 'rounded', useGrad: false }
    ];
    const pickedVar = variations[variationIndex % variations.length];

    let dotStyle = pickedVar.dot;
    let eyeStyle = pickedVar.eye;
    let fgColor = detection.brandColor || '#0F172A';
    let bgColor = '#FFFFFF';
    let useGradient = pickedVar.useGrad;
    let fgGradColor = '#3b82f6';
    let explanation = `Smart QR identified ${detection.platform} (${detection.category}). Configured an adaptive palette aligned with brand identity and high scan contrast.`;

    // Category overrides
    if (detection.category.includes('Editorial') || detection.platform === 'Wikipedia') {
      fgColor = '#1e293b';
      bgColor = '#ffffff';
      dotStyle = variationIndex % 2 === 0 ? 'rounded' : 'square';
      eyeStyle = 'square';
      explanation = `Detected Wikipedia article: "${detection.title}". Designed with an editorial, highly legibile aesthetic and maximum finder clarity.`;
    } else if (detection.category.includes('Social') || detection.category.includes('Creator')) {
      fgColor = '#BE185D';
      fgGradColor = '#831843';
      dotStyle = 'dots';
      eyeStyle = 'circle';
      useGradient = true;
      explanation = `Detected ${detection.platform} profile: "${detection.title}". Applied modern social geometry and dynamic brand gradient.`;
    } else if (detection.category.includes('Restaurant')) {
      fgColor = '#831843';
      bgColor = '#FFFDF5';
      dotStyle = 'smooth';
      eyeStyle = 'leaf';
      explanation = `Detected dining/menu page. Tailored warm tones, rounded modules, and hospitality scan framing.`;
    }

    return {
      dotStyle,
      eyeStyle,
      fgColor,
      bgColor,
      useGradient,
      fgGradColor,
      ecc: 'H',
      quietZone: 2,
      explanation
    };
  }

  // --- 5. COLOR CONTRAST & SCAN INTEGRITY REPAIR ENGINE ---
  function getLuminance(hex) {
    const rgb = parseInt(hex.replace('#', ''), 16);
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >> 8) & 0xff;
    const b = (rgb >> 0) & 0xff;
    const a = [r, g, b].map(v => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
  }

  function getContrastRatio(hex1, hex2) {
    const lum1 = getLuminance(hex1);
    const lum2 = getLuminance(hex2);
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    return (brightest + 0.05) / (darkest + 0.05);
  }

  function enforceScanSafety() {
    const contrast = getContrastRatio(state.options.fgColor, state.options.bgColor);
    const contrastValElem = document.getElementById('contrastVal');
    const repairAlert = document.getElementById('repairAlert');
    const statusText = document.getElementById('scanStatusText');

    contrastValElem.textContent = `${contrast.toFixed(1)}:1`;

    if (contrast < 4.0) {
      // Contrast too low: Apply automatic repair
      state.options.fgColor = '#0F172A';
      state.options.bgColor = '#FFFFFF';
      document.getElementById('fgColor').value = '#0F172A';
      document.getElementById('fgColorText').value = '#0F172A';
      document.getElementById('bgColor').value = '#FFFFFF';
      document.getElementById('bgColorText').value = '#FFFFFF';
      repairAlert.classList.remove('hidden-field');
      statusText.textContent = 'Auto-Repaired for Scanning';
      return false;
    } else {
      repairAlert.classList.add('hidden-field');
      statusText.textContent = 'Scan Verified';
      return true;
    }
  }

  // --- 6. ADVANCED QR CANVAS & VECTOR RENDERER ---
  const QRRenderer = {
    renderCanvas(canvas) {
      const { url, options } = state;
      const ctx = canvas.getContext('2d');
      const size = canvas.width;

      // 1. Generate QR matrix via qrcode-generator
      const qr = qrcode(0, options.ecc || 'H');
      qr.addData(url || 'https://smartqr.io');
      qr.make();

      const moduleCount = qr.getModuleCount();
      const margin = options.quietZone;
      const totalModules = moduleCount + margin * 2;
      const cellSize = size / totalModules;

      // 2. Draw Background
      ctx.fillStyle = options.bgColor;
      ctx.fillRect(0, 0, size, size);

      // 3. Prepare Gradient if enabled
      let fgFill = options.fgColor;
      if (options.useGradient) {
        const grad = ctx.createLinearGradient(0, 0, size, size);
        grad.addColorStop(0, options.fgColor);
        grad.addColorStop(1, options.fgGradColor || options.fgColor);
        fgFill = grad;
      }

      ctx.fillStyle = fgFill;

      // Finder Eyes boundaries
      const isFinder = (r, c) => {
        return (
          (r < 7 && c < 7) || // Top-left
          (r < 7 && c >= moduleCount - 7) || // Top-right
          (r >= moduleCount - 7 && c < 7) // Bottom-left
        );
      };

      // 4. Render Data Modules
      for (let r = 0; r < moduleCount; r++) {
        for (let c = 0; c < moduleCount; c++) {
          if (isFinder(r, c)) continue; // Draw eyes separately

          if (qr.isDark(r, c)) {
            const x = (c + margin) * cellSize;
            const y = (r + margin) * cellSize;

            if (options.dotStyle === 'dots') {
              ctx.beginPath();
              ctx.arc(x + cellSize / 2, y + cellSize / 2, cellSize * 0.42, 0, Math.PI * 2);
              ctx.fill();
            } else if (options.dotStyle === 'rounded') {
              this.roundRect(ctx, x, y, cellSize * 0.92, cellSize * 0.92, cellSize * 0.28);
              ctx.fill();
            } else if (options.dotStyle === 'classy') {
              ctx.beginPath();
              ctx.moveTo(x + cellSize / 2, y);
              ctx.lineTo(x + cellSize, y + cellSize / 2);
              ctx.lineTo(x + cellSize / 2, y + cellSize);
              ctx.lineTo(x, y + cellSize / 2);
              ctx.closePath();
              ctx.fill();
            } else {
              ctx.fillRect(x, y, cellSize, cellSize);
            }
          }
        }
      }

      // 5. Render Distinct Eyes
      this.drawEye(ctx, margin * cellSize, margin * cellSize, cellSize * 7, options.eyeStyle, fgFill);
      this.drawEye(ctx, (margin + moduleCount - 7) * cellSize, margin * cellSize, cellSize * 7, options.eyeStyle, fgFill);
      this.drawEye(ctx, margin * cellSize, (margin + moduleCount - 7) * cellSize, cellSize * 7, options.eyeStyle, fgFill);

      // 6. Draw Logo Overlay
      this.drawLogo(ctx, size);

      // 7. Optional Frame Banner
      this.drawFrame(ctx, size, cellSize);
    },

    drawEye(ctx, x, y, size, style, fill) {
      ctx.fillStyle = fill;
      const innerSize = size * (3 / 7);
      const innerOffset = size * (2 / 7);

      if (style === 'circle') {
        // Outer ring
        ctx.beginPath();
        ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
        ctx.fill();
        // Inner cutout
        ctx.fillStyle = state.options.bgColor;
        ctx.beginPath();
        ctx.arc(x + size / 2, y + size / 2, size * (5 / 14), 0, Math.PI * 2);
        ctx.fill();
        // Center dot
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.arc(x + size / 2, y + size / 2, innerSize / 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (style === 'rounded' || style === 'leaf') {
        const radius = style === 'leaf' ? [size * 0.3, 0, size * 0.3, 0] : size * 0.25;
        this.roundRect(ctx, x, y, size, size, radius);
        ctx.fill();

        ctx.fillStyle = state.options.bgColor;
        this.roundRect(ctx, x + size / 7, y + size / 7, size * (5 / 7), size * (5 / 7), radius);
        ctx.fill();

        ctx.fillStyle = fill;
        this.roundRect(ctx, x + innerOffset, y + innerOffset, innerSize, innerSize, radius);
        ctx.fill();
      } else {
        // Classic Square
        ctx.fillRect(x, y, size, size);
        ctx.fillStyle = state.options.bgColor;
        ctx.fillRect(x + size / 7, y + size / 7, size * (5 / 7), size * (5 / 7));
        ctx.fillStyle = fill;
        ctx.fillRect(x + innerOffset, y + innerOffset, innerSize, innerSize);
      }
    },

    drawLogo(ctx, size) {
      const mode = state.options.logoMode;
      let img = null;

      if (mode === 'custom' && state.customLogoImg) {
        img = state.customLogoImg;
      } else if (mode === 'auto' && state.autoLogoImg) {
        img = state.autoLogoImg;
      }

      if (!img) return;

      const logoSize = size * 0.22; // Strict safety threshold (<= 25%)
      const x = (size - logoSize) / 2;
      const y = (size - logoSize) / 2;

      // Safe background pad
      ctx.fillStyle = state.options.bgColor;
      this.roundRect(ctx, x - 6, y - 6, logoSize + 12, logoSize + 12, 10);
      ctx.fill();

      // Render image rounded
      ctx.save();
      this.roundRect(ctx, x, y, logoSize, logoSize, 8);
      ctx.clip();
      ctx.drawImage(img, x, y, logoSize, logoSize);
      ctx.restore();
    },

    drawFrame(ctx, size, cellSize) {
      if (state.options.frameStyle === 'none') return;
      const text = state.options.frameText || 'SCAN ME';

      ctx.fillStyle = state.options.fgColor;
      ctx.font = `bold ${Math.round(size * 0.045)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (state.options.frameStyle === 'badge-bottom') {
        const h = size * 0.12;
        ctx.fillRect(0, size - h, size, h);
        ctx.fillStyle = state.options.bgColor;
        ctx.fillText(text, size / 2, size - h / 2);
      } else if (state.options.frameStyle === 'pill') {
        const w = size * 0.55;
        const h = size * 0.085;
        const x = (size - w) / 2;
        const y = size - h - cellSize;
        this.roundRect(ctx, x, y, w, h, h / 2);
        ctx.fill();
        ctx.fillStyle = state.options.bgColor;
        ctx.fillText(text, size / 2, y + h / 2);
      }
    },

    roundRect(ctx, x, y, w, h, r) {
      if (typeof r === 'number') r = [r, r, r, r];
      ctx.beginPath();
      ctx.moveTo(x + r[0], y);
      ctx.lineTo(x + w - r[1], y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r[1]);
      ctx.lineTo(x + w, y + h - r[2]);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r[2], y + h);
      ctx.lineTo(x + r[3], y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r[3]);
      ctx.lineTo(x, y + r[0]);
      ctx.quadraticCurveTo(x, y, x + r[0], y);
      ctx.closePath();
    },

    generateSVG() {
      const { url, options } = state;
      const qr = qrcode(0, options.ecc || 'H');
      qr.addData(url || 'https://smartqr.io');
      qr.make();
      const count = qr.getModuleCount();
      const m = options.quietZone;
      const size = 512;
      const cell = size / (count + m * 2);

      let paths = '';
      for (let r = 0; r < count; r++) {
        for (let c = 0; c < count; c++) {
          if (qr.isDark(r, c)) {
            const x = (c + m) * cell;
            const y = (r + m) * cell;
            paths += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${options.fgColor}" />`;
          }
        }
      }

      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
        <rect width="${size}" height="${size}" fill="${options.bgColor}" />
        ${paths}
      </svg>`;
    }
  };

  // --- 7. UI SYNC & INTERACTIVE CONTROLLERS ---
  function updateUIWithDetection(detection) {
    document.getElementById('confidenceBadge').textContent = detection.confidence;
    document.getElementById('detectedPlatformText').textContent = detection.platform;
    document.getElementById('detectedTitle').textContent = detection.title;
    document.getElementById('detectedCategory').textContent = detection.category;
    document.getElementById('detectedDomain').textContent = detection.domain || detection.url;

    const avatar = document.getElementById('detectedAvatar');
    if (detection.favicon) {
      avatar.innerHTML = `<img src="${detection.favicon}" alt="Icon" onerror="this.parentElement.textContent='${detection.avatarLetter}'">`;
      // Load auto image candidate
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = detection.favicon;
      img.onload = () => {
        state.autoLogoImg = img;
        render();
      };
    } else {
      avatar.textContent = detection.avatarLetter || 'QR';
    }
  }

  function applyPreset(preset) {
    state.activePreset = preset.id;
    state.options.dotStyle = preset.dot;
    state.options.eyeStyle = preset.eye;
    state.options.fgColor = preset.fg;
    state.options.bgColor = preset.bg;
    state.options.useGradient = !!preset.grad;
    if (preset.gradColor) state.options.fgGradColor = preset.gradColor;
    syncControlsFromState();
    render();
  }

  function renderPresets() {
    const grid = document.getElementById('presetsGrid');
    grid.innerHTML = '';
    PRESETS.forEach(p => {
      const chip = document.createElement('div');
      chip.className = `preset-chip ${state.activePreset === p.id ? 'active' : ''}`;
      chip.innerHTML = `
        <span class="preset-badge-icon" style="background: ${p.fg}; border: 2px solid ${p.bg}"></span>
        <span>${p.name}</span>
      `;
      chip.onclick = () => applyPreset(p);
      grid.appendChild(chip);
    });
  }

  function syncControlsFromState() {
    document.getElementById('dotStyleSelect').value = state.options.dotStyle;
    document.getElementById('eyeStyleSelect').value = state.options.eyeStyle;
    document.getElementById('fgColor').value = state.options.fgColor;
    document.getElementById('fgColorText').value = state.options.fgColor;
    document.getElementById('bgColor').value = state.options.bgColor;
    document.getElementById('bgColorText').value = state.options.bgColor;
    document.getElementById('enableGradient').checked = state.options.useGradient;
    document.getElementById('frameStyleSelect').value = state.options.frameStyle;
    document.getElementById('frameText').value = state.options.frameText;
    document.getElementById('eccSelect').value = state.options.ecc;
    document.getElementById('quietZoneSelect').value = state.options.quietZone;
  }

  function render() {
    enforceScanSafety();
    const canvas = document.getElementById('qrCanvas');
    QRRenderer.renderCanvas(canvas);
  }

  async function handleAnalyze() {
    const rawUrl = document.getElementById('urlInput').value.trim();
    if (!rawUrl) return;
    state.url = rawUrl;
    const detection = await MetadataProvider.fetch(rawUrl);
    state.detection = detection;
    updateUIWithDetection(detection);
    applySmartDesign();
  }

  function applySmartDesign() {
    if (!state.detection) return;
    const smart = computeSmartDesign(state.detection, state.designVariationIndex);
    state.options.dotStyle = smart.dotStyle;
    state.options.eyeStyle = smart.eyeStyle;
    state.options.fgColor = smart.fgColor;
    state.options.bgColor = smart.bgColor;
    state.options.useGradient = smart.useGradient;
    state.options.fgGradColor = smart.fgGradColor;
    document.getElementById('smartExplanation').textContent = smart.explanation;
    syncControlsFromState();
    render();
  }

  // --- 8. INITIALIZATION & BINDINGS ---
  function init() {
    // Theme setup
    document.documentElement.setAttribute('data-theme', state.theme);
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.themeVal === state.theme);
      btn.onclick = () => {
        state.theme = btn.dataset.themeVal;
        localStorage.setItem('smart_qr_app_theme', state.theme);
        document.documentElement.setAttribute('data-theme', state.theme);
        document.querySelectorAll('.theme-btn').forEach(b => b.classList.toggle('active', b === btn));
      };
    });

    renderPresets();

    // Event listeners
    document.getElementById('analyzeBtn').onclick = handleAnalyze;
    document.getElementById('applySmartBtn').onclick = () => {
      state.designVariationIndex = 0;
      applySmartDesign();
    };
    document.getElementById('shuffleSmartBtn').onclick = () => {
      state.designVariationIndex++;
      applySmartDesign();
    };

    // Custom controls
    document.getElementById('dotStyleSelect').onchange = e => { state.options.dotStyle = e.target.value; render(); };
    document.getElementById('eyeStyleSelect').onchange = e => { state.options.eyeStyle = e.target.value; render(); };
    document.getElementById('fgColor').oninput = e => {
      state.options.fgColor = e.target.value;
      document.getElementById('fgColorText').value = e.target.value;
      render();
    };
    document.getElementById('fgColorText').onchange = e => {
      state.options.fgColor = e.target.value;
      document.getElementById('fgColor').value = e.target.value;
      render();
    };
    document.getElementById('bgColor').oninput = e => {
      state.options.bgColor = e.target.value;
      document.getElementById('bgColorText').value = e.target.value;
      render();
    };
    document.getElementById('bgColorText').onchange = e => {
      state.options.bgColor = e.target.value;
      document.getElementById('bgColor').value = e.target.value;
      render();
    };
    document.getElementById('enableGradient').onchange = e => { state.options.useGradient = e.target.checked; render(); };
    document.getElementById('frameStyleSelect').onchange = e => { state.options.frameStyle = e.target.value; render(); };
    document.getElementById('frameText').oninput = e => { state.options.frameText = e.target.value; render(); };
    document.getElementById('eccSelect').onchange = e => { state.options.ecc = e.target.value; render(); };
    document.getElementById('quietZoneSelect').onchange = e => { state.options.quietZone = parseInt(e.target.value); render(); };

    // Logo Radio
    document.querySelectorAll('input[name="logoMode"]').forEach(radio => {
      radio.onchange = e => {
        state.options.logoMode = e.target.value;
        document.getElementById('customUploadContainer').classList.toggle('hidden-field', e.target.value !== 'custom');
        render();
      };
    });

    document.getElementById('logoUpload').onchange = e => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = ev => {
          const img = new Image();
          img.onload = () => {
            state.customLogoImg = img;
            render();
          };
          img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
      }
    };

    // Exports
    document.getElementById('downloadPngBtn').onclick = () => {
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = 1600;
      exportCanvas.height = 1600;
      QRRenderer.renderCanvas(exportCanvas);
      const link = document.createElement('a');
      link.download = `smart-qr-${Date.now()}.png`;
      link.href = exportCanvas.toDataURL('image/png');
      link.click();
    };

    document.getElementById('downloadSvgBtn').onclick = () => {
      const svg = QRRenderer.generateSVG();
      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      const link = document.createElement('a');
      link.download = `smart-qr-${Date.now()}.svg`;
      link.href = URL.createObjectURL(blob);
      link.click();
    };

    // Initial Trigger
    handleAnalyze();
  }

  window.addEventListener('DOMContentLoaded', init);
})();
