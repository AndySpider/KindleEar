//The Kindle browser, especially on older versions of Kindle, supports only limited features.
//If you need to make some changes,
//Please use legacy JavaScript syntax only, avoid using any modern syntax and feature.

var g_iframeScrollHeight = 500; //在 iframeLoadEvent 里更新
//var g_iframeClientHeight = 500;
var g_currentArticle = {};

//对古董浏览器兼容性最好的判断一个变量是否为空的语法
//支持基本类型/数组/对象
function isEmpty(obj) {
  if (!obj) {
    return true;
  }
  if (Object.prototype.toString.call(obj) == '[object Array]') {
    return obj.length == 0;
  }
  for (var key in obj) {
    if (obj.hasOwnProperty(key)) {
      return false;
    }
  }
  return true;
}

//将一个字典对象转换为ajax使用的参数字符串
function formatParams(data) {
  var arr = [("v_=" + Math.random()).replace(".", "")];
  for (var name in data) {
    arr.push(encodeURIComponent(name) + "=" + encodeURIComponent(data[name]));
  }
  return arr.join("&");
}

//封装ajax，在Kindle简陋的浏览器中使用，尽量使用原生js功能
//ajax({
//    url: "url",
//    type: "POST",
//    data: {},
//    dataType: "json",   //optional,'json'/'text'/'xml'
//    success: function (resp, xml) {},
//    error: function (xhr, status, error) {} //optional
//});
function ajax(url, options) {
  if (typeof url == 'object') { // 兼容两种参数形式
    options = url;
    url = options.url;
  }
  options = options || {};
  var type = (options.type || "GET").toUpperCase();
  var dataType = (options.dataType || "json").toLowerCase();
  var params = formatParams(options.data || {});
  var xhr = new XMLHttpRequest();
  xhr.onreadystatechange = function () {
    if (xhr.readyState == 4) {
      var status = xhr.status;
      if ((status >= 200) && (status < 300)) {
        var resp = (dataType == "json") ? JSON.parse(xhr.responseText) : xhr.responseText;
        options.success && options.success(resp, xhr.responseXML);
      } else if (options.error) {
        options.error(xhr, status, xhr.statusText);
      }
    }
  }

  if (type == "GET") {
    xhr.open("GET", url + "?" + params, true); //第三个参数true表示异步请求
    xhr.send(null);
  } else if (type == "POST") {
    xhr.open("POST", url, true);
    xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
    xhr.send(params);
  }
}

//兼容 jQuery 的 get 函数
function ajax_get(url, data, success, dataType) {
  if (typeof data == 'function') {
    dataType = dataType || success;
    success = data;
    data = {};
  }
  ajax({url: url, type: 'GET', data: data, success: success, dataType: dataType});
}

// 兼容 jQuery 的 post 函数
function ajax_post(url, data, success, dataType) {
  if (typeof data == 'function') {
    dataType = dataType || success;
    success = data;
    data = {};
  }
  ajax({url: url, type: 'POST', data: data, success: success, dataType: dataType});
}


//更新页面位置指示器
function updatePosIndicator() {
  var content = document.getElementById('content');
  var indicator = document.getElementById('pos-indicator');
  var height = content.clientHeight;
  var scrollTop = content.scrollTop;
  var scrollHeight = content.scrollHeight - height;
  var ratio = scrollHeight ? scrollTop / scrollHeight : 0;
  var indiHeight = 50;
  var pos = ratio * (height - indiHeight);
  pos = Math.min(pos, height - indiHeight - 5); //5是稍离开屏幕下沿
  indicator.style.top = pos + 'px';
}

//更新导航栏位置指示器
function updateNavIndicator() {
  var content = document.getElementById('nav-content');
  var indicator = document.getElementById('nav-indicator');
  if (!indicator) {
    return;
  }
  var height = content.clientHeight;
  var scrollTop = content.scrollTop;
  var scrollHeight = content.scrollHeight - height;
  var ratio = scrollHeight ? scrollTop / scrollHeight : 0;
  var indiHeight = 30;
  var pos = ratio * (height - indiHeight);
  if (isMobile()) {
    pos = Math.min(pos, height - indiHeight - 80); //80是下部工具栏高度
  } else {
    pos = Math.min(pos, height - indiHeight - 5); //5是稍离开屏幕下沿
  }
  indicator.style.top = pos + 'px';
}

//屏幕点击事件的处理
function clickEvent(event) {
  var content = document.getElementById('content');
  var navbar = document.getElementById('navbar');
  var navPopMenu = document.getElementById('nav-popmenu')
  var x = event.clientX;
  var y = event.clientY - content.scrollTop;
  var ww = content.clientWidth;
  var wh = content.clientHeight;
  //alert(x + ',' + event.clientY + ',' + content.scrollTop + ',' + content.clientHeight);
  navPopMenu.style.display = 'none';
  if (y < wh / 5) { //上部 (20%)
    if (x < ww * 0.15) { //左上 15%，上一篇文章
      openPrevArticle();
    } else if (x > ww * 0.80) { //右上 20%，下一篇文章
      openNextArticle();
    } else if (isMobile()) { //中间65%，弹出菜单
      navbar.style.display = (navbar.style.display == "block") ? "none" : "block";
    }
  } else if (x < ww / 3) { //左侧往回翻页 (30%)
    pageUp(content, navbar);
  } else { //右侧往前翻页
    pageDown(content, navbar);
  }
}

//往上翻页
function pageUp(content, navbar) {
  content = content || document.getElementById('content');
  navbar = navbar || document.getElementById('navbar');
  if (isMobile() && (navbar.style.display == "block")) {
    navbar.style.display = 'none';
  } else if (g_inkMode) {
    var scrollTop = content.scrollTop;
    if (scrollTop <= 0) {
      openPrevArticle();
    } else {
      content.scrollTop = Math.max(0, scrollTop - content.clientHeight + 40);
    }
  }
}

//往下翻页
function pageDown(content, navbar) {
  content = content || document.getElementById('content');
  navbar = navbar || document.getElementById('navbar');
  if (isMobile() && (navbar.style.display == "block")) {
    navbar.style.display = 'none';
  } else if (g_inkMode) {
    var scrollTop = content.scrollTop;
    var scrollHeight = g_iframeScrollHeight || content.scrollHeight;
    if (scrollTop >= scrollHeight - content.clientHeight) {
      openNextArticle();
    } else {
      content.scrollTop = Math.min(scrollTop + content.clientHeight - 40, scrollHeight);
    }
  }
}

//iframe发送过来的消息，配合reader-inject.js使用，初始版本使用，现已废弃
//初始版本的方案是在iframe中注入脚本，和主页面互发消息，可以跨域使用，但是增加了复杂性
//现在版本直接操纵iframe页面，python代码和js代码都更简单，但是不能跨域
function iFrameEvent(event) {
  var data = event.data;
  //console.log('iFrameEvent: ' + JSON.stringify(data));
  g_iframeScrollHeight = data.scrollHeight;
  //g_iframeClientHeight = data.clientHeight;
  if (data.type == 'iframeLoaded') {
    document.getElementById('iframe').style.height = g_iframeScrollHeight + 'px';
  } else if (data.type == 'click') {
    if (data.href && g_allowLinks) {
      window.location.href = data.href; //覆盖原先的阅读界面
    } else {
      clickEvent(data.event);
    }
  }
}

//返回屏幕宽度
function getViewportWidth() {
  return window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
}

//判断是否是移动设备，包括Kindle设备，如果要修改这个函数，请同步修改reader.css
//传统6寸墨水屏分辨率(800x600)
//pw3/pw4/voyage的分辨率(1448x1072)
//oasis分辨率(1680x1264)
//pw5分辨率(1648x1236)
function isMobile() {
  var width = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
  return width <= 1072;
}

//返回屏幕高度
function getViewportHeight() {
  return Math.min(document.documentElement.clientHeight, window.innerHeight || 0);
}

//点击日期行，打开或折叠此日期内的书本
function toggleNavDate(nav) {
  var toggleIcon = nav.querySelector('.tree-icon');
  toggleIcon.textContent = (toggleIcon.textContent == "▾") ? "▸" : "▾";
  var items = nav.parentNode.querySelectorAll('.nav-book');
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    item.style.display = (item.style.display == "block") ? "none" : "block";
  }
  hidePopMenu();
}

//点击书本行，打开或折叠此书本内的文章
function toggleNavBook(nav) {
  var subNav = nav.querySelector('.nav-article');
  if (subNav) {
    subNav.style.display = (subNav.style.display == "block") ? "none" : "block";
  }
  hidePopMenu();
}

//Kindle浏览器有诸多限制，需要使用这个函数来调整一些元素的高度
function adjustContentHeight() {
  var content = document.getElementById('content');
  var navbar = document.getElementById('navbar');
  var navContent = document.getElementById('nav-content');
  var footer = document.getElementById('nav-footer');
  setInkMode(g_inkMode);
  if (navbar.offsetHeight && footer.offsetHeight) {
    navContent.style.height = (navbar.offsetHeight - footer.offsetHeight) + 'px';
  }
  if (!isMobile()) {
    navbar.style.display = "block";
  }
  container.style.height = getViewportHeight() + 'px';
  content.style.height = getViewportHeight() + 'px';
}

//导航栏往上翻页
function navPageUp() {
  var navbar = document.getElementById('navbar');
  var navContent = document.getElementById('nav-content');
  var footer = document.getElementById('nav-footer');
  if (navbar.clientHeight && footer.offsetHeight) {
    var height = navbar.clientHeight - footer.offsetHeight - 40;
    navContent.scrollTop = Math.max(navContent.scrollTop - height, 0);
  }
  hidePopMenu();
}

//导航栏往下翻页
function navPageDown() {
  var navbar = document.getElementById('navbar');
  var navContent = document.getElementById('nav-content');
  var footer = document.getElementById('nav-footer');
  if (navbar.clientHeight && footer.offsetHeight) {
    var height = navbar.clientHeight - footer.offsetHeight - 40;
    navContent.scrollTop = Math.min(navContent.scrollTop + height, navContent.scrollHeight);
  }
  hidePopMenu();
}

//关闭导航栏
function navCloseNav() {
  if (isMobile()) {
    hidePopMenu();
    hideNavbar();
  }
}

//导航栏打开或折叠所有项目
//level: 0 - 折叠所有，1 - 打开第一级，2 - 打开第一级和第二级
function navExpandCollapseAll(level) {
  var navContent = document.getElementById('nav-content');
  var items = navContent.querySelectorAll('.tree-icon');
  for (var i = 0; i < items.length; i++) {
    items[i].innerHTML = level ? "▾" : "▸";
  }
  items = navContent.querySelectorAll('.nav-book, .nav-article');
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var classList = item.classList;
    if (classList.contains('nav-article')) {
      item.style.display = (level >= 2) ? "block" : "none";
    } else if (classList.contains('nav-book')) {
      item.style.display = (level >= 1) ? "block" : "none";
    }
  }
  hidePopMenu();
}

//在导航栏定位到当前正在看的文章，此文章所在的书籍展开，如果文章不在屏幕范围为，则滚动直到可视
function locateCurrentArticle() {
  var art = g_currentArticle;
  if (isEmpty(art)) {
    return;
  }
  
  navExpandCollapseAll(0); //先全部折叠
  var navContent = document.getElementById('nav-content');
  var items = navContent.querySelectorAll('.nav-title');
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    if (item.getAttribute('data-src') == art.src) {
      var navArticle = item.parentElement;
      var navBook = navArticle.parentElement;
      var navItem = navBook.parentElement;
      var books = navItem.querySelectorAll('.nav-book'); //显示这一天所有的book
      for (var j = 0; j < books.length; j++) {
        books[j].style.display = "block";
      }
      navArticle.style.display = "block";
      navItem.style.display = "block";
      var icon = navItem.querySelector('.tree-icon');
      icon.innerHTML = "▾";
      scrollToNode(navContent, item);
      break;
    }
  }
}

//滚动容器，尽量让node位于容器可视范围中间位置
function scrollToNode(container, node) {
  var height = container.clientHeight;
  var nodeTop = node.offsetTop;
  var nodeHeight = node.clientHeight;
  var pos = Math.max(0, nodeTop - (height / 2) + (nodeHeight / 2));
  container.scrollTop = pos;
}

//删除一本或多本书
function navDeleteBooks(event) {
  hidePopMenu();
  if (isEmpty(g_books)) {
    return;
  }
  var chks = document.querySelectorAll('.nav-book-chk:checked');
  if (chks.length == 0) {
    alert(i18n.selectAtleastOneItem);
    return;
  }

  var books = [];
  var titles = []
  for (var i = 0; i < chks.length; i++) {
    books.push(chks[i].value); //bookDir
    titles.push(chks[i].nextElementSibling.textContent);
  }
  var titleStr = titles.slice(0, 5).join('\n');
  if (titles.length > 5) {
    titleStr += '\n...';
  }
  if (!(event.ctrlKey || event.metaKey) && !confirm(i18n.areYouSureDelete + '\n' + titleStr)) {
    return;
  }

  ajax_post('/reader/delete', {books: books.join('|')}, function (resp) {
    if (resp.status == 'ok') {
      deleteBooksAndUpdateUi(books);
    } else {
      alert(resp.status);
    }
  });
}

//删除本地数组中的元素然后更新页面，books为数组，元素为 'date/title'
function deleteBooksAndUpdateUi(books) {
  //[{date:, books: [{title:, articles:[{text:, src:}],},...]}, ]
  var removeSet = new Set(books);
  g_books = g_books.filter(function (entry) {
      entry.books = entry.books.filter(function (book) {
          return !removeSet.has(book.bookDir);
      });
      return entry.books.length > 0;
  });
  populateBooks(1);
}

//显示/隐藏导航设置菜单
function toggleNavPopMenu() {
  var menu = document.getElementById('nav-popmenu');
  //var inkIcon = document.getElementById('ink-mode').querySelector('.check-icon');
  //inkIcon.innerHTML = g_inkMode ? '✔' : '☐';
  var allowIcon = document.getElementById('allow-links').querySelector('.check-icon');
  allowIcon.innerHTML = g_allowLinks ? '✔' : '☐';
  menu.style.display = (menu.style.display == 'block') ? 'none' : 'block';
}

//增加iframe的字号
function increaseFontSize() {
  g_fontSize = parseFloat(Math.min(g_fontSize * 1.2, 3.0).toFixed(1));
  adjustIFrameStyle();
  if (isMobile()) {
    hideNavbar();
  }
  saveSettings();
}

//减小iframe的字号
function decreaseFontSize() {
  g_fontSize = parseFloat(Math.max(g_fontSize * 0.8, 0.5).toFixed(1));
  adjustIFrameStyle();
  if (isMobile()) {
    hideNavbar();
  }
  saveSettings();
}

//将目前的配置保存到服务器
function saveSettings() {
  ajax_post('/reader/settings', {fontSize: g_fontSize, allowLinks: g_allowLinks, inkMode: g_inkMode});
}

//显示触摸区域图示
function showTouchHint() {
  hidePopMenu();
  if (isMobile()) {
    document.getElementById('navbar').style.display = 'none';
  }
  var iframe = document.getElementById('iframe');
  //iframe.style.height = 'auto'; //规避iframe只能变大不能变小的bug
  iframe.style.display = "none"; //加载完成后再显示
  iframe.src = '/reader/404?tips=';
}

//隐藏弹出的设置菜单
function hidePopMenu() {
  document.getElementById('nav-popmenu').style.display = 'none';
}

//隐藏左侧导航栏
function hideNavbar() {
  hidePopMenu();
  if (isMobile()) {
    document.getElementById('navbar').style.display = 'none';
  }
}

//是否允许点击链接打开新网页
function toggleAllowLinks() {
  g_allowLinks = !g_allowLinks;
  var allowIcon = document.getElementById('allow-links').querySelector('.check-icon');
  allowIcon.innerHTML = g_allowLinks ? '✔' : '☐';
  saveSettings();
}

//是否允许墨水屏模式
function toggleInkMode() {
  g_inkMode = !g_inkMode;
  setInkMode(g_inkMode);
  saveSettings();
}

//根据是否使能墨水屏模式，设置相应的元素属性
function setInkMode(enable) {
  return; //暂时先禁用
  var container = document.getElementById('container');
  var content = document.getElementById('content');
  var indicator = document.getElementById('pos-indicator');
  var icon = document.getElementById('ink-mode').querySelector('.check-icon');
  var body = document.body;
  if (enable) {
    icon.innerHTML = '✔';
    container.style.height = getViewportHeight() + 'px';
    content.style.height = getViewportHeight() + 'px';
    content.style.scrollbarWidth = "none";
    //body.style.overflow = 'hidden';
    //body.style.scrollbarWidth = 'none';
    //body.style.scrollbarColor = 'transparent';
    //body.style.msOverflowStyle = 'none';
    //indicator.style.display = 'block';
  } else {
    icon.innerHTML = '☐';
    container.style.height = g_iframeScrollHeight + 'px';
    content.style.height = g_iframeScrollHeight + 'px';
    content.style.scrollbarWidth = "auto";
    //body.style.overflow = 'auto';
    //body.style.scrollbarWidth = 'auto';
    //body.style.scrollbarColor = 'auto';
    //body.style.msOverflowStyle = 'scrollbar';
    //indicator.style.display = 'none';
  }
}

//根据当前的文章列表，填充左侧导航栏
//expandLevel：控制初始显示的内容, 0-全部折叠，1-仅显示日期和书名，2-显示全部内容
function populateBooks(expandLevel) {
  var navContent = document.getElementById('nav-content');
  var ostr = [];
  for (var i = 0; i < g_books.length; i++) {
    var someDay = g_books[i];
    var dateStr = someDay.date;
    var books = someDay.books;
    if (!dateStr || !books || books.length == 0) {
      continue;
    }

    ostr.push('<div class="nav-item">' +
                '<div class="nav-date">' +
                  '<span class="tree-icon">&#x25b8;</span>');
    ostr.push(    '<span>' + dateStr + '</span>');
    ostr.push(  '</div>');
    for (var bIdx = 0; bIdx < books.length; bIdx++) {
      var book = books[bIdx];
      var articles = book.articles;
      if (!book || !articles || articles.length == 0) {
        continue;
      }
      ostr.push(
        '<div class="nav-book">' +
          '<div class="nav-book-title">' +
            '<input type="checkbox" class="nav-book-chk" onclick="javascript:event.stopPropagation()" value="' + book.bookDir + '"/>');
      ostr.push('<span>' + book.title + '</span>');
      ostr.push(
          '</div>');
      ostr.push(
          '<div class="nav-article">');
      for (var aIdx = 0; aIdx < articles.length; aIdx++) {
        var article = articles[aIdx];
        if (!article || !article.src || !article.text) {
          continue;
        }
        ostr.push(
             '<div class="nav-title" data-src="' + article.src +'">' +
                '<div>' +
                  articleSvgIcon() +
                  '<span class="nav-title-text">' + article.text + '</span>' +
                '</div>' +
              '</div>');
      }
      ostr.push(
          '</div>');
      ostr.push(
        '</div>');
    }
    ostr.push('</div>');
  }

  if (ostr.length > 0) {
    navContent.innerHTML = ostr.join('');
    navExpandCollapseAll(expandLevel);
  } else {
    //使用一个svg图像代替
    var svgDiv = document.getElementById('nothing-here');
    navContent.innerHTML = svgDiv.innerHTML;
  }
}

//文章前面的svg图标
function articleSvgIcon() {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11a9 9 0 0 1 9 9"></path><path d="M4 4a16 16 0 0 1 16 16"></path><circle cx="5" cy="19" r="1"></circle></svg>';
}

//判断点击的节点或父节点有没有包含特定的类名
function nodeOrChild(klass, target, parent) {
  while (target && target != parent) {
    if (target.classList.contains(klass)) {
      return target;
    }
    target = target.parentElement;
  }
  return null;
}

//监听点击文章标题的事件，展开或折叠树形结构，打开点击的文章
//此事件注册在nav-content上
function navClickEvent(event) {
  var parent = document.getElementById('nav-content');
  var target = event.target || event.srcElement;
  
  var navDate = nodeOrChild('nav-date', target, parent);
  var navBook = nodeOrChild('nav-book', target, parent);
  var navTitle = nodeOrChild('nav-title', target, parent);
  if (navTitle) {
    var src = navTitle.getAttribute('data-src');
    var span = navTitle.querySelector('.nav-title-text');
    var text = span ? span.textContent.trim() : '';
    if (src && text) {
      openArticle({text: text, src: src});
    }
  } else if (navBook) {
    toggleNavBook(navBook);
  } else if (navDate) {
    toggleNavDate(navDate);
  }
}

//推送当前正在阅读的书籍
function pushCurrentBook() {
  var art = g_currentArticle;
  if (!isEmpty(art)) {
    ajax_post('/reader/push', {type: 'book', src: art.src, title: art.text}, function (resp) {
      if (resp.status == 'ok') {
        alert(i18n.pushOk + '\n' + art.text);
      } else {
        alert(resp.status);
      }
    });
  } else {
    alert(i18n.noReading);
  }
  hidePopMenu();
}

//推送当前正在阅读的文章
function pushCurrentArticle() {
  var art = g_currentArticle;
  if (!isEmpty(art)) {
    var language = getBookLanguage(art);
    ajax_post('/reader/push', {type: 'article', src: art.src, title: art.text, language: language}, 
      function (resp) {
        if (resp.status == 'ok') {
          alert(i18n.pushOk + '\n' + art.text);
        } else {
          alert(resp.status);
        }
    });
  } else {
    alert(i18n.noReading);
  }
  hidePopMenu();
}

//通过一个文章获取对应书本的语言
function getBookLanguage(art) {
  for (var i = 0; i < g_books.length; i++) {
    var entry = g_books[i]; //date
    for (var j = 0; j < entry.books.length; j++) {
      var book = entry.books[j];
      var articles = book.articles;
      for (var k = 0; k < articles.length; k++) {
        if (articles[k].src == art.src) {
          return book.language;
        }
      }
    }
  }
  return '';
}

//点击某篇文章后在iframe打开，article是字典
function openArticle(article) {
  if (article.src) {
    var iframe = document.getElementById('iframe');
    //iframe.style.height = 'auto'; //规避iframe只能变大不能变小的bug
    iframe.style.display = "none"; //加载完成后再显示
    iframe.src = '/reader/article/' + article.src;
    g_currentArticle = article;
  }
  hideNavbar();
}

//打开上一篇文章
function openPrevArticle() {
  openArticle(findPreviousArticle(g_currentArticle));
  locateCurrentArticle();
}

//打开下一篇文章
function openNextArticle() {
  openArticle(findNextArticle(g_currentArticle));
  locateCurrentArticle();
}

//给定一篇文章，返回此文章前一篇文章，如果art为空，则返回第一篇文章
//返回为一个字典对象
function findPreviousArticle(art) {
  var prev = {};
  for (var i = 0; i < g_books.length; i++) {
    var entry = g_books[i]; //date
    for (var j = 0; j < entry.books.length; j++) {
      var book = entry.books[j];
      var articles = book.articles;
      for (var k = 0; k < articles.length; k++) {
        var current = articles[k];
        if (!art.src) {
          return current;
        } else if (current.src == art.src) {
          return prev;
        }
        prev = current;
      }
    }
  }
  return prev;
}

//给定一篇文章，返回此文章后一篇文章，如果art为空，则返回第一篇找到的文章
//返回为一个字典 {text:, src:,}
function findNextArticle(art) {
  var found = false;
  for (var i = 0; i < g_books.length; i++) {
    var entry = g_books[i]; //date
    for (var j = 0; j < entry.books.length; j++) {
      var book = entry.books[j];
      var articles = book.articles;
      for (var k = 0; k < articles.length; k++) {
        var current = articles[k];
        if (found || !art.src) {
          return current;
        }
        if (current.src == art.src) {
          found = true;
        }
      }
    }
  }
  return {};
}

//iframe每次加载一个新的文档后会调用此函数，注册一些事件并更新一些变量
function iframeLoadEvent(iframe) {
  adjustIFrameStyle(iframe);
  var doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.addEventListener('click', function(event) {
    var target = event.target || event.srcElement;
    if (target && (target.tagName == 'A')) {
      event.stopPropagation();
      event.preventDefault();
      var href = target.getAttribute('href');
      if (href && g_allowLinks) {
        //window.open(href, '_blank');
        window.location.href = href; //kindle不支持window.open()
        return;
      }
    }
    if (!doc.getSelection().toString()) { //没有选择文本才翻页
      clickEvent(event);
    }
  });
  doc.addEventListener('keydown', documentKeyDownEvent);
}

//每次iframe加载完成后调整其样式和容器高度
function adjustIFrameStyle(iframe) {
  iframe = iframe || document.getElementById('iframe');
  var doc = iframe.contentDocument || iframe.contentWindow.document;
  var body = doc.body;
  iframe.style.height = 'auto';
  body.style.textAlign = 'justify';
  body.style.wordWrap = 'break-word';
  body.style.hyphens = 'auto';
  body.style.marginRight = '10px';
  body.style.fontSize = g_fontSize.toFixed(1) + 'em';
  iframe.style.display = "block";

  var vh = getViewportHeight();
  g_iframeScrollHeight = Math.max(doc.documentElement.scrollHeight || body.scrollHeight, vh);
  //g_iframeClientHeight = Math.max(doc.documentElement.clientHeight || body.clientHeight, vh);
  iframe.style.height = g_iframeScrollHeight + 'px';
}

//使用键盘快捷键翻页
function documentKeyDownEvent(event) {
  var key = event.key;
  //console.log('Key pressed:', key);
  if ((key == ' ') || (key == 'ArrowDown') || (key == 'ArrowRight') || (key == 'PageDown')) {
    event.stopPropagation();
    event.preventDefault();
    pageDown();
  } else if ((key == 'ArrowUp') || (key == 'ArrowLeft') || (key == 'PageUp')) {
    event.stopPropagation();
    event.preventDefault();
    pageUp();
  }
}

//文档加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
  var content = document.getElementById('content');
  var navContent = document.getElementById('nav-content');
  var iframe = document.getElementById('iframe');
  adjustContentHeight();
  window.addEventListener('resize', adjustContentHeight);
  document.addEventListener('keydown', documentKeyDownEvent);
  //window.addEventListener('message', iFrameEvent);
  content.addEventListener('click', clickEvent);
  content.addEventListener('scroll', updatePosIndicator);
  navContent.addEventListener('click', navClickEvent);
  navContent.addEventListener('scroll', updateNavIndicator);
  populateBooks(1);
  iframe.style.display = "none"; //加载完成后再显示
  iframe.src = iframe.src; //强制刷新一次，避免偶尔出现不能点击的情况
});
