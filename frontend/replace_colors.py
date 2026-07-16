import os
import re

dir_path = "c:/Users/GAMER/Desktop/fluently/frontend/src"

replacements = {
    r"#0A0A0A": "var(--bg-main)",
    r"#111([^0-9A-Fa-f])": r"var(--bg-card)\1",
    r"#1A1A1A": "var(--bg-card-border)",
    r"#222([^0-9A-Fa-f])": r"var(--bg-card-border-light)\1",
    r"#333([^0-9A-Fa-f])": r"var(--border-dark)\1",
    r"#444([^0-9A-Fa-f])": r"var(--text-444)\1",
    r"#555([^0-9A-Fa-f])": r"var(--text-muted)\1",
    r"#888([^0-9A-Fa-f])": r"var(--text-muted-lighter)\1",
    r"#fff([^0-9A-Fa-f])": r"var(--text-main)\1",
    r"#ffffff": "var(--text-main)",
    r"#C8F97D": "var(--accent)"
}

for root, dirs, files in os.walk(dir_path):
    for file in files:
        if file.endswith(".tsx") or file.endswith(".ts"):
            file_path = os.path.join(root, file)
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()

            new_content = content
            for old, new in replacements.items():
                new_content = re.sub(old, new, new_content, flags=re.IGNORECASE)

            if new_content != content:
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(new_content)
                print(f"Updated {file_path}")
