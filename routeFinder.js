const RouteFinder = (() => {
  function buildGraph(regionData) {
    const graph = new Map();
    const stationsById = new Map(regionData.stations.map((station) => [station.id, station]));

    stationsById.forEach((_, id) => graph.set(id, []));

    const addEdge = (from, to, edge) => {
      if (!graph.has(from)) {
        graph.set(from, []);
      }
      graph.get(from).push({ ...edge, from, to });
    };

    [...regionData.rideEdges, ...regionData.transferEdges].forEach((edge) => {
      addEdge(edge.from, edge.to, edge);
      if (edge.bidirectional) {
        addEdge(edge.to, edge.from, edge);
      }
    });

    return { graph, stationsById };
  }

  function getEdgeDistance(edge) {
    if (typeof edge.distanceKm === "number") {
      return edge.distanceKm;
    }

    if (edge.type === "ride") {
      throw new Error(`${edge.from} → ${edge.to} 구간의 distanceKm 값이 없습니다.`);
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

  function dijkstra(regionData, startStationName, endStationName, mode) {
    const { graph, stationsById } = buildGraph(regionData);
    const startIds = regionData.stations.filter((station) => station.name === startStationName).map((station) => station.id);
    const endIds = new Set(regionData.stations.filter((station) => station.name === endStationName).map((station) => station.id));
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
        return buildRoute(current.id, previous, stationsById);
      }

      (graph.get(current.id) || []).forEach((edge) => {
        const nextCost = {
          distance: current.cost.distance + getEdgeDistance(edge),
          transfers: current.cost.transfers + getEdgeTransfers(edge)
        };
        const oldCost = costs.get(edge.to);

        if (!oldCost || compareCost(nextCost, oldCost, mode) < 0) {
          costs.set(edge.to, nextCost);
          previous.set(edge.to, { from: current.id, edge });
          queue.push({ id: edge.to, cost: nextCost });
        }
      });
    }

    return null;
  }

  function buildRoute(endId, previous, stationsById) {
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
      stations: nodeIds.map((id) => stationsById.get(id))
    };
  }

  function getDirection(regionData, lineId, fromStationName, toStationName) {
    const line = regionData.lines[lineId];
    const fromIndex = line.stations.indexOf(fromStationName);
    const toIndex = line.stations.indexOf(toStationName);

    if (fromIndex < 0 || toIndex < 0) {
      return "";
    }

    return fromIndex < toIndex ? line.terminals.forward : line.terminals.reverse;
  }

  function createGuideSteps(regionData, route) {
    const steps = [];
    const rideEdges = route.edges.map((edge, index) => ({ edge, index })).filter((item) => item.edge.type === "ride");
    let cursor = 0;

    while (cursor < rideEdges.length) {
      const lineId = rideEdges[cursor].edge.line;
      const segmentStartNodeIndex = rideEdges[cursor].index;
      let segmentEndRide = rideEdges[cursor];

      while (cursor + 1 < rideEdges.length && rideEdges[cursor + 1].edge.line === lineId) {
        cursor += 1;
        segmentEndRide = rideEdges[cursor];
      }

      const fromStation = route.stations[segmentStartNodeIndex];
      const toStation = route.stations[segmentEndRide.index + 1];
      const direction = getDirection(regionData, lineId, fromStation.name, toStation.name);

      steps.push({
        type: "ride",
        lineName: regionData.lines[lineId].name,
        direction,
        from: fromStation.name,
        to: toStation.name
      });

      const nextEdge = route.edges[segmentEndRide.index + 1];
      const nextRide = rideEdges[cursor + 1];
      if (nextEdge?.type === "transfer" && nextRide) {
        steps.push({
          type: "transfer",
          station: toStation.name,
          nextLineName: regionData.lines[nextRide.edge.line].name,
          nextDirection: getDirection(
            regionData,
            nextRide.edge.line,
            route.stations[nextRide.index].name,
            route.stations[nextRide.index + 1].name
          )
        });
      }

      cursor += 1;
    }

    return steps;
  }

  return {
    dijkstra,
    getDirection,
    createGuideSteps
  };
})();
