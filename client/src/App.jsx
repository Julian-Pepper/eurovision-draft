import { useState, useCallback } from 'react'
import SongBrowser from './components/SongBrowser'
import MySubmissions from './components/MySubmissions'
import VotingPanel from './components/SubmissionPool'
import WatchSubmissions from './components/WatchSubmissions'
import './App.css'

function App() {
  const [username, setUsername] = useState(() => {
    return localStorage.getItem('eurovision_username') || ''
  })
  const [nameInput, setNameInput] = useState(username)
  const [activeTab, setActiveTab] = useState('browse')
  const [refreshKey, setRefreshKey] = useState(0)

  const handleSetName = (e) => {
    e.preventDefault()
    const name = nameInput.trim()
    if (name) {
      setUsername(name)
      localStorage.setItem('eurovision_username', name)
    }
  }

  const handleLogout = () => {
    setUsername('')
    setNameInput('')
    localStorage.removeItem('eurovision_username')
  }

  const handleChange = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1>🎤 Eurovision Smackdown</h1>
          <p className="subtitle">Submit your favourite songs & vote on the pool</p>
        </div>
        <div className="header-right">
          {username ? (
            <div className="user-info">
              <span className="welcome">Welcome, <strong>{username}</strong></span>
              <button className="logout-btn" onClick={handleLogout}>Change Name</button>
            </div>
          ) : (
            <form className="name-form" onSubmit={handleSetName}>
              <input
                type="text"
                placeholder="Enter your name..."
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                maxLength={50}
                required
              />
              <button type="submit">Join</button>
            </form>
          )}
        </div>
      </header>

      <nav className="tab-nav">
        <button
          className={`tab ${activeTab === 'browse' ? 'active' : ''}`}
          onClick={() => setActiveTab('browse')}
        >
          🎵 Browse Songs
        </button>
        <button
          className={`tab ${activeTab === 'my' ? 'active' : ''}`}
          onClick={() => setActiveTab('my')}
        >
          📋 My Submissions
        </button>
        <button
          className={`tab ${activeTab === 'watch' ? 'active' : ''}`}
          onClick={() => setActiveTab('watch')}
        >
          📺 Watch
        </button>
        <button
          className={`tab ${activeTab === 'voting' ? 'active' : ''}`}
          onClick={() => setActiveTab('voting')}
        >
          🏆 Voting
        </button>
      </nav>

      <main className="app-main">
        {activeTab === 'browse' && (
          <SongBrowser username={username} onSubmit={handleChange} />
        )}
        {activeTab === 'my' && (
          <MySubmissions username={username} onRemove={handleChange} />
        )}
        {activeTab === 'voting' && (
          <VotingPanel username={username} />
        )}
        {activeTab === 'watch' && (
          <WatchSubmissions />
        )}
      </main>
    </div>
  )
}

export default App
