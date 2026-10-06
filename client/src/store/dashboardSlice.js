import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '../api/client';

export const fetchSummary = createAsyncThunk('dashboard/summary', async (params, { signal, rejectWithValue }) => {
  try { return await api.get('/analytics/summary', params, signal); } catch (e) { return rejectWithValue(e.message); }
});
export const fetchDrill = createAsyncThunk('dashboard/drill', async ({ category, params }, { signal, rejectWithValue }) => {
  try { return (await api.get(`/analytics/category/${encodeURIComponent(category)}`, params, signal)).data; } catch (e) { return rejectWithValue(e.message); }
});
export const fetchMeta = createAsyncThunk('dashboard/meta', async (_, { rejectWithValue }) => {
  try { return (await api.get('/meta/filters')).data; } catch (e) { return rejectWithValue(e.message); }
});

const slice = createSlice({
  name: 'dashboard',
  initialState: {
    summary: null, meta: null, loading: false, error: null,
    drill: null, drillLoading: false, drillError: null,
    options: null,
  },
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchSummary.pending, (s) => { s.loading = true; s.error = null; })
      .addCase(fetchSummary.fulfilled, (s, { payload }) => { s.loading = false; s.summary = payload.data; s.meta = payload.meta; })
      .addCase(fetchSummary.rejected, (s, { payload, error, meta }) => {
        if (meta.aborted) return; // superseded by a newer request
        s.loading = false; s.error = payload || error.message;
      })
      .addCase(fetchDrill.pending, (s) => { s.drillLoading = true; s.drillError = null; })
      .addCase(fetchDrill.fulfilled, (s, { payload }) => { s.drillLoading = false; s.drill = payload; })
      .addCase(fetchDrill.rejected, (s, { payload, error, meta }) => { if (!meta.aborted) { s.drillLoading = false; s.drillError = payload || error.message; } })
      .addCase(fetchMeta.fulfilled, (s, { payload }) => { s.options = payload; });
  },
});
export default slice.reducer;
