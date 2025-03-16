import { AuthProvider, useAuth } from './contexts/AuthContext'
import './App.css'
import MainProcessLogs from './components/MainProcessLogs'
import { GoogleAuthService } from './services/googleAuthService'

// Login component that uses the auth context
const Login = () => {
  const { login, loading, error } = useAuth()

  const handleGoogleAuth = async () => {
    try {
      console.log('Testing Google Auth directly...')
      await GoogleAuthService.initialize()
      const { user } = await GoogleAuthService.signIn()
      console.log('Google Auth Success!', user)
    } catch (err) {
      console.error('Google Auth Error:', err)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Welcome</h2>
      <p className="mb-6 text-gray-600">Please sign in to continue</p>
      
      <button
        onClick={login}
        disabled={loading}
        className="w-full py-2 px-4 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 disabled:opacity-50 disabled:cursor-not-allowed mb-4"
      >
        {loading ? 'Signing in...' : 'Sign in with Google'}
      </button>
      
      <button
        onClick={handleGoogleAuth}
        className="w-full py-2 px-4 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75 mt-2"
      >
        Test Direct Google Auth
      </button>
      
      {error && (
        <div className="mt-4 p-2 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}
    </div>
  )
}

// Dashboard component shown when user is logged in
const Dashboard = () => {
  const { user, logout } = useAuth()
  
  console.log('Dashboard rendering with user data:', user);

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Welcome, {user?.displayName || 'User'}!</h2>
      
      <div className="flex flex-col items-center mb-6 w-full">
        {user?.photoURL && (
          <img 
            src={user.photoURL} 
            alt="Profile" 
            className="w-16 h-16 rounded-full mb-3"
          />
        )}
        <div className="text-center w-full">
          {user?.email && (
            <p className="text-lg font-medium text-blue-700 mb-1">{user.email}</p>
          )}
          <p className="text-sm text-gray-500">
            {user?.emailVerified ? 'Email verified' : 'Email not verified'}
          </p>
        </div>
      </div>
      
      <button
        onClick={logout}
        className="w-full py-2 px-4 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75"
      >
        Sign out
      </button>
    </div>
  )
}

// Main content component that shows either Login or Dashboard
const MainContent = () => {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return user ? <Dashboard /> : <Login />
}

// Main App component
function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <MainContent />
          <MainProcessLogs />
        </div>
      </div>
    </AuthProvider>
  )
}

export default App
