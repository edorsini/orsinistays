(function () {
  const galleryItems = Array.from(
    document.querySelectorAll(".gallery-grid [data-gallery-index]"),
  );
  const galleryTriggers = Array.from(
    document.querySelectorAll("[data-gallery-index]"),
  );
  const dialog = document.getElementById("photo-lightbox");

  if (dialog && galleryItems.length) {
    const image = dialog.querySelector(".lightbox-image");
    const caption = dialog.querySelector(".lightbox-caption-text");
    const count = dialog.querySelector(".lightbox-count");
    let currentIndex = 0;

    function renderPhoto(index) {
      currentIndex = (index + galleryItems.length) % galleryItems.length;
      const item = galleryItems[currentIndex];
      const itemImage = item.querySelector("img");
      image.src = item.dataset.full || itemImage.src;
      image.alt = itemImage.alt;
      caption.textContent = item.dataset.caption || itemImage.alt;
      count.textContent = `${currentIndex + 1} of ${galleryItems.length}`;
    }

    galleryTriggers.forEach((trigger) => {
      trigger.addEventListener("click", () => {
        renderPhoto(Number(trigger.dataset.galleryIndex));
        dialog.showModal();
      });
    });

    dialog.querySelector(".lightbox-close").addEventListener("click", () => {
      dialog.close();
    });
    dialog.querySelector(".lightbox-prev").addEventListener("click", () => {
      renderPhoto(currentIndex - 1);
    });
    dialog.querySelector(".lightbox-next").addEventListener("click", () => {
      renderPhoto(currentIndex + 1);
    });
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") renderPhoto(currentIndex - 1);
      if (event.key === "ArrowRight") renderPhoto(currentIndex + 1);
    });
  }

  const widgets = Array.from(document.querySelectorAll(".availability"));
  if (!widgets.length) return;

  const now = new Date();
  const firstMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() + 12, 1);
  const todayKey = dateKey(now.getFullYear(), now.getMonth(), now.getDate());
  const monthFormatter = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  });
  const dayFormatter = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  function dateKey(year, monthIndex, day) {
    return [
      String(year).padStart(4, "0"),
      String(monthIndex + 1).padStart(2, "0"),
      String(day).padStart(2, "0"),
    ].join("-");
  }

  function monthNumber(date) {
    return date.getFullYear() * 12 + date.getMonth();
  }

  function isUnavailable(key, ranges) {
    return ranges.some((range) => key >= range.start && key < range.end);
  }

  function updateNavigation(widget) {
    const state = widget.calendarState;
    const label = widget.querySelector(".calendar-month");
    const previous = widget.querySelector('[data-calendar-action="previous"]');
    const next = widget.querySelector('[data-calendar-action="next"]');

    label.textContent = monthFormatter.format(state.month);
    previous.disabled =
      !state.ranges || monthNumber(state.month) <= monthNumber(firstMonth);
    next.disabled =
      !state.ranges || monthNumber(state.month) >= monthNumber(lastMonth);
  }

  function renderCalendar(widget) {
    const state = widget.calendarState;
    const calendar = widget.querySelector(".availability-calendar");
    const year = state.month.getFullYear();
    const month = state.month.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOffset = new Date(year, month, 1).getDay();

    updateNavigation(widget);
    calendar.innerHTML = "";

    const table = document.createElement("table");
    table.className = "availability-grid";
    const tableCaption = document.createElement("caption");
    tableCaption.className = "sr-only";
    tableCaption.textContent = `${monthFormatter.format(state.month)} availability`;
    table.appendChild(tableCaption);

    const head = document.createElement("thead");
    const headRow = document.createElement("tr");
    weekdays.forEach((weekday) => {
      const heading = document.createElement("th");
      heading.scope = "col";
      heading.textContent = weekday;
      headRow.appendChild(heading);
    });
    head.appendChild(headRow);
    table.appendChild(head);

    const body = document.createElement("tbody");
    for (let week = 0; week < 6; week += 1) {
      const row = document.createElement("tr");
      for (let weekday = 0; weekday < 7; weekday += 1) {
        const cell = document.createElement("td");
        const day = week * 7 + weekday - firstDayOffset + 1;

        if (day >= 1 && day <= daysInMonth) {
          const key = dateKey(year, month, day);
          const date = new Date(year, month, day);
          const dayElement = document.createElement("time");
          let status;

          dayElement.className = "calendar-day";
          dayElement.dateTime = key;
          dayElement.textContent = String(day);
          if (key < todayKey) status = "past";
          else if (isUnavailable(key, state.ranges)) status = "unavailable";
          else status = "available";

          dayElement.classList.add(status);
          if (key === todayKey) dayElement.classList.add("today");
          dayElement.setAttribute(
            "aria-label",
            `${dayFormatter.format(date)}, ${status}`,
          );
          dayElement.title = `${dayFormatter.format(date)} — ${status}`;
          cell.appendChild(dayElement);
        }
        row.appendChild(cell);
      }
      body.appendChild(row);
    }
    table.appendChild(body);
    calendar.appendChild(table);
  }

  function normalizeRanges(value) {
    if (!Array.isArray(value)) return null;
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    const ranges = value.filter(
      (range) =>
        range &&
        datePattern.test(range.start) &&
        datePattern.test(range.end) &&
        range.start < range.end,
    );
    return ranges.length === value.length ? ranges : null;
  }

  widgets.forEach((widget) => {
    widget.calendarState = {
      month: new Date(firstMonth),
      ranges: null,
    };
    updateNavigation(widget);
    widget.addEventListener("click", (event) => {
      const button = event.target.closest("[data-calendar-action]");
      if (!button || button.disabled) return;
      const offset = button.dataset.calendarAction === "next" ? 1 : -1;
      const current = widget.calendarState.month;
      widget.calendarState.month = new Date(
        current.getFullYear(),
        current.getMonth() + offset,
        1,
      );
      renderCalendar(widget);
    });
  });

  const productionHosts = new Set(["orsinistays.com", "www.orsinistays.com"]);
  const availabilityUrl = productionHosts.has(window.location.hostname)
    ? "https://raw.githubusercontent.com/edorsini/orsinistays/main/availability.json"
    : "../availability.json";

  function applyAvailability(data) {
    widgets.forEach((widget) => {
      const property = data?.properties?.[widget.dataset.property];
      const ranges = normalizeRanges(property?.unavailable);
      if (!ranges) throw new Error("Availability data is invalid");
      widget.calendarState.ranges = ranges;
      renderCalendar(widget);
    });
  }

  function showAvailabilityError() {
    widgets.forEach((widget) => {
      widget.querySelector(".availability-calendar").innerHTML =
        '<p class="calendar-status">Availability is temporarily unavailable. Please email us to confirm your dates.</p>';
      updateNavigation(widget);
    });
  }

  if (window.location.protocol === "file:") {
    try {
      applyAvailability(window.ORSINI_AVAILABILITY);
    } catch {
      showAvailabilityError();
    }
  } else {
    fetch(availabilityUrl, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("Availability request failed");
        return response.json();
      })
      .then(applyAvailability)
      .catch(showAvailabilityError);
  }
})();
