import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Bar, Pie } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [events, setEvents] = useState([]);
  const [churnUsers, setChurnUsers] = useState([]);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const eventsPerPage = 10;
  const router = useRouter();
  const [eventType, setEventType] = useState('');
  const [userIdFilter, setUserIdFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    const query = new URLSearchParams();
    if (eventType) query.append('eventType', eventType);
    if (userIdFilter) query.append('userID', userIdFilter);
    if (startDate) query.append('startDate', startDate);
    if (endDate) query.append('endDate', endDate);

    fetch(`http://localhost:5000/api/dashboard/stats?${query.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(res => {
        if (res.message === 'Invalid token') {
          localStorage.removeItem('token');
          router.push('/login');
        } else {
          setData(res);
        }
      })
      .catch(() => setError('Failed to load data'));

    fetch(`http://localhost:5000/api/dashboard/overview?${query.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(setEvents)
      .catch(() => console.error('Failed to load events'));
  }, [eventType, userIdFilter, startDate, endDate]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    fetch("http://localhost:5000/api/dashboard/churn-users", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(setChurnUsers)
      .catch(() => console.error("Failed to load churn users"));
  }, []);

  const handleExportCSV = () => {
    const headers = ['Timestamp', 'Event', 'User ID', 'Data'];
    const rows = events.map(e => [
      new Date(e.timestamp).toLocaleString(),
      e.event,
      e.userID || 'Anonymous',
      JSON.stringify(e.data)
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'events.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const paginatedEvents = events.slice((currentPage - 1) * eventsPerPage, currentPage * eventsPerPage);
  const totalPages = Math.ceil(events.length / eventsPerPage);

  if (error) return <p className="text-center mt-10 text-red-500">{error}</p>;
  if (!data) return <p className="text-center mt-10">Loading dashboard...</p>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Client Dashboard</h1>
        <button
          onClick={() => {
            localStorage.removeItem('token');
            router.push('/login');
          }}
          className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
        >
          Logout
        </button>
      </div>

      <div className="bg-white p-4 rounded shadow mb-6 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm font-medium">Event Type</label>
          <select className="border p-2 rounded" value={eventType} onChange={(e) => setEventType(e.target.value)}>
            <option value="">All</option>
            <option value="interaction">Interaction</option>
            <option value="scrollDepth">Scroll Depth</option>
            <option value="sessionDuration">Session Duration</option>
            <option value="deviceInfo">Device Info</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium">User ID</label>
          <input
            type="text"
            className="border p-2 rounded"
            placeholder="user_abc123"
            value={userIdFilter}
            onChange={(e) => setUserIdFilter(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Start Date</label>
          <input
            type="date"
            className="border p-2 rounded"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium">End Date</label>
          <input
            type="date"
            className="border p-2 rounded"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        <div className="ml-auto">
          <button
            onClick={handleExportCSV}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card label="Total Events" value={data.totalEvents} />
        <Card label="Total Sessions" value={data.totalSessions} />
        <Card label="Avg. Session Duration (ms)" value={data.avgSessionDuration} />
        <Card label="Avg. Scroll Depth (%)" value={data.avgScrollDepth} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
        <div className="bg-white p-4 rounded shadow">
          <h3 className="text-lg font-semibold mb-4">Event Types</h3>
          <Bar
            data={{
              labels: Object.keys(data.eventCounts),
              datasets: [{
                label: 'Event Count',
                data: Object.values(data.eventCounts),
                backgroundColor: 'rgba(59, 130, 246, 0.6)',
                borderRadius: 6,
              }],
            }}
            options={{
              responsive: true,
              animation: { duration: 1000, easing: 'easeOutBounce' },
              scales: { y: { beginAtZero: true } },
            }}
          />
        </div>

        <div className="bg-white p-4 rounded shadow">
          <h3 className="text-lg font-semibold mb-4">Top Users</h3>
          <Pie
            data={{
              labels: data.topUsers.map(u => u.userID || 'Anonymous'),
              datasets: [{
                data: data.topUsers.map(u => u.eventCount),
                backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6366f1'],
              }],
            }}
            options={{
              responsive: true,
              animation: { animateRotate: true, duration: 1200, easing: 'easeInOutCirc' },
            }}
          />
        </div>
      </div>

      <h2 className="text-xl font-semibold mb-6 mt-10">Recent Events</h2>
      <div className="overflow-auto max-h-[400px] border rounded-lg mb-10">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-100 sticky top-0">
            <tr>
              <th className="p-2">Timestamp</th>
              <th className="p-2">Event</th>
              <th className="p-2">User ID</th>
              <th className="p-2">Data</th>
            </tr>
          </thead>
          <tbody>
            {paginatedEvents.map((e, idx) => (
              <tr key={idx} className="border-t">
                <td className="p-2">{new Date(e.timestamp).toLocaleString()}</td>
                <td className="p-2">{e.event}</td>
                <td className="p-2">{e.userID || 'Anonymous'}</td>
                <td className="p-2 text-xs text-gray-600">{JSON.stringify(e.data)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-center mt-4 gap-2">
        {[...Array(totalPages)].map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentPage(index + 1)}
            className={`px-3 py-1 rounded ${currentPage === index + 1 ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          >
            {index + 1}
          </button>
        ))}
      </div>

      <h2 className="text-xl font-semibold mb-6 mt-10">Churn Risk by User</h2>
      <div className="overflow-auto max-h-[400px] border rounded-lg mb-6">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-100 sticky top-0">
            <tr>
              <th className="p-2">User ID</th>
              <th className="p-2">Churn Score</th>
              <th className="p-2">Risk Level</th>
            </tr>
          </thead>
          <tbody>
            {churnUsers.length === 0 ? (
              <tr><td colSpan="3" className="p-4 text-center text-gray-500">No data available</td></tr>
            ) : (
              churnUsers.map((u, i) => {
                const score = parseFloat(u.churnScore);
                let risk = 'Low', color = 'bg-green-100 text-green-800';
                if (score >= 0.7) {
                  risk = 'High'; color = 'bg-red-100 text-red-800';
                } else if (score >= 0.3) {
                  risk = 'Medium'; color = 'bg-yellow-100 text-yellow-800';
                }
                return (
                  <tr key={i} className="border-t">
                    <td className="p-2">{u.userID}</td>
                    <td className="p-2">{score}</td>
                    <td className="p-2">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${color}`}>
                        {risk}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ label, value }) {
  return (
    <div className="bg-white p-4 shadow rounded">
      <h3 className="text-gray-600 text-sm">{label}</h3>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}
