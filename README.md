# MediQ Health Companion 🏥

An AI-powered health management platform that helps users track their health, analyze medical images, get AI-powered health insights, and connect with healthcare professionals.

## ✨ Features

- **AI Health Chatbot**: Get personalized health advice powered by AI with RAG (Retrieval-Augmented Generation)
- **Medical Image Analysis**: 
  - Lung X-ray screening for pneumonia detection
  - Skin lesion analysis for dermatological conditions
- **Smart Report Generation**: Automated PDF health reports with insights
- **Hospital Finder**: Location-based hospital recommendations with real-time data
- **Health History Tracking**: Comprehensive timeline of your health journey
- **Secure Authentication**: JWT-based secure user authentication

## 🚀 Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development
- **TailwindCSS** + **shadcn/ui** for modern UI
- **React Router** for navigation
- **React Query** for data fetching
- **Recharts** for data visualization

### Backend
- **FastAPI** (Python) for high-performance API
- **MongoDB** with Motor (async driver)
- **ONNX Runtime** for ML model inference
- **Pinecone** for vector database (RAG)
- **JWT** for authentication
- **ReportLab** for PDF generation

## 📋 Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.9+
- **MongoDB** database (local or Atlas)
- **Git**

## 🛠️ Local Development Setup

### Frontend Setup

```bash
# Install dependencies
npm install

# Create environment file
echo "VITE_API_BASE_URL=http://localhost:8000/api" > .env.local

# Start development server
npm run dev
```

Frontend runs on `http://localhost:5173`

### Backend Setup

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cat > .env << EOF
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key_here
FRONTEND_URL=http://localhost:5173
LLM_PROVIDER=mock
LLM_MODEL=mock
EOF

# Start backend server
uvicorn app.main:app --reload --host 0.0.0.0
```

Backend runs on `http://localhost:8000`

## 📦 Production Deployment

See detailed deployment guide: **[DEPLOYMENT.md](./DEPLOYMENT.md)**

### Quick Deploy Summary

**Frontend (Netlify):**
- Build: `npm run build`
- Deploy: Connect GitHub repo to Netlify
- Set `VITE_API_BASE_URL` environment variable

**Backend (Render/Railway/Fly.io):**
- Free tier options available
- Auto-deploy from GitHub
- Configure environment variables
- See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions

## 🔑 Environment Variables

### Frontend (.env.local)
```env
VITE_API_BASE_URL=http://localhost:8000/api
```

### Backend (.env)
```env
# Required
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your-secret-key

# Optional
GOOGLE_PLACES_API_KEY=your_api_key
PINECONE_API_KEY=your_pinecone_key
PINECONE_ENVIRONMENT=your_pinecone_env
LLM_PROVIDER=mock  # or openai/gemini
LLM_MODEL=mock
```

## 📁 Project Structure

```
mediq-health-companion/
├── src/                    # Frontend React application
│   ├── components/        # Reusable UI components
│   ├── pages/            # Page components
│   ├── lib/              # Utilities and API client
│   └── contexts/         # React contexts
├── backend/               # Python FastAPI backend
│   ├── app/
│   │   ├── routes/       # API endpoints
│   │   ├── services/     # Business logic
│   │   ├── schemas/      # Pydantic models
│   │   └── utils/        # Helper functions
│   ├── model/            # ONNX ML models
│   └── requirements.txt
├── public/               # Static assets
└── DEPLOYMENT.md         # Deployment guide
```

## 🧪 Available Scripts

### Frontend
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Lint code
```

### Backend
```bash
uvicorn app.main:app --reload              # Development server
uvicorn app.main:app --host 0.0.0.0        # Production server
python -m pytest                           # Run tests (if configured)
```

## 🔒 Security

- JWT-based authentication
- Password hashing with bcrypt
- CORS protection
- Environment variable management
- Secure MongoDB connections

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- **shadcn/ui** for beautiful UI components
- **FastAPI** for the excellent Python framework
- **ONNX Runtime** for efficient ML inference
- **Pinecone** for vector database capabilities

## 📞 Support

For issues and questions:
- Open an issue on GitHub
- Check [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment help

---

**Built with ❤️ for better health management**
