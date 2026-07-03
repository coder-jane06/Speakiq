import re

with open("routers/sessions.py", "r", encoding="utf-8") as f:
    content = f.read()

if "Depends" not in content[:300]:
    content = content.replace(
        "from fastapi import APIRouter, HTTPException, UploadFile, File, Form, BackgroundTasks, Header",
        "from fastapi import APIRouter, HTTPException, UploadFile, File, Form, BackgroundTasks, Header, Depends\nfrom auth import get_current_user"
    )

with open("routers/sessions.py", "w", encoding="utf-8") as f:
    f.write(content)
