import type { Problem } from './types';

const range = (n: number, f: (i: number) => number) => Array.from({ length: n }, (_, i) => f(i));
const grid = (rows: number, cols: number, cell: (r: number, c: number) => string) =>
  Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => cell(r, c)));

export const problems: Problem[] = [
  {
    id: 'two-sum',
    title: 'Two Sum',
    difficulty: 'easy',
    description:
      'Given an array of integers `nums` and an integer `target`, return the indices of the two numbers that add up to `target`.\n\n' +
      'Exactly one valid pair exists, and you may not use the same element twice. Return the two indices in increasing order.',
    constraints: ['2 ≤ nums.length ≤ 10⁴', '-10⁹ ≤ nums[i], target ≤ 10⁹', 'Exactly one answer exists'],
    functionName: 'twoSum',
    params: ['nums', 'target'],
    examples: [
      { args: [[2, 7, 11, 15], 9], expected: [0, 1] },
      { args: [[3, 2, 4], 6], expected: [1, 2] },
      { args: [[3, 3], 6], expected: [0, 1] },
    ],
    hiddenTests: [
      { args: [[1, 5, 9, 13], 22], expected: [2, 3] },
      { args: [[-3, 4, 3, 90], 0], expected: [0, 2] },
      { args: [[0, 4, 3, 0], 0], expected: [0, 3] },
      { args: [[1, 2], 3], expected: [0, 1] },
      { args: [[5, 75, 25], 100], expected: [1, 2] },
      { args: [range(10_000, (i) => i), 19_997], expected: [9_998, 9_999] },
    ],
  },
  {
    id: 'binary-search',
    title: 'Binary Search',
    difficulty: 'easy',
    description:
      'Given an array of distinct integers `nums` sorted in ascending order and an integer `target`, return the index of `target`, or `-1` if it is not in the array.\n\n' +
      'Aim for O(log n) time.',
    constraints: ['0 ≤ nums.length ≤ 10⁵', 'All values in nums are distinct', 'nums is sorted ascending'],
    functionName: 'search',
    params: ['nums', 'target'],
    examples: [
      { args: [[-1, 0, 3, 5, 9, 12], 9], expected: 4 },
      { args: [[-1, 0, 3, 5, 9, 12], 2], expected: -1 },
    ],
    hiddenTests: [
      { args: [[5], 5], expected: 0 },
      { args: [[5], -5], expected: -1 },
      { args: [[], 1], expected: -1 },
      { args: [[1, 2, 3, 4, 5], 1], expected: 0 },
      { args: [[1, 2, 3, 4, 5], 5], expected: 4 },
      { args: [[2, 4, 6, 8, 10, 12, 14], 7], expected: -1 },
      { args: [range(100_000, (i) => i * 2), 123_456], expected: 61_728 },
    ],
  },
  {
    id: 'valid-parentheses',
    title: 'Valid Parentheses',
    difficulty: 'easy',
    description:
      'Given a string `s` containing only the characters `()[]{}`, return `true` if every bracket is closed by the same type of bracket in the correct order, otherwise `false`.\n\n' +
      'An empty string is valid.',
    constraints: ['0 ≤ s.length ≤ 10⁴', 's contains only ()[]{}'],
    functionName: 'isValid',
    params: ['s'],
    examples: [
      { args: ['()'], expected: true },
      { args: ['()[]{}'], expected: true },
      { args: ['(]'], expected: false },
    ],
    hiddenTests: [
      { args: ['([)]'], expected: false },
      { args: ['{[]}'], expected: true },
      { args: [''], expected: true },
      { args: ['(('], expected: false },
      { args: ['))'], expected: false },
      { args: [']'], expected: false },
      { args: ['([]{[]})'], expected: true },
      { args: ['('.repeat(5_000) + ')'.repeat(5_000)], expected: true },
    ],
  },
  {
    id: 'valid-palindrome',
    title: 'Valid Palindrome',
    difficulty: 'easy',
    description:
      'A phrase is a palindrome if, after converting all letters to lowercase and removing every character that is not a letter or digit, it reads the same forwards and backwards.\n\n' +
      'Given a string `s`, return `true` if it is a palindrome, otherwise `false`.',
    constraints: ['1 ≤ s.length ≤ 2·10⁵', 's consists of printable ASCII characters'],
    functionName: 'isPalindrome',
    params: ['s'],
    examples: [
      { args: ['A man, a plan, a canal: Panama'], expected: true },
      { args: ['race a car'], expected: false },
      { args: [' '], expected: true },
    ],
    hiddenTests: [
      { args: ['0P'], expected: false },
      { args: ['ab_a'], expected: true },
      { args: ['Was it a car or a cat I saw?'], expected: true },
      { args: ["No 'x' in Nixon"], expected: true },
      { args: ['abc'], expected: false },
      { args: ['a.'], expected: true },
    ],
  },
  {
    id: 'climbing-stairs',
    title: 'Climbing Stairs',
    difficulty: 'easy',
    description:
      'You are climbing a staircase with `n` steps. Each move you climb either 1 or 2 steps.\n\n' +
      'Return the number of distinct ways to reach the top. (Plain recursion will be too slow for the bigger inputs.)',
    constraints: ['1 ≤ n ≤ 45'],
    functionName: 'climbStairs',
    params: ['n'],
    examples: [
      { args: [2], expected: 2 },
      { args: [3], expected: 3 },
    ],
    hiddenTests: [
      { args: [1], expected: 1 },
      { args: [4], expected: 5 },
      { args: [5], expected: 8 },
      { args: [10], expected: 89 },
      { args: [20], expected: 10_946 },
      { args: [45], expected: 1_836_311_903 },
    ],
  },
  {
    id: 'maximum-subarray',
    title: 'Maximum Subarray',
    difficulty: 'medium',
    description:
      'Given an integer array `nums`, find the contiguous non-empty subarray with the largest sum and return that sum.',
    constraints: ['1 ≤ nums.length ≤ 10⁵', '-10⁴ ≤ nums[i] ≤ 10⁴'],
    functionName: 'maxSubArray',
    params: ['nums'],
    examples: [
      { args: [[-2, 1, -3, 4, -1, 2, 1, -5, 4]], expected: 6 },
      { args: [[1]], expected: 1 },
      { args: [[5, 4, -1, 7, 8]], expected: 23 },
    ],
    hiddenTests: [
      { args: [[-1]], expected: -1 },
      { args: [[-3, -2, -5]], expected: -2 },
      { args: [[1, 2, 3]], expected: 6 },
      { args: [[0, -1, 0]], expected: 0 },
      { args: [[8, -19, 5, -4, 20]], expected: 21 },
      { args: [[-2, -1]], expected: -1 },
      { args: [range(100_000, () => 1)], expected: 100_000 },
    ],
  },
  {
    id: 'longest-substring',
    title: 'Longest Substring Without Repeats',
    difficulty: 'medium',
    description: 'Given a string `s`, return the length of the longest substring that contains no repeated characters.',
    constraints: ['0 ≤ s.length ≤ 5·10⁴', 's consists of letters, digits, symbols and spaces'],
    functionName: 'lengthOfLongestSubstring',
    params: ['s'],
    examples: [
      { args: ['abcabcbb'], expected: 3 },
      { args: ['bbbbb'], expected: 1 },
      { args: ['pwwkew'], expected: 3 },
    ],
    hiddenTests: [
      { args: [''], expected: 0 },
      { args: [' '], expected: 1 },
      { args: ['au'], expected: 2 },
      { args: ['dvdf'], expected: 3 },
      { args: ['abba'], expected: 2 },
      { args: ['tmmzuxt'], expected: 5 },
      { args: ['abcdefghijklmnopqrstuvwxyz'.repeat(400)], expected: 26 },
    ],
  },
  {
    id: 'product-except-self',
    title: 'Product of Array Except Self',
    difficulty: 'medium',
    description:
      'Given an integer array `nums`, return an array `answer` where `answer[i]` is the product of every element of `nums` except `nums[i]`.\n\n' +
      'Solve it in O(n) time without using division.',
    constraints: ['2 ≤ nums.length ≤ 10⁵', '-30 ≤ nums[i] ≤ 30'],
    functionName: 'productExceptSelf',
    params: ['nums'],
    examples: [
      { args: [[1, 2, 3, 4]], expected: [24, 12, 8, 6] },
      { args: [[-1, 1, 0, -3, 3]], expected: [0, 0, 9, 0, 0] },
    ],
    hiddenTests: [
      { args: [[2, 3]], expected: [3, 2] },
      { args: [[0, 0]], expected: [0, 0] },
      { args: [[1, 0]], expected: [0, 1] },
      { args: [[5, 1, 1]], expected: [1, 5, 5] },
      { args: [[-1, -2, -3]], expected: [6, 3, 2] },
      { args: [[2, 2, 2, 2]], expected: [8, 8, 8, 8] },
    ],
  },
  {
    id: 'merge-intervals',
    title: 'Merge Intervals',
    difficulty: 'medium',
    description:
      'Given an array of `intervals` where `intervals[i] = [start, end]`, merge every overlapping interval and return the result sorted by start.\n\n' +
      'Intervals that only touch (like `[1,4]` and `[4,5]`) count as overlapping.',
    constraints: ['1 ≤ intervals.length ≤ 10⁴', '0 ≤ start ≤ end ≤ 10⁴'],
    functionName: 'merge',
    params: ['intervals'],
    examples: [
      { args: [[[1, 3], [2, 6], [8, 10], [15, 18]]], expected: [[1, 6], [8, 10], [15, 18]] },
      { args: [[[1, 4], [4, 5]]], expected: [[1, 5]] },
    ],
    hiddenTests: [
      { args: [[[1, 4], [0, 4]]], expected: [[0, 4]] },
      { args: [[[1, 4], [2, 3]]], expected: [[1, 4]] },
      { args: [[[5, 6]]], expected: [[5, 6]] },
      { args: [[[1, 4], [0, 0]]], expected: [[0, 0], [1, 4]] },
      { args: [[[2, 3], [4, 5], [6, 7], [8, 9], [1, 10]]], expected: [[1, 10]] },
      { args: [[[1, 3], [5, 7], [9, 11]]], expected: [[1, 3], [5, 7], [9, 11]] },
    ],
  },
  {
    id: 'number-of-islands',
    title: 'Number of Islands',
    difficulty: 'medium',
    description:
      'Given a 2D grid of `"1"` (land) and `"0"` (water), return the number of islands.\n\n' +
      'An island is a group of land cells connected horizontally or vertically (not diagonally).',
    constraints: ['1 ≤ rows, cols ≤ 60', 'grid[r][c] is "0" or "1"'],
    functionName: 'numIslands',
    params: ['grid'],
    examples: [
      {
        args: [
          [
            ['1', '1', '1', '1', '0'],
            ['1', '1', '0', '1', '0'],
            ['1', '1', '0', '0', '0'],
            ['0', '0', '0', '0', '0'],
          ],
        ],
        expected: 1,
      },
      {
        args: [
          [
            ['1', '1', '0', '0', '0'],
            ['1', '1', '0', '0', '0'],
            ['0', '0', '1', '0', '0'],
            ['0', '0', '0', '1', '1'],
          ],
        ],
        expected: 3,
      },
    ],
    hiddenTests: [
      { args: [[['0']]], expected: 0 },
      { args: [[['1']]], expected: 1 },
      { args: [[['1', '0', '1'], ['0', '1', '0'], ['1', '0', '1']]], expected: 5 },
      { args: [[['1', '1', '1'], ['0', '1', '0'], ['1', '1', '1']]], expected: 1 },
      { args: [[['1', '0', '1', '0', '1']]], expected: 3 },
      { args: [grid(60, 60, () => '1')], expected: 1 },
      { args: [grid(50, 50, (r, c) => ((r + c) % 2 === 0 ? '1' : '0'))], expected: 1_250 },
    ],
  },
];
