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

const subwayLines = {
  "수도권": ["서울 1호선", "서울 2호선", "서울 3호선", "서울 4호선", "경의중앙선"],
  "부산·울산·경남": ["부산 1호선", "부산 2호선", "부산 3호선", "부산 4호선", "동해선", "부산김해경전철"],
  "대구·경북": ["대구 1호선", "대구 2호선", "대구 3호선"],
  "대전·세종·충청": ["대전 1호선"],
  "광주·전남": ["광주 1호선"]
};

let selectedRegion = "";
let selectedLine = "";
let selectedStartStation = "";
let selectedEndStation = "";
let busanData = null;
let busanStations = [];
let quickStartStation = null;
let quickEndStation = null;
let routeMode = "shortest";

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

async function ensureBusanData() {
  if (busanData) {
    return busanData;
  }

  busanData = await StationData.loadRegionData("busan");
  busanStations = StationData.createStationDirectory(busanData);
  return busanData;
}

function getLineIdFromLabel(line) {
  const match = line.match(/부산\s*(\d)호선/);
  return match ? match[1] : "";
}

function renderLineButtons(region) {
  lineList.innerHTML = "";
  const lines = subwayLines[region] || [];

  if (region === "부산·울산·경남") {
    const quickButton = document.createElement("button");
    quickButton.className = "line-btn quick-route-btn";
    quickButton.textContent = "빠른 길찾기";
    quickButton.addEventListener("click", openQuickRoute);
    lineList.appendChild(quickButton);
  }

  lines.forEach((line) => {
    const button = document.createElement("button");
    button.classList.add("line-btn");
    button.textContent = line;

    button.addEventListener("click", async () => {
      selectedLine = line;

      if (!getLineIdFromLabel(selectedLine)) {
        alert("아직 이 노선의 역 데이터는 준비 중입니다.");
        return;
      }

      await ensureBusanData();
      stationRegionText.textContent = selectedRegion;
      stationLineText.textContent = selectedLine;

      renderStationOptions(selectedLine);
      showScreen(stationScreen);
    });

    lineList.appendChild(button);
  });
}

function renderStationOptions(line) {
  const lineId = getLineIdFromLabel(line);
  const stations = StationData.getLineStations(busanData, lineId);

  startStationSelect.innerHTML = `<option value="">출발역을 선택하세요</option>`;
  endStationSelect.innerHTML = `<option value="">도착역을 선택하세요</option>`;

  stations.forEach((station) => {
    const startOption = document.createElement("option");
    startOption.value = station;
    startOption.textContent = station;
    startStationSelect.appendChild(startOption);

    const endOption = document.createElement("option");
    endOption.value = station;
    endOption.textContent = station;
    endStationSelect.appendChild(endOption);
  });
}

function getDirection(line, startStation, endStation) {
  const lineId = getLineIdFromLabel(line);
  return `${RouteFinder.getDirection(busanData, lineId, startStation, endStation)} 방향`;
}

async function openQuickRoute() {
  await ensureBusanData();
  quickRegionText.textContent = selectedRegion;
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
  const categories = [
    { id: "search", label: "검색" },
    { id: "1", label: "1호선" },
    { id: "2", label: "2호선" },
    { id: "3", label: "3호선" },
    { id: "4", label: "4호선" },
    { id: "other", label: "기타 노선" }
  ];

  tabs.innerHTML = "";
  categories.forEach((category) => {
    const button = document.createElement("button");
    button.className = "category-tab";
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
  const filtered = StationData.filterStations(busanStations, state.category, state.query);
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
    button.classList.toggle("selected", selected?.name === station.name);
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

  const route = RouteFinder.dijkstra(busanData, quickStartStation.name, quickEndStation.name, routeMode);

  quickRouteTitle.textContent = `${quickStartStation.name} → ${quickEndStation.name}`;
  shortestModeBtn.classList.toggle("active", routeMode === "shortest");
  transferModeBtn.classList.toggle("active", routeMode === "transfer");
  shortestModeBtn.textContent = `${routeMode === "shortest" ? "●" : "○"} 최단경로`;
  transferModeBtn.textContent = `${routeMode === "transfer" ? "●" : "○"} 최소환승`;

  if (!route) {
    quickRouteMessage.textContent = "선택한 두 역을 연결하는 경로를 찾지 못했습니다.";
    return;
  }

  const guideSteps = RouteFinder.createGuideSteps(busanData, route);
  const html = [];

  guideSteps.forEach((step, index) => {
    if (step.type === "ride") {
      if (index === 0) {
        html.push(`<div class="route-station">${step.from}</div>`);
      }
      const previousStep = guideSteps[index - 1];
      if (previousStep?.type === "transfer") {
        html.push(`<div class="route-arrow">↓</div>`);
      } else {
        html.push(`<div class="route-arrow">↓</div>`);
        html.push(`<div class="route-train">${step.lineName} ${step.direction}행</div>`);
        html.push(`<div class="route-arrow">↓</div>`);
      }
      html.push(`<div class="route-station">${step.to}</div>`);
    }

    if (step.type === "transfer") {
      html.push(`<div class="route-transfer">${step.nextLineName} ${step.nextDirection}행으로 환승</div>`);
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
    selectedRegionText.textContent = selectedRegion;
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

  finalRegionText.textContent = selectedRegion;
  finalLineText.textContent = selectedLine;
  finalStartText.textContent = selectedStartStation;
  finalEndText.textContent = selectedEndStation;

  const direction = getDirection(selectedLine, selectedStartStation, selectedEndStation);
  resultMessage.innerHTML = `👉 <span class="highlight">${direction}</span> 열차를 타십시오.`;
  showScreen(resultScreen);
});

quickFindBtn.addEventListener("click", () => {
  if (!quickStartStation || !quickEndStation) {
    alert("출발역과 도착역을 모두 선택해주십시오");
    return;
  }

  if (quickStartStation.name === quickEndStation.name) {
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
