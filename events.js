// Renders the Events section from events.json.
//
// A simple one-time event:
// {
//   "date": "2026-11-08",            // required, YYYY-MM-DD — the event's date
//   "time": "9:00 AM – 3:00 PM",     // optional
//   "title": "Day of Recollection",  // required
//   "location": "Dominican Center, Grand Rapids", // optional
//   "host": "Contemplative Outreach",             // optional
//   "description": "A short description.",        // optional
//   "url": "https://example.org/event",            // optional
//   "cost": "Free"                                 // optional — "Free" or e.g. "$10"
// }
//
// A recurring event: set "date" to the FIRST occurrence, then add "repeat".
// The weekday (and, for monthly events, which week of the month) is figured
// out automatically from that first date — nothing else to set by hand.
//
// Weekly, e.g. every Monday evening through the end of May 2027:
//   "date": "2026-11-02",   // a Monday — this fixes the weekday as Monday
//   "repeat": { "frequency": "weekly", "until": "2027-05-31" }
//
// Monthly on the same week+weekday, e.g. "first Monday of the month":
//   "date": "2026-11-02",   // the FIRST Monday of Nov 2026 — fixes "1st Monday"
//   "repeat": { "frequency": "monthly", "until": "2027-06-30" }
//
// Optional "interval" (default 1) skips weeks/months, e.g. every other week:
//   "repeat": { "frequency": "weekly", "interval": 2, "until": "2027-05-31" }
//
// "until" is required for "repeat" to take effect — a recurring event needs
// a scheduled end date. Only the next upcoming occurrence of a series is
// shown as a card (with a note like "Every Monday · through May 31, 2027"),
// so the list doesn't fill up with every single week. Once the "until" date
// passes, the series simply stops appearing.
//
// Past events (and series whose "until" has passed) are hidden automatically.
// No build step needed — just edit events.json and commit.

(function () {
  var container = document.getElementById('events-list');
  if (!container) return;

  var ORDINALS = ['First', 'Second', 'Third', 'Fourth', 'Fifth'];

  function parseLocalDate(dateStr) {
    var parts = dateStr.split('-').map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function addDays(date, days) {
    return new Date(date.getTime() + days * 86400000);
  }

  // Which occurrence-of-the-month a date is (1st, 2nd, 3rd... weekday).
  function weekOfMonth(date) {
    return Math.ceil(date.getDate() / 7);
  }

  // The nth given weekday of a given month, or null if that month doesn't
  // have one (e.g. a "5th Monday" in a month with only four).
  function nthWeekdayOfMonth(year, month, weekday, nth) {
    var firstOfMonth = new Date(year, month, 1);
    var offset = (weekday - firstOfMonth.getDay() + 7) % 7;
    var day = 1 + offset + (nth - 1) * 7;
    var candidate = new Date(year, month, day);
    return candidate.getMonth() === month ? candidate : null;
  }

  function nextWeeklyOccurrence(start, until, interval, today) {
    var periodMs = 7 * interval * 86400000;
    var cur = start;
    for (var i = 0; i < 2000; i++) {
      if (cur > until) return null;
      if (cur >= today) return cur;
      cur = new Date(cur.getTime() + periodMs);
    }
    return null;
  }

  function nextMonthlyOccurrence(start, until, interval, today) {
    var weekday = start.getDay();
    var nth = weekOfMonth(start);
    var year = start.getFullYear();
    var month = start.getMonth();
    for (var i = 0; i < 600; i++) {
      if (new Date(year, month, 1) > until) return null;
      var candidate = nthWeekdayOfMonth(year, month, weekday, nth);
      if (candidate && candidate >= start && candidate <= until && candidate >= today) {
        return candidate;
      }
      month += interval;
      while (month > 11) { month -= 12; year++; }
    }
    return null;
  }

  // Returns the next occurrence (a Date) of an event that should be shown
  // today, or null if there isn't one (one-time event already past, or a
  // series that hasn't started yet is fine — series that has ended isn't).
  function nextOccurrence(raw, today) {
    var start = parseLocalDate(raw.date);

    if (!raw.repeat) {
      return start >= today ? start : null;
    }

    var until = raw.repeat.until ? parseLocalDate(raw.repeat.until) : null;
    if (!until) {
      console.warn('CWM events: "' + raw.title + '" has a repeat but no repeat.until — treating as one-time.');
      return start >= today ? start : null;
    }

    var interval = raw.repeat.interval || 1;

    if (raw.repeat.frequency === 'weekly') {
      return nextWeeklyOccurrence(start, until, interval, today);
    }
    if (raw.repeat.frequency === 'monthly') {
      return nextMonthlyOccurrence(start, until, interval, today);
    }

    console.warn('CWM events: "' + raw.title + '" has an unrecognized repeat.frequency "' + raw.repeat.frequency + '".');
    return start >= today ? start : null;
  }

  function recurrenceLabel(raw, start) {
    if (!raw.repeat || !raw.repeat.until) return null;
    var until = parseLocalDate(raw.repeat.until);
    var untilStr = until.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    var interval = raw.repeat.interval || 1;
    var weekdayName = start.toLocaleDateString('en-US', { weekday: 'long' });
    var text;

    if (raw.repeat.frequency === 'weekly') {
      if (interval === 1) text = 'Every ' + weekdayName;
      else if (interval === 2) text = 'Every other ' + weekdayName;
      else text = 'Every ' + interval + ' weeks, on ' + weekdayName + 's';
    } else if (raw.repeat.frequency === 'monthly') {
      var nth = ORDINALS[weekOfMonth(start) - 1] || (weekOfMonth(start) + 'th');
      text = nth + ' ' + weekdayName + ' of the month';
      if (interval > 1) text += ' (every ' + interval + ' months)';
    } else {
      return null;
    }

    return text + ' · through ' + untilStr;
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
          var occurrence = nextOccurrence(e, today);
          return occurrence ? { raw: e, occurrence: occurrence } : null;
        })
        .filter(Boolean)
        .sort(function (a, b) { return a.occurrence - b.occurrence; });

      if (upcoming.length === 0) {
        showFallback();
        return;
      }

      container.innerHTML = '';

      upcoming.forEach(function (entry) {
        var raw = entry.raw;
        var occurrence = entry.occurrence;
        var month = occurrence.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
        var day = occurrence.getDate();
        var full = occurrence.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

        var card = document.createElement('article');
        card.className = 'event-card';

        var dateBox = document.createElement('div');
        dateBox.className = 'event-date';
        var monthEl = document.createElement('span');
        monthEl.className = 'event-date-month';
        monthEl.textContent = month;
        var dayEl = document.createElement('span');
        dayEl.className = 'event-date-day';
        dayEl.textContent = day;
        dateBox.appendChild(monthEl);
        dateBox.appendChild(dayEl);

        var info = document.createElement('div');
        info.className = 'event-info';

        var titleRow = document.createElement('div');
        titleRow.className = 'event-title-row';
        var h3 = document.createElement('h3');
        h3.textContent = raw.title;
        titleRow.appendChild(h3);
        if (raw.cost) {
          var cost = document.createElement('span');
          cost.className = 'event-cost' + (raw.cost.trim().toLowerCase() === 'free' ? ' event-cost-free' : ' event-cost-paid');
          cost.textContent = raw.cost;
          titleRow.appendChild(cost);
        }
        info.appendChild(titleRow);

        var metaParts = [full];
        if (raw.time) metaParts.push(raw.time);
        if (raw.location) metaParts.push(raw.location);
        var meta = document.createElement('p');
        meta.className = 'event-meta';
        meta.textContent = metaParts.join(' · ');
        info.appendChild(meta);

        var recurrence = recurrenceLabel(raw, occurrence);
        if (recurrence) {
          var rec = document.createElement('p');
          rec.className = 'event-recurrence';
          rec.textContent = recurrence;
          info.appendChild(rec);
        }

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
