import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  from: '', to: '', category: '', status: '',
  currency: 'INR',
  metric: 'revenue',       // 'revenue' | 'orders'  (toggle view)
  granularity: 'month',    // 'month' | 'day'
  drillCategory: '',       // drill-down selection
};

const slice = createSlice({
  name: 'filters',
  initialState,
  reducers: {
    setFilter: (s, { payload }) => { Object.assign(s, payload); },
    clearFilters: (s) => { s.from = ''; s.to = ''; s.category = ''; s.status = ''; s.drillCategory = ''; },
  },
});

export const { setFilter, clearFilters } = slice.actions;
// Only the params that go to the API (not UI-only state like metric)
export const selectApiFilters = (s) => {
  const { from, to, category, status, currency, granularity } = s.filters;
  return { from, to, category, status, currency, granularity };
};
export default slice.reducer;
