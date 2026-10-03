(() => {
  "use strict";

  const CACHE_PARAM = "_cb";
  const params = new URLSearchParams(window.location.search);
  const cacheBust = params.get(CACHE_PARAM) || "";

  const bustUrl = value => {
    if (!cacheBust || !value) return value;
    try {
      const url = new URL(value, window.location.href);
      if (url.origin !== window.location.origin) return value;
      url.searchParams.set(CACHE_PARAM, cacheBust);
      return url.href;
    } catch {
      return value;
    }
  };

  const applyCacheBust = () => {
    if (!cacheBust) return;

    document.querySelectorAll('link[rel="stylesheet"][href], link[rel~="icon"][href], link[rel="apple-touch-icon"][href]').forEach(link => {
      const href = link.getAttribute("href");
      const busted = bustUrl(href);
      if (busted && busted !== href) link.href = busted;
    });

    document.querySelectorAll("img[src]").forEach(img => {
      const src = img.getAttribute("src");
      const busted = bustUrl(src);
      if (busted && busted !== src) img.src = busted;
    });

    document.querySelectorAll("source[srcset]").forEach(source => {
      const srcset = source.getAttribute("srcset");
      if (!srcset) return;
      source.setAttribute(
        "srcset",
        srcset.split(",").map(candidate => {
          const parts = candidate.trim().split(/\s+/);
          return [bustUrl(parts[0]), ...parts.slice(1)].join(" ");
        }).join(", ")
      );
    });

    document.documentElement.style.setProperty(
      "--bsw-web-bg",
      `url("${bustUrl("./stag-studio/web-bg.png")}")`
    );
    document.documentElement.style.setProperty(
      "--bsw-mobile-bg",
      `url("${bustUrl("./stag-studio/mobile-bg.png")}")`
    );

    window.setTimeout(() => {
      const clean = new URL(window.location.href);
      clean.searchParams.delete(CACHE_PARAM);
      window.history.replaceState({}, document.title, clean.pathname + clean.search + clean.hash);
    }, 120);
  };

  const initPullToRefresh = () => {
    if (!window.matchMedia("(pointer: coarse)").matches) return;

    const scroller = document.querySelector("#page");
    if (!scroller) return;

    const indicator = document.createElement("div");
    indicator.className = "bsw-ptr";
    indicator.setAttribute("aria-hidden", "true");
    indicator.innerHTML = '<span class="bsw-ptr-mark">↻</span><span class="bsw-ptr-label">Pull to refresh</span>';
    document.body.appendChild(indicator);

    const label = indicator.querySelector(".bsw-ptr-label");
    const threshold = 82;
    const maxPull = 126;
    let startX = 0;
    let startY = 0;
    let pullDistance = 0;
    let tracking = false;
    let verticalPull = false;
    let refreshing = false;

    const reset = () => {
      tracking = false;
      verticalPull = false;
      pullDistance = 0;
      indicator.classList.remove("is-pulling", "is-ready");
      indicator.style.transform = "translate3d(-50%, -64px, 0)";
      indicator.style.setProperty("--bsw-ptr-rotation", "0deg");
      if (label) label.textContent = "Pull to refresh";
    };

    scroller.addEventListener("touchstart", event => {
      if (refreshing || event.touches.length !== 1 || scroller.scrollTop > 1) return;
      const touch = event.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      tracking = true;
      verticalPull = false;
      pullDistance = 0;
    }, { passive: true });

    scroller.addEventListener("touchmove", event => {
      if (!tracking || refreshing || event.touches.length !== 1) return;

      const touch = event.touches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;

      if (!verticalPull) {
        if (dy <= 0) {
          reset();
          return;
        }
        if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
          if (dy < Math.abs(dx) * 1.2) {
            reset();
            return;
          }
          verticalPull = true;
        } else {
          return;
        }
      }

      if (scroller.scrollTop > 1 || dy <= 0) {
        reset();
        return;
      }

      event.preventDefault();

      pullDistance = Math.min(maxPull, dy * 0.58);
      const progress = Math.min(1, pullDistance / threshold);
      const y = -64 + pullDistance * 0.86;

      indicator.classList.add("is-pulling");
      indicator.classList.toggle("is-ready", pullDistance >= threshold);
      indicator.style.transform = `translate3d(-50%, ${y}px, 0)`;
      indicator.style.setProperty("--bsw-ptr-rotation", `${Math.round(progress * 250)}deg`);

      if (label) {
        label.textContent = pullDistance >= threshold ? "Release to refresh" : "Pull to refresh";
      }
    }, { passive: false });

    const finishPull = () => {
      if (!tracking || refreshing) return;

      if (verticalPull && pullDistance >= threshold) {
        refreshing = true;
        tracking = false;
        indicator.classList.remove("is-pulling", "is-ready");
        indicator.classList.add("is-refreshing");
        if (label) label.textContent = "Refreshing";

        window.setTimeout(() => {
          const url = new URL(window.location.href);
          url.searchParams.set(CACHE_PARAM, Date.now().toString(36));
          window.location.replace(url.toString());
        }, 240);
        return;
      }

      reset();
    };

    scroller.addEventListener("touchend", finishPull, { passive: true });
    scroller.addEventListener("touchcancel", reset, { passive: true });
  };

  applyCacheBust();
  initPullToRefresh();
})();
