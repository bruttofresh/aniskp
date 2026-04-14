(function () {
  'use strict';

  if (window._aerialScreensaver) return;
  window._aerialScreensaver = true;

  var customVideoBlobUrl = null;
  var customVideoLoaded = false;
  var active = false;
  var idleTimer = null;
  var playerPlaying = false;

  var container = null;
  var videoEl = null;
  var infoEl = null;
  var clockEl = null;
  var clockTimer = null;
  var poiInterval = null;
  var styleTag = null;

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  function getSetting(key, def) {
    return Lampa.Storage.get('screensaver_' + key, def);
  }

  function isEnabled() {
    var v = getSetting('enabled', true);
    return v === true || v === 'true';
  }

  function getTimeout() {
    return parseInt(getSetting('timeout', '5')) || 5;
  }

  function getCustomVideoUrl() {
    return getSetting('custom_video_url', '');
  }

  var CSS = [
    '#aerial-screensaver {',
    '  position: fixed; top: 0; left: 0;',
    '  width: 100vw; height: 100vh;',
    '  z-index: 999999; background: #000;',
    '  opacity: 0; transition: opacity 1.5s ease;',
    '}',
    '#aerial-screensaver.show { opacity: 1; }',
    '#aerial-screensaver video {',
    '  width: 100%; height: 100%; object-fit: cover;',
    '}',
    '#aerial-info {',
    '  position: absolute; bottom: 8vh; left: 4vw;',
    '  max-width: 55vw;',
    '  color: #fff; font-size: 1.5em; font-weight: 300;',
    '  text-shadow: 0 1px 8px rgba(0,0,0,0.9), 0 0 30px rgba(0,0,0,0.4);',
    '  opacity: 0; transition: opacity 1.2s ease;',
    '  letter-spacing: 0.02em;',
    '  font-family: -apple-system, "Helvetica Neue", Arial, sans-serif;',
    '}',
    '#aerial-info.visible { opacity: 1; }',
    '#aerial-clock {',
    '  position: absolute; bottom: 8vh; right: 4vw;',
    '  color: rgba(255,255,255,0.75); font-size: 2.8em; font-weight: 200;',
    '  text-shadow: 0 1px 8px rgba(0,0,0,0.9);',
    '  font-family: -apple-system, "Helvetica Neue", Arial, sans-serif;',
    '  letter-spacing: 0.05em;',
    '}'
  ].join('\n');

  var iconSVG = '<svg viewBox="0 0 512 512" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M405.1 78.5C365.4 38.8 312.7 16 256 16S146.6 38.8 106.9 78.5 64 183.2 64 240c0 69.5 34.7 134.5 92.8 173.3l12.3 8.2V464h48v-42.5h78V464h48v-42.5l12.3-8.2C413.3 374.5 448 309.5 448 240c0-56.7-22.8-109.4-42.9-161.5zM256 400c-88.2 0-160-71.8-160-160S167.8 80 256 80s160 71.8 160 160-71.8 160-160 160zm0-288c-70.6 0-128 57.4-128 128s57.4 128 128 128 128-57.4 128-128-57.4-128-128-128zm64 144h-48v48h-32v-48h-48v-32h48v-48h32v48h48v32z"/><circle cx="256" cy="240" r="80" opacity="0.3"/></svg>';

  Lampa.Lang.add({
    screensaver_title: {
      ru: 'Заставка',
      uk: 'Заставка',
      en: 'Screensaver'
    },
    screensaver_enable: {
      ru: 'Заставка',
      uk: 'Заставка',
      en: 'Screensaver'
    },
    screensaver_enable_descr: {
      ru: 'Заставка при бездействии',
      uk: 'Заставка при бездiяльностi',
      en: 'Idle screensaver'
    },
    screensaver_timeout_name: {
      ru: 'Таймаут',
      uk: 'Таймаут',
      en: 'Timeout'
    },
    screensaver_timeout_descr: {
      ru: 'Время бездействия до запуска',
      uk: 'Час бездiяльностi до запуску',
      en: 'Idle time before activation'
    },
    screensaver_custom_video_name: {
      ru: 'Ссылка на видео',
      uk: 'Посилання на вiдео',
      en: 'Video URL'
    },
    screensaver_custom_video_descr: {
      ru: 'Прямая ссылка на MP4-файл для заставки (кешируется)',
      uk: 'Пряме посилання на MP4-файл для заставки (кешується)',
      en: 'Direct URL to MP4 file for screensaver (cached)'
    }
  });

  Lampa.SettingsApi.addComponent({
    component: 'screensaver',
    icon: iconSVG,
    name: Lampa.Lang.translate('screensaver_title')
  });

  Lampa.SettingsApi.addParam({
    component: 'screensaver',
    param: {
      name: 'screensaver_enabled',
      type: 'trigger',
      default: true
    },
    field: {
      name: Lampa.Lang.translate('screensaver_enable'),
      description: Lampa.Lang.translate('screensaver_enable_descr')
    },
    onChange: function (val) {
      if (val === 'false' || val === false) stopIdle();
      else resetIdle();
    }
  });

  Lampa.SettingsApi.addParam({
    component: 'screensaver',
    param: {
      name: 'screensaver_timeout',
      type: 'select',
      values: {
        '2': '2 min',
        '3': '3 min',
        '5': '5 min',
        '10': '10 min',
        '15': '15 min',
        '20': '20 min'
      },
      default: '5'
    },
    field: {
      name: Lampa.Lang.translate('screensaver_timeout_name'),
      description: Lampa.Lang.translate('screensaver_timeout_descr')
    }
  });

  Lampa.SettingsApi.addParam({
    component: 'screensaver',
    param: {
      name: 'screensaver_custom_video_url',
      type: 'button',
      default: '',
      values: {}
    },
    field: {
      name: Lampa.Lang.translate('screensaver_custom_video_name'),
      description: Lampa.Lang.translate('screensaver_custom_video_descr')
    },
    onChange: function () {
      Lampa.Input.edit({
        title: Lampa.Lang.translate('screensaver_custom_video_name'),
        value: getSetting('custom_video_url', ''),
        free: true,
        nosave: true
      }, function (new_val) {
        Lampa.Storage.set('screensaver_custom_video_url', new_val);
        customVideoBlobUrl = null;
        customVideoLoaded = false;
        loadCustomVideo();
      });
    }
  });

  function loadCustomVideo() {
    var url = getCustomVideoUrl();
    if (!url || customVideoLoaded) return;

    fetch(url)
      .then(response => {
        if (!response.ok) throw new Error('Failed to fetch video');
        return response.blob();
      })
      .then(blob => {
        customVideoBlobUrl = URL.createObjectURL(blob);
        customVideoLoaded = true;
      })
      .catch(e => {
        console.error('Error loading custom video:', e);
        customVideoLoaded = false;
      });
  }

  function loadVideos(cb) {
    var url = getCustomVideoUrl();
    if (!url) return cb([]);

    if (!customVideoLoaded) {
      loadCustomVideo();
      setTimeout(() => cb([]), 1000);
      return;
    }

    var videoData = {
      id: 'custom',
      name: '',
      accessibilityLabel: '',
      type: 'all',
      src: customVideoBlobUrl,
      pointsOfInterest: {}
    };
    cb([videoData]);
  }

  function resetIdle() {
    if (active) return;
    clearTimeout(idleTimer);
    if (!isEnabled() || !getCustomVideoUrl()) return;

    var ms = getTimeout() * 60 * 1000;
    idleTimer = setTimeout(function () {
      if (playerPlaying) { resetIdle(); return; }
      try {
        if (Lampa.Player && Lampa.Player.runing) { resetIdle(); return; }
      } catch (e) {}
      startScreensaver();
    }, ms);
  }

  function stopIdle() {
    clearTimeout(idleTimer);
  }

  var activityDebounce = null;
  function onUserActivity() {
    if (active) return;
    if (activityDebounce) return;
    activityDebounce = setTimeout(function () {
      activityDebounce = null;
    }, 2000);
    resetIdle();
  }

  function startScreensaver() {
    if (active) return;
    loadVideos(function (list) {
      if (!list.length) { resetIdle(); return; }
      active = true;
      createOverlay();
      playNext(list);
    });
  }

  function stopScreensaver() {
    if (!active) return;
    active = false;
    destroyOverlay();
    resetIdle();
  }

  function createOverlay() {
    styleTag = document.createElement('style');
    styleTag.textContent = CSS;
    document.head.appendChild(styleTag);

    container = document.createElement('div');
    container.id = 'aerial-screensaver';

    videoEl = document.createElement('video');
    videoEl.autoplay = true;
    videoEl.muted = true;
    videoEl.playsInline = true;
    videoEl.loop = true;
    videoEl.setAttribute('playsinline', '');
    videoEl.setAttribute('webkit-playsinline', '');

    infoEl = document.createElement('div');
    infoEl.id = 'aerial-info';

    clockEl = document.createElement('div');
    clockEl.id = 'aerial-clock';

    container.appendChild(videoEl);
    container.appendChild(infoEl);
    container.appendChild(clockEl);
    document.body.appendChild(container);

    updateClock();
    clockTimer = setInterval(updateClock, 30000);

    setTimeout(function () {
      if (container) container.classList.add('show');
    }, 50);

    document.addEventListener('keydown', onDismissKey, true);
    container.addEventListener('click', stopScreensaver);
    container.addEventListener('touchstart', stopScreensaver);
  }

  function destroyOverlay() {
    document.removeEventListener('keydown', onDismissKey, true);
    clearTimeout(loadTimeout);
    clearTimeout(infoHideTimer);
    clearInterval(clockTimer);
    clearInterval(poiInterval);

    if (videoEl) {
      videoEl.pause();
      videoEl.removeAttribute('src');
      try { videoEl.load(); } catch (e) {}
      videoEl = null;
    }

    if (container) {
      container.classList.remove('show');
      var c = container;
      setTimeout(function () {
        if (c && c.parentNode) c.parentNode.removeChild(c);
      }, 400);
      container = null;
    }
    infoEl = null;
    clockEl = null;

    if (styleTag && styleTag.parentNode) {
      styleTag.parentNode.removeChild(styleTag);
      styleTag = null;
    }
  }

  function onDismissKey(e) {
    e.preventDefault();
    e.stopImmediatePropagation();
    stopScreensaver();
  }

  function updateClock() {
    if (!clockEl) return;
    var now = new Date();
    clockEl.textContent = pad2(now.getHours()) + ':' + pad2(now.getMinutes());
  }

  var loadTimeout = null;
  var failedIds = {};

  function playNext(list) {
    if (!active || !videoEl) return;

    var chosen = list[0];
    var src = chosen.src;

    if (!src) {
      setTimeout(function () { playNext(list); }, 1000);
      return;
    }

    showInfo(chosen.name || chosen.accessibilityLabel || '', true);

    clearTimeout(loadTimeout);
    videoEl.oncanplay = null;
    videoEl.onended = null;
    videoEl.onerror = null;

    videoEl.oncanplay = function () {
      clearTimeout(loadTimeout);
      videoEl.oncanplay = null;
      videoEl.play().catch(function () {});
      setupPOI(chosen);
    };

    videoEl.onerror = function () {
      clearTimeout(loadTimeout);
      setTimeout(function () { playNext(list); }, 2000);
    };

    loadTimeout = setTimeout(function () {
      if (!active || !videoEl) return;
      videoEl.oncanplay = null;
      videoEl.pause();
      videoEl.removeAttribute('src');
      try { videoEl.load(); } catch (e) {}
      playNext(list);
    }, 20000);

    videoEl.src = src;
    videoEl.load();
  }

  function setupPOI(data) {
    clearInterval(poiInterval);
    if (!infoEl) return;

    var poi = data.pointsOfInterest || {};
    var keys = [];
    for (var k in poi) {
      if (poi.hasOwnProperty(k)) keys.push(Number(k));
    }
    keys.sort(function (a, b) { return a - b; });

    if (!keys.length) return;

    var lastShown = '';
    poiInterval = setInterval(function () {
      if (!active || !videoEl) { clearInterval(poiInterval); return; }

      var t = videoEl.currentTime;
      var label = '';
      for (var i = keys.length - 1; i >= 0; i--) {
        if (t >= keys[i]) {
          label = poi[String(keys[i])] || poi[keys[i]];
          break;
        }
      }

      if (label && label !== lastShown) {
        lastShown = label;
        showInfo(label);
      }
    }, 1000);
  }

  var infoHideTimer = null;

  function showInfo(text, persistent) {
    if (!infoEl) return;
    clearTimeout(infoHideTimer);
    infoEl.classList.remove('visible');
    setTimeout(function () {
      if (!infoEl) return;
      infoEl.textContent = text;
      infoEl.classList.add('visible');
      if (!persistent) {
        infoHideTimer = setTimeout(function () {
          if (!infoEl) return;
          infoEl.classList.remove('visible');
        }, 7000);
      }
    }, 400);
  }

  try {
    Lampa.Listener.follow('player', function (e) {
      if (e.type === 'start' || e.type === 'play') {
        playerPlaying = true;
        stopIdle();
      }
      if (e.type === 'destroy' || e.type === 'end') {
        playerPlaying = false;
        resetIdle();
      }
    });
  } catch (e) {}

  function init() {
    var events = ['keydown', 'mousemove', 'click', 'touchstart', 'wheel'];
    for (var i = 0; i < events.length; i++) {
      document.addEventListener(events[i], onUserActivity, true);
    }

    resetIdle();

    loadCustomVideo();
  }

  if (window.appready) {
    init();
  } else {
    Lampa.Listener.follow('app', function (e) {
      if (e.type === 'ready') init();
    });
  }
})();
