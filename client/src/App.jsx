import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import Products from './pages/Products';
import Countries from './pages/Countries';
import Ingest from './pages/Ingest';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
import { fetchMeta } from './store/dashboardSlice';
import { useAuth } from './auth';

export default function App() {
  const dispatch = useDispatch();
  const { user } = useAuth();
  useEffect(() => { if (user) dispatch(fetchMeta()); }, [dispatch, user]);
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="orders" element={<Orders />} />
        <Route path="products" element={<Products />} />
        <Route path="countries" element={<Countries />} />
        <Route path="ingest" element={<Ingest />} />
        <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
