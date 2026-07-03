import re

with open("routers/dashboard.py", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace(
    "from auth import get_current_user, Header, HTTPException",
    "from fastapi import Header, HTTPException\nfrom auth import get_current_user"
)

with open("routers/dashboard.py", "w", encoding="utf-8") as f:
    f.write(content)

with open("routers/sessions.py", "r", encoding="utf-8") as f:
    content = f.read()
    
# also sessions.py might have the same problem
content = content.replace(
    "from auth import get_current_user, Header, HTTPException",
    "from fastapi import Header, HTTPException\nfrom auth import get_current_user"
)
content = content.replace(
    "from auth import get_current_user, BackgroundTasks, File, Form, Header, HTTPException, UploadFile",
    "from fastapi import BackgroundTasks, File, Form, Header, HTTPException, UploadFile\nfrom auth import get_current_user"
)

with open("routers/sessions.py", "w", encoding="utf-8") as f:
    f.write(content)
