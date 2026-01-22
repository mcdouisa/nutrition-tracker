# Firebase Setup Guide

## Step 1: Fix npm Cache (Required for Firebase Installation)

Run this command to fix the npm permission issue:

```bash
sudo chown -R 501:20 "/Users/isaacmcdougal/.npm"
```

Then install Firebase:

```bash
cd /Users/isaacmcdougal/nutrition-tracker
npm install firebase
```

## Step 2: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Add project"
3. Name it something like "nutrition-tracker"
4. Disable Google Analytics (optional)
5. Click "Create project"

## Step 3: Enable Authentication

1. In your Firebase project, click "Authentication" in the left sidebar
2. Click "Get started"
3. Click on "Email/Password" under "Sign-in method"
4. Enable it and click "Save"

## Step 4: Create Firestore Database

1. Click "Firestore Database" in the left sidebar
2. Click "Create database"
3. Choose "Start in **production mode**" (we'll add security rules later)
4. Choose your region (pick closest to you)
5. Click "Enable"

## Step 5: Get Your Firebase Config

1. Click the gear icon ⚙️ next to "Project Overview"
2. Click "Project settings"
3. Scroll down to "Your apps"
4. Click the web icon `</>`
5. Register your app with a nickname like "nutrition-tracker-web"
6. Copy the config values from the `firebaseConfig` object

## Step 6: Create `.env.local` File

Create a file named `.env.local` in the nutrition-tracker directory with your Firebase config:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

## Step 7: Set Up Firestore Security Rules

In Firebase Console > Firestore Database > Rules, replace the rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // User nutrition data
    match /users/{userId}/nutrition/{date} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Click "Publish"

## Step 8: Restart Dev Server

After setting up `.env.local`, restart your dev server:

```bash
# Stop the current server (Ctrl+C)
npm run dev
```

## What You'll Get

- **User Authentication**: Sign up and login with email/password
- **Cloud Sync**: All your nutrition data saved to Firestore
- **Multi-device**: Access your data from any device
- **History**: View past days/weeks/months of tracking
- **Persistence**: Data survives browser cache clears

## Data Structure

Your data will be stored like this:

```
users/{userId}/
  - email
  - settings (checklist items, nutrition metrics, water buttons, meals)

users/{userId}/nutrition/{date}/
  - checklistItems
  - nutritionMetrics
  - water
  - waterHistory
  - nutritionHistory
  - timestamp
```
