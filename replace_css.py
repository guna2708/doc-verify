import re

with open('c:\\hackathon\\nit tirchy\\IIT TIRCHY\\upload.html', 'r', encoding='utf-8') as f:
    html_content = f.read()

with open('c:\\hackathon\\nit tirchy\\IIT TIRCHY\\temp_css.css', 'r', encoding='utf-8') as f:
    css_content = f.read()

# Replace everything between <style> and </style>
new_html = re.sub(r'<style>.*?</style>', f'<style>\n{css_content}\n  </style>', html_content, flags=re.DOTALL)

with open('c:\\hackathon\\nit tirchy\\IIT TIRCHY\\upload.html', 'w', encoding='utf-8') as f:
    f.write(new_html)
