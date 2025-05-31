# Fairway Finder Data Populator - Deployment Guide

This guide will help you deploy the Golf Course Data Populator tool to Vercel and use it to populate your Fairway Finder database with real golf course data.

## What This Tool Does

The Golf Course Data Populator is a simple web application that:

1. Connects to your Supabase database using credentials you provide
2. Fetches golf course data from the Golf Course API using your API key
3. Inserts courses and course holes into your database
4. Shows real-time progress and a summary of imported data

## Deployment Instructions

### 1. Download the Project

First, download the project files from this conversation.

### 2. Deploy to Vercel

Since you already have a Vercel account (where your main Fairway Finder app is deployed), deploying this tool is simple:

1. Go to [vercel.com](https://vercel.com) and log in
2. Click "Add New..." → "Project"
3. Import the golf-data-populator project from your GitHub (you'll need to push it there first) or upload the files directly
4. Keep all default settings and click "Deploy"
5. Wait for the deployment to complete (usually takes less than a minute)
6. Vercel will provide you with a URL for your deployed application (e.g., `https://golf-data-populator.vercel.app`)

### 3. Using the Tool

Once deployed, you can use the tool by:

1. Visit the URL provided by Vercel
2. Enter your credentials:
   - **Supabase URL**: Find this in your Supabase dashboard under Settings → API
   - **Supabase Anon Key**: Find this in your Supabase dashboard under Settings → API
   - **Golf Course API Key**: Your existing Golf Course API key
3. Select how many courses to import per search term (3 is recommended to start)
4. Click "Populate Database" and watch the progress in real-time
5. When complete, you'll see a summary of the courses and holes added

## Important Notes

- **Security**: Your credentials are only used in the browser and are never stored or sent to any server other than Supabase and the Golf Course API
- **Database Access**: Make sure Row Level Security (RLS) is disabled on your courses and course_holes tables, or that appropriate policies are in place
- **Rate Limiting**: The tool includes delays between API calls to avoid rate limiting
- **Temporary Tool**: This is meant to be a temporary tool for populating your database. Once you've added the data you need, you can delete the deployment

## Troubleshooting

If you encounter any issues:

1. **API Key Issues**: Ensure your Golf Course API key is correct and properly formatted
2. **Supabase Connection Issues**: Verify your Supabase URL and anon key
3. **Database Errors**: Check that RLS is disabled on the tables or that appropriate policies are in place

## Next Steps After Population

Once your database has courses and holes:

1. Test the course search functionality in your Fairway Finder app
2. Add some test reviews for these courses
3. Create sample rounds to simulate user activity
4. Re-enable RLS with appropriate security policies when ready for production

This will give you a solid foundation of realistic data to continue developing your Fairway Finder app.
