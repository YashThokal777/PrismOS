/* Arena problem set. Each row:
   [id, title, topic, difficulty 1-3, function name, parameters, description (markdown), hint 1, hint 2, reference solution, tests (argument lists), compare mode]
   Expected answers are not stored: the reference solution is run next to yours on the same inputs.
   Compare mode: '' exact, 'set' any order, 'set2' any order of lists whose items may be in any order. */
globalThis.PRISM_PROBLEMS = [
['two-sum', 'Two Sum', 'Arrays', 1, 'twoSum', 'nums, target',
 'Return the indexes of the two numbers in `nums` that add up to `target`, smaller index first. Exactly one pair exists.\n\n`twoSum([2, 7, 11, 15], 9)` returns `[0, 1]`.',
 'For each number you already know which partner you need: target minus the number.',
 'Walk once, keeping a Map from value to index. Before storing a number, check whether its partner is already in the Map.',
`function twoSum(nums, target) {
  const seen = new Map();
  for (let i = 0; i < nums.length; i++) {
    const j = seen.get(target - nums[i]);
    if (j !== undefined) return [j, i];
    seen.set(nums[i], i);
  }
  return [];
}`, [[[2, 7, 11, 15], 9], [[3, 2, 4], 6], [[3, 3], 6], [[1, 5, 9, 14, 20], 29], [[-3, 4, 3, 90], 0]]],

['max-subarray', 'Maximum Subarray', 'Arrays', 2, 'maxSubArray', 'nums',
 'Return the largest sum of any contiguous run of numbers in `nums` (at least one number).\n\n`maxSubArray([-2, 1, -3, 4, -1, 2, 1, -5, 4])` returns `6`, from `[4, -1, 2, 1]`.',
 'At each position, the best run ending here either extends the previous run or starts fresh.',
 'Keep two numbers: the best sum ending at the current index, and the best seen anywhere. run = max(x, run + x).',
`function maxSubArray(nums) {
  let best = nums[0], run = nums[0];
  for (let i = 1; i < nums.length; i++) {
    run = Math.max(nums[i], run + nums[i]);
    best = Math.max(best, run);
  }
  return best;
}`, [[[-2, 1, -3, 4, -1, 2, 1, -5, 4]], [[1]], [[5, 4, -1, 7, 8]], [[-3, -1, -2]], [[2, -1, 2, 3, -9, 4]]]],

['product-except-self', 'Product Except Self', 'Arrays', 2, 'productExceptSelf', 'nums',
 'Return an array where each item is the product of every other number in `nums`. Do it without division.\n\n`productExceptSelf([1, 2, 3, 4])` returns `[24, 12, 8, 6]`.',
 'The answer at i is (product of everything to the left) times (product of everything to the right).',
 'Fill the output with running left products in one pass, then multiply in running right products in a second pass from the end.',
`function productExceptSelf(nums) {
  const n = nums.length, out = new Array(n).fill(1);
  let p = 1;
  for (let i = 0; i < n; i++) { out[i] = p; p *= nums[i]; }
  p = 1;
  for (let i = n - 1; i >= 0; i--) { out[i] *= p; p *= nums[i]; }
  return out;
}`, [[[1, 2, 3, 4]], [[-1, 1, 0, -3, 3]], [[2, 3]], [[0, 0]], [[5, 1, 2, 10]]]],

['valid-anagram', 'Valid Anagram', 'Strings', 1, 'isAnagram', 's, t',
 'Return `true` if `t` uses exactly the same letters as `s`, the same number of times.\n\n`isAnagram("listen", "silent")` returns `true`.',
 'Different lengths can never be anagrams.',
 'Count the letters of s in an object, then subtract while walking t. Any letter that runs out means false.',
`function isAnagram(s, t) {
  if (s.length !== t.length) return false;
  const count = {};
  for (const ch of s) count[ch] = (count[ch] || 0) + 1;
  for (const ch of t) {
    if (!count[ch]) return false;
    count[ch]--;
  }
  return true;
}`, [['anagram', 'nagaram'], ['rat', 'car'], ['a', 'ab'], ['listen', 'silent'], ['aacc', 'ccac']]],

['longest-unique-substring', 'Longest Substring Without Repeats', 'Strings', 2, 'lengthOfLongestSubstring', 's',
 'Return the length of the longest stretch of `s` that has no repeated character.\n\n`lengthOfLongestSubstring("pwwkew")` returns `3`, from `"wke"`.',
 'Use a window with a left and right edge. Grow the right edge one character at a time.',
 'Remember the last index of every character. When the new character was last seen inside the window, move the left edge just past it.',
`function lengthOfLongestSubstring(s) {
  const last = new Map();
  let best = 0, start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (last.has(c) && last.get(c) >= start) start = last.get(c) + 1;
    last.set(c, i);
    best = Math.max(best, i - start + 1);
  }
  return best;
}`, [['abcabcbb'], ['bbbbb'], ['pwwkew'], [''], ['dvdf'], ['abba']]],

['first-unique-char', 'First Unique Character', 'Hashing', 1, 'firstUniqChar', 's',
 'Return the index of the first character that appears only once in `s`, or `-1` if there is none.\n\n`firstUniqChar("swiss")` returns `1`.',
 'You need to know how often each character appears before you can decide.',
 'Two passes: count every character, then return the first index whose count is 1.',
`function firstUniqChar(s) {
  const count = {};
  for (const ch of s) count[ch] = (count[ch] || 0) + 1;
  for (let i = 0; i < s.length; i++) if (count[s[i]] === 1) return i;
  return -1;
}`, [['prismos'], ['swiss'], ['aabb'], ['z'], ['abcabcd']]],

['longest-consecutive', 'Longest Consecutive Run', 'Hashing', 2, 'longestConsecutive', 'nums',
 'Return the length of the longest run of consecutive whole numbers that can be formed from `nums`, in any order. Aim for linear time.\n\n`longestConsecutive([100, 4, 200, 1, 3, 2])` returns `4`, from 1, 2, 3, 4.',
 'Sorting works but is slower than needed. A Set gives instant "is x here?" checks.',
 'Only start counting from numbers that have no left neighbour (x - 1 is not in the Set), then count upward.',
`function longestConsecutive(nums) {
  const set = new Set(nums);
  let best = 0;
  for (const x of set) {
    if (set.has(x - 1)) continue;
    let y = x;
    while (set.has(y + 1)) y++;
    best = Math.max(best, y - x + 1);
  }
  return best;
}`, [[[100, 4, 200, 1, 3, 2]], [[0, 3, 7, 2, 5, 8, 4, 6, 0, 1]], [[]], [[1, 2, 0, 1]], [[10, 30, 20]]]],

['valid-palindrome', 'Valid Palindrome', 'Two pointers', 1, 'isPalindrome', 's',
 'Return `true` if `s` reads the same both ways once you ignore case and everything that is not a letter or digit.\n\n`isPalindrome("A man, a plan, a canal: Panama")` returns `true`.',
 'Compare characters from both ends, moving inward.',
 'Lower-case the string and strip everything except a-z and 0-9, then walk two indexes toward the middle.',
`function isPalindrome(s) {
  const t = s.toLowerCase().replace(/[^a-z0-9]/g, '');
  let i = 0, j = t.length - 1;
  while (i < j) {
    if (t[i++] !== t[j--]) return false;
  }
  return true;
}`, [['A man, a plan, a canal: Panama'], ['race a car'], [' '], ['0P'], ['No lemon, no melon']]],

['container-most-water', 'Container With Most Water', 'Two pointers', 2, 'maxArea', 'height',
 'Each number is the height of a vertical line. Pick two lines so the container between them holds the most water, and return that area.\n\n`maxArea([1, 8, 6, 2, 5, 4, 8, 3, 7])` returns `49`.',
 'Start with the widest container: the first and last line.',
 'The shorter line limits the area, so moving the taller one inward can never help. Always move the shorter side.',
`function maxArea(height) {
  let i = 0, j = height.length - 1, best = 0;
  while (i < j) {
    best = Math.max(best, Math.min(height[i], height[j]) * (j - i));
    if (height[i] < height[j]) i++; else j--;
  }
  return best;
}`, [[[1, 8, 6, 2, 5, 4, 8, 3, 7]], [[1, 1]], [[4, 3, 2, 1, 4]], [[1, 2, 1]], [[2, 3, 10, 5, 7, 8, 9]]]],

['trapping-rain-water', 'Trapping Rain Water', 'Two pointers', 3, 'trap', 'height',
 'Each number is the height of a bar of width 1. Return how many units of rain the bars trap.\n\n`trap([0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1])` returns `6`.',
 'Water above a bar is limited by the tallest bar on its left and the tallest on its right.',
 'Walk inward from both ends, tracking the highest bar seen on each side. Always advance the lower side and add (side max - bar).',
`function trap(height) {
  let i = 0, j = height.length - 1, leftMax = 0, rightMax = 0, water = 0;
  while (i < j) {
    if (height[i] < height[j]) {
      leftMax = Math.max(leftMax, height[i]);
      water += leftMax - height[i];
      i++;
    } else {
      rightMax = Math.max(rightMax, height[j]);
      water += rightMax - height[j];
      j--;
    }
  }
  return water;
}`, [[[0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1]], [[4, 2, 0, 3, 2, 5]], [[]], [[3, 0, 3]], [[5, 4, 3, 2, 1]]]],

['valid-parentheses', 'Valid Parentheses', 'Stack', 1, 'isValid', 's',
 'Return `true` if every bracket in `s` is closed by the same kind of bracket in the right order. `s` only contains `()[]{}`.\n\n`isValid("{[]}")` returns `true`; `isValid("([)]")` returns `false`.',
 'The most recently opened bracket must be the first one closed.',
 'Push opening brackets on a stack. On a closing bracket, pop and check that it matches. The stack must be empty at the end.',
`function isValid(s) {
  const pair = { ')': '(', ']': '[', '}': '{' }, stack = [];
  for (const ch of s) {
    if (pair[ch]) {
      if (stack.pop() !== pair[ch]) return false;
    } else stack.push(ch);
  }
  return stack.length === 0;
}`, [['()'], ['()[]{}'], ['(]'], ['([)]'], ['{[]}'], ['((']]],

['daily-temperatures', 'Daily Temperatures', 'Stack', 2, 'dailyTemperatures', 'temps',
 'For each day, return how many days you wait until a warmer temperature. Use `0` if it never gets warmer.\n\n`dailyTemperatures([73, 74, 75, 71, 69, 72, 76, 73])` returns `[1, 1, 4, 2, 1, 1, 0, 0]`.',
 'Days still waiting for a warmer day can be kept in a stack.',
 'Keep a stack of indexes with falling temperatures. When today is warmer than the top, pop it and record the gap.',
`function dailyTemperatures(temps) {
  const out = new Array(temps.length).fill(0), stack = [];
  for (let i = 0; i < temps.length; i++) {
    while (stack.length && temps[stack[stack.length - 1]] < temps[i]) {
      const j = stack.pop();
      out[j] = i - j;
    }
    stack.push(i);
  }
  return out;
}`, [[[73, 74, 75, 71, 69, 72, 76, 73]], [[30, 40, 50, 60]], [[30, 60, 90]], [[90, 80, 70]], [[70, 70, 71]]]],

['binary-search', 'Binary Search', 'Binary search', 1, 'search', 'nums, target',
 '`nums` is sorted ascending. Return the index of `target`, or `-1` if it is not there. Aim for logarithmic time.\n\n`search([-1, 0, 3, 5, 9, 12], 9)` returns `4`.',
 'Look at the middle item and throw away the half that cannot contain the target.',
 'Keep lo and hi. While lo <= hi: mid = (lo + hi) >> 1. Move lo to mid + 1 or hi to mid - 1.',
`function search(nums, target) {
  let lo = 0, hi = nums.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (nums[mid] === target) return mid;
    if (nums[mid] < target) lo = mid + 1; else hi = mid - 1;
  }
  return -1;
}`, [[[-1, 0, 3, 5, 9, 12], 9], [[-1, 0, 3, 5, 9, 12], 2], [[5], 5], [[1, 3], 3], [[], 1]]],

['search-rotated', 'Search in Rotated Array', 'Binary search', 2, 'searchRotated', 'nums, target',
 'A sorted array of distinct numbers was rotated at some point, for example `[4, 5, 6, 7, 0, 1, 2]`. Return the index of `target` or `-1`, in logarithmic time.\n\n`searchRotated([4, 5, 6, 7, 0, 1, 2], 0)` returns `4`.',
 'Whatever the rotation, one half around the middle is always properly sorted.',
 'Find which half is sorted (compare nums[lo] with nums[mid]). If the target lies inside that half, search it; otherwise search the other half.',
`function searchRotated(nums, target) {
  let lo = 0, hi = nums.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (nums[mid] === target) return mid;
    if (nums[lo] <= nums[mid]) {
      if (nums[lo] <= target && target < nums[mid]) hi = mid - 1; else lo = mid + 1;
    } else {
      if (nums[mid] < target && target <= nums[hi]) lo = mid + 1; else hi = mid - 1;
    }
  }
  return -1;
}`, [[[4, 5, 6, 7, 0, 1, 2], 0], [[4, 5, 6, 7, 0, 1, 2], 3], [[1], 0], [[3, 1], 1], [[5, 1, 3], 5], [[6, 7, 1, 2, 3, 4, 5], 4]]],

['subsets', 'Subsets', 'Backtracking', 2, 'subsets', 'nums',
 'Return every subset of the distinct numbers in `nums`, including the empty one. Any order is accepted.\n\n`subsets([1, 2])` returns `[[], [1], [2], [1, 2]]`.',
 'Every number is either in a subset or not, so there are 2 to the power n answers.',
 'Start with [[]]. For each number, copy every subset you have so far and add the number to the copy.',
`function subsets(nums) {
  const out = [[]];
  for (const x of nums) {
    const n = out.length;
    for (let i = 0; i < n; i++) out.push([...out[i], x]);
  }
  return out;
}`, [[[1, 2, 3]], [[0]], [[]], [[4, 9]], [[1, 2, 3, 4]]], 'set2'],

['generate-parentheses', 'Generate Parentheses', 'Backtracking', 2, 'generateParenthesis', 'n',
 'Return every valid string made of `n` pairs of round brackets. Any order is accepted.\n\n`generateParenthesis(2)` returns `["(())", "()()"]`.',
 'Build the string one character at a time and never let it become invalid.',
 'Recurse with counts of open and close used. You may add "(" while open < n, and ")" while close < open.',
`function generateParenthesis(n) {
  const out = [];
  const go = (s, open, close) => {
    if (s.length === 2 * n) { out.push(s); return; }
    if (open < n) go(s + '(', open + 1, close);
    if (close < open) go(s + ')', open, close + 1);
  };
  go('', 0, 0);
  return out;
}`, [[1], [2], [3], [4]], 'set'],

['climbing-stairs', 'Climbing Stairs', 'Dynamic programming', 1, 'climbStairs', 'n',
 'You climb `n` steps, taking 1 or 2 steps at a time. Return how many different ways there are.\n\n`climbStairs(3)` returns `3`.',
 'To land on step n you came from step n - 1 or step n - 2.',
 'ways(n) = ways(n - 1) + ways(n - 2). You only need the last two values, not a whole array.',
`function climbStairs(n) {
  let a = 1, b = 1;
  for (let i = 2; i <= n; i++) {
    const c = a + b;
    a = b;
    b = c;
  }
  return b;
}`, [[1], [2], [3], [5], [10], [30]]],

['coin-change', 'Coin Change', 'Dynamic programming', 2, 'coinChange', 'coins, amount',
 'Return the fewest coins needed to make `amount` from the given coin values (each can be used any number of times), or `-1` if it cannot be made.\n\n`coinChange([1, 2, 5], 11)` returns `3`, from 5 + 5 + 1.',
 'Taking the biggest coin first is not always best. Think about smaller amounts first.',
 'dp[a] = fewest coins for amount a. For each a from 1 up, try every coin c: dp[a] = min(dp[a], dp[a - c] + 1).',
`function coinChange(coins, amount) {
  const dp = new Array(amount + 1).fill(Infinity);
  dp[0] = 0;
  for (let a = 1; a <= amount; a++) {
    for (const c of coins) {
      if (c <= a && dp[a - c] + 1 < dp[a]) dp[a] = dp[a - c] + 1;
    }
  }
  return dp[amount] === Infinity ? -1 : dp[amount];
}`, [[[1, 2, 5], 11], [[2], 3], [[1], 0], [[2, 5, 10, 1], 27], [[186, 419, 83, 408], 6249]]],

['longest-increasing-subsequence', 'Longest Increasing Subsequence', 'Dynamic programming', 2, 'lengthOfLIS', 'nums',
 'Return the length of the longest strictly increasing subsequence of `nums` (items keep their order but need not be adjacent).\n\n`lengthOfLIS([10, 9, 2, 5, 3, 7, 101, 18])` returns `4`, from 2, 3, 7, 18.',
 'Simple version: dp[i] = longest increasing subsequence ending at i, checking every earlier j.',
 'Faster: keep an array where tails[k] is the smallest possible tail of a subsequence of length k + 1, and binary-search each number into it.',
`function lengthOfLIS(nums) {
  const tails = [];
  for (const x of nums) {
    let lo = 0, hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (tails[mid] < x) lo = mid + 1; else hi = mid;
    }
    tails[lo] = x;
  }
  return tails.length;
}`, [[[10, 9, 2, 5, 3, 7, 101, 18]], [[0, 1, 0, 3, 2, 3]], [[7, 7, 7, 7]], [[4]], [[1, 3, 6, 7, 9, 4, 10, 5, 6]]]],

['word-break', 'Word Break', 'Dynamic programming', 2, 'wordBreak', 's, words',
 'Return `true` if `s` can be cut into pieces that are all in the `words` list. Words may be reused.\n\n`wordBreak("applepenapple", ["apple", "pen"])` returns `true`.',
 'If the first i characters can be split, you only need to check what comes after them.',
 'dp[i] is true when s.slice(0, i) can be split. dp[i] = some j < i with dp[j] true and s.slice(j, i) in the word set.',
`function wordBreak(s, words) {
  const set = new Set(words), dp = new Array(s.length + 1).fill(false);
  dp[0] = true;
  for (let i = 1; i <= s.length; i++) {
    for (let j = 0; j < i; j++) {
      if (dp[j] && set.has(s.slice(j, i))) { dp[i] = true; break; }
    }
  }
  return dp[s.length];
}`, [['applepenapple', ['apple', 'pen']], ['catsandog', ['cats', 'dog', 'sand', 'and', 'cat']], ['a', ['a']], ['aaaaaaa', ['aaaa', 'aaa']], ['abcd', ['a', 'abc', 'b', 'cd']]]],

['edit-distance', 'Edit Distance', 'Dynamic programming', 3, 'minDistance', 'a, b',
 'Return the fewest single-character inserts, deletes or replacements needed to turn string `a` into string `b`.\n\n`minDistance("horse", "ros")` returns `3`.',
 'Compare prefixes: how far is the first i characters of a from the first j characters of b?',
 'dp[i][j]: if the characters match, take dp[i-1][j-1]. Otherwise 1 + the smallest of delete (i-1, j), insert (i, j-1) and replace (i-1, j-1).',
`function minDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}`, [['horse', 'ros'], ['intention', 'execution'], ['', ''], ['abc', ''], ['kitten', 'sitting']]],

['number-of-islands', 'Number of Islands', 'Graphs', 2, 'numIslands', 'grid',
 '`grid` is a list of rows of `1` (land) and `0` (water). Return how many islands there are. Land cells that touch up, down, left or right belong to the same island.\n\n`numIslands([[1, 1, 0], [0, 0, 0], [0, 1, 1]])` returns `2`.',
 'Each time you find land you have not visited, you found a new island. Then mark the whole island as visited.',
 'Scan every cell. On a 1, add one to the count and flood-fill (depth-first) from it, turning each visited 1 into 0.',
`function numIslands(grid) {
  const R = grid.length, C = R ? grid[0].length : 0;
  let count = 0;
  const sink = (r, c) => {
    if (r < 0 || c < 0 || r >= R || c >= C || grid[r][c] !== 1) return;
    grid[r][c] = 0;
    sink(r + 1, c); sink(r - 1, c); sink(r, c + 1); sink(r, c - 1);
  };
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      if (grid[r][c] === 1) { count++; sink(r, c); }
    }
  }
  return count;
}`, [[[[1, 1, 0, 0, 0], [1, 1, 0, 0, 0], [0, 0, 1, 0, 0], [0, 0, 0, 1, 1]]], [[[1, 1, 1], [0, 1, 0], [1, 1, 1]]], [[[0]]], [[[1, 0, 1], [0, 1, 0], [1, 0, 1]]], [[[1, 1, 0], [0, 0, 0], [0, 1, 1]]]]],

['course-schedule', 'Course Schedule', 'Graphs', 2, 'canFinish', 'n, prereqs',
 'There are `n` courses numbered from 0. Each pair `[a, b]` means you must take course `b` before course `a`. Return `true` if every course can be finished.\n\n`canFinish(2, [[1, 0], [0, 1]])` returns `false`, because the two courses wait on each other.',
 'The courses and their requirements form a directed graph. The question is whether it has a cycle.',
 'Count incoming edges per course. Repeatedly take courses with zero incoming edges and remove their outgoing edges. If you can take all n, there is no cycle.',
`function canFinish(n, prereqs) {
  const next = Array.from({ length: n }, () => []), need = new Array(n).fill(0);
  for (const [a, b] of prereqs) { next[b].push(a); need[a]++; }
  const ready = [];
  for (let i = 0; i < n; i++) if (!need[i]) ready.push(i);
  let done = 0;
  while (ready.length) {
    const x = ready.pop();
    done++;
    for (const y of next[x]) if (--need[y] === 0) ready.push(y);
  }
  return done === n;
}`, [[2, [[1, 0]]], [2, [[1, 0], [0, 1]]], [4, [[1, 0], [2, 1], [3, 2]]], [3, [[0, 1], [1, 2], [2, 0]]], [1, []], [5, [[1, 4], [2, 4], [3, 1], [3, 2]]]]],

['merge-intervals', 'Merge Intervals', 'Intervals', 2, 'merge', 'intervals',
 'Each item is `[start, end]`. Merge every pair of intervals that overlap or touch, and return the result sorted by start.\n\n`merge([[1, 3], [2, 6], [8, 10]])` returns `[[1, 6], [8, 10]]`.',
 'Sorting by start time puts every overlapping interval next to the one it overlaps.',
 'After sorting, walk the list. If the current start is not after the last merged end, extend that end; otherwise start a new interval.',
`function merge(intervals) {
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]), out = [];
  for (const [start, end] of sorted) {
    const last = out[out.length - 1];
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else out.push([start, end]);
  }
  return out;
}`, [[[[1, 3], [2, 6], [8, 10], [15, 18]]], [[[1, 4], [4, 5]]], [[[1, 4], [0, 4]]], [[[5, 7]]], [[[1, 10], [2, 3], [4, 5], [11, 12]]]]],
];
