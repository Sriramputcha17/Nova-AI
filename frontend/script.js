const sendBtn = document.getElementById("send-btn");
const stopBtn = document.getElementById("stop-btn");
const newChatBtn = document.getElementById("new-chat-btn");
const userInput = document.getElementById("user-input");
const chatBox = document.getElementById("chat-box");
const chatHistory = document.getElementById("chat-history");

let chats = JSON.parse(localStorage.getItem("novaChats")) || [];
let currentReader = null;
let isGenerating = false;
let currentChatId = null;

function getTime() {
    return new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    });
}

function saveChats() {
    localStorage.setItem(
        "novaChats",
        JSON.stringify(chats)
    );
}

function createNewChat() {
    const chat = {
        id: Date.now(),
        title: "New Chat",
        messages: []
    };

    chats.unshift(chat);
    currentChatId = chat.id;
    saveChats();
    renderSidebar();
    renderCurrentChat();
}

function renderSidebar() {
    chatHistory.innerHTML = "";

    chats.forEach(chat => {
        const item = document.createElement("div");
        item.classList.add("history-item");

        if (chat.id === currentChatId) {
            item.classList.add("active-chat");
        }

        const title = document.createElement("span");
        title.textContent = chat.title;
        title.onclick = () => {
            currentChatId = chat.id;
            renderSidebar();
            renderCurrentChat();
        };

        const deleteBtn = document.createElement("span");
        deleteBtn.innerHTML = "✕";
        deleteBtn.classList.add("delete-chat");
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deleteChat(chat.id);
        };

        item.appendChild(title);
        item.appendChild(deleteBtn);
        chatHistory.appendChild(item);
    });
}

function deleteChat(id) {
    chats = chats.filter(chat => chat.id !== id);
    saveChats();

    if (chats.length === 0) {
        createNewChat();
        return;
    }

    currentChatId = chats[0].id;
    renderSidebar();
    renderCurrentChat();
}

function renderCurrentChat() {
    chatBox.innerHTML = "";

    const currentChat = chats.find(chat => chat.id === currentChatId);
    if (!currentChat) return;

    currentChat.messages.forEach(msg => {
        const div = document.createElement("div");
        div.classList.add(
            msg.role === "user"
                ? "user-message"
                : "bot-message"
        );

        if (msg.role === "assistant") {
            div.innerHTML = `
                <div class="message-content">
                    ${marked.parse(msg.content)}
                </div>
                <div class="timestamp">
                    ${msg.time}
                </div>
            `;
        } else {
            div.innerHTML = `
                ${msg.content}
                <div class="timestamp">
                    ${msg.time}
                </div>
            `;
        }

        chatBox.appendChild(div);
    });

    addCopyButtons();

    document.querySelectorAll("pre code").forEach(block => {
        hljs.highlightElement(block);
    });

    chatBox.scrollTop = chatBox.scrollHeight;
}

function addCopyButtons() {
    document.querySelectorAll("pre").forEach(pre => {
        if (pre.querySelector(".copy-btn")) return;

        const button = document.createElement("button");
        button.innerText = "Copy";
        button.classList.add("copy-btn");

        button.onclick = () => {
            const code = pre.querySelector("code")
                ? pre.querySelector("code").innerText
                : pre.innerText;

            navigator.clipboard.writeText(code);
            button.innerText = "Copied!";

            setTimeout(() => {
                button.innerText = "Copy";
            }, 1500);
        };

        pre.appendChild(button);
    });
}

async function sendMessage() {
    if (isGenerating) return;
    isGenerating = true;
    sendBtn.disabled = true;
    stopBtn.style.display = "block";

    const message = userInput.value.trim();
    if (!message) {
        isGenerating = false;
        sendBtn.disabled = false;
        stopBtn.style.display = "none";
        return;
    }

    const currentChat = chats.find(chat => chat.id === currentChatId);

    if (currentChat.title === "New Chat") {
        currentChat.title = message.substring(0, 30);
    }

    currentChat.messages.push({
        role: "user",
        content: message,
        time: getTime()
    });

    saveChats();
    renderSidebar();
    renderCurrentChat();
    userInput.value = "";
    
    // Reset textarea height back to default after sending message
    userInput.style.height = "auto";

    const botMessage = {
        role: "assistant",
        content: "",
        time: getTime()
    };

    currentChat.messages.push(botMessage);
    saveChats();
    renderCurrentChat();

    const thinkingInterval = setInterval(() => {
        const dots = ".".repeat(Math.floor(Date.now() / 500) % 4);
        botMessage.content = "Nova is thinking" + dots;
        renderCurrentChat();
    }, 500);

    let firstTokenReceived = false;

    try {
        const response = await fetch("http://127.0.0.1:5000/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message: message
            })
        });

        currentReader = response.body.getReader();
        const reader = currentReader;
        const decoder = new TextDecoder();

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n");

            for (const line of lines) {
                if (line.startsWith("data:")) {
                    try {
                        const token = JSON.parse(line.replace("data:", ""));

                        if (!firstTokenReceived) {
                            clearInterval(thinkingInterval);
                            botMessage.content = "";
                            firstTokenReceived = true;
                        }

                        botMessage.content += token;
                        saveChats();
                        renderCurrentChat();
                    } catch (err) {
                        console.error(err);
                    }
                }
            }
        }

        clearInterval(thinkingInterval);
        isGenerating = false;
        sendBtn.disabled = false;
        stopBtn.style.display = "none";
        currentReader = null;
        saveChats();
        renderCurrentChat();

    } catch (error) {
        clearInterval(thinkingInterval);
        botMessage.content = "Error connecting to backend.";
        
        isGenerating = false;
        sendBtn.disabled = false;
        stopBtn.style.display = "none";
        currentReader = null;
        
        saveChats();
        renderCurrentChat();
        console.error(error);
    }
}

sendBtn.addEventListener("click", sendMessage);

userInput.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

newChatBtn.addEventListener("click", createNewChat);

stopBtn.addEventListener("click", async () => {
    if (currentReader) {
        await currentReader.cancel();
        currentReader = null;
    }
    isGenerating = false;
    sendBtn.disabled = false;
    stopBtn.style.display = "none";
});

userInput.addEventListener("input", () => {
    userInput.style.height = "auto";
    userInput.style.height = userInput.scrollHeight + "px";
});

window.onload = () => {
    if (chats.length === 0) {
        createNewChat();
    } else {
        currentChatId = chats[0].id;
        renderSidebar();
        renderCurrentChat();
    }
};