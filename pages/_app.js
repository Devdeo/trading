import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

function MyApp({ Component, pageProps }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      if (router.pathname === '/login') {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/auth/verify');
        const data = await response.json();

        if (data.authenticated) {
          setAuthenticated(true);
        } else {
          router.push('/login');
        }
      } catch (error) {
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router.pathname]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '18px',
      }}>
        Loading...
      </div>
    );
  }

  if (router.pathname === '/login') {
    return <Component {...pageProps} />;
  }

  if (!authenticated) {
    return null;
  }

  return (
    <>
       <Component {...pageProps} />
    </>
  );
}

export default MyApp
