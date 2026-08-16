const StationData = (() => {
  const lineLabel = (lineId) => `${lineId}호선`;

  function mergeRegionData(base, extra) {
    const addedLineNames = new Set(Object.values(extra.lines).map((line) => line.name));
    return {
      ...base,
      scope: {
        ...base.scope,
        includedLines: [...(base.scope?.includedLines || []), ...(extra.scope?.includedLines || [])],
        excludedForNow: (base.scope?.excludedForNow || []).filter((name) => !addedLineNames.has(name))
      },
      lines: { ...base.lines, ...extra.lines },
      stations: [...base.stations, ...extra.stations],
      rideEdges: [...base.rideEdges, ...extra.rideEdges],
      transferEdges: [...base.transferEdges, ...extra.transferEdges],
      extraDataMetadata: {
        region: extra.region,
        scope: extra.scope,
        dataQuality: extra.dataQuality,
        routingNotes: extra.routingNotes
      }
    };
  }

  function seoulNodeId(lineId, originalId) {
    return `seoul:${lineId}:${originalId}`;
  }

  function normalizeSeoulData(manifest, rawDatasets) {
    const lines = {};
    const stations = [];
    const rideEdges = [];

    rawDatasets.forEach((raw) => {
      const lineId = raw.line.id;
      const manifestLine = manifest.files.find((item) => item.lineId === lineId);
      lines[lineId] = {
        ...raw.line,
        originalId: lineId,
        regionId: "seoul",
        name: manifestLine?.displayName || raw.line.name,
        stations: raw.stations.map((station) => station.name),
        routingNotes: raw.routingNotes,
        branches: raw.branches,
        dataQuality: raw.dataQuality
      };

      raw.stations.forEach((station) => {
        stations.push({
          ...station,
          id: seoulNodeId(lineId, station.id),
          originalNodeId: station.id,
          line: lineId,
          lineName: manifestLine?.displayName || raw.line.name
        });
      });

      raw.rideEdges.forEach((edge) => {
        rideEdges.push({
          ...edge,
          from: seoulNodeId(lineId, edge.from),
          to: seoulNodeId(lineId, edge.to),
          originalFrom: edge.from,
          originalTo: edge.to,
          line: lineId
        });
      });
    });

    const stationByLineAndName = new Map(
      stations.map((station) => [`${station.line}\u0000${station.name}`, station])
    );
    const transferEdges = [];

    manifest.transferComplexes.forEach((complex) => {
      const members = complex.members
        .map((member) => stationByLineAndName.get(`${member.line}\u0000${member.station}`))
        .filter(Boolean);

      for (let left = 0; left < members.length; left += 1) {
        for (let right = left + 1; right < members.length; right += 1) {
          transferEdges.push({
            type: "transfer",
            stationName: complex.name,
            from: members[left].id,
            to: members[right].id,
            transferCountCost: 1,
            distanceKm: 0,
            bidirectional: true,
            mappingSource: "data/seoul/manifest.json"
          });
        }
      }
    });

    return {
      schemaVersion: manifest.schemaVersion,
      region: manifest.region,
      scope: { includedLines: manifest.files.map((item) => item.lineId) },
      lines,
      stations,
      rideEdges,
      transferEdges,
      transferPolicy: manifest.transferPolicy,
      rawLineData: rawDatasets
    };
  }

  function createTransferEdges(stations, transferComplexes, mappingSource) {
    const stationByLineAndName = new Map(
      stations.map((station) => [`${station.line}\u0000${station.name}`, station])
    );
    const transferEdges = [];

    transferComplexes.forEach((complex) => {
      const members = complex.members
        .map((member) => stationByLineAndName.get(`${member.line}\u0000${member.station}`))
        .filter(Boolean);

      if (members.length !== complex.members.length) {
        console.warn(`환승 mapping 일부를 찾지 못했습니다: ${complex.name}`, complex.members);
      }

      for (let left = 0; left < members.length; left += 1) {
        for (let right = left + 1; right < members.length; right += 1) {
          transferEdges.push({
            type: "transfer",
            stationName: complex.name,
            from: members[left].id,
            to: members[right].id,
            transferCountCost: 1,
            distanceKm: 0,
            bidirectional: true,
            mappingSource
          });
        }
      }
    });
    return transferEdges;
  }

  function normalizeManifestRegionData(manifest, rawDatasets, baseData = null) {
    const lines = { ...(baseData?.lines || {}) };
    const stations = [...(baseData?.stations || [])];
    const rideEdges = [...(baseData?.rideEdges || [])];

    rawDatasets.forEach((raw, index) => {
      const fileConfig = manifest.files[index];
      const internalLineId = fileConfig.internalLineId || raw.line.id;
      lines[internalLineId] = {
        ...raw.line,
        id: internalLineId,
        originalId: raw.line.id,
        regionId: manifest.region.id,
        stations: raw.stations.map((station) => station.name),
        officialDirections: {
          higherIndex: raw.routingNotes?.towardHigherIndex,
          lowerIndex: raw.routingNotes?.towardLowerIndex
        },
        routingNotes: raw.routingNotes,
        dataQuality: raw.dataQuality
      };

      raw.stations.forEach((station) => {
        stations.push({
          ...station,
          line: internalLineId,
          originalLineId: raw.line.id,
          regionId: manifest.region.id,
          displayName: manifest.displayStationNames?.[station.id] || station.name
        });
      });

      raw.rideEdges.forEach((edge) => {
        rideEdges.push({ ...edge, line: internalLineId, originalLineId: raw.line.id });
      });
    });

    const transferEdges = [
      ...(baseData?.transferEdges || []),
      ...createTransferEdges(
        stations,
        manifest.transferComplexes || [],
        `data/${manifest.region.id}/manifest.json`
      )
    ];

    return {
      schemaVersion: manifest.schemaVersion,
      region: manifest.region,
      scope: {
        includedLines: manifest.files.map((item) => item.internalLineId || item.lineId),
        baseRegion: manifest.baseRegion || null
      },
      lines,
      stations,
      rideEdges,
      transferEdges,
      rawLineData: rawDatasets,
      baseRegionData: baseData || null
    };
  }

  async function loadManifestRegionData(regionId) {
    const manifestPath = `data/${regionId}/manifest.json`;
    const manifestResponse = await fetch(manifestPath);
    if (!manifestResponse.ok) {
      throw new Error(`${regionId} 노선 목록(${manifestPath})을 불러오지 못했습니다.`);
    }
    const manifest = await manifestResponse.json();
    const rawDatasets = await Promise.all(manifest.files.map(async ({ file }) => {
      const filePath = `data/${regionId}/${file}`;
      const response = await fetch(filePath);
      if (!response.ok) {
        throw new Error(`${regionId} 노선 데이터(${filePath})를 불러오지 못했습니다.`);
      }
      return response.json();
    }));
    const baseData = manifest.baseRegion === "seoul" ? await loadSeoulData() : null;
    return normalizeManifestRegionData(manifest, rawDatasets, baseData);
  }

  async function loadSeoulData() {
    const manifestResponse = await fetch("data/seoul/manifest.json");
    if (!manifestResponse.ok) {
      throw new Error("서울 노선 목록을 불러오지 못했습니다.");
    }
    const manifest = await manifestResponse.json();
    const rawDatasets = await Promise.all(manifest.files.map(async ({ file }) => {
      const response = await fetch(`data/seoul/${file}`);
      if (!response.ok) {
        throw new Error(`서울 데이터 ${file}을(를) 불러오지 못했습니다.`);
      }
      return response.json();
    }));
    return normalizeSeoulData(manifest, rawDatasets);
  }

  async function loadRegionData(regionId, extraDataFiles = []) {
    if (regionId === "seoul") {
      return loadSeoulData();
    }
    if (regionId === "daegu" || regionId === "incheon") {
      return loadManifestRegionData(regionId);
    }
    const files = [regionId, ...extraDataFiles];
    const datasets = await Promise.all(files.map(async (file) => {
      const response = await fetch(`data/${file}.json`);
      if (!response.ok) {
        throw new Error(`${file} 지하철 데이터를 불러오지 못했습니다.`);
      }
      return response.json();
    }));

    return datasets.slice(1).reduce(mergeRegionData, datasets[0]);
  }

  function createStationDirectory(regionData) {
    return regionData.stations
      .map((station) => ({
        name: station.displayName || station.name,
        lines: [station.line],
        nodes: [station.id],
        lineText: station.lineName || getLineName(regionData, station.line)
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "ko") || a.lineText.localeCompare(b.lineText, "ko"));
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
    mergeRegionData,
    normalizeSeoulData,
    normalizeManifestRegionData,
    createStationDirectory,
    filterStations,
    getLineStations,
    getLineName,
    lineLabel
  };
})();
