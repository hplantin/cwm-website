// Renders the Events section from events.json.
// To add an event, add an object to the array in events.json, e.g.:
// {
//   "date": "2026-11-08",            // required, YYYY-MM-DD
//   "time": "9:00 AM – 3:00 PM",     // optional
//   "title": "Day of Recollection",  // required
//   "location": "Dominican Center, Grand Rapids", // optional
//   "host": "Contemplative Outreach",             // optional
//   "description": "A short description.",        // optional
//   "url": "https://example.org/event"             // optional
// }
// Past events are hidden automatically. No build step needed —
// just edit events.json and commit.

(function () {
  var container = document.getElementById('events-list');
  if (!container) return;

  function formatDate(dateStr) {
    var parts = dateStr.split('-').map(Number);
    var date = new Date(parts[0], parts[1] - 1, parts[2]);
    return {
      date: date,
      month: date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
      day: date.getDate(),
      full: date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    };
  }

  function showFallback() {
    container.innerHTML =
      '<div class="events-placeholder">' +
      '<p>Events will be listed here as they are announced.<br>Sign up below to receive them by email.</p>' +
      '</div>';
  }

  fetch('events.json', { cache: 'no-store' })
    .then(function (res) {
      if (!res.ok) throw new Error('could not load events.json');
      return res.json();
    })
    .then(function (events) {
      if (!Array.isArray(events)) throw new Error('events.json is not an array');

      var today = new Date();
      today.setHours(0, 0, 0, 0);

      var upcoming = events
        .filter(function (e) { return e && e.date && e.title; })
        .map(function (e) {
          var d = formatDate(e.date);
          return {
            raw: e,
            date: d.date,
            month: d.month,
            day: d.day,
            full: d.full
          };
        })
        .filter(function (e) { return e.date >= today; })
        .sort(function (a, b) { return a.date - b.date; });

      if (upcoming.length === 0) {
        showFallback();
        return;
      }

      container.innerHTML = '';

      upcoming.forEach(function (e) {
        var raw = e.raw;

        var card = document.createElement('article');
        card.className = 'event-card';

        var dateBox = document.createElement('div');
        dateBox.className = 'event-date';
        var month = document.createElement('span');
        month.className = 'event-date-month';
        month.textContent = e.month;
        var day = document.createElement('span');
        day.className = 'event-date-day';
        day.textContent = e.day;
        dateBox.appendChild(month);
        dateBox.appendChild(day);

        var info = document.createElement('div');
        info.className = 'event-info';

        var h3 = document.createElement('h3');
        h3.textContent = raw.title;
        info.appendChild(h3);

        var metaParts = [e.full];
        if (raw.time) metaParts.push(raw.time);
        if (raw.location) metaParts.push(raw.location);
        var meta = document.createElement('p');
        meta.className = 'event-meta';
        meta.textContent = metaParts.join(' · ');
        info.appendChild(meta);

        if (raw.host) {
          var host = document.createElement('p');
          host.className = 'event-host';
          host.textContent = 'Hosted by ' + raw.host;
          info.appendChild(host);
        }

        if (raw.description) {
          var desc = document.createElement('p');
          desc.className = 'event-desc';
          desc.textContent = raw.description;
          info.appendChild(desc);
        }

        if (raw.url) {
          var link = document.createElement('a');
          link.className = 'event-link';
          link.href = raw.url;
          link.target = '_blank';
          link.rel = 'noopener';
          link.textContent = 'Learn more →';
          info.appendChild(link);
        }

        card.appendChild(dateBox);
        card.appendChild(info);
        container.appendChild(card);
      });
    })
    .catch(function (err) {
      console.error('CWM events:', err);
      showFallback();
    });
})();
