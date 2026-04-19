import os
import google.generativeai as genai

api_key = "AIzaSyCGb8GXu4T7DTYL4-fqHRseDT9wCuOfGSs"
try:
    genai.configure(api_key=api_key)
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            print(m.name)
except Exception as e:
    print(f"FAILED: {e}")
