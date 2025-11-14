import { useState } from 'react';
import { useRouter } from 'next/router';
import styles from '../styles/Home.module.css';

export default function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (data.success) {
        router.push('/');
      } else {
        setError('Incorrect password. Please try again.');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.title}>Login Required</h1>
        <p className={styles.description}>
          Please enter the password to access the application
        </p>

        <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: '400px', marginTop: '2rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '16px',
                border: '2px solid #eaeaea',
                borderRadius: '8px',
                outline: 'none',
              }}
              required
              autoFocus
            />
          </div>

          {error && (
            <div style={{
              color: '#f44336',
              marginBottom: '1rem',
              padding: '8px',
              backgroundColor: '#ffebee',
              borderRadius: '4px',
              fontSize: '14px',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '16px',
              backgroundColor: loading ? '#ccc' : '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: '600',
            }}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </main>
    </div>
  );
}
