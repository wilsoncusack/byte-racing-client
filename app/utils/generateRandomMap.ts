type Cell = 0 | 1 | -1;

function generateRandomMap(
  width: number,
  height: number,
  wallProbability: number = 0.3,
): Cell[][] {
  // Initialize the map with open spaces
  const map: Cell[][] = Array(height)
    .fill(null)
    .map(() => Array(width).fill(0));

  // Place walls randomly
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (Math.random() < wallProbability) {
        map[y][x] = 1;
      }
    }
  }

  // Ensure start (top-left) is open and finish (bottom-right) is set to -1
  map[0][0] = 0;
  map[height - 1][width - 1] = -1;

  // Ensure there's a path from start to finish
  const visited: boolean[][] = Array(height)
    .fill(null)
    .map(() => Array(width).fill(false));
  const stack: [number, number][] = [[0, 0]];

  while (stack.length > 0) {
    const [x, y] = stack.pop()!;
    if (x === width - 1 && y === height - 1) break;

    if (!visited[y][x]) {
      visited[y][x] = true;
      const neighbors = [
        [x + 1, y],
        [x, y + 1],
        [x - 1, y],
        [x, y - 1],
      ].filter(([nx, ny]) => nx >= 0 && nx < width && ny >= 0 && ny < height);

      for (const [nx, ny] of neighbors) {
        if (!visited[ny][nx]) {
          stack.push([nx, ny]);
          if (map[ny][nx] === 1) {
            // Only clear walls with 50% probability
            if (Math.random() < 0.5) {
              map[ny][nx] = 0;
            }
          }
        }
      }
    }
  }

  // Ensure the finish is still -1 (it might have been changed during path creation)
  map[height - 1][width - 1] = -1;

  console.log("map", map);
  return map;
}

export default generateRandomMap;
