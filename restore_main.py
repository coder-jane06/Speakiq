import os
import re

with open("main.py", "r", encoding="utf-8") as f:
    content = f.read()

# Add imports
if "from slowapi" not in content:
    imports = """from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
"""
    content = content.replace("from fastapi import FastAPI", imports + "from fastapi import FastAPI")

# Add CORS and Limiter
if "limiter = Limiter(" not in content:
    setup_code = """
ALLOWED_ORIGINS = (
    ["*"]
    if os.getenv("ENVIRONMENT") == "development"
    else ["https://coder-jane06.github.io"]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
"""
    # Replace the old CORSMiddleware block
    content = re.sub(r'app\.add_middleware\(\s*CORSMiddleware,.*?allow_headers=\["\*"\]\s*\)', "", content, flags=re.DOTALL)
    content = content.replace("app = FastAPI()", "app = FastAPI()\n" + setup_code)

with open("main.py", "w", encoding="utf-8") as f:
    f.write(content)

print("Restored main.py")
