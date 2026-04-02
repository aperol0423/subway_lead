const startScreen = document.getElementById("start-screen");
const regionScreen = document.getElementById("region-screen");
const lineScreen = document.getElementById("line-screen");
const stationScreen = document.getElementById("station-screen");
const resultScreen = document.getElementById("result-screen");

const startBtn = document.getElementById("start-btn");
const backToStartBtn = document.getElementById("back-to-start");
const backToRegionBtn = document.getElementById("back-to-region");
const backToLineBtn = document.getElementById("back-to-line");
const backToStationBtn = document.getElementById("back-to-station");
const checkBtn = document.getElementById("check-btn");

const regionButtons = document.querySelectorAll(".region-btn");
const lineList = document.getElementById("line-list");

const selectedRegionText = document.getElementById("selected-region");

const stationRegionText = document.getElementById("station-region");
const stationLineText = document.getElementById("station-line");

const finalRegionText = document.getElementById("final-region");
const finalLineText = document.getElementById("final-line");
const finalStartText = document.getElementById("final-start");
const finalEndText = document.getElementById("final-end");
const resultMessage = document.getElementById("result-message");

const startStationSelect = document.getElementById("start-station");
const endStationSelect = document.getElementById("end-station");

// 지역별 노선 데이터
const subwayLines = {
  "수도권": [
    "서울 1호선",
    "서울 2호선",
    "서울 3호선",
    "서울 4호선",
    "경의중앙선"
  ],
  "부산·울산·경남": [
    "부산 1호선",
    "부산 2호선",
    "부산 3호선",
    "부산 4호선",
    "동해선"
  ],
  "대구·경북": [
    "대구 1호선",
    "대구 2호선",
    "대구 3호선"
  ],
  "대전·세종·충청": [
    "대전 1호선"
  ],
  "광주·전남": [
    "광주 1호선"
  ]
};

const lineTerminals = {
  "부산 1호선": {
    start: "노포",
    end: "다대포해수욕장"
  },
  "부산 2호선": {
    start: "양산",
    end: "장산"
  },
  "부산 3호선": {
    start: "대저",
    end: "수영"
  },
  "부산 4호선": {
    start: "미남",
    end: "안평"
  }
};

// 실제 역 데이터는 일단 부산 1호선만
const subwayStations = {
  "부산 1호선": [
    "노포",
    "범어사",
    "남산",
    "두실",
    "구서",
    "장전",
    "부산대",
    "온천장",
    "명륜",
    "동래",
    "교대",
    "연산",
    "시청",
    "양정",
    "부전",
    "서면",
    "범내골",
    "범일",
    "좌천",
    "부산진",
    "초량",
    "부산역",
    "중앙",
    "남포",
    "자갈치",
    "토성",
    "동대신",
    "서대신",
    "대티",
    "괴정",
    "사하",
    "당리",
    "하단",
    "신평",
    "동매",
    "장림",
    "신장림",
    "낫개",
    "다대포항",
    "다대포해수욕장"
  ],
  "부산 2호선": [
    "양산",
    "남양산",
    "부산대양산캠퍼스",
    "증산",
    "호포",
    "금곡",
    "동원",
    "율리",
    "화명",
    "수정",
    "덕천",
    "구명",
    "구남",
    "모라",
    "모덕",
    "덕포",
    "사상",
    "감전",
    "주례",
    "냉정",
    "개금",
    "동의대",
    "가야",
    "부암",
    "서면",
    "전포",
    "국제금융센터·부산은행",
    "문현",
    "지게골",
    "못골",
    "대연",
    "경성대·부경대",
    "남천",
    "금련산",
    "광안",
    "수영",
    "민락",
    "센텀시티",
    "벡스코",
    "동백",
    "해운대",
    "중동",
    "장산"
  ],

  "부산 3호선": [
    "대저",
    "체육공원",
    "강서구청",
    "구포",
    "덕천",
    "숙등",
    "남산정",
    "만덕",
    "미남",
    "사직",
    "종합운동장",
    "거제",
    "연산",
    "물만골",
    "배산",
    "망미",
    "수영" 
  ],

  "부산 4호선": [  
    "미남",
    "동래",
    "수안",
    "낙민",
    "충렬사",
    "명장",
    "서동",
    "금사",
    "반여농산물시장",
    "석대",
    "영산대",
    "동부산대학",
    "고촌",
    "안평"
  ]
};

let selectedRegion = "";
let selectedLine = "";
let selectedStartStation = "";
let selectedEndStation = "";

// 화면 전환
function showScreen(screen) {
  startScreen.classList.remove("active");
  regionScreen.classList.remove("active");
  lineScreen.classList.remove("active");
  stationScreen.classList.remove("active");
  resultScreen.classList.remove("active");

  screen.classList.add("active");
}

// 노선 버튼 생성
function renderLineButtons(region) {
  lineList.innerHTML = "";

  const lines = subwayLines[region];

  lines.forEach((line) => {
    const button = document.createElement("button");
    button.classList.add("line-btn");
    button.textContent = line;

    button.addEventListener("click", () => {
      selectedLine = line;

      // 부산 1호선만 실제 지원
      if (!subwayStations[selectedLine]) {
        alert("아직 이 노선의 역 데이터는 준비 중입니다, 지금은 부산 1호선만 테스트 가능합니다.");
        return;
      }

      stationRegionText.textContent = selectedRegion;
      stationLineText.textContent = selectedLine;

      renderStationOptions(selectedLine);
      showScreen(stationScreen);
    });

    lineList.appendChild(button);
  });
}

// 역 선택 옵션 생성
function renderStationOptions(line) {
  const stations = subwayStations[line];

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
  const stations = subwayStations[line];

  const startIndex = stations.indexOf(startStation);
  const endIndex = stations.indexOf(endStation);

  if (startIndex < endIndex) {
    return `${lineTerminals[line].end} 방향`;
  } else {
    return `${lineTerminals[line].start} 방향`;
  }
}

// 시작 버튼
startBtn.addEventListener("click", () => {
  showScreen(regionScreen);
});

// 지역선택 -> 시작
backToStartBtn.addEventListener("click", () => {
  showScreen(startScreen);
});

// 노선선택 -> 지역선택
backToRegionBtn.addEventListener("click", () => {
  showScreen(regionScreen);
});

// 역선택 -> 노선선택
backToLineBtn.addEventListener("click", () => {
  showScreen(lineScreen);
});

// 결과 -> 역선택
backToStationBtn.addEventListener("click", () => {
  showScreen(stationScreen);
});

// 지역 선택
regionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectedRegion = button.dataset.region;
    selectedRegionText.textContent = selectedRegion;
    renderLineButtons(selectedRegion);
    showScreen(lineScreen);
  });
});

// 선택 완료 버튼
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

  resultMessage.innerHTML = `👉 <span class="highlight">${direction}</span> 열차를 타면 돼!`;
  showScreen(resultScreen);
});