(() => {
  const propertiesByHost = {
    "puntacanadreamcatcher.com": "dreamcatcher",
    "www.puntacanadreamcatcher.com": "dreamcatcher",
    "capcanahappyplace.com": "happy-place",
    "www.capcanahappyplace.com": "happy-place",
  };

  function currentProperty() {
    return document.body?.dataset.property || "home";
  }

  function track(eventName, parameters = {}) {
    if (typeof window.gtag !== "function") return;
    window.gtag("event", eventName, parameters);
  }

  function placementFor(element) {
    if (element.dataset.analyticsPlacement) {
      return element.dataset.analyticsPlacement;
    }
    if (element.closest(".booking-panel")) return "booking_panel";
    if (element.closest(".availability-copy")) return "availability";
    if (element.closest(".photo-mosaic")) return "photo_mosaic";
    if (element.closest(".gallery-grid")) return "photo_gallery";
    if (element.closest(".site-nav")) return "navigation";
    if (element.closest(".site-footer")) return "footer";
    if (element.closest(".media")) return "property_card_image";
    return "other";
  }

  function propertyForListing(link) {
    try {
      return propertiesByHost[new URL(link.href, window.location.href).hostname];
    } catch {
      return null;
    }
  }

  function instagramTypeFor(link) {
    try {
      const hostname = new URL(link.href, window.location.href).hostname;
      if (hostname === "instagram.com" || hostname === "www.instagram.com") {
        return link.dataset.instagramType || "profile";
      }
    } catch {
      return null;
    }

    return null;
  }

  window.orsiniAnalytics = { track };

  document.addEventListener("DOMContentLoaded", () => {
    const property = currentProperty();

    if (property !== "home") {
      track("view_property", { property_name: property });
    }

    document.addEventListener("click", (event) => {
      const link = event.target.closest("a");
      if (link) {
        const instagramType = instagramTypeFor(link);
        if (instagramType) {
          const parameters = {
            property_name: currentProperty(),
            placement: placementFor(link),
          };

          if (instagramType === "reel" && link.dataset.reelId) {
            parameters.reel_id = link.dataset.reelId;
          }

          track(
            instagramType === "reel" ? "view_instagram_reel" : "follow_instagram",
            parameters,
          );
          return;
        }

        const listingProperty = propertyForListing(link);
        if (listingProperty) {
          track("begin_booking", {
            property_name: listingProperty,
            placement: placementFor(link),
          });
          return;
        }

        if (link.href.startsWith("mailto:")) {
          track("contact_email", {
            property_name: currentProperty(),
            placement: placementFor(link),
          });
          return;
        }
      }

      const galleryTrigger = event.target.closest(".photo-button");
      if (galleryTrigger) {
        track("view_gallery", {
          property_name: currentProperty(),
          placement: placementFor(galleryTrigger),
        });
      }
    });
  });
})();
