# Mobileapp_Attendance

A GPS-based attendance tracking system with a Node.js/Express backend and React Native (Expo) mobile app. Students can mark attendance only when physically present within the classroom's geofenced area, with selfie-based identity verification.

## 📱 Features

- **GPS Attendance**: Students must be within the classroom geofence to sign in
- **Selfie Verification**: Identity verification via camera selfie before marking attendance
- **Role-Based Access**: Separate flows for Students and Lecturers with different dashboards
- **Real-Time Tracking**: Instant attendance logging with distance verification
- **Class Management**: Lecturers can create, edit, and manage their classes with GPS venues
- **Attendance Reports**: View attendance rates, filter by date, and export to CSV
- **Push Notifications**: Local notifications for attendance confirmation and class reminders
- **Profile Management**: Upload profile photos, edit personal details
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
- **Camera**: expo-camera (for selfie verification)
- **Image Picker**: expo-image-picker (for profile photos)
- **Notifications**: expo-notifications
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
│   │   ├── classController.js       # Class listing
│   │   ├── lecturerController.js    # Class CRUD & Dashboard
│   │   └── profileController.js     # User profiles
│   ├── db/
│   │   ├── schema.js     # Database tables
│   │   └── geoService.js # Haversine distance calc
│   ├── middleware/
│   │   └── auth.js       # JWT & role protection
│   ├── routes/
│   │   └── api.js        # All API routes
│   ├── index.js          # Express app entry point
│   └── package.json
│
├── mobile/
│   ├── src/
│   │   ├── screens/
│   │   │   ├── LoginScreen.js            # Role-based login
│   │   │   ├── RegisterScreen.js      # New user registration
│   │   │   ├── HomeScreen.js          # Mark attendance (students)
│   │   │   ├── ClassPickerScreen.js   # Select class to attend
│   │   │   ├── AnalyticsScreen.js    # My attendance history
│   │   │   ├── ReportScreen.js        # View class reports
│   │   │   ├── ProfileScreen.js       # Edit profile & photo
│   │   │   ├── LecturerDashboardScreen.js # Lecturer stats & actions
│   │   │   └── ManageClassesScreen.js  # Class CRUD (lecturers)
│   │   └── services/
│   │       ├── api.js           # Axios API client
│   │       └── notifications.js # Push notifications
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

### Authentication (Public)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register student or lecturer |
| POST | `/api/auth/login` | Login and get JWT token |

### Profile (Both Roles)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/profile` | Get user profile |
| PUT | `/api/profile` | Update profile (name, phone, department, photo) |

### Classes (Both Roles)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/classes` | List all available classes |

### Lecturer Routes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/lecturer/dashboard` | Dashboard with stats |
| GET | `/api/lecturer/classes` | List lecturer's classes |
| POST | `/api/lecturer/classes` | Create a class |
| PUT | `/api/lecturer/classes/:id` | Update class |
| DELETE | `/api/lecturer/classes/:id` | Delete class |
| GET | `/api/lecturer/report/:classId` | Class attendance report |

### Student Attendance
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/attendance/sign-in` | Mark attendance (GPS + selfie verified) |
| GET | `/api/attendance/my-logs` | Student's attendance history |
| GET | `/api/attendance/report/:classId` | Class report |
| GET | `/api/attendance/report/:classId/csv` | Export CSV |

## 📊 Database Schema

### Tables

- **users**: Unified user account table (students & lecturers)
- **classes**: Class information with GPS coordinates (classroom_lat, classroom_lng)
- **attendance_logs**: Signed attendance records with GPS & selfie data
- **reports**: Cached attendance reports

## 📱 Mobile App Screens

### Student Screens
1. **Login Screen** - Role-based login (student/lecturer)
2. **Register Screen** - New user registration
3. **Home Screen** - Mark attendance with GPS + selfie verification
4. **Class Picker** - Select class to attend
5. **Analytics** - View personal attendance history
6. **Report Screen** - View class attendance reports
7. **Profile Screen** - Edit profile and upload photo

### Lecturer Screens
1. **Login/Register** - Same as students
2. **Lecturer Dashboard** - Stats (total classes, today's sign-ins) and quick actions
3. **Manage Classes** - Create, edit, delete classes with GPS venue setting
4. **Attendance Reports** - View and generate CSV reports
5. **Profile Screen** - Edit profile with department

## 🔐 How It Works

### Student Attendance Flow

1. Student logs in and selects a class from the list
2. App requests current GPS coordinates
3. App requires a selfie for identity verification
4. Backend calculates distance to classroom using Haversine formula
5. If within geofence radius AND selfie provided, attendance is recorded
6. Confirmation shown with actual distance measured

### Geofencing

The system uses the Haversine formula to calculate the great-circle distance between the student's GPS location and the classroom's registered coordinates. Students can only mark attendance when within the configured radius (default 100m).

### Lecturer Class Management

1. Lecturers can create classes with name, course code, and GPS venue
2. GPS venue can be set via "Use My Current Location" or manual entry
3. Classes can be edited or deleted at any time
4. Dashboard shows real-time stats: total classes and today's sign-ins

## 🔔 Notifications

- **Attendance Confirmation**: Local notification when attendance is successfully marked
- **Class Reminders**: Scheduled notifications before class starts (15 min default)
- **Android Channels**: Custom notification channel for attendance alerts

## 📄 License

ISC License
