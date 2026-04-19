import re

with open('c:\\hackathon\\nit tirchy\\IIT TIRCHY\\upload.html', 'r', encoding='utf-8') as f:
    html_content = f.read()

# Replace body background with pure black and remove before pseudo element
pattern_body = r'body\s*{[^}]*background-color:\s*var\(--bg-dark\);[^}]*background-image:[^}]*background-attachment:\s*fixed;([^}]*)}'
replacement_body = r'body {\n      font-family: \'Rajdhani\', sans-serif;\n      background-color: #000000;\n\1}'
new_html = re.sub(pattern_body, replacement_body, html_content)

pattern_grid = r'/\* Grid Overlay \*/\s*body::before\s*{[^}]*}\s*@keyframes\s*gridMove\s*{[^}]*}'
new_html = re.sub(pattern_grid, '/* Grid overlay removed */', new_html)

with open('c:\\hackathon\\nit tirchy\\IIT TIRCHY\\upload.html', 'w', encoding='utf-8') as f:
    f.write(new_html)
