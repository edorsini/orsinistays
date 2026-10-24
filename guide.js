(function () {
  const thumbnails = Array.from(document.querySelectorAll(".flyer-thumbnail"));
  const dialog = document.getElementById("flyer-lightbox");

  if (!dialog || !thumbnails.length) return;

  const image = dialog.querySelector(".flyer-lightbox-image");
  const closeButton = dialog.querySelector(".flyer-lightbox-close");

  thumbnails.forEach((thumbnail) => {
    thumbnail.addEventListener("click", (event) => {
      event.preventDefault();
      image.src = thumbnail.href;
      image.alt = thumbnail.querySelector("img").alt;
      dialog.showModal();
    });
  });

  closeButton.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
})();
