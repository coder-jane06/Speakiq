import re

filepath = r"C:\Users\GAMER\.gemini\antigravity\brain\1ec2a681-2f30-445b-ad0f-ce6fffa15f61\full_master_plan.md"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Remove sections 4.2, 4.5, 6.1, 6.4, 8.1, 8.2
patterns_to_remove = [
    r"### 4\.2.*?---",
    r"### 4\.5.*?---",
    r"### 6\.1.*?---",
    r"### 6\.4.*?---",
    r"### 8\.1.*?---",
    r"### 8\.2.*?---"
]

for pattern in patterns_to_remove:
    content = re.sub(pattern, "", content, flags=re.DOTALL)

# For 5.4 Increase session limit
# The text is: "After 5 sessions averaging > 80 overall → user unlocks Intermediate tier. After 10 sessions averaging > 85 → Advanced."
content = re.sub(
    r"After 5 sessions averaging > 80 overall",
    r"After 25 sessions averaging > 80 overall",
    content
)
content = re.sub(
    r"After 10 sessions averaging > 85",
    r"After 50 sessions averaging > 85",
    content
)
content = re.sub(
    r"recent_scores\[-5:\]\) / 5",
    r"recent_scores[-25:]) / 25",
    content
)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)

print("Updated full master plan.")
