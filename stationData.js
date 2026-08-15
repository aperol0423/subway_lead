const StationData = (() => {
  const lineLabel = (lineId) => `${lineId}호선`;

  async function loadRegionData(regionId) {
    if (regionId !== "busan") {
      throw new Error("현재 빠른 길찾기는 부산 1~4호선 데이터만 지원합니다.");
    }

    const response = await fetch("data/busan.json");
    if (!response.ok) {
      throw new Error("부산 지하철 데이터를 불러오지 못했습니다.");
    }

    return response.json();
  }

  function createStationDirectory(regionData) {
    const stationMap = new Map();

    regionData.stations.forEach((station) => {
      if (!stationMap.has(station.name)) {
        stationMap.set(station.name, {
          name: station.name,
          lines: [],
          nodes: []
        });
      }

      const grouped = stationMap.get(station.name);
      grouped.lines.push(station.line);
      grouped.nodes.push(station.id);
    });

    return Array.from(stationMap.values())
      .map((station) => ({
        ...station,
        lines: station.lines.sort((a, b) => Number(a) - Number(b)),
        lineText: station.lines.map(lineLabel).join(" · ")
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }

  function filterStations(stations, category, query) {
    const trimmedQuery = query.trim();
    let result = stations;

    if (category !== "search" && category !== "other") {
      result = result.filter((station) => station.lines.includes(category));
    }

    if (category === "other") {
      result = [];
    }

    if (trimmedQuery) {
      result = result.filter((station) => station.name.includes(trimmedQuery));
    }

    return result;
  }

  function getLineStations(regionData, lineId) {
    return regionData.lines[lineId]?.stations || [];
  }

  function getLineName(regionData, lineId) {
    return regionData.lines[lineId]?.name || lineLabel(lineId);
  }

  return {
    loadRegionData,
    createStationDirectory,
    filterStations,
    getLineStations,
    getLineName,
    lineLabel
  };
})();
