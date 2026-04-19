"""Quick test: analyze all JPEG/PNG files in the project root against the API."""
import requests, json, glob, os

root = r"D:\HACKATHON\IIT TIRCHY"
files = (
    glob.glob(os.path.join(root, "*.jpeg")) +
    glob.glob(os.path.join(root, "*.jpg")) +
    glob.glob(os.path.join(root, "*.png"))
)
print(f"Found {len(files)} file(s) to test\n")

for f in files:
    name = os.path.basename(f)
    mime = "image/jpeg" if f.lower().endswith((".jpg", ".jpeg")) else "image/png"
    with open(f, "rb") as fh:
        r = requests.post(
            "http://localhost:8000/analyze",
            files={"file": (name, fh, mime)},
            timeout=60,
        )
    if r.status_code != 200:
        print(f"ERROR {r.status_code} for {name}: {r.text[:200]}")
        continue
    d = r.json()
    print(f"=== {name} ===")
    print(f"  Verdict   : {d['verdict']}  ({d['confidence']}%)")
    sb = d["score_breakdown"]
    print(f"  ELA={sb['ela_score']}  BlockELA={sb['block_ela_score']}  "
          f"Noise={sb['noise_score']}  CopyMove={sb['copy_move_score']}  "
          f"Meta={sb['meta_score']}  Font={sb['font_score']}  OCR={sb['ocr_score']}")
    for reason in d["reasons"]:
        print(f"    • {reason}")
    print()
