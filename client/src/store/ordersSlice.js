import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '../api/client';

export const fetchOrders = createAsyncThunk('orders/fetch', async (params, { signal, rejectWithValue }) => {
  try { return await api.get('/orders', params, signal); } catch (e) { return rejectWithValue(e.message); }
});

const slice = createSlice({
  name: 'orders',
  initialState: { rows: [], pagination: { page: 1, pages: 1, total: 0, limit: 10 }, loading: false, error: null },
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchOrders.pending, (s) => { s.loading = true; s.error = null; })
      .addCase(fetchOrders.fulfilled, (s, { payload }) => { s.loading = false; s.rows = payload.data; s.pagination = payload.meta.pagination; })
      .addCase(fetchOrders.rejected, (s, { payload, error, meta }) => { if (!meta.aborted) { s.loading = false; s.error = payload || error.message; } });
  },
});
export default slice.reducer;
