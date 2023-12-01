import json
import pandas as pd

with open("raw_output.json", "r") as r:
    raw = json.load(r)

comments = []
for key in raw.keys():
    for item in raw[key]:
        comments.append(item)

comments = [c for c in comments if isinstance(c, dict)]

out = pd.DataFrame(comments)
out.to_csv("output.csv", index=False)