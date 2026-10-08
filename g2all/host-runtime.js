(function (global) {
  "use strict";

  var PREFIX = "good-game-safe-retry:";

  function status(message, color) {
    var node = document.getElementById("msgs");
    if (!node) return;
    node.innerHTML = message;
    if (color) node.style.color = color;
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
        "Safe retry stopped. Close and reopen the browser — console restart is not required.",
        "#ffd45a"
      );
      return false;
    }

    try {
      sessionStorage.setItem(PREFIX + scope, String(count + 1));
    } catch (error) {
      status("Retry the page — console restart is not required.", "#ffd45a");
      return false;
    }

    status(
      "Safe retry " + (count + 1) + "/" + limit + "... Please wait",
      "#67d8ff"
    );

    setTimeout(function () {
      try {
        location.reload();
      } catch (error) {
        status("Retry the page — console restart is not required.", "#ffd45a");
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
            status(
              "GoldHEN payload retry " + (attempt + 1) + "/" + attempts + "...",
              "#67d8ff"
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

  global.GoodGameHost = {
    clearRetry: clearRetry,
    loadBinary: loadBinary,
    safeReload: safeReload,
    status: status,
  };
})(window);
