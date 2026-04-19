import re

files = [
    'c:\\hackathon\\nit tirchy\\IIT TIRCHY\\frontend\\app\\globals.css',
    'c:\\hackathon\\nit tirchy\\IIT TIRCHY\\upload.html'
]

replacements = [
    (r'#00ff41', r'#0ea5e9'),
    (r'rgba\(0,\s*255,\s*65', r'rgba(14, 165, 233'),
    (r'#008f11', r'#0284c7'),
    (r'rgba\(0,\s*143,\s*17', r'rgba(2, 132, 199'),
    (r'#10b981', r'#38bdf8'),
    (r'#050a06', r'#020617'),
    (r'rgba\(2,\s*20,\s*10', r'rgba(2, 10, 20'),
    (r'rgba\(0,\s*10,\s*5', r'rgba(0, 5, 10'),
    (r'rgba\(2,\s*26,\s*12', r'rgba(2, 12, 26'),
    (r'#021a0d', r'#010d1a')
]

for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    for old, new in replacements:
        content = re.sub(old, new, content, flags=re.IGNORECASE)
    
    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)
