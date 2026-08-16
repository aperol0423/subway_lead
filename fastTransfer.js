const FastTransfer = (() => {
  const REGION_IDS = Object.freeze({
    seoul: "seoul_metropolitan",
    busan: "busan",
    daegu: "daegu",
    incheon: "incheon"
  });
  const LINE_ID_ALIASES = Object.freeze({ bgl: "busan_gimhae" });
  const STATION_ALIASES = Object.freeze({
    "서울": "서울역",
    "대곡(정부대구청사)": "설화명곡"
  });
  const directionGraphCache = new WeakMap();
  let loadPromise = null;
  let index = new Map();
  let baseIndex = new Map();

  function canonicalStationName(name) {
    const trimmed = String(name || "").trim();
    const withoutSuffix = trimmed.replace(/\([^()]*\)$/, "").trim();
    return STATION_ALIASES[trimmed] || STATION_ALIASES[withoutSuffix] || withoutSuffix;
  }

  function normalizedLineId(regionData, internalLineId) {
    const line = regionData.lines[internalLineId] || {};
    const originalLineId = line.originalId || internalLineId;
    return LINE_ID_ALIASES[originalLineId] || originalLineId;
  }

  function lineRegionId(regionData, internalLineId) {
    const projectRegionId = regionData.lines[internalLineId]?.regionId || regionData.region?.id;
    return REGION_IDS[projectRegionId] || projectRegionId;
  }

  function makeKey(region, sourceLine, station, targetLine, targetNextStation) {
    return [region, sourceLine, station, targetLine, targetNextStation].join("\u0000");
  }

  function buildIndex(rawData) {
    const nextIndex = new Map();
    const nextBaseIndex = new Map();
    Object.entries(rawData.regions || {}).forEach(([region, rows]) => {
      rows.forEach((row) => {
        if (
          !row.display || !row.sourceLineId || !row.stationName ||
          !row.targetLineId
        ) return;
        const station = canonicalStationName(row.stationName);
        const baseKey = [region, row.sourceLineId, station, row.targetLineId].join("\u0000");
        if (!nextBaseIndex.has(baseKey)) nextBaseIndex.set(baseKey, []);
        nextBaseIndex.get(baseKey).push(row);
        if (!row.targetNextStation) return;
        const key = makeKey(
          region,
          row.sourceLineId,
          station,
          row.targetLineId,
          canonicalStationName(row.targetNextStation)
        );
        if (!nextIndex.has(key)) nextIndex.set(key, []);
        nextIndex.get(key).push(row);
      });
    });
    index = nextIndex;
    baseIndex = nextBaseIndex;
    return index;
  }

  async function load() {
    if (!loadPromise) {
      loadPromise = fetch("data/fast-transfer.json")
        .then((response) => {
          if (!response.ok) throw new Error("빠른 환승 데이터를 불러오지 못했습니다.");
          return response.json();
        })
        .then((rawData) => {
          buildIndex(rawData);
          return rawData;
        });
    }
    return loadPromise;
  }

  function getDirectionGraph(regionData, lineId, traversalForward) {
    if (!directionGraphCache.has(regionData)) directionGraphCache.set(regionData, new Map());
    const regionCache = directionGraphCache.get(regionData);
    const cacheKey = `${lineId}\u0000${traversalForward ? "forward" : "reverse"}`;
    if (regionCache.has(cacheKey)) return regionCache.get(cacheKey);

    const graph = new Map();
    regionData.stations
      .filter((station) => station.line === lineId)
      .forEach((station) => graph.set(station.id, []));
    regionData.rideEdges
      .filter((edge) => edge.line === lineId)
      .forEach((edge) => {
        if (traversalForward) {
          graph.get(edge.from)?.push(edge.to);
        } else if (edge.bidirectional) {
          graph.get(edge.to)?.push(edge.from);
        }
      });
    regionCache.set(cacheKey, graph);
    return graph;
  }

  function isReachable(graph, startId, destinationIds) {
    const targets = new Set(destinationIds);
    const queue = [startId];
    const visited = new Set();
    while (queue.length) {
      const current = queue.shift();
      if (targets.has(current)) return true;
      if (visited.has(current)) continue;
      visited.add(current);
      (graph.get(current) || []).forEach((next) => queue.push(next));
    }
    return false;
  }

  function directedDistance(graph, startId, destinationIds) {
    const targets = new Set(destinationIds);
    const queue = [{ id: startId, distance: 0 }];
    const visited = new Set();
    while (queue.length) {
      const current = queue.shift();
      if (targets.has(current.id)) return current.distance;
      if (visited.has(current.id)) continue;
      visited.add(current.id);
      (graph.get(current.id) || []).forEach((next) => {
        queue.push({ id: next, distance: current.distance + 1 });
      });
    }
    return Number.POSITIVE_INFINITY;
  }

  function sourceDirectionDistance(regionData, sourceLineId, arrivalEdge, sourceDestination) {
    if (!sourceDestination || typeof arrivalEdge.traversalForward !== "boolean") {
      return Number.POSITIVE_INFINITY;
    }
    const canonicalDestination = canonicalStationName(sourceDestination);
    const arrivalStation = regionData.stations.find(
      (station) => station.id === arrivalEdge.to && station.line === sourceLineId
    );
    if (
      arrivalStation &&
      canonicalStationName(arrivalStation.displayName || arrivalStation.name) === canonicalDestination
    ) {
      return 0;
    }
    const destinationIds = regionData.stations
      .filter(
        (station) => station.line === sourceLineId &&
          canonicalStationName(station.displayName || station.name) === canonicalDestination
      )
      .map((station) => station.id);
    if (!destinationIds.length) return Number.POSITIVE_INFINITY;
    const graph = getDirectionGraph(regionData, sourceLineId, arrivalEdge.traversalForward);
    return directedDistance(graph, arrivalEdge.to, destinationIds);
  }

  function matchesSourceDirection(regionData, sourceLineId, arrivalEdge, sourceDestination) {
    return Number.isFinite(
      sourceDirectionDistance(regionData, sourceLineId, arrivalEdge, sourceDestination)
    );
  }

  function matchesTargetDirectionOrigin(regionData, targetLineId, nextRide, targetDirectionOrigin) {
    if (!targetDirectionOrigin || typeof nextRide.traversalForward !== "boolean") return false;
    const canonicalOrigin = canonicalStationName(targetDirectionOrigin);
    const originIds = regionData.stations
      .filter(
        (station) => station.line === targetLineId &&
          canonicalStationName(station.displayName || station.name) === canonicalOrigin
      )
      .map((station) => station.id);
    if (!originIds.length) return false;
    const reverseDirectionGraph = getDirectionGraph(
      regionData,
      targetLineId,
      !nextRide.traversalForward
    );
    return isReachable(reverseDirectionGraph, nextRide.from, originIds);
  }

  function findFastTransfer(regionData, context) {
    const sourceRegion = lineRegionId(regionData, context.sourceLineId);
    const sourceLine = normalizedLineId(regionData, context.sourceLineId);
    const targetLine = normalizedLineId(regionData, context.targetLineId);
    const station = canonicalStationName(context.stationName);
    const targetNextStation = canonicalStationName(context.targetNextStation);
    const key = makeKey(sourceRegion, sourceLine, station, targetLine, targetNextStation);
    let candidates = index.get(key) || [];
    if (!candidates.length) {
      const baseKey = [sourceRegion, sourceLine, station, targetLine].join("\u0000");
      candidates = (baseIndex.get(baseKey) || []).filter(
        (row) => !row.targetNextStation && matchesTargetDirectionOrigin(
          regionData,
          context.targetLineId,
          context.nextRide,
          row.targetDirectionOrigin
        )
      );
    }
    let directionMatches = candidates.filter((row) =>
      matchesSourceDirection(
        regionData,
        context.sourceLineId,
        context.arrivalEdge,
        row.sourceDestination
      )
    );
    if (regionData.lines[context.sourceLineId]?.graphType?.includes("circular")) {
      const distances = directionMatches.map((row) => ({
        row,
        distance: sourceDirectionDistance(
          regionData,
          context.sourceLineId,
          context.arrivalEdge,
          row.sourceDestination
        )
      }));
      const nearestDistance = Math.min(...distances.map((item) => item.distance));
      directionMatches = distances
        .filter((item) => item.distance === nearestDistance)
        .map((item) => item.row);
    }

    if (!directionMatches.length) {
      console.debug("[FastTransfer] no match", {
        region: sourceRegion,
        sourceLine,
        station,
        targetLine,
        targetNextStation
      });
      return [];
    }

    const destinations = new Map();
    directionMatches.forEach((row) => {
      const destination = canonicalStationName(row.sourceDestination);
      if (!destinations.has(destination)) destinations.set(destination, new Set());
      destinations.get(destination).add(row.display);
    });
    const displaySignatures = new Set(
      [...destinations.values()].map((values) => [...values].sort().join("\u0000"))
    );
    if (displaySignatures.size > 1) {
      console.debug("[FastTransfer] ambiguous source direction", {
        region: sourceRegion,
        sourceLine,
        station,
        targetLine,
        targetNextStation
      });
      return [];
    }

    const unique = new Map();
    directionMatches.forEach((row) => {
      if (!row.display || unique.has(row.display)) return;
      unique.set(row.display, { car: row.car, door: row.door, display: row.display });
    });
    return [...unique.values()];
  }

  function transferContext(route, edgeIndex) {
    const edge = route.edges[edgeIndex];
    if (edge?.type !== "transfer") return null;

    let previousRideIndex = edgeIndex - 1;
    while (previousRideIndex >= 0 && route.edges[previousRideIndex].type !== "ride") {
      previousRideIndex -= 1;
    }
    let nextRideIndex = edgeIndex + 1;
    while (nextRideIndex < route.edges.length && route.edges[nextRideIndex].type !== "ride") {
      nextRideIndex += 1;
    }
    if (previousRideIndex < 0 || nextRideIndex >= route.edges.length) return null;
    const arrivalEdge = route.edges[previousRideIndex];
    const nextRide = route.edges[nextRideIndex];
    return {
      transferEdgeIndex: edgeIndex,
      previousStation: route.stations[previousRideIndex]?.displayName || route.stations[previousRideIndex]?.name,
      sourceLineId: arrivalEdge.line,
      targetLineId: nextRide.line,
      stationName: edge.stationName || route.stations[edgeIndex]?.displayName || route.stations[edgeIndex]?.name,
      targetNextStation: route.stations[nextRideIndex + 1]?.displayName || route.stations[nextRideIndex + 1]?.name,
      arrivalEdge,
      nextRide
    };
  }

  function transferContexts(route) {
    return route.edges
      .map((edge, edgeIndex) => edge.type === "transfer" ? transferContext(route, edgeIndex) : undefined)
      .filter((context) => context !== undefined);
  }

  function enrichGuideSteps(regionData, route, guideSteps) {
    const contexts = transferContexts(route).filter(Boolean);
    const usedContextIndexes = new Set();
    return guideSteps.map((step) => {
      if (step.type !== "transfer") return step;
      const contextIndex = contexts.findIndex((candidate, index) => (
        !usedContextIndexes.has(index) &&
        canonicalStationName(candidate.stationName) === canonicalStationName(step.station) &&
        normalizedLineId(regionData, candidate.targetLineId) === normalizedLineId(regionData, step.nextLineId)
      ));
      const context = contextIndex >= 0 ? contexts[contextIndex] : null;
      if (contextIndex >= 0) usedContextIndexes.add(contextIndex);
      return { ...step, fastTransfer: context ? findFastTransfer(regionData, context) : [] };
    });
  }

  return { load, buildIndex, enrichGuideSteps, canonicalStationName };
})();
