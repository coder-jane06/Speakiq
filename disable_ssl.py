import re

with open("frontend/vite.config.ts", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("import basicSsl from '@vitejs/plugin-basic-ssl'", "")
content = content.replace("basicSsl()", "")
content = content.replace("plugins: [react(), ]", "plugins: [react()]")

with open("frontend/vite.config.ts", "w", encoding="utf-8") as f:
    f.write(content)

print("Disabled basicSsl in vite.config.ts")
