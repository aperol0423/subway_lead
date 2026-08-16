const startScreen = document.getElementById("start-screen");
const regionScreen = document.getElementById("region-screen");
const lineScreen = document.getElementById("line-screen");
const stationScreen = document.getElementById("station-screen");
const resultScreen = document.getElementById("result-screen");
const quickScreen = document.getElementById("quick-screen");
const quickResultScreen = document.getElementById("quick-result-screen");

const startBtn = document.getElementById("start-btn");
const backToStartBtn = document.getElementById("back-to-start");
const backToRegionBtn = document.getElementById("back-to-region");
const backToLineBtn = document.getElementById("back-to-line");
const backToStationBtn = document.getElementById("back-to-station");
const backFromQuickBtn = document.getElementById("back-from-quick");
const backToQuickBtn = document.getElementById("back-to-quick");
const checkBtn = document.getElementById("check-btn");
const quickFindBtn = document.getElementById("quick-find-btn");

const regionButtons = document.querySelectorAll(".region-btn");
const lineList = document.getElementById("line-list");

const selectedRegionText = document.getElementById("selected-region");
const stationRegionText = document.getElementById("station-region");
const stationLineText = document.getElementById("station-line");
const quickRegionText = document.getElementById("quick-region");

const finalRegionText = document.getElementById("final-region");
const finalLineText = document.getElementById("final-line");
const finalStartText = document.getElementById("final-start");
const finalEndText = document.getElementById("final-end");
const resultMessage = document.getElementById("result-message");

const startStationSelect = document.getElementById("start-station");
const endStationSelect = document.getElementById("end-station");
const quickStartName = document.getElementById("quick-start-name");
const quickEndName = document.getElementById("quick-end-name");
const quickRouteTitle = document.getElementById("quick-route-title");
const quickRouteMessage = document.getElementById("quick-route-message");
const shortestModeBtn = document.getElementById("shortest-mode-btn");
const transferModeBtn = document.getElementById("transfer-mode-btn");

const regions = {
  seoul: {
    name: "서울특별시",
    dataFile: "seoul",
    lines: [
      "1호선", "2호선", "3호선", "4호선", "5호선", "6호선", "7호선", "8호선", "9호선",
      "경의·중앙선", "수인·분당선", "경춘선", "경강선", "서해선", "공항철도",
      "신분당선", "우이신설선", "신림선", "GTX-A"
    ]
  },
  busan: {
    name: "부산광역시",
    dataFile: "busan",
    extraDataFiles: ["busan-extra"],
    lines: ["부산 1호선", "부산 2호선", "부산 3호선", "부산 4호선", "동해선", "부산김해경전철"]
  },
  daegu: { name: "대구광역시", dataFile: "daegu", lines: ["대구 1호선", "대구 2호선", "대구 3호선"] },
  gwangju: { name: "광주광역시", dataFile: "gwangju", lines: ["광주 1호선"] },
  incheon: { name: "인천광역시", dataFile: "incheon", lines: ["인천 1호선", "인천 2호선"] },
  daejeon: { name: "대전광역시", dataFile: "daejeon", lines: ["대전 1호선"] }
};

let selectedRegion = "";

const DEFAULT_LINE_COLOR = "#60778A";
const LINE_COLORS = Object.freeze({
  seoul: Object.freeze({
    "1": "#263C96", "2": "#3CB44A", "3": "#FF7300", "4": "#2C9EDE",
    "5": "#8936E0", "6": "#B5500B", "7": "#697215", "8": "#E51E6E", "9": "#CEA43A",
    gyeongui_jungang: "#7CC4A5", suin_bundang: "#FFCE33", gyeongchun: "#08AF7B",
    gyeonggang: "#2683F2", seohae: "#8BC53F", airport_railroad: "#73B6E4",
    shinbundang: "#A71E31", ui_sinseol: "#C6C100", sillim: "#4E67A5", gtx_a: "#905A89"
  }),
  busan: Object.freeze({
    "1": "#F06A00", "2": "#81BF48", "3": "#BB8C00", "4": "#2E67CE",
    donghae: "#0066B3", bgl: "#875CAC"
  }),
  daegu: Object.freeze({ "1": "#D93F5C", "2": "#00AA80", "3": "#FFB100" }),
  gwangju: Object.freeze({ "1": "#009088" }),
  incheon: Object.freeze({ "1": "#7CA8D5", "2": "#ED8B00" }),
  daejeon: Object.freeze({ "1": "#007448" })
});

function getLineColor(regionId, lineId) {
  return LINE_COLORS[regionId]?.[String(lineId)] || DEFAULT_LINE_COLOR;
}

function relativeLuminance(hexColor) {
  const normalized = String(hexColor).replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return 0;
  const channels = [0, 2, 4].map((offset) => {
    const channel = parseInt(normalized.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function getContrastTextColor(backgroundColor) {
  const backgroundLuminance = relativeLuminance(backgroundColor);
  const darkLuminance = relativeLuminance("#111111");
  const lightContrast = 1.05 / (backgroundLuminance + 0.05);
  const darkContrast = (backgroundLuminance + 0.05) / (darkLuminance + 0.05);
  return darkContrast >= lightContrast ? "#111111" : "#FFFFFF";
}

function createLineBadge(regionId, lineId, lineName) {
  const color = getLineColor(regionId, lineId);
  const textColor = getContrastTextColor(color);
  return `<span class="route-line-badge" style="--line-color: ${color}; --line-text-color: ${textColor};">${lineName}</span>`;
}

function createFastTransferInfo(items) {
  if (!Array.isArray(items) || items.length === 0) return "";
  const displays = items.map((item) => item.display);
  const accessibleLocations = items.map((item) => {
    if (item.car != null && item.door != null) {
      return `${item.car}번째 차량 ${item.door}번 문`;
    }
    return item.display;
  });
  return `<div class="fast-transfer-info" role="note" aria-label="빠른 환승 ${accessibleLocations.join(", ")}"><span class="fast-transfer-label">빠른 환승</span><span aria-hidden="true">·</span><span>${displays.join(" · ")}</span></div>`;
}

window.LineStyle = Object.freeze({ getLineColor, getContrastTextColor });
let selectedLine = "";
let selectedStartStation = "";
let selectedEndStation = "";
const regionDataCache = new Map();
let activeRegionData = null;
let activeStations = [];
let quickStartStation = null;
let quickEndStation = null;
let routeMode = "shortest";
const fastTransferReady = FastTransfer.load().catch((error) => {
  console.warn("빠른 환승 데이터 로딩 실패: 기존 환승 안내만 표시합니다.", error);
  return null;
});

const quickPickerState = {
  start: { category: "search", query: "" },
  end: { category: "search", query: "" }
};

function showScreen(screen) {
  [startScreen, regionScreen, lineScreen, stationScreen, resultScreen, quickScreen, quickResultScreen].forEach((item) => {
    item.classList.remove("active");
  });
  screen.classList.add("active");
}

async function ensureRegionData() {
  const config = regions[selectedRegion];
  if (!config?.dataFile) {
    throw new Error("이 지역의 지하철 데이터는 아직 준비 중입니다.");
  }

  if (!regionDataCache.has(config.dataFile)) {
    regionDataCache.set(
      config.dataFile,
      await StationData.loadRegionData(config.dataFile, config.extraDataFiles || [])
    );
  }
  activeRegionData = regionDataCache.get(config.dataFile);
  activeStations = StationData.createStationDirectory(activeRegionData);
  return activeRegionData;
}

function getLineIdFromLabel(line) {
  const namedLines = {
    "경의·중앙선": "gyeongui_jungang",
    "수인·분당선": "suin_bundang",
    "경춘선": "gyeongchun",
    "경강선": "gyeonggang",
    "서해선": "seohae",
    "공항철도": "airport_railroad",
    "신분당선": "shinbundang",
    "우이신설선": "ui_sinseol",
    "신림선": "sillim",
    "GTX-A": "gtx_a"
  };
  if (namedLines[line]) return namedLines[line];
  if (line.includes("부산김해경전철")) return "bgl";
  if (line.includes("동해선")) return "donghae";
  const match = line.match(/(\d)호선/);
  if (!match) return "";
  return selectedRegion === "incheon" ? `incheon_${match[1]}` : match[1];
}

function renderLineButtons(region) {
  lineList.innerHTML = "";
  const config = regions[region];
  const lines = config?.lines || [];

  if (config?.dataFile) {
    const quickButton = document.createElement("button");
    quickButton.className = "line-btn quick-route-btn";
    quickButton.textContent = "빠른 길찾기";
    quickButton.addEventListener("click", openQuickRoute);
    lineList.appendChild(quickButton);
  }

  if (lines.length === 0) {
    const message = document.createElement("p");
    message.className = "empty-text";
    message.textContent = "이 지역의 지하철 데이터는 현재 준비 중입니다.";
    lineList.appendChild(message);
  }

  lines.forEach((line) => {
    const button = document.createElement("button");
    button.classList.add("line-btn");
    button.dataset.line = getLineIdFromLabel(line);
    button.textContent = line;

    button.addEventListener("click", async () => {
      selectedLine = line;

      const lineId = getLineIdFromLabel(selectedLine);
      if (!config?.dataFile || !lineId) {
        alert("아직 이 노선의 역 데이터는 준비 중입니다.");
        return;
      }

      await ensureRegionData();
      if (!activeRegionData.lines[lineId]) {
        alert("아직 이 노선의 역 데이터는 준비 중입니다.");
        return;
      }
      stationRegionText.textContent = regions[selectedRegion].name;
      stationLineText.textContent = selectedLine;

      renderStationOptions(selectedLine);
      showScreen(stationScreen);
    });

    lineList.appendChild(button);
  });
}

function renderStationOptions(line) {
  const lineId = getLineIdFromLabel(line);
  const stations = activeRegionData.stations.filter((station) => station.line === lineId);

  startStationSelect.innerHTML = `<option value="">출발역을 선택하세요</option>`;
  endStationSelect.innerHTML = `<option value="">도착역을 선택하세요</option>`;

  stations.forEach((station) => {
    const startOption = document.createElement("option");
    startOption.value = station.name;
    startOption.textContent = station.displayName || station.name;
    startStationSelect.appendChild(startOption);

    const endOption = document.createElement("option");
    endOption.value = station.name;
    endOption.textContent = station.displayName || station.name;
    endStationSelect.appendChild(endOption);
  });
}

function getDirection(line, startStation, endStation) {
  const lineId = getLineIdFromLabel(line);
  if (selectedRegion === "seoul") {
    const startNode = activeRegionData.stations.find(
      (station) => station.line === lineId && station.name === startStation
    );
    const endNode = activeRegionData.stations.find(
      (station) => station.line === lineId && station.name === endStation
    );
    const route = RouteFinder.dijkstra(
      activeRegionData,
      { nodes: startNode ? [startNode.id] : [] },
      { nodes: endNode ? [endNode.id] : [] },
      "shortest",
      { allowedLines: new Set([lineId]), allowTransfers: false }
    );
    if (!route) {
      console.warn("서울 노선 미확정 구간", {
        lineId,
        startStation,
        endStation,
        dataQuality: activeRegionData.lines[lineId].dataQuality
      });
      return "현재 데이터에서 해당 구간의 거리와 경로를 확정할 수 없습니다.";
    }
    return RouteFinder.createGuideSteps(activeRegionData, route)
      .filter((step) => step.type === "ride")
      .map((step) => `${step.lineName} ${step.direction}`)
      .filter((value, index, values) => values.indexOf(value) === index)
      .join(" → ");
  }
  const direction = RouteFinder.getDirection(activeRegionData, lineId, startStation, endStation);
  if (selectedRegion !== "busan") {
    const directionLabel = direction.endsWith("방면") ? direction : `${direction} 방면`;
    return `${activeRegionData.lines[lineId].name} ${directionLabel}`;
  }
  if (lineId === "donghae" || lineId === "bgl") {
    return `${activeRegionData.lines[lineId].name} ${direction} 방면`;
  }
  return `${direction} 방향`;
}

function getDisplayStationName(lineId, stationName) {
  const station = activeRegionData?.stations.find(
    (item) => item.line === lineId && item.name === stationName
  );
  return station?.displayName || stationName;
}

async function openQuickRoute() {
  await Promise.all([ensureRegionData(), fastTransferReady]);
  quickRegionText.textContent = regions[selectedRegion].name;
  quickStartStation = null;
  quickEndStation = null;
  quickStartName.textContent = "선택 전";
  quickEndName.textContent = "선택 전";
  quickPickerState.start = { category: "search", query: "" };
  quickPickerState.end = { category: "search", query: "" };
  setupPicker("start");
  setupPicker("end");
  showScreen(quickScreen);
}

function setupPicker(type) {
  const tabs = document.getElementById(`${type}-category-tabs`);
  const search = document.getElementById(`${type}-search`);
  const categories = [{ id: "search", label: "검색" }];
  Object.keys(activeRegionData.lines).forEach((lineId) => {
    categories.push({ id: lineId, label: activeRegionData.lines[lineId].name });
  });
  if (activeRegionData.scope?.excludedForNow?.length) {
    categories.push({ id: "other", label: "기타 노선" });
  }

  tabs.innerHTML = "";
  categories.forEach((category) => {
    const button = document.createElement("button");
    button.className = "category-tab";
    button.dataset.line = category.id;
    button.textContent = category.label;
    button.dataset.category = category.id;
    button.addEventListener("click", () => {
      quickPickerState[type].category = category.id;
      quickPickerState[type].query = "";
      search.value = "";
      renderPicker(type);
    });
    tabs.appendChild(button);
  });

  search.value = "";
  search.addEventListener("input", () => {
    quickPickerState[type].query = search.value;
    quickPickerState[type].category = "search";
    renderPicker(type);
  });

  renderPicker(type);
}

function renderPicker(type) {
  const state = quickPickerState[type];
  const list = document.getElementById(`${type}-station-list`);
  const search = document.getElementById(`${type}-search`);
  const selected = type === "start" ? quickStartStation : quickEndStation;

  document.querySelectorAll(`#${type}-category-tabs .category-tab`).forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.category === state.category);
  });

  search.style.display = state.category === "search" ? "block" : "none";
  const filtered = StationData.filterStations(activeStations, state.category, state.query);
  list.innerHTML = "";

  if (filtered.length === 0) {
    const message = document.createElement("p");
    message.className = "empty-text";
    message.textContent = state.category === "other" ? "기타 노선 데이터는 아직 추가되지 않았습니다." : "표시할 역이 없습니다.";
    list.appendChild(message);
    return;
  }

  filtered.forEach((station) => {
    const button = document.createElement("button");
    button.className = "station-item";
    button.classList.toggle("selected", selected?.nodes[0] === station.nodes[0]);
    button.innerHTML = `<span class="station-name">${station.name}</span><span class="station-lines">${station.lineText}</span>`;
    button.addEventListener("click", () => {
      if (type === "start") {
        quickStartStation = station;
        quickStartName.textContent = station.name;
      } else {
        quickEndStation = station;
        quickEndName.textContent = station.name;
      }
      renderPicker(type);
    });
    list.appendChild(button);
  });
}

function renderRouteResult() {
  if (!quickStartStation || !quickEndStation) {
    return;
  }

  const route = RouteFinder.dijkstra(activeRegionData, quickStartStation, quickEndStation, routeMode);

  quickRouteTitle.textContent = `${quickStartStation.name} → ${quickEndStation.name}`;
  shortestModeBtn.classList.toggle("active", routeMode === "shortest");
  transferModeBtn.classList.toggle("active", routeMode === "transfer");
  shortestModeBtn.textContent = `${routeMode === "shortest" ? "●" : "○"} 최단경로`;
  transferModeBtn.textContent = `${routeMode === "transfer" ? "●" : "○"} 최소환승`;

  if (!route) {
    if (selectedRegion === "seoul") {
      console.warn("서울 통합 경로 미확정", {
        startNode: quickStartStation.nodes[0],
        endNode: quickEndStation.nodes[0]
      });
    }
    quickRouteMessage.textContent = selectedRegion === "seoul"
      ? "현재 제공된 데이터에서 해당 구간의 거리와 경로를 확정할 수 없습니다. 미확정 구간에는 임의 거리를 사용하지 않습니다."
      : "선택한 두 역을 연결하는 경로를 찾지 못했습니다.";
    return;
  }

  const guideSteps = FastTransfer.enrichGuideSteps(
    activeRegionData,
    route,
    RouteFinder.createGuideSteps(activeRegionData, route)
  );
  const html = [];
  html.push(`<div class="route-summary">경유 ${route.rideStopCount}개 역 · 총 ${route.distanceKm.toFixed(3).replace(/\.?0+$/, "")}km · 환승 ${route.transfers}회</div>`);
  html.push(`<div class="route-station">${route.stations[0].displayName || route.stations[0].name}</div>`);

  guideSteps.forEach((step, index) => {
    if (step.type === "ride") {
      const previousStep = guideSteps[index - 1];
      if (previousStep?.type === "transfer") {
        html.push(`<div class="route-arrow">↓</div>`);
      } else {
        html.push(`<div class="route-arrow">↓</div>`);
        const usesDirectionSuffix = step.lineId === "donghae" || step.lineId === "bgl";
        const directionLabel = selectedRegion !== "busan"
          ? /(?:방면|순환)$/.test(step.direction) ? step.direction : `${step.direction} 방면`
          : usesDirectionSuffix ? `${step.direction} 방면` : `${step.direction}행`;
        html.push(`<div class="route-train">${createLineBadge(step.lineRegionId, step.colorLineId, step.lineName)}<span class="route-direction">${directionLabel}</span></div>`);
        html.push(`<div class="route-arrow">↓</div>`);
      }
      html.push(`<div class="route-station">${step.to}</div>`);
    }

    if (step.type === "transfer") {
      const usesDirectionSuffix = step.nextLineId === "donghae" || step.nextLineId === "bgl";
      const nextDirectionLabel = selectedRegion !== "busan"
        ? /(?:방면|순환)$/.test(step.nextDirection) ? step.nextDirection : `${step.nextDirection} 방면`
        : usesDirectionSuffix ? `${step.nextDirection} 방면` : `${step.nextDirection}행`;
      html.push(`<div class="route-transfer">${createLineBadge(step.nextLineRegionId, step.nextColorLineId, step.nextLineName)}<span>${nextDirectionLabel}으로 환승</span></div>`);
      html.push(createFastTransferInfo(step.fastTransfer));
    }
  });

  quickRouteMessage.innerHTML = html.join("");
}

startBtn.addEventListener("click", () => showScreen(regionScreen));
backToStartBtn.addEventListener("click", () => showScreen(startScreen));
backToRegionBtn.addEventListener("click", () => showScreen(regionScreen));
backToLineBtn.addEventListener("click", () => showScreen(lineScreen));
backToStationBtn.addEventListener("click", () => showScreen(stationScreen));
backFromQuickBtn.addEventListener("click", () => showScreen(lineScreen));
backToQuickBtn.addEventListener("click", () => showScreen(quickScreen));

regionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectedRegion = button.dataset.region;
    selectedRegionText.textContent = regions[selectedRegion].name;
    renderLineButtons(selectedRegion);
    showScreen(lineScreen);
  });
});

checkBtn.addEventListener("click", () => {
  selectedStartStation = startStationSelect.value;
  selectedEndStation = endStationSelect.value;

  if (!selectedStartStation || !selectedEndStation) {
    alert("출발역과 도착역을 모두 선택해주십시오");
    return;
  }

  if (selectedStartStation === selectedEndStation) {
    alert("출발역과 도착역이 같습니다. 서로 다른 역을 선택해주십시오");
    return;
  }

  finalRegionText.textContent = regions[selectedRegion].name;
  finalLineText.textContent = selectedLine;
  const lineId = getLineIdFromLabel(selectedLine);
  finalStartText.textContent = getDisplayStationName(lineId, selectedStartStation);
  finalEndText.textContent = getDisplayStationName(lineId, selectedEndStation);

  const direction = getDirection(selectedLine, selectedStartStation, selectedEndStation);
  resultMessage.innerHTML = direction.startsWith("현재 데이터")
    ? direction
    : `👉 <span class="highlight">${direction}</span> 열차를 타십시오.`;
  showScreen(resultScreen);
});

quickFindBtn.addEventListener("click", () => {
  if (!quickStartStation || !quickEndStation) {
    alert("출발역과 도착역을 모두 선택해주십시오");
    return;
  }

  if (quickStartStation.nodes[0] === quickEndStation.nodes[0]) {
    alert("출발역과 도착역이 같습니다. 서로 다른 역을 선택해주십시오");
    return;
  }

  routeMode = "shortest";
  renderRouteResult();
  showScreen(quickResultScreen);
});

[shortestModeBtn, transferModeBtn].forEach((button) => {
  button.addEventListener("click", () => {
    routeMode = button.dataset.mode;
    renderRouteResult();
  });
});
