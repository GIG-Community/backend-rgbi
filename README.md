# Backend RGBI

Backend API untuk aplikasi RGBI (Rice and Grains Business Intelligence) yang menyediakan data dan analisis terkait ketahanan pangan, rantai pasok, dan clustering provinsi.

## Teknologi yang Digunakan

- Node.js & Express.js
- MongoDB & Mongoose
- JWT Authentication
- Docker

## Struktur Direktori

```
backend-rgbi/
├── config/                 # Konfigurasi aplikasi
│   └── env.js             # Environment variables configuration
├── controllers/           # Controller untuk handle logic
│   ├── climate.controller.js
│   ├── etc
├── database/              # Database configuration
│   └── mongodb.js
├── middlewares/           # Middleware functions
│   ├── auth.middleware.js
│   └── error.middleware.js
├── models/                # MongoDB models
│   ├── climate.model.js
│   ├── etc
├── province-geojson/      # GeoJSON data provinsi
│   └── province_38.json
├── routes/                # API routes
│   ├── climate.routes.js
│   ├── etc
├── utils/                 # Utility functions
│   ├── asyncHandler.js
│   ├── extractProvince.js
│   └── fileProcessor.js
├── .dockerignore
├── .gitignore
├── app.js                 # Main application file
├── Dockerfile
├── eslint.config.mjs
├── package.json
└── package-lock.json
```

## Cara Menjalankan Project

### Prasyarat

- Node.js versi 20 atau lebih tinggi
- MongoDB (lokal atau cloud)
- npm atau yarn

### Instalasi

1. Clone repository
```bash
git clone <repository-url>
cd backend-rgbi
```

2. Install dependencies
```bash
npm install
```

3. Setup environment variables

Buat file `.env.development.local` di root project dengan konfigurasi berikut:

```env
PORT=5000
NODE_ENV=development
DB_URI=mongodb://localhost:27017/rgbi
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=7d
```

Untuk production, buat file `.env.production.local`:

```env
PORT=5000
NODE_ENV=production
DB_URI=mongodb://your-production-db-uri
JWT_SECRET=your_production_jwt_secret
JWT_EXPIRES_IN=7d
```

4. Jalankan aplikasi

**Mode Development:**
```bash
npm run dev
```

**Mode Production:**
```bash
npm start
```

Server akan berjalan di `http://localhost:5000`

### Menjalankan dengan Docker

1. Build Docker image
```bash
docker build -t backend-rgbi .
```

2. Jalankan container
```bash
docker run -p 5000:5000 --env-file .env.production.local backend-rgbi
```

## API Endpoints

Base URL: `http://localhost:5000/api/v1`

### Authentication
- `POST /auth/*` - Authentication endpoints

### Resources
- `GET/POST/PUT/DELETE /users/*` - User management
- `GET/POST/PUT/DELETE /food-securities/*` - Food security data
- `GET/POST/PUT/DELETE /supply-chain/*` - Supply chain data
- `GET/POST/PUT/DELETE /connect-province/*` - Province connections
- `GET/POST/PUT/DELETE /provinces/*` - Province data
- `GET/POST/PUT/DELETE /clustering/*` - Clustering analysis
- `GET/POST/PUT/DELETE /gwpr/*` - GWPR data
- `GET/POST/PUT/DELETE /sar/*` - SAR data
- `GET/POST/PUT/DELETE /climate/*` - Climate data
- `GET/POST/PUT/DELETE /mpp/*` - MPP data
- `GET /map/*` - Map related endpoints

## CORS Configuration

Aplikasi ini dikonfigurasi untuk menerima request dari:
- `http://localhost:3000`
- `http://localhost:3001`
- `https://pangan-id.com`
- `https://www.pangan-id.com`
- `http://pangan-id.com`
- `http://www.pangan-id.com`

## License

Private
