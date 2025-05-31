'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

export default function Home() {
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [maxCoursesPerTerm, setMaxCoursesPerTerm] = useState(3);
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [summary, setSummary] = useState({ courses: 0, holes: 0 });
  const [step, setStep] = useState<'credentials' | 'importing' | 'complete'>('credentials');

  const addLog = (message: string) => {
    setLogs((prev) => [...prev, message]);
    // Auto-scroll to bottom
    const logsContainer = document.getElementById('logs-container');
    if (logsContainer) {
      logsContainer.scrollTop = logsContainer.scrollHeight;
    }
  };

  const searchCourses = async (searchQuery: string, apiKey: string) => {
    addLog(`Searching for courses with term: "${searchQuery}"...`);
    
    try {
      const response = await fetch(
        `https://api.golfcourseapi.com/v1/search?search_query=${encodeURIComponent(searchQuery)}`,
        {
          headers: {
            'Authorization': `Key ${apiKey}`
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`);
      }
      
      const data = await response.json();
      const coursesFound = data.courses?.length || 0;
      addLog(`Found ${coursesFound} courses for "${searchQuery}"`);
      return data.courses || [];
    } catch (error) {
      addLog(`Error searching courses: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  };

  const getCourseDetails = async (courseId: number, apiKey: string) => {
    addLog(`Fetching details for course ID: ${courseId}...`);
    
    try {
      const response = await fetch(
        `https://api.golfcourseapi.com/v1/courses/${courseId}`,
        {
          headers: {
            'Authorization': `Key ${apiKey}`
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`);
      }
      
      const courseDetails = await response.json();
      addLog(`Successfully fetched details for ${courseDetails.club_name} - ${courseDetails.course_name}`);
      return courseDetails;
    } catch (error) {
      addLog(`Error fetching details for course ${courseId}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  };

  const insertCourse = async (course: any, supabase: any) => {
    try {
      // Extract male tees (or female if male not available)
      const tees = course.tees?.male || course.tees?.female || [];
      const mainTee = tees.length > 0 ? tees[0] : null;
      
      // Generate a UUID for the course
      const courseId = uuidv4();
      
      // Map API data to your database schema
      const courseData = {
        id: courseId,
        name: `${course.club_name} - ${course.course_name}`.trim(),
        address: course.location?.address || null,
        city: course.location?.city || null,
        state: course.location?.state || null,
        country: course.location?.country || null,
        latitude: course.location?.latitude || null,
        longitude: course.location?.longitude || null,
        total_holes: mainTee?.number_of_holes || 18,
        par: mainTee?.par_total || null,
        rating: mainTee?.course_rating || null,
        slope: mainTee?.slope_rating || null,
        aggregate_score: null, // Will be calculated later based on reviews
        confidence_rating: null, // Will be calculated later
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      addLog(`Inserting course: ${courseData.name}`);
      
      // Insert course into your courses table
      const { data, error } = await supabase
        .from('courses')
        .insert([courseData])
        .select();

      if (error) {
        addLog(`Error inserting course: ${error.message}`);
        return null;
      }
      
      addLog(`Successfully inserted course: ${courseData.name} with ID: ${courseId}`);
      return data[0];
    } catch (error) {
      addLog(`Error in insertCourse: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  };

  const insertCourseHoles = async (courseId: string, holes: any[], supabase: any) => {
    try {
      if (!holes || holes.length === 0) {
        addLog(`No holes data available for course ${courseId}`);
        return false;
      }

      addLog(`Preparing to insert ${holes.length} holes for course ${courseId}`);
      
      // Map API hole data to your database schema
      const holesData = holes.map((hole, index) => ({
        id: uuidv4(),
        course_id: courseId,
        hole_number: index + 1,
        par: hole.par || 4, // Default to par 4 if missing
        distance_yards: hole.yardage || null,
        distance_meters: Math.round((hole.yardage || 0) * 0.9144) || null, // Convert yards to meters if yardage exists
        handicap_index: hole.handicap || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      // Insert holes into your course_holes table
      const { error } = await supabase
        .from('course_holes')
        .insert(holesData);

      if (error) {
        addLog(`Error inserting course holes: ${error.message}`);
        return false;
      }
      
      addLog(`Successfully inserted ${holesData.length} holes for course ${courseId}`);
      return true;
    } catch (error) {
      addLog(`Error in insertCourseHoles: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  };

  const populateDatabase = async () => {
    try {
      setIsLoading(true);
      setStep('importing');
      setLogs([]);
      setSummary({ courses: 0, holes: 0 });
      
      addLog('Starting database population process...');
      
      // Create Supabase client
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      // Search terms for different types of courses
      const searchTerms = [
        'Pebble Beach', 'Augusta', 'St Andrews', 'Pinehurst',
        'Bethpage', 'Torrey Pines', 'Whistling Straits', 'Oakmont',
        'Muirfield', 'Royal Melbourne', 'TPC Sawgrass', 'Kiawah Island'
      ];
      
      let totalCoursesAdded = 0;
      let totalHolesAdded = 0;
      
      for (const term of searchTerms) {
        // Search for courses with this term
        const courses = await searchCourses(term, apiKey);
        
        // Limit to specified number of courses per search term
        const coursesToProcess = courses.slice(0, maxCoursesPerTerm);
        
        for (const course of coursesToProcess) {
          // Get detailed course information
          const courseDetails = await getCourseDetails(course.id, apiKey);
          
          if (courseDetails) {
            // Insert course into database
            const insertedCourse = await insertCourse(courseDetails, supabase);
            
            if (insertedCourse) {
              // Get holes from the first tee box (male or female)
              const tees = courseDetails.tees?.male || courseDetails.tees?.female || [];
              const holes = tees.length > 0 ? tees[0].holes : [];
              
              // Insert holes data
              const holesSuccess = await insertCourseHoles(insertedCourse.id, holes, supabase);
              
              if (holesSuccess) {
                totalHolesAdded += holes.length;
              }
              
              totalCoursesAdded++;
            }
          }
          
          // Add a small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 2500));
        }
      }
      
      addLog(`Database population complete!`);
      addLog(`Successfully added ${totalCoursesAdded} courses with ${totalHolesAdded} holes to the database`);
      
      setSummary({
        courses: totalCoursesAdded,
        holes: totalHolesAdded
      });
      
      setStep('complete');
    } catch (error) {
      addLog(`Error in populateDatabase: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    populateDatabase();
  };

  const resetForm = () => {
    setStep('credentials');
    setLogs([]);
    setSummary({ courses: 0, holes: 0 });
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-6 md:p-24">
      <div className="w-full max-w-3xl">
        <h1 className="text-3xl font-bold mb-6 text-center">Fairway Finder Data Populator</h1>
        
        {step === 'credentials' && (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Enter Your Credentials</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="supabaseUrl" className="block text-sm font-medium text-gray-700 mb-1">
                  Supabase URL
                </label>
                <input
                  type="text"
                  id="supabaseUrl"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="https://your-project.supabase.co"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="supabaseKey" className="block text-sm font-medium text-gray-700 mb-1">
                  Supabase Anon Key
                </label>
                <input
                  type="password"
                  id="supabaseKey"
                  value={supabaseKey}
                  onChange={(e) => setSupabaseKey(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="your-supabase-anon-key"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-1">
                  Golf Course API Key
                </label>
                <input
                  type="password"
                  id="apiKey"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="your-golf-course-api-key"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="maxCourses" className="block text-sm font-medium text-gray-700 mb-1">
                  Max Courses Per Search Term
                </label>
                <select
                  id="maxCourses"
                  value={maxCoursesPerTerm}
                  onChange={(e) => setMaxCoursesPerTerm(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value={1}>1 course per term</option>
                  <option value={2}>2 courses per term</option>
                  <option value={3}>3 courses per term</option>
                  <option value={5}>5 courses per term</option>
                </select>
                <p className="text-sm text-gray-500 mt-1">
                  This will search for {maxCoursesPerTerm} courses across 12 search terms (up to {maxCoursesPerTerm * 12} total courses)
                </p>
              </div>
              
              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition"
                  disabled={isLoading}
                >
                  {isLoading ? 'Processing...' : 'Populate Database'}
                </button>
              </div>
            </form>
          </div>
        )}
        
        {(step === 'importing' || step === 'complete') && (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                {step === 'importing' ? 'Importing Golf Course Data...' : 'Import Complete'}
              </h2>
              {step === 'complete' && (
                <button
                  onClick={resetForm}
                  className="bg-blue-600 text-white py-1 px-3 rounded-md hover:bg-blue-700 transition text-sm"
                >
                  Start New Import
                </button>
              )}
            </div>
            
            {step === 'complete' && (
              <div className="mb-4 bg-green-50 p-4 rounded-md border border-green-200">
                <h3 className="font-semibold text-green-800 mb-2">Summary</h3>
                <p className="text-green-700">Successfully added {summary.courses} courses with {summary.holes} holes to your database.</p>
              </div>
            )}
            
            <div className="border rounded-md">
              <div className="bg-gray-100 px-4 py-2 border-b font-medium">Process Logs</div>
              <div 
                id="logs-container"
                className="h-80 overflow-y-auto p-4 font-mono text-sm bg-black text-green-400"
              >
                {logs.length === 0 ? (
                  <p className="text-gray-500">Waiting to start...</p>
                ) : (
                  logs.map((log, index) => (
                    <div key={index} className="mb-1">
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
        
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>This tool populates your Fairway Finder database with golf course data from the Golf Course API.</p>
          <p className="mt-1">Your credentials are only used for this import and are not stored anywhere.</p>
        </div>
      </div>
    </main>
  );
}
