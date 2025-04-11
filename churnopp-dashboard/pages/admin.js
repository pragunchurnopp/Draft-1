import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import toast, { Toaster } from 'react-hot-toast';

export default function AdminPanel() {
  const [clients, setClients] = useState([]);
  const [newClient, setNewClient] = useState({ email: '', password: '', subscriptionPlan: 'basic' });
  const [editClient, setEditClient] = useState(null);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const clientsPerPage = 5;
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      router.push('/admin-login');
      return;
    }

    fetch('http://localhost:5000/api/admin/clients', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => {
        if (!res.ok) throw new Error('Unauthorized');
        return res.json();
      })
      .then(setClients)
      .catch(() => {
        localStorage.removeItem('admin_token');
        router.push('/admin-login');
      });
  }, []);

  const fetchClients = async () => {
    const token = localStorage.getItem('admin_token');
    try {
      const res = await fetch('http://localhost:5000/api/admin/clients', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setClients(data);
    } catch (err) {
      toast.error('Failed to fetch clients');
    }
  };

  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleCreateClient = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('admin_token');

    if (!isValidEmail(newClient.email)) {
      return toast.error('Please enter a valid email');
    }
    if (!['basic', 'premium', 'enterprise'].includes(newClient.subscriptionPlan)) {
      return toast.error('Invalid subscription plan');
    }

    try {
      const res = await fetch('http://localhost:5000/api/admin/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newClient),
      });
      if (!res.ok) throw new Error('Create failed');
      await fetchClients();
      toast.success('Client created successfully');
      setNewClient({ email: '', password: '', subscriptionPlan: 'basic' });
    } catch (err) {
      toast.error('Failed to create client');
    }
  };

  const handleDeleteClient = async (id) => {
    const token = localStorage.getItem('admin_token');
    try {
      await fetch(`http://localhost:5000/api/admin/clients/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchClients();
      toast.success('Client deleted');
    } catch (err) {
      toast.error('Failed to delete client');
    }
  };

  const handleEditSave = async () => {
    const token = localStorage.getItem('admin_token');

    if (!isValidEmail(editClient.email)) {
      return toast.error('Please enter a valid email');
    }
    if (!['basic', 'premium', 'enterprise'].includes(editClient.subscriptionPlan)) {
      return toast.error('Invalid subscription plan');
    }

    const updates = {
      email: editClient.email,
      subscriptionPlan: editClient.subscriptionPlan,
    };

    if (editClient.newPassword) {
      updates.password = editClient.newPassword;
    }

    try {
      await fetch(`http://localhost:5000/api/admin/clients/${editClient._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates)
      });
      setEditClient(null);
      await fetchClients();
      toast.success('Client updated');
    } catch (err) {
      toast.error('Failed to update client');
    }
  };

  const filteredClients = clients.filter(client =>
    client.email.toLowerCase().includes(search.toLowerCase())
  );
  const paginatedClients = filteredClients.slice((currentPage - 1) * clientsPerPage, currentPage * clientsPerPage);
  const totalPages = Math.ceil(filteredClients.length / clientsPerPage);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Toaster />
      <h1 className="text-2xl font-bold mb-6">Admin Panel - Client Management</h1>

      {error && <p className="text-red-500 mb-4">{error}</p>}

      <form onSubmit={handleCreateClient} className="mb-6 space-y-4">
        <h2 className="text-xl font-semibold">Add New Client</h2>
        <div className="grid grid-cols-3 gap-4">
          <input
            type="email"
            placeholder="Email"
            value={newClient.email}
            onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
            className="border p-2 rounded"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={newClient.password}
            onChange={(e) => setNewClient({ ...newClient, password: e.target.value })}
            className="border p-2 rounded"
            required
          />
          <select
            value={newClient.subscriptionPlan}
            onChange={(e) => setNewClient({ ...newClient, subscriptionPlan: e.target.value })}
            className="border p-2 rounded"
          >
            <option value="basic">Basic</option>
            <option value="premium">Premium</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>
        <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700" type="submit">
          Add Client
        </button>
      </form>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by email"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setCurrentPage(1);
          }}
          className="border px-3 py-2 rounded w-full"
        />
      </div>

      <h2 className="text-xl font-semibold mb-2">All Clients</h2>
      <table className="w-full border-collapse border">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2">Email</th>
            <th className="border p-2">Client ID</th>
            <th className="border p-2">Plan</th>
            <th className="border p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {paginatedClients.map((client) => (
            <tr key={client._id}>
              <td className="border p-2">{client.email}</td>
              <td className="border p-2">{client.clientID}</td>
              <td className="border p-2 capitalize">{client.subscriptionPlan}</td>
              <td className="border p-2 space-x-2">
                <button
                  onClick={() => handleDeleteClient(client._id)}
                  className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                >
                  Delete
                </button>
                <button
                  onClick={() => setEditClient(client)}
                  className="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600"
                >
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

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

      {editClient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-md w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Edit Client</h2>
            <div className="space-y-4">
              <input
                type="email"
                className="w-full border p-2 rounded"
                value={editClient.email}
                onChange={(e) => setEditClient({ ...editClient, email: e.target.value })}
              />
              <select
                value={editClient.subscriptionPlan}
                onChange={(e) => setEditClient({ ...editClient, subscriptionPlan: e.target.value })}
                className="w-full border p-2 rounded"
              >
                <option value="basic">Basic</option>
                <option value="premium">Premium</option>
                <option value="enterprise">Enterprise</option>
              </select>
              <input
                type="password"
                placeholder="New Password (optional)"
                className="w-full border p-2 rounded"
                value={editClient.newPassword || ''}
                onChange={(e) => setEditClient({ ...editClient, newPassword: e.target.value })}
              />
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => setEditClient(null)}
                className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
