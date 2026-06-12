import os
from config import get_db
db = get_db()
print(db.table('streaks').select('*').eq('user_id', '4c940490-afc9-4cfa-bdef-ef9e5eca6b49').execute())
print(db.table('daily_completions').select('*').eq('user_id', '4c940490-afc9-4cfa-bdef-ef9e5eca6b49').order('completed_date', desc=True).limit(5).execute())
