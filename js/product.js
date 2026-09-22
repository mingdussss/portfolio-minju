(() => {
  const closeButton = document.querySelector("[data-product-close]");

  if (!closeButton) return;

  closeButton.addEventListener("click", (event) => {
    const previousPage = document.referrer;
    const cameFromThisSite = previousPage && new URL(previousPage).origin === window.location.origin;

    if (cameFromThisSite && window.history.length > 1) {
      event.preventDefault();
      window.history.back();
    }
  });
})();
