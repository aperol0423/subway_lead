const RouteFinder = (() => {
  const graphCache = new WeakMap();

  function buildGraph(regionData) {
    if (graphCache.has(regionData)) {
      return graphCache.get(regionData);
    }
    const graph = new Map();
    const stationsById = new Map(regionData.stations.map((station) => [station.id, station]));

    stationsById.forEach((_, id) => graph.set(id, []));

    const addEdge = (from, to, edge, traversalForward) => {
      if (!graph.has(from)) {
        graph.set(from, []);
      }
      graph.get(from).push({ ...edge, from, to, traversalForward });
    };

    [...regionData.rideEdges, ...regionData.transferEdges].forEach((edge) => {
      addEdge(edge.from, edge.to, edge, true);
      if (edge.bidirectional) {
        addEdge(edge.to, edge.from, edge, false);
      }
    });

    const built = { graph, stationsById };
    graphCache.set(regionData, built);
    return built;
  }

  function getEdgeDistance(edge) {
    if (typeof edge.distanceKm === "number") {
      return edge.distanceKm;
    }

    if (edge.line === "bgl" && typeof edge.fallbackWeightStops === "number") {
      return edge.fallbackWeightStops;
    }

    if (edge.type === "ride") {
      return Number.POSITIVE_INFINITY;
    }

    return 0;
  }

  function getEdgeTransfers(edge) {
    return edge.type === "transfer" ? edge.transferCountCost || 1 : 0;
  }

  function compareCost(a, b, mode) {
    const first = mode === "transfer" ? "transfers" : "distance";
    const second = mode === "transfer" ? "distance" : "transfers";

    if (a[first] !== b[first]) {
      return a[first] - b[first];
    }
    return a[second] - b[second];
  }

  function getStationIds(regionData, stationSelection) {
    if (stationSelection && Array.isArray(stationSelection.nodes)) {
      return stationSelection.nodes;
    }
    return regionData.stations
      .filter((station) => station.name === stationSelection)
      .map((station) => station.id);
  }

  function dijkstra(regionData, startStationSelection, endStationSelection, mode, options = {}) {
    const { graph, stationsById } = buildGraph(regionData);
    const startIds = getStationIds(regionData, startStationSelection);
    const endIds = new Set(getStationIds(regionData, endStationSelection));
    const costs = new Map();
    const previous = new Map();
    const queue = [];

    startIds.forEach((id) => {
      const cost = { distance: 0, transfers: 0 };
      costs.set(id, cost);
      queue.push({ id, cost });
    });

    while (queue.length > 0) {
      queue.sort((a, b) => compareCost(a.cost, b.cost, mode));
      const current = queue.shift();
      const known = costs.get(current.id);

      if (compareCost(current.cost, known, mode) !== 0) {
        continue;
      }

      if (endIds.has(current.id)) {
        return buildRoute(current.id, previous, stationsById, current.cost);
      }

      (graph.get(current.id) || []).forEach((edge) => {
        if (edge.type === "transfer" && options.allowTransfers === false) return;
        if (edge.type === "ride" && options.allowedLines && !options.allowedLines.has(edge.line)) return;
        const nextCost = {
          distance: current.cost.distance + getEdgeDistance(edge),
          transfers: current.cost.transfers + getEdgeTransfers(edge)
        };
        const oldCost = costs.get(edge.to);

        if (Number.isFinite(nextCost.distance) && (!oldCost || compareCost(nextCost, oldCost, mode) < 0)) {
          costs.set(edge.to, nextCost);
          previous.set(edge.to, { from: current.id, edge });
          queue.push({ id: edge.to, cost: nextCost });
        }
      });
    }

    return null;
  }

  function buildRoute(endId, previous, stationsById, cost) {
    const nodeIds = [endId];
    const edges = [];
    let cursor = endId;

    while (previous.has(cursor)) {
      const step = previous.get(cursor);
      edges.unshift(step.edge);
      nodeIds.unshift(step.from);
      cursor = step.from;
    }

    return {
      nodeIds,
      edges,
      stations: nodeIds.map((id) => stationsById.get(id)),
      distanceKm: cost.distance,
      transfers: cost.transfers,
      rideStopCount: edges.filter((edge) => edge.type === "ride").length
    };
  }

  function includesStation(branch, stationName) {
    return Array.isArray(branch) && branch.includes(stationName);
  }

  function getSeoulDirection(regionData, lineId, edge, destinationName) {
    const line = regionData.lines[lineId];
    const notes = line.routingNotes || {};
    const segment = edge.segment;

    if (edge.serviceDirection) return edge.serviceDirection;
    if (notes.towardHigherIndex && notes.towardLowerIndex) {
      return edge.traversalForward ? notes.towardHigherIndex : notes.towardLowerIndex;
    }
    if (lineId === "2") {
      if (segment === "main_loop") return edge.traversalForward ? "내선순환" : "외선순환";
      const branch = notes.branchDirectionLabels?.[segment];
      return edge.traversalForward ? branch?.towardBranchTerminal : branch?.towardMainLine;
    }
    if (lineId === "5") {
      if (!edge.traversalForward) return "방화 방면";
      if (includesStation(line.branches?.macheonBranch, destinationName)) return "마천 방면";
      return "하남검단산 방면";
    }
    if (lineId === "6") {
      if (segment === "eungam_loop") return "응암순환";
      return edge.traversalForward ? notes.mainTrunkDirections?.towardEast : notes.mainTrunkDirections?.towardWest;
    }
    if (lineId === "1") {
      const branches = line.branches || {};
      if (includesStation(branches.gyeonginToIncheon, destinationName)) return "인천 방면";
      if (includesStation(branches.gwangmyeongBranch, destinationName)) return "광명 방면";
      if (includesStation(branches.seodongtanBranch, destinationName)) return "서동탄 방면";
      if (includesStation(branches.gyeongbuJanghangToSinchang, destinationName)) return "신창(순천향대) 방면";
      return "연천 방면";
    }
    if (lineId === "gyeongui_jungang") {
      if (segment === "seoul_station_branch") {
        return edge.traversalForward ? "서울역 방면" : "문산 방면";
      }
      return edge.traversalForward ? "용문/지평 방면" : "문산/도라산 방면";
    }
    if (lineId === "gyeongchun") {
      return edge.traversalForward ? "춘천 방면" : "청량리/상봉 방면";
    }
    if (lineId === "gtx_a") {
      if (segment === "unjeong_seoul") return edge.traversalForward ? "서울 방면" : "운정중앙 방면";
      return edge.traversalForward ? "동탄 방면" : "수서 방면";
    }
    return destinationName ? `${destinationName} 방면` : "";
  }

  function getDirection(regionData, lineId, fromStationName, toStationName) {
    const line = regionData.lines[lineId];
    const fromIndex = line.stations.indexOf(fromStationName);
    const toIndex = line.stations.indexOf(toStationName);

    if (fromIndex < 0 || toIndex < 0) {
      return "";
    }

    if (line.officialDirections) {
      return fromIndex < toIndex
        ? line.officialDirections.higherIndex
        : line.officialDirections.lowerIndex;
    }

    return fromIndex < toIndex ? line.terminals.forward : line.terminals.reverse;
  }

  function getRouteEdgeDirection(regionData, edge, destinationName) {
    const lineRegionId = regionData.lines[edge.line]?.regionId || regionData.region?.id;
    if (lineRegionId === "seoul") {
      return getSeoulDirection(regionData, edge.line, edge, destinationName);
    }
    const fromStation = regionData.stations.find((station) => station.id === edge.from);
    const toStation = regionData.stations.find((station) => station.id === edge.to);
    return getDirection(regionData, edge.line, fromStation?.name, toStation?.name);
  }

  function createGuideSteps(regionData, route) {
    const steps = [];
    let cursor = 0;
    const destinationName = route.stations.at(-1)?.name;

    while (cursor < route.edges.length) {
      const currentEdge = route.edges[cursor];
      if (currentEdge.type === "transfer") {
        const nextRide = route.edges.slice(cursor + 1).find((edge) => edge.type === "ride");
        if (nextRide) {
          steps.push({
            type: "transfer",
            station: route.stations[cursor].displayName || route.stations[cursor].name,
            nextLineId: nextRide.line,
            nextLineName: regionData.lines[nextRide.line].name,
            nextLineRegionId: regionData.lines[nextRide.line].regionId || regionData.region?.id,
            nextColorLineId: regionData.lines[nextRide.line].originalId || nextRide.line,
            nextDirection: getRouteEdgeDirection(regionData, nextRide, destinationName)
          });
        }
        cursor += 1;
        continue;
      }

      const lineId = currentEdge.line;
      const direction = getRouteEdgeDirection(regionData, currentEdge, destinationName);
      const segmentStartNodeIndex = cursor;
      let segmentEndEdgeIndex = cursor;
      while (
        segmentEndEdgeIndex + 1 < route.edges.length &&
        route.edges[segmentEndEdgeIndex + 1].type === "ride" &&
        route.edges[segmentEndEdgeIndex + 1].line === lineId &&
        getRouteEdgeDirection(regionData, route.edges[segmentEndEdgeIndex + 1], destinationName) === direction
      ) {
        segmentEndEdgeIndex += 1;
      }

      const fromStation = route.stations[segmentStartNodeIndex];
      const toStation = route.stations[segmentEndEdgeIndex + 1];

      steps.push({
        type: "ride",
        lineId,
        lineName: regionData.lines[lineId].name,
        lineRegionId: regionData.lines[lineId].regionId || regionData.region?.id,
        colorLineId: regionData.lines[lineId].originalId || lineId,
        direction,
        from: fromStation.displayName || fromStation.name,
        to: toStation.displayName || toStation.name
      });
      cursor = segmentEndEdgeIndex + 1;
    }

    return steps;
  }

  return {
    dijkstra,
    getDirection,
    createGuideSteps
  };
})();
