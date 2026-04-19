import requests

url = "http://localhost:8000/explain"
payload = {
    "question": "What is ELA?",
    "report": {"verdict": "GENUINE"}
}
try:
    response = requests.post(url, json=payload)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")
