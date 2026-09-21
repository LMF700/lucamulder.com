let activeSidepage = null;

document.addEventListener("click", (event) => {
    const opener = event.target.closest("[data-sidepage]");
    const closer = event.target.closest("[data-sidepage-close]");

    if (opener) {
        event.preventDefault();

        const target = document.querySelector(
            opener.dataset.sidepage
        );

        if (!target) return;

        target.classList.add("is-open");
        target.setAttribute("aria-hidden", "false");
        activeSidepage = target;
    }

    if (closer && activeSidepage) {
        activeSidepage.classList.remove("is-open");
        activeSidepage.setAttribute("aria-hidden", "true");
        activeSidepage = null;
    }
});

document.addEventListener("click", async (event) => {
    const copyButton = event.target.closest("[data-copy-target]");

    if (!copyButton) return;

    const source = document.getElementById(
        copyButton.dataset.copyTarget
    );

    if (!source) return;

    try {
        await navigator.clipboard.writeText(source.value.trim());

        const originalText = copyButton.textContent;
        copyButton.textContent = "Copied!";

        setTimeout(() => {
            copyButton.textContent = originalText;
        }, 1200);
    } catch {
        copyButton.textContent = "Copy failed";
    }
});