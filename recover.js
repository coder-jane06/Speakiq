const fs = require('fs');
const lines = fs.readFileSync('C:\\Users\\GAMER\\.gemini\\antigravity\\brain\\d78fc8ff-ed8d-48bd-a178-6cd78113107c\\.system_generated\\logs\\transcript.jsonl', 'utf-8').split('\n');
let best = null;
for (let line of lines) {
  if (!line.trim()) continue;
  try {
    const obj = JSON.parse(line);
    if (obj.tool_calls) {
      for (let call of obj.tool_calls) {
        if (call.name === 'write_to_file' && call.args.TargetFile && call.args.TargetFile.includes('Home.page.tsx')) {
          best = call.args.CodeContent;
        }
      }
    }
  } catch (e) {}
}
if (best) {
  // It's a JSON string of a string, so we need to parse it to get the raw text
  const rawText = JSON.parse(best);
  fs.writeFileSync('recovered_home.tsx', rawText);
  console.log('Recovered to recovered_home.tsx');
} else {
  console.log('Not found');
}
