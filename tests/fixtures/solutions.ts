// Known-good solutions. If one of these fails, the problem's test data is wrong.
export const referenceSolutions: Record<string, string> = {
  'two-sum': `function twoSum(nums, target) {
    const seen = new Map();
    for (let i = 0; i < nums.length; i++) {
      if (seen.has(target - nums[i])) return [seen.get(target - nums[i]), i];
      seen.set(nums[i], i);
    }
  }`,
  'binary-search': `function search(nums, target) {
    let lo = 0, hi = nums.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (nums[mid] === target) return mid;
      if (nums[mid] < target) lo = mid + 1; else hi = mid - 1;
    }
    return -1;
  }`,
  'valid-parentheses': `function isValid(s) {
    const pairs = { ')': '(', ']': '[', '}': '{' };
    const stack = [];
    for (const ch of s) {
      if (pairs[ch]) { if (stack.pop() !== pairs[ch]) return false; }
      else stack.push(ch);
    }
    return stack.length === 0;
  }`,
  'valid-palindrome': `function isPalindrome(s) {
    const t = s.toLowerCase().replace(/[^a-z0-9]/g, '');
    return t === [...t].reverse().join('');
  }`,
  'climbing-stairs': `function climbStairs(n) {
    let a = 1, b = 1;
    for (let i = 0; i < n; i++) [a, b] = [b, a + b];
    return a;
  }`,
  'maximum-subarray': `function maxSubArray(nums) {
    let best = nums[0], cur = 0;
    for (const n of nums) { cur = Math.max(n, cur + n); best = Math.max(best, cur); }
    return best;
  }`,
  'longest-substring': `function lengthOfLongestSubstring(s) {
    const last = new Map(); let start = 0, best = 0;
    for (let i = 0; i < s.length; i++) {
      if (last.has(s[i]) && last.get(s[i]) >= start) start = last.get(s[i]) + 1;
      last.set(s[i], i); best = Math.max(best, i - start + 1);
    }
    return best;
  }`,
  'product-except-self': `function productExceptSelf(nums) {
    const out = new Array(nums.length).fill(1);
    let left = 1, right = 1;
    for (let i = 0; i < nums.length; i++) { out[i] *= left; left *= nums[i]; }
    for (let i = nums.length - 1; i >= 0; i--) { out[i] *= right; right *= nums[i]; }
    return out;
  }`,
  'merge-intervals': `function merge(intervals) {
    const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
    const out = [];
    for (const [s, e] of sorted) {
      if (out.length && s <= out[out.length - 1][1]) out[out.length - 1][1] = Math.max(out[out.length - 1][1], e);
      else out.push([s, e]);
    }
    return out;
  }`,
  'number-of-islands': `function numIslands(grid) {
    let count = 0;
    const sink = (r, c) => {
      const stack = [[r, c]];
      while (stack.length) {
        const [i, j] = stack.pop();
        if (i < 0 || j < 0 || i >= grid.length || j >= grid[0].length || grid[i][j] !== '1') continue;
        grid[i][j] = '0';
        stack.push([i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]);
      }
    };
    for (let r = 0; r < grid.length; r++)
      for (let c = 0; c < grid[0].length; c++)
        if (grid[r][c] === '1') { count++; sink(r, c); }
    return count;
  }`,
};
