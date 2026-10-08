function load_script(src, remote = true, transfer = []) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

var kernelState = "pristine";

async function loadHostBinary(path, expectedBytes) {
  if (window.GoodGameHost) {
    return GoodGameHost.loadBinary(path, {
      attempts: 5,
      timeout: 12000,
      expectedBytes: expectedBytes || 0,
      retryDelay: 400,
    });
  }
  const response = await fetch(path);
  if (!response.ok) throw new Error("HTTP " + response.status + " for " + path);
  return response.arrayBuffer();
}

async function doJb() {
  await load_script("css/misc.js");

  try {
    version.init();
    switch (version.console) {
      case 4:
        await load_script("css/ps4/constants.js");
        await load_script("css/ps4/userland.js");
        break;
      case 5:
        //TODO
        break;
      default:
        logger.info("Unsupported console " + version.console);
    }

    logger.info("===USERLAND===");

    let rw = undefined;
    if (arw.master === undefined) {
      rw = await init_rw();
    }

    init_arw(rw);
    init_rop();
    init_syscalls();

    logger.info("===END===");

    await load_script("css/loader.js");
    await load_script("css/workers.js");

    switch (version.console) {
      case 4:
        await load_script("css/ps4/kernel.js");
        break;
      case 5:
        //TODO
        break;
      default:
        logger.info("Unsupported console " + version.console);
    }

    if (fn.setuid.invoke(0) !== -1) {
      msgs.innerHTML = "GoldHEN is Already Loaded ...";
      return;
    }

    var exploitChain = localStorage.getItem("exploitChain") || "lapse";
    await load_script("css/" + exploitChain + ".js");
    logger.info("===" + exploitChain.toUpperCase() + "===");

    try {
      if (exploitChain == "lapse") {
        init();
        await setup();
        kernelState = "mutating";
        await double_free_reqs2();
        leak_kaddrs();
        double_free_reqs1();
        make_karw();
        inc_karw_pipe_refcnt();

        logger.info("Corrupted context cleanup started...");
        remove_pktinfo_from_so(pktopts_twins[0]);
        remove_rthdr_from_so(pktopts_twins[1]);
        remove_rthdr_from_so(rthdr_twins[0]);
        logger.info("Corrupted context cleanup completed !!");
      } else {
        init();
        await setup();
        kernelState = "mutating";
        await ucred_triple_free();
        leak_kqueue();
        await make_karw();
        inc_karw_pipe_refcnt();

        logger.info("Corrupted context cleanup started...");
        for (let i = 0; i < triplets.length; i++) {
          remove_rthdr_from_so(triplets[i]);
        }
        remove_uaf_file();
        logger.info("Corrupted context cleanup completed !!");
      }
    } finally {
      cleanup();
    }

    find_all_proc();

    if (fn.setuid.invoke(0) === -1) {
      jailbreak();

      const kpatches_buf = await loadHostBinary(
        "css/ps4/patches/" + constants.KPATCH,
        0,
      );
      const kpatches_u8 = new Uint8Array(kpatches_buf);
      kernel_patches(kpatches_u8);
      kernelState = "patched";

      const bin_buf = await loadHostBinary("goldhen_2.4b18.12.bin", 293120);
      const bin_u8 = new Uint8Array(bin_buf);
      load_bin(bin_u8);
    }

    if (window.GoodGameHost) GoodGameHost.clearRetry("fw10-kernel-prep");
    msgs.innerHTML = "GoldHEN v2.4b18.12 Loaded ...";
    logger.info("===END===");
  } catch (e) {
    logger.info("GoldHEN host failure in " + kernelState + ": " + e);
    if (
      kernelState === "pristine" &&
      window.GoodGameHost &&
      GoodGameHost.safeReload("fw10-kernel-prep", "kernel-prep", 2, 1200)
    ) {
      return;
    }
    if (kernelState === "patched") {
      msgs.innerHTML = "GoldHEN file could not be loaded. Reopen the browser — console restart is not required.";
    } else if (kernelState === "pristine") {
      msgs.innerHTML = "Safe retry stopped. Close and reopen the browser — no console restart.";
    } else {
      msgs.innerHTML = "Kernel stage was interrupted. Restart the console before trying again.";
    }
    msgs.style.color = "#ffd45a";
  }
}
