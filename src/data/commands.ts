// The command handbook (/commands): the commands learners use most, grouped by
// what you're trying to do. Descriptions and examples come from the lab
// terminal's own help (src/lib/sim/shell.ts HELP), so the handbook and the
// terminal always agree; `tip` adds one practical extra.

export type CommandGroup = {
  title: string;
  intro: string;
  commands: { name: string; tip?: string }[];
};

export const commandGroups: CommandGroup[] = [
  {
    title: "Find your way around",
    intro: "Where am I, what's here, and how do I move?",
    commands: [
      { name: "pwd", tip: "Lost? Run pwd first — it prints the folder you're standing in." },
      { name: "ls", tip: "Add -l for details (permissions, owner, size) and -a to show hidden files that start with a dot." },
      { name: "cd", tip: "cd .. goes up one folder; cd on its own takes you home." },
      { name: "history", tip: "Press ↑ to bring back your last command instead of retyping it." },
      { name: "clear" },
    ],
  },
  {
    title: "Read files",
    intro: "Look inside a file without opening an editor.",
    commands: [
      { name: "cat", tip: "Best for short files. For long ones, use head or tail to see just the start or end." },
      { name: "head", tip: "Great for a first look at a big log: what do the lines look like?" },
      { name: "tail", tip: "Logs add new lines at the bottom, so tail shows the most recent events." },
    ],
  },
  {
    title: "Search and filter",
    intro: "Find the lines or files that matter.",
    commands: [
      { name: "grep", tip: "Combine options: grep -ic counts matching lines, ignoring upper/lower case." },
      { name: "find", tip: "Add 2>/dev/null to hide the \"Permission denied\" noise and keep only results." },
    ],
  },
  {
    title: "Count, sort and pick columns",
    intro: "Turn hundreds of lines into a short answer.",
    commands: [
      { name: "wc", tip: "Pipe into it: grep Failed auth.log | wc -l counts the failed logins." },
      { name: "sort", tip: "sort -nr puts the biggest numbers first — perfect after uniq -c." },
      { name: "uniq", tip: "It only merges neighbouring duplicates, so always sort first." },
      { name: "cut", tip: "-d says what separates the columns, -f says which column(s) you want." },
      { name: "awk", tip: "$NF means the last word on the line — handy when lines have different lengths." },
    ],
  },
  {
    title: "Inspect files",
    intro: "Find out what a file really is and what's hidden inside it.",
    commands: [
      { name: "file", tip: "Trust file over the extension — a .pdf can really be a zip." },
      { name: "strings", tip: "Pipe through grep to search the readable text: strings image.png | grep -i flag" },
      { name: "xxd", tip: "The first few bytes (the \"magic bytes\") identify the file type." },
      { name: "binwalk", tip: "binwalk -e extracts what it finds into a new _filename.extracted folder." },
      { name: "unzip", tip: "unzip -l lists what's inside without extracting anything." },
    ],
  },
  {
    title: "Encode and decode",
    intro: "Reverse the encodings that show up in every CTF.",
    commands: [
      { name: "base64", tip: "Base64 often ends in = or ==. Decoding needs no key — it isn't encryption." },
      { name: "echo", tip: "Use echo to feed text into another command: echo aGk= | base64 -d" },
    ],
  },
  {
    title: "Who and where am I?",
    intro: "The first questions on any system you're allowed to examine.",
    commands: [
      { name: "whoami" },
      { name: "id", tip: "The groups list matters — some groups grant extra powers (e.g. reading logs)." },
      { name: "uname", tip: "uname -a shows the kernel version, useful when checking patch levels." },
      { name: "hostname" },
    ],
  },
];

// Ready-made combinations that show how commands work together.
export const recipes: { cmd: string; does: string }[] = [
  { cmd: "grep Failed auth.log | wc -l", does: "How many failed logins are in the log?" },
  { cmd: "grep Failed auth.log | awk '{print $8}' | sort | uniq -c | sort -nr", does: "Which usernames were tried most, biggest first?" },
  { cmd: "find / -perm -4000 2>/dev/null", does: "List programs with the SUID bit, hiding permission errors." },
  { cmd: "strings image.png | grep -i flag", does: "Search the readable text inside a binary file." },
  { cmd: "echo SEhCe2hpfQ== | base64 -d", does: "Decode a Base64 string on the spot." },
  { cmd: "cat notes.txt > copy.txt", does: "Send a command's output into a file instead of the screen (>> appends)." },
];

// Command-anatomy walkthrough for the top of the handbook.
export const anatomy = {
  example: 'grep -i "failed" auth.log',
  parts: [
    { part: "grep", label: "program", says: "what to run — here, the search tool" },
    { part: "-i", label: "option (flag)", says: "changes how it behaves — here, ignore upper/lower case" },
    { part: '"failed"', label: "argument", says: "what to look for — quotes keep it as one piece" },
    { part: "auth.log", label: "argument", says: "where to look — the file to search" },
  ],
  extras: [
    { sym: "|", means: "pipe: send this command's output into the next command" },
    { sym: ">", means: "save the output to a file (>> adds to the end)" },
    { sym: "2>/dev/null", means: "throw away error messages, keep the results" },
    { sym: "*", means: "wildcard: *.log means every file ending in .log" },
  ],
};
