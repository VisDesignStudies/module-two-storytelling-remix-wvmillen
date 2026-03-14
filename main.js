const tooltip = d3.select("#tooltip");

const state = {
  solRange: null,
  selectedOpacity: new Set(),
  hoveredSol: null,
};

const opacityPalette = new Map([
  ["Sunny", "#ba6a45"],
  ["Not reported", "#b08b38"],
  ["Unknown", "#7c8a82"],
]);

const qualityFieldDefs = [
  {
    key: "min_temp",
    label: "Min temp",
    color: "#ba6a45",
    isAvailable: (d) => d.min_temp !== null,
  },
  {
    key: "max_temp",
    label: "Max temp",
    color: "#8d5f49",
    isAvailable: (d) => d.max_temp !== null,
  },
  {
    key: "pressure",
    label: "Pressure",
    color: "#5f7768",
    isAvailable: (d) => d.pressure !== null,
  },
  {
    key: "wind_speed",
    label: "Wind speed",
    color: "#7c8a82",
    isAvailable: (d) => d.wind_speed !== null,
  },
  {
    key: "atmo_opacity",
    label: "Opacity label",
    color: "#b08b38",
    isAvailable: (d) => Boolean(d.atmo_opacity),
  },
];

const dateParsers = [
  d3.utcParse("%Y-%m-%d"),
  d3.utcParse("%m/%d/%Y"),
  d3.utcParse("%-m/%-d/%y"),
  d3.utcParse("%m/%d/%y"),
];

const formatDate = d3.utcFormat("%b %-d, %Y");
const formatWhole = d3.format(",");
const formatDecimal = d3.format(".1f");

let appData = null;
let charts = null;

d3.csv("data/mars_weather.csv", parseRow).then((rows) => {
  const data = rows
    .filter((d) => Number.isFinite(d.sol))
    .sort((a, b) => d3.ascending(a.sol, b.sol));

  const opacityCategories = Array.from(
    new Set(data.map((d) => d.atmo_opacity))
  ).sort((a, b) => d3.ascending(a, b));

  state.selectedOpacity = new Set(opacityCategories);

  appData = buildDataModel(data, opacityCategories);
  hydrateCopy(appData);
  buildQualitySummary(appData);

  charts = {
    extremes: createExtremesChart({
      container: d3.select("#chart-extremes"),
      data: appData,
    }),
    seasonWheel: createSeasonWheel({
      container: d3.select("#chart-season-wheel"),
      data: appData,
    }),
    quality: createQualityChart({
      container: d3.select("#chart-quality"),
      data: appData,
    }),
  };

  d3.select("#clear-brush").on("click", () => {
    charts.extremes.clearBrush();
  });

  const resizeObserver = new ResizeObserver(() => renderAll());
  resizeObserver.observe(document.body);

  renderAll();
});

function parseRow(d) {
  const minTemp = parseNumber(d.min_temp);
  const maxTemp = parseNumber(d.max_temp);
  const pressure = parseNumber(d.pressure);
  const windSpeed = parseNumber(d.wind_speed);
  const terrestrialDate = parseDate(d.terrestrial_date);
  const atmoOpacity = d.atmo_opacity === "--" ? "Not reported" : d.atmo_opacity;

  return {
    id: parseNumber(d.id),
    terrestrial_date: terrestrialDate,
    terrestrial_date_raw: d.terrestrial_date,
    sol: parseNumber(d.sol),
    ls: parseNumber(d.ls),
    month: d.month,
    min_temp: minTemp,
    max_temp: maxTemp,
    pressure,
    wind_speed: windSpeed,
    hasWind: windSpeed !== null,
    atmo_opacity: atmoOpacity || "Unknown",
    tempRange:
      minTemp !== null && maxTemp !== null ? maxTemp - minTemp : null,
    tempMid:
      minTemp !== null && maxTemp !== null ? (minTemp + maxTemp) / 2 : null,
    hasTemps: minTemp !== null && maxTemp !== null,
  };
}

function buildDataModel(data, opacityCategories) {
  const validTempRows = data.filter((d) => d.hasTemps);
  const pressureRows = data.filter((d) => d.pressure !== null && d.ls !== null);
  const missingWeatherRows = data.filter(
    (d) => d.tempRange === null || d.pressure === null
  );
  const meanRange = d3.mean(validTempRows, (d) => d.tempRange);
  const maxRangeRow = d3.greatest(validTempRows, (d) => d.tempRange);
  const qualityFields = qualityFieldDefs.map((field) => ({
    ...field,
    availableCount: data.filter(field.isAvailable).length,
  }));

  return {
    all: data,
    validTempRows,
    pressureRows,
    missingWeatherRows,
    opacityCategories,
    qualityFields,
    meanRange,
    maxRangeRow,
    solExtent: d3.extent(data, (d) => d.sol),
    temperatureExtent: d3.extent(
      validTempRows.flatMap((d) => [d.min_temp, d.max_temp])
    ),
    lsExtent: d3.extent(pressureRows, (d) => d.ls),
    startDate: d3.min(data, (d) => d.terrestrial_date),
    endDate: d3.max(data, (d) => d.terrestrial_date),
  };
}

function hydrateCopy(data) {
  textAll(".js-sol-count", formatWhole(data.all.length));
  textAll(".js-sol-max", formatWhole(data.solExtent[1]));
  textAll(".js-start-date", data.startDate ? formatDate(data.startDate) : "2012");
  textAll(".js-end-date", data.endDate ? formatDate(data.endDate) : "2018");
  textAll(".js-mean-range", formatDecimal(data.meanRange));
  textAll(".js-max-range", formatWhole(data.maxRangeRow?.tempRange ?? 0));
  textAll(".js-missing-weather", formatWhole(data.missingWeatherRows.length));
}

function buildQualitySummary(data) {
  const summary = d3.select("#quality-summary");
  const items = summary
    .selectAll(".summary-pill")
    .data(data.qualityFields, (d) => d.key)
    .join("div")
    .attr("class", "summary-pill");

  items.html(
    (field) => `
      <span class="legend-swatch" style="background:${field.color}"></span>
      <span>${field.label}</span>
      <span>${field.availableCount}/${data.all.length}</span>
    `
  );
}

function createExtremesChart({ container, data }) {
  const svg = container.append("svg");
  const root = svg.append("g");
  const gridLayer = root.append("g").attr("class", "grid");
  const areaLayer = root.append("g");
  const markerLayer = root.append("g");
  const tickLayer = root.append("g");
  const axisLayerX = root.append("g").attr("class", "axis");
  const axisLayerY = root.append("g").attr("class", "axis");
  const brushLayer = root.append("g").attr("class", "brush");
  const hoverLayer = root.append("g");

  const x = d3.scaleLinear().domain(data.solExtent);
  const y = d3.scaleLinear()
    .domain([data.temperatureExtent[0] - 6, data.temperatureExtent[1] + 6])
    .nice();

  const brush = d3
    .brushX()
    .on("brush end", ({ selection }) => {
      if (!selection) {
        state.solRange = null;
        renderAll();
        return;
      }

      const [start, end] = selection.map(x.invert);
      state.solRange = [Math.floor(start), Math.ceil(end)];
      renderAll();
    });

  brushLayer.call(brush);

  function render() {
    const width = Math.max(container.node().clientWidth, 320);
    const height = Math.max(container.node().clientWidth * 0.45, 360);
    const margin = { top: 32, right: 20, bottom: 58, left: 56 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    svg.attr("viewBox", `0 0 ${width} ${height}`);
    root.attr("transform", `translate(${margin.left},${margin.top})`);
    x.range([0, innerWidth]);
    y.range([innerHeight, 0]);

    const yTicks = y.ticks(6);
    const area = d3
      .area()
      .defined((d) => d.hasTemps)
      .x((d) => x(d.sol))
      .y0((d) => y(d.min_temp))
      .y1((d) => y(d.max_temp))
      .curve(d3.curveMonotoneX);

    const midline = d3
      .line()
      .defined((d) => d.hasTemps)
      .x((d) => x(d.sol))
      .y((d) => y((d.min_temp + d.max_temp) / 2))
      .curve(d3.curveMonotoneX);

    gridLayer
      .selectAll("line")
      .data(yTicks)
      .join("line")
      .attr("x1", 0)
      .attr("x2", innerWidth)
      .attr("y1", (d) => y(d))
      .attr("y2", (d) => y(d));

    areaLayer
      .selectAll(".extremes-area")
      .data([data.validTempRows])
      .join("path")
      .attr("class", "extremes-area")
      .attr("d", area);

    areaLayer
      .selectAll(".extremes-midline")
      .data([data.validTempRows])
      .join("path")
      .attr("class", "extremes-midline")
      .attr("d", midline);

    const solMarkers = markerLayer
      .selectAll(".sol-marker")
      .data(data.validTempRows, (d) => d.sol)
      .join("circle")
      .attr("class", "sol-marker")
      .attr("cx", (d) => x(d.sol))
      .attr("cy", (d) => y((d.min_temp + d.max_temp) / 2))
      .attr("r", (d) => (d.sol === state.hoveredSol ? 3.6 : 2))
      .attr("fill", (d) => colorForOpacity(d.atmo_opacity));

    solMarkers
      .classed("is-hovered", (d) => d.sol === state.hoveredSol)
      .classed("is-dimmed", (d) => !state.selectedOpacity.has(d.atmo_opacity))
      .attr("opacity", (d) => {
        if (!state.selectedOpacity.has(d.atmo_opacity)) {
          return 0.16;
        }
        if (state.solRange && !isInSolRange(d, state.solRange)) {
          return 0.32;
        }
        return 0.7;
      });

    tickLayer
      .selectAll(".opacity-tick")
      .data(data.all, (d) => d.sol)
      .join("line")
      .attr("class", "opacity-tick")
      .attr("x1", (d) => x(d.sol))
      .attr("x2", (d) => x(d.sol))
      .attr("y1", innerHeight + 10)
      .attr("y2", innerHeight + 18)
      .attr("stroke", (d) => colorForOpacity(d.atmo_opacity))
      .classed("is-dimmed", (d) => !state.selectedOpacity.has(d.atmo_opacity))
      .attr("opacity", (d) => {
        if (!state.selectedOpacity.has(d.atmo_opacity)) {
          return 0.14;
        }
        return d.atmo_opacity === "Sunny" ? 0.42 : 0.9;
      });

    axisLayerX
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x).ticks(Math.max(5, Math.round(innerWidth / 110))).tickFormat(d3.format("d")));

    axisLayerY.call(d3.axisLeft(y).ticks(6));

    axisLayerX
      .selectAll(".axis-label-x")
      .data(["Sol"])
      .join("text")
      .attr("class", "axis-label axis-label-x")
      .attr("x", innerWidth)
      .attr("y", 42)
      .attr("text-anchor", "end")
      .text((d) => d);

    axisLayerY
      .selectAll(".axis-label-y")
      .data(["Temperature (°C)"])
      .join("text")
      .attr("class", "axis-label axis-label-y")
      .attr("x", -4)
      .attr("y", -16)
      .attr("text-anchor", "start")
      .text((d) => d);

    brush.extent([
      [0, 0],
      [innerWidth, innerHeight],
    ]);
    brushLayer.call(brush);

    brushLayer
      .select(".overlay")
      .style("cursor", "crosshair")
      .on("mousemove", (event) => {
        const [mouseX] = d3.pointer(event, brushLayer.node());
        const hovered = nearestBySol(data.validTempRows, x.invert(mouseX));
        const nextHoveredSol = hovered ? hovered.sol : null;
        const changed = state.hoveredSol !== nextHoveredSol;
        state.hoveredSol = nextHoveredSol;
        showTooltip(event, buildExtremesTooltip(hovered));
        if (changed) renderAll();
      })
      .on("mouseleave", () => {
        const hadHover = state.hoveredSol !== null;
        state.hoveredSol = null;
        hideTooltip();
        if (hadHover) renderAll();
      });

    const hoveredDatum = data.validTempRows.find((d) => d.sol === state.hoveredSol);
    const hoverData = hoveredDatum ? [hoveredDatum] : [];

    hoverLayer
      .selectAll(".hover-line")
      .data(hoverData)
      .join("line")
      .attr("class", "hover-line")
      .attr("x1", (d) => x(d.sol))
      .attr("x2", (d) => x(d.sol))
      .attr("y1", 0)
      .attr("y2", innerHeight);

    hoverLayer
      .selectAll(".hover-dot-min")
      .data(hoverData)
      .join("circle")
      .attr("class", "hover-dot")
      .attr("cx", (d) => x(d.sol))
      .attr("cy", (d) => y(d.min_temp))
      .attr("r", 4);

    hoverLayer
      .selectAll(".hover-dot-max")
      .data(hoverData)
      .join("circle")
      .attr("class", "hover-dot")
      .attr("cx", (d) => x(d.sol))
      .attr("cy", (d) => y(d.max_temp))
      .attr("r", 4);

    const targetSelection = state.solRange ? state.solRange.map(x) : null;
    const currentSelection = d3.brushSelection(brushLayer.node());
    if (!sameSelection(currentSelection, targetSelection)) {
      brushLayer.call(brush.move, targetSelection);
    }
  }

  return {
    render,
    clearBrush() {
      state.solRange = null;
      brushLayer.call(brush.move, null);
      renderAll();
    },
  };
}

function createSeasonWheel({ container, data }) {
  const svg = container.append("svg");
  const root = svg.append("g");
  const gridLayer = root.append("g");
  const spokeLayer = root.append("g");
  const labelLayer = root.append("g");
  const lineLayer = root.append("g");
  const hitLayer = root.append("g");
  const centerLayer = root.append("g");

  const bins = binByLs(data.pressureRows, 15);
  const r = d3.scaleLinear().domain(d3.extent(bins, (d) => d.meanPressure)).nice();

  function render() {
    const width = Math.max(container.node().clientWidth, 320);
    const height = width + 56;
    const margin = { top: 40, right: 44, bottom: 56, left: 44 };
    const innerRadius = Math.max(width * 0.12, 58);
    const drawableWidth = width - margin.left - margin.right;
    const drawableHeight = height - margin.top - margin.bottom;
    const outerRadius = Math.min(drawableWidth, drawableHeight) / 2 - 8;
    const centerX = margin.left + drawableWidth / 2;
    const centerY = margin.top + drawableHeight / 2;

    svg.attr("viewBox", `0 0 ${width} ${height}`);
    root.attr("transform", `translate(${centerX},${centerY})`);
    r.range([innerRadius, outerRadius]);

    const selectedRows = state.solRange
      ? data.pressureRows.filter((d) => isInSolRange(d, state.solRange))
      : data.pressureRows;
    const selectedBins = binByLs(selectedRows, 15);

    const radialLine = d3
      .lineRadial()
      .defined((d) => d.count > 0)
      .angle((d) => angleForLs(d.angle))
      .radius((d) => r(d.meanPressure))
      .curve(d3.curveCardinalClosed.tension(0.5));

    const gridValues = r.ticks(4);

    gridLayer
      .selectAll("circle")
      .data(gridValues)
      .join("circle")
      .attr("fill", "none")
      .attr("stroke", "rgba(92, 101, 94, 0.2)")
      .attr("stroke-dasharray", "3 5")
      .attr("r", (d) => r(d));

    gridLayer
      .selectAll(".grid-label")
      .data(gridValues)
      .join("text")
      .attr("class", "center-label grid-label")
      .attr("x", 0)
      .attr("y", (d) => -r(d) + 12)
      .text((d) => `${formatWhole(d)} Pa`);

    const seasonMarks = [
      { ls: 0, label: "Ls 0°" },
      { ls: 90, label: "Ls 90°" },
      { ls: 180, label: "Ls 180°" },
      { ls: 270, label: "Ls 270°" },
    ];

    spokeLayer
      .selectAll(".season-spoke")
      .data(seasonMarks)
      .join("line")
      .attr("class", "season-spoke")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", (d) => Math.cos(angleForLs(d.ls)) * outerRadius)
      .attr("y2", (d) => Math.sin(angleForLs(d.ls)) * outerRadius);

    labelLayer
      .selectAll(".season-label")
      .data(seasonMarks)
      .join("text")
      .attr("class", "axis-label season-label")
      .attr("x", (d) => Math.cos(angleForLs(d.ls)) * (outerRadius + 10))
      .attr("y", (d) => Math.sin(angleForLs(d.ls)) * (outerRadius + 10))
      .attr("text-anchor", (d) => {
        if (d.ls === 90) return "start";
        if (d.ls === 270) return "end";
        return "middle";
      })
      .attr("dominant-baseline", (d) => {
        if (d.ls === 0) return "ideographic";
        if (d.ls === 180) return "hanging";
        return "middle";
      })
      .text((d) => d.label);

    lineLayer
      .selectAll(".wheel-full")
      .data([bins])
      .join("path")
      .attr("class", "wheel-full")
      .attr("d", radialLine);

    lineLayer
      .selectAll(".wheel-selected")
      .data([selectedBins])
      .join("path")
      .attr("class", "wheel-selected")
      .attr("d", radialLine);

    const arc = d3
      .arc()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius);

    hitLayer
      .selectAll(".season-hit")
      .data(selectedBins, (d) => d.start)
      .join("path")
      .attr("class", "season-hit")
      .attr("d", (d) =>
        arc({
          startAngle: angleForLs(d.start),
          endAngle: angleForLs(d.end),
        })
      )
      .on("mousemove", (event, d) => {
        const fullBin = bins.find((bin) => bin.start === d.start);
        showTooltip(event, buildSeasonTooltip(d, fullBin));
      })
      .on("mouseleave", hideTooltip);

    const selectedCount = selectedRows.length;
    const status = state.solRange
      ? `Brushed window: sols ${formatWhole(state.solRange[0])}-${formatWhole(
          state.solRange[1]
        )}`
      : "Showing all available days.";
    d3.select("#season-status").text(status);

    centerLayer
      .selectAll(".center-title")
      .data([
        state.solRange
          ? `${formatWhole(selectedCount)} pressure readings`
          : "Full pressure cycle",
      ])
      .join("text")
      .attr("class", "center-label center-title")
      .attr("y", -4)
      .text((d) => d);

    centerLayer
      .selectAll(".center-copy")
      .data([
        state.solRange
          ? "linked from chart 1"
          : "make a selection above",
      ])
      .join("text")
      .attr("class", "center-label center-copy")
      .attr("y", 16)
      .text((d) => d);
  }

  return { render };
}

function createQualityChart({ container, data }) {
  const svg = container.append("svg");
  const root = svg.append("g");
  const selectionLayer = root.append("g");
  const axisLayerX = root.append("g").attr("class", "axis");
  const rowLayer = root.append("g");
  const labelLayer = root.append("g");
  const overlayLayer = root.append("g");

  const x = d3.scaleLinear().domain(data.solExtent);
  const y = d3.scaleBand().domain(data.qualityFields.map((d) => d.label)).paddingInner(0.24);

  function render() {
    const width = Math.max(container.node().clientWidth, 320);
    const height = 300;
    const margin = { top: 18, right: 18, bottom: 46, left: 108 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    svg.attr("viewBox", `0 0 ${width} ${height}`);
    root.attr("transform", `translate(${margin.left},${margin.top})`);
    x.range([0, innerWidth]);
    y.range([0, innerHeight]);

    const cellWidth = Math.max(1.2, innerWidth / data.all.length);

    const selectedBand = state.solRange ? [state.solRange] : [];
    selectionLayer
      .selectAll(".quality-selection")
      .data(selectedBand)
      .join("rect")
      .attr("class", "quality-selection")
      .attr("x", (d) => x(d[0]))
      .attr("y", 0)
      .attr("width", (d) => Math.max(1, x(d[1]) - x(d[0])))
      .attr("height", innerHeight);

    const fieldRows = rowLayer
      .selectAll(".quality-row")
      .data(data.qualityFields, (d) => d.key)
      .join("g")
      .attr("class", "quality-row")
      .attr("transform", (d) => `translate(0,${y(d.label)})`);

    fieldRows
      .selectAll(".quality-row-bg")
      .data((field) => [field])
      .join("rect")
      .attr("class", "quality-row-bg")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", innerWidth)
      .attr("height", y.bandwidth())
      .attr("rx", 3);

    fieldRows
      .selectAll(".quality-cell")
      .data((field) =>
        data.all
          .filter((d) => field.isAvailable(d))
          .map((d) => ({ field, datum: d }))
      , (d) => `${d.field.key}-${d.datum.sol}`)
      .join("rect")
      .attr("class", "quality-cell")
      .attr("x", (d) => x(d.datum.sol) - cellWidth / 2)
      .attr("y", y.bandwidth() * 0.14)
      .attr("width", cellWidth)
      .attr("height", y.bandwidth() * 0.72)
      .attr("fill", (d) => d.field.color)
      .attr("opacity", (d) => {
        if (state.solRange && !isInSolRange(d.datum, state.solRange)) return 0.2;
        return d.datum.sol === state.hoveredSol ? 1 : 0.9;
      })
      .attr("stroke", (d) => (d.datum.sol === state.hoveredSol ? "#111111" : "none"))
      .attr("stroke-width", (d) => (d.datum.sol === state.hoveredSol ? 1 : 0));

    labelLayer
      .selectAll(".quality-row-label")
      .data(data.qualityFields, (d) => d.key)
      .join("text")
      .attr("class", "axis-label quality-row-label")
      .attr("x", -14)
      .attr("y", (d) => y(d.label) + y.bandwidth() / 2)
      .attr("text-anchor", "end")
      .attr("dominant-baseline", "middle")
      .text((d) => d.label);

    axisLayerX
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x).ticks(6).tickFormat(d3.format("d")));

    axisLayerX
      .selectAll(".axis-label-x")
      .data(["Sol"])
      .join("text")
      .attr("class", "axis-label axis-label-x")
      .attr("x", innerWidth)
      .attr("y", 40)
      .attr("text-anchor", "end")
      .text((d) => d);

    const hovered = data.all.find((d) => d.sol === state.hoveredSol);
    const hoveredData = hovered ? [hovered] : [];

    overlayLayer
      .selectAll(".quality-hover-line")
      .data(hoveredData)
      .join("line")
      .attr("class", "hover-line quality-hover-line")
      .attr("x1", (d) => x(d.sol))
      .attr("x2", (d) => x(d.sol))
      .attr("y1", 0)
      .attr("y2", innerHeight);

    overlayLayer
      .selectAll(".quality-overlay")
      .data([null])
      .join("rect")
      .attr("class", "quality-overlay")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", innerWidth)
      .attr("height", innerHeight)
      .on("mousemove", (event) => {
        const [mouseX] = d3.pointer(event, overlayLayer.node());
        const hoveredDatum = nearestBySol(data.all, x.invert(mouseX));
        const nextHoveredSol = hoveredDatum ? hoveredDatum.sol : null;
        const changed = state.hoveredSol !== nextHoveredSol;
        state.hoveredSol = nextHoveredSol;
        showTooltip(event, buildQualityTooltip(hoveredDatum, data.qualityFields));
        if (changed) renderAll();
      })
      .on("mouseleave", () => {
        const hadHover = state.hoveredSol !== null;
        state.hoveredSol = null;
        hideTooltip();
        if (hadHover) renderAll();
      });
  }

  return { render };
}

function renderAll() {
  if (!appData || !charts) return;

  charts.extremes.render();
  charts.seasonWheel.render();
  charts.quality.render();
}

function parseNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDate(value) {
  for (const parser of dateParsers) {
    const parsed = parser(value);
    if (parsed) return parsed;
  }
  return null;
}

function isInSolRange(datum, range) {
  if (!range) return true;
  return datum.sol >= range[0] && datum.sol <= range[1];
}

function colorForOpacity(category) {
  return opacityPalette.get(category) || opacityPalette.get("Unknown");
}

function nearestBySol(rows, targetSol) {
  const bisect = d3.bisector((d) => d.sol).left;
  const index = bisect(rows, targetSol);
  const previous = rows[Math.max(0, index - 1)];
  const next = rows[Math.min(rows.length - 1, index)];
  if (!previous) return next;
  if (!next) return previous;
  return Math.abs(previous.sol - targetSol) < Math.abs(next.sol - targetSol)
    ? previous
    : next;
}

function binByLs(rows, binSize) {
  return d3.range(0, 360, binSize).map((start) => {
    const end = start + binSize;
    const values = rows.filter((d) => d.ls >= start && d.ls < end);
    return {
      start,
      end,
      angle: start + binSize / 2,
      count: values.length,
      meanPressure: d3.mean(values, (d) => d.pressure) ?? 0,
    };
  });
}

function angleForLs(ls) {
  return ((ls - 90) * Math.PI) / 180;
}

function buildExtremesTooltip(d) {
  if (!d) return "";
  const dateLabel = d.terrestrial_date
    ? formatDate(d.terrestrial_date)
    : d.terrestrial_date_raw || "Date unavailable";
  return `
    <p><strong>Sol ${formatWhole(d.sol)}</strong></p>
    <p>${dateLabel}</p>
    <p>Low: ${formatWhole(d.min_temp)}°C</p>
    <p>High: ${formatWhole(d.max_temp)}°C</p>
    <p>Daily swing: ${formatWhole(d.tempRange)}°C</p>
  `;
}

function buildSeasonTooltip(selectedBin, fullBin) {
  const selectedLine =
    selectedBin.count > 0
      ? `Selected mean pressure: ${formatDecimal(selectedBin.meanPressure)} Pa`
      : "Selected mean pressure: no observations in this bin";
  return `
    <p><strong>Ls ${selectedBin.start}°-${selectedBin.end}°</strong></p>
    <p>${selectedLine}</p>
    <p>Selected observations: ${formatWhole(selectedBin.count)}</p>
    <p>Full mean pressure: ${formatDecimal(fullBin.meanPressure)} Pa</p>
    <p>Full observations: ${formatWhole(fullBin.count)}</p>
  `;
}

function buildQualityTooltip(d, fields) {
  if (!d) return "";
  const dateLabel = d.terrestrial_date
    ? formatDate(d.terrestrial_date)
    : d.terrestrial_date_raw || "Date unavailable";
  const lines = fields
    .map(
      (field) =>
        `<p>${field.label}: <strong>${
          field.isAvailable(d) ? "reported" : "missing"
        }</strong></p>`
    )
    .join("");
  return `
    <p><strong>Sol ${formatWhole(d.sol)}</strong></p>
    <p>${dateLabel}</p>
    ${lines}
  `;
}

function showTooltip(event, html) {
  if (!html) return;
  tooltip.html(html).attr("hidden", null);
  const padding = 14;
  const tooltipNode = tooltip.node();
  const bounds = tooltipNode.getBoundingClientRect();
  const x = Math.min(
    window.innerWidth - bounds.width - padding,
    event.clientX + 18
  );
  const y = Math.min(
    window.innerHeight - bounds.height - padding,
    event.clientY + 18
  );
  tooltip.style("left", `${Math.max(padding, x)}px`).style("top", `${Math.max(padding, y)}px`);
}

function hideTooltip() {
  tooltip.attr("hidden", true);
}

function textAll(selector, value) {
  document.querySelectorAll(selector).forEach((node) => {
    node.textContent = value;
  });
}

function sameSelection(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return Math.abs(a[0] - b[0]) < 0.5 && Math.abs(a[1] - b[1]) < 0.5;
}
