# Mobileapp_Attendance

A GPS-based attendance tracking system with a Node.js/Express backend and React Native (Expo) mobile app. Students can mark attendance only when physically present within the classroom's geofenced area.

## 📱 Features

- **GPS Attendance**: Students must be within the classroom geofence to sign in
- **Role-Based Access**: Separate flows for Students and Lecturers
- **Real-Time Tracking**: Instant attendance logging with distance verification
- **Class Management**: Lecturers can create and manage their classes
- **Attendance Reports**: View attendance rates and export to CSV
- **Secure Authentication**: JWT-based auth with bcrypt password hashing

## 🛠️ Tech Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Auth**: JWT, bcryptjs
- **Geo**: Haversine formula for distance calculation

### Mobile App
- **Framework**: React Native with Expo
- **Navigation**: React Navigation (Native Stack)
- **Location**: expo-location
- **Camera**: expo-camera
- **Storage**: expo-secure-store

## 📁 Project Structure

```
Mobileapp_Attendance/
├── backend/
│   ├── config/
│   │   └── db.js           # PostgreSQL connection pool
│   ├── controllers/
│   │   ├── authController.js        # Register & Login
│   │   ├── attendanceController.js # Sign-in & Reports
│   │   ├── classController.js      # Class listing
│   │   ├── lecturerController.js  # Class CRUD
│   │   └── profileController.js    # User profiles
│   ├── db/
│   │   ├── schema.js      # Database tables
│   │   └── geoService.js  # Haversine distance calc
│   ├── middleware/
│   │   └── auth.js        # JWT protection middleware
│   ├── routes/
│   │   └── api.js        # All API routes
│   ├── index.js          # Express app entry point
│   └── package.json
│
├── mobile/
│   ├── src/
│   │   ├── screens/
│   │   │   ├── LoginScreen.js
│   │   │   ├── RegisterScreen.js
│   │   │   ├── HomeScreen.js       # Mark attendance
│   │   │   ├── ClassPickerScreen.js
│   │   │   ├── AnalyticsScreen.js # My attendance
│   │   │   └── ReportScreen.js
│   │   └── services/
│   │       └── api.js    # Axios API client
│   ├── App.js            # Navigation setup
│   ├── app.json
│   └── package.json
│
├── .gitignore
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Expo (for mobile)

### Backend Setup

```bash
cd backend
npm install

# Create .env file
cp .env.example .env
# Edit .env with your PostgreSQL credentials

npm run dev
```

### Required Environment Variables (Backend)

```env
PORT=5000
DB_USER=postgres
DB_HOST=localhost
DB_NAME=attendance_db
DB_PASSWORD=your_password
DB_PORT=5432
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d
GEOFENCE_RADIUS_METERS=100
```

### Mobile App Setup

```bash
cd mobile
npm install
npx expo start
```

## 📡 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register student or lecturer |
| POST | `/api/auth/login` | Login and get JWT token |

### Classes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/classes` | List all classes (students) |

### Lecturer Routes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/lecturer/dashboard` | Lecturer dashboard |
| GET | `/api/lecturer/classes` | List lecturer's classes |
| POST | `/api/lecturer/classes` | Create a class |
| PUT | `/api/lecturer/classes/:id` | Update class |
| DELETE | `/api/lecturer/classes/:id` | Delete class |
| GET | `/api/lecturer/report/:classId` | Class attendance report |

### Student Attendance
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/attendance/sign-in` | Mark attendance (GPS verified) |
| GET | `/api/attendance/my-logs` | Student's attendance history |
| GET | `/api/attendance/report/:classId` | Class report |
| GET | `/api/attendance/report/:classId/csv` | Export CSV |

### Profile
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/profile` | Get user profile |
| PUT | `/api/profile` | Update profile |

## 📊 Database Schema

### Tables

- **students**: User accounts for students
- **lecturers**: User accounts for lecturers
- **classes**: Class information with GPS coordinates
- **attendance_logs**: Signed attendance records
- **reports**: Cached attendance reports

## 📱 Mobile App Screens

1. **Login Screen** - Role-based login (student/lecturer)
2. **Register Screen** - New user registration
3. **Home Screen** - Mark attendance with GPS
4. **Class Picker** - Select class to attend
5. **Analytics** - View personal attendance history
6. **Report Screen** - View class attendance reports

## 🔐 How It Works

### Attendance Signing

1. Student selects a class from the list
2. App gets current GPS coordinates
3. Backend calculates distance to classroom
4. If within geofence radius (default 100m), attendance is recorded
5. Student receives confirmation with actual distance

### Geofencing

The system uses the Haversine formula to calculate the great-circle distance between the student's GPS location and the classroom's registered coordinates. Students can only mark attendance when within the configured radius.

## 📄 License

ISC License
