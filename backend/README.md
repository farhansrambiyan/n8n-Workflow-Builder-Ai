# n8n Workflow Builder AI - Backend Server

A backend server for the n8n Workflow Builder AI Chrome Extension that provides Firebase authentication and AI-powered workflow generation/debugging capabilities.

## 🌟 Features

- **Firebase Authentication** - Google Sign-In integration for secure user authentication
- **Multi-Provider AI Support** - Works with multiple AI providers:
  - OpenAI (GPT models)
  - Google Gemini
  - Anthropic Claude
  - Mistral AI
  - OpenRouter
  - Grok (x.ai)
  - Groq
- **Workflow Generation** - AI-powered n8n workflow creation
- **Workflow Debugging** - AI-assisted debugging and troubleshooting

---

## 📁 Project Structure

```
backend/
├── controllers/
│   ├── userAuthentication.controller.js  # Firebase auth logic
│   ├── workFlowGenerate.controller.js    # AI workflow generation
│   └── workFlowDebug.controller.js       # AI workflow debugging
├── public/
│   ├── firebaseauth.js     # Client-side Firebase auth (source)
│   ├── dist/
│   │   └── bundle.js       # Bundled Firebase auth (generated)
│   ├── option.html         # Sign-in page
│   ├── option.css          # Sign-in page styles
│   ├── close.html          # Post-login redirect page
│   └── icon128.png         # App icon
├── utils/
│   └── extractJsonFromText.js  # JSON extraction utility
├── server.js               # Express server entry point
├── webpack.config.js       # Webpack bundler configuration
├── firebase.json           # Firebase hosting configuration
├── Dockerfile              # Docker container configuration
├── package.json            # Dependencies and scripts
└── .env                    # Environment variables (create this)
```

---

## 🔧 Prerequisites

Before you begin, ensure you have:

- **Node.js** v18 or higher (v20 LTS recommended)
- **npm** v8 or higher
- A **Firebase project** with Authentication enabled
- (Optional) **Docker** for containerized deployment

---

## 🚀 Installation

### Step 1: Clone the Repository

```bash
git clone <your-repo-url>
cd backend
```

### Step 2: Install Dependencies

```bash
npm install
```

---

## ⚙️ Configuration

You need to configure **4 files** with your credentials:

### 📄 1. Create `.env` File

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=3001

# Firebase Admin SDK Credentials
# Get these from Firebase Console > Project Settings > Service Accounts
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
```

> ⚠️ **Important:** The `FIREBASE_PRIVATE_KEY` must be wrapped in double quotes and keep the `\n` characters.

#### How to get Firebase Admin credentials:
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Project Settings** (gear icon) → **Service Accounts**
4. Click **Generate New Private Key**
5. Download the JSON file
6. Copy `client_email` → `FIREBASE_CLIENT_EMAIL`
7. Copy `private_key` → `FIREBASE_PRIVATE_KEY`

---

### 📄 2. Configure `controllers/userAuthentication.controller.js`

Open the file and update the Firebase config (lines 7-14):

```javascript
const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "G-XXXXXXXXXX"
};
```

#### How to get these values:
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Project Settings** (gear icon) → **General**
4. Scroll down to **Your apps** section
5. If no app exists, click **Add app** → Select **Web** (</>)
6. Copy the config object values

---

### 📄 3. Configure `public/firebaseauth.js`

Open the file and update **TWO things**:

#### a) Firebase Config (lines 4-12):
```javascript
const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "G-XXXXXXXXXX",
};
```

#### b) Redirect URL (line 39):
```javascript
window.location.href = "https://your-domain.com/close.html";
```

Replace `https://your-domain.com` with:
- Your deployed server URL (e.g., `https://myapp.herokuapp.com`)
- Or `http://localhost:3001` for local development

---

### 📄 4. Configure `public/close.html`

Open the file and update the postMessage origin (line 117):

```javascript
window.postMessage({
  type: 'N8N_AUTH_SUCCESS',
  userData: userInfo,
  source: 'firebase-auth'
}, 'https://your-domain.com');
```

Replace `'https://your-domain.com'` with your deployed server URL.

> **Note:** If you're using this with a Chrome extension, you may need to use the extension's origin: `'chrome-extension://your-extension-id'`

---

### 📄 5. (Optional) Customize AI System Prompt

To customize the AI workflow generation prompt, edit `controllers/workFlowGenerate.controller.js`:

```javascript
// Line 15
systemPrompt = `YOUR CUSTOM AI PROMPT FOR WORKFLOW GENERATION...`;
```

---

## 🔨 Building the Public Bundle

The Firebase authentication script needs to be bundled before deployment.

### Build for Production:

```bash
npm run build
```

This creates `public/dist/bundle.js` from `public/firebaseauth.js`.

### Build for Development (with watch mode):

```bash
npm run watch
```

---

## ▶️ Running the Server

### Development Mode (with auto-restart):

```bash
npm start
```

Server runs on `http://localhost:3001` (or the PORT specified in `.env`)

### Production Mode:

```bash
node server.js
```

---

## 🐳 Docker Deployment

### Build Docker Image:

```bash
docker build -t n8n-backend .
```

### Run Docker Container:

```bash
docker run -d \
  -p 3001:3001 \
  -e PORT=3001 \
  -e FIREBASE_CLIENT_EMAIL="your-email@project.iam.gserviceaccount.com" \
  -e FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n" \
  --name n8n-backend \
  n8n-backend
```

### Using Docker Compose:

Create `docker-compose.yml`:

```yaml
version: '3.8'
services:
  backend:
    build: .
    ports:
      - "3001:3001"
    environment:
      - PORT=3001
      - FIREBASE_CLIENT_EMAIL=${FIREBASE_CLIENT_EMAIL}
      - FIREBASE_PRIVATE_KEY=${FIREBASE_PRIVATE_KEY}
    restart: unless-stopped
```

Then run:
```bash
docker-compose up -d
```

---

## 🌐 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/generate` | Generate n8n workflow using AI |
| `POST` | `/api/debug` | Debug n8n workflow using AI |
| `POST` | `/api/user` | Authenticate user |
| `POST` | `/api/validate` | Validate user token |
| `GET` | `/option` | Sign-in page |
| `GET` | `/close` | Post-login redirect page |

### Request Body for `/api/generate` and `/api/debug`:

```json
{
  "provider": "openai",
  "apiKey": "your-api-key",
  "model": "gpt-4",
  "userPrompt": "Create a workflow that...",
  "workflowContext": {}
}
```

**Supported providers:** `openai`, `gemini`, `claude`, `mistral`, `openrouter`, `grok`, `groq`

---

## 🔐 Firebase Setup Checklist

1. ✅ Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. ✅ Enable **Authentication** → **Sign-in method** → **Google**
3. ✅ Add your domain to **Authorized domains** (Authentication → Settings)
4. ✅ Create a **Service Account** and download credentials
5. ✅ Create a **Web App** and copy the config

---

## 📝 Configuration Summary

| File | What to Change | Purpose |
|------|----------------|---------|
| `.env` | `PORT`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | Server & Admin SDK |
| `controllers/userAuthentication.controller.js` | Firebase config object (lines 7-14) | Server-side auth |
| `public/firebaseauth.js` | Firebase config (lines 4-12), redirect URL (line 39) | Client-side auth |
| `public/close.html` | postMessage origin (line 117) | Auth callback |

---

## 🛠️ Available Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start server with nodemon (auto-restart) |
| `npm run build` | Bundle firebaseauth.js for production |
| `npm run dev` | Bundle in development mode |
| `npm run watch` | Bundle with watch mode |
| `npm run serve` | Start webpack dev server |

---

## 🚀 Deployment Options

### Option 1: Traditional VPS/Cloud Server
1. Clone repo on server
2. Configure all files as described above
3. Run `npm install && npm run build`
4. Use PM2 or systemd to keep the server running:
   ```bash
   npm install -g pm2
   pm2 start server.js --name n8n-backend
   pm2 save
   ```

### Option 2: Docker
- See [Docker Deployment](#-docker-deployment) section above

### Option 3: Platform as a Service (PaaS)
- **Heroku**: Add buildpack for Node.js, set env vars in dashboard
- **Railway**: Connect repo, add env vars
- **Render**: Connect repo, add env vars
- **Fly.io**: Use Dockerfile, set secrets

---

## 🔒 Security Notes

- Never commit `.env` file to version control
- Add `.env` to `.gitignore`
- Keep Firebase private keys secure
- Use HTTPS in production
- Enable CORS only for trusted origins if needed

---

## 📄 License

ISC

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📞 Support

If you encounter any issues, please open an issue on GitHub.

