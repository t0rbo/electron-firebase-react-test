# Money Moves - Electron App with Google Auth

This is an Electron desktop application with Firebase and Google Authentication.

## Prerequisites

- Node.js (v16.0.0 or later)
- npm (v7.0.0 or later)
- Firebase account

## Getting Started

1. Clone the repository:
   ```
   git clone <repository-url>
   cd electron-firebase-auth
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Firebase Configuration:
   - Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
   - Enable Google Authentication in the Authentication section
   - Create a Realtime Database
   - Update the Firebase configuration in `src/firebase/config.ts` with your project credentials:
     ```typescript
     const firebaseConfig = {
       apiKey: "YOUR_API_KEY",
       authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
       projectId: "YOUR_PROJECT_ID",
       storageBucket: "YOUR_PROJECT_ID.appspot.com",
       messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
       appId: "YOUR_APP_ID",
       measurementId: "YOUR_MEASUREMENT_ID",
       databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com"
     };
     ```

4. Service Account Configuration:
   - In your Firebase project settings, go to "Service accounts"
   - Click "Generate new private key" to download a JSON file
   - Rename the downloaded file to `serviceAccountKey.json` and place it in the root directory of the project
   - Ensure the JSON file contains the necessary credentials as shown in `serviceAccountKey.example.json`

5. Environment Variables:
   - Create a `.env` file in the root directory based on the `.env.example` file
   - Fill in your Firebase credentials and other configuration values:
     ```
     # Firebase Configuration
     VITE_FIREBASE_API_KEY=your_api_key
     VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
     VITE_FIREBASE_PROJECT_ID=your_project_id
     VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
     VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
     VITE_FIREBASE_APP_ID=your_app_id
     VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id

     # Google OAuth
     VITE_GOOGLE_CLIENT_ID=your_google_client_id
     VITE_GOOGLE_CLIENT_SECRET=your_google_client_secret

     # Other configuration
     VITE_APP_NAME=Money Moves
     ```

## Running the Application

### Development Mode

Run the application in development mode with hot reload:
```
npm run dev:electron
```

### Build and Start

Build the application and run it:
```
npm run auth
```

### Build for Distribution

Build the desktop application for your platform:
```
npm run build
```

The built application will be available in the `release` folder.

## Deployment (Web Version)

Build and deploy the web version to Firebase hosting:
```
npm run deploy
```
