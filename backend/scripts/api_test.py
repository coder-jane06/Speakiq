import urllib.request, json, time

base = 'http://127.0.0.1:8002'
time.sleep(3)

tests = [
    ('/health',                   200),
    ('/sessions/topic',           200),
    ('/dashboard/stats',          200),
    ('/dashboard/streak',         200),
    ('/dashboard/profile-status', 200),
    ('/sessions/',                401),
]

print('=== END-TO-END API TEST ===')
all_pass = True
for path, expected in tests:
    try:
        req = urllib.request.Request(base + path)
        resp = urllib.request.urlopen(req, timeout=6)
        code = resp.status
    except urllib.error.HTTPError as e:
        code = e.code
    except Exception as e:
        code = 0

    ok = code == expected
    if not ok:
        all_pass = False
    mark = 'PASS' if ok else 'FAIL'
    print(f'  {mark}  {code} (want {expected})  {path}')

# Test topic has new fields
print()
try:
    resp = urllib.request.urlopen(base + '/sessions/topic', timeout=6)
    d = json.loads(resp.read())
    print('Sample topic from DB:')
    print('  text        :', d.get('text','')[:65])
    print('  tier        :', d.get('tier'))
    print('  goal_type   :', d.get('goal_type'))
    print('  target_skill:', d.get('target_skill'))
    topic_ok = bool(d.get('text'))
    print('  topic_ok    :', topic_ok)
    if not topic_ok:
        all_pass = False
except Exception as e:
    print('Topic test failed:', e)
    all_pass = False

print()
print('ALL TESTS PASSED:', all_pass)
