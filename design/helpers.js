// Chart helpers for the .dc.html mock-ups. Pure functions returning SVG path strings.
window.BRONZE_CHART = (function () {
  function scale(d0, d1, r0, r1) { return function (v) { return r0 + (v - d0) / (d1 - d0) * (r1 - r0); }; }
  function fmt(n) { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " "); }
  function dec(n, k) { return n.toFixed(k === undefined ? 2 : k).replace(".", ","); }
  function line(values, x0, x1, yTop, yBottom, yMin, yMax) {
    var sx = scale(0, values.length - 1, x0, x1), sy = scale(yMin, yMax, yBottom, yTop);
    return values.map(function (v, i) { return (i ? "L" : "M") + sx(i).toFixed(1) + " " + sy(v).toFixed(1); }).join("");
  }
  function area(values, x0, x1, yTop, yBottom, yMin, yMax) {
    return line(values, x0, x1, yTop, yBottom, yMin, yMax) + "L" + x1 + " " + yBottom + "L" + x0 + " " + yBottom + "Z";
  }
  // Band between two series (lower[i] <= upper[i]) on a shared value scale.
  function band(lower, upper, x0, x1, yTop, yBottom, yMin, yMax) {
    var sx = scale(0, upper.length - 1, x0, x1), sy = scale(yMin, yMax, yBottom, yTop), d = "";
    upper.forEach(function (v, i) { d += (i ? "L" : "M") + sx(i).toFixed(1) + " " + sy(v).toFixed(1); });
    for (var i = lower.length - 1; i >= 0; i--) { d += "L" + sx(i).toFixed(1) + " " + sy(lower[i]).toFixed(1); }
    return d + "Z";
  }
  // Stacked bands: series = [{key, values}], returns [{key, d}] bottom-up, negatives clamped to 0.
  function stack(series, x0, x1, yTop, yBottom, yMax) {
    var n = series[0].values.length, base = [], out = [];
    for (var i = 0; i < n; i++) base.push(0);
    series.forEach(function (s) {
      var top = s.values.map(function (v, i) { return base[i] + Math.max(0, v); });
      out.push({ key: s.key, d: band(base, top, x0, x1, yTop, yBottom, 0, yMax) });
      base = top;
    });
    return out;
  }
  function curve(points, pMin, pMax, x0, x1, yTop, yBottom) {
    var sx = scale(pMin, pMax, x0, x1), sy = scale(0, 1, yBottom, yTop);
    return points.map(function (p, i) { return (i ? "L" : "M") + sx(p[0]).toFixed(1) + " " + sy(p[1]).toFixed(1); }).join("");
  }
  // Step curve (horizontal then vertical) for ladders.
  function steps(points, pMin, pMax, x0, x1, yTop, yBottom) {
    var sx = scale(pMin, pMax, x0, x1), sy = scale(0, 1, yBottom, yTop), d = "";
    points.forEach(function (p, i) {
      var x = sx(p[0]).toFixed(1), y = sy(p[1]).toFixed(1);
      d += i ? "H" + x + "V" + y : "M" + x + " " + y;
    });
    return d;
  }
  // Price at which a decreasing survival curve crosses q.
  function quantile(points, q) {
    for (var i = 1; i < points.length; i++) {
      var a = points[i - 1], b = points[i];
      if (a[1] >= q && b[1] <= q) { return a[0] + (a[1] - q) / (a[1] - b[1]) * (b[0] - a[0]); }
    }
    return NaN;
  }
  function x(v, d0, d1, r0, r1) { return scale(d0, d1, r0, r1)(v); }
  return { scale: scale, fmt: fmt, dec: dec, line: line, area: area, band: band, stack: stack, curve: curve, steps: steps, quantile: quantile, x: x };
})();
