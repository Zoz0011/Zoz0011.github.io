(function (global) {
  "use strict";

  var PREFIX = "good-game-safe-retry:";
  var GOLDHEN_VERSION = "2.4b18.12";
  var AUTO_EXIT_DELAY = 5000;
  var autoExitScheduled = false;

  function getNode(id) {
    return document.getElementById(id);
  }

  function setSafeRetry(visible, label) {
    var button = getNode("safe-retry-button");
    if (!button) return;
    button.hidden = !visible;
    if (label) button.innerHTML = label;
  }

  function setAttempt(current, total) {
    var badge = getNode("attempt-badge");
    if (!badge) return;
    if (!current || !total) {
      badge.hidden = true;
      return;
    }
    badge.innerHTML = "المحاولة " + current + " من " + total;
    badge.hidden = false;
  }

  function setState(state, progress, detail) {
    var panel = getNode("status-panel");
    var bar = getNode("status-progress");
    var chip = getNode("status-chip");
    var detailNode = getNode("status-detail");
    var message = getNode("msgs");
    var labels = {
      loading: "جاري التشغيل",
      retry: "إعادة محاولة آمنة",
      success: "تم بنجاح",
      warning: "تنبيه",
      error: "تعذّر التشغيل",
      cache: "تجهيز الكاش"
    };
    var colors = {
      loading: "#ffffff",
      retry: "#7de3ff",
      success: "#72f7b1",
      warning: "#ffd45a",
      error: "#ff7b8c",
      cache: "#ffffff"
    };

    state = state || "loading";
    if (panel) panel.setAttribute("data-state", state);
    if (chip) chip.innerHTML = labels[state] || labels.loading;
    if (detailNode && detail) detailNode.innerHTML = detail;
    if (bar && typeof progress === "number") {
      progress = Math.max(0, Math.min(100, progress));
      bar.style.width = progress + "%";
      bar.parentNode.setAttribute("aria-valuenow", String(progress));
    }
    if (message) message.style.color = colors[state] || colors.loading;
  }

  function isPS4Browser() {
    return /PlayStation 4/i.test(navigator.userAgent || "");
  }

  function closePS4Browser() {
    try {
      global.open("", "_self");
    } catch (error) {}

    try {
      global.close();
    } catch (error) {}

    setTimeout(function () {
      if (!document.hidden) {
        setState(
          "success",
          100,
          "تم تحميل GoldHEN. إذا ظل المتصفح مفتوحًا، اضغط زر PS للعودة للواجهة."
        );
      }
    }, 700);
  }

  function scheduleAutoExit() {
    var seconds = Math.ceil(AUTO_EXIT_DELAY / 1000);

    if (autoExitScheduled || !isPS4Browser()) return;
    autoExitScheduled = true;

    function updateCountdown() {
      setState(
        "success",
        100,
        "تم تحميل GoldHEN بنجاح؛ سيتم إغلاق المتصفح خلال " + seconds + " ثوانٍ."
      );
      seconds--;
      if (seconds > 0) setTimeout(updateCountdown, 1000);
    }

    updateCountdown();
    setTimeout(closePS4Browser, AUTO_EXIT_DELAY);
  }

  function syncStatus(message) {
    var text = String(message || "").replace(/\s+/g, " ").toLowerCase();
    var retryMatch = text.match(/(\d+)\s*\/\s*(\d+)/);
    var percentMatch = text.match(/(\d+)\s*%/);
    var safeFailure = /no console restart|restart is not required|console restart is not required|reopen the browser|close and reopen the browser|إعادة تشغيل الجهاز غير مطلوبة|تعذّر تثبيت الكاش|تعذّر تحميل ملفات التشغيل|توقفت المحاولات الآمنة/.test(text);
    var dangerousFailure = /restart the console|reboot the console|أعد تشغيل الجهاز/.test(text) && !safeFailure;

    if (retryMatch) setAttempt(parseInt(retryMatch[1], 10), parseInt(retryMatch[2], 10));

    if (/already loaded|loaded|successfully|بنجاح|جاهز للعمل بدون إنترنت/.test(text)) {
      var goldhenReady = /goldhen/.test(text) && /already loaded|loaded|successfully|بنجاح/.test(text);
      setAttempt(0, 0);
      setSafeRetry(false);
      setState("success", 100, /cache|كاش/.test(text)
        ? "الموقع جاهز للعمل بدون إنترنت؛ أغلق المتصفح وافتحه مرة أخرى."
        : "تم تحميل GoldHEN بنجاح والجهاز جاهز للاستخدام.");
      if (goldhenReady) scheduleAutoExit();
    } else if (dangerousFailure) {
      setAttempt(0, 0);
      setSafeRetry(false);
      setState("error", 100, "توقفت العملية بعد بدء مرحلة النظام؛ اتبع رسالة إعادة التشغيل الظاهرة.");
    } else if (safeFailure) {
      setAttempt(0, 0);
      setSafeRetry(true, "إعادة المحاولة الآمنة");
      setState("warning", 100, /cache|كاش/.test(text)
        ? "امسح بيانات الموقع ثم أعد تثبيت الكاش؛ إعادة تشغيل الجهاز غير مطلوبة."
        : "يمكنك المحاولة مرة أخرى بدون إعادة تشغيل جهاز البلايستيشن.");
    } else if (/retry|attempt|محاولة/.test(text)) {
      setSafeRetry(false);
      setState("retry", retryMatch ? Math.round((parseInt(retryMatch[1], 10) / parseInt(retryMatch[2], 10)) * 65) : 45, "جاري إعادة المحاولة تلقائيًا بدون إعادة تشغيل الجهاز.");
    } else if (/payload|goldhen/.test(text)) {
      setSafeRetry(false);
      setState("loading", 78, "جاري تحميل ملف GoldHEN والتحقق من جاهزيته.");
    } else if (/kernel|exploit|webkit|jailbreak/.test(text)) {
      setSafeRetry(false);
      setState("loading", 52, "جاري تجهيز مرحلة التشغيل؛ برجاء الانتظار وعدم إغلاق الصفحة.");
    } else if (/unsupported|only for ps4|not found/.test(text)) {
      setAttempt(0, 0);
      setSafeRetry(false);
      setState("error", 100, "تحقق من جهاز PS4 وإصدار النظام المدعوم.");
    } else if (/cache|كاش/.test(text)) {
      setSafeRetry(false);
      setState("cache", percentMatch ? parseInt(percentMatch[1], 10) : 18, "جاري تجهيز ملفات الموقع للعمل بدون إنترنت.");
    }
  }

  function status(message, color, state, progress, detail) {
    var node = getNode("msgs");
    if (!node) return;
    node.innerHTML = message;
    if (color) node.style.color = color;
    if (state) setState(state, progress, detail);
    else syncStatus(message);
  }

  function readCount(scope) {
    try {
      var value = parseInt(sessionStorage.getItem(PREFIX + scope) || "0", 10);
      return isFinite(value) && value > 0 ? value : 0;
    } catch (error) {
      return 0;
    }
  }

  function clearRetry(scope) {
    try {
      sessionStorage.removeItem(PREFIX + scope);
    } catch (error) {}
  }

  function safeReload(scope, reason, maxAttempts, delayMs) {
    var limit = typeof maxAttempts === "number" ? maxAttempts : 3;
    var delay = typeof delayMs === "number" ? delayMs : 1200;
    var count = readCount(scope);

    if (count >= limit) {
      clearRetry(scope);
      status(
        "توقفت المحاولات الآمنة التلقائية",
        "#ffd45a",
        "warning",
        100,
        "اضغط إعادة المحاولة الآمنة؛ لا تحتاج لإعادة تشغيل جهاز البلايستيشن."
      );
      setAttempt(0, 0);
      setSafeRetry(true, "إعادة المحاولة الآمنة");
      return false;
    }

    try {
      sessionStorage.setItem(PREFIX + scope, String(count + 1));
    } catch (error) {
      status("أعد المحاولة من الصفحة", "#ffd45a", "warning", 100, "إعادة تشغيل جهاز البلايستيشن غير مطلوبة.");
      setSafeRetry(true, "إعادة المحاولة الآمنة");
      return false;
    }

    setAttempt(count + 1, limit);
    setSafeRetry(false);
    status(
      "إعادة محاولة آمنة " + (count + 1) + "/" + limit + "... برجاء الانتظار",
      "#67d8ff",
      "retry",
      Math.round(((count + 1) / limit) * 65),
      "جاري إعادة المحاولة تلقائيًا بدون إعادة تشغيل الجهاز."
    );

    setTimeout(function () {
      try {
        location.reload();
      } catch (error) {
        status("أعد المحاولة من الصفحة", "#ffd45a", "warning", 100, "إعادة تشغيل جهاز البلايستيشن غير مطلوبة.");
        setSafeRetry(true, "إعادة المحاولة الآمنة");
      }
    }, delay);
    return true;
  }

  function loadBinary(url, options) {
    options = options || {};
    var attempts = options.attempts || 5;
    var timeout = options.timeout || 12000;
    var expectedBytes = options.expectedBytes || 0;
    var retryDelay = options.retryDelay || 350;

    return new Promise(function (resolve, reject) {
      var attempt = 0;

      function run() {
        attempt++;
        var xhr = new XMLHttpRequest();
        var done = false;

        function fail(message) {
          if (done) return;
          done = true;
          if (attempt < attempts) {
            setAttempt(attempt + 1, attempts);
            status(
              "إعادة تحميل GoldHEN " + (attempt + 1) + "/" + attempts + "...",
              "#67d8ff",
              "retry",
              Math.round(((attempt + 1) / attempts) * 80),
              "جاري إعادة تحميل الملف تلقائيًا؛ لا تغلق الصفحة."
            );
            setTimeout(run, retryDelay);
            return;
          }
          reject(new Error(message || "payload request failed"));
        }

        xhr.open("GET", url, true);
        xhr.responseType = "arraybuffer";
        xhr.timeout = timeout;
        xhr.onreadystatechange = function () {
          if (xhr.readyState !== 4 || done) return;
          var okStatus = xhr.status === 200 || xhr.status === 0;
          var bytes = xhr.response && xhr.response.byteLength ? xhr.response.byteLength : 0;
          if (okStatus && bytes > 0 && (!expectedBytes || bytes === expectedBytes)) {
            done = true;
            resolve(xhr.response);
          } else {
            fail(
              "payload response invalid: status=" + xhr.status + " bytes=" + bytes
            );
          }
        };
        xhr.onerror = function () {
          fail("payload network error");
        };
        xhr.ontimeout = function () {
          fail("payload request timeout");
        };

        try {
          xhr.send();
        } catch (error) {
          fail(error && error.message ? error.message : String(error));
        }
      }

      run();
    });
  }

  function cacheProgress(percent) {
    percent = Math.max(0, Math.min(100, parseInt(percent, 10) || 0));
    status(
      "جاري تثبيت الكاش: " + percent + "%",
      "#ffffff",
      "cache",
      percent,
      "يتم حفظ ملفات الموقع الآن لتعمل بدون إنترنت."
    );
    setSafeRetry(false);
  }

  function cacheReady() {
    status(
      "تم تثبيت الكاش بنجاح ✔",
      "#72f7b1",
      "success",
      100,
      "الموقع جاهز للعمل بدون إنترنت؛ أغلق المتصفح وافتحه مرة أخرى."
    );
    setAttempt(0, 0);
    setSafeRetry(false);
  }

  function cacheError() {
    status(
      "تعذّر تثبيت الكاش",
      "#ff7b8c",
      "warning",
      100,
      "امسح بيانات الموقع ثم اضغط إعادة المحاولة؛ إعادة تشغيل الجهاز غير مطلوبة."
    );
    setSafeRetry(true, "إعادة تثبيت الكاش");
  }

  function initUI() {
    var firmware = getNode("firmware-badge");
    var goldhen = getNode("goldhen-badge");
    var button = getNode("safe-retry-button");
    var message = getNode("msgs");
    var match = navigator.userAgent.match(/PlayStation 4[ \/]([\d.]+)/i);

    if (firmware) firmware.innerHTML = match ? "FW " + match[1] : "FW غير مكتشف";
    if (goldhen) goldhen.innerHTML = "GOLDHEN " + GOLDHEN_VERSION;
    if (button) {
      button.onclick = function () {
        setSafeRetry(false);
        setAttempt(0, 0);
        status("جاري بدء محاولة آمنة جديدة...", "#7de3ff", "retry", 24, "برجاء الانتظار وعدم إغلاق الصفحة.");
        setTimeout(function () { global.location.reload(); }, 250);
      };
    }
    if (message) {
      syncStatus(message.innerHTML);
      if (global.MutationObserver) {
        new MutationObserver(function () {
          syncStatus(message.textContent || message.innerText || "");
        }).observe(message, { childList: true, characterData: true, subtree: true });
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initUI, false);
  } else {
    initUI();
  }

  global.GoodGameHost = {
    cacheError: cacheError,
    cacheProgress: cacheProgress,
    cacheReady: cacheReady,
    closePS4Browser: closePS4Browser,
    clearRetry: clearRetry,
    loadBinary: loadBinary,
    safeReload: safeReload,
    setAttempt: setAttempt,
    setSafeRetry: setSafeRetry,
    setState: setState,
    scheduleAutoExit: scheduleAutoExit,
    status: status,
    syncStatus: syncStatus
  };
})(window);
