from flask import Flask, request, Response
from flask_cors import CORS
import ollama
import json

app = Flask(__name__)
CORS(app)

SYSTEM_PROMPT = {
    "role": "system",
    "content": """
You are Nova AI.

Rules:

* Answer directly.
* No greetings.
* No introductions.
* No motivational text.
* Keep answers clear and complete.
* Never ask follow-up questions.
* Stop after answering.
"""
}


@app.route("/")
def home():
    return "Nova AI Backend Running!"


@app.route("/chat", methods=["POST"])
def chat():
    try:
        data = request.get_json()

        user_message = data.get("message", "").strip()

        if not user_message:

            def empty_stream():
                yield f"data:{json.dumps('Please enter a message.')}\n\n"

            return Response(
                empty_stream(),
                mimetype="text/event-stream"
            )

        def generate():
            stream = ollama.chat(
                model="phi3:mini",
                messages=[
                    SYSTEM_PROMPT,
                    {
                        "role": "user",
                        "content": user_message
                    }
                ],
                options={
                    "temperature": 0.1,
                    "num_predict": 300
                },
                stream=True
            )

            for chunk in stream:
                token = chunk.get("message", {}).get("content", "")

                if token:
                    yield f"data:{json.dumps(token)}\n\n"

        return Response(
            generate(),
            mimetype="text/event-stream"
        )

    except Exception as e:

        def error_stream():
            yield f"data:{json.dumps('ERROR: ' + str(e))}\n\n"

        return Response(
            error_stream(),
            mimetype="text/event-stream"
        )


if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True
    )