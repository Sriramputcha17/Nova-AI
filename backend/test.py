import ollama

response = ollama.chat(
    model="phi3:mini",
    messages=[
        {
            "role": "user",
            "content": "What is CSS?"
        }
    ]
)

print(response["message"]["content"])