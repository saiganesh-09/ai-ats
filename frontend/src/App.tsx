import { Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './auth'
import Navbar from './components/Navbar'
import JobBoard from './pages/JobBoard'
import JobDetail from './pages/JobDetail'
import Login from './pages/Login'
import MyApplications from './pages/MyApplications'
import MyJobs from './pages/recruiter/MyJobs'
import JobPipeline from './pages/recruiter/JobPipeline'
import Register from './pages/Register'
import Resumes from './pages/Resumes'

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Routes>
          <Route path="/" element={<JobBoard />} />
          <Route path="/jobs/:id" element={<JobDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/resumes"
            element={
              <ProtectedRoute role="candidate">
                <Resumes />
              </ProtectedRoute>
            }
          />
          <Route
            path="/applications"
            element={
              <ProtectedRoute role="candidate">
                <MyApplications />
              </ProtectedRoute>
            }
          />
          <Route
            path="/recruiter/jobs"
            element={
              <ProtectedRoute role="recruiter">
                <MyJobs />
              </ProtectedRoute>
            }
          />
          <Route
            path="/recruiter/jobs/:id"
            element={
              <ProtectedRoute role="recruiter">
                <JobPipeline />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
    </div>
  )
}
