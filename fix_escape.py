import sys

with open('c:\\hackathon\\nit tirchy\\IIT TIRCHY\\upload.html', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('\\`', '`').replace('\\${', '${')

with open('c:\\hackathon\\nit tirchy\\IIT TIRCHY\\upload.html', 'w', encoding='utf-8') as f:
    f.write(content)
