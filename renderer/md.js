/**
 * md.js — 轻量 Markdown 渲染器（零依赖）
 * 支持：代码块(含语法高亮)、行内代码、标题、列表、引用、粗体/斜体、链接、分隔线
 * 输出安全：先转义 HTML 再按规则包裹，防 XSS
 */
(function (global) {
  'use strict';

  function escapeHtml(s) {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ---- 简单语法高亮（关键词/字符串/注释/数字/函数调用） ----
  const KEYWORDS = new Set([
    // 通用 + JS/TS
    'const','let','var','function','return','if','else','for','while','do','switch','case',
    'break','continue','new','class','extends','super','this','import','export','from','default',
    'async','await','try','catch','finally','throw','typeof','instanceof','in','of','void','delete',
    'null','undefined','true','false','static','get','set','yield',
    // Python
    'def','elif','lambda','pass','raise','with','as','global','nonlocal','not','and','or','is','None','True','False',
    // Go
    'func','package','defer','go','chan','map','range','struct','interface','select',
    // Rust
    'fn','impl','pub','mut','match','trait','enum','crate','mod','use','where','ref','dyn',
    // 通用类型
    'int','float','double','char','bool','string','void','long','short','unsigned','signed',
    'boolean','number','object','any','unknown','never','readonly',
  ]);

  // 单次扫描 tokenizer：避免多次 replace 误伤已生成的 HTML（如 class 关键字）
  // 捕获组：1=字符串 2=注释 3=数字 4=函数名 5=标识符/关键字
  const TOKEN_RE = /("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\\n])*`)|(\/\/[^\n]*|#[^\n]*)|\b(\d+(?:\.\d+)?)\b|([A-Za-z_$][\w$]*)(?=\s*\()|\b([A-Za-z_$][\w$]*)\b/g;

  function highlight(code) {
    let out = '';
    let last = 0;
    let m;
    TOKEN_RE.lastIndex = 0;
    while ((m = TOKEN_RE.exec(code)) !== null) {
      out += escapeHtml(code.slice(last, m.index));
      const full = m[0];
      let cls = null;
      if (m[1] !== undefined) cls = 'tok-str';
      else if (m[2] !== undefined) cls = 'tok-com';
      else if (m[3] !== undefined) cls = 'tok-num';
      else if (m[4] !== undefined) cls = 'tok-fn';
      else if (KEYWORDS.has(full)) cls = 'tok-kw';
      const content = escapeHtml(full);
      out += cls ? `<span class="${cls}">${content}</span>` : content;
      last = m.index + full.length;
    }
    out += escapeHtml(code.slice(last));
    return out;
  }

  function inline(s) {
    // 图片 ![alt](url)（先于链接处理）
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;border-radius:8px;">');
    // 行内代码（先处理，避免内部被其他规则污染）
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    // 链接 [text](url)
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    // 粗体
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // 斜体
    s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    return s;
  }

  function render(text) {
    if (!text) return '';
    const lines = text.replace(/\r\n/g, '\n').split('\n');
    const out = [];
    let i = 0;
    let inCode = false;
    let codeLang = '';
    let codeBuf = [];
    let listType = null;   // 'ul' | 'ol'
    let quoteOpen = false;

    const closeList = () => {
      if (listType) { out.push('</' + listType + '>'); listType = null; }
    };
    const closeQuote = () => {
      if (quoteOpen) { out.push('</blockquote>'); quoteOpen = false; }
    };

    const flushInline = (raw) => inline(escapeHtml(raw));

    while (i < lines.length) {
      const line = lines[i];

      // 代码块开始/结束
      const fence = line.match(/^```(\w*)\s*$/);
      if (fence) {
        if (!inCode) {
          closeList(); closeQuote();
          inCode = true;
          codeLang = fence[1] || '';
          codeBuf = [];
        } else {
          const code = codeBuf.join('\n');
          out.push('<pre class="code-block"><div class="code-head">' + (codeLang ? escapeHtml(codeLang) : 'code') +
            '</div><code>' + highlight(code) + '</code></pre>');
          inCode = false;
          codeLang = '';
        }
        i++;
        continue;
      }
      if (inCode) { codeBuf.push(line); i++; continue; }

      const t = line.trim();

      // 空行：结束列表/引用
      if (t === '') {
        closeList(); closeQuote();
        i++;
        continue;
      }

      // 分隔线
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) {
        closeList(); closeQuote();
        out.push('<hr>');
        i++;
        continue;
      }

      // 标题
      const h = line.match(/^(#{1,4})\s+(.*)$/);
      if (h) {
        closeList(); closeQuote();
        const lv = h[1].length;
        out.push(`<h${lv}>${flushInline(h[2])}</h${lv}>`);
        i++;
        continue;
      }

      // 引用
      if (/^>\s?/.test(t)) {
        if (!quoteOpen) { closeList(); out.push('<blockquote>'); quoteOpen = true; }
        out.push('<p>' + flushInline(t.replace(/^>\s?/, '')) + '</p>');
        i++;
        continue;
      }

      // 无序列表
      const ul = line.match(/^\s*[-*+]\s+(.*)$/);
      if (ul) {
        if (listType !== 'ul') { closeList(); closeQuote(); out.push('<ul>'); listType = 'ul'; }
        out.push('<li>' + flushInline(ul[1]) + '</li>');
        i++;
        continue;
      }

      // 有序列表
      const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
      if (ol) {
        if (listType !== 'ol') { closeList(); closeQuote(); out.push('<ol>'); listType = 'ol'; }
        out.push('<li>' + flushInline(ol[1]) + '</li>');
        i++;
        continue;
      }

      // 普通段落
      closeList(); closeQuote();
      out.push('<p>' + flushInline(t) + '</p>');
      i++;
    }

    if (inCode) {
      out.push('<pre class="code-block"><code>' + highlight(codeBuf.join('\n')) + '</code></pre>');
    }
    closeList(); closeQuote();

    return out.join('');
  }

  global.renderMarkdown = render;
})(window);
