import os
import google.generativeai as genai

api_key = "AIzaSyCGb8GXu4T7DTYL4-fqHRseDT9wCuOfGSs"
try:
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-flash-latest')
    response = model.generate_content("Say hello")
    print("SUCCESS:")
    print(response.text)
except Exception as e:
    print(f"FAILED: {e}")
