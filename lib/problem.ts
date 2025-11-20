// lib/problem.ts
export const PROBLEM = `let l = 0;
let r = arr.length - 1;

while (l <= r) {
  const m = l + ((r - l) >>> 1);
  
  if (arr[m] === target) return m;
  
  if (arr[m] < target) {
    l = m + 1;
  } else {
    r = m - 1;
  }
}

return -1;`;