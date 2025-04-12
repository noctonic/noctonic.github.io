// The original NocString ;)

// NocsString Rules:
//   No Extra Comments
//   Type: bool,int,float,string,{key:Type},Type[],Classname,Set<Type>
//   Parameters: (name: Type, optionalParam: Type=default)
//   Function: functionName(Parameters) -> Type
//   Constructor: ClassName(Parameters) -> ClassName
//   Method: <indent> .methodName(Parameters) -> Type
//   Return Value: -> | promise | yeild ReturnType

/*  NocString(graphlib.js):
 *    Node(index: int, label: string|null=null) -> Node
 *      .num_edges() -> int
 *      .get_edge(neighbor: int) -> Edge|null
 *      .add_edge(neighbor: int, weight: float) -> void
 *      .remove_edge(neighbor: int) -> void
 *      .get_edge_list() -> Edge[]
 *      .get_sorted_edge_list() -> Edge[]
 *    Edge(from_node: int, to_node: int, weight: float=1.0) -> Edge
 *    Graph(num_nodes: int, undirected: bool=false) -> Graph
 *      .get_edge(from_node: int, to_node: int) -> Edge|null
 *      .is_edge(from_node: int, to_node: int) -> bool
 *      .make_edge_list() -> Edge[]
 *      .insert_edge(from_node: int, to_node: int, weight: float) -> void
 *      .remove_edge(from_node: int, to_node: int) -> void
 *      .insert_node(label: string|null=null) -> Node
 *      .make_copy() -> Graph
 *    GraphMatrix(numNodes: int, undirected: bool=false) -> GraphMatrix
 *      .get_edge(fromNode: int, toNode: int) -> float
 *      .set_edge(fromNode: int, toNode: int, weight: float) -> void
 *    generateGridGraph(n: int,undirected: bool=false) -> Graph
 *    generateGridGraphWithObstacles(n: int, num_obstacles: int,undirected: bool=false) -> { graph: Graph, obstacles: Set<string> }
 *    UnionFind(size: int) -> UnionFind
 *      .find(x: int) -> int
 *      .areDisjoint(a: int, b: int) -> bool
 *      .unionSets(a: int, b: int) -> void
 *    randomizedKruskals(g: Graph) -> Edge[]
 *    findPathWithGenerator(generatorFn: function, graph: Graph, startNode: int, isTarget: function) -> int[]|null
 *    reconstructPath(parentMap: {int:int}, start: int, end: int) -> int[]|null
 *    dfsGen(graph: Graph, startNode: int=0) -> yield { current:int, visited:int[], parent:{int:int} }
 *    bfsGen(graph: Graph, startNode: int=0) -> yield { current:int, visited:int[], parent:{int:int} }
 *    iddfsGen(graph: Graph, startNode: int=0, maxDepth: float=Infinity) -> yield { current:int, visited:int[], parent:{int:int} }
 *    dijkstraGen(graph: Graph, startNode: int=0) -> yield { current:int, visited:int[], parent:{int:int} }
 *    randomizedDfsGen(graph: Graph, startNode: int=0) -> yield { current:int, visited:int[], parent:{int:int} }
 */

class Node {
  constructor(index, label = null) {
    this.index = index;
    this.label = label;
    this.edges = {};
  }

  num_edges() {
    return Object.keys(this.edges).length;
  }

  get_edge(neighbor) {
    return this.edges[neighbor] ?? null;
  }

  add_edge(neighbor, weight) {
    this.edges[neighbor] = new Edge(this.index, neighbor, weight);
  }

  remove_edge(neighbor) {
    if (this.edges.hasOwnProperty(neighbor)) {
      delete this.edges[neighbor];
    }
  }

  get_edge_list() {
    return Object.values(this.edges);
  }

  get_sorted_edge_list() {
    return Object.keys(this.edges)
      .map(k => parseInt(k, 10))
      .sort((a, b) => a - b)
      .map(nbr => this.edges[nbr]);
  }
}


class Edge {
  constructor(from_node, to_node, weight = 1.0) {
    this.from_node = from_node;
    this.to_node = to_node;
    this.weight = weight;
  }
}

class Graph {
  constructor(num_nodes, undirected = false) {
    this.num_nodes = num_nodes;
    this.undirected = undirected;
    this.nodes = [];
    for (let i = 0; i < num_nodes; i++) {
      this.nodes.push(new Node(i));
    }
  }

  get_edge(from_node, to_node) {
    this._check_bounds(from_node, to_node);
    return this.nodes[from_node].get_edge(to_node);
  }

  is_edge(from_node, to_node) {
    return this.get_edge(from_node, to_node) !== null;
  }

  make_edge_list() {
    const all_edges = [];
    for (const node of this.nodes) {
      for (const edge of Object.values(node.edges)) {
        all_edges.push(edge);
      }
    }
    return all_edges;
  }

  insert_edge(from_node, to_node, weight) {
    this._check_bounds(from_node, to_node);
    this.nodes[from_node].add_edge(to_node, weight);
    if (this.undirected) {
      this.nodes[to_node].add_edge(from_node, weight);
    }
  }

  remove_edge(from_node, to_node) {
    this._check_bounds(from_node, to_node);
    this.nodes[from_node].remove_edge(to_node);
    if (this.undirected) {
      this.nodes[to_node].remove_edge(from_node);
    }
  }

  insert_node(label = null) {
    const new_node = new Node(this.num_nodes, label);
    this.nodes.push(new_node);
    this.num_nodes += 1;
    return new_node;
  }

  make_copy() {
    const g2 = new Graph(this.num_nodes, this.undirected);

    for (const node of this.nodes) {
      g2.nodes[node.index].label = node.label;
    }

    for (const node of this.nodes) {
      for (const edge of Object.values(node.edges)) {
        g2.insert_edge(edge.from_node, edge.to_node, edge.weight);
      }
    }

    return g2;
  }

  _check_bounds(from_node, to_node) {
    if (
      from_node < 0 ||
      from_node >= this.num_nodes ||
      to_node < 0 ||
      to_node >= this.num_nodes
    ) {
      throw new RangeError("Node index out of range");
    }
  }
}

class GraphMatrix {

  constructor(numNodes, undirected = false) {
    this.numNodes = numNodes;
    this.undirected = undirected;
    this.connections = Array.from({ length: numNodes }, () =>
      Array(numNodes).fill(0.0)
    );
  }
  _checkBounds(nodeIndex) {
    if (nodeIndex < 0 || nodeIndex >= this.numNodes) {
      throw new RangeError("Node index out of range");
    }
  }

  get_edge(fromNode, toNode) {
    this._checkBounds(fromNode);
    this._checkBounds(toNode);
    return this.connections[fromNode][toNode];
  }

  set_edge(fromNode, toNode, weight) {
    this._checkBounds(fromNode);
    this._checkBounds(toNode);
    this.connections[fromNode][toNode] = weight;

    if (this.undirected) {
      this.connections[toNode][fromNode] = weight;
    }
  }
}

function generateGridGraph(n,undirected = false) {
  const totalNodes = n * n;
  const g = new Graph(totalNodes,undirected);

  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const nodeIndex = row * n + col;

      if (col < n - 1) {
        const rightIndex = row * n + (col + 1);
        g.insert_edge(nodeIndex, rightIndex, 1);
      }

      if (row < n - 1) {
        const downIndex = (row + 1) * n + col;
        g.insert_edge(nodeIndex, downIndex, 1);
      }
    }
  }

  return g;
}

function generateGridGraphWithObstacles(n, num_obstacles,undirected = false) {
  const obstacles = new Set();
  const totalCells = n * n;
  const maxObstacles = Math.min(num_obstacles, totalCells);

  while (obstacles.size < maxObstacles) {
    const r = Math.floor(Math.random() * n);
    const c = Math.floor(Math.random() * n);
    obstacles.add(`${r},${c}`);
  }

  const g = new Graph(totalCells,undirected);
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const cellKey = `${row},${col}`;
      if (!obstacles.has(cellKey)) {
        const nodeIndex = row * n + col;

        if (col < n - 1) {
          const rightKey = `${row},${col + 1}`;
          if (!obstacles.has(rightKey)) {
            g.insert_edge(nodeIndex, nodeIndex + 1, 1);
          }
        }

        if (row < n - 1) {
          const downKey = `${row + 1},${col}`;
          if (!obstacles.has(downKey)) {
            g.insert_edge(nodeIndex, nodeIndex + n, 1);
          }
        }
      }
    }
  }
  return { graph: g, obstacles };
}

class UnionFind {
  constructor(size) {
    this.parent = new Array(size);
    this.rank = new Array(size).fill(0);
    this.numDisjointSets = size;

    for (let i = 0; i < size; i++) {
      this.parent[i] = i;
    }
  }

  find(x) {
    if (this.parent[x] !== x) {
      this.parent[x] = this.find(this.parent[x]);
    }
    return this.parent[x];
  }

  areDisjoint(a, b) {
    return this.find(a) !== this.find(b);
  }

  unionSets(a, b) {
    let rootA = this.find(a);
    let rootB = this.find(b);

    if (rootA !== rootB) {
      if (this.rank[rootA] > this.rank[rootB]) {
        this.parent[rootB] = rootA;
      } else if (this.rank[rootA] < this.rank[rootB]) {
        this.parent[rootA] = rootB;
      } else {
        this.parent[rootB] = rootA;
        this.rank[rootA]++;
      }
      this.numDisjointSets--;
    }
  }
}
function randomizedKruskals(g) {
  const djs = new UnionFind(g.num_nodes);
  const rkEdges = [];
  let allEdges = g.make_edge_list();
  allEdges = allEdges.filter(e => e.to_node > e.from_node);

  while (djs.numDisjointSets > 1 && allEdges.length > 0) {
    const numEdges = allEdges.length;
    const edgeInd = Math.floor(Math.random() * numEdges);
    const [newEdge] = allEdges.splice(edgeInd, 1);
    if (djs.areDisjoint(newEdge.to_node, newEdge.from_node)) {
      djs.unionSets(newEdge.to_node, newEdge.from_node);
      rkEdges.push(newEdge);
    }
  }

  return rkEdges;
}

function findPathWithGenerator(generatorFn, graph, startNode, isTarget) {
  
  const gen = generatorFn(graph, startNode);

  while (true) {
    const { value, done } = gen.next();
    if (done) {
      return null;
    }

    const { current, parent } = value;

    if (isTarget(current, parent)) {
      return reconstructPath(parent, startNode, current);
    }
  }
}

function reconstructPath(parentMap, start, end) {
  const path = [];
  let cur = end;
  while (cur !== undefined && cur !== start) {
    path.push(cur);
    cur = parentMap[cur];
  }
  if (cur === start) {
    path.push(start);
    path.reverse();
    return path;
  }
  return null;
}

function* dfsGen(graph, startNode = 0) {
  const visited = new Set();
  const stack = [startNode];
  const parent = {};

  while (stack.length > 0) {
    const current = stack.pop();

    if (!visited.has(current)) {
      visited.add(current);

      yield {
        current,
        visited: Array.from(visited),
        parent: { ...parent }
      };

      const edges = graph.nodes[current].get_edge_list();
      for (const edge of edges) {
        const neighbor = edge.to_node;
        if (!visited.has(neighbor)) {
          parent[neighbor] = current;
          stack.push(neighbor);
        }
      }
    }
  }
}

function* bfsGen(graph, startNode = 0) {
  const visited = new Set();
  const queue = [startNode];
  const parent = {};

  while (queue.length > 0) {
    const current = queue.shift();

    if (!visited.has(current)) {
      visited.add(current);

      yield {
        current,
        visited: Array.from(visited),
        parent: { ...parent },
      };

      const edges = graph.nodes[current].get_edge_list();
      for (const edge of edges) {
        const neighbor = edge.to_node;
        if (!visited.has(neighbor)) {
          parent[neighbor] = current;
          queue.push(neighbor);
        }
      }
    }
  }
}

function* iddfsGen(graph, startNode = 0, maxDepth = Infinity) {
  function* dls(node, depth, limit, visited, parent) {
    visited.add(node);
    yield {
      current: node,
      visited: Array.from(visited),
      parent: { ...parent },
    };

    if (depth === limit) {
      return;
    }

    const edges = graph.nodes[node].get_edge_list();
    for (const edge of edges) {
      const neighbor = edge.to_node;
      if (!visited.has(neighbor)) {
        parent[neighbor] = node;
        yield* dls(neighbor, depth + 1, limit, visited, parent);
      }
    }
  }

  for (let limit = 0; limit <= maxDepth; limit++) {
    const visited = new Set();
    const parent = {};
    yield* dls(startNode, 0, limit, visited, parent);
  }
}

function* dijkstraGen(graph, startNode = 0) {
  const distances = {};
  const visited = new Set();
  const parent = {};

  for (let i = 0; i < graph.nodes.length; i++) {
    distances[i] = Infinity;
  }
  distances[startNode] = 0;

  const pq = [startNode];

  while (pq.length > 0) {
    let minIndex = 0;
    for (let i = 1; i < pq.length; i++) {
      if (distances[pq[i]] < distances[pq[minIndex]]) {
        minIndex = i;
      }
    }
    const current = pq.splice(minIndex, 1)[0];

    if (!visited.has(current)) {
      visited.add(current);

      yield {
        current,
        visited: Array.from(visited),
        parent: { ...parent }
      };

      const edges = graph.nodes[current].get_edge_list();
      for (const edge of edges) {
        const { to_node: neighbor, weight } = edge;
        const newDist = distances[current] + weight;

        if (newDist < distances[neighbor]) {
          distances[neighbor] = newDist;
          parent[neighbor] = current;

          if (!visited.has(neighbor)) {
            pq.push(neighbor);
          }
        }
      }
    }
  }
}

function* randomizedDfsGen(graph, startNode = 0) {
  const visited = new Set();
  const stack = [startNode];
  const parent = {};

  while (stack.length > 0) {
    const current = stack.pop();

    if (!visited.has(current)) {
      visited.add(current);

      yield {
        current,
        visited: Array.from(visited),
        parent: { ...parent }
      };

      const edges = graph.nodes[current].get_edge_list();
      const shuffledNeighbors = edges
        .map(e => e.to_node)
        .sort(() => Math.random() - 0.5);

      for (const neighbor of shuffledNeighbors) {
        if (!visited.has(neighbor)) {
          parent[neighbor] = current;
          stack.push(neighbor);
        }
      }
    }
  }
}
