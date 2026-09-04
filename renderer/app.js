(() => {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const messages = $('#messages');
  const input = $('#input');
  const btnSend = $('#btn-send');
  const modelSelect = $('#model-select');
  const sessionList = $('#session-list');
  const currentTitle = $('#current-title');

  const DEFAULT_MODELS = [
    { name: 'DeepSeek-V4-Flash', model: 'deepseek-v4-flash' },
    { name: 'DeepSeek-V4-Pro', model: 'deepseek-v4-pro' },
    { name: 'DeepSeek-V3', model: 'deepseek-chat' },
    { name: 'DeepSeek-R1', model: 'deepseek-reasoner' },
  ];

  const CLUSTER_COLORS = [[240,130,0],[0,168,84],[240,19,13]];

  const WELCOME_WORDS = [
    { t: '欢迎', w: 0.65 },
    { t: 'WELCOME', w: 1.00 },
    { t: 'ようこそ', w: 1.00 },
    { t: '환영', w: 0.65 },
    { t: 'BEM-VINDO', w: 1.00 },
  ];
  let welcomeIndex = 0;
  let welcomeTimer = null;

  let artMode = false;   // 艺术模式：极简画布呈现回答
  let artAnimController = null; // 艺术模式回答动画控制器
  let artSpeed = 3;      // 艺术模式词语弹出速度档位（1-5，3 为默认中速）
  let artStyle = 'standard'; // 艺术模式回复风格：brief / standard / complex

  let config = { baseUrl: 'https://api.deepseek.com', apiKey: '', model: 'deepseek-chat', autoLaunch: false, workspaceDir: '' };
  let sessions = [];       // [{id,title,messages:[{role,content,reasoning?}]}]
  let activeId = null;
  let busy = false;
  let sidebarCluster = null;
  let sendCluster = null;
  let aiRoleClusters = [];
  let exportMode = false;
  let exportSelectedIds = new Set();

  const LS_KEY = 'ai-chat-sessions-v1';
  const LS_THEME = 'ai-chat-theme';
  const LS_LANG = 'ai-chat-lang';
  const LS_ART = 'ai-chat-art-mode';
  const LS_ART_SPEED = 'ai-chat-art-speed';
  const LS_ART_STYLE = 'ai-chat-art-style';
  const LS_COLLAPSE = 'ai-chat-sidebar-collapsed';
  const LS_VERSION = 'ai-chat-last-version';

  // 艺术模式速度档位 → 动画时长倍率（speed=3 为默认 1.0x）
  const ART_SPEED_LABELS_ZH = ['', '极慢', '慢', '中', '快', '极速'];
  const ART_SPEED_LABELS_EN = ['', 'Slowest', 'Slow', 'Medium', 'Fast', 'Fastest'];
  function getArtSpeedMultiplier() {
    // 1→2.0x（慢），2→1.4x，3→1.0x，4→0.65x，5→0.4x（快）
    return [2.0, 1.4, 1.0, 0.65, 0.4][artSpeed - 1] || 1.0;
  }
  function getArtSpeedLabel() {
    const arr = lang === 'en' ? ART_SPEED_LABELS_EN : ART_SPEED_LABELS_ZH;
    return arr[artSpeed] || arr[3];
  }

  // ---------- i18n ----------
  const I18N = {
    zh: {
      newChat: '+ 新对话', newChatTitle: '新对话',
      export: '⬇ 导出', exportTitle: '导出会话为 JSON',
      import: '⬆ 导入', importTitle: '从 JSON 导入会话',
      clearChat: '🗑 清空当前会话', exportMd: '📝 导出为 Markdown',
      toastCleared: '已清空当前会话', toastExportMd: '已导出 Markdown：',
      noContentToExport: '暂无内容可导出',
      settings: '⚙ 设置', pin: '窗口置顶', theme: '切换主题', selectModel: '选择模型',
      collapseSidebar: '收起侧边栏', expandSidebar: '展开侧边栏',
      exportSessions: '导出聊天记录', importSessions: '导入聊天记录',
      exportSelected: '导出选中', cancelExport: '取消',
      inputPlaceholder: '输入消息，Enter 发送，Shift+Enter 换行',
      send: '发送', stop: '停止',
      settingsTitle: '设置', navApi: 'API配置', navGeneral: '通用', navAbout: '关于',
      lblBaseUrl: 'API 地址', lblApiKey: 'API Key',
      getKeyLink: '如何获取 API Key？', getKeyDesc: '前往 DeepSeek 开放平台注册并创建',
      lblModel: '模型',
      lblAutoLaunch: '开机自启', descAutoLaunch: '登录 Windows 时自动启动 Samaritan',
      lblArtMode: '启用艺术模式', descArtMode: '以极简艺术画布呈现回答，不显示历史消息',
      lblArtSpeed: '词语弹出速度', descArtSpeed: '控制艺术模式回答时词语打字与删除的速度',
      lblArtStyle: '回复风格', descArtStyle: '决定艺术模式下 AI 回答的长度与详细程度',
      artStyleBrief: '简短', artStyleStandard: '标准', artStyleComplex: '复杂',
      navArt: '艺术模式',
      lblLang: '界面语言', lblWorkspace: '默认工作空间目录',
      btnBrowse: '浏览',
      btnCancel: '取消', btnSave: '保存', closeBtn: '关闭',
      currentVersion: '当前版本', checkUpdate: '检查更新', checkingUpdate: '正在检查更新…',
      alreadyLatest: '已是最新版本', updateAvailable: '发现新版本 {version}', updateSize: '大小：{size}',
      updateNow: '立即更新', updateLater: '稍后', updateDownloading: '正在下载更新… {percent}%',
      updateDownloaded: '下载完成，点击立即更新以应用', updateFailed: '检查更新失败：{error}',
      manualDownload: '手动下载',
      whatsNew: '更新公告', gotIt: '知道了',
      aboutBody: '测试项目，内容由AI生成，请核实重要信息。',
      roleUser: '我', roleAi: 'AI',
      thinkingHint: '正在思考', thinkingSummary: '💭 思考过程',
      copy: '复制', copied: '已复制', copyMsg: '复制消息', copyCode: '复制代码', delTitle: '删除', edit: '编辑',
      fold: '收起', unfold: '展开',
      noSessions: '暂无对话',
      toastExported: '已导出：', toastExportFailed: '导出失败：',
      toastImported: '已导入 {n} 个会话', toastImportFailed: '导入失败：文件格式不正确',
      toastImageInserted: '已插入 {n} 张图片',
      exportDialogTitle: '导出会话记录', importDialogTitle: '导入会话记录',
      errNoApiKey: '未配置 API Key，请在设置中填写',
      autoTitlePlaceholder: '新对话',
    },
    en: {
      newChat: '+ New Chat', newChatTitle: 'New Chat',
      export: '⬇ Export', exportTitle: 'Export sessions as JSON',
      import: '⬆ Import', importTitle: 'Import sessions from JSON',
      clearChat: '🗑 Clear chat', exportMd: '📝 Export as Markdown',
      toastCleared: 'Current chat cleared', toastExportMd: 'Exported Markdown: ',
      noContentToExport: 'No content to export',
      settings: '⚙ Settings', pin: 'Always on top', theme: 'Toggle theme', selectModel: 'Select model',
      collapseSidebar: 'Collapse sidebar', expandSidebar: 'Expand sidebar',
      exportSessions: 'Export chat history', importSessions: 'Import chat history',
      exportSelected: 'Export selected', cancelExport: 'Cancel',
      inputPlaceholder: 'Type a message, Enter to send, Shift+Enter for newline',
      send: 'Send', stop: 'Stop',
      settingsTitle: 'Settings', navApi: 'API', navGeneral: 'General', navAbout: 'About',
      lblBaseUrl: 'API Base URL', lblApiKey: 'API Key',
      getKeyLink: 'How to get API Key?', getKeyDesc: 'Go to DeepSeek platform to register and create',
      lblModel: 'Model',
      lblAutoLaunch: 'Auto launch', descAutoLaunch: 'Launch Samaritan on Windows login',
      lblArtMode: 'Enable Art Mode', descArtMode: 'Show answers on a minimal art canvas, no chat history',
      lblArtSpeed: 'Word appearance speed', descArtSpeed: 'Control how fast words type and delete in Art Mode',
      lblArtStyle: 'Response style', descArtStyle: 'Decides the length and detail level of AI responses in Art Mode',
      artStyleBrief: 'Brief', artStyleStandard: 'Standard', artStyleComplex: 'Complex',
      navArt: 'Art Mode',
      lblLang: 'Language', lblWorkspace: 'Default workspace folder',
      btnBrowse: 'Browse',
      btnCancel: 'Cancel', btnSave: 'Save', closeBtn: 'Close',
      currentVersion: 'Current version', checkUpdate: 'Check for updates', checkingUpdate: 'Checking for updates…',
      alreadyLatest: 'Already up to date', updateAvailable: 'New version {version} available', updateSize: 'Size: {size}',
      updateNow: 'Update now', updateLater: 'Later', updateDownloading: 'Downloading update… {percent}%',
      updateDownloaded: 'Download complete, click Update now to apply', updateFailed: 'Update check failed: {error}',
      manualDownload: 'Manual download',
      whatsNew: "What's New", gotIt: 'Got it',
      aboutBody: 'Test project. Content is AI-generated, please verify important information.',
      roleUser: 'Me', roleAi: 'AI',
      thinkingHint: 'Thinking', thinkingSummary: '💭 Reasoning',
      copy: 'Copy', copied: 'Copied', copyMsg: 'Copy message', copyCode: 'Copy code', delTitle: 'Delete', edit: 'Edit',
      fold: 'Collapse', unfold: 'Expand',
      noSessions: 'No chats',
      toastExported: 'Exported: ', toastExportFailed: 'Export failed: ',
      toastImported: 'Imported {n} sessions', toastImportFailed: 'Import failed: invalid file format',
      toastImageInserted: 'Inserted {n} image(s)',
      exportDialogTitle: 'Export Sessions', importDialogTitle: 'Import Sessions',
      errNoApiKey: 'API Key not configured, please set it in Settings',
      autoTitlePlaceholder: 'New Chat',
    },
  };

  let lang = 'zh';
  function t(key, vars) {
    const dict = I18N[lang] || I18N.zh;
    let s = dict[key];
    if (s === undefined) s = I18N.zh[key] || key;
    if (vars) s = s.replace(/\{([^{}]+)\}/g, (m, k) => vars[k] !== undefined ? vars[k] : m);
    return s;
  }

  function applyI18n() {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    $$('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      const attr = el.dataset.i18nAttr || 'text';
      if (attr === 'text') el.textContent = t(key);
      else if (attr === 'placeholder') el.setAttribute('placeholder', t(key));
      else if (attr === 'title') el.setAttribute('title', t(key));
    });
    // 动态按钮状态刷新
    const sendText = btnSend.querySelector('.send-text');
    if (sendText) sendText.textContent = busy ? t('stop') : t('send');
  }

  function setLanguage(l) {
    lang = I18N[l] ? l : 'zh';
    try { localStorage.setItem(LS_LANG, lang); } catch (e) {}
    applyI18n();
    try { window.api.setLang(lang); } catch (e) {}
  }

  // ---------- 会话持久化 ----------
  function loadSessions() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      const data = raw ? JSON.parse(raw) : { sessions: [], activeId: null };
      sessions = data.sessions || [];
      activeId = data.activeId || null;
    } catch (e) {
      sessions = []; activeId = null;
    }
  }
  function saveSessions() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ sessions, activeId }));
    } catch (e) {}
  }

  function activeSession() {
    return sessions.find(s => s.id === activeId) || null;
  }

  function newSession() {
    const s = { id: 's' + Date.now(), title: t('newChatTitle'), messages: [] };
    sessions.unshift(s);
    activeId = s.id;
    saveSessions();
    renderSessionList();
    renderActiveSession();
    currentTitle.textContent = s.title;
    input.focus();
  }

  function deleteSession(id) {
    sessions = sessions.filter(s => s.id !== id);
    if (activeId === id) {
      activeId = sessions.length ? sessions[0].id : null;
    }
    saveSessions();
    renderSessionList();
    renderActiveSession();
    const cur = activeSession();
    currentTitle.textContent = cur ? cur.title : t('newChatTitle');
  }

  function renderSessionList() {
    sessionList.innerHTML = '';
    if (sidebarCluster) { sidebarCluster.stop(); sidebarCluster = null; }
    if (!sessions.length) {
      sessionList.innerHTML = '<div style="padding:12px;color:var(--muted);font-size:12.5px;">' + escapeHtml(t('noSessions')) + '</div>';
      return;
    }
    sessions.forEach(s => {
      const item = document.createElement('div');
      item.className = 'session-item' + (s.id === activeId ? ' active' : '') + (exportMode ? ' export-mode' : '');

      if (exportMode) {
        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.className = 's-check';
        chk.checked = exportSelectedIds.has(s.id);
        chk.addEventListener('click', (e) => { e.stopPropagation(); });
        chk.addEventListener('change', () => {
          if (chk.checked) exportSelectedIds.add(s.id);
          else exportSelectedIds.delete(s.id);
        });
        item.appendChild(chk);
      }

      const title = document.createElement('span');
      title.className = 's-title';
      title.textContent = s.title;
      item.appendChild(title);

      if (!exportMode) {
        if (busy && s.id === activeId) {
          const canvas = document.createElement('canvas');
          canvas.className = 's-cluster';
          item.appendChild(canvas);
          sidebarCluster = new LoadingCluster(canvas, { cell: 4, gap: 1, glow: 0.35, halo: 10, colors: [[0,168,84]] });
          sidebarCluster.start();
        } else {
          const del = document.createElement('button');
          del.className = 's-del';
          del.textContent = '✕';
          del.title = t('delTitle');
          del.addEventListener('click', (e) => { e.stopPropagation(); deleteSession(s.id); });
          item.appendChild(del);
        }
      }

      if (exportMode) {
        item.addEventListener('click', () => {
          chk.checked = !chk.checked;
          if (chk.checked) exportSelectedIds.add(s.id);
          else exportSelectedIds.delete(s.id);
        });
      } else {
        item.addEventListener('click', () => switchSession(s.id));
      }
      sessionList.appendChild(item);
    });
  }

  function switchSession(id) {
    if (busy) return;
    activeId = id;
    saveSessions();
    renderSessionList();
    renderActiveSession();
    const cur = activeSession();
    currentTitle.textContent = cur ? cur.title : t('newChatTitle');
  }

  // ---------- 消息渲染 ----------
  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function ensureInner() {
    let inner = messages.querySelector('.messages-inner');
    if (!inner) {
      inner = document.createElement('div');
      inner.className = 'messages-inner';
      messages.appendChild(inner);
    }
    return inner;
  }

  function renderWelcomeWord() {
    const title = $('#welcome-title');
    if (!title) return;
    title.classList.remove('answer');
    title.style.fontSize = '';
    const item = WELCOME_WORDS[welcomeIndex];
    title.innerHTML = '';
    title.style.width = `calc(var(--welcome-line-w) * ${item.w})`;
    [...item.t].forEach(ch => {
      const s = document.createElement('span');
      s.textContent = ch === ' ' ? '\u00A0' : ch;
      title.appendChild(s);
    });
  }

  function startWelcome() {
    renderWelcomeWord();
    if (welcomeTimer) return;
    welcomeTimer = setInterval(() => {
      const title = $('#welcome-title');
      if (!title) { stopWelcome(); return; }
      title.classList.add('fade');
      setTimeout(() => {
        welcomeIndex = (welcomeIndex + 1) % WELCOME_WORDS.length;
        renderWelcomeWord();
        title.classList.remove('fade');
      }, 300);
    }, 1800);
  }

  function stopWelcome() {
    if (welcomeTimer) { clearInterval(welcomeTimer); welcomeTimer = null; }
  }

  // 艺术画布结构：WELCOME 文字 + 横线 + 标记（红色三角形 / 3×3 动画）
  function artCanvasHTML() {
    return '<div class="empty">' +
      '<div class="welcome-title" id="welcome-title"></div>' +
      '<div class="welcome-line"></div>' +
      '<div class="welcome-mark"><div class="welcome-tri"></div><canvas class="art-cluster"></canvas></div>' +
      '</div>';
  }

  // 语义拆分：尽量按词切分（中文用 Intl.Segmenter 分词，英文/数字整体保留，避免中英混拆）
  function splitSemanticTokens(text) {
    const raw = (text || '').replace(/!\[[^\]]*\]\([^)]+\)/g, '[图片]').trim();
    if (!raw) return [];
    const tokens = [];
    // 1) 优先 Intl.Segmenter 中文分词（按语义切词，如「我」「是」「AI」「没有」「心情」）
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      try {
        const seg = new Intl.Segmenter('zh-CN', { granularity: 'word' });
        let got = false;
        for (const s of seg.segment(raw)) {
          const segText = s.segment;
          if (!segText) continue;
          // 保留有语义的词（中文词、英文/数字单词），丢弃纯标点/空白
          if (s.isWordLike || /[a-zA-Z0-9]/.test(segText) || /[\u3040-\u30ff\u4e00-\u9fa5]/.test(segText)) {
            tokens.push(segText);
            got = true;
          }
        }
        if (got && tokens.length) return tokens;
      } catch (e) {}
    }
    // 2) 降级：按字符类型切分，连续中文拆成单字短块，保证逐词动效；英文/数字整体保留
    let latin = '';
    const flushLatin = () => { if (latin) { tokens.push(latin); latin = ''; } };
    for (const ch of raw) {
      if (/[a-zA-Z0-9._\-]/.test(ch)) {
        latin += ch;
      } else {
        flushLatin();
        if (/[\u3040-\u30ff\u4e00-\u9fa5]/.test(ch)) tokens.push(ch);
        // 纯标点直接丢弃
      }
    }
    flushLatin();
    if (!tokens.length) return [raw];
    return tokens;
  }

  // 艺术模式：逐个词「打字出现 → 停顿 → 删除 → 下一个」，最后一个词保留
  function playArtTokens(title, tokens) {
    if (!tokens.length) { title.textContent = ''; return; }
    let cancelled = false;
    let activeTimer = null;
    const controller = {
      cancel: () => {
        cancelled = true;
        if (activeTimer) { clearTimeout(activeTimer); activeTimer = null; }
      }
    };
    artAnimController = controller;
    title.classList.add('typing');
    // 立即清空，避免生成过程中累积的完整回答在动画第一帧前闪现
    title.textContent = '';

    const wait = (ms) => new Promise((resolve) => {
      if (cancelled) return resolve();
      activeTimer = setTimeout(resolve, ms);
    });

    const mul = getArtSpeedMultiplier();
    const TYPE_MS = Math.max(8, Math.round(40 * mul));
    const DELETE_MS = Math.max(4, Math.round(20 * mul));
    const HOLD_MS = Math.max(40, Math.round(120 * mul));
    const GAP_MS = Math.max(10, Math.round(30 * mul));

    const typeWord = async (word) => {
      for (let i = 1; i <= word.length; i++) {
        if (cancelled) return;
        title.textContent = word.slice(0, i);
        await wait(TYPE_MS);
      }
    };

    const deleteWord = async (word) => {
      for (let i = word.length - 1; i >= 0; i--) {
        if (cancelled) return;
        title.textContent = word.slice(0, i);
        await wait(DELETE_MS);
      }
    };

    (async () => {
      for (let idx = 0; idx < tokens.length; idx++) {
        if (cancelled) return;
        await typeWord(tokens[idx]);
        if (cancelled) return;
        await wait(HOLD_MS);
        if (idx < tokens.length - 1) {
          if (cancelled) return;
          await deleteWord(tokens[idx]);
          if (cancelled) return;
          await wait(GAP_MS);
        }
      }
      title.classList.remove('typing');
      artAnimController = null;
    })();
  }

  // 把回答以极简小字号渲染到画布文字区
  function renderArtAnswer(text) {
    const title = $('#welcome-title');
    if (!title) return;
    const clean = (text || '').trim().replace(/!\[[^\]]*\]\([^)]+\)/g, '[图片]');
    title.classList.remove('fade');
    title.classList.add('answer');
    title.style.width = 'var(--welcome-line-w)';
    title.style.fontSize = '';
    if (artAnimController) artAnimController.cancel();

    if (busy) {
      // 生成过程中直接显示当前累积文本，不播放逐词动画
      title.textContent = clean;
      title.classList.remove('typing');
      return;
    }
    const tokens = splitSemanticTokens(clean);
    playArtTokens(title, tokens);
  }

  function artSystemPrompt() {
    const isEn = lang === 'en';
    const map = {
      brief: isEn
        ? 'Answer extremely concisely in plain text: at most 30 words, no lists, no code blocks, no headings, no markdown. Give only the direct answer.'
        : '请用极简方式回答：总字数不超过40个汉字，纯文本，不要使用列表、代码块、标题或任何 Markdown 格式，只给出核心结论。',
      standard: isEn
        ? 'Answer clearly and naturally in plain text: within about 80 words, no lists, no code blocks, no headings, no markdown. Keep it direct and easy to read.'
        : '请用清晰自然的方式回答：总字数不超过120个汉字，纯文本，不要使用列表、代码块、标题或任何 Markdown 格式，条理清楚，便于阅读。',
      complex: isEn
        ? 'Answer in detail in plain text: within about 200 words, you may use short sentences or brief paragraphs separated by line breaks, but do not use lists, headings, code blocks, or any markdown. Provide a thorough response with key context.'
        : '请用较详细的方式回答：总字数不超过300个汉字，允许用换行分隔短句或小段，但不要使用列表、标题、代码块或任何 Markdown 格式，给出包含关键背景的完整回答。',
    };
    return map[artStyle] || map.standard;
  }

  function stopAllAiRoleClusters() {
    aiRoleClusters.forEach(lc => lc.stop());
    aiRoleClusters = [];
  }

  function makeAiRole() {
    const role = document.createElement('div');
    role.className = 'role';
    const canvas = document.createElement('canvas');
    canvas.className = 'role-cluster';
    role.appendChild(canvas);
    const lc = new LoadingCluster(canvas, { cell: 4, gap: 1, glow: 0.35, halo: 8, colors: [[0,168,84]] });
    lc.start();
    aiRoleClusters.push(lc);
    return role;
  }

  function renderActiveSession() {
    stopAllAiRoleClusters();
    const inner = ensureInner();
    inner.innerHTML = '';
    const s = activeSession();
    if (artMode) {
      inner.innerHTML = artCanvasHTML();
      const last = s && s.messages.length ? s.messages[s.messages.length - 1] : null;
      if (last && last.role === 'assistant' && (last.content || last.reasoning)) {
        renderArtAnswer(last.content || last.reasoning);
      } else {
        startWelcome();
      }
      return;
    }
    if (!s || !s.messages.length) {
      inner.innerHTML = artCanvasHTML();
      startWelcome();
      return;
    }
    stopWelcome();
    s.messages.forEach((m, idx) => {
      if (m.role === 'user') appendUserBubble(inner, m, idx);
      else appendAiBubble(inner, m, idx);
    });
    scrollBottom(true);
  }

  function formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, '0');
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function appendUserBubble(inner, m, idx) {
    const text = typeof m === 'string' ? m : (m.content || '');
    const ts = typeof m === 'object' ? m.createdAt : null;
    const wrap = document.createElement('div');
    wrap.className = 'msg user';
    wrap.innerHTML = '<div class="role-row"><span class="role">' + escapeHtml(t('roleUser')) + '</span></div><div class="bubble"></div>';
    const bubble = wrap.querySelector('.bubble');
    bubble._rawText = text;
    bubble.innerHTML = window.renderMarkdown(text);
    const actions = document.createElement('div');
    actions.className = 'msg-actions';
    if (ts) {
      const time = document.createElement('span');
      time.className = 'action-time';
      time.textContent = formatTime(ts);
      actions.appendChild(time);
    }
    if (idx != null) {
      const editBtn = document.createElement('button');
      editBtn.className = 'action-edit';
      editBtn.title = t('edit') || '编辑';
      editBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';
      editBtn.addEventListener('click', (e) => { e.stopPropagation(); startEditUserMessage(bubble, idx); });
      actions.appendChild(editBtn);
    }
    const copyBtn = document.createElement('button');
    copyBtn.className = 'action-copy';
    copyBtn.title = t('copyMsg');
    copyBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
    copyBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await window.api.copyText(bubble._rawText || '');
      toast(t('copied'));
    });
    actions.appendChild(copyBtn);
    bubble.appendChild(actions);
    inner.appendChild(wrap);
  }

  function startEditUserMessage(bubble, idx) {
    if (busy) return;
    const s = activeSession();
    if (!s || idx == null || !s.messages[idx] || s.messages[idx].role !== 'user') return;
    const original = s.messages[idx].content || '';
    bubble.classList.add('editing');
    bubble.innerHTML = '';
    const ta = document.createElement('textarea');
    ta.className = 'edit-textarea';
    ta.value = original;
    ta.rows = 1;
    const actions = document.createElement('div');
    actions.className = 'edit-actions';
    const saveBtn = document.createElement('button');
    saveBtn.className = 'edit-save';
    saveBtn.textContent = '✓';
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'edit-cancel';
    cancelBtn.textContent = '✕';
    actions.appendChild(saveBtn);
    actions.appendChild(cancelBtn);
    bubble.appendChild(ta);
    bubble.appendChild(actions);

    const grow = () => {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
    };
    ta.addEventListener('input', grow);
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); finish(true); }
      else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    });
    saveBtn.addEventListener('click', () => finish(true));
    cancelBtn.addEventListener('click', () => finish(false));

    grow();
    ta.focus();

    function finish(save) {
      if (save) {
        const newText = ta.value.trim();
        if (!newText || newText === original) { finish(false); return; }
        s.messages = s.messages.slice(0, idx);
        saveSessions();
        renderActiveSession();
        input.value = newText;
        autoGrow();
        send();
      } else {
        renderActiveSession();
      }
    }
  }

  function appendAiBubble(inner, m, idx) {
    const wrap = document.createElement('div');
    wrap.className = 'msg ai';
    const roleRow = document.createElement('div');
    roleRow.className = 'role-row';
    roleRow.appendChild(makeAiRole());
    wrap.appendChild(roleRow);
    if (m.reasoning) {
      const det = document.createElement('details');
      det.className = 'reasoning';
      det.innerHTML = '<summary>' + escapeHtml(t('thinkingSummary')) + '</summary><div class="reasoning-body"></div>';
      det.querySelector('.reasoning-body').textContent = m.reasoning;
      wrap.appendChild(det);
    }
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.dataset.index = idx ?? '';
    renderAnswer(bubble, m.content || '');
    const actions = document.createElement('div');
    actions.className = 'msg-actions';
    const time = document.createElement('span');
    time.className = 'action-time';
    if (m.createdAt) time.textContent = formatTime(m.createdAt);
    actions.appendChild(time);
    actions._timeEl = time;
    const copyBtn = document.createElement('button');
    copyBtn.className = 'action-copy';
    copyBtn.title = t('copyMsg');
    copyBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
    copyBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await window.api.copyText(bubble._rawText || '');
      toast(t('copied'));
    });
    actions.appendChild(copyBtn);
    bubble.appendChild(actions);
    wrap.appendChild(bubble);
    inner.appendChild(wrap);
  }

  function scrollBottom(force = false) {
    const near = messages.scrollHeight - messages.scrollTop - messages.clientHeight < 80;
    if (force || near) messages.scrollTop = messages.scrollHeight;
  }

  // ---------- 发送 / 停止 ----------
  function setBusy(on) {
    busy = on;
    btnSend.classList.toggle('stop', on);
    btnSend.disabled = false;
    const sendText = btnSend.querySelector('.send-text');
    if (sendText) sendText.textContent = on ? t('stop') : t('send');
    if (sendCluster) { sendCluster.stop(); sendCluster = null; }
    if (on) {
      const canvas = btnSend.querySelector('.send-cluster');
      if (canvas) {
        sendCluster = new LoadingCluster(canvas, { cell: 5, gap: 1, glow: 0.45, halo: 12, colors: [[240,19,13]] });
        sendCluster.start();
      }
    }
    renderSessionList();
  }

  async function send() {
    if (busy) { window.api.abortChat(); return; }
    const text = input.value.trim();
    if (!text) return;
    if (!config.apiKey) { openSettings(); return; }

    let s = activeSession();
    if (!s) newSession();
    s = activeSession();

    setBusy(true);
    input.value = '';
    try { localStorage.removeItem('ai-chat-draft'); } catch (e) {}
    autoGrow();

    if (artMode) {
      await sendArtMode(s, text);
      return;
    }

    if (s.messages.length === 0) {
      s.title = text.replace(/!\[[^\]]*\]\([^)]+\)/g, '[图片]').slice(0, 20) || t('newChatTitle');
      currentTitle.textContent = s.title;
      renderSessionList();
    }

    const inner = ensureInner();
    inner.querySelector('.empty')?.remove();
    stopWelcome();
    appendUserBubble(inner, { content: text, createdAt: Date.now() });
    scrollBottom(true);
    s.messages.push({ role: 'user', content: text, createdAt: Date.now() });

    const think = createAiThinking(inner);
    let answerBubble = null;
    let reasoningBuf = '';
    let contentBuf = '';

    const finish = () => {
      setBusy(false);
      input.focus();
      scrollBottom();
    };

    const insertReasoning = () => {
      if (reasoningBuf) {
        const det = document.createElement('details');
        det.className = 'reasoning';
        det.innerHTML = '<summary>' + escapeHtml(t('thinkingSummary')) + '</summary><div class="reasoning-body"></div>';
        det.querySelector('.reasoning-body').textContent = reasoningBuf;
        think.wrap.insertBefore(det, answerBubble);
      }
    };

    const onChunk = (data) => {
      if (data.type === 'reasoning') {
        reasoningBuf += data.text;
      } else if (data.type === 'content') {
        if (!answerBubble) {
          answerBubble = replaceThinkingWithAnswer(think);
          insertReasoning();
        }
        contentBuf += data.text;
        renderAnswer(answerBubble, contentBuf);
        scrollBottom();
      }
    };

    const onDone = () => {
      const hasAny = !!(contentBuf || reasoningBuf);
      if (hasAny) {
        if (!answerBubble) {
          answerBubble = replaceThinkingWithAnswer(think);
          insertReasoning();
        }
        renderAnswer(answerBubble, contentBuf);
        const ai = { role: 'assistant', content: contentBuf, createdAt: Date.now() };
        if (reasoningBuf) ai.reasoning = reasoningBuf;
        s.messages.push(ai);
        saveSessions();
        const aiActions = answerBubble.querySelector('.msg-actions');
        if (aiActions && aiActions._timeEl) aiActions._timeEl.textContent = formatTime(ai.createdAt);
        // 自动命名：首条回复且标题仍为默认时
        if (s.title === t('newChatTitle') && s.messages.length === 2) {
          generateTitle(s, text, contentBuf || reasoningBuf || '');
        }
      } else {
        think.lc.stop();
        think.wrap.remove();
      }
      finish();
    };

    const onError = (msg) => {
      showAiError(think, msg);
      s.messages = s.messages.filter(m => !(m.role === 'user' && m.content === text));
      saveSessions();
      finish();
    };

    window.api.onChunk(onChunk);
    window.api.onDone(onDone);
    window.api.onError(onError);

    const history = s.messages
      .filter(m => m.role !== 'assistant' || (m.content && m.content.trim()))
      .map(m => ({ role: m.role, content: buildMessageContent(m.content) }));

    try {
      await window.api.streamChat({
        messages: history,
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        model: config.model,
      });
    } catch (e) {
      onError(e.message || String(e));
    }
  }

  // 艺术模式：在极简画布上完成「提问 → 思考动画 → 回答」
  async function sendArtMode(s, text) {
    const inner = ensureInner();
    if (!inner.querySelector('.empty')) {
      inner.innerHTML = artCanvasHTML();
    }
    stopWelcome();

    if (s.messages.length === 0) {
      s.title = text.replace(/!\[[^\]]*\]\([^)]+\)/g, '[图片]').slice(0, 20) || t('newChatTitle');
      currentTitle.textContent = s.title;
      renderSessionList();
    }
    s.messages.push({ role: 'user', content: text, createdAt: Date.now() });

    // 进入思考状态：清空文字，红色三角形淡出 → 红色 3×3 动画淡入
    const titleEl = $('#welcome-title');
    const tri = inner.querySelector('.welcome-tri');
    const canvas = inner.querySelector('.art-cluster');
    if (titleEl) {
      titleEl.classList.remove('answer');
      titleEl.classList.remove('fade');
      titleEl.style.width = '';
      titleEl.style.fontSize = '';
      titleEl.textContent = '';
    }
    let lc = null;
    if (canvas) {
      canvas.classList.add('show');
      lc = new LoadingCluster(canvas, { colors: [[240,19,13]], cell: 10, gap: 2, glow: 0.55, halo: 20 });
      lc.start();
    }
    if (tri) tri.classList.add('dim');

    let reasoningBuf = '';
    let contentBuf = '';

    const restoreMark = () => {
      if (lc) lc.stop();
      if (canvas) canvas.classList.remove('show');
      if (tri) tri.classList.remove('dim');
    };

    const onChunk = (data) => {
      if (data.type === 'reasoning') {
        reasoningBuf += data.text;
      } else if (data.type === 'content') {
        contentBuf += data.text;
        renderArtAnswer(contentBuf);
      }
    };

    const onDone = () => {
      restoreMark();
      const hasAny = !!(contentBuf || reasoningBuf);
      // 必须先清 busy，renderArtAnswer 才会播放逐词动画而不是整段显示
      setBusy(false);
      if (hasAny) {
        renderArtAnswer(contentBuf || reasoningBuf);
        const ai = { role: 'assistant', content: contentBuf, createdAt: Date.now() };
        if (reasoningBuf) ai.reasoning = reasoningBuf;
        s.messages.push(ai);
        saveSessions();
        if (s.title === t('newChatTitle') && s.messages.length === 2) {
          generateTitle(s, text, contentBuf || reasoningBuf || '');
        }
      } else {
        startWelcome();
      }
      input.focus();
    };

    const onError = (msg) => {
      restoreMark();
      renderArtAnswer('⚠ ' + msg);
      s.messages = s.messages.filter(m => !(m.role === 'user' && m.content === text));
      saveSessions();
      setBusy(false);
      input.focus();
    };

    window.api.onChunk(onChunk);
    window.api.onDone(onDone);
    window.api.onError(onError);

    const history = [{ role: 'system', content: artSystemPrompt() }];
    history.push(...s.messages
      .filter(m => m.role !== 'assistant' || (m.content && m.content.trim()))
      .map(m => ({ role: m.role, content: buildMessageContent(m.content) })));

    try {
      await window.api.streamChat({
        messages: history,
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        model: config.model,
      });
    } catch (e) {
      onError(e.message || String(e));
    }
  }

  // 自动生成会话标题（首条回复后）
  async function generateTitle(s, userText, aiText) {
    try {
      const prompt = '请用不超过10个字概括下面这段对话的主题，不要加标点符号，只输出标题：\n' +
        '用户：' + (userText || '').replace(/!\[[^\]]*\]\([^)]+\)/g, '[图片]').slice(0, 300) + '\n' +
        'AI：' + (aiText || '').slice(0, 200);
      const res = await window.api.generateTitle({
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
      });
      if (res && res.ok && res.title) {
        s.title = res.title;
        saveSessions();
        if (activeId === s.id) currentTitle.textContent = s.title;
        renderSessionList();
      }
    } catch (e) {}
  }

  // 把含图片 markdown 的文本转成 OpenAI 多模态 content 数组
  function buildMessageContent(content) {
    const imageRe = /!\[[^\]]*\]\((data:image\/[^)]+)\)/g;
    const images = [];
    let m;
    while ((m = imageRe.exec(content)) !== null) images.push(m[1]);
    if (!images.length) return content;
    const text = content.replace(imageRe, '').replace(/\n{2,}/g, '\n').trim();
    const parts = [];
    if (text) parts.push({ type: 'text', text });
    images.forEach(url => parts.push({ type: 'image_url', image_url: { url } }));
    return parts;
  }

  // 渲染 Markdown 并保留已有的消息操作条
  function renderAnswer(bubble, text) {
    bubble._rawText = text || '';
    const actions = bubble.querySelector('.msg-actions');
    bubble.innerHTML = window.renderMarkdown(text);
    attachCodeCopy(bubble);
    if (actions) bubble.appendChild(actions);
  }

  function attachCodeCopy(bubble) {
    bubble.querySelectorAll('pre.code-block').forEach(pre => {
      let head = pre.querySelector('.code-head');
      if (!head) {
        head = document.createElement('div');
        head.className = 'code-head';
        pre.insertBefore(head, pre.firstChild);
      }
      // 已有按钮则不重复添加
      if (head.querySelector('.fold-btn, .code-copy')) return;
      const foldBtn = document.createElement('button');
      foldBtn.className = 'fold-btn';
      foldBtn.textContent = t('fold');
      foldBtn.addEventListener('click', () => {
        pre.classList.toggle('folded');
        foldBtn.textContent = pre.classList.contains('folded') ? t('unfold') : t('fold');
      });
      const btn = document.createElement('button');
      btn.className = 'copy-btn code-copy';
      btn.textContent = t('copy');
      btn.title = t('copyCode');
      btn.addEventListener('click', async () => {
        await window.api.copyText(pre.querySelector('code').innerText);
        btn.textContent = t('copied');
        setTimeout(() => { btn.textContent = t('copy'); }, 1200);
      });
      head.appendChild(foldBtn);
      head.appendChild(btn);
    });
  }

  const SVG_MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 1 0 21 12.79z"/></svg>';
  const SVG_SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="M4.22 4.22l1.42 1.42"/><path d="M18.36 18.36l1.42 1.42"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="M4.22 19.78l1.42-1.42"/><path d="M18.36 5.64l1.42-1.42"/></svg>';

  function createAiThinking(inner) {
    const wrap = document.createElement('div');
    wrap.className = 'msg ai';
    wrap.appendChild(makeAiRole());
    const thinking = document.createElement('div');
    thinking.className = 'thinking';
    thinking.innerHTML = '<span class="hint">' + escapeHtml(t('thinkingHint')) + '</span><canvas class="cluster"></canvas>';
    wrap.appendChild(thinking);
    inner.appendChild(wrap);
    const canvas = wrap.querySelector('.cluster');
    const lc = new LoadingCluster(canvas, { cell: 7, gap: 1, glow: 0.4, halo: 14, colors: [[0,168,84]] });
    lc.start();
    scrollBottom();
    return { wrap, lc };
  }

  function replaceThinkingWithAnswer(think) {
    think.lc.stop();
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    think.wrap.innerHTML = '';
    think.wrap.appendChild(makeAiRole());
    think.wrap.appendChild(bubble);
    const actions = document.createElement('div');
    actions.className = 'msg-actions';
    const time = document.createElement('span');
    time.className = 'action-time';
    actions.appendChild(time);
    actions._timeEl = time;
    const copyBtn = document.createElement('button');
    copyBtn.className = 'action-copy';
    copyBtn.title = t('copyMsg');
    copyBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
    copyBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await window.api.copyText(bubble._rawText || '');
      toast(t('copied'));
    });
    actions.appendChild(copyBtn);
    bubble.appendChild(actions);
    scrollBottom();
    return bubble;
  }

  function showAiError(think, msg) {
    think.lc.stop();
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = '⚠ ' + msg;
    bubble.style.color = '#c0392b';
    think.wrap.innerHTML = '';
    think.wrap.appendChild(makeAiRole());
    think.wrap.appendChild(bubble);
    scrollBottom();
  }

  // ---------- 输入框 ----------
  function autoGrow() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 160) + 'px';
  }
  input.addEventListener('input', () => {
    autoGrow();
    try { localStorage.setItem('ai-chat-draft', input.value); } catch (e) {}
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!busy) send(); }
  });
  btnSend.addEventListener('click', send);
  $('#btn-new-chat').addEventListener('click', () => { if (!busy) newSession(); });
  modelSelect.addEventListener('change', () => { config.model = modelSelect.value; });

  // ---------- 图片拖拽 ----------
  const composerInner = $('.composer-inner');
  composerInner.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    composerInner.classList.add('drag-over');
  });
  composerInner.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    composerInner.classList.remove('drag-over');
  });
  composerInner.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    composerInner.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (!files.length) return;
    let done = 0;
    const markdowns = [];
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        markdowns.push('![' + (file.name || 'image') + '](' + ev.target.result + ')');
        done++;
        if (done === files.length) {
          const sep = input.value && !input.value.endsWith('\n') ? '\n' : '';
          input.value = input.value + sep + markdowns.join('\n') + '\n';
          autoGrow();
          input.focus();
          toast(t('toastImageInserted', { n: done }));
        }
      };
      reader.readAsDataURL(file);
    });
  });

  // ---------- 模型选择 ----------
  function populateModelSelect() {
    modelSelect.innerHTML = '';
    DEFAULT_MODELS.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.model;
      opt.textContent = m.name;
      modelSelect.appendChild(opt);
    });
    if (config.model && !DEFAULT_MODELS.some(m => m.model === config.model)) {
      const opt = document.createElement('option');
      opt.value = config.model;
      opt.textContent = config.model;
      opt.selected = true;
      modelSelect.appendChild(opt);
    }
    modelSelect.value = config.model;
  }

  // ---------- 设置 ----------
  let currentTab = 'api';
  function openSettings() {
    $('#cfg-baseUrl').value = config.baseUrl;
    $('#cfg-apiKey').value = config.apiKey;
    $('#cfg-model').value = config.model;
    $('#cfg-autoLaunch').checked = !!config.autoLaunch;
    $('#cfg-artMode').checked = !!artMode;
    $('#cfg-artSpeed').value = String(artSpeed);
    $('#art-speed-value').textContent = getArtSpeedLabel();
    $('#cfg-artStyle').value = artStyle;
    $('#cfg-lang').value = lang;
    $('#cfg-workspace').value = config.workspaceDir || '';
    loadVersion();
    updateInfo = null;
    setUpdateStatus('');
    setUpdateProgress(null);
    $('#btn-check-update').disabled = false;
    currentTab = 'api';
    switchSettingsTab('api');
    $('#settings-mask').classList.remove('hidden');
  }
  function closeSettings() {
    $('#settings-mask').classList.add('hidden');
  }
  function switchSettingsTab(tab) {
    currentTab = tab;
    $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.tab === tab));
    $$('.tab-panel').forEach(p => p.classList.toggle('active', p.dataset.tab === tab));
  }

  $('#btn-settings').addEventListener('click', openSettings);
  $('#settings-mask').addEventListener('click', (e) => {
    if (e.target.id === 'settings-mask') closeSettings();
  });
  $$('.nav-item').forEach(n => n.addEventListener('click', () => switchSettingsTab(n.dataset.tab)));

  document.querySelectorAll('.preset').forEach(btn => {
    btn.addEventListener('click', () => {
      $('#cfg-baseUrl').value = btn.dataset.url;
      $('#cfg-model').value = btn.dataset.model;
    });
  });

  $('#btn-browse-workspace').addEventListener('click', async () => {
    const res = await window.api.selectWorkspace();
    if (res && res.ok && res.path) $('#cfg-workspace').value = res.path;
  });

  // 艺术模式：切换即生效，无需点保存
  $('#cfg-artMode').addEventListener('change', () => {
    artMode = $('#cfg-artMode').checked;
    try { localStorage.setItem(LS_ART, artMode ? '1' : '0'); } catch (e) {}
    renderActiveSession();
  });

  // 艺术模式速度滑块：实时更新档位标签并保存
  $('#cfg-artSpeed').addEventListener('input', () => {
    const v = parseInt($('#cfg-artSpeed').value, 10);
    if (!isNaN(v) && v >= 1 && v <= 5) {
      artSpeed = v;
      $('#art-speed-value').textContent = getArtSpeedLabel();
      try { localStorage.setItem(LS_ART_SPEED, String(artSpeed)); } catch (e) {}
    }
  });

  // 艺术模式回复风格：实时保存
  $('#cfg-artStyle').addEventListener('change', () => {
    const v = $('#cfg-artStyle').value;
    if (v && (v === 'brief' || v === 'standard' || v === 'complex')) {
      artStyle = v;
      try { localStorage.setItem(LS_ART_STYLE, artStyle); } catch (e) {}
    }
  });

  $('#btn-close').addEventListener('click', async () => {
    config.baseUrl = $('#cfg-baseUrl').value.trim() || 'https://api.deepseek.com';
    config.apiKey = $('#cfg-apiKey').value.trim();
    config.model = $('#cfg-model').value.trim() || 'deepseek-v4-flash';
    const newAutoLaunch = $('#cfg-autoLaunch').checked;
    const newLang = $('#cfg-lang').value;
    config.workspaceDir = $('#cfg-workspace').value.trim();

    // 艺术模式
    const oldArtMode = artMode;
    const newArtMode = $('#cfg-artMode').checked;
    if (newArtMode !== oldArtMode) {
      artMode = newArtMode;
      try { localStorage.setItem(LS_ART, artMode ? '1' : '0'); } catch (e) {}
    }

    // 艺术模式速度 / 风格（滑块/下拉已在 change 时即时保存，这里保证最终值落盘）
    const newArtSpeed = parseInt($('#cfg-artSpeed').value, 10);
    if (!isNaN(newArtSpeed) && newArtSpeed >= 1 && newArtSpeed <= 5 && newArtSpeed !== artSpeed) {
      artSpeed = newArtSpeed;
      try { localStorage.setItem(LS_ART_SPEED, String(artSpeed)); } catch (e) {}
    }
    const newArtStyle = $('#cfg-artStyle').value;
    if (newArtStyle && newArtStyle !== artStyle) {
      artStyle = newArtStyle;
      try { localStorage.setItem(LS_ART_STYLE, artStyle); } catch (e) {}
    }

    // 开机自启
    if (newAutoLaunch !== config.autoLaunch) {
      try { await window.api.setAutoLaunch(newAutoLaunch); } catch (e) {}
    }
    config.autoLaunch = newAutoLaunch;

    // 语言
    config.lang = newLang;
    if (newLang !== lang) setLanguage(newLang);

    await window.api.setConfig(config);
    populateModelSelect();
    applyI18n();
    closeSettings();
    if (newArtMode !== oldArtMode) renderActiveSession();
  });

  // 获取 API Key 帮助链接
  $('#cfg-get-key').addEventListener('click', (e) => {
    e.preventDefault();
    window.api.openExternal('https://platform.deepseek.com/');
  });

  // ---------- 关于入口 ----------
  // 菜单栏「帮助 → 关于」统一进入设置-关于页（含版本与检查更新）
  window.api.onShowAbout(() => { openSettings(); switchSettingsTab('about'); });

  // ---------- 主题 ----------
  const btnTheme = $('#btn-theme');
  function applyTheme(t) {
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem(LS_THEME, t); } catch (e) {}
    if (btnTheme) btnTheme.innerHTML = t === 'dark' ? SVG_SUN : SVG_MOON;
  }
  btnTheme.addEventListener('click', () => {
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  });

  // ---------- 窗口置顶 ----------
  const btnPin = $('#btn-pin');
  function setPin(on) {
    btnPin.classList.toggle('active', on);
    try { localStorage.setItem('ai-chat-pin', on ? '1' : '0'); } catch (e) {}
    window.api.setAlwaysOnTop(on);
  }
  btnPin.addEventListener('click', () => setPin(!btnPin.classList.contains('active')));

  // ---------- 轻提示 ----------
  function toast(msg) {
    let t = document.querySelector('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  // ---------- 侧边栏收起 / 展开 ----------
  const sidebar = $('#sidebar');
  const btnExpand = $('#btn-expand');
  function applySidebarCollapsed(collapsed) {
    sidebar.classList.toggle('collapsed', collapsed);
    btnExpand.classList.toggle('hidden', !collapsed);
    try { localStorage.setItem(LS_COLLAPSE, collapsed ? '1' : '0'); } catch (e) {}
  }
  $('#btn-collapse').addEventListener('click', () => applySidebarCollapsed(true));
  btnExpand.addEventListener('click', () => applySidebarCollapsed(false));

  // ---------- 导出模式 ----------
  const exportActions = $('#export-actions');
  function enterExportMode() {
    exportMode = true;
    exportSelectedIds = new Set(sessions.map(s => s.id));
    exportActions.classList.remove('hidden');
    applySidebarCollapsed(false);
    renderSessionList();
  }
  function exitExportMode() {
    exportMode = false;
    exportSelectedIds.clear();
    exportActions.classList.add('hidden');
    renderSessionList();
  }
  $('#btn-export-sessions').addEventListener('click', () => {
    closeSettings();
    enterExportMode();
  });
  $('#btn-cancel-export').addEventListener('click', exitExportMode);
  $('#btn-do-export').addEventListener('click', async () => {
    const selected = sessions.filter(s => exportSelectedIds.has(s.id));
    if (!selected.length) { toast(t('noContentToExport')); return; }
    const payload = {
      data: JSON.stringify({ sessions: selected, activeId: selected[0].id }, null, 2),
      defaultDir: config.workspaceDir || '',
      title: t('exportDialogTitle'),
    };
    const res = await window.api.exportSessions(payload);
    if (res && res.ok) { toast(t('toastExported') + res.path); exitExportMode(); }
    else if (res && res.error) toast(t('toastExportFailed') + res.error);
  });

  // ---------- 导入 ----------
  async function doImport() {
    const res = await window.api.importSessions({ title: t('importDialogTitle') });
    if (!res || !res.ok) return;
    try {
      const data = JSON.parse(res.data);
      const incoming = Array.isArray(data.sessions) ? data.sessions : [];
      const byId = new Map();
      sessions.forEach(s => byId.set(s.id, s));
      incoming.forEach(s => { if (s && s.id && !byId.has(s.id)) byId.set(s.id, s); });
      sessions = Array.from(byId.values());
      if (data.activeId && byId.has(data.activeId)) activeId = data.activeId;
      else if (sessions.length) activeId = sessions[0].id;
      saveSessions();
      renderSessionList();
      renderActiveSession();
      const cur = activeSession();
      currentTitle.textContent = cur ? cur.title : t('newChatTitle');
      toast(t('toastImported', { n: incoming.length }));
    } catch (e) {
      toast(t('toastImportFailed'));
    }
  }
  $('#btn-import-sessions').addEventListener('click', () => { closeSettings(); doImport(); });

  // ---------- 全局快捷键 ----------
  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      if (!busy) newSession();
    } else if (mod && e.key.toLowerCase() === 't') {
      e.preventDefault();
      applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    } else if (e.key === 'Escape' && busy) {
      e.preventDefault();
      window.api.abortChat();
    }
  });

  // ---------- 版本与更新 ----------
  let currentVersion = '1.0.0';
  let updateInfo = null;
  async function loadVersion() {
    try { currentVersion = await window.api.appVersion(); } catch (e) {}
    const el = $('#about-version');
    if (el) el.textContent = 'v' + currentVersion;
  }
  function formatBytes(n) {
    if (!n) return '-';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / (1024 * 1024)).toFixed(2) + ' MB';
  }
  function setUpdateStatus(html, cls) {
    const el = $('#update-status');
    if (!el) return;
    el.innerHTML = html || '';
    el.className = 'update-status' + (cls ? ' ' + cls : '');
  }
  function setUpdateProgress(percent) {
    const wrap = $('#update-progress');
    const bar = $('#update-progress-bar');
    if (!wrap || !bar) return;
    if (percent == null || percent >= 100) { wrap.classList.add('hidden'); return; }
    wrap.classList.remove('hidden');
    bar.style.width = percent + '%';
  }

  async function checkUpdate() {
    if (!window.api.checkUpdate) return;
    const btn = $('#btn-check-update');
    btn.disabled = true;
    setUpdateProgress(null);
    setUpdateStatus(escapeHtml(t('checkingUpdate')));
    const res = await window.api.checkUpdate();
    btn.disabled = false;
    if (!res.ok) {
      setUpdateStatus(escapeHtml(t('updateFailed', { error: res.error || '' })), 'error');
      return;
    }
    if (!res.hasUpdate) {
      setUpdateStatus(escapeHtml(t('alreadyLatest')));
      return;
    }
    updateInfo = res;
    setUpdateStatus(
      escapeHtml(t('updateAvailable', { version: 'v' + res.latest })) +
      ' <span class="update-size">(' + escapeHtml(t('updateSize', { size: formatBytes(res.size) })) + ')</span>' +
      ' <button id="btn-do-update" class="primary" style="margin-left:8px;padding:4px 10px;font-size:12px;border-radius:6px;">' + escapeHtml(t('updateNow')) + '</button>',
      'has-update'
    );
    $('#btn-do-update').addEventListener('click', downloadAndApplyUpdate);
  }

  async function downloadAndApplyUpdate() {
    if (!updateInfo || !window.api.downloadUpdate) return;
    const btn = $('#btn-check-update');
    btn.disabled = true;
    setUpdateStatus(escapeHtml(t('updateDownloading', { percent: '0' })));
    setUpdateProgress(0);
    window.api.onUpdateProgress((data) => {
      setUpdateProgress(data.percent);
      setUpdateStatus(escapeHtml(t('updateDownloading', { percent: String(data.percent) })));
    });
    const res = await window.api.downloadUpdate({ url: updateInfo.url, size: updateInfo.size });
    btn.disabled = false;
    if (!res.ok) {
      setUpdateProgress(null);
      const manualUrl = updateInfo && (updateInfo.manualUrl || updateInfo.url);
      const manualBtn = manualUrl
        ? ' <button id="btn-manual-download" class="primary" style="margin-left:8px;padding:4px 10px;font-size:12px;border-radius:6px;">' + escapeHtml(t('manualDownload')) + '</button>'
        : '';
      setUpdateStatus(escapeHtml(t('updateFailed', { error: res.error || '' })) + manualBtn, 'error');
      if (manualUrl) {
        $('#btn-manual-download').addEventListener('click', () => {
          window.api.openExternal(manualUrl);
        });
      }
      return;
    }
    setUpdateProgress(100);
    setUpdateStatus(
      escapeHtml(t('updateDownloaded')) +
      ' <button id="btn-apply-update" class="primary" style="margin-left:8px;padding:4px 10px;font-size:12px;border-radius:6px;">' + escapeHtml(t('updateNow')) + '</button>',
      'has-update'
    );
    $('#btn-apply-update').addEventListener('click', applyUpdate);
  }

  async function applyUpdate() {
    if (!window.api.applyUpdate) return;
    const res = await window.api.applyUpdate();
    if (!res.ok) {
      setUpdateStatus(escapeHtml(t('updateFailed', { error: res.error || '' })), 'error');
    }
  }

  $('#btn-check-update').addEventListener('click', checkUpdate);

  // ---------- 更新公告（应用内弹窗） ----------
  const RELEASE_NOTES = {
    '1.1.0': [
      { tag: 'new', text: '新增「关于」页面，可查看当前版本' },
      { tag: 'new', text: '新增自动更新：检查 / 下载 / 一键升级' },
      { tag: 'improve', text: '优化消息操作：用户消息显示发送时间 + 编辑 + 复制，AI 回复显示回复时间 + 复制' },
      { tag: 'fix', text: '恢复侧边栏「设置」入口' },
    ],
    '1.1.1': [
      { tag: 'new', text: '新增更新公告：新版本首次启动时，以应用内弹窗展示本次更新内容' },
    ],
    '1.1.2': [
      { tag: 'new', text: '自动更新：以后无需再手动接收安装包，打开软件「设置 → 关于」点击「检查更新」即可一键升级到最新版' },
      { tag: 'new', text: '更新公告弹窗：每次升级后首次启动，会自动弹出本次更新内容说明' },
      { tag: 'improve', text: '消息操作更精致：鼠标悬浮在你的消息上可快速「编辑 / 复制」；悬浮在 AI 回复上可「复制」，并显示发送/回复时间' },
      { tag: 'fix', text: '恢复侧边栏的「设置」入口' },
    ],
    '1.1.3': [
      { tag: 'fix', text: '修复部分地区无法直连 GitHub 下载导致更新卡在 0% 的问题，新增镜像源自动切换和手动下载入口' },
    ],
    '1.1.4': [
      { tag: 'new', text: '自动更新：打开「设置 → 关于」点击「检查更新」即可一键升级到最新版，无需再手动接收安装包' },
      { tag: 'new', text: '更新公告弹窗：每次升级后首次启动，自动弹出本次更新内容说明' },
      { tag: 'new', text: '「关于」页面：可在设置中查看当前版本号' },
      { tag: 'improve', text: '消息操作更精致：悬浮在你的消息上可快速「编辑 / 复制」；悬浮在 AI 回复上可「复制」，并显示发送/回复时间' },
      { tag: 'fix', text: '恢复侧边栏的「设置」入口' },
      { tag: 'fix', text: '修复部分地区更新卡在 0% 的问题：新增多镜像源自动切换和手动下载入口' },
    ],
    '1.1.5': [
      { tag: 'fix', text: '修复手动下载按钮仍打开 GitHub 页面导致无法访问的问题，现在直接通过镜像源下载安装包' },
      { tag: 'improve', text: '缩短自动下载连接超时时间，主源不可用时更快切换到镜像源' },
    ],
    '1.1.6': [
      { tag: 'new', text: '自动更新：打开「设置 → 关于」点击「检查更新」即可一键升级到最新版，无需再手动接收安装包' },
      { tag: 'new', text: '更新公告弹窗：每次升级后首次启动，自动弹出本次更新内容说明' },
      { tag: 'new', text: '「关于」页面：可在设置中查看当前版本号' },
      { tag: 'improve', text: '消息操作更精致：悬浮在你的消息上可快速「编辑 / 复制」；悬浮在 AI 回复上可「复制」，并显示发送/回复时间' },
      { tag: 'improve', text: '更新下载提速：多镜像源自动切换，主源不可用时更快切换，不再卡在 0%' },
      { tag: 'fix', text: '修复部分地区无法直连 GitHub 导致更新失败的问题，新增镜像源自动切换和手动下载入口' },
      { tag: 'fix', text: '修复手动下载按钮打不开的问题，现在直接通过镜像源下载安装包' },
      { tag: 'fix', text: '恢复侧边栏的「设置」入口' },
    ],
    '1.2.0': [
      { tag: 'new', text: '艺术模式回答动效：回答完成后按语义拆词，逐词「打字出现 → 回退删除 → 下一个词」循环播放，模拟 AI 思考输入' },
      { tag: 'improve', text: '艺术模式语义分词：优先使用 Intl.Segmenter 按词切分，英文/数字整体保留，避免中英混拆' },
    ],
    '1.2.1': [
      { tag: 'fix', text: '修复艺术模式回答完成后仍整段显示、无法逐词动画的问题，现在回答结束会按语义拆词一个接一个弹出' },
      { tag: 'improve', text: '加快艺术模式逐词频率，词与词之间更快连续弹出，更像 AI 在快速思考' },
    ],
    '1.3.0': [
      { tag: 'fix', text: '修复艺术模式回答生成完毕后、逐词动画开始之前完整回答闪现一瞬的问题' },
      { tag: 'new', text: '设置新增独立「艺术模式」子项目（原通用里的艺术模式开关已移入此处）' },
      { tag: 'new', text: '艺术模式可调整词语弹出速度：1-5 档（极慢/慢/中/快/极速）' },
      { tag: 'new', text: '艺术模式可选择回复风格：简短 / 标准 / 复杂，影响 AI 回答的长度与详细程度' },
    ],
  };

  function openChangelog(ver) {
    const notes = RELEASE_NOTES[ver];
    if (!notes || !notes.length) return;
    const tagLabels = { new: '新增', improve: '优化', fix: '修复' };
    $('#changelog-version').textContent = 'v' + ver;
    $('#changelog-body').innerHTML = '<ul>' + notes.map(n =>
      '<li><span class="cl-tag ' + n.tag + '">' + escapeHtml(tagLabels[n.tag] || '') + '</span><span>' + escapeHtml(n.text) + '</span></li>'
    ).join('') + '</ul>';
    $('#changelog-mask').classList.remove('hidden');
  }
  function closeChangelog() {
    $('#changelog-mask').classList.add('hidden');
  }
  function hasExistingData() {
    try { if (localStorage.getItem(LS_KEY)) return true; } catch (e) {}
    return !!(config && config.apiKey);
  }
  async function maybeShowUpdateAnnouncement() {
    let ver;
    try { ver = await window.api.appVersion(); } catch (e) { return; }
    const last = localStorage.getItem(LS_VERSION);
    // 仅当「版本发生变化」时展示；首次记录版本(last=null)时，只在非全新安装（有历史数据）下展示
    if (last !== ver && RELEASE_NOTES[ver] && (last !== null || hasExistingData())) {
      openChangelog(ver);
    }
    try { localStorage.setItem(LS_VERSION, ver); } catch (e) {}
  }

  $('#btn-changelog-close').addEventListener('click', closeChangelog);
  $('#btn-changelog-ok').addEventListener('click', closeChangelog);
  $('#changelog-mask').addEventListener('click', (e) => {
    if (e.target.id === 'changelog-mask') closeChangelog();
  });

  // ---------- 初始化 ----------
  async function init() {
    applyTheme(localStorage.getItem(LS_THEME) || 'light');
    if (localStorage.getItem('ai-chat-pin') === '1') setPin(true);
    setLanguage(localStorage.getItem(LS_LANG) || 'zh');
    artMode = localStorage.getItem(LS_ART) === '1';
    const _sp = parseInt(localStorage.getItem(LS_ART_SPEED) || '3', 10);
    if (_sp >= 1 && _sp <= 5) artSpeed = _sp;
    const _st = localStorage.getItem(LS_ART_STYLE);
    if (_st === 'brief' || _st === 'standard' || _st === 'complex') artStyle = _st;
    try { config = await window.api.getConfig(); } catch (e) {}
    if (config.lang && I18N[config.lang]) setLanguage(config.lang);
    populateModelSelect();
    loadSessions();
    applySidebarCollapsed(localStorage.getItem(LS_COLLAPSE) === '1');
    loadVersion();
    maybeShowUpdateAnnouncement();
    renderSessionList();
    renderActiveSession();
    const cur = activeSession();
    currentTitle.textContent = cur ? cur.title : t('newChatTitle');
    try {
      const draft = localStorage.getItem('ai-chat-draft');
      if (draft) { input.value = draft; autoGrow(); }
    } catch (e) {}
    if (!config.apiKey) openSettings();
  }

  init();
})();
