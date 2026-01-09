# Firebase and Vercel Setup Guide

This guide walks you through setting up Firebase Firestore as the database and deploying Flux to Vercel.

## Prerequisites

- Node.js 21+
- pnpm 10+
- A Google Cloud/Firebase account
- A Vercel account

## Part 1: Firebase Setup

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select an existing project
3. Follow the setup wizard to create your project

### 2. Enable Firestore Database

1. In your Firebase project, navigate to **Build** → **Firestore Database**
2. Click "Create database"
3. Choose a location for your Firestore database (choose one close to your users)
4. Start in **production mode** (we'll deploy security rules shortly)

### 3. Deploy Firestore Security Rules

From your project root, deploy the Firestore rules and indexes:

```bash
# Install Firebase CLI if you haven't already
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase in your project
firebase init firestore

# When prompted:
# - Select your Firebase project
# - Use firestore.rules for rules
# - Use firestore.indexes.json for indexes

# Deploy rules and indexes
firebase deploy --only firestore:rules,firestore:indexes
```

### 4. Create a Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project
3. Navigate to **IAM & Admin** → **Service Accounts**
4. Click "Create Service Account"
   - Name: `flux-service-account` (or your preferred name)
   - Description: "Service account for Flux application"
5. Click "Create and Continue"
6. Grant the role: **Cloud Datastore User** (or **Firebase Admin SDK Administrator Service Agent**)
7. Click "Continue" and then "Done"
8. Find your new service account in the list and click on it
9. Go to the **Keys** tab
10. Click "Add Key" → "Create new key"
11. Choose **JSON** format
12. Click "Create" - a JSON file will download to your computer

**Important:** Keep this JSON file secure! It provides full access to your Firestore database.

### 5. Configure Firestore Indexes (Optional)

The `firestore.indexes.json` file includes indexes for common queries. If you need additional indexes, Firestore will suggest them when you run queries that require them.

## Part 2: Local Development with Firebase

### 1. Set up Environment Variables

Create a `.env` file in your project root:

```bash
cp .env.example .env
```

Edit `.env` and add your Firebase service account:

**Option A: JSON String (Recommended for Vercel)**
```env
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"your-project-id",...}'
```

**Option B: File Path (Easier for Local Development)**
```env
FIREBASE_SERVICE_ACCOUNT_PATH=/absolute/path/to/serviceAccountKey.json
```

### 2. Build and Run Locally

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run the server
pnpm --filter @flux/server start
```

The server will automatically detect Firebase credentials and use Firestore instead of the file-based storage.

### 3. Verify Firebase Connection

When the server starts, you should see:
```
Initializing Firebase storage adapter...
Firebase initialized with service account from env var
✓ Using Firebase Firestore for data storage
Flux server running at http://localhost:3000
```

## Part 3: Vercel Deployment

### 1. Install Vercel CLI (Optional)

```bash
npm install -g vercel
```

### 2. Prepare for Deployment

Ensure all packages are built:

```bash
pnpm build
```

### 3. Deploy to Vercel

**Option A: Using Vercel CLI**

```bash
# Login to Vercel
vercel login

# Deploy (first time)
vercel

# Follow the prompts:
# - Set up and deploy? Yes
# - Which scope? (select your team/personal account)
# - Link to existing project? No
# - Project name: flux (or your preferred name)
# - Directory: ./ (root)

# Deploy to production
vercel --prod
```

**Option B: Using Vercel Dashboard**

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New..." → "Project"
3. Import your Git repository (GitHub, GitLab, or Bitbucket)
4. Configure your project:
   - **Framework Preset:** Other
   - **Build Command:** `pnpm build`
   - **Output Directory:** Leave empty (we use custom routes)
   - **Install Command:** `pnpm install`

### 4. Configure Environment Variables in Vercel

1. In your Vercel project dashboard, go to **Settings** → **Environment Variables**
2. Add the following variable:

   **Key:** `FIREBASE_SERVICE_ACCOUNT`

   **Value:** Paste the entire contents of your service account JSON file (as a single line)

   **Environments:** Select all (Production, Preview, Development)

3. Click "Save"

### 5. Redeploy

After adding environment variables, trigger a new deployment:

```bash
# Using CLI
vercel --prod

# Or using dashboard
# Go to Deployments tab and click "Redeploy"
```

### 6. Verify Deployment

Visit your Vercel deployment URL (e.g., `https://your-app.vercel.app`)

You should see the Flux application running with data stored in Firebase Firestore.

## Part 4: Configuration Options

### Storage Adapter Selection

The server automatically detects which storage adapter to use:

1. **Firebase Firestore** (Production): If `FIREBASE_SERVICE_ACCOUNT` or `FIREBASE_SERVICE_ACCOUNT_PATH` is set
2. **File-based** (Development): If no Firebase credentials are configured

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `FIREBASE_SERVICE_ACCOUNT` | Service account JSON as string | Yes (for Firebase) |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Path to service account JSON file | Alternative to above |
| `PORT` | Server port (default: 3000) | No |
| `NODE_ENV` | Environment mode | No |

## Part 5: Firestore Data Structure

Flux stores data in the following Firestore collections:

- **projects**: Kanban projects
- **epics**: Epic swimlanes within projects
- **tasks**: Individual tasks
- **webhooks**: Webhook configurations
- **webhook_deliveries**: Webhook delivery history

Each document's ID matches the entity's `id` field in the application.

## Monitoring and Debugging

### View Firestore Data

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Navigate to **Firestore Database**
3. Browse your collections and documents

### View Vercel Logs

```bash
# Using CLI
vercel logs

# Or view in dashboard
# Project → Deployments → Select deployment → Runtime Logs
```

### Common Issues

**Issue: "Firebase initialization failed"**
- Verify your service account JSON is valid
- Check that the service account has correct permissions
- Ensure the project ID in the JSON matches your Firebase project

**Issue: "Permission denied" errors in Firestore**
- Review your `firestore.rules` file
- Ensure rules are deployed: `firebase deploy --only firestore:rules`
- For development, you can temporarily allow all access (not recommended for production)

**Issue: Vercel build fails**
- Ensure all packages build successfully locally: `pnpm build`
- Check Vercel build logs for specific errors
- Verify `vercel.json` configuration is correct

## Rollback to File Storage

If you need to switch back to file-based storage:

1. Remove the `FIREBASE_SERVICE_ACCOUNT` environment variable
2. Restart the server
3. The server will automatically fall back to file-based storage

## Cost Considerations

### Firebase Firestore

- **Free tier**: 1 GB storage, 50K reads, 20K writes, 20K deletes per day
- **Pricing**: Beyond free tier, pay-as-you-go
- For typical Flux usage with small teams, the free tier should be sufficient

### Vercel

- **Hobby plan** (Free): Suitable for personal projects
- **Pro plan** ($20/month): For production applications
- Includes bandwidth, serverless function executions

## Security Best Practices

1. **Never commit** service account JSON files to version control
2. **Use environment variables** for all credentials
3. **Review Firestore security rules** regularly
4. **Enable Firebase App Check** for additional security (optional)
5. **Rotate service account keys** periodically

## Support

For issues related to:
- **Flux application**: [GitHub Issues](https://github.com/danraceproducts/flux/issues)
- **Firebase**: [Firebase Support](https://firebase.google.com/support)
- **Vercel**: [Vercel Support](https://vercel.com/support)

## Next Steps

- Configure webhooks to integrate with other services
- Set up custom domain in Vercel
- Enable Vercel Analytics
- Configure Firebase monitoring and alerts
- Set up automated backups of Firestore data
