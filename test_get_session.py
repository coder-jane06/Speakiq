import requests

res = requests.get("http://localhost:8000/sessions/52596948-a9fb-4b4f-863f-a4a77464010b")
print(res.status_code, res.text)
