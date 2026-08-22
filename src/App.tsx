import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import TimerDevPage from './pages/dev/TimerDevPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/dev/timer" element={<TimerDevPage />} />
    </Routes>
  );
}

export default App;
